import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  cardapioParaPrompt,
  normalizarTipoExigenciaPF,
  rotuloTipoExigenciaPF,
  TIPO_EXIGENCIA_FALLBACK,
  TIPOS_EXIGENCIA_PF,
} from "../exigenciasPFTipos";

/**
 * A IA ESCOLHE DE UM CARDÁPIO — E O CARDÁPIO TEM QUE CABER NO BANCO.
 *
 * Quando a PF notifica, a IA lê o texto do delegado e cria as exigências que o
 * cliente precisa cumprir. Se ela propuser um tipo que o CHECK do Hub recusa, o
 * passo aparece na tela e o upload morre com erro cru de constraint — o mesmo
 * acidente de 14/08/2026, agora num momento com prazo de 10 dias correndo.
 *
 * Este teste é o que impede isso de chegar em produção.
 */

const MIGRATIONS_DIR = path.resolve(__dirname, "../../../../supabase/migrations");
const CONSTRAINT = "qa_doc_cliente_tipo_check";

function tiposAceitosPeloBanco(): Set<string> {
  const arquivos = fs.readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith(".sql")).sort();
  let tipos = new Set<string>();
  for (const arquivo of arquivos) {
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, arquivo), "utf8");
    if (!sql.includes(CONSTRAINT)) continue;
    const m = sql.match(
      new RegExp(`ADD\\s+CONSTRAINT\\s+${CONSTRAINT}\\s+CHECK\\s*\\([^[]*ARRAY\\s*\\[([\\s\\S]*?)\\]`, "i"),
    );
    if (!m) continue;
    const encontrados = m[1].replace(/--[^\n]*/g, "").match(/'([a-z0-9_]+)'/g);
    if (!encontrados?.length) continue;
    tipos = new Set(encontrados.map((s) => s.replace(/'/g, "")));
  }
  return tipos;
}

describe("cardápio de exigências da PF x CHECK do Hub", () => {
  const aceitos = tiposAceitosPeloBanco();

  it("o CHECK foi lido", () => {
    expect(aceitos.size).toBeGreaterThan(50);
  });

  it("todo tipo do cardápio é aceito pelo banco", () => {
    const recusados = TIPOS_EXIGENCIA_PF.map((t) => t.tipo).filter((t) => !aceitos.has(t));
    expect(
      recusados,
      "a IA poderia pedir um tipo que o upload do cliente recusa — some no CHECK ou tire do cardápio",
    ).toEqual([]);
  });

  it("o escape existe e está no cardápio", () => {
    expect(aceitos.has(TIPO_EXIGENCIA_FALLBACK)).toBe(true);
    expect(TIPOS_EXIGENCIA_PF.some((t) => t.tipo === TIPO_EXIGENCIA_FALLBACK)).toBe(true);
  });

  it("não há tipo repetido", () => {
    const tipos = TIPOS_EXIGENCIA_PF.map((t) => t.tipo);
    expect(new Set(tipos).size).toBe(tipos.length);
  });
});

describe("normalização do que o modelo devolve", () => {
  it("tipo válido passa", () => {
    expect(normalizarTipoExigenciaPF("boletim_ocorrencia")).toBe("boletim_ocorrencia");
  });

  it("tipo inventado cai no escape em vez de quebrar o upload", () => {
    expect(normalizarTipoExigenciaPF("ata_de_assembleia")).toBe(TIPO_EXIGENCIA_FALLBACK);
    expect(normalizarTipoExigenciaPF(null)).toBe(TIPO_EXIGENCIA_FALLBACK);
    expect(normalizarTipoExigenciaPF("")).toBe(TIPO_EXIGENCIA_FALLBACK);
  });

  it("aceita maiúsculas e espaços — modelo não é consistente", () => {
    expect(normalizarTipoExigenciaPF("  BOLETIM_OCORRENCIA ")).toBe("boletim_ocorrencia");
  });

  it("o rótulo nunca vem vazio", () => {
    expect(rotuloTipoExigenciaPF("laudo_psicologico")).toBe("Laudo de aptidão psicológica");
    expect(rotuloTipoExigenciaPF("inexistente")).toBeTruthy();
  });
});

describe("cardápio que vai no prompt", () => {
  it("lista todos os tipos, um por linha", () => {
    const linhas = cardapioParaPrompt().split("\n");
    expect(linhas).toHaveLength(TIPOS_EXIGENCIA_PF.length);
    expect(linhas[0]).toContain("boletim_ocorrencia");
  });

  it("o escape é o ÚLTIMO — o modelo lê como última opção", () => {
    expect(TIPOS_EXIGENCIA_PF[TIPOS_EXIGENCIA_PF.length - 1].tipo).toBe(TIPO_EXIGENCIA_FALLBACK);
  });
});

describe("espelho Deno x Vite", () => {
  it("as duas cópias são idênticas, salvo o comentário de MIRROR", () => {
    const a = fs.readFileSync(path.resolve(__dirname, "../exigenciasPFTipos.ts"), "utf8");
    const b = fs.readFileSync(
      path.resolve(__dirname, "../../../../supabase/functions/_shared/exigenciasPFTipos.ts"),
      "utf8",
    );
    const semMirror = (s: string) => s.replace(/^\/\/ MIRROR:[\s\S]*?idênticas\.$/m, "");
    expect(semMirror(b)).toBe(semMirror(a));
  });
});
