// ============================================================================
// localidadesBr — UFs e municípios oficiais do IBGE.
//
// Motivo: naturalidade digitada à mão gera divergência na conferência das
// certidões (caso MIZAEL: cadastro "FAXINAL" x certidão "Faxinal - PR").
// Com estado e cidade em select, o cliente não erra grafia nem UF.
// ============================================================================

export interface UFItem { sigla: string; nome: string }

/** 27 UFs, ordenadas alfabeticamente pelo nome do estado. */
export const UFS_BR: UFItem[] = [
  { sigla: "AC", nome: "Acre" },
  { sigla: "AL", nome: "Alagoas" },
  { sigla: "AP", nome: "Amapá" },
  { sigla: "AM", nome: "Amazonas" },
  { sigla: "BA", nome: "Bahia" },
  { sigla: "CE", nome: "Ceará" },
  { sigla: "DF", nome: "Distrito Federal" },
  { sigla: "ES", nome: "Espírito Santo" },
  { sigla: "GO", nome: "Goiás" },
  { sigla: "MA", nome: "Maranhão" },
  { sigla: "MT", nome: "Mato Grosso" },
  { sigla: "MS", nome: "Mato Grosso do Sul" },
  { sigla: "MG", nome: "Minas Gerais" },
  { sigla: "PA", nome: "Pará" },
  { sigla: "PB", nome: "Paraíba" },
  { sigla: "PR", nome: "Paraná" },
  { sigla: "PE", nome: "Pernambuco" },
  { sigla: "PI", nome: "Piauí" },
  { sigla: "RJ", nome: "Rio de Janeiro" },
  { sigla: "RN", nome: "Rio Grande do Norte" },
  { sigla: "RS", nome: "Rio Grande do Sul" },
  { sigla: "RO", nome: "Rondônia" },
  { sigla: "RR", nome: "Roraima" },
  { sigla: "SC", nome: "Santa Catarina" },
  { sigla: "SP", nome: "São Paulo" },
  { sigla: "SE", nome: "Sergipe" },
  { sigla: "TO", nome: "Tocantins" },
].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));

export const SIGLAS_UF = UFS_BR.map((u) => u.sigla);

const cache = new Map<string, string[]>();
const inflight = new Map<string, Promise<string[]>>();

/**
 * Municípios de uma UF, em ordem alfabética e em CAIXA ALTA (padrão de
 * gravação do cadastro). IBGE é a fonte primária; BrasilAPI é o fallback.
 * Timeout curto com AbortController — mobile não pode travar no select.
 */
export async function fetchMunicipiosUF(uf: string): Promise<string[]> {
  const key = (uf || "").toUpperCase();
  if (!key || !SIGLAS_UF.includes(key)) return [];
  const hit = cache.get(key);
  if (hit) return hit;
  const running = inflight.get(key);
  if (running) return running;

  const run = (async () => {
    const urls = [
      `https://servicodados.ibge.gov.br/api/v1/localidades/estados/${key}/municipios?orderBy=nome`,
      `https://brasilapi.com.br/api/ibge/municipios/v1/${key}?providers=dados-abertos-br,gov,wikipedia`,
    ];
    for (const url of urls) {
      try {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 12000);
        const res = await fetch(url, { signal: ctrl.signal });
        clearTimeout(t);
        if (!res.ok) continue;
        const json = (await res.json()) as Array<Record<string, unknown>>;
        const nomes = json
          .map((m) => String(m.nome ?? "").replace(/\s*-\s*[A-Z]{2}$/i, "").trim().toUpperCase())
          .filter(Boolean);
        const unicos = Array.from(new Set(nomes)).sort((a, b) => a.localeCompare(b, "pt-BR"));
        if (unicos.length) { cache.set(key, unicos); return unicos; }
      } catch { /* tenta o próximo provedor */ }
    }
    return [];
  })();

  inflight.set(key, run);
  try { return await run; } finally { inflight.delete(key); }
}
