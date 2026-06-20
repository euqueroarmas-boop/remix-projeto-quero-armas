import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  QA_BASE_LEGAL_SINARM_CAC,
  QA_BASE_LEGAL_SINARM_DEFESA_PESSOAL,
} from "../legalBasis";

const ROOT = process.cwd();
const r = (p: string) => readFileSync(join(ROOT, p), "utf8");

describe("Base juridica Quero Armas", () => {
  it("mantem a base minima de defesa pessoal e CAC", () => {
    expect(QA_BASE_LEGAL_SINARM_DEFESA_PESSOAL).toEqual(
      expect.arrayContaining([
        "Lei nº 10.826/2003 (Estatuto do Desarmamento)",
        "Decreto nº 11.615/2023",
        "Decreto nº 12.345/2024",
        "Instrução Normativa nº 201/2021-DG/PF",
        "Ofício Circular nº 08/DELEARM",
      ]),
    );

    expect(QA_BASE_LEGAL_SINARM_CAC).toEqual(
      expect.arrayContaining([
        "Instrução Normativa DG/PF nº 311/2025",
        "Instrução Normativa DG/PF nº 322/2025",
        "Portaria DG/PF nº 19.040/2025",
        "Portarias COLOG nº 166, 167 e 260",
        "Ofício Circular nº 08/DELEARM",
      ]),
    );
  });

  it("migration complementar atualiza o contrato com IN 322 e Portaria 19040", () => {
    const src = r("supabase/migrations/20260620120000_qa_contract_template_base_juridica_complementar.sql");
    expect(src).toMatch(/Instrução Normativa DG\/PF nº 322\/2025/);
    expect(src).toMatch(/Portaria DG\/PF nº 19\.040\/2025/);
    expect(src).toMatch(/Portarias COLOG nº 166, 167 e 260/);
    expect(src).toMatch(/Ofício Circular nº 08\/DELEARM/);
  });
});
