import { describe, it, expect, vi, beforeEach } from "vitest";

const insertMock: any = vi.fn().mockResolvedValue({ error: null });
const fromMock: any = vi.fn((_table: string) => ({ insert: insertMock }));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: (table: string) => fromMock(table) },
}));

import { registrarStatusEvento } from "../registrarStatusEvento";

beforeEach(() => {
  insertMock.mockClear();
  fromMock.mockClear();
});

describe("registrarStatusEvento", () => {
  it("não registra quando status_anterior === status_novo", async () => {
    const r = await registrarStatusEvento({
      origem: "sistema",
      entidade: "processo",
      entidade_id: "abc",
      campo_status: "status",
      status_anterior: "EM_ANDAMENTO",
      status_novo: "EM_ANDAMENTO",
    });
    expect(r.ok).toBe(false);
    expect(r.skipped).toBe("status_inalterado");
    expect(insertMock).not.toHaveBeenCalled();
  });

  it("não registra sem entidade", async () => {
    const r = await registrarStatusEvento({
      origem: "sistema",
      entidade: "",
      entidade_id: "abc",
      campo_status: "status",
      status_novo: "X",
    });
    expect(r.ok).toBe(false);
    expect(r.skipped).toBe("entidade_ou_id_ausente");
    expect(insertMock).not.toHaveBeenCalled();
  });

  it("não registra sem entidade_id", async () => {
    const r = await registrarStatusEvento({
      origem: "sistema",
      entidade: "processo",
      entidade_id: "",
      campo_status: "status",
      status_novo: "X",
    });
    expect(r.ok).toBe(false);
    expect(r.skipped).toBe("entidade_ou_id_ausente");
    expect(insertMock).not.toHaveBeenCalled();
  });

  it("registra quando payload válido", async () => {
    const r = await registrarStatusEvento({
      origem: "equipe",
      entidade: "processo",
      entidade_id: "abc-123",
      campo_status: "status",
      status_anterior: "ANALISE",
      status_novo: "CONCLUIDO",
      cliente_id: 42,
    });
    expect(r.ok).toBe(true);
    expect(fromMock).toHaveBeenCalledWith("qa_status_eventos");
    expect(insertMock).toHaveBeenCalledTimes(1);
    const payload = insertMock.mock.calls[0][0];
    expect(payload.entidade).toBe("processo");
    expect(payload.entidade_id).toBe("abc-123");
    expect(payload.status_novo).toBe("CONCLUIDO");
    expect(payload.cliente_id).toBe(42);
  });

  it("não quebra fluxo se insert falhar", async () => {
    insertMock.mockResolvedValueOnce({ error: { message: "rls denied" } });
    const r = await registrarStatusEvento({
      origem: "cliente",
      entidade: "documento",
      entidade_id: "doc-1",
      campo_status: "status",
      status_novo: "PENDENTE",
    });
    expect(r.ok).toBe(false);
    expect(r.error).toBeDefined();
  });
});