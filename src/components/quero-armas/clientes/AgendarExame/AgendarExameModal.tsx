import { useMemo, useState } from "react";
import { useCredenciadosPF } from "./useCredenciadosPF";
import { AgendarExameList } from "./AgendarExameList";
import { INSTRUTOR_PDF_PF } from "./instrutorPdfLinks";

type Props = {
  open: boolean;
  onClose: () => void;
  tipo: "psicologo" | "instrutor_tiro";
  cep?: string | null;
  uf?: string | null;
  onVerListaCompleta?: () => void;
};

const TITULO = {
  psicologo: "PSICÓLOGOS CREDENCIADOS PELA PF",
  instrutor_tiro: "INSTRUTORES DE TIRO CREDENCIADOS PELA PF",
};

export function AgendarExameModal({ open, onClose, tipo, cep, uf, onVerListaCompleta }: Props) {
  const [raio, setRaio] = useState(50);
  const cepLimpo = (cep || "").replace(/\D/g, "");
  const params = useMemo(() => open ? ({ tipo, cep: cepLimpo || undefined, uf: !cepLimpo && uf ? uf : undefined, raio_km: raio, limit: 10 }) : null, [open, tipo, cepLimpo, uf, raio]);
  const { loading, results, origin, error } = useCredenciadosPF(params);
  const ufResolved = (origin?.uf || uf || "").toUpperCase();
  const isInstrutor = tipo === "instrutor_tiro";
  const pdfHref = isInstrutor && ufResolved ? INSTRUTOR_PDF_PF[ufResolved] : null;

  if (!open) return null;
  return (
    <div role="dialog" aria-modal="true" style={{
      position: "fixed", inset: 0, background: "rgba(10,10,10,.62)", zIndex: 1000,
      display: "flex", alignItems: "center", justifyContent: "center", padding: 18,
    }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{
        background: "#f6f5f1", border: "1px solid #d6d6d4", borderRadius: 6, maxWidth: 560, width: "100%",
        maxHeight: "85vh", display: "flex", flexDirection: "column", boxShadow: "0 18px 48px rgba(0,0,0,.32)",
      }}>
        <header style={{ padding: "16px 20px", borderBottom: "1px solid #e3e3e1", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
          <div>
            <div style={{ fontFamily: "Oswald, sans-serif", fontSize: 14, fontWeight: 700, color: "#7A1F2B", letterSpacing: ".22em" }}>AGENDAR EXAME</div>
            <h2 style={{ margin: "4px 0 0", fontFamily: "Oswald, sans-serif", fontSize: 16, color: "#0A0A0A", letterSpacing: ".06em" }}>{TITULO[tipo]}</h2>
            <div style={{ fontSize: 11, color: "#6A6A6A", marginTop: 6 }}>
              Fonte: <a href={tipo === "psicologo" ? "https://www.gov.br/pf/pt-br/assuntos/armas/psicologos/psicologos-crediciados" : "https://www.gov.br/pf/pt-br/assuntos/armas/instrutores-de-armamento-e-tiro/credenciados"} target="_blank" rel="noreferrer" style={{ color: "#7A1F2B" }}>gov.br/PF</a>
              {origin?.cidade ? ` · próximos de ${origin.cidade}/${origin.uf}` : ""}
            </div>
          </div>
          <button onClick={onClose} aria-label="Fechar" style={{ border: 0, background: "transparent", fontSize: 22, cursor: "pointer", color: "#6A6A6A" }}>×</button>
        </header>
        <div style={{ padding: "12px 20px", display: "flex", gap: 8, borderBottom: "1px solid #e3e3e1", flexWrap: "wrap" }}>
          <span style={{ fontSize: 11, color: "#6A6A6A", alignSelf: "center", letterSpacing: ".12em" }}>RAIO:</span>
          {[10, 25, 50, 100].map((r) => (
            <button key={r} type="button" onClick={() => setRaio(r)} style={{
              border: "1px solid " + (raio === r ? "#7A1F2B" : "#d6d6d4"),
              background: raio === r ? "#7A1F2B" : "#fff",
              color: raio === r ? "#fff" : "#303030",
              fontFamily: "Oswald, sans-serif", fontSize: 11, letterSpacing: ".08em",
              padding: "5px 10px", borderRadius: 999, cursor: "pointer",
            }}>{r} km</button>
          ))}
        </div>
        <div style={{ overflowY: "auto", padding: 18, flex: 1 }}>
          {error && <div style={{ color: "#df2727", fontSize: 12, marginBottom: 10 }}>{error}</div>}
          {!cepLimpo && !uf && (
            <div style={{ background: "#fff8e1", border: "1px solid #f0d893", padding: 10, borderRadius: 4, fontSize: 12, color: "#5a4500", marginBottom: 10 }}>
              Cadastre seu CEP para vermos os profissionais mais próximos de você.
            </div>
          )}
          <AgendarExameList loading={loading} results={results} empty="Nenhum profissional encontrado neste raio. Tente aumentar o raio ou ver a lista do estado." />
          {isInstrutor && (
            <div style={{ marginTop: 14, background: "#fff", border: "1px solid #e3e3e1", padding: 14, borderRadius: 4, fontSize: 12, color: "#303030" }}>
              <strong style={{ display: "block", fontFamily: "Oswald, sans-serif", letterSpacing: ".14em", marginBottom: 6 }}>LISTA OFICIAL PF (PDF)</strong>
              A Polícia Federal publica os instrutores de tiro credenciados como PDFs por UF.
              {pdfHref ? (
                <div style={{ marginTop: 6 }}>
                  <a href={pdfHref} target="_blank" rel="noreferrer noopener" style={{ color: "#7A1F2B", fontWeight: 700 }}>
                    Baixar lista atualizada — {ufResolved}
                  </a>
                </div>
              ) : (
                <div style={{ marginTop: 6 }}>Informe o CEP ou UF para abrir o PDF do seu estado.</div>
              )}
            </div>
          )}
        </div>
        <footer style={{ padding: "12px 20px", borderTop: "1px solid #e3e3e1", display: "flex", justifyContent: "space-between", gap: 10 }}>
          {onVerListaCompleta && (
            <button onClick={onVerListaCompleta} style={{
              border: "1px solid #d6d6d4", background: "transparent", padding: "8px 14px",
              fontFamily: "Oswald, sans-serif", fontSize: 11, letterSpacing: ".16em", cursor: "pointer", color: "#0A0A0A",
            }}>VER LISTA COMPLETA</button>
          )}
          <button onClick={onClose} style={{
            border: 0, background: "#7A1F2B", color: "#fff", padding: "8px 16px",
            fontFamily: "Oswald, sans-serif", fontSize: 11, letterSpacing: ".16em", cursor: "pointer", marginLeft: "auto",
          }}>FECHAR</button>
        </footer>
      </div>
    </div>
  );
}