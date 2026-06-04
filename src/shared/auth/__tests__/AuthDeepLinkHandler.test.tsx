import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { AuthDeepLinkHandler } from "../AuthDeepLinkHandler";

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location">{location.pathname}{location.search}{location.hash}</div>;
}

function renderWithRoute(initialEntry: string) {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <AuthDeepLinkHandler />
      <Routes>
        <Route path="*" element={<LocationProbe />} />
      </Routes>
    </MemoryRouter>
  );
}

describe("AuthDeepLinkHandler", () => {
  it("preserva code PKCE e redireciona recovery que cairia na home para /redefinir-senha", async () => {
    renderWithRoute("/?code=abc123&type=recovery");

    await waitFor(() => {
      expect(screen.getByTestId("location")).toHaveTextContent("/redefinir-senha?code=abc123&type=recovery");
    });
  });

  it("preserva hash legacy de recovery para o modal/tela de redefinição", async () => {
    renderWithRoute("/#access_token=access-1&refresh_token=refresh-1&type=recovery");

    await waitFor(() => {
      expect(screen.getByTestId("location").textContent).toBe(
        "/redefinir-senha#access_token=access-1&refresh_token=refresh-1&type=recovery"
      );
    });
  });

  it("encaminha erro de recovery para /redefinir-senha sem deixar a home engolir o fluxo", async () => {
    renderWithRoute("/?type=recovery&error=access_denied&error_description=Link%20expirado");

    await waitFor(() => {
      expect(screen.getByTestId("location")).toHaveTextContent(
        "/redefinir-senha?type=recovery&error=access_denied&error_description=Link+expirado"
      );
    });
  });
});