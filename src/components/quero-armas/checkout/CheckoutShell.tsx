import { ReactNode, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Check, ShieldCheck, Headphones, LayoutDashboard, FileSignature, ListChecks, User } from "lucide-react";

/*
 * CheckoutShell — dark premium, vermelho bordô da empresa.
 * Paleta: fundo #050505, cards #171717, accent #c4253b (vermelho bordô iluminado).
 */

type Step = 1 | 2 | 3 | 4;

interface ServiceSummary {
  nome: string;
  descricao_curta: string | null;
  preco: number | null;
  recorrente: boolean;
  base_legal?: string | null;
}

interface CheckoutShellProps {
  step: Step;
  slug: string;
  backTo?: string;
  children: ReactNode;
  summary?: ServiceSummary | null;
  hideSidebar?: boolean;
}

const STEPS: Array<{ n: Step; label: string; short: string }> = [
  { n: 1, label: "Identificação", short: "Id." },
  { n: 2, label: "Dados",         short: "Dad." },
  { n: 3, label: "Confirmação",   short: "Conf." },
  { n: 4, label: "Pagamento",     short: "Pag." },
];

function formatBRL(v: number | null) {
  if (v == null) return null;
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}

const D = {
  bg: "#050505",
  paper: "#0A0A0A",
  paper2: "#141414",
  border: "#2A2A2A",
  borderSoft: "rgba(255,255,255,0.05)",
  ink: "#C7C7C7",
  inkSoft: "#C7C7C7",
  inkFaint: "#5C5C5C",
  /* monocromático editorial */
  red: "#C7C7C7",
  redDeep: "#8a8a8a",
  redAlpha: "rgba(199,199,199,0.08)",
  redAlphaStrong: "rgba(199,199,199,0.25)",
  redGlow: "rgba(199,199,199,0.20)",
  success: "#C7C7C7",
  successAlpha: "rgba(199,199,199,0.08)",
  successBorder: "rgba(199,199,199,0.30)",
};

export default function CheckoutShell({ step, slug, backTo = "/carrinho", children, summary, hideSidebar = false }: CheckoutShellProps) {
  const navigate = useNavigate();
  const [internal, setInternal] = useState<ServiceSummary | null>(summary ?? null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const pct = Math.round(((step - 1) / 3) * 100);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUserEmail(data.session?.user?.email ?? null);
    });
  }, []);

  useEffect(() => {
    if (summary) { setInternal(summary); return; }
    if (!slug) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("qa_servicos_catalogo" as any)
        .select("nome, descricao_curta, preco, recorrente, base_legal")
        .eq("slug", slug)
        .eq("ativo", true)
        .maybeSingle();
      if (!cancelled && data) setInternal(data as any);
    })();
    return () => { cancelled = true; };
  }, [slug, summary]);

  const preco = formatBRL(internal?.preco ?? null);
  const userInitials = userEmail ? userEmail.slice(0, 2).toUpperCase() : "?";
  const isEditorial = true;

  return (
    <div className="qa-checkout-shell" style={{ background: D.bg, minHeight: "100vh", color: D.ink, WebkitFontSmoothing: "antialiased" }}>

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <header style={{
        position: "sticky", top: 0, zIndex: 30,
        background: "rgba(5,5,5,0.94)", backdropFilter: "blur(10px)",
        borderBottom: `1px solid ${D.borderSoft}`,
      }}>
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
          maxWidth: 1100, margin: "0 auto", padding: "12px 20px",
        }}>
          {/* Left */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
            <button
              onClick={() => navigate(backTo)}
              style={{
                display: "inline-flex", alignItems: "center", gap: 5,
                fontSize: 11, color: D.inkFaint, textTransform: "uppercase",
                letterSpacing: "0.1em", background: "none", border: "none", cursor: "pointer",
                flexShrink: 0,
              }}
            >
              <ArrowLeft size={13} /> Voltar
            </button>
            <div style={{ width: 1, height: 14, background: D.border, flexShrink: 0 }} />
            <div style={{ display: "flex", alignItems: "center", gap: 7, minWidth: 0 }}>
              <div style={{ width: 18, height: 1, background: D.ink, flexShrink: 0 }} />
              <span className="qa-checkout-brand" style={{ fontFamily: "Oswald, sans-serif", fontSize: 10, fontWeight: 400, textTransform: "uppercase", letterSpacing: "0.32em", color: D.ink }}>
                Checkout Quero Armas
              </span>
            </div>
          </div>

          {/* Right — usuário logado */}
          {userEmail && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
              <span className="qa-checkout-email" style={{ fontSize: 10, color: D.inkFaint, letterSpacing: "0.04em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 180 }}>
                {userEmail}
              </span>
              <span style={{
                fontFamily: "Oswald, sans-serif",
                fontSize: 11, fontWeight: 500, letterSpacing: "0.24em",
                color: D.ink, textTransform: "uppercase",
              }}>
                {userInitials}
              </span>
            </div>
          )}
        </div>

        {/* Progress bar */}
        <div style={{ height: 1, background: D.border }}>
          <div style={{
            height: 1, width: `${pct}%`,
            background: D.ink,
            transition: "width .5s ease",
          }} />
        </div>
      </header>

      {/* ── Stepper ────────────────────────────────────────────────────── */}
      <div style={{ background: "rgba(10,10,10,0.9)", borderBottom: `1px solid ${D.border}`, padding: "14px 20px", overflowX: "auto" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 0, maxWidth: 760, minWidth: "fit-content" }}>
            {STEPS.map((s, idx) => {
              const done = s.n < step;
              const active = s.n === step;
              const isFuture = s.n > step;
              return (
                <div key={s.n} style={{ display: "flex", alignItems: "center" }}>
                  <div style={{
                    display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 6,
                    paddingBottom: 4,
                    borderBottom: done || active ? `1px solid ${D.ink}` : "1px solid transparent",
                    transition: "border-color .3s",
                  }}>
                    <span style={{
                      fontFamily: "Oswald, sans-serif",
                      fontSize: 18, fontWeight: 300, lineHeight: 1,
                      letterSpacing: "0.02em",
                      color: done || active ? D.ink : D.inkFaint,
                    }}>
                      {String(s.n).padStart(2, "0")}
                    </span>
                    <span className="qa-step-label" style={{
                      fontFamily: "Oswald, sans-serif",
                      fontSize: 10, fontWeight: 400, textTransform: "uppercase",
                      letterSpacing: "0.32em",
                      color: done || active ? D.ink : D.inkFaint,
                      whiteSpace: "nowrap",
                    }}>
                      {s.label}
                    </span>
                  </div>
                  {idx < STEPS.length - 1 && (
                    <span style={{
                      fontFamily: "Oswald, sans-serif",
                      fontSize: 14, fontWeight: 300,
                      color: D.inkFaint,
                      margin: "0 14px",
                      lineHeight: 1,
                    }}>·</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Body ───────────────────────────────────────────────────────── */}
      <main className="qa-checkout-main" style={{ maxWidth: 1200, margin: "0 auto", padding: "28px 32px" }}>
        {hideSidebar ? (
          /* Modo sem sidebar: usa a maior parte da largura disponível */
          <div className="qa-checkout-content" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {children}
          </div>
        ) : (
          <div className="qa-checkout-grid" style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 28, alignItems: "start" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>{children}</div>

            {/* Sidebar */}
            <aside style={{ position: "sticky", top: 80 }}>
              <div style={{ background: D.paper, border: `1px solid ${D.border}`, borderRadius: 14, overflow: "hidden", marginBottom: 12 }}>
                <div style={{ height: "2px", background: `linear-gradient(to right, ${D.red}, ${D.redDeep})`, boxShadow: `0 0 12px ${D.redGlow}` }} />
                <div style={{ padding: "14px 16px" }}>
                  <div style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.14em", color: D.inkFaint, marginBottom: 6 }}>Serviço contratado</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: D.ink, textTransform: "uppercase", lineHeight: 1.3, marginBottom: 6 }}>{internal?.nome || "—"}</div>
                  {internal?.descricao_curta && (
                    <p style={{ fontSize: 11, color: D.inkSoft, lineHeight: 1.6, margin: 0 }}>{internal.descricao_curta}</p>
                  )}
                  <div style={{ borderTop: `1px solid ${D.borderSoft}`, margin: "14px 0" }} />
                  <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
                    <div>
                      <div style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.12em", color: D.inkFaint, marginBottom: 4 }}>Total</div>
                      <div style={{ fontSize: 22, fontWeight: 700, color: D.ink }}>{preco ?? "A combinar"}</div>
                    </div>
                    <span style={{
                      fontSize: 9, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em",
                      color: D.success, background: D.successAlpha, border: `1px solid ${D.successBorder}`,
                      borderRadius: 99, padding: "3px 10px",
                    }}>
                      Seguro
                    </span>
                  </div>
                </div>
              </div>

              <div style={{ background: D.paper, border: `1px solid ${D.border}`, borderRadius: 14, overflow: "hidden" }}>
                <div style={{ padding: "10px 16px", borderBottom: `1px solid ${D.borderSoft}` }}>
                  <span style={{ fontSize: 9, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.12em", color: D.inkFaint }}>Incluso no serviço</span>
                </div>
                <div style={{ padding: "12px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
                  {[
                    { Icon: ShieldCheck, label: "Pagamento seguro" },
                    { Icon: Headphones, label: "Atendimento especializado" },
                    { Icon: LayoutDashboard, label: "Portal do cliente incluso" },
                    { Icon: FileSignature, label: "Contrato após confirmação" },
                    { Icon: ListChecks, label: "Checklist documental orientado" },
                  ].map(({ Icon, label }) => (
                    <div key={label} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{ width: 24, height: 24, borderRadius: 7, background: D.redAlpha, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <Icon size={13} color={D.red} />
                      </div>
                      <span style={{ fontSize: 11, color: D.inkSoft }}>{label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </aside>
          </div>
        )}
      </main>

      <style>{`
        /* ── Modo sem sidebar: ocupa toda a largura útil ────────────── */
        .qa-checkout-content {
          width: 100%;
          max-width: 100%;
          box-sizing: border-box;
        }

        /* ── Tablet (<= 1024px): colapsa grid, oculta sidebar ───────── */
        @media (max-width: 1024px) {
          .qa-checkout-grid {
            grid-template-columns: 1fr !important;
          }
          .qa-checkout-grid aside {
            display: none !important;
          }
          .qa-checkout-main {
            padding: 20px 24px !important;
          }
        }

        /* ── Mobile (<= 640px): padding menor, texto menor ──────────── */
        @media (max-width: 640px) {
          .qa-checkout-brand { display: none !important; }
          .qa-checkout-email { display: none !important; }
          .qa-checkout-main  { padding: 14px 12px !important; }
          .qa-step-label     { font-size: 9px !important; }
        }

        /* ── Mobile pequeno (<= 400px): só números no stepper ────────── */
        @media (max-width: 400px) {
          .qa-step-label { display: none !important; }
        }
      `}</style>
    </div>
  );
}
