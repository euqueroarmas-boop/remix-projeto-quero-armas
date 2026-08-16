import { describe, expect, it } from "vitest";
import {
  campoPrazoDoStatus,
  patchPrazoDoItem,
  statusProcessoDoStatusManifestacao,
} from "../manifestacaoPrazoPF";
import {
  FRASES_MS,
  janelaMandadoSeguranca,
  linkWhatsAppMS,
  PRAZO_MS_DIAS,
  WHATSAPP_EQUIPE,
} from "../mandadoSeguranca";
import { extrairPrazoDoItem } from "../prazosProcessuais";

describe("manifestação da PF → coluna de prazo", () => {
  it("notificação abre o prazo de 10 dias", () => {
    expect(campoPrazoDoStatus("notificado")).toBe("data_notificacao");
  });

  it("indeferimento abre o prazo do recurso", () => {
    expect(campoPrazoDoStatus("indeferido")).toBe("data_indeferimento");
  });

  it("recurso protocolado FECHA o prazo de 10 dias", () => {
    expect(campoPrazoDoStatus("recurso_administrativo")).toBe("data_recurso_administrativo");
  });

  it("recurso NEGADO abre o prazo do mandado de segurança", () => {
    expect(campoPrazoDoStatus("recurso_indeferido")).toBe("data_indeferimento_recurso");
  });

  it("análise em curso não abre prazo nenhum", () => {
    expect(campoPrazoDoStatus("em_analise_orgao")).toBeNull();
  });

  it("status desconhecido não grava nada — nunca chuta coluna", () => {
    expect(campoPrazoDoStatus("status_que_nao_existe")).toBeNull();
    expect(campoPrazoDoStatus(null)).toBeNull();
    expect(campoPrazoDoStatus("")).toBeNull();
  });

  it("usa a data do DOCUMENTO, não a do dia em que foi colado", () => {
    // O prazo corre da manifestação da PF. Colar quatro dias depois não
    // devolve quatro dias ao cliente.
    expect(
      patchPrazoDoItem({ status: "notificado", dataDocumento: "2026-08-10", hojeISO: "2026-08-14" }),
    ).toEqual({ data_notificacao: "2026-08-10" });
  });

  it("aceita data em DD/MM/AAAA", () => {
    expect(
      patchPrazoDoItem({ status: "indeferido", dataDocumento: "10/08/2026", hojeISO: "2026-08-14" }),
    ).toEqual({ data_indeferimento: "2026-08-10" });
  });

  it("sem data do documento, cai para hoje", () => {
    expect(
      patchPrazoDoItem({ status: "notificado", dataDocumento: null, hojeISO: "2026-08-14" }),
    ).toEqual({ data_notificacao: "2026-08-14" });
  });

  it("devolve vazio quando não há prazo — evita UPDATE inútil", () => {
    expect(patchPrazoDoItem({ status: "em_analise_orgao", hojeISO: "2026-08-14" })).toEqual({});
  });
});

describe("status da manifestação → status do processo", () => {
  it("recurso_indeferido vira indeferido: qa_processos não tem esse status", () => {
    // O CHECK de qa_processos não conhece `recurso_indeferido`, e o processo
    // continua sendo o que é — indeferido. A distinção vive na manifestação.
    expect(statusProcessoDoStatusManifestacao("recurso_indeferido")).toBe("indeferido");
  });

  it("os demais passam iguais", () => {
    expect(statusProcessoDoStatusManifestacao("notificado")).toBe("notificado");
    expect(statusProcessoDoStatusManifestacao("deferido")).toBe("deferido");
    expect(statusProcessoDoStatusManifestacao(null)).toBeNull();
  });
});

describe("mandado de segurança — janela de 120 dias", () => {
  it("não existe janela antes do recurso ser negado", () => {
    expect(janelaMandadoSeguranca(null, "2026-08-16")).toBeNull();
    expect(janelaMandadoSeguranca("", "2026-08-16")).toBeNull();
  });

  it("120 dias corridos a partir do indeferimento do recurso", () => {
    const j = janelaMandadoSeguranca("2026-08-16", "2026-08-16");
    expect(j?.dataLimite).toBe("2026-12-14");
    expect(j?.diasRestantes).toBe(PRAZO_MS_DIAS);
    expect(j?.aberta).toBe(true);
  });

  it("no último dia ainda está aberta", () => {
    const j = janelaMandadoSeguranca("2026-08-16", "2026-12-14");
    expect(j?.diasRestantes).toBe(0);
    expect(j?.aberta).toBe(true);
  });

  it("no dia seguinte fecha — decadencial não volta", () => {
    const j = janelaMandadoSeguranca("2026-08-16", "2026-12-15");
    expect(j?.diasRestantes).toBe(-1);
    expect(j?.aberta).toBe(false);
  });

  it("bate com a engine de prazos, que é quem alimenta a Dashboard", () => {
    const prazo = extrairPrazoDoItem({
      id: 1,
      status: "indeferido",
      data_indeferimento: "2026-08-01",
      data_indeferimento_recurso: "2026-08-16",
    });
    expect(prazo?.evento).toBe("MANDADO DE SEGURANÇA");
    expect(prazo?.prazoTotalDias).toBe(PRAZO_MS_DIAS);
    expect(prazo?.dataLimite).toBe(janelaMandadoSeguranca("2026-08-16", "2026-08-16")?.dataLimite);
  });
});

describe("link do WhatsApp da equipe", () => {
  it("são exatamente as três frases combinadas", () => {
    expect([...FRASES_MS]).toEqual([
      "Quero levar meu processo ao juiz",
      "Quero o mandado de segurança",
      "Quero falar com a equipe",
    ]);
  });

  it("aponta para o número da equipe", () => {
    expect(WHATSAPP_EQUIPE).toBe("5511978481919");
    expect(linkWhatsAppMS(FRASES_MS[0])).toContain("https://wa.me/5511978481919?text=");
  });

  it("a frase é a PRIMEIRA linha — quem atende reconhece sem ler o resto", () => {
    const url = linkWhatsAppMS(FRASES_MS[1], { protocolo: "202509251233571981", servico: "Posse" });
    const texto = decodeURIComponent(url.split("text=")[1]);
    expect(texto.split("\n")[0]).toBe("Quero o mandado de segurança");
    expect(texto).toContain("protocolo 202509251233571981");
  });

  it("sem contexto, manda só a frase", () => {
    const url = linkWhatsAppMS(FRASES_MS[2]);
    expect(decodeURIComponent(url.split("text=")[1])).toBe("Quero falar com a equipe");
  });
});
