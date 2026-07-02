import { FileCheck2, Crosshair, FolderOpen } from "lucide-react";
import {
  type CaixaDocumento,
  type DocClassificavel,
  CAIXA_META,
  contarPorCaixaComStatus,
} from "@/lib/quero-armas/documentosCaixaClassifier";

/* =============================================================================
 * Bloco 11 — Painel resumo das 3 caixas de documentos.
 *
 * ADITIVO. Apenas exibe contagens; não altera nenhum estado do checklist nem
 * do drawer. Renderize ACIMA da lista de documentos existente, sem substituir
 * nada que já funcione.
 *
 * Aceita modo "light" (papel #f6f5f1 + vermelho bordô #7A1F2B) para o portal
 * e admin (Premium Light obrigatório no Quero Armas).
 * ============================================================================= */

const MARROM = "#7A1F2B";

interface Props {
  docs: ReadonlyArray<DocClassificavel> | null | undefined;
  /** Respostas de perguntas do assistente — usadas para ocultar itens condicionais. */
  respostas?: Record<string, any>;
  /** Esconde caixas com 0 documentos. Default: false (mostra todas). */
  ocultarVazias?: boolean;
  /** Chamado quando o usuário clica em uma caixa (opcional, para futuro scroll/filter). */
  onCaixaClick?: (caixa: CaixaDocumento) => void;
  className?: string;
}

const ICONS: Record<CaixaDocumento, React.ComponentType<{ className?: string; style?: React.CSSProperties }>> = {
  permanente: FileCheck2,
  arma: Crosshair,
  processo: FolderOpen,
};

const ORDEM: CaixaDocumento[] = ["permanente", "arma", "processo"];

export default function DocsTresCaixasPanel({ docs, respostas, ocultarVazias = false, onCaixaClick, className }: Props) {
  const contagens = contarPorCaixaComStatus(docs, respostas ?? {});
  if (contagens.total === 0) return null;

  const visiveis = ORDEM.filter((c) => !ocultarVazias || contagens[c] > 0);
  if (visiveis.length === 0) return null;

  return (
    <section
      className={className}
      aria-label="Resumo dos documentos em três caixas"
      style={{
        background: "#f6f5f1",
        border: "1px solid #e7e3da",
        borderRadius: 12,
        padding: 12,
      }}
    >
      <header style={{ marginBottom: 10 }}>
        <h3
          style={{
            margin: 0,
            fontSize: 11,
            fontWeight: 800,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: MARROM,
          }}
        >
          {contagens.total} {contagens.total === 1 ? "item cadastrado" : "itens cadastrados"} no checklist
        </h3>
        <p style={{ margin: "4px 0 0", fontSize: 12, color: "#475569", lineHeight: 1.4 }}>
          Organizado em três caixas. Documentos permanentes vivem no Hub de
          Documentos e valem para qualquer processo futuro.
        </p>
      </header>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${visiveis.length}, minmax(0, 1fr))`,
          gap: 8,
        }}
      >
        {visiveis.map((caixa) => {
          const meta = CAIXA_META[caixa];
          const Icon = ICONS[caixa];
          const b = contagens.porCaixa[caixa];
          const qtd = b.total;
          const isInteractive = !!onCaixaClick;
          const Tag = isInteractive ? "button" : "div";
          return (
            <Tag
              key={caixa}
              type={isInteractive ? "button" : undefined}
              onClick={isInteractive ? () => onCaixaClick?.(caixa) : undefined}
              style={{
                textAlign: "left",
                background: "#ffffff",
                border: "1px solid #e7e3da",
                borderRadius: 10,
                padding: 10,
                cursor: isInteractive ? "pointer" : "default",
                display: "flex",
                flexDirection: "column",
                gap: 6,
                minHeight: 96,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: 24,
                    height: 24,
                    borderRadius: 6,
                    background: `${MARROM}14`,
                  }}
                >
                  <Icon className="h-3.5 w-3.5" style={{ color: MARROM }} />
                </span>
                <span
                  style={{
                    fontSize: 18,
                    fontWeight: 800,
                    color: "#0f172a",
                    lineHeight: 1,
                  }}
                >
                  {qtd}
                </span>
              </div>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                  color: "#0f172a",
                }}
              >
                {meta.label}
              </div>
              <div style={{ fontSize: 10.5, color: "#64748b", lineHeight: 1.35 }}>
                {meta.descricaoCurta}
              </div>
              {/* Breakdown — mesma base do progresso do assistente */}
              {qtd > 0 && (
                <ul style={{
                  margin: "4px 0 0", padding: 0, listStyle: "none",
                  display: "flex", flexDirection: "column", gap: 2,
                  fontSize: 10.5, lineHeight: 1.35,
                }}>
                  {b.resolvidos > 0 && (
                    <li style={{ color: "#166534" }}>
                      ✓ {b.resolvidos} resolvido{b.resolvidos === 1 ? "" : "s"}
                      {b.reutilizados_hub > 0
                        ? ` (${b.reutilizados_hub} reutilizado${b.reutilizados_hub === 1 ? "" : "s"} do Hub de Documentos)`
                        : ""}
                    </li>
                  )}
                  {b.em_analise > 0 && (
                    <li style={{ color: "#92400e" }}>… {b.em_analise} em análise</li>
                  )}
                  {b.pendentes > 0 && (
                    <li style={{ color: MARROM, fontWeight: 700 }}>
                      ! {b.pendentes} pendente{b.pendentes === 1 ? "" : "s"} para você
                    </li>
                  )}
                  {b.ocultos > 0 && (
                    <li style={{ color: "#64748b" }}>
                      · {b.ocultos} não aplicável no momento
                    </li>
                  )}
                </ul>
              )}
            </Tag>
          );
        })}
      </div>
    </section>
  );
}
