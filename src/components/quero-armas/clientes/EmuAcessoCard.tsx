import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Eye, Loader2, ShieldCheck } from "lucide-react";
import { codificarParaUrl, type EmuSessao } from "@/lib/quero-armas/emuSessao";

type Props = { clienteId: number | string; clienteNome?: string | null; clienteEmail?: string | null };

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
export default function EmuAcessoCard({ clienteId, clienteNome, clienteEmail }: Props) {
  const [motivo, setMotivo] = useState("");
  const [processo, setProcesso] = useState("");
  const [minutos, setMinutos] = useState(30);
  const [loading, setLoading] = useState(false);
  const [historico, setHistorico] = useState<SessaoHistorico[]>([]);

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

  async function abrirEspelho() {
    if (motivo.trim().length < 5) {
      toast.error("Descreva o motivo do acesso.");
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("qa-emu-sessao", {
        body: {
          action: "iniciar",
          cliente_id: Number(clienteId),
          motivo: motivo.trim(),
          processo_ref: processo.trim(),
          minutos,
        },
      });
      if (error || !data?.ok) {
        // "Failed to send a request" = o navegador nem alcançou a função. Não é
        // erro de permissão nem de dados: a edge function não está publicada.
        const msg = String(error?.message || "");
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
      window.open(`/area-do-cliente?emu=${codificarParaUrl(payload)}`, "_blank", "noopener");
      toast.success(
        data.email_enviado ? "Espelho aberto. O cliente foi avisado por e-mail." : "Espelho aberto (e-mail de aviso não saiu).",
      );
      setMotivo("");
      setProcesso("");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-3">
      <div className="flex items-center gap-2">
        <Eye className="h-4 w-4 text-[#7A1F2B]" />
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
      <Input
        value={processo}
        onChange={(e) => setProcesso(e.target.value.toUpperCase())}
        placeholder="PROCESSO / SERVIÇO (EX.: AUTORIZAÇÃO DE COMPRA)"
        className="h-9 text-xs"
      />
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
        className="h-10 w-full rounded-xl bg-[#7A1F2B] text-xs font-bold uppercase tracking-wider text-white hover:bg-[#641722]"
      >
        {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Eye className="mr-2 h-4 w-4" />}
        Abrir área do cliente em espelho
      </Button>

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
