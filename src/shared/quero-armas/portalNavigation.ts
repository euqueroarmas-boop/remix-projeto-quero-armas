const CLIENT_PORTAL_HOME = "/area-do-cliente";

export function sanitizeClientPortalNext(raw: string | null | undefined): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return CLIENT_PORTAL_HOME;

  try {
    const url = new URL(raw, "https://portal.local");
    if (url.pathname === "/area-do-cliente/pendencias") return CLIENT_PORTAL_HOME;
    if (url.pathname === CLIENT_PORTAL_HOME && url.searchParams.get("secao") === "pendencias") {
      return CLIENT_PORTAL_HOME;
    }
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return CLIENT_PORTAL_HOME;
  }
}
