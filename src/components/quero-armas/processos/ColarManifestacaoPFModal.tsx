// ============================================================================
// ColarManifestacaoPFModal — a equipe cola o que a PF escreveu
// ----------------------------------------------------------------------------
// Depois do protocolo, tudo o que acontece está dentro do SINARM, na conta do
// cliente. A equipe entra com o gov.br dele, abre "Ver Notificação",
// "Visualizar Parecer" ou "Ver Manifestação", copia o texto e cola aqui.
// Salvando, o cliente passa a ler no portal — nas palavras do delegado.
//
// O TEXTO É SALVO COMO VEIO. Nada de reescrever para "ficar mais claro": ele é
// prova do que a PF exigiu, é o que fundamenta o recurso, e é o que a IA vai
// ler para dizer o que ainda falta. Editar destrói as três coisas.
//
// Os campos ao lado (delegado, prazo, canal) são preenchidos por quem cola. São
// opcionais de propósito: texto sem metadado ainda serve ao cliente; metadado
// obrigatório faria a equipe adiar o registro — e o cliente ficaria sem saber.
// ============================================================================

import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getVendaFK } from "@/components/quero-armas/clientes/clientFK";
import {
  patchPrazoDoItem,
  statusProcessoDoStatusManifestacao,
} from "@/lib/quero-armas/manifestacaoPrazoPF";

/** Tipos de documento que a PF publica no SINARM. */
const TIPOS: Array<{ valor: string; label: string; statusSugerido: string }> = [
  { valor: "notificacao", label: "Notificação (a PF pediu algo)", statusSugerido: "notificado" },
  { valor: "parecer", label: "Parecer do delegado", statusSugerido: "em_analise_orgao" },
  { valor: "manifestacao", label: "Manifestação", statusSugerido: "em_analise_orgao" },
  { valor: "decisao", label: "Decisão final", statusSugerido: "indeferido" },
];

// A ORDEM AQUI É A DA VIDA DO PROCESSO. E `recurso_indeferido` é o único item
// que não existe em `qa_processos.status`: lá o processo continua `indeferido`.
// A distinção mora aqui porque é aqui que ela decide o que vem depois — negado
// o recurso, esgota-se a via administrativa (Lei 9.784/99) e o que resta é o
// juiz, com 120 dias para o mandado de segurança.
const STATUS: Array<{ valor: string; label: string }> = [
  { valor: "em_analise_orgao", label: "Em análise pela PF" },
  { valor: "notificado", label: "Notificado" },
  { valor: "indeferido", label: "Indeferido" },
  { valor: "deferido", label: "Deferido" },
  { valor: "recurso_administrativo", label: "Recurso protocolado" },
  { valor: "recurso_indeferido", label: "Recurso NEGADO — abre prazo do MS" },
];

/**
 * Status em que a PF EXIGE algo do cliente. Só nesses a IA é acionada:
 * parecer de andamento e deferimento não abrem exigência, e rodar a IA neles
 * seria pagar chamada para receber lista vazia.
 */
const PEDE_ALGO = new Set(["notificado", "indeferido", "recurso_indeferido"]);

const CANAIS: Array<{ valor: string; label: string }> = [
  { valor: "sistema", label: "Pelo site da PF" },
  { valor: "email", label: "Por e-mail" },
  { valor: "presencial", label: "Presencialmente" },
];

function hojeISO(): string {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
}

/**
 * Leva a data da manifestação para a linha de `qa_itens_venda`, que é de onde
 * a Dashboard tira o contador de prazos.
 *
 * A PONTE TEM UMA TRADUÇÃO NO MEIO, e é fácil errar: `qa_processos.venda_id`
 * aponta para `qa_vendas.id` (o id real), enquanto `qa_itens_venda.venda_id`
 * aponta para `qa_vendas.id_legado`. Comparar os dois direto casa na maioria
 * dos clientes — os que nasceram sem legado, onde os dois números são iguais —
 * e falha silenciosamente justo nos vindos do sistema antigo.
 *
 * Falhar aqui NÃO derruba o registro da manifestação: o texto do cliente é o
 * que não pode se perder. O prazo vira um aviso para a equipe conferir.
 */
async function gravarPrazoNoItemDaVenda(
  processoId: string,
  statusManifestacao: string,
  dataDocumento: string,
): Promise<void> {
  const patch = patchPrazoDoItem({
    status: statusManifestacao,
    dataDocumento: dataDocumento || null,
    hojeISO: hojeISO(),
  });
  if (Object.keys(patch).length === 0) return;

  try {
    const { data: proc } = await supabase
      .from("qa_processos")
      .select("venda_id, servico_id")
      .eq("id", processoId)
      .maybeSingle();
    const vendaId = (proc as { venda_id?: number | null } | null)?.venda_id ?? null;
    const servicoId = (proc as { servico_id?: number | null } | null)?.servico_id ?? null;
    if (!vendaId || !servicoId) {
      toast.warning("Prazo não lançado: o processo não está ligado a uma venda/serviço.");
      return;
    }

    const { data: venda } = await supabase
      .from("qa_vendas")
      .select("id, id_legado")
      .eq("id", vendaId)
      .maybeSingle();
    const fkVenda = getVendaFK(venda as { id: number; id_legado?: number | null } | null);
    if (!fkVenda) {
      toast.warning("Prazo não lançado: venda do processo não encontrada.");
      return;
    }

    const { data: atualizados, error } = await supabase
      .from("qa_itens_venda")
      .update(patch as never)
      .eq("venda_id", fkVenda)
      .eq("servico_id", servicoId)
      .select("id");
    if (error) throw error;
    if (!atualizados || atualizados.length === 0) {
      toast.warning("Prazo não lançado: nenhum item desta venda corresponde ao serviço.");
    }
  } catch (e) {
    console.error("[manifestacao] prazo não lançado na venda", e);
    toast.warning("Texto registrado, mas o prazo não entrou no painel da equipe. Confira na venda.");
  }
}

export interface ColarManifestacaoPFModalProps {
  open: boolean;
  processoId: string;
  onClose: () => void;
  onSalvo?: () => void;
}

export default function ColarManifestacaoPFModal({
  open,
  processoId,
  onClose,
  onSalvo,
}: ColarManifestacaoPFModalProps) {
  const [tipo, setTipo] = useState("notificacao");
  const [statusProcesso, setStatusProcesso] = useState("notificado");
  const [texto, setTexto] = useState("");
  const [delegadoNome, setDelegadoNome] = useState("");
  const [delegadoCargo, setDelegadoCargo] = useState("");
  const [unidade, setUnidade] = useState("");
  const [dataDocumento, setDataDocumento] = useState("");
  const [prazoDias, setPrazoDias] = useState("10");
  const [prazoLimite, setPrazoLimite] = useState("");
  const [canal, setCanal] = useState("sistema");
  const [contato, setContato] = useState("");
  const [salvando, setSalvando] = useState(false);
  // Ligado por padrão: é o caminho normal. O desligar existe para o caso em que
  // a equipe já sabe o que pedir e não quer a IA abrindo exigência a mais.
  const [analisarComIA, setAnalisarComIA] = useState(true);

  if (!open) return null;

  const trocarTipo = (v: string) => {
    setTipo(v);
    const sugerido = TIPOS.find((t) => t.valor === v)?.statusSugerido;
    if (sugerido) setStatusProcesso(sugerido);
  };

  const salvar = async () => {
    if (texto.trim().length < 30) {
      toast.error("Cole o texto da PF (mínimo 30 caracteres).");
      return;
    }
    setSalvando(true);
    try {
      const { data: sess } = await supabase.auth.getUser();
      const { data: inserida, error } = await supabase.from("qa_processo_manifestacoes_pf" as never).insert({
        processo_id: processoId,
        tipo,
        status_processo: statusProcesso || null,
        texto: texto.trim(),
        delegado_nome: delegadoNome.trim() || null,
        delegado_cargo: delegadoCargo.trim() || null,
        unidade_pf: unidade.trim() || null,
        data_documento: dataDocumento || null,
        prazo_dias: prazoDias ? Number(prazoDias) : null,
        prazo_limite: prazoLimite || null,
        canal_resposta: canal || null,
        contato: contato.trim() || null,
        registrado_por: sess?.user?.id ?? null,
      } as never).select("id").maybeSingle();
      if (error) throw error;
      const manifestacaoId = (inserida as { id?: string } | null)?.id ?? null;

      // O status do processo acompanha o documento: colar a notificação e
      // esquecer de mudar o status deixaria o cliente vendo "em análise"
      // enquanto o prazo dele corre.
      //
      // O erro é CHECADO. `qa_processos.status` tem CHECK: um status fora da
      // lista faz o UPDATE falhar, e engolir esse erro deixaria a manifestação
      // salva com o processo parado no status anterior — o pior dos dois
      // mundos, porque a tela diria que deu certo.
      const statusAlvo = statusProcessoDoStatusManifestacao(statusProcesso);
      if (statusAlvo) {
        const { error: stErr } = await supabase
          .from("qa_processos")
          .update({ status: statusAlvo, updated_at: new Date().toISOString() })
          .eq("id", processoId);
        if (stErr) {
          console.error("[manifestacao] status do processo não mudou", stErr);
          toast.warning(
            `Texto registrado, mas o status do processo não mudou (${stErr.message}). Ajuste na mão.`,
          );
        }
      }

      // PRAZO PARA A EQUIPE — o painel da Dashboard não lê texto, lê data.
      // Sem esta escrita, colar a notificação avisaria o cliente e deixaria a
      // equipe no escuro até alguém lembrar de digitar a data na venda.
      await gravarPrazoNoItemDaVenda(processoId, statusProcesso, dataDocumento);

      // EVENTO — a aba Histórico do processo é o log de tudo o que aconteceu.
      // Uma manifestação da PF que não deixa rastro ali some entre a montagem
      // da juntada e o protocolo, e a próxima pessoa que abrir o processo não
      // tem como saber que a PF já falou.
      await supabase.from("qa_processo_eventos").insert({
        processo_id: processoId,
        tipo_evento: "manifestacao_pf_registrada",
        descricao:
          `${TIPOS.find((t) => t.valor === tipo)?.label ?? tipo} registrada` +
          (prazoLimite ? ` · prazo até ${prazoLimite.split("-").reverse().join("/")}` : "") +
          (delegadoNome.trim() ? ` · ${delegadoNome.trim()}` : ""),
        ator: "equipe_operacional",
        dados_json: {
          tipo,
          status_processo: statusProcesso || null,
          data_documento: dataDocumento || null,
          prazo_limite: prazoLimite || null,
          unidade_pf: unidade.trim() || null,
          caracteres: texto.trim().length,
        },
      });

      // E-MAIL AO CLIENTE — tudo é comunicado por e-mail.
      // O texto integral NÃO vai no corpo: e-mail longo com juridiquês não é
      // lido, e o portal já mostra o documento inteiro formatado. O e-mail
      // carrega o que muda a ação dele — o que aconteceu e até quando responder.
      try {
        const { data: proc } = await supabase
          .from("qa_processos")
          .select("cliente_id, servico_nome")
          .eq("id", processoId)
          .maybeSingle();
        const clienteId = (proc as { cliente_id?: number } | null)?.cliente_id;
        if (clienteId) {
          const { data: cli } = await supabase
            .from("qa_clientes")
            .select("nome_completo, email")
            .eq("id", clienteId)
            .maybeSingle();
          const email = (cli as { email?: string } | null)?.email;
          if (email) {
            const rotuloStatus = STATUS.find((x) => x.valor === statusProcesso)?.label ?? statusProcesso;
            const prazoTexto = prazoLimite
              ? `Prazo para responder: até ${prazoLimite.split("-").reverse().join("/")}.`
              : prazoDias
                ? `Prazo para responder: ${prazoDias} dias a contar desta comunicação.`
                : "";
            await supabase.functions.invoke("send-transactional-email", {
              body: {
                templateName: "evento-status-orgao",
                recipientEmail: email,
                idempotencyKey: `manifestacao-${processoId}-${Date.now()}`,
                templateData: {
                  nome: (cli as { nome_completo?: string } | null)?.nome_completo ?? "",
                  servico: (proc as { servico_nome?: string } | null)?.servico_nome ?? "",
                  status: rotuloStatus,
                  observacao:
                    `${prazoTexto} O texto completo da Polícia Federal está na sua Área do Cliente. ` +
                    "Não responda sozinho — nós preparamos a resposta.",
                },
              },
            });
          }
        }
      } catch (e) {
        console.warn("[manifestacao] e-mail ao cliente falhou", e);
        toast.warning("Registrado, mas o e-mail ao cliente falhou. Avise manualmente.");
      }

      // ── A IA LÊ O DELEGADO E ABRE AS EXIGÊNCIAS ─────────────────────────
      // Roda DEPOIS de tudo o que importa já estar salvo. Se a IA cair, o
      // texto, o status, o prazo e o e-mail já foram: a equipe perde a
      // automação, não o registro. Só faz sentido quando a PF pediu algo —
      // parecer de andamento e deferimento não geram exigência.
      if (manifestacaoId && analisarComIA && PEDE_ALGO.has(statusProcesso)) {
        try {
          const { data: r, error: iaErr } = await supabase.functions.invoke(
            "qa-manifestacao-analisar",
            { body: { manifestacao_id: manifestacaoId } },
          );
          if (iaErr) throw iaErr;
          const criadas = Number((r as { exigencias_criadas?: number } | null)?.exigencias_criadas ?? 0);
          const apontados = ((r as { elementos_novos?: unknown[] } | null)?.elementos_novos ?? []).length;
          if (criadas > 0) {
            toast.success(`IA abriu ${criadas} exigência(s) no checklist do cliente.`);
          } else if (apontados > 0) {
            toast.info("IA leu o texto: o que a PF pediu já está no checklist.");
          } else {
            toast.info("IA leu o texto e não encontrou documento novo a pedir.");
          }
        } catch (e) {
          console.warn("[manifestacao] análise da IA falhou", e);
          toast.warning("Registrado, mas a IA não conseguiu ler o texto. Abra as exigências à mão.");
        }
      }

      toast.success("Registrado. O cliente já vê o texto no portal.");
      setTexto("");
      onSalvo?.();
      onClose();
    } catch (e) {
      toast.error("Erro ao registrar: " + ((e as Error)?.message ?? "desconhecido"));
    } finally {
      setSalvando(false);
    }
  };

  const campo = "h-8 w-full rounded-md border border-slate-300 px-2 text-[12px] outline-none focus:border-[#8A1224]";
  const rotulo = "text-[9px] font-bold uppercase tracking-wider text-slate-500";

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-3" onClick={onClose}>
      <div
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-start justify-between gap-2">
          <div>
            <h3 className="text-[13px] font-bold uppercase tracking-wider text-[#7A1F2B]">
              Registrar manifestação da Polícia Federal
            </h3>
            <p className="mt-0.5 text-[11px] text-slate-500">
              Cole o texto exatamente como está no SINARM. O cliente lê no portal.
            </p>
          </div>
          <button type="button" onClick={onClose} className="text-[18px] leading-none text-slate-400">×</button>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className={rotulo}>Tipo de documento</label>
            <select className={campo} value={tipo} onChange={(e) => trocarTipo(e.target.value)}>
              {TIPOS.map((t) => <option key={t.valor} value={t.valor}>{t.label}</option>)}
            </select>
          </div>
          <div>
            <label className={rotulo}>Status do processo</label>
            <select className={campo} value={statusProcesso} onChange={(e) => setStatusProcesso(e.target.value)}>
              {STATUS.map((t) => <option key={t.valor} value={t.valor}>{t.label}</option>)}
            </select>
          </div>
        </div>

        <div className="mt-2">
          <label className={rotulo}>Texto da PF — cole sem editar</label>
          <textarea
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            rows={10}
            placeholder="Senhor Requerente, Após análise preliminar do seu requerimento…"
            className="w-full rounded-md border border-slate-300 p-2 text-[12px] leading-relaxed outline-none focus:border-[#8A1224]"
          />
          <p className="mt-0.5 text-[10px] text-slate-500">
            {texto.trim().length} caracteres. Mantenha as quebras de linha originais.
          </p>
        </div>

        <div className="mt-2 grid grid-cols-3 gap-2">
          <div className="col-span-2">
            <label className={rotulo}>Delegado que assina</label>
            <input className={campo} value={delegadoNome} onChange={(e) => setDelegadoNome(e.target.value)} placeholder="EVANDRO GIMENEZ SERRA" />
          </div>
          <div>
            <label className={rotulo}>Data do documento</label>
            <input type="date" className={campo} value={dataDocumento} onChange={(e) => setDataDocumento(e.target.value)} />
          </div>
          <div className="col-span-2">
            <label className={rotulo}>Cargo</label>
            <input className={campo} value={delegadoCargo} onChange={(e) => setDelegadoCargo(e.target.value)} placeholder="Chefe em exercício da DELEARM" />
          </div>
          <div>
            <label className={rotulo}>Unidade</label>
            <input className={campo} value={unidade} onChange={(e) => setUnidade(e.target.value)} placeholder="DELEARM/DREX/SR/PF/SP" />
          </div>
        </div>

        <div className="mt-2 grid grid-cols-4 gap-2">
          <div>
            <label className={rotulo}>Prazo (dias)</label>
            <input type="number" className={campo} value={prazoDias} onChange={(e) => setPrazoDias(e.target.value)} />
          </div>
          <div>
            <label className={rotulo}>Vence em</label>
            <input type="date" className={campo} value={prazoLimite} onChange={(e) => setPrazoLimite(e.target.value)} />
          </div>
          <div>
            <label className={rotulo}>Responder</label>
            <select className={campo} value={canal} onChange={(e) => setCanal(e.target.value)}>
              {CANAIS.map((c) => <option key={c.valor} value={c.valor}>{c.label}</option>)}
            </select>
          </div>
          <div>
            <label className={rotulo}>Contato / e-mail</label>
            <input className={campo} value={contato} onChange={(e) => setContato(e.target.value)} placeholder="uarm.sjk.sp@pf.gov.br" />
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between gap-2">
          <label className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-600">
            <input
              type="checkbox"
              checked={analisarComIA}
              onChange={(e) => setAnalisarComIA(e.target.checked)}
              className="h-3.5 w-3.5 accent-[#8A1224]"
            />
            IA lê o texto e abre as exigências
            {!PEDE_ALGO.has(statusProcesso) && (
              <span className="font-medium normal-case tracking-normal text-slate-400">
                — só roda em notificação ou indeferimento
              </span>
            )}
          </label>
        </div>

        <div className="mt-2 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="h-8 rounded-md px-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">
            Cancelar
          </button>
          <button
            type="button"
            onClick={salvar}
            disabled={salvando}
            className="h-8 rounded-md bg-[#8A1224] px-4 text-[10px] font-bold uppercase tracking-wider text-white hover:bg-[#6f0f1e] disabled:opacity-60"
          >
            {salvando ? "Registrando…" : "Registrar e avisar o cliente"}
          </button>
        </div>
      </div>
    </div>
  );
}
