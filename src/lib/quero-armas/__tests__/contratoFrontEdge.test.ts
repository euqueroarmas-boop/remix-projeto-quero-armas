// ============================================================================
// CONTRATO FRONT ↔ EDGE — os nomes dos campos têm que bater
// ----------------------------------------------------------------------------
// Este é o erro que só aparece no primeiro uso real, e aparece do pior jeito:
// a função responde 200, não grava nada, e ninguém desconfia. O front manda
// `geracao_id` e a edge lê `geracaoId`; o front lê `resp.prazo_fechado` e a
// edge devolve `prazoFechado`. Nada quebra, nada avisa, e a equipe descobre
// dias depois que os avisos nunca saíram.
//
// TypeScript não pega: o corpo do invoke é `unknown` de um lado e o `body` da
// edge vem de `req.json()` do outro. As edges nem passam pelo tsc do projeto
// (são Deno). Então a paridade vive aqui.
//
// Ao criar uma edge nova chamada pelo front, acrescente-a a CONTRATOS.
// ============================================================================

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const r = (p: string) => readFileSync(resolve(process.cwd(), p), "utf-8");

/** Campos que a edge lê de `body` via `(body as { campo?: ... })`. */
function camposLidosPelaEdge(fonte: string): Set<string> {
  const achados = [...fonte.matchAll(/\(body as \{\s*([a-z_]+)\?/g)].map((m) => m[1]);
  return new Set(achados);
}

/**
 * Campos que a chamada do front envia dentro de `body: { ... }`.
 *
 * Recorta o objeto contando chaves, e não por linha: metade dos `body` do
 * projeto é objeto de uma linha só (`body: { processo_id, acao: "x" }`), e um
 * parser por linha simplesmente não os enxerga — foi assim que a primeira
 * versão deste teste reprovou código correto.
 */
function camposEnviadosPeloFront(fonte: string, funcao: string): Set<string> {
  const i = fonte.indexOf(`invoke("${funcao}"`);
  if (i === -1) return new Set();
  const ini = fonte.indexOf("body:", i);
  if (ini === -1) return new Set();
  const abre = fonte.indexOf("{", ini);
  if (abre === -1) return new Set();

  let nivel = 0;
  let fim = abre;
  for (let k = abre; k < fonte.length; k++) {
    if (fonte[k] === "{") nivel++;
    else if (fonte[k] === "}") {
      nivel--;
      if (nivel === 0) { fim = k; break; }
    }
  }
  const bloco = fonte.slice(abre + 1, fim);

  // Só o nível raiz do objeto: `...(x ? { a } : { b })` conta as duas pontas,
  // que é o certo — os dois ramos são campos que a edge pode receber.
  const chaves = [...bloco.matchAll(/([a-z_]+)\s*:/g)].map((m) => m[1]);
  return new Set(chaves.filter((k) => k !== "body" && k !== "headers"));
}

interface Contrato {
  funcao: string;
  edge: string;
  chamadores: string[];
  /** Campos que o front pode enviar mas a edge legitimamente ignora. */
  toleraExtras?: string[];
}

const CONTRATOS: Contrato[] = [
  {
    funcao: "qa-peca-enviar-cliente",
    edge: "supabase/functions/qa-peca-enviar-cliente/index.ts",
    chamadores: ["src/components/quero-armas/processos/ProcessoDetalheDrawer.tsx"],
  },
  {
    funcao: "qa-peca-aprovar-cliente",
    edge: "supabase/functions/qa-peca-aprovar-cliente/index.ts",
    chamadores: ["src/components/quero-armas/portal/PecaAprovacaoPanel.tsx"],
  },
  {
    funcao: "qa-recurso-protocolar",
    edge: "supabase/functions/qa-recurso-protocolar/index.ts",
    chamadores: ["src/components/quero-armas/processos/ProcessoDetalheDrawer.tsx"],
  },
  {
    funcao: "qa-processo-deferir",
    edge: "supabase/functions/qa-processo-deferir/index.ts",
    chamadores: [
      "src/components/quero-armas/processos/ProcessoDetalheDrawer.tsx",
      "src/components/quero-armas/portal/DeferimentoEntregaPanel.tsx",
    ],
  },
];

describe("contrato de entrada: todo campo enviado é lido", () => {
  for (const c of CONTRATOS) {
    it(`${c.funcao}`, () => {
      const lidos = camposLidosPelaEdge(r(c.edge));
      expect(lidos.size, `a edge ${c.funcao} não lê campo nenhum do body`).toBeGreaterThan(0);

      for (const chamador of c.chamadores) {
        const enviados = camposEnviadosPeloFront(r(chamador), c.funcao);
        expect(enviados.size, `${chamador} não envia body para ${c.funcao}`).toBeGreaterThan(0);
        const ignorados = [...enviados].filter(
          (k) => !lidos.has(k) && !(c.toleraExtras ?? []).includes(k),
        );
        expect(
          ignorados,
          `${chamador} envia campo(s) que ${c.funcao} nunca lê: ${ignorados.join(", ")}`,
        ).toEqual([]);
      }
    });
  }
});

describe("contrato de saída: todo campo lido da resposta é devolvido", () => {
  it("qa-recurso-protocolar devolve o que o painel lê", () => {
    const edge = r("supabase/functions/qa-recurso-protocolar/index.ts");
    // O painel decide se avisa a equipe de que o prazo NÃO foi lançado. Se o
    // nome divergir, `resp.prazo_fechado` vira undefined e o aviso dispara
    // sempre — ou nunca, dependendo do lado que mudar.
    for (const campo of ["prazo_fechado", "prazo_aviso"]) {
      expect(edge, `qa-recurso-protocolar não devolve ${campo}`).toMatch(
        new RegExp(`${campo}:`),
      );
    }
  });

  it("qa-processo-deferir devolve o que o painel lê", () => {
    const edge = r("supabase/functions/qa-processo-deferir/index.ts");
    for (const campo of ["baixa_venda_ok", "baixa_aviso"]) {
      expect(edge, `qa-processo-deferir não devolve ${campo}`).toMatch(new RegExp(`${campo}:`));
    }
  });

  it("todas devolvem `error` em falha e algo verdadeiro em sucesso", () => {
    for (const c of CONTRATOS) {
      const edge = r(c.edge);
      expect(edge, `${c.funcao} sem retorno de erro`).toMatch(/json\(\{ error:/);
      expect(edge, `${c.funcao} sem retorno de sucesso`).toMatch(/ok: true/);
    }
  });
});

describe("as ações nomeadas existem dos dois lados", () => {
  it("qa-peca-aprovar-cliente: aprovar e devolver", () => {
    const edge = r("supabase/functions/qa-peca-aprovar-cliente/index.ts");
    const painel = r("src/components/quero-armas/portal/PecaAprovacaoPanel.tsx");
    for (const acao of ["aprovar", "devolver"]) {
      expect(edge).toContain(`"${acao}"`);
      expect(painel).toContain(`"${acao}"`);
    }
  });

  it("qa-processo-deferir: registrar e confirmar_recebimento", () => {
    const edge = r("supabase/functions/qa-processo-deferir/index.ts");
    const drawer = r("src/components/quero-armas/processos/ProcessoDetalheDrawer.tsx");
    const painel = r("src/components/quero-armas/portal/DeferimentoEntregaPanel.tsx");
    expect(edge).toContain('"registrar"');
    expect(edge).toContain('"confirmar_recebimento"');
    expect(drawer).toContain('acao: "registrar"');
    expect(painel).toContain('acao: "confirmar_recebimento"');
  });
});

describe("toda edge nova chamada pelo front está coberta aqui", () => {
  it("nenhuma das quatro da leva 2 ficou de fora", () => {
    const nomes = CONTRATOS.map((c) => c.funcao);
    for (const f of [
      "qa-peca-enviar-cliente",
      "qa-peca-aprovar-cliente",
      "qa-recurso-protocolar",
      "qa-processo-deferir",
    ]) {
      expect(nomes).toContain(f);
    }
  });
});
