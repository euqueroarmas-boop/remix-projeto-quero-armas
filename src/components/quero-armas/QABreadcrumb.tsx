/**
 * QABreadcrumb — Breadcrumb fixo no topo das páginas internas do Quero Armas.
 * Gera automaticamente a trilha a partir da URL atual e oferece "Dashboard" clicável.
 * Não aparece na própria rota /dashboard (evita redundância).
 */
import { Link, useLocation } from "react-router-dom";
import { ChevronLeft, ChevronRight } from "lucide-react";

const LABELS: Record<string, string> = {
  dashboard: "Dashboard",
  ia: "Assistente IA",
  "base-conhecimento": "Base Jurídica",
  legislacao: "Legislação",
  jurisprudencia: "Jurisprudência",
  "modelos-docx": "Modelos DOCX",
  "gerar-peca": "Gerar Peça",
  casos: "Casos",
  historico: "Histórico",
  configuracoes: "Configurações",
  clientes: "Clientes",
  clubes: "Clubes de Tiro",
  financeiro: "Financeiro",
  relatorios: "Relatórios",
  auditoria: "Auditoria",
  "recursos-administrativos": "Recursos Administrativos",
};

const labelOf = (slug: string) =>
  LABELS[slug] ||
  slug
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());

export function QABreadcrumb() {
  const location = useLocation();
  const parts = location.pathname.split("/").filter(Boolean); // ex: ["quero-armas", "auditoria", "recursos-administrativos"]

  // Esconde no dashboard (raiz) e em rotas fora do módulo
  if (parts[0] !== "quero-armas") return null;
  const inner = parts.slice(1);
  if (inner.length === 0 || (inner.length === 1 && inner[0] === "dashboard")) return null;

  // Trilha (sem incluir "dashboard" pois já é o link inicial)
  const crumbs = inner.filter((p) => p !== "dashboard");

  return (
    <nav
      aria-label="Navegação"
      className="bg-white border-b px-4 md:px-6 py-2.5 flex items-center gap-2 text-xs sticky top-0 z-20"
      style={{ borderColor: "hsl(220 13% 91%)" }}
    >
      <Link
        to="/dashboard"
        className="flex items-center gap-1.5 font-semibold uppercase tracking-wider transition-colors"
        style={{ color: "hsl(220 20% 18%)" }}
        onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = "hsl(230 80% 56%)")}
        onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = "hsl(220 20% 18%)")}
      >
        <ChevronLeft className="h-3.5 w-3.5" />
        <span>Dashboard</span>
      </Link>
      {crumbs.map((slug, i) => {
        const isLast = i === crumbs.length - 1;
        const href = "/" + crumbs.slice(0, i + 1).join("/");
        return (
          <span key={href} className="flex items-center gap-2">
            <ChevronRight className="h-3 w-3" style={{ color: "hsl(220 13% 80%)" }} />
            {isLast ? (
              <span className="uppercase tracking-wider font-medium" style={{ color: "hsl(220 20% 18%)" }}>
                {labelOf(slug)}
              </span>
            ) : (
              <Link
                to={href}
                className="uppercase tracking-wider transition-colors"
                style={{ color: "hsl(220 10% 52%)" }}
                onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = "hsl(230 80% 56%)")}
                onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = "hsl(220 10% 52%)")}
              >
                {labelOf(slug)}
              </Link>
            )}
          </span>
        );
      })}
    </nav>
  );
}
