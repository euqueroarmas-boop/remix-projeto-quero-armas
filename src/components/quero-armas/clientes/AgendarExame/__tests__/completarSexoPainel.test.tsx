import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";

const invoke = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { functions: { invoke: (...args: unknown[]) => invoke(...args) } },
}));

import { AgendarExamePainel } from "../AgendarExamePainel";

const PADRAO = {
  ativo: true,
  tipo: "psicologo" as const,
  cidade: "Goiânia",
  uf: "GO",
  nomeCliente: "MARIA APARECIDA SOUZA",
  comCabecalho: false,
};

describe("AgendarExamePainel — cadastro sem sexo", () => {
  beforeEach(() => {
    invoke.mockReset();
    invoke.mockImplementation(async (fn: string) =>
      fn === "qa-cliente-atualizar-cadastro"
        ? { data: { success: true }, error: null }
        : { data: { results: [] }, error: null },
    );
  });

  it("pergunta ao cliente e grava a resposta no cadastro", async () => {
    render(<AgendarExamePainel {...PADRAO} permitirCompletarSexo />);

    expect(await screen.findByText(/homem ou mulher/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Feminino" }));

    await waitFor(() =>
      expect(invoke).toHaveBeenCalledWith("qa-cliente-atualizar-cadastro", {
        body: { fields: { sexo: "F" }, field_origins: { sexo: "manual" } },
      }),
    );
    // Respondido, a pergunta some — não fica cobrando de novo.
    await waitFor(() => expect(screen.queryByText(/homem ou mulher/i)).toBeNull());
  });

  it("não pergunta quando o cadastro já tem o sexo", async () => {
    render(<AgendarExamePainel {...PADRAO} sexoCliente="F" permitirCompletarSexo />);
    await waitFor(() => expect(invoke).toHaveBeenCalled());
    expect(screen.queryByText(/homem ou mulher/i)).toBeNull();
  });

  it("não pergunta na tela da equipe, que vê o cadastro de outra pessoa", async () => {
    render(<AgendarExamePainel {...PADRAO} />);
    await waitFor(() => expect(invoke).toHaveBeenCalled());
    expect(screen.queryByText(/homem ou mulher/i)).toBeNull();
  });
});
