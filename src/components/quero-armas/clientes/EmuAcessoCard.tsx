import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Eye, Loader2, ShieldCheck } from "lucide-react";
import { codificarParaUrl, type EmuSessao } from "@/lib/quero-armas/emuSessao";

type Props = {
  clienteId: number | string;
  /** qa_processos grava ora o id real, ora o legado — consultamos os dois. */
  clienteIdLegado?: number | null;
  clienteNome?: string | null;
  clienteEmail?: string | null;
};

interface ProcessoOpcao {
  id: string;
  servico_nome: string;
  status: string | null;
  pagamento_status: string | null;
  data_criacao: string | null;
}

/** Pago primeiro — é o caso normal de atendimento; o resto desce. */
function ordenarProcessos(a: ProcessoOpcao, b: ProcessoOpcao): number {
  const pago = (p: ProcessoOpcao) => (p.pagamento_status === "confirmado" ? 0 : 1);
  if (pago(a) !== pago(b)) return pago(a) - pago(b);
  return String(b.data_criacao || "").localeCompare(String(a.data_criacao || ""));
}

function rotuloProcesso(p: ProcessoOpcao): string {
  const nome = p.servico_nome || "Serviço sem nome";
  const situacao = String(p.status || "").replace(/_/g, " ");
  const pago = p.pagamento_status === "confirmado" ? "" : " · PAGAMENTO PENDENTE";
  return situacao ? `${nome} — ${situacao}${pago}` : `${nome}${pago}`;
}

interface SessaoHistorico {
  id: string;
  operador_nome: string | null;
  operador_email: string | null;
  motivo: string;
  iniciado_em: string;
  encerrado_em: string | null;
  resumo: string | null;
  acoes: { descricao?: string }[] | null;
}

const fmt = (d?: string | null) =>
  d
    ? new Date(d).toLocaleString("pt-BR", {
        day: "2-digit", month: "2-digit", year: "2-digit",
        hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo",
      })
    : "—";

/**
 * MODO ESPELHO — abre a Área do Cliente exatamente como o cliente a vê, em uma
 * aba nova, sem trocar de conta: o operador continua logado como ele mesmo.
 * Por isso toda alteração já sai carimbada com o nome do operador no histórico
 * que o cliente lê, e contratação/pagamento/assinatura ficam travados no banco.
 */
export default function EmuAcessoCard({ clienteId, clienteIdLegado, clienteNome, clienteEmail }: Props) {
  const [motivo, setMotivo] = useState("");
  /** id do processo escolhido; "" = nenhum, "outro" = digitar à mão. */
  const [processoId, setProcessoId] = useState("");
  const [processoLivre, setProcessoLivre] = useState("");
  const [processos, setProcessos] = useState<ProcessoOpcao[]>([]);
  const [carregandoProcessos, setCarregandoProcessos] = useState(true);
  const [minutos, setMinutos] = useState(30);
  const [loading, setLoading] = useState(false);
  const [historico, setHistorico] = useState<SessaoHistorico[]>([]);
  /** Sessão criada mas aba bloqueada pelo navegador — link de resgate. */
  const [urlPendente, setUrlPendente] = useState<string | null>(null);

  useEffect(() => {
    let ativo = true;
    (async () => {
      const { data } = await supabase.functions.invoke("qa-emu-sessao", {
        body: { action: "listar", cliente_id: Number(clienteId) },
      });
      if (ativo && data?.ok) setHistorico((data.items as SessaoHistorico[]) ?? []);
    })();
    return () => { ativo = false; };
  }, [clienteId]);

  // O que o cliente contratou. Ler direto da tabela (o operador é staff e a RLS
  // já libera) evita mais uma ida à edge function só para preencher um campo.
  useEffect(() => {
    let ativo = true;
    (async () => {
      setCarregandoProcessos(true);
      const ids = Array.from(
        new Set([Number(clienteId), Number(clienteIdLegado ?? clienteId)]),
      ).filter((n) => Number.isFinite(n) && n > 0);
      const { data } = await supabase
        .from("qa_processos")
        .select("id, servico_nome, status, pagamento_status, data_criacao")
        .in("cliente_id", ids)
        .not("status", "in", "(cancelado,arquivado)")
        .order("data_criacao", { ascending: false });
      if (!ativo) return;
      const lista = ((data as unknown as ProcessoOpcao[]) ?? []).slice().sort(ordenarProcessos);
      setProcessos(lista);
      // Um processo só: já vem escolhido, não faz sentido obrigar o clique.
      if (lista.length === 1) setProcessoId(lista[0].id);
      setCarregandoProcessos(false);
    })();
    return () => { ativo = false; };
  }, [clienteId, clienteIdLegado]);

  async function abrirEspelho() {
    if (motivo.trim().length < 5) {
      toast.error("Descreva o motivo do acesso.");
      return;
    }
    const escolhido = processos.find((p) => p.id === processoId) || null;
    const processoRef = escolhido ? escolhido.servico_nome : processoLivre.trim();

    // A aba precisa nascer AQUI, ainda dentro do clique. Depois do `await` o
    // navegador já não reconhece o gesto do usuário e bloqueia o window.open
    // (Safari é implacável nisso). Abrimos em branco agora e só apontamos a URL
    // quando a sessão voltar. Sem `noopener`: com ele o retorno vem null e
    // perdemos a referência para navegar.
    const aba = window.open("", "_blank");

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("qa-emu-sessao", {
        body: {
          action: "iniciar",
          cliente_id: Number(clienteId),
          motivo: motivo.trim(),
          processo_id: escolhido ? escolhido.id : null,
          processo_ref: processoRef,
          minutos,
        },
      });
      if (error || !data?.ok) {
        // "Failed to send a request" = o navegador nem alcançou a função. Não é
        // erro de permissão nem de dados: a edge function não está publicada.
        const msg = String(error?.message || "");
        aba?.close();
        if (/failed to send|fetch/i.test(msg)) {
          toast.error("A função qa-emu-sessao ainda não foi publicada no Supabase. Publique o projeto e tente de novo.");
          return;
        }
        toast.error((data as { error?: string } | null)?.error || msg || "Não foi possível abrir o espelho.");
        return;
      }
      const s = data.sessao as {
        id: string; cliente_id: number; cliente_nome: string;
        operador_nome: string; operador_email: string; expira_em: string;
      };
      const payload: EmuSessao = {
        sessaoId: s.id,
        clienteId: s.cliente_id,
        clienteNome: s.cliente_nome || String(clienteNome || "cliente"),
        operadorNome: s.operador_nome,
        operadorEmail: s.operador_email,
        expiraEm: s.expira_em,
      };
      const destino = `/area-do-cliente?emu=${codificarParaUrl(payload)}`;

      if (aba && !aba.closed) {
        // Não precisamos do vínculo com esta aba; cortamos por higiene.
        try { aba.opener = null; } catch { /* navegador pode recusar — tudo bem */ }
        aba.location.replace(destino);
      } else {
        // Aba barrada (iframe do preview do Lovable sem allow-popups, bloqueador
        // de pop-up). A sessão JÁ existe no servidor — não pode ficar órfã, então
        // oferecemos o link para o operador abrir com um clique dele.
        setUrlPendente(destino);
        toast.warning("Seu navegador bloqueou a aba nova. Use o botão que apareceu no cartão.");
      }

      toast.success(
        data.email_enviado ? "Espelho aberto. O cliente foi avisado por e-mail." : "Espelho aberto (e-mail de aviso não saiu).",
      );
      setMotivo("");
      setProcessoLivre("");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-3">
      <div className="flex items-center gap-2">
        <Eye className="h-4 w-4 text-[#2F3337]" />
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600">Modo espelho (auditado)</h4>
      </div>
      <p className="text-[11px] leading-relaxed text-slate-500">
        Abre a Área do Cliente de <strong>{clienteNome || "este cliente"}</strong>
        {clienteEmail ? ` (${clienteEmail})` : ""} <strong>exatamente como ele vê</strong>, em uma aba nova.
        Você <strong>não</strong> troca de conta: continua logado como você, e por isso toda alteração aparece
        no histórico do cliente com o seu nome. O cliente é avisado por e-mail na abertura e recebe o resumo no fim.
      </p>
      <p className="rounded-lg bg-amber-50 px-3 py-2 text-[10px] font-semibold leading-relaxed text-amber-800">
        <ShieldCheck className="mr-1 inline h-3 w-3" />
        Único bloqueio: contratar serviço, pagar e assinar contrato continuam sendo só do cliente — travado no banco,
        não só na tela.
      </p>
      {/* O processo não se digita: escolhe-se entre o que o cliente contratou.
          Digitar à mão gerava divergência com o nome real do serviço e ainda
          fazia o e-mail sair citando um processo que não existe. */}
      <div className="space-y-1">
        <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">
          Processo do cliente
        </label>
        {carregandoProcessos ? (
          <div className="flex h-9 items-center gap-2 rounded-lg border border-slate-200 px-3 text-xs text-slate-400">
            <Loader2 className="h-3 w-3 animate-spin" /> Carregando contratações…
          </div>
        ) : (
          <select
            value={processoId}
            onChange={(e) => setProcessoId(e.target.value)}
            className="h-9 w-full rounded-lg border border-slate-200 px-2 text-xs"
          >
            <option value="">
              {processos.length ? "Selecione o processo…" : "Cliente sem processo contratado"}
            </option>
            {processos.map((p) => (
              <option key={p.id} value={p.id}>{rotuloProcesso(p)}</option>
            ))}
            <option value="outro">Outro / não relacionado a um processo</option>
          </select>
        )}
        {processoId === "outro" && (
          <Input
            value={processoLivre}
            onChange={(e) => setProcessoLivre(e.target.value.toUpperCase())}
            placeholder="DESCREVA O ASSUNTO"
            className="h-9 text-xs"
          />
        )}
        {!carregandoProcessos && processos.length === 0 && (
          <p className="text-[10px] text-slate-400">
            Nenhuma contratação ativa encontrada. Use “Outro” para descrever o assunto.
          </p>
        )}
      </div>
      <Textarea
        value={motivo}
        onChange={(e) => setMotivo(e.target.value)}
        placeholder="Motivo do acesso (obrigatório e registrado em auditoria)"
        className="min-h-[64px] text-xs"
      />
      <label className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">
        Duração
        <select
          value={minutos}
          onChange={(e) => setMinutos(Number(e.target.value))}
          className="h-8 rounded-lg border border-slate-200 px-2 text-xs font-normal normal-case tracking-normal"
        >
          <option value={15}>15 min</option>
          <option value={30}>30 min</option>
          <option value={60}>1 hora</option>
          <option value={120}>2 horas</option>
        </select>
      </label>
      <Button
        onClick={abrirEspelho}
        disabled={loading}
        className="h-10 w-full rounded-xl bg-[#2F3337] text-xs font-bold uppercase tracking-wider text-white hover:bg-[#26292C]"
      >
        {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Eye className="mr-2 h-4 w-4" />}
        Abrir área do cliente em espelho
      </Button>

      {/* Sessão criada, aba barrada. Âncora de verdade: o clique do operador é
          gesto direto e passa onde o window.open programático não passa. */}
      {urlPendente && (
        <div className="space-y-1.5 rounded-xl border border-amber-200 bg-amber-50 p-3">
          <p className="text-[10px] font-bold uppercase tracking-wider text-amber-800">
            Sessão aberta — seu navegador bloqueou a aba
          </p>
          <a
            href={urlPendente}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setUrlPendente(null)}
            className="flex h-9 w-full items-center justify-center gap-2 rounded-lg bg-[#2F3337] text-[11px] font-bold uppercase tracking-wider text-white hover:bg-[#26292C]"
          >
            <Eye className="h-3.5 w-3.5" /> Abrir em nova aba
          </a>
          <button
            type="button"
            onClick={() => { const u = urlPendente; setUrlPendente(null); window.location.href = u; }}
            className="w-full text-[10px] font-semibold uppercase tracking-wider text-amber-800 underline"
          >
            ou abrir nesta aba
          </button>
        </div>
      )}

      {historico.length > 0 && (
        <div className="space-y-1.5 border-t border-slate-100 pt-3">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Acessos anteriores</p>
          {historico.slice(0, 5).map((h) => (
            <div key={h.id} className="rounded-lg bg-slate-50 px-3 py-2 text-[10px] leading-relaxed text-slate-600">
              <span className="font-semibold text-slate-700">{h.operador_nome || h.operador_email}</span>
              {" · "}{fmt(h.iniciado_em)}
              {h.encerrado_em ? ` → ${fmt(h.encerrado_em)}` : " · em aberto"}
              {Array.isArray(h.acoes) && h.acoes.length > 0 ? ` · ${h.acoes.length} ação(ões)` : " · sem alterações"}
              <div className="text-slate-400">{h.resumo || h.motivo}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
