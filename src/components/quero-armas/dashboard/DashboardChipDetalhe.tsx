import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { supabase } from "@/integrations/supabase/client";
import { AlertTriangle, CheckCircle2, Clock3, Database, HelpCircle, Loader2, ShieldCheck, X } from "lucide-react";

/**
 * Pop-up que ABRE os chips da coluna PROGRESSO do painel.
 *
 * Os chips mostram só o número ("4 PENDENTE(S)", "3 REAPROVEITADOS",
 * "9 NÃO SE APLICA"). Aqui sai a lista por trás de cada número: qual documento
 * exatamente está sendo contado, em que grupo do checklist ele vive, em que
 * status está e desde quando.
 *
 * A contagem NÃO é recalculada no front. Quem classifica é a função
 * `qa_painel_progresso_itens`, cópia fiel da classificação usada por
 * `qa_painel_progresso_clientes` — por isso o total de cada aba bate, item a
 * item, com o número estampado no chip.
 */

export type BaldeChip = "pendente" | "cadastro" | "analise" | "entregue" | "reaproveitado" | "nao_se_aplica";

interface ItemRPC {
  documento_id: string;
  tipo_documento: string;
  nome_documento: string | null;
  grupo_id: string | null;
  grupo_nome: string | null;
  grupo_ordem: number | null;
  item_ordem: number | null;
  status: string;
  familia: string;
  aplicavel: boolean;
  eh_pergunta: boolean;
  pergunta_chave: string | null;
  pergunta_resposta: string | null;
  conta_pendente: boolean;
  conta_cadastro: boolean;
  conta_analise: boolean;
  conta_entregue: boolean;
  conta_reaproveitado: boolean;
  conta_nao_se_aplica: boolean;
  data_envio: string | null;
  atualizado_em: string | null;
  motivo_rejeicao: string | null;
  observacoes: string | null;
}

const VERDE = "var(--qa-verde)";
const VERDE_BG = "var(--qa-verde-bg)";
const AMBAR = "var(--qa-ambar)";
const AMBAR_BG = "var(--qa-ambar-bg)";
const VERMELHO = "var(--qa-vermelho)";
const VERMELHO_BG = "var(--qa-vermelho-bg)";
const TINTA = "var(--qa-tinta)";
const TINTA_2 = "var(--qa-tinta-2)";
const TINTA_3 = "var(--qa-tinta-3)";

type DefBalde = {
  key: BaldeChip;
  titulo: string;
  explica: string;
  cor: string;
  fundo: string;
  icone: React.ComponentType<{ className?: string }>;
  pertence: (i: ItemRPC) => boolean;
};

/**
 * Ordem das abas = ordem de leitura do operador: primeiro o que trava, depois o
 * que está em suas mãos, por último o que já está resolvido.
 */
export const BALDES: DefBalde[] = [
  {
    key: "pendente",
    titulo: "PENDENTE(S)",
    explica: "Documentos e respostas que o cliente ainda precisa enviar.",
    cor: VERMELHO, fundo: VERMELHO_BG, icone: AlertTriangle,
    // O chip vermelho soma documentos pendentes + perguntas de cadastro sem
    // resposta. As duas coisas entram aqui, senão o total não bate.
    pertence: (i) => i.conta_pendente || i.conta_cadastro,
  },
  {
    key: "cadastro",
    titulo: "CADASTRO",
    explica: "Perguntas do cadastro que o cliente ainda não respondeu.",
    cor: AMBAR, fundo: AMBAR_BG, icone: HelpCircle,
    pertence: (i) => i.conta_cadastro,
  },
  {
    key: "analise",
    titulo: "EM ANÁLISE",
    explica: "Documentos entregues pelo cliente aguardando conferência da equipe.",
    cor: AMBAR, fundo: AMBAR_BG, icone: Clock3,
    pertence: (i) => i.conta_analise,
  },
  {
    key: "entregue",
    titulo: "ENTREGUES",
    explica: "Documentos já cumpridos — é o numerador da barra de progresso.",
    cor: VERDE, fundo: VERDE_BG, icone: CheckCircle2,
    pertence: (i) => i.conta_entregue,
  },
  {
    key: "reaproveitado",
    titulo: "REAPROVEITADOS",
    explica: "Documentos que já estavam na Central antes deste processo e foram aproveitados.",
    cor: TINTA_2, fundo: "var(--qa-chip-bg)", icone: Database,
    pertence: (i) => i.conta_reaproveitado,
  },
  {
    key: "nao_se_aplica",
    titulo: "NÃO SE APLICA",
    explica: "Exigências do caminho que o cliente não seguiu — dispensadas porque o grupo já foi satisfeito.",
    cor: TINTA_2, fundo: "var(--qa-chip-bg)", icone: ShieldCheck,
    pertence: (i) => i.conta_nao_se_aplica,
  },
];

/** Rótulo humano do status cru do banco. */
const ROTULO_STATUS: Record<string, string> = {
  pendente: "PENDENTE",
  enviado: "ENVIADO",
  em_analise: "EM ANÁLISE",
  analise: "EM ANÁLISE",
  recebido: "RECEBIDO",
  revisao_humana: "REVISÃO HUMANA",
  em_revisao_humana: "REVISÃO HUMANA",
  aguardando_equipe: "AGUARDANDO EQUIPE",
  aguardando_aprovacao: "AGUARDANDO APROVAÇÃO",
  pendente_aprovacao: "AGUARDANDO APROVAÇÃO",
  divergente: "DIVERGENTE",
  ajuste_necessario: "AJUSTE NECESSÁRIO",
  invalido: "INVÁLIDO",
  aprovado: "APROVADO",
  validado: "VALIDADO",
  pre_validado: "PRÉ-VALIDADO",
  entregue: "ENTREGUE",
  entregue_pelo_hub: "ENTREGUE PELO HUB",
  dispensado: "DISPENSADO",
  dispensado_grupo: "DISPENSADO (GRUPO SATISFEITO)",
  dispensado_por_reaproveitamento: "REAPROVEITADO DA CENTRAL",
  nao_aplicavel: "NÃO APLICÁVEL",
  substituido: "SUBSTITUÍDO",
  descartado: "DESCARTADO",
  descartado_por_troca_servico: "DESCARTADO (TROCA DE SERVIÇO)",
  cancelado: "CANCELADO",
  arquivado: "ARQUIVADO",
};

function rotuloStatus(s: string) {
  const k = String(s ?? "").trim().toLowerCase();
  return ROTULO_STATUS[k] ?? k.replace(/_/g, " ").toUpperCase() ?? "—";
}

/** Nome que o operador lê. Cai no tipo técnico só quando não há nome cadastrado. */
function rotuloItem(i: ItemRPC) {
  const nome = String(i.nome_documento ?? "").trim();
  if (nome) return nome;
  return i.tipo_documento.replace(/_/g, " ");
}

function fmtDataHora(d: string | null) {
  if (!d) return null;
  try {
    return new Date(d).toLocaleString("pt-BR", {
      day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
    });
  } catch { return null; }
}

export interface ChipDetalheAlvo {
  processoId: string;
  clienteNome: string | null;
  servicoNome: string | null;
  balde: BaldeChip;
}

export function DashboardChipDetalhe({ alvo, onClose }: { alvo: ChipDetalheAlvo; onClose: () => void }) {
  const [itens, setItens] = useState<ItemRPC[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [aba, setAba] = useState<BaldeChip>(alvo.balde);

  // Trocar de linha sem fechar o pop-up precisa reposicionar a aba.
  useEffect(() => { setAba(alvo.balde); }, [alvo.processoId, alvo.balde]);

  useEffect(() => {
    let cancelado = false;
    setItens(null);
    setErro(null);
    (async () => {
      const { data, error } = await supabase.rpc("qa_painel_progresso_itens" as any, { _processo_id: alvo.processoId });
      if (cancelado) return;
      if (error) { setErro(error.message); setItens([]); return; }
      setItens(((data as any[]) ?? []) as ItemRPC[]);
    })();
    return () => { cancelado = true; };
  }, [alvo.processoId]);

  const fechar = useCallback(() => onClose(), [onClose]);

  // ESC fecha e o fundo para de rolar enquanto o pop-up está aberto.
  useEffect(() => {
    const onTecla = (e: KeyboardEvent) => { if (e.key === "Escape") fechar(); };
    document.addEventListener("keydown", onTecla);
    const overflowAntes = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onTecla);
      document.body.style.overflow = overflowAntes;
    };
  }, [fechar]);

  const lista = itens ?? [];
  const contagem = (b: DefBalde) => lista.filter(b.pertence).length;
  const defAtual = BALDES.find((b) => b.key === aba) ?? BALDES[0];
  const visiveis = lista.filter(defAtual.pertence);

  return createPortal(
    <div
      className="fixed inset-0 z-[120] flex items-end justify-center sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label={`${defAtual.titulo} — ${alvo.clienteNome ?? "cliente"}`}
      data-qa-overlay
    >
      {/* Área de clique para fechar — TRANSPARENTE.

          Decisão do titular (20/08/2026): o pop-up nasce e o painel atrás fica
          exatamente como está. Nada de desfoque e nada de escurecimento — era
          isso que deixava o fundo com cara de fosco. A camada continua aqui
          porque é ela que recebe o clique fora para fechar; ela só não pinta
          nada. Fica FORA do `.qa-scope` de propósito, como o overlay padrão do
          projeto: no modo noturno o `.qa-scope` é invertido.

          Mudança restrita a ESTE pop-up — o overlay padrão de diálogo do
          projeto não foi tocado. */}
      <div className="absolute inset-0" onClick={fechar} />

      {/* `qa-scope` é obrigatório: o pop-up é portado para o <body>, fora da
          árvore do painel, e é essa classe que carrega os tokens --qa-* (e a
          inversão do modo noturno). Sem ela o painel sai transparente. */}
      <div
        className="qa-scope relative z-10 flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl border sm:rounded-2xl"
        style={{ background: "var(--qa-paper)", borderColor: "var(--qa-linha-2)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabeçalho */}
        <div className="flex items-start gap-3 border-b px-4 py-3" style={{ borderColor: "var(--qa-linha-2)" }}>
          <div className="min-w-0 flex-1">
            <div className="text-[13px] font-bold uppercase leading-tight [overflow-wrap:anywhere]" style={{ color: TINTA }}>
              {alvo.clienteNome ?? "—"}
            </div>
            <div className="mt-0.5 text-[10.5px] font-medium uppercase tracking-[0.08em] [overflow-wrap:anywhere]" style={{ color: TINTA_3 }}>
              {alvo.servicoNome ?? "—"}
            </div>
          </div>
          <button
            type="button"
            onClick={fechar}
            aria-label="Fechar"
            className="shrink-0 rounded-full border p-1.5 transition-colors hover:bg-[var(--qa-paper-2)]"
            style={{ borderColor: "var(--qa-linha-2)", color: TINTA_2 }}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Abas: uma por chip. O número aqui é o mesmo do chip da tabela. */}
        <div className="flex flex-wrap gap-1.5 border-b px-4 py-2.5" style={{ borderColor: "var(--qa-linha-2)" }}>
          {BALDES.map((b) => {
            const n = contagem(b);
            const ativa = b.key === aba;
            const Icone = b.icone;
            return (
              <button
                key={b.key}
                type="button"
                onClick={() => setAba(b.key)}
                disabled={n === 0 && !ativa}
                className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.06em] transition-colors ${
                  n === 0 && !ativa ? "opacity-40" : ""
                }`}
                style={{
                  background: ativa ? b.fundo : "transparent",
                  color: ativa ? b.cor : TINTA_2,
                  borderColor: ativa ? b.cor : "var(--qa-linha-2)",
                }}
              >
                <Icone className="h-3 w-3" />
                {n} {b.titulo}
              </button>
            );
          })}
        </div>

        {/* Explicação curta do que a aba está listando. */}
        <div className="px-4 pt-3 text-[11px] font-medium leading-snug" style={{ color: TINTA_3 }}>
          {defAtual.explica}
        </div>

        {/* Lista */}
        <div className="min-h-0 flex-1 overflow-auto px-4 pb-4 pt-2">
          {itens === null && (
            <div className="flex items-center gap-2 py-8 text-[11.5px] font-medium uppercase" style={{ color: TINTA_3 }}>
              <Loader2 className="h-4 w-4 animate-spin" /> CARREGANDO OS ITENS…
            </div>
          )}

          {erro && (
            <div
              className="rounded-lg border px-3 py-2.5 text-[11.5px] font-medium leading-snug"
              style={{ background: VERMELHO_BG, borderColor: "var(--qa-vermelho-borda)", color: VERMELHO }}
            >
              NÃO FOI POSSÍVEL LISTAR OS ITENS.
              <div className="mt-1 font-normal normal-case" style={{ color: TINTA_2 }}>
                {erro} — se a função <code>qa_painel_progresso_itens</code> ainda não foi aplicada no
                SQL Editor do Supabase, é isso que está faltando.
              </div>
            </div>
          )}

          {itens !== null && !erro && visiveis.length === 0 && (
            <div className="py-8 text-center text-[11.5px] font-medium uppercase" style={{ color: TINTA_3 }}>
              NENHUM ITEM NESTA CATEGORIA.
            </div>
          )}

          <ul className="space-y-1.5">
            {visiveis.map((i, idx) => {
              const quando = fmtDataHora(i.data_envio ?? i.atualizado_em);
              return (
                <li
                  key={i.documento_id}
                  className="rounded-lg border px-3 py-2"
                  style={{ background: "var(--qa-paper-2)", borderColor: "var(--qa-linha-3, var(--qa-linha-2))" }}
                >
                  <div className="flex items-start gap-2">
                    <span className="mt-[1px] w-5 shrink-0 text-[10px] font-bold tabular-nums" style={{ color: TINTA_3 }}>
                      {idx + 1}.
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="text-[12px] font-bold uppercase leading-snug [overflow-wrap:anywhere]" style={{ color: TINTA }}>
                        {rotuloItem(i)}
                      </div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] font-medium uppercase tracking-[0.06em]" style={{ color: TINTA_3 }}>
                        <span className="[overflow-wrap:anywhere]">{i.grupo_nome ?? "SEM GRUPO"}</span>
                        <span>·</span>
                        <span style={{ color: TINTA_2 }}>{rotuloStatus(i.status)}</span>
                        {i.eh_pergunta && (<><span>·</span><span>PERGUNTA DO CADASTRO</span></>)}
                        {quando && (<><span>·</span><span className="tabular-nums normal-case">{quando}</span></>)}
                      </div>
                      {/* O tipo técnico é o que se procura no banco e no drawer do processo. */}
                      <div className="mt-0.5 text-[9.5px] font-medium lowercase [overflow-wrap:anywhere]" style={{ color: TINTA_3 }}>
                        {i.tipo_documento}
                      </div>
                      {i.motivo_rejeicao && (
                        <div className="mt-1 text-[10.5px] font-medium leading-snug" style={{ color: VERMELHO }}>
                          DEVOLVIDO: <span className="font-normal">{i.motivo_rejeicao}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>

        {/* Rodapé: total da aba, para conferir contra o chip. */}
        <div
          className="flex items-center justify-between border-t px-4 py-2.5 text-[10px] font-bold uppercase tracking-[0.08em]"
          style={{ borderColor: "var(--qa-linha-2)", color: TINTA_3 }}
        >
          <span>{visiveis.length} ITEM(NS) EM {defAtual.titulo}</span>
          <span>{lista.length} EXIGÊNCIAS NO PROCESSO</span>
        </div>
      </div>
    </div>,
    document.body,
  );
}
