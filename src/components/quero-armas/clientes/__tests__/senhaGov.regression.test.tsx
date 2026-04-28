/**
 * Regressão P0 — incidente de cruzamento Senha GOV (28/04/2026).
 *
 * Garante que:
 *   1) A API `getSenhaGov`/`setSenhaGov` sempre envia `cliente_id`.
 *   2) `SenhaGovField` NÃO carrega senha automaticamente (revelação manual).
 *   3) Trocar de cliente/CR limpa estado local imediatamente
 *      (sem cache cruzado).
 *   4) Mismatch detectado server-side propaga erro humano-legível.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";

// Mock supabase client (auth + from query) ANTES de importar componentes
vi.mock("@/integrations/supabase/client", () => {
  const fromMock = vi.fn(() => ({
    select: () => ({
      eq: () => ({
        is: () => ({
          order: () => ({
            limit: () => ({ maybeSingle: () => Promise.resolve({ data: null }) }),
          }),
        }),
      }),
    }),
  }));
  return {
    supabase: {
      auth: {
        getSession: () =>
          Promise.resolve({ data: { session: { access_token: "tok" } } }),
        getUser: () => Promise.resolve({ data: { user: { id: "u1" } } }),
        signOut: () => Promise.resolve(),
      },
      from: fromMock,
    },
  };
});

// Mock global fetch para a edge function qa-senha-gov
const fetchSpy = vi.fn();
(globalThis as any).fetch = fetchSpy;

// Garantir variáveis de ambiente do client supabase
(import.meta as any).env = {
  ...(import.meta as any).env,
  VITE_SUPABASE_URL: "https://x.supabase.co",
  VITE_SUPABASE_PUBLISHABLE_KEY: "anon",
};

import { getSenhaGov, setSenhaGov } from "../senhaGovApi";
import { SenhaGovField } from "../SenhaGovField";

beforeEach(() => {
  fetchSpy.mockReset();
});

describe("Senha GOV — regressão P0 anti cross-tenant", () => {
  it("getSenhaGov envia cliente_id no payload", async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ senha: "abc" }),
    });
    const senha = await getSenhaGov(17, "ctx", 46);
    expect(senha).toBe("abc");
    const body = JSON.parse((fetchSpy.mock.calls[0][1] as any).body);
    expect(body.cadastro_cr_id).toBe(17);
    expect(body.cliente_id).toBe(46);
  });

  it("setSenhaGov envia cliente_id no payload", async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ok: true }),
    });
    await setSenhaGov(17, "novaSenha", "ctx", 46);
    const body = JSON.parse((fetchSpy.mock.calls[0][1] as any).body);
    expect(body.cliente_id).toBe(46);
    expect(body.senha).toBe("novaSenha");
  });

  it("getSenhaGov propaga erro 409 (mismatch) do servidor", async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: false,
      status: 409,
      json: async () => ({ error: "Vínculo divergente. Leitura bloqueada." }),
    });
    await expect(getSenhaGov(17, "ctx", 999)).rejects.toThrow(/divergente/i);
  });

  it("SenhaGovField NÃO faz auto-load (mostra mascarada até clique)", async () => {
    render(<SenhaGovField cadastroCrId={17} clienteId={46} variant="row" />);
    await waitFor(() => {
      expect(screen.getByText("••••••••")).toBeInTheDocument();
    });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("SenhaGovField limpa estado ao trocar cadastroCrId/clienteId (anti cache cruzado)", async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ senha: "SenhaWillian" }),
    });
    const { rerender } = render(
      <SenhaGovField cadastroCrId={17} clienteId={46} variant="row" />,
    );
    // Revela manualmente
    fireEvent.click(screen.getByTitle(/Revelar|Ocultar/));
    await waitFor(() => {
      expect(screen.getByText("SenhaWillian")).toBeInTheDocument();
    });
    // Troca para outro cliente — estado deve ser purgado
    rerender(<SenhaGovField cadastroCrId={21} clienteId={52} variant="row" />);
    await waitFor(() => {
      expect(screen.getByText("••••••••")).toBeInTheDocument();
    });
    expect(screen.queryByText("SenhaWillian")).toBeNull();
  });
});