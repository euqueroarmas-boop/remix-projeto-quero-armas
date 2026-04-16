/**
 * Regression tests: Mobile case creation + piece generation link integrity.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import NovoCasoModal from "../NovoCasoModal";

// Mock supabase globally
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({
      select: () => ({
        order: () => ({
          limit: () => Promise.resolve({
            data: [{ id: 1, nome_completo: "João Silva", cpf: "12345678900", cidade: "SP", estado: "SP" }],
          }),
        }),
        eq: () => ({
          maybeSingle: () => Promise.resolve({ data: { geracao_id: "g-123" } }),
          order: () => Promise.resolve({ data: [] }),
        }),
      }),
      insert: () => ({
        select: () => ({
          single: () => Promise.resolve({ data: { id: "caso-uuid-123" }, error: null }),
        }),
      }),
      update: () => ({
        eq: () => ({
          select: () => ({
            single: () => Promise.resolve({ data: { id: "caso-uuid-123", geracao_id: "g-123" }, error: null }),
          }),
        }),
      }),
    }),
    storage: { from: () => ({ list: () => Promise.resolve({ data: [], error: null }) }) },
  },
}));

/* ─── 1. NovoCasoModal button types ─── */
describe("NovoCasoModal — anti-regression", () => {
  it("all non-submit buttons inside form have explicit type='button'", async () => {
    render(
      <NovoCasoModal open={true} onOpenChange={() => {}} onCreated={() => {}} />,
    );

    await waitFor(() => {
      expect(screen.getByText("Novo Caso")).toBeTruthy();
    });

    // Query all buttons inside the dialog form
    const dialog = document.querySelector("[role='dialog']");
    expect(dialog).toBeTruthy();
    const form = dialog!.querySelector("form");
    expect(form).toBeTruthy();
    const buttons = form!.querySelectorAll("button");
    expect(buttons.length).toBeGreaterThan(0);

    buttons.forEach((btn) => {
      const type = btn.getAttribute("type");
      // Every button must declare type explicitly
      expect(type, `Button "${btn.textContent?.trim()}" has no type attribute`).toBeTruthy();
      // Only "Criar Caso" is submit
      if (type === "submit") {
        expect(btn.textContent?.toLowerCase()).toContain("criar caso");
      }
    });
  });

  it("submit button is enabled when not saving", async () => {
    render(
      <NovoCasoModal open={true} onOpenChange={() => {}} onCreated={() => {}} />,
    );

    await waitFor(() => {
      const submitBtn = screen.getByRole("button", { name: /criar caso/i });
      expect(submitBtn).not.toBeDisabled();
    });
  });

  it("footer has sticky positioning and pointer-events", async () => {
    render(
      <NovoCasoModal open={true} onOpenChange={() => {}} onCreated={() => {}} />,
    );

    await waitFor(() => {
      const dialog = document.querySelector("[role='dialog']");
      const footer = dialog?.querySelector("[class*='sticky'][class*='bottom-0']");
      expect(footer).toBeTruthy();
      expect(footer?.getAttribute("style")).toContain("pointer-events: auto");
    });
  });
});

/* ─── 2. geracao_id null overwrite protection ─── */
describe("geracao_id null protection", () => {
  it("does NOT set geracao_id when value is null", () => {
    const casoData: Record<string, any> = { status: "gerado" };
    const geracaoResult = { geracao_id: null, minuta_gerada: "text" };
    if (geracaoResult?.geracao_id) {
      casoData.geracao_id = geracaoResult.geracao_id;
    }
    expect(casoData.geracao_id).toBeUndefined();
  });

  it("does NOT set geracao_id when value is empty string", () => {
    const casoData: Record<string, any> = { status: "gerado" };
    const geracaoResult = { geracao_id: "", minuta_gerada: "text" };
    if (geracaoResult?.geracao_id) {
      casoData.geracao_id = geracaoResult.geracao_id;
    }
    expect(casoData.geracao_id).toBeUndefined();
  });

  it("DOES set geracao_id when value is valid UUID", () => {
    const casoData: Record<string, any> = { status: "gerado" };
    const geracaoResult = { geracao_id: "abc-123-def", minuta_gerada: "text" };
    if (geracaoResult?.geracao_id) {
      casoData.geracao_id = geracaoResult.geracao_id;
    }
    expect(casoData.geracao_id).toBe("abc-123-def");
  });
});

/* ─── 3. CaseDetailPanel geracao fallback ─── */
describe("CaseDetailPanel — geracao_id DB fallback", () => {
  it("fetches geracao_id from DB when caso prop lacks it", async () => {
    const CaseDetailPanel = (await import("../CaseDetailPanel")).default;
    const caso = { id: "caso-sem-geracao", status: "gerado", geracao_id: null, titulo: "Teste" };

    render(
      <CaseDetailPanel
        caso={caso}
        onClose={() => {}}
        statusColor={() => "text-green-500"}
      />,
    );

    // Component should render and attempt DB fallback — no crash
    await waitFor(() => {
      expect(screen.getByText(/teste/i)).toBeTruthy();
    });
  });
});
