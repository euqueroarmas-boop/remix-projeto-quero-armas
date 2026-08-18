// ============================================================================
// O vocabulário de status da TELA tem que ser o do BANCO. Byte a byte.
// ----------------------------------------------------------------------------
// Auditoria de 18/08/2026: existiam duas listas divergentes.
//
//   • A tela oferecia 4 status que o CHECK de `qa_processos.status` recusa
//     (`em_validacao_ia`, `em_revisao_humana`, `aprovado`, `em_andamento`).
//     Como o CHECK existe desde 20260528, nenhum processo jamais esteve neles:
//     os 4 botões do painel "ALTERAR STATUS DO PROCESSO" sempre deram erro de
//     constraint na cara do operador.
//
//   • E 7 status reais do banco não existiam na tela e caíam todos no fallback
//     "AGUARDANDO DOCUMENTOS" — inclusive `aguardando_assinatura`, que é
//     "pagou e não assinou o contrato". A equipe via "cobre documento" quando
//     o certo era "cobre assinatura".
//
// Este teste lê a migration mais recente que define o CHECK e compara com o
// mapa da tela. Mexeu num lado sem mexer no outro, quebra aqui.
// ============================================================================

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import {
  STATUS_PROCESSO,
  STATUS_PROCESSO_CANONICOS,
  STATUS_PROCESSO_LEGADO,
  TRANSICOES_PROCESSO,
  transicoesPermitidas,
  getStatusProcesso,
  type StatusProcesso,
} from "@/components/quero-armas/processos/processoConstants";

const DIR_MIGRATIONS = resolve(process.cwd(), "supabase/migrations");

/** Lê o CHECK vigente de `qa_processos_status_check` da migration mais nova. */
function statusDoBanco(): string[] {
  const arquivos = readdirSync(DIR_MIGRATIONS)
    .filter((f) => f.endsWith(".sql"))
    .sort()
    .reverse();
  for (const f of arquivos) {
    const sql = readFileSync(resolve(DIR_MIGRATIONS, f), "utf-8");
    const i = sql.indexOf("ADD CONSTRAINT qa_processos_status_check");
    if (i === -1) continue;
    const trecho = sql.slice(i, sql.indexOf(";", i));
    const valores = [...trecho.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]);
    if (valores.length > 0) return valores;
  }
  throw new Error("CHECK qa_processos_status_check não encontrado nas migrations");
}

describe("status do processo: tela x banco", () => {
  const doBanco = statusDoBanco();

  it("a migration realmente define o CHECK (sanidade do parser)", () => {
    expect(doBanco.length).toBeGreaterThanOrEqual(19);
    expect(doBanco).toContain("aguardando_assinatura");
    expect(doBanco).toContain("notificado");
    expect(doBanco).toContain("recurso_administrativo");
  });

  it("todo status do banco existe na tela", () => {
    const faltando = doBanco.filter((s) => !(s in STATUS_PROCESSO));
    expect(faltando, `status do banco sem rótulo na tela: ${faltando.join(", ")}`).toEqual([]);
  });

  it("a tela não oferece nenhum status que o banco recusa", () => {
    const sobrando = STATUS_PROCESSO_CANONICOS.filter((s) => !doBanco.includes(s));
    expect(sobrando, `status na tela que o banco rejeita: ${sobrando.join(", ")}`).toEqual([]);
  });

  it("os 4 rótulos legados saíram do mapa gravável", () => {
    for (const morto of ["em_validacao_ia", "em_revisao_humana", "aprovado", "em_andamento"]) {
      expect(STATUS_PROCESSO_CANONICOS).not.toContain(morto as StatusProcesso);
      expect(doBanco).not.toContain(morto);
    }
  });

  it("mas continuam legíveis, sem cair em AGUARDANDO DOCUMENTOS", () => {
    expect(Object.keys(STATUS_PROCESSO_LEGADO)).toHaveLength(4);
    expect(getStatusProcesso("aprovado").label).toBe("DOCUMENTAÇÃO APROVADA");
    expect(getStatusProcesso("em_revisao_humana").label).toBe("EM REVISÃO HUMANA");
    expect(getStatusProcesso("em_validacao_ia").label).toBe("VALIDAÇÃO AUTOMÁTICA");
    expect(getStatusProcesso("em_andamento").label).toBe("EM ANÁLISE INTERNA");
  });

  it("aguardando_assinatura tem rótulo próprio — não é AGUARDANDO DOCUMENTOS", () => {
    // O furo mais caro dos 7: pagou e não assinou virava "cobre documento".
    expect(getStatusProcesso("aguardando_assinatura").label).toBe("AGUARDANDO ASSINATURA DO CONTRATO");
    expect(getStatusProcesso("aguardando_assinatura").label)
      .not.toBe(STATUS_PROCESSO.aguardando_documentos.label);
  });

  it("status desconhecido continua caindo num rótulo seguro", () => {
    expect(getStatusProcesso("lixo_qualquer").label).toBe("AGUARDANDO DOCUMENTOS");
  });
});

describe("máquina de estados", () => {
  it("cobre todos os status canônicos", () => {
    for (const s of STATUS_PROCESSO_CANONICOS) {
      expect(TRANSICOES_PROCESSO[s], `sem transição declarada: ${s}`).toBeDefined();
    }
  });

  it("todo destino declarado é um status válido", () => {
    for (const [origem, destinos] of Object.entries(TRANSICOES_PROCESSO)) {
      for (const d of destinos) {
        expect(STATUS_PROCESSO_CANONICOS, `${origem} → ${d} não existe`).toContain(d);
      }
    }
  });

  it("nenhum status volta para si mesmo", () => {
    for (const [origem, destinos] of Object.entries(TRANSICOES_PROCESSO)) {
      expect(destinos, `${origem} aponta para si mesmo`).not.toContain(origem as StatusProcesso);
    }
  });

  it("protocolar nunca é oferecido no seletor livre", () => {
    for (const s of STATUS_PROCESSO_CANONICOS) {
      expect(transicoesPermitidas(s), `${s} oferece protocolado no seletor`)
        .not.toContain("protocolado" as StatusProcesso);
    }
  });

  it("não dá para pular do checklist direto para a decisão da PF", () => {
    for (const origem of ["aguardando_documentos", "em_validacao", "validado", "pronto_para_protocolar"] as StatusProcesso[]) {
      const d = transicoesPermitidas(origem);
      expect(d, `${origem} → deferido`).not.toContain("deferido" as StatusProcesso);
      expect(d, `${origem} → indeferido`).not.toContain("indeferido" as StatusProcesso);
    }
  });

  it("processo protocolado não volta para o começo", () => {
    for (const origem of ["protocolado", "em_analise_orgao", "notificado"] as StatusProcesso[]) {
      const d = transicoesPermitidas(origem);
      expect(d).not.toContain("aguardando_pagamento" as StatusProcesso);
      expect(d).not.toContain("aguardando_documentos" as StatusProcesso);
      expect(d).not.toContain("pronto_para_protocolar" as StatusProcesso);
    }
  });

  it("indeferido abre o recurso; deferido só fecha", () => {
    expect(transicoesPermitidas("indeferido")).toContain("recurso_administrativo" as StatusProcesso);
    expect(transicoesPermitidas("deferido")).toEqual(["concluido"]);
  });

  it("status encerrado não oferece saída", () => {
    expect(transicoesPermitidas("concluido")).toEqual([]);
    expect(transicoesPermitidas("cancelado")).toEqual([]);
  });

  it("status desconhecido não trava o operador", () => {
    const d = transicoesPermitidas("valor_estranho_legado");
    expect(d.length).toBeGreaterThan(0);
    expect(d).toContain("cancelado" as StatusProcesso);
  });
});

describe("promoção automática no backend conhece o mesmo vocabulário", () => {
  const src = readFileSync(
    resolve(process.cwd(), "supabase/functions/qa-processo-checar-conclusao-checklist/index.ts"),
    "utf-8",
  );
  const bloco = src.slice(src.indexOf("const STATUS_PROMOVIVEIS"), src.indexOf("const TEAM_EMAIL"));

  it("inclui todo status de checklist em curso do banco", () => {
    for (const s of [
      "aguardando_documentos",
      "em_validacao",
      "revisao_humana",
      "pendente_cliente",
      "em_analise_interna",
      "validado",
    ]) {
      expect(bloco, `STATUS_PROMOVIVEIS sem ${s}`).toContain(`"${s}"`);
    }
  });

  it("não promove a partir de estado que já passou do checklist", () => {
    for (const s of ["protocolado", "deferido", "indeferido", "concluido", "aguardando_assinatura"]) {
      expect(bloco, `STATUS_PROMOVIVEIS não deveria ter ${s}`).not.toContain(`"${s}"`);
    }
  });
});
