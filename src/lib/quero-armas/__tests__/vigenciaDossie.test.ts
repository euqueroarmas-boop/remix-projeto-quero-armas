// Espelho de teste da regra de vigência do dossiê.
//
// A lógica roda no Deno (`supabase/functions/_shared/vigenciaDossie.ts`), que o
// Vitest não importa. A cópia abaixo é IDÊNTICA em comportamento e existe para
// travar a regra: nenhum documento vencido entra na juntada, e ausência de
// validade nunca é tratada como vencimento — senão contrato social, CCMEI e
// afins reabririam em massa.
import { describe, expect, it } from "vitest";

interface DocComValidade {
  data_validade?: string | null;
  data_validade_efetiva?: string | null;
}

function validadeVigente(d: DocComValidade): string | null {
  const bruta = d?.data_validade_efetiva ?? d?.data_validade ?? null;
  if (!bruta) return null;
  const s = String(bruta).trim();
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return iso[0];
  const br = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (br) return `${br[3]}-${br[2]}-${br[1]}`;
  return null;
}

function estaVencido(d: DocComValidade, hoje: string): boolean {
  const validade = validadeVigente(d);
  if (!validade) return false;
  return validade < hoje;
}

const HOJE = "2026-08-16";

describe("validadeVigente", () => {
  it("prefere a validade efetiva calculada pelo backend", () => {
    expect(
      validadeVigente({ data_validade: "2026-12-31", data_validade_efetiva: "2026-08-01" }),
    ).toBe("2026-08-01");
  });

  it("cai para a validade nominal quando não há efetiva", () => {
    expect(validadeVigente({ data_validade: "2026-09-30" })).toBe("2026-09-30");
  });

  it("aceita data em formato brasileiro", () => {
    expect(validadeVigente({ data_validade: "30/09/2026" })).toBe("2026-09-30");
  });

  it("devolve null sem data", () => {
    expect(validadeVigente({})).toBeNull();
    expect(validadeVigente({ data_validade: null })).toBeNull();
  });
});

describe("estaVencido", () => {
  it("barra documento com validade no passado", () => {
    expect(estaVencido({ data_validade: "2026-08-15" }, HOJE)).toBe(true);
  });

  it("aceita documento que vence hoje — ainda vale hoje", () => {
    expect(estaVencido({ data_validade: HOJE }, HOJE)).toBe(false);
  });

  it("aceita documento com validade no futuro", () => {
    expect(estaVencido({ data_validade: "2026-08-17" }, HOJE)).toBe(false);
  });

  it("NÃO trata ausência de validade como vencimento", () => {
    // Contrato social, CCMEI e requerimento de empresário não vencem. Se a
    // ausência de data virasse vencimento, o dossiê reabriria esses itens em
    // massa e o cliente ficaria num loop sem saída.
    expect(estaVencido({}, HOJE)).toBe(false);
    expect(estaVencido({ data_validade: null, data_validade_efetiva: null }, HOJE)).toBe(false);
  });

  it("a efetiva manda mesmo quando a nominal ainda está no futuro", () => {
    expect(
      estaVencido({ data_validade: "2027-01-01", data_validade_efetiva: "2026-08-10" }, HOJE),
    ).toBe(true);
  });
});
