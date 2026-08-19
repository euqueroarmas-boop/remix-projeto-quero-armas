// ============================================================================
// Fase da PETIÇÃO no painel "PROGRESSO DOS CLIENTES"
// ----------------------------------------------------------------------------
// O card do painel contava a vida do processo só até o documento: grupo atual,
// quanto falta, quem está parado. Depois que o checklist fechava, o processo
// entrava na fase mais cara — escrever a peça, mandar para o cliente aprovar,
// receber de volta — e o card não dizia nada. Para a equipe, "chegou na PET"
// era informação que só existia abrindo o processo um a um.
//
// Estes testes travam a tradução dos quatro valores de
// `qa_geracoes_pecas.status_cliente` (mais o caso "fechou tudo e não tem peça")
// no chip que o card mostra.
// ============================================================================

import { describe, it, expect } from "vitest";
import { estadoPeticao, statusPecaDominante, pecasPorProcesso } from "../fasePeticao";

const emDocumentos = { status: "aguardando_documentos", total_docs: 30, entregues: 19 };
const checklistFechado = { status: "aguardando_documentos", total_docs: 30, entregues: 30 };

describe("estadoPeticao", () => {
  it("não mostra PET para quem ainda tem documento pendente", () => {
    expect(estadoPeticao(emDocumentos, [])).toBeNull();
  });

  it("checklist fechado e nenhuma peça: petição na fila da equipe", () => {
    expect(estadoPeticao(checklistFechado, [])?.id).toBe("aguardando_equipe");
  });

  it("processo validado entra na fase mesmo sem a contagem fechar", () => {
    expect(estadoPeticao({ status: "validado", total_docs: 30, entregues: 28 }, [])?.id).toBe("aguardando_equipe");
  });

  it("peça gerada e ainda não enviada aparece como redigida", () => {
    expect(estadoPeticao(checklistFechado, [{ status_cliente: "nao_enviada" }])?.id).toBe("redigida");
  });

  it("peça enviada aparece como com o cliente", () => {
    const e = estadoPeticao(emDocumentos, [{ status_cliente: "aguardando_cliente" }]);
    expect(e?.id).toBe("com_cliente");
    expect(e?.tom).toBe("ambar");
  });

  it("devolução do cliente é trabalho da equipe — chip vermelho", () => {
    const e = estadoPeticao(checklistFechado, [{ status_cliente: "devolvida" }]);
    expect(e?.id).toBe("devolvida");
    expect(e?.tom).toBe("vermelho");
  });

  it("aprovada pelo cliente vence qualquer rascunho posterior", () => {
    const e = estadoPeticao(checklistFechado, [
      { status_cliente: "nao_enviada" },
      { status_cliente: "aprovada" },
    ]);
    expect(e?.id).toBe("aprovada");
    expect(e?.tom).toBe("verde");
  });

  it("peça nova com o cliente vence a devolução já reescrita", () => {
    const e = estadoPeticao(checklistFechado, [
      { status_cliente: "devolvida" },
      { status_cliente: "aguardando_cliente" },
    ]);
    expect(e?.id).toBe("com_cliente");
  });

  it("processo bloqueado por etapa anterior não fala de petição", () => {
    expect(estadoPeticao({ ...checklistFechado, bloqueado_por_prerequisito: true }, [{ status_cliente: "aguardando_cliente" }])).toBeNull();
  });

  it("processo protocolado sai do assunto — salvo a peça aprovada, que fica registrada", () => {
    expect(estadoPeticao({ status: "protocolado", total_docs: 30, entregues: 30 }, [])).toBeNull();
    expect(estadoPeticao({ status: "aguardando_documentos", protocolo_numero: "0891", total_docs: 30, entregues: 30 }, [])).toBeNull();
    expect(estadoPeticao({ status: "protocolado", total_docs: 30, entregues: 30 }, [{ status_cliente: "aprovada" }])?.id).toBe("aprovada");
  });

  it("status desconhecido de peça não inventa fase", () => {
    expect(estadoPeticao(emDocumentos, [{ status_cliente: "seila" }])).toBeNull();
  });
});

describe("statusPecaDominante", () => {
  it("sem peça, sem status", () => {
    expect(statusPecaDominante([])).toBeNull();
  });

  it("escolhe o estágio mais avançado da conversa com o cliente", () => {
    expect(statusPecaDominante([
      { status_cliente: "nao_enviada" },
      { status_cliente: "devolvida" },
    ])).toBe("devolvida");
  });
});

describe("pecasPorProcesso", () => {
  it("agrupa por processo e descarta peça sem vínculo", () => {
    const mapa = pecasPorProcesso([
      { processo_id: "p1", status_cliente: "aprovada" },
      { processo_id: "p1", status_cliente: "nao_enviada" },
      { processo_id: null, status_cliente: "aprovada" },
    ]);
    expect(mapa.p1).toHaveLength(2);
    expect(Object.keys(mapa)).toEqual(["p1"]);
  });
});
