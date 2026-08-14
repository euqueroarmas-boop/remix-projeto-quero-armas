import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  HUB_TIPOS_DOCUMENTO,
  TIPOS_RETIRADOS,
  normalizeTipoDocumentoParaBanco,
} from "../documentosHubCatalogo";

/**
 * O SELETOR DO HUB NÃO PODE OFERECER TIPO QUE O BANCO RECUSA.
 *
 * ─── O que aconteceu em 14/08/2026 ───────────────────────────────────────
 * A migration 20260807270000 renomeou `renda_nf_recente` → `renda_nf_empresa`
 * e tirou o nome antigo do CHECK `qa_doc_cliente_tipo_check`. O catálogo do
 * front continuou oferecendo "Nota fiscal recente". O cliente anexava a NF, a
 * leitura automática preenchia tudo certo, e o INSERT morria com o erro cru
 * `violates check constraint "qa_doc_cliente_tipo_check"` na tela.
 *
 * Não era um caso isolado: sete tipos do catálogo estavam fora do CHECK. Cada
 * cliente batia num tipo diferente, e por isso "todo cliente tinha uma
 * dificuldade" — sem padrão aparente. O padrão era este: catálogo do front e
 * constraint do banco derivando um do outro sem nada ligando os dois.
 *
 * ─── A regra ─────────────────────────────────────────────────────────────
 * Mexeu no CHECK numa migration? O catálogo tem que acompanhar na mesma PR.
 * Este teste é o que impede a divergência de chegar em produção de novo.
 */

const MIGRATIONS_DIR = path.resolve(__dirname, "../../../../supabase/migrations");
const CONSTRAINT = "qa_doc_cliente_tipo_check";

/**
 * Lê a ÚLTIMA migration que redefine o CHECK com lista literal e devolve os
 * tipos aceitos. Migrations posteriores que mexem na constraint por
 * `EXECUTE replace(...)` não são interpretáveis estaticamente — o teste
 * acusa e pede uma redefinição literal, que é o formato auditável.
 */
function lerTiposAceitosPeloBanco(): { tipos: Set<string>; arquivo: string } {
  const arquivos = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  let ancora = "";
  let tipos = new Set<string>();

  for (const arquivo of arquivos) {
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, arquivo), "utf8");
    if (!sql.includes(CONSTRAINT)) continue;

    // Só a forma literal `ADD CONSTRAINT ... CHECK (... = ANY (ARRAY[...]))`.
    const m = sql.match(
      new RegExp(`ADD\\s+CONSTRAINT\\s+${CONSTRAINT}\\s+CHECK\\s*\\([^[]*ARRAY\\s*\\[([\\s\\S]*?)\\]`, "i"),
    );
    if (!m) continue;

    // Remove comentários `--` antes de extrair, senão tipo comentado entra.
    const corpo = m[1].replace(/--[^\n]*/g, "");
    const encontrados = corpo.match(/'([a-z0-9_]+)'/g);
    if (!encontrados || encontrados.length === 0) continue;

    tipos = new Set(encontrados.map((s) => s.replace(/'/g, "")));
    ancora = arquivo;
  }

  return { tipos, arquivo: ancora };
}

describe("catálogo do Hub x CHECK qa_doc_cliente_tipo_check", () => {
  const { tipos: aceitosPeloBanco, arquivo } = lerTiposAceitosPeloBanco();

  it("encontra a migration que define o CHECK", () => {
    expect(arquivo, "nenhuma migration define o CHECK com lista literal").toBeTruthy();
    expect(aceitosPeloBanco.size).toBeGreaterThan(50);
  });

  it("não há migration posterior mexendo no CHECK por replace() não interpretável", () => {
    const posteriores = fs
      .readdirSync(MIGRATIONS_DIR)
      .filter((f) => f.endsWith(".sql") && f > arquivo)
      .filter((f) => fs.readFileSync(path.join(MIGRATIONS_DIR, f), "utf8").includes(CONSTRAINT));

    expect(
      posteriores,
      `Estas migrations mexem no ${CONSTRAINT} depois de ${arquivo}, mas sem lista ` +
        `literal — o teste não consegue saber o estado real do banco. Redefina a ` +
        `constraint por extenso na última delas.`,
    ).toEqual([]);
  });

  it("todo tipo oferecido no catálogo é aceito pelo banco", () => {
    const rejeitados = HUB_TIPOS_DOCUMENTO.map((t) => t.value).filter(
      (v) => !aceitosPeloBanco.has(v),
    );

    expect(
      rejeitados,
      `Tipos no catálogo do Hub que o CHECK recusa — o cliente recebe erro cru ` +
        `de constraint ao salvar. Ou some no CHECK (migration), ou vira slug vivo ` +
        `no catálogo + entrada em TIPOS_RETIRADOS.`,
    ).toEqual([]);
  });

  it("todo slug retirado aponta para um tipo que o banco aceita", () => {
    for (const [retirado, sucessor] of Object.entries(TIPOS_RETIRADOS)) {
      expect(
        aceitosPeloBanco.has(retirado),
        `${retirado} está em TIPOS_RETIRADOS mas o banco ainda o aceita — ` +
          `ou ele não foi retirado, ou a entrada está sobrando.`,
      ).toBe(false);

      if (sucessor !== null) {
        expect(
          aceitosPeloBanco.has(sucessor),
          `${retirado} → ${sucessor}, mas ${sucessor} não consta do CHECK.`,
        ).toBe(true);
      }
    }
  });

  it("normalizeTipoDocumentoParaBanco só devolve tipo aceito pelo banco", () => {
    const entradas = [
      ...Object.keys(TIPOS_RETIRADOS),
      ...HUB_TIPOS_DOCUMENTO.map((t) => t.value),
      "",
      null,
      undefined,
      "tipo_que_nunca_existiu",
    ];

    for (const entrada of entradas) {
      const saida = normalizeTipoDocumentoParaBanco(entrada as string);
      // Slug desconhecido não é responsabilidade do normalizador — ele só
      // garante que nada que ELE conhece saia num tipo morto.
      if (entrada && String(entrada) === "tipo_que_nunca_existiu") continue;
      expect(aceitosPeloBanco.has(saida), `${String(entrada)} → ${saida} (fora do CHECK)`).toBe(
        true,
      );
    }
  });

  it("os slugs que quebraram em 14/08/2026 não voltam ao catálogo", () => {
    const valores = new Set(HUB_TIPOS_DOCUMENTO.map((t) => t.value));
    for (const morto of [
      "renda_nf_recente",
      "comprovante_clube_tiro",
      "comprovante_habitualidade",
      "declaracao_compromisso_habitualidade",
    ]) {
      expect(valores.has(morto), `${morto} voltou ao catálogo do Hub`).toBe(false);
    }
  });
});
