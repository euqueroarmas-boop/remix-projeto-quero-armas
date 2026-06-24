import type { CredenciadoPF } from "./useCredenciadosPF";

function fmtKm(d?: number | null) {
  if (d === null || d === undefined) return null;
  if (d < 1) return `${Math.round(d * 1000)} m`;
  return `${d.toFixed(d < 10 ? 1 : 0)} km`;
}

function fmtValidade(label: string | null, iso: string | null) {
  if (!iso && !label) return null;
  if (iso) {
    const [y, m, d] = iso.split("-");
    return `${d}/${m}/${y}`;
  }
  return label;
}

function mapsLink(c: CredenciadoPF) {
  const q = encodeURIComponent([c.endereco, c.cidade, c.uf, "Brasil"].filter(Boolean).join(", "));
  return `https://www.google.com/maps/search/?api=1&query=${q}`;
}

export function AgendarExameList({ results, loading, empty }: { results: CredenciadoPF[]; loading: boolean; empty: string }) {
  if (loading) return <div style={{ padding: 28, textAlign: "center", color: "#6A6A6A", fontSize: 13 }}>Buscando profissionais credenciados na Polícia Federal…</div>;
  if (results.length === 0) return <div style={{ padding: 28, textAlign: "center", color: "#6A6A6A", fontSize: 13 }}>{empty}</div>;
  return (
    <div style={{ display: "grid", gap: 10 }}>
      {results.map((c) => {
        const validade = fmtValidade(c.validade_label, c.validade);
        const vencido = c.validade ? new Date(c.validade) < new Date() : false;
        return (
          <article key={c.id} style={{
            border: "1px solid #e3e3e1", background: "#fff", borderRadius: 4, padding: "14px 16px",
            display: "grid", gap: 6,
          }}>
            <header style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "baseline" }}>
              <div>
                <div style={{ fontFamily: "Oswald, sans-serif", fontSize: 14, fontWeight: 700, color: "#0A0A0A", letterSpacing: ".04em", textTransform: "uppercase" }}>{c.nome}</div>
                {c.registro && <div style={{ fontSize: 11, color: "#6A6A6A", marginTop: 2 }}>{c.registro}</div>}
              </div>
              {c.distancia_km != null && (
                <span style={{ fontFamily: "Oswald, sans-serif", fontSize: 12, fontWeight: 700, color: "#7A1F2B", letterSpacing: ".06em" }}>{fmtKm(c.distancia_km)}</span>
              )}
            </header>
            {c.endereco && (
              <div style={{ fontSize: 12, color: "#303030" }}>
                {c.endereco}{c.bairro ? ` — ${c.bairro}` : ""}{c.cidade ? ` · ${c.cidade}/${c.uf}` : ` · ${c.uf}`}
              </div>
            )}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 12, fontSize: 12, marginTop: 4 }}>
              {c.telefones.map((t) => (
                <a key={t} href={`tel:${t.replace(/\D/g, "")}`} style={{ color: "#0A0A0A", textDecoration: "none", borderBottom: "1px dotted #7A1F2B" }}>📞 {t}</a>
              ))}
              {c.emails.map((e) => (
                <a key={e} href={`mailto:${e}`} style={{ color: "#0A0A0A", textDecoration: "none", borderBottom: "1px dotted #7A1F2B" }}>✉ {e}</a>
              ))}
              <a href={mapsLink(c)} target="_blank" rel="noreferrer noopener" style={{ color: "#0A0A0A", textDecoration: "none", borderBottom: "1px dotted #7A1F2B" }}>📍 Abrir no mapa</a>
            </div>
            {validade && (
              <div style={{ fontSize: 11, color: vencido ? "#df2727" : "#6A6A6A", marginTop: 4 }}>
                {vencido ? "⚠ Credenciamento vencido em " : "Credenciamento válido até "}{validade}
              </div>
            )}
          </article>
        );
      })}
    </div>
  );
}