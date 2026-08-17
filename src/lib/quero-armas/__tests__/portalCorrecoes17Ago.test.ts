import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it } from "vitest";
import {
  faixaVencimento,
  isVencimentoCicloCurto,
  setCatalogoValidade,
} from "../validadeDocumento";

const r = (p: string) => readFileSync(p, "utf8");

const KANBAN = "src/components/quero-armas/clientes/ClienteResumoKanban.tsx";
const PORTAL = "src/pages/quero-armas/QAClientePortalPage.tsx";
const NOTIF = "src/components/quero-armas/portal/NotificacaoEngineOverlay.tsx";
const BANNER = "src/components/quero-armas/clientes/EmuEspelhoBanner.tsx";

describe("regra de 30 dias vale para QUALQUER tipo do catálogo", () => {
  afterEach(() => setCatalogoValidade([]));

  it("certidão cadastrada com 30 dias entra no ciclo curto", () => {
    // REGRESSÃO: só entravam no ciclo curto três famílias fixas
    // (comprovante de endereço, antecedentes_*, requerimento SINARM). Uma
    // certidão de distribuição criminal com 30 dias no catálogo caía na régua
    // padrão e NASCIA AMARELA no mesmo dia da emissão.
    const tipo = "certidao_distribuicao_criminal_secao_judiciaria";
    expect(isVencimentoCicloCurto(tipo)).toBe(false); // sem catálogo, fallback

    setCatalogoValidade([
      { tipo_documento: tipo, validade_dias: 30, unidade: "dias", alerta_dias: 0, perpetuo: false } as never,
    ]);
    expect(isVencimentoCicloCurto(tipo)).toBe(true);

    // A régua combinada: 30→10 verde, 9→5 amarelo, 4→0 vermelho.
    expect(faixaVencimento(30, tipo)).toBe("ok");
    expect(faixaVencimento(10, tipo)).toBe("ok");
    expect(faixaVencimento(9, tipo)).toBe("warn");
    expect(faixaVencimento(4, tipo)).toBe("bad");
    expect(faixaVencimento(0, tipo)).toBe("bad");
  });

  it("catálogo com validade longa tira o tipo do ciclo curto, mesmo sendo da família curta", () => {
    const tipo = "antecedentes_criminais";
    expect(isVencimentoCicloCurto(tipo)).toBe(true); // fallback local

    setCatalogoValidade([
      { tipo_documento: tipo, validade_dias: 90, unidade: "dias", alerta_dias: 0, perpetuo: false } as never,
    ]);
    expect(isVencimentoCicloCurto(tipo)).toBe(false);
    expect(faixaVencimento(30, tipo)).toBe("warn"); // régua padrão de volta
  });

  it("documento perpétuo nunca é ciclo curto", () => {
    const tipo = "documento_qualquer";
    setCatalogoValidade([
      { tipo_documento: tipo, validade_dias: 0, unidade: "dias", alerta_dias: 0, perpetuo: true } as never,
    ]);
    expect(isVencimentoCicloCurto(tipo)).toBe(false);
  });
});

describe("lista de vencimentos: vermelho, amarelo, verde", () => {
  const src = r(KANBAN);

  it("ordena pela cor primeiro e pelos dias dentro de cada cor", () => {
    // Só por dias, o verde de uma certidão de 30 dias (25 restantes) subia na
    // frente do amarelo de um CR (28 restantes) — cores embaralhadas.
    expect(src).toContain('const ORDEM_TOM: Record<FrontItem["tone"], number> = { bad: 0, warn: 1, ok: 2, muted: 3 }');
    expect(src).toContain("if (ta !== tb) return ta - tb;");
    expect(src).toContain("return da - db;");
  });

  it("não sobrou o sort antigo, que reordenava antes e brigava com este", () => {
    expect(src).not.toContain('.sort((a, b) => (a.tone === "bad" ? -1 : b.tone === "bad" ? 1 : 0))');
  });

  it("o traço vertical antes do nome do documento saiu", () => {
    expect(src).not.toContain("qa-front-card__item--stack");
    expect(src).not.toMatch(/stack\?: boolean/);
  });
});

describe("layout do portal", () => {
  it("o conteúdo acompanha a largura da tela", () => {
    // `mx-auto` + `mr-[56px]` se anulavam: em tela grande o conteúdo ia para a
    // direita e sobrava uma faixa branca à esquerda.
    const src = r(PORTAL);
    expect(src).toContain('qa-portal-main w-full px-4 lg:px-8 mr-[56px]');
    expect(src).not.toContain("max-w-[1540px] mx-auto");
  });

  it("o que é fixo desce quando a tarja do espelho está na tela", () => {
    const src = r(PORTAL);
    // Avatar (estava cortado), rail de ícones e sidebar.
    expect(src).toContain("top: 'calc(16px + var(--emu-barra, 0px))'");
    expect(src.match(/top: "var\(--emu-barra, 0px\)"/g) ?? []).toHaveLength(2);
  });

  it("a tarja publica a própria altura para os fixos se ajustarem", () => {
    const banner = r(BANNER);
    expect(banner).toContain('raiz.style.setProperty("--emu-barra"');
    expect(banner).toContain('raiz.style.removeProperty("--emu-barra")');
    expect(banner).toContain("new ResizeObserver(aplicar)");
  });
});

describe("notificação no formato do macOS", () => {
  const src = r(NOTIF);

  it("usa a largura do banner do macOS (344px), não os 260px de antes", () => {
    expect(src).toContain("max-w-[344px]");
    expect(src).toContain("lg:w-[344px]");
    expect(src).not.toContain("max-w-[260px]");
  });

  it("ícone de 38px, como o do sistema", () => {
    expect(src).toContain("h-[38px] w-[38px]");
    expect(src).not.toContain("h-6 w-6 rounded-[9px]");
  });

  it("desce junto com a tarja do espelho", () => {
    expect(src).toContain("top-[calc(0.5rem+var(--emu-barra,0px))]");
    expect(src).toContain("lg:top-[calc(84px+var(--emu-barra,0px))]");
  });
});
