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
  paper: "#171717",
  paper2: "#111111",
  border: "rgba(255,255,255,0.09)",
  borderSoft: "rgba(255,255,255,0.05)",
  ink: "#f0ece5",
  inkSoft: "#ccc5b9",
  inkFaint: "#6b6560",
  /* vermelho bordô — cor da empresa */
  red: "#c4253b",
  redDeep: "#7A1F2B",
  redAlpha: "rgba(196,37,59,0.12)",
  redAlphaStrong: "rgba(196,37,59,0.30)",
  redGlow: "rgba(196,37,59,0.40)",
  success: "#7fbf6a",
  successAlpha: "rgba(127,191,106,0.1)",
  successBorder: "rgba(127,191,106,0.25)",
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
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: D.red, boxShadow: `0 0 8px ${D.redGlow}`, flexShrink: 0 }} />
              <span className="qa-checkout-brand" style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.14em", color: D.red }}>
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
              <div style={{
                width: 28, height: 28, borderRadius: "50%", flexShrink: 0,
                background: `linear-gradient(135deg, ${D.red} 0%, ${D.redDeep} 100%)`,
                border: `1.5px solid ${D.redAlphaStrong}`,
                boxShadow: `0 0 10px ${D.redAlpha}`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 10, fontWeight: 800, color: "#fff",
              }}>
                {userInitials}
              </div>
            </div>
          )}
        </div>

        {/* Progress bar */}
        <div style={{ height: 2, background: D.borderSoft }}>
          <div style={{
            height: 2, width: `${pct}%`,
            background: `linear-gradient(to right, ${D.red}, ${D.redDeep})`,
            boxShadow: `0 0 8px ${D.redGlow}`,
            transition: "width .5s ease",
          }} />
        </div>
      </header>

      {/* ── Stepper ────────────────────────────────────────────────────── */}
      <div style={{ background: "rgba(10,10,10,0.9)", borderBottom: `1px solid ${D.borderSoft}`, padding: "14px 20px", overflowX: "auto" }}>
        <ol style={{ display: "flex", alignItems: "center", gap: 0, maxWidth: 620, listStyle: "none", margin: 0, padding: 0, minWidth: "fit-content" }}>
          {STEPS.map((s, idx) => {
            const done = s.n < step;
            const active = s.n === step;
            return (
              <li key={s.n} style={{ display: "flex", alignItems: "center", flex: idx < STEPS.length - 1 ? 1 : "none" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0, padding: "2px 0" }}>
                  {/* Circle */}
                  <div style={{
                    width: 28, height: 28, borderRadius: "50%", flexShrink: 0,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 11, fontWeight: 800,
                    background: done ? D.red : "transparent",
                    border: done
                      ? `2px solid ${D.red}`
                      : active
                      ? `2px solid ${D.red}`
                      : `1.5px solid ${D.border}`,
                    color: done ? "#fff" : active ? D.red : D.inkFaint,
                    boxShadow: (done || active) ? `0 0 10px ${D.redAlpha}` : "none",
                    transition: "all .3s",
                  }}>
                    {done ? <Check size={13} /> : s.n}
                  </div>
                  {/* Label */}
                  <span className="qa-step-label" style={{
                    fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em",
                    color: done || active ? D.red : D.inkFaint,
                    whiteSpace: "nowrap",
                  }}>
                    {s.label}
                  </span>
                </div>
                {/* Connector */}
                {idx < STEPS.length - 1 && (
                  <div style={{
                    flex: 1, height: 1.5, margin: "0 10px",
                    background: done ? `rgba(196,37,59,0.40)` : D.border,
                    borderRadius: 1,
                  }} />
                )}
              </li>
            );
          })}
        </ol>
      </div>

      {/* ── Body ───────────────────────────────────────────────────────── */}
      <main style={{ maxWidth: 1100, margin: "0 auto", padding: "24px 20px" }}>
        {hideSidebar ? (
          <div className="qa-checkout-content" style={{ maxWidth: 640, margin: "0 auto", display: "flex", flexDirection: "column", gap: 12 }}>
            {children}
          </div>
        ) : (
          <div className="qa-checkout-grid" style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: 24, alignItems: "start" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>{children}</div>

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
        @media (max-width: 640px) {
          .qa-checkout-brand { display: none !important; }
          .qa-checkout-email { display: none !important; }
          .qa-checkout-grid { grid-template-columns: 1fr !important; }
          .qa-checkout-content { padding: 0 !important; }
          .qa-checkout-shell main { padding: 16px 12px !important; }
          .qa-step-label { font-size: 9px !important; }
        }
        @media (max-width: 400px) {
          .qa-step-label { display: none !important; }
        }
      `}</style>
    </div>
  );
}
