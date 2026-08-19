import { describe, expect, it } from "vitest";
import { docsPorProcesso, faseDoProcesso } from "@/lib/quero-armas/faseProcessoCliente";

// ============================================================================
// Checklist REAL do Anthony em 19/08/2026, depois de entregar tudo: 25 itens
// concluídos e só o bloco do protocolo em aberto — nenhum deles dependendo dele.
// Ele abriu o portal e não achou sinal de vida: granada sem pendência, tela
// inicial falando de certidão vencendo. É esta situação que a fase precisa
// nomear.
// ============================================================================
const CHECKLIST_ANTHONY = [
  { processo_id: "p1", obrigatorio: true, status: "entregue_pelo_hub", tipo_documento: "requerimento_de_posse_de_arma_de_fogo" },
  { processo_id: "p1", obrigatorio: true, status: "pendente", tipo_documento: "gru", regra_validacao: { etapa_final: true } },
  { processo_id: "p1", obrigatorio: true, status: "pendente", tipo_documento: "gru_comprovante", regra_validacao: { etapa_final: true } },
  { processo_id: "p1", obrigatorio: true, status: "pendente", tipo_documento: "credencial_gov_br", regra_validacao: { etapa_final: true } },
  { processo_id: "p1", obrigatorio: true, status: "pendente", tipo_documento: "juntada_assinada", regra_validacao: { etapa_final: true } },
];

describe("faseDoProcesso", () => {
  it("com tudo entregue, a bola é da EQUIPE — não do cliente", () => {
    const f = faseDoProcesso({ id: "p1", status: "em_andamento" }, CHECKLIST_ANTHONY);
    expect(f.id).toBe("defesa");
    expect(f.passo).toBe(2);
    expect(f.responsavel).toBe("equipe");
    expect(f.descricao).toContain("entregou tudo");
  });

  it("com documento do cliente em aberto, a bola é dele e o texto conta quantos", () => {
    const f = faseDoProcesso({ id: "p1", status: "em_andamento" }, [
      ...CHECKLIST_ANTHONY,
      { processo_id: "p1", obrigatorio: true, status: "pendente", tipo_documento: "antecedentes_criminais" },
      { processo_id: "p1", obrigatorio: true, status: "reprovado", tipo_documento: "comprovante_residencia" },
    ]);
    expect(f.id).toBe("documentos");
    expect(f.responsavel).toBe("cliente");
    expect(f.descricao).toContain("2 documentos");
  });

  it("um documento só: fala no singular", () => {
    const f = faseDoProcesso({ id: "p1", status: "em_andamento" }, [
      ...CHECKLIST_ANTHONY,
      { processo_id: "p1", obrigatorio: true, status: "pendente", tipo_documento: "antecedentes_criminais" },
    ]);
    expect(f.descricao).toContain("Falta 1 documento");
  });

  it("liberado o protocolo, o bloco final volta a ser do cliente", () => {
    const f = faseDoProcesso({ id: "p1", status: "pronto_para_protocolar" }, CHECKLIST_ANTHONY);
    expect(f.id).toBe("protocolo");
    expect(f.passo).toBe(3);
    expect(f.responsavel).toBe("cliente");
  });

  it("protocolado: a bola é da Polícia Federal", () => {
    const f = faseDoProcesso(
      { id: "p1", status: "protocolado", protocolo_numero: "08455.000123/2026-11" },
      CHECKLIST_ANTHONY,
    );
    expect(f.id).toBe("na_pf");
    expect(f.responsavel).toBe("policia_federal");
  });

  it("deferido vence tudo, mesmo com item em aberto no checklist", () => {
    const f = faseDoProcesso(
      { id: "p1", status: "protocolado", protocolo_numero: "123", deferimento_documento_id: "doc-x" },
      CHECKLIST_ANTHONY,
    );
    expect(f.id).toBe("deferido");
    expect(f.passo).toBe(5);
  });

  it("checklist sem nada em aberto também é fase da equipe — nunca cobra o cliente", () => {
    const f = faseDoProcesso({ id: "p1", status: "em_andamento" }, [
      { processo_id: "p1", obrigatorio: true, status: "aprovado", tipo_documento: "cin" },
    ]);
    expect(f.id).toBe("defesa");
    expect(f.responsavel).toBe("equipe");
  });

  it("item não obrigatório em aberto não segura o cliente na fase de documentos", () => {
    const f = faseDoProcesso({ id: "p1", status: "em_andamento" }, [
      ...CHECKLIST_ANTHONY,
      { processo_id: "p1", obrigatorio: false, status: "pendente", tipo_documento: "documento_complementar_caso" },
    ]);
    expect(f.id).toBe("defesa");
  });
});

describe("docsPorProcesso", () => {
  it("agrupa por processo e ignora linha sem vínculo", () => {
    const m = docsPorProcesso([
      ...CHECKLIST_ANTHONY,
      { processo_id: "p2", obrigatorio: true, status: "pendente", tipo_documento: "cin" },
      { processo_id: null, obrigatorio: true, status: "pendente", tipo_documento: "cin" },
    ]);
    expect(m.get("p1")).toHaveLength(5);
    expect(m.get("p2")).toHaveLength(1);
    expect(m.size).toBe(2);
  });
});
