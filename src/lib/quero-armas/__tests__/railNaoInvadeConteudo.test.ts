import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * O rail de ícones da direita é `position: fixed` — ele não ocupa lugar no
 * fluxo. Se ninguém reservar a faixa, o texto do cliente corre por baixo dos
 * ícones (foi o que aconteceu: título e parágrafos cortados no celular).
 *
 * Estes testes trancam as duas metades do conserto:
 *   1. a faixa é reservada por BORDA (padding) da raiz, com a largura vindo de
 *      uma variável só, compartilhada com o próprio rail;
 *   2. ninguém volta a tentar reservar com MARGEM ao lado de `w-full` — largura
 *      explícita anula a margem lateral, e a reserva vira letra morta.
 */

const PORTAL = "src/pages/quero-armas/QAClientePortalPage.tsx";
const src = readFileSync(PORTAL, "utf8");

describe("rail direito do portal do cliente não cobre o conteúdo", () => {
  it("a raiz do portal reserva a faixa do rail com padding", () => {
    expect(src).toContain('className="qa-portal-root ');
    expect(src).toContain(".qa-portal-root { padding-right: var(--qa-rail-w, 56px);");
  });

  it("rail e reserva tiram a largura da MESMA variável", () => {
    expect(src).toContain(":root { --qa-rail-w: 56px; }");
    expect(src).toContain(".qa-portal-rail { width: var(--qa-rail-w, 56px); }");
    // O rail não pode voltar a ter largura própria: divergir da reserva é o
    // mesmo defeito de novo, só que com outro número.
    const rail = src.match(/className="qa-portal-rail[^"]*"/)?.[0] ?? "";
    expect(rail).toBeTruthy();
    expect(rail).not.toMatch(/\bw-\[/);
    expect(rail).toContain("fixed right-0");
  });

  it("o <main> não tenta reservar a faixa com margem", () => {
    // `w-full` + `mr-[56px]` era a versão quebrada: a caixa fica
    // over-constrained (CSS 2.1 §10.3.3) e o navegador descarta a margem.
    const main = src.match(/<main className=\{`qa-portal-main[^`]*`\}/)?.[0] ?? "";
    expect(main).toBeTruthy();
    expect(main).toContain("w-full");
    expect(main).not.toMatch(/\bm[lr]-\[/);
  });
});

/** Todos os .tsx de src/, sem entrar em node_modules. */
function arquivosTsx(dir: string, acc: string[] = []): string[] {
  for (const nome of readdirSync(dir)) {
    if (nome === "node_modules") continue;
    const caminho = join(dir, nome);
    if (statSync(caminho).isDirectory()) arquivosTsx(caminho, acc);
    else if (nome.endsWith(".tsx")) acc.push(caminho);
  }
  return acc;
}

const CLASSNAME = /className=(?:"([^"]*)"|\{`([^`]*)`\})/gs;
/** Margem lateral que promete reservar espaço: nem `auto`, nem zero. */
const MARGEM_LATERAL = /^(?:[a-z-]+:)?-?m[lr]-(?!auto\b)(?!0\b)/;

describe("nenhuma tela reserva espaço com margem ao lado de w-full", () => {
  it("largura explícita anula margem lateral — a reserva tem de ser borda do pai", () => {
    const infratores: string[] = [];
    for (const arquivo of arquivosTsx("src")) {
      const conteudo = readFileSync(arquivo, "utf8");
      for (const m of conteudo.matchAll(CLASSNAME)) {
        const classes = (m[1] ?? m[2] ?? "").replace(/\$\{[^}]*\}/g, " ");
        const tokens = classes.split(/\s+/).filter(Boolean);
        if (!tokens.some((t) => t === "w-full" || t.endsWith(":w-full"))) continue;
        const margens = tokens.filter((t) => MARGEM_LATERAL.test(t));
        if (margens.length) {
          const linha = conteudo.slice(0, m.index ?? 0).split("\n").length;
          infratores.push(`${arquivo}:${linha} → ${margens.join(" ")}`);
        }
      }
    }
    expect(infratores, infratores.join("\n")).toEqual([]);
  });
});
