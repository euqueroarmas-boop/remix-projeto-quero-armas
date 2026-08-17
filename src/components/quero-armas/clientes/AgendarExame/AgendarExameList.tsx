import type { CredenciadoPsico } from "./useCredenciadosPsico";

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

function mapsLink(c: CredenciadoPsico) {
  const q = encodeURIComponent([c.endereco, c.cidade, c.uf, "Brasil"].filter(Boolean).join(", "));
  return `https://www.google.com/maps/search/?api=1&query=${q}`;
}

export function AgendarExameList({ results, loading, empty }: { results: CredenciadoPsico[]; loading: boolean; empty: string }) {
  if (loading) return <div className="qa-caption py-7 text-center">Buscando profissionais credenciados na Polícia Federal…</div>;
  if (results.length === 0) return <div className="qa-caption py-7 text-center">{empty}</div>;
  return (
    <div className="grid gap-2.5">
      {results.map((c) => {
        const validade = fmtValidade(c.validade_label, c.validade);
        const vencido = c.validade ? new Date(c.validade) < new Date() : false;
        return (
          <article key={c.id} className="grid gap-1.5 rounded-sm border border-[#e3e3e1] bg-white px-4 py-3.5">
            <header className="flex items-baseline justify-between gap-3">
              <div className="min-w-0">
                <div className="qa-h3">{c.nome}</div>
                {c.registro && <div className="qa-caption mt-0.5">{c.registro}</div>}
              </div>
              {c.distancia_km != null && (
                <span className="qa-h3 shrink-0 !text-[#2F3337]">{fmtKm(c.distancia_km)}</span>
              )}
            </header>
            {c.endereco && (
              <div className="qa-body qa-body--soft">
                {c.endereco}{c.bairro ? ` — ${c.bairro}` : ""}{c.cidade ? ` · ${c.cidade}/${c.uf}` : ` · ${c.uf}`}
              </div>
            )}
            <div className="qa-body mt-1 flex flex-wrap items-center gap-x-3 gap-y-1.5">
              {c.telefones.map((t) => (
                <span key={t} className="inline-flex items-center gap-2">
                  <a href={`tel:${t.replace(/\D/g, "")}`} className="border-b border-dotted border-[#2F3337] text-[#0A0A0A] no-underline">📞 {t}</a>
                  {/* WhatsApp: a maioria destes profissionais atende por lá, e
                      ligar do celular para um consultório raramente é atendido.
                      Só aparece em número com DDD (10 ou 11 dígitos) — fixo de
                      8 dígitos sem DDD viraria um link quebrado.
                      O 55 é acrescentado porque o wa.me exige o código do país. */}
                  {(() => {
                    const d = t.replace(/\D/g, "");
                    if (d.length < 10 || d.length > 11) return null;
                    const msg = encodeURIComponent(
                      "Olá! Encontrei seu contato pelo Arsenal Inteligente da Quero Armas e gostaria de agendar o exame.",
                    );
                    return (
                      <a
                        href={`https://wa.me/55${d}?text=${msg}`}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="border-b border-dotted border-[#0A7C42] font-semibold text-[#0A7C42] no-underline"
                      >
                        WhatsApp
                      </a>
                    );
                  })()}
                </span>
              ))}
              {c.emails.map((e) => (
                <a key={e} href={`mailto:${e}`} className="break-all border-b border-dotted border-[#2F3337] text-[#0A0A0A] no-underline">✉ {e}</a>
              ))}
              <a href={mapsLink(c)} target="_blank" rel="noreferrer noopener" className="border-b border-dotted border-[#2F3337] text-[#0A0A0A] no-underline">📍 Abrir no mapa</a>
            </div>
            {validade && (
              <div className={`qa-caption mt-1 ${vencido ? "!text-[#C32E26]" : ""}`}>
                {vencido ? "⚠ Credenciamento vencido em " : "Credenciamento válido até "}{validade}
              </div>
            )}
          </article>
        );
      })}
    </div>
  );
}