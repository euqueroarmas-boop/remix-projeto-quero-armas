import { Check, Loader2 } from "lucide-react";

import {
  FASES,
  faseDoProcesso,
  docsPorProcesso,
  type DocParaFase,
  type ProcessoParaFase,
} from "@/lib/quero-armas/faseProcessoCliente";

/* =============================================================================
 * "ONDE ESTÁ O MEU PROCESSO"
 * -----------------------------------------------------------------------------
 * A tela inicial do cliente abria falando de vencimento de certidão. Enquanto
 * ele estava juntando documento, tudo bem — era a próxima coisa a fazer. Mas
 * quando ele termina de entregar, a lista de pendências esvazia, a granada para
 * de piscar, e a primeira coisa que ele vê continua sendo um aviso vermelho
 * mandando renovar certidão. Nada na tela diz que o processo existe, que chegou,
 * que alguém está olhando.
 *
 * O cliente lê isso como abandono — e liga.
 *
 * Este bloco vem ANTES de qualquer aviso de vencimento e responde, em uma
 * olhada, as três perguntas que ele faz no WhatsApp: em que passo eu estou, de
 * quem é a bola agora, e o que vem depois.
 * ============================================================================= */

const CORES: Record<string, { fundo: string; texto: string; rotulo: string }> = {
  cliente: { fundo: "#2F3337", texto: "#FFFFFF", rotulo: "É COM VOCÊ" },
  equipe: { fundo: "#0A0A0A", texto: "#FFFFFF", rotulo: "É COM A NOSSA EQUIPE" },
  policia_federal: { fundo: "#2F3439", texto: "#FFFFFF", rotulo: "ESTÁ NA POLÍCIA FEDERAL" },
};

export default function OndeEstaSeuProcesso({
  processos,
  processoDocs,
  onAbrirProcesso,
}: {
  processos: ProcessoParaFase[];
  processoDocs: DocParaFase[];
  onAbrirProcesso?: (processoId: string) => void;
}) {
  const emAndamento = (processos ?? []).filter(
    (p) => p?.id && !p?.deferimento_data && !p?.deferimento_documento_id,
  );
  if (emAndamento.length === 0) return null;

  const porProcesso = docsPorProcesso(processoDocs ?? []);

  return (
    <div className="qa-onde-esta">
      {emAndamento.map((p) => {
        const fase = faseDoProcesso(p, porProcesso.get(String(p.id)) ?? []);
        const cor = CORES[fase.responsavel];
        return (
          <section
            key={String(p.id)}
            className="rounded-sm border border-[#E5E5E5] bg-white"
            aria-label="Situação do seu processo"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#EEEEEE] px-5 py-3">
              <div className="qa-eyebrow">ONDE ESTÁ O SEU PROCESSO</div>
              <span
                className="qa-eyebrow rounded-sm px-2 py-1"
                style={{ background: cor.fundo, color: cor.texto }}
              >
                {cor.rotulo}
              </span>
            </div>

            <div className="px-5 py-4">
              <div className="qa-eyebrow" style={{ color: "#6A6A6A" }}>
                PASSO {fase.passo} DE {FASES.length}
              </div>
              <h3 className="qa-h3 mt-1">{fase.titulo}</h3>
              <p className="qa-kpi-sub mt-1.5" style={{ color: "#2F3337" }}>
                {fase.descricao}
              </p>
            </div>

            {/* Régua completa: o cliente vê o caminho inteiro, não só onde está.
                Sem ela, "passo 2 de 5" não diz nada — 5 do quê? */}
            <ol className="flex flex-col gap-0 border-t border-[#EEEEEE] sm:flex-row">
              {FASES.map((f) => {
                const passado = f.passo < fase.passo;
                const atual = f.passo === fase.passo;
                return (
                  <li
                    key={f.id}
                    className="flex flex-1 items-center gap-2 border-b border-[#F2F2F2] px-4 py-2.5 sm:border-b-0 sm:border-r sm:last:border-r-0"
                    style={{ background: atual ? "#FAFAFA" : undefined }}
                  >
                    <span className="shrink-0">
                      {passado ? (
                        <Check className="h-3.5 w-3.5 text-emerald-600" />
                      ) : atual ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" style={{ color: cor.fundo }} />
                      ) : (
                        <span className="block h-2 w-2 rounded-full bg-[#D4D4D4]" />
                      )}
                    </span>
                    <span
                      className="qa-caption min-w-0 truncate"
                      style={{
                        color: atual ? "#0A0A0A" : passado ? "#4A4A4A" : "#9A9A9A",
                        fontWeight: atual ? 700 : 400,
                      }}
                      title={f.titulo}
                    >
                      {f.titulo}
                    </span>
                  </li>
                );
              })}
            </ol>

            {onAbrirProcesso ? (
              <div className="border-t border-[#EEEEEE] px-5 py-3">
                <button
                  type="button"
                  onClick={() => onAbrirProcesso(String(p.id))}
                  className="qa-eyebrow rounded-sm px-3 py-2 transition hover:opacity-90"
                  style={{ background: "#0A0A0A", color: "#FFFFFF" }}
                >
                  VER O PROCESSO →
                </button>
              </div>
            ) : null}
          </section>
        );
      })}
    </div>
  );
}
