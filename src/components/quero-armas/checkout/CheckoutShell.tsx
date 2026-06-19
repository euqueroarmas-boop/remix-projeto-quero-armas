import { ReactNode, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Check, Sparkles, ShieldCheck, Headphones, LayoutDashboard, FileSignature, ListChecks } from "lucide-react";

/*
 * CheckoutShell — dark brass premium.
 * Paleta: fundo #050505, cards #171717, accent #d6a64b (brass).
 * Alinhado visualmente com o checkout guiado (/cadastro).
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
  /** Oculta o painel lateral de resumo (use quando o conteúdo já inclui o valor inline) */
  hideSidebar?: boolean;
}

const STEPS: Array<{ n: Step; label: string }> = [
  { n: 1, label: "Identificação" },
  { n: 2, label: "Dados" },
  { n: 3, label: "Confirmação" },
  { n: 4, label: "Pagamento" },
];

function formatBRL(v: number | null) {
  if (v == null) return null;
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}

const D = {
  bg: "#050505",
  paper: "#171717",
  paper2: "#111111",
  border: "rgba(255,255,255,0.08)",
  borderSoft: "rgba(255,255,255,0.05)",
  ink: "#f8f5ef",
  inkSoft: "#b9b2a7",
  inkFaint: "#4a4540",
  brass: "#d6a64b",
  brassAlpha: "rgba(214,166,75,0.12)",
  brassAlphaStrong: "rgba(214,166,75,0.3)",
  success: "#7fbf6a",
  successAlpha: "rgba(127,191,106,0.1)",
};

export default function CheckoutShell({ step, slug, backTo = "/carrinho", children, summary, hideSidebar = false }: CheckoutShellProps) {
  const navigate = useNavigate();
  const [internal, setInternal] = useState<ServiceSummary | null>(summary ?? null);
  const pct = Math.round(((step - 1) / 3) * 100);

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

  return (
    <div style={{ background: D.bg, minHeight: "100vh", color: D.ink, fontFamily: "var(--font-sans)", WebkitFontSmoothing: "antialiased" }}>

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <header style={{ position: "sticky", top: 0, zIndex: 30, background: "rgba(5,5,5,0.92)", backdropFilter: "blur(8px)", borderBottom: `1px solid ${D.borderSoft}` }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, maxWidth: 1100, margin: "0 auto", padding: "13px 24px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button
              onClick={() => navigate(backTo)}
              style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, color: D.inkFaint, textTransform: "uppercase", letterSpacing: "0.1em", background: "none", border: "none", cursor: "pointer" }}
            >
              <ArrowLeft size={13} /> Voltar
            </button>
            <div style={{ width: 1, height: 14, background: D.border }} />
            <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: D.brass }} />
              <span style={{ fontSize: 10, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.12em", color: D.brass }}>
                Checkout Quero Armas
              </span>
            </div>
          </div>
          {internal?.nome && (
            <span style={{ fontSize: 10, color: D.inkFaint, textTransform: "uppercase", letterSpacing: "0.08em", maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {internal.nome}
            </span>
          )}
        </div>
        {/* Progress bar */}
        <div style={{ height: 2, background: D.borderSoft }}>
          <div style={{ height: 2, width: `${pct}%`, background: D.brass, transition: "width .4s ease" }} />
        </div>
      </header>

      {/* ── Stepper ────────────────────────────────────────────────────── */}
      <div style={{ background: "rgba(12,12,12,0.8)", borderBottom: `1px solid ${D.borderSoft}`, padding: "10px 24px" }}>
        <ol style={{ display: "flex", alignItems: "center", gap: 0, maxWidth: 560, listStyle: "none" }}>
          {STEPS.map((s, idx) => {
            const done = s.n < step;
            const active = s.n === step;
            return (
              <li key={s.n} style={{ display: "flex", alignItems: "center", flex: idx < STEPS.length - 1 ? 1 : "none" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                  <div style={{
                    width: 22, height: 22, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 10, fontWeight: 700,
                    background: done ? D.brass : "transparent",
                    border: done ? `1.5px solid ${D.brass}` : active ? `1.5px solid ${D.brass}` : `1px solid ${D.border}`,
                    color: done ? D.bg : active ? D.brass : D.inkFaint,
                  }}>
                    {done ? <Check size={11} /> : s.n}
                  </div>
                  <span style={{
                    fontSize: 9.5, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.08em",
                    color: done || active ? D.brass : D.inkFaint,
                  }}>
                    {s.n}. {s.label}
                  </span>
                </div>
                {idx < STEPS.length - 1 && (
                  <div style={{ flex: 1, height: 1, margin: "0 8px", background: done ? `rgba(214,166,75,0.35)` : D.border }} />
                )}
              </li>
            );
          })}
        </ol>
      </div>

      {/* ── Body ───────────────────────────────────────────────────────── */}
      <main style={{ maxWidth: 1100, margin: "0 auto", padding: "20px 24px" }}>
        {hideSidebar ? (
          <div style={{ maxWidth: 620, margin: "0 auto", display: "flex", flexDirection: "column", gap: 10 }}>
            {children}
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: 20, alignItems: "start" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>{children}</div>

            {/* Sidebar */}
            <aside style={{ position: "sticky", top: 80 }}>
              <div style={{ background: D.paper, border: `1px solid ${D.border}`, borderRadius: 14, overflow: "hidden", marginBottom: 10 }}>
                <div style={{ height: "1.5px", background: `linear-gradient(to right, ${D.brass}, #7A1F2B)` }} />
                <div style={{ padding: "12px 14px" }}>
                  <div style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.12em", color: D.inkFaint, marginBottom: 4 }}>Serviço contratado</div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: D.ink, textTransform: "uppercase", lineHeight: 1.2, marginBottom: 4 }}>{internal?.nome || "—"}</div>
                  {internal?.descricao_curta && (
                    <p style={{ fontSize: 11, color: D.inkSoft, lineHeight: 1.5, margin: 0 }}>{internal.descricao_curta}</p>
                  )}
                  <div style={{ borderTop: `1px solid ${D.borderSoft}`, margin: "12px 0" }} />
                  <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
                    <div>
                      <div style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.12em", color: D.inkFaint, marginBottom: 3 }}>Total</div>
                      <div style={{ fontSize: 20, fontWeight: 500, color: D.ink }}>{preco ?? "A combinar"}</div>
                    </div>
                    <span style={{ fontSize: 9, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.06em", color: D.success, background: D.successAlpha, border: `1px solid rgba(127,191,106,0.25)`, borderRadius: 99, padding: "2px 9px", display: "flex", alignItems: "center", gap: 4 }}>
                      Seguro
                    </span>
                  </div>
                  <div style={{ marginTop: 10, background: D.paper2, border: `1px solid ${D.borderSoft}`, borderRadius: 8, padding: "8px 10px", fontSize: 10, color: D.inkFaint, lineHeight: 1.5 }}>
                    Processo iniciado após confirmação do pagamento. Acompanhe tudo pelo portal.
                  </div>
                </div>
              </div>

              {/* Trust strip */}
              <div style={{ background: D.paper, border: `1px solid ${D.border}`, borderRadius: 14, overflow: "hidden" }}>
                <div style={{ padding: "8px 14px", borderBottom: `1px solid ${D.borderSoft}` }}>
                  <span style={{ fontSize: 9, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.12em", color: D.inkFaint }}>O que está incluso</span>
                </div>
                <div style={{ padding: "10px 14px", display: "flex", flexDirection: "column", gap: 8 }}>
                  {[
                    { Icon: ShieldCheck, label: "Pagamento seguro" },
                    { Icon: Headphones, label: "Atendimento especializado" },
                    { Icon: LayoutDashboard, label: "Portal do cliente incluso" },
                    { Icon: FileSignature, label: "Contrato após confirmação" },
                    { Icon: ListChecks, label: "Checklist documental orientado" },
                  ].map(({ Icon, label }) => (
                    <div key={label} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ width: 22, height: 22, borderRadius: 6, background: D.brassAlpha, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <Icon size={12} color={D.brass} />
                      </div>
                      <span style={{ fontSize: 10, color: D.inkSoft }}>{label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </aside>
          </div>
        )}
      </main>
    </div>
  );
}
