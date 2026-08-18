// ============================================================================
// QUARTA AUDITORIA — a fila de conferência estava vazia por construção
// ----------------------------------------------------------------------------
// O achado mais caro da série, e o mais silencioso.
//
// Quando a IA não tem confiança para decidir, ela grava `revisao_humana`. A
// FILA DE CONFERÊNCIA da equipe — a tela onde se revisa exatamente isso —
// filtrava `em_revisao_humana`, grafia que nenhum código do sistema escreve.
// A fila nunca mostrou um único documento.
//
// Passou porque o dicionário de exibição traduz as DUAS grafias para "em
// análise": o documento aparecia certo em toda tela com rótulo, e o erro só
// existia onde alguém comparava a string crua — e string crua não tem rótulo
// para denunciar.
//
// O efeito era um ponto cego perfeito: o cliente não vê o documento como
// pendência (certo, a bola não é dele), a equipe não o vê em fila nenhuma, e o
// checador de conclusão o conta como não cumprido — então o processo nunca vira
// `pronto_para_protocolar`. Ninguém tem o que fazer e nada anda.
// ============================================================================

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { resolve, join } from "node:path";
import {
  ehRevisaoHumana,
  ehTravadoNaIA,
  STATUS_REVISAO_HUMANA,
  STATUS_EM_VALIDACAO_IA,
  MINUTOS_LIMITE_VALIDACAO_IA,
} from "../statusRevisaoHumana";

const r = (p: string) => readFileSync(resolve(process.cwd(), p), "utf-8");

describe("a grafia que o banco usa é a que a IA escreve", () => {
  it("as edges gravam revisao_humana, sem prefixo", () => {
    const ia = r("supabase/functions/qa-processo-doc-validar-ia/index.ts");
    expect(ia).toMatch(/status: "revisao_humana"/);
    // Se algum dia passarem a gravar a outra grafia, este teste avisa antes de
    // a fila esvaziar de novo.
    expect(ia).not.toMatch(/status: "em_revisao_humana"/);
  });

  it("o helper aceita as duas grafias", () => {
    for (const s of ["revisao_humana", "em_revisao_humana", "REVISAO_HUMANA", " revisao_humana "]) {
      expect(ehRevisaoHumana(s), s).toBe(true);
    }
    for (const s of ["aprovado", "pendente", "em_analise", "", null, undefined]) {
      expect(ehRevisaoHumana(s as string | null | undefined)).toBe(false);
    }
  });

  it("a lista para o .in() traz a grafia real em primeiro lugar", () => {
    expect(STATUS_REVISAO_HUMANA[0]).toBe("revisao_humana");
    expect(STATUS_REVISAO_HUMANA).toContain("em_revisao_humana");
  });
});

describe("a fila de conferência enxerga o que a IA manda para ela", () => {
  const fila = r("src/components/quero-armas/admin/QAFilaRevisaoHumana.tsx");

  it("não filtra mais pela grafia fantasma", () => {
    expect(fila).not.toMatch(/\.eq\("status", "em_revisao_humana"\)/);
  });

  it("usa a lista canônica", () => {
    expect(fila).toMatch(/STATUS_REVISAO_HUMANA/);
    expect(fila).toMatch(/\.in\(\s*\n?\s*"status",/);
  });

  it("traz também o documento travado na validação da IA", () => {
    // Mesmo ponto cego: cliente o vê resolvido, equipe não o vê, processo não
    // anda. A diferença é que ali ninguém decidiu nada.
    expect(fila).toMatch(/STATUS_EM_VALIDACAO_IA/);
    expect(fila).toMatch(/ehTravadoNaIA/);
  });

  it("marca o travado de forma distinta de 'a IA pediu ajuda'", () => {
    // Aprovar ou rejeitar às cegas um documento que a IA nunca leu é pior do
    // que deixá-lo na fila.
    expect(fila).toMatch(/VALIDAÇÃO TRAVADA/);
  });
});

describe("validação travada é decidida por tempo — a função morta não deixa recado", () => {
  const agora = new Date("2026-08-18T18:00:00.000Z");
  const minutosAtras = (n: number) =>
    new Date(agora.getTime() - n * 60_000).toISOString();

  it("processando há mais que o limite conta como travado", () => {
    expect(ehTravadoNaIA(
      { status: "em_analise", validacao_ia_status: "processando", updated_at: minutosAtras(MINUTOS_LIMITE_VALIDACAO_IA + 1) },
      agora,
    )).toBe(true);
  });

  it("processando há pouco tempo é validação normal", () => {
    expect(ehTravadoNaIA(
      { status: "em_analise", validacao_ia_status: "processando", updated_at: minutosAtras(2) },
      agora,
    )).toBe(false);
  });

  it("IA que já terminou não está travada, mesmo em em_analise", () => {
    for (const ia of ["concluido", "erro", "revisao_humana", null]) {
      expect(ehTravadoNaIA(
        { status: "em_analise", validacao_ia_status: ia, updated_at: minutosAtras(600) },
        agora,
      ), String(ia)).toBe(false);
    }
  });

  it("documento pendente ou aprovado nunca é 'travado'", () => {
    for (const st of ["pendente", "aprovado", "divergente", "invalido"]) {
      expect(ehTravadoNaIA(
        { status: st, validacao_ia_status: "processando", updated_at: minutosAtras(600) },
        agora,
      ), st).toBe(false);
    }
  });

  it("sem data não inventa travamento", () => {
    expect(ehTravadoNaIA(
      { status: "em_analise", validacao_ia_status: "processando", updated_at: null },
      agora,
    )).toBe(false);
  });

  it("os quatro status de validação em curso estão cobertos", () => {
    for (const st of STATUS_EM_VALIDACAO_IA) {
      expect(ehTravadoNaIA(
        { status: st, validacao_ia_status: "processando", updated_at: minutosAtras(60) },
        agora,
      ), st).toBe(true);
    }
  });
});

describe("nenhuma comparação crua com a grafia fantasma sobrou", () => {
  /** Arquivos onde a string pode aparecer legitimamente. */
  const PERMITIDOS = new Set([
    // Dicionários de tradução: existem PARA aceitar as duas grafias.
    "src/lib/quero-armas/statusDocumento.ts",
    "src/lib/quero-armas/statusUnificado.ts",
    "src/lib/quero-armas/checklistMetrics.ts",
    "src/lib/quero-armas/statusRevisaoHumana.ts",
    // Mapa de rótulos legados do processo, documentado como só-exibição.
    "src/components/quero-armas/processos/processoConstants.ts",
    // Portal: listas de status que contam como resolvido, com as duas grafias.
    "src/pages/quero-armas/QAClientePortalPage.tsx",
  ]);

  function varrer(dir: string, out: string[] = []): string[] {
    for (const nome of readdirSync(dir)) {
      const caminho = join(dir, nome);
      if (statSync(caminho).isDirectory()) {
        if (nome === "__tests__" || nome === "node_modules") continue;
        varrer(caminho, out);
      } else if (/\.(ts|tsx)$/.test(nome)) {
        out.push(caminho);
      }
    }
    return out;
  }

  it("nada compara `=== \"em_revisao_humana\"` nem filtra só por ela", () => {
    const raiz = resolve(process.cwd(), "src");
    const suspeitos: string[] = [];
    for (const abs of varrer(raiz)) {
      const rel = abs.slice(resolve(process.cwd()).length + 1);
      if (PERMITIDOS.has(rel)) continue;
      const fonte = readFileSync(abs, "utf-8");
      // Comparação de igualdade ou filtro Supabase pela grafia fantasma.
      if (/===\s*"em_revisao_humana"/.test(fonte) ||
          /"em_revisao_humana"\s*===/.test(fonte) ||
          /\.eq\(\s*"status"\s*,\s*"em_revisao_humana"\s*\)/.test(fonte)) {
        suspeitos.push(rel);
      }
    }
    expect(
      suspeitos,
      `Use ehRevisaoHumana/STATUS_REVISAO_HUMANA em: ${suspeitos.join(", ")}`,
    ).toEqual([]);
  });

  it("o filtro da auditoria oferece o valor que o banco guarda", () => {
    const pag = r("src/pages/quero-armas/QAProcessosAuditoriaPage.tsx");
    expect(pag).toMatch(/<option value="revisao_humana">/);
    expect(pag).not.toMatch(/<option value="em_revisao_humana">/);
  });

  it("os contadores usam o helper", () => {
    expect(r("src/lib/quero-armas/checklistGuiadoEngine.ts")).toMatch(/ehRevisaoHumana\(d\.status\)/);
    expect(r("src/pages/quero-armas/QAProcessosPage.tsx")).toMatch(/ehRevisaoHumana\(p\.status\)/);
    expect(r("src/components/quero-armas/processos/ClienteProcessosSection.tsx"))
      .toMatch(/ehRevisaoHumana\(p\.status\)/);
  });
});
