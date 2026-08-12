import { beforeEach, describe, expect, it } from "vitest";
import {
  clearChecklistRetomada,
  loadChecklistRetomada,
  resolveRetomadaIndex,
  saveChecklistRetomada,
} from "../documentAssistantProgress";

const CLIENTE = 214;

describe("retomada do checklist guiado", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("sem nada salvo, não há retomada", () => {
    expect(loadChecklistRetomada(CLIENTE)).toBeNull();
  });

  it("guarda o item e a rolagem em que o cliente parou", () => {
    saveChecklistRetomada(CLIENTE, { pendenciaId: "efetiva:proc-1:bo", scrollTop: 640 });
    const salvo = loadChecklistRetomada(CLIENTE);
    expect(salvo?.pendenciaId).toBe("efetiva:proc-1:bo");
    expect(salvo?.scrollTop).toBe(640);
  });

  it("grava por mescla: a seção do portal não apaga a posição da fila", () => {
    saveChecklistRetomada(CLIENTE, { pendenciaId: "doc:99", scrollTop: 120 });
    saveChecklistRetomada(CLIENTE, { secao: "checklist_guiado" });
    const salvo = loadChecklistRetomada(CLIENTE);
    expect(salvo?.pendenciaId).toBe("doc:99");
    expect(salvo?.scrollTop).toBe(120);
    expect(salvo?.secao).toBe("checklist_guiado");
  });

  it("cada cliente tem a sua memória — nada vaza entre logins no mesmo aparelho", () => {
    saveChecklistRetomada(CLIENTE, { pendenciaId: "doc:99" });
    saveChecklistRetomada(777, { pendenciaId: "doc:1" });
    expect(loadChecklistRetomada(CLIENTE)?.pendenciaId).toBe("doc:99");
    expect(loadChecklistRetomada(777)?.pendenciaId).toBe("doc:1");
  });

  it("posição com mais de 7 dias é descartada", () => {
    const velho = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString();
    window.localStorage.setItem(
      `qa_checklist_retomada:${CLIENTE}`,
      JSON.stringify({ pendenciaId: "doc:99", scrollTop: 10, secao: "documentos", updatedAt: velho }),
    );
    expect(loadChecklistRetomada(CLIENTE)).toBeNull();
  });

  it("registro corrompido não derruba o portal", () => {
    window.localStorage.setItem(`qa_checklist_retomada:${CLIENTE}`, "{ isso não é json");
    expect(loadChecklistRetomada(CLIENTE)).toBeNull();
  });

  it("sem id de cliente não grava nada", () => {
    saveChecklistRetomada(null, { pendenciaId: "doc:99" });
    expect(window.localStorage.length).toBe(0);
  });

  it("limpa a memória do cliente", () => {
    saveChecklistRetomada(CLIENTE, { pendenciaId: "doc:99" });
    clearChecklistRetomada(CLIENTE);
    expect(loadChecklistRetomada(CLIENTE)).toBeNull();
  });

  describe("resolveRetomadaIndex", () => {
    const fila = [{ id: "doc:1" }, { id: "doc:2" }, { id: "efetiva:p:bo" }];

    it("devolve o índice do item em que ele parou", () => {
      saveChecklistRetomada(CLIENTE, { pendenciaId: "efetiva:p:bo" });
      expect(resolveRetomadaIndex(fila, loadChecklistRetomada(CLIENTE))).toBe(2);
    });

    it("item já resolvido (fora da fila) não é retomado", () => {
      saveChecklistRetomada(CLIENTE, { pendenciaId: "doc:404" });
      expect(resolveRetomadaIndex(fila, loadChecklistRetomada(CLIENTE))).toBe(-1);
    });

    it("fila vazia ou sem posição salva não força índice nenhum", () => {
      expect(resolveRetomadaIndex([], loadChecklistRetomada(CLIENTE))).toBe(-1);
      expect(resolveRetomadaIndex(fila, null)).toBe(-1);
    });
  });
});
