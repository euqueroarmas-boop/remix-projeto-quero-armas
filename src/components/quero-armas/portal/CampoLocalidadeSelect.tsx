// ============================================================================
// Selects dependentes de naturalidade: primeiro a UF, depois a cidade.
// Digitar a cidade à mão gerava divergência na conferência das certidões
// (cadastro "FAXINAL" x certidão "Faxinal - PR"). Aqui a grafia vem do IBGE.
// ============================================================================
import { useEffect, useState } from "react";
import { UFS_BR, fetchMunicipiosUF } from "@/lib/quero-armas/localidadesBr";

export function UfSelect({ value, onChange, className }: {
  value: string; onChange: (v: string) => void; className?: string;
}) {
  return (
    <select className={className} value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">Selecione o estado…</option>
      {UFS_BR.map((uf) => (
        <option key={uf.sigla} value={uf.sigla}>{uf.sigla} — {uf.nome}</option>
      ))}
    </select>
  );
}

export function MunicipioSelect({ uf, value, onChange, className }: {
  uf: string; value: string; onChange: (v: string) => void; className?: string;
}) {
  const [municipios, setMunicipios] = useState<string[]>([]);
  const [carregando, setCarregando] = useState(false);

  useEffect(() => {
    let vivo = true;
    if (!uf) { setMunicipios([]); return; }
    setCarregando(true);
    fetchMunicipiosUF(uf)
      .then((l) => { if (vivo) setMunicipios(l); })
      .finally(() => { if (vivo) setCarregando(false); });
    return () => { vivo = false; };
  }, [uf]);

  const vazioLabel = !uf
    ? "Selecione antes o estado…"
    : carregando
      ? "Carregando cidades…"
      : municipios.length === 0
        ? "Não foi possível carregar as cidades"
        : "Selecione a cidade…";

  // Valor legado fora da lista continua visível — não apagamos cadastro antigo.
  const extra = value && !municipios.includes(value.toUpperCase()) ? [value.toUpperCase()] : [];

  return (
    <select
      className={className}
      value={value ? value.toUpperCase() : ""}
      disabled={!uf || carregando}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="">{vazioLabel}</option>
      {extra.map((m) => <option key={m} value={m}>{m}</option>)}
      {municipios.map((m) => <option key={m} value={m}>{m}</option>)}
    </select>
  );
}
