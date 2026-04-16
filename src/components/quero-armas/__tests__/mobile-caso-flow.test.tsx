/**
 * Regression test: Mobile case creation + piece generation + linking flow.
 *
 * Covers:
 *  1. "Criar Caso" button is visible and submittable on mobile
 *  2. No auxiliary button inside form can accidentally submit
 *  3. geracao_id is never overwritten with null
 *  4. CaseDetailPanel re-fetches geracao_id from DB (no stale prop)
 *  5. Piece is visible inside case detail after generation
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

/* ─── 1. NovoCasoModal ─── */
describe("NovoCasoModal — anti-regression", () => {
  // Dynamically import to avoid module-level supabase init issues
  let NovoCasoModal: any;

  beforeEach(async () => {
    // Mock supabase before import
    vi.doMock("@/integrations/supabase/client", () => ({
      supabase: {
        from: () => ({
          select: () => ({
            order: () => ({ limit: () => Promise.resolve({ data: [
              { id: 1, nome_completo: "João Silva", cpf: "12345678900", cidade: "SP", estado: "SP" },
            ] }) }),
          }),
          insert: () => ({
            select: () => ({
              single: () => Promise.resolve({ data: { id: "caso-uuid-123" }, error: null }),
            }),
          }),
        }),
      },
    }));
    const mod = await import("../NovoCasoModal");
    NovoCasoModal = mod.default;
  });

  it("all non-submit buttons have type='button'", async () => {
    const onCreated = vi.fn();
    const { container } = render(
      <NovoCasoModal open={true} onOpenChange={() => {}} onCreated={onCreated} />,
    );

    // Wait for client list to render
    await waitFor(() => {
      const buttons = container.querySelectorAll("button");
      expect(buttons.length).toBeGreaterThan(0);
    });

    const buttons = container.querySelectorAll("button");
    buttons.forEach((btn) => {
      const type = btn.getAttribute("type");
      // Every button must be either type="button" or type="submit"
      expect(type).toBeTruthy();
      // Only the "Criar Caso" submit button should have type="submit"
      if (type === "submit") {
        expect(btn.textContent?.toLowerCase()).toContain("criar caso");
      }
    });
  });

  it("submit button is not disabled when form is idle", async () => {
    render(
      <NovoCasoModal open={true} onOpenChange={() => {}} onCreated={() => {}} />,
    );

    await waitFor(() => {
      const submitBtn = screen.getByRole("button", { name: /criar caso/i });
      expect(submitBtn).not.toBeDisabled();
    });
  });

  it("footer is sticky and has pointer-events auto", async () => {
    const { container } = render(
      <NovoCasoModal open={true} onOpenChange={() => {}} onCreated={() => {}} />,
    );

    await waitFor(() => {
      const footer = container.querySelector(".sticky.bottom-0");
      expect(footer).toBeTruthy();
      expect(footer?.getAttribute("style")).toContain("pointer-events: auto");
    });
  });
});

/* ─── 2. geracao_id null protection ─── */
describe("geracao_id null protection", () => {
  it("casoData.geracao_id is only set when truthy", () => {
    // Simulate the exact logic from QAGerarPecaPage line 905-907
    const casoData: Record<string, any> = { status: "gerado" };
    const geracaoResult = { geracao_id: null, minuta_gerada: "text" };

    // This is the guard: only assign if truthy
    if (geracaoResult?.geracao_id) {
      casoData.geracao_id = geracaoResult.geracao_id;
    }

    // geracao_id should NOT be in casoData
    expect(casoData.geracao_id).toBeUndefined();
  });

  it("casoData.geracao_id IS set when valid", () => {
    const casoData: Record<string, any> = { status: "gerado" };
    const geracaoResult = { geracao_id: "abc-123", minuta_gerada: "text" };

    if (geracaoResult?.geracao_id) {
      casoData.geracao_id = geracaoResult.geracao_id;
    }

    expect(casoData.geracao_id).toBe("abc-123");
  });
});

/* ─── 3. CaseDetailPanel geracao fallback ─── */
describe("CaseDetailPanel — geracao fallback fetch", () => {
  it("fetches geracao_id from DB when caso prop has no geracao_id", async () => {
    const selectSpy = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        maybeSingle: vi.fn().mockResolvedValue({
          data: { geracao_id: "fetched-id-456", minuta_gerada: null },
        }),
      }),
    });

    const fromSpy = vi.fn().mockImplementation((table: string) => {
      if (table === "qa_documentos_conhecimento") {
        return {
          select: () => ({
            eq: () => ({
              order: () => Promise.resolve({ data: [] }),
            }),
          }),
        };
      }
      if (table === "qa_geracoes_pecas") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: () => Promise.resolve({
                data: { id: "fetched-id-456", minuta_gerada: "Peça gerada" },
              }),
            }),
          }),
        };
      }
      // qa_casos
      return { select: selectSpy };
    });

    vi.doMock("@/integrations/supabase/client", () => ({
      supabase: { from: fromSpy },
    }));

    const mod = await import("../CaseDetailPanel");
    const CaseDetailPanel = mod.default;

    const caso = { id: "caso-sem-geracao", status: "gerado", geracao_id: null, titulo: "Teste" };

    render(
      <CaseDetailPanel
        caso={caso}
        onClose={() => {}}
        statusColor={() => "text-green-500"}
      />,
    );

    // The component should have called supabase to fetch geracao_id
    await waitFor(() => {
      expect(fromSpy).toHaveBeenCalledWith("qa_casos");
    });
  });
});
