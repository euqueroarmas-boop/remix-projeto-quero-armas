import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useCart } from "@/shared/cart/CartProvider";
import {
  ArrowLeft,
  CheckCircle2,
  Sparkles,
  ShieldCheck,
  CreditCard,
  FileSignature,
  LayoutDashboard,
  ListChecks,
  Rocket,
  MessageCircle,
  Loader2,
  AlertCircle,
} from "lucide-react";
import "@/pages/quero-armas/cadastro-refinado/styles/cadastroRefinado.css";
import { KanbanTag, KanbanCard } from "@/components/quero-armas/contratar/KanbanUI";

/**
 * BLOCO 9 — Tela premium pós-contratação.
 * Mostra:
 *  - Confirmação cinematográfica
 *  - Timeline da jornada (7 etapas)
 *  - Próximas ações
 *  - CTAs (catálogo, WhatsApp, portal)
 *  - Status operacional real (qa_vendas.status) quando ?venda=<id>
 *
 * NÃO cria nova arquitetura, NÃO altera CartProvider/catálogo/financeiro.
 * Visual dark premium (.qa-refinado) + linguagem de cards de
 * ResumoClienteKanbanMockPage, consistente com o restante do fluxo
 * "Contratar serviço".
 */

const WHATSAPP =
  "https://wa.me/5562994040220?text=" +
  encodeURIComponent(
    "Olá, acabei de contratar um serviço na Quero Armas e gostaria de acompanhar.",
  );

interface Catalogo {
  nome: string;
  descricao_curta: string | null;
  preco: number | null;
  recorrente: boolean;
}

interface Venda {
  id: number;
  status: string | null;
  status_validacao_valor: string | null;
  valor_aprovado: number | null;
  data_cadastro: string | null;
}

function formatBRL(v: number | null) {
  if (v == null) return null;
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}

const TIMELINE = [
  { Icon: CheckCircle2, label: "Contratação recebida" },
  { Icon: ShieldCheck, label: "Validação pela Equipe Quero Armas" },
  { Icon: CreditCard, label: "Liberação da cobrança" },
  { Icon: Sparkles, label: "Confirmação do pagamento" },
  { Icon: FileSignature, label: "Contrato digital" },
  { Icon: ListChecks, label: "Portal + checklist + documentos" },
  { Icon: Rocket, label: "Início do processo" },
];

/**
 * Mapeia (qa_vendas.status + status_validacao_valor) — valores reais do
 * banco — para a etapa visual da timeline (1..7).
 *  - INSERT inicial: status="À INICIAR", validacao="aguardando_validacao"  → 1
 *  - Admin valida valor:                  validacao="aprovado"             → 3 (cobrança liberada)
 *  - Pagamento confirmado: status="PAGO"                                   → 4
 *  - Pasta em montagem: "MONTANDO PASTA" / "AGUARDANDO DOCUMENTAÇÃO"      → 6
 *  - Concluído                                                             → 7
 */
function statusToStep(s: string | null | undefined, v: string | null | undefined): number {
  const st = (s || "").toUpperCase().trim();
  const vv = (v || "").toLowerCase().trim();
  if (st === "CONCLUÍDO" || st === "CONCLUIDO" || st === "DEFERIDO") return 7;
  if (
    st === "MONTANDO PASTA" ||
    st.startsWith("AGUARDANDO DOCUMENTA") ||
    st === "EM ANÁLISE" ||
    st === "EM ANALISE" ||
    st.startsWith("PRONTO PARA AN") ||
    st === "RECURSO ADMINISTRATIVO"
  ) return 6;
  if (st === "PAGO") return 4;
  if (vv === "aprovado") return 3;
  if (vv === "corrigido" || vv === "reprovado") return 2;
  return 1;
}

function statusBadge(s: string | null | undefined, v: string | null | undefined): { label: string; tone: "ok" | "accent" | "danger" | "default" } {
  const st = (s || "").toUpperCase().trim();
  const vv = (v || "").toLowerCase().trim();
  if (st === "PAGO") return { label: "PAGAMENTO CONFIRMADO", tone: "ok" };
  if (vv === "aprovado") return { label: "PENDENTE DE PAGAMENTO", tone: "accent" };
  if (vv === "reprovado") return { label: "VALOR REPROVADO — REVISÃO", tone: "danger" };
  if (vv === "corrigido") return { label: "VALOR EM REVISÃO", tone: "accent" };
  return { label: "AGUARDANDO VALIDAÇÃO", tone: "default" };
}

export default function QAContratarSucessoPage() {
  const navigate = useNavigate();
  const { slug = "" } = useParams();
  const [search] = useSearchParams();
  const vendaId = search.get("venda");
  const cart = useCart();

  const [loading, setLoading] = useState(true);
  const [catalogo, setCatalogo] = useState<Catalogo | null>(null);
  const [venda, setVenda] = useState<Venda | null>(null);
  const [hasPortal, setHasPortal] = useState(false);

  useEffect(() => {
    // Limpa o carrinho — pedido já foi enviado.
    if (cart.items.length > 0) cart.clear();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        const { data: cat } = await supabase
          .from("qa_servicos_catalogo" as any)
          .select("nome, descricao_curta, preco, recorrente")
          .eq("slug", slug)
          .maybeSingle();
        if (!cancel && cat) setCatalogo(cat as any);

        if (vendaId) {
          const { data: v } = await supabase
            .from("qa_vendas" as any)
            .select("id, status, status_validacao_valor, valor_aprovado, data_cadastro")
            .eq("id", Number(vendaId))
            .maybeSingle();
          if (!cancel && v) setVenda(v as any);
        }

        const { data: sess } = await supabase.auth.getSession();
        if (!cancel && sess.session) setHasPortal(true);
      } finally {
        if (!cancel) setLoading(false);
      }
    })();
    return () => {
      cancel = true;
    };
  }, [slug, vendaId]);

  const currentStep = useMemo(
    () => statusToStep(venda?.status, venda?.status_validacao_valor),
    [venda?.status, venda?.status_validacao_valor],
  );
  const badge = useMemo(
    () => statusBadge(venda?.status, venda?.status_validacao_valor),
    [venda?.status, venda?.status_validacao_valor],
  );
  const preco = formatBRL(venda?.valor_aprovado ?? catalogo?.preco ?? null);

  const proximasAcoes = [
    { Icon: ShieldCheck, title: "Validação dos dados", desc: "Nossa equipe revisará suas informações e o serviço contratado." },
    { Icon: CreditCard, title: "Liberação da cobrança", desc: "Após validação, você poderá receber uma cobrança autorizada pela equipe." },
    { Icon: LayoutDashboard, title: "Acesso ao portal", desc: "Após o pagamento, seu portal do cliente será liberado com o checklist." },
    { Icon: FileSignature, title: "Contrato digital", desc: "Seu contrato será disponibilizado para assinatura no portal." },
    { Icon: Rocket, title: "Início do processo", desc: "Iniciamos o atendimento conforme as etapas do serviço contratado." },
  ];

  return (
    <div className="qa-refinado" style={{ minHeight: "100vh", background: "var(--qa-ref-bg)" }}>
      {/* HERO */}
      <header style={{ borderBottom: "0.5px solid var(--qa-ref-border-soft)", padding: "0 20px" }}>
        <div style={{ maxWidth: 900, margin: "0 auto", padding: "24px 0 36px", paddingTop: "max(env(safe-area-inset-top), 24px)" }}>
          <button
            onClick={() => navigate("/servicos")}
            style={{
              display: "inline-flex", alignItems: "center", gap: 8, fontSize: 11, textTransform: "uppercase",
              letterSpacing: "0.1em", color: "var(--qa-ref-ink-soft)", background: "none", border: "none",
              cursor: "pointer", marginBottom: 16, padding: 0,
            }}
          >
            <ArrowLeft size={14} /> Voltar ao catálogo
          </button>

          <KanbanTag tone="ok">
            <CheckCircle2 size={11} style={{ display: "inline", marginRight: 4, verticalAlign: -1 }} /> Recebido com sucesso
          </KanbanTag>

          <h1 style={{
            fontSize: 28, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.01em", lineHeight: 1.1,
            color: "var(--qa-ref-ink)", margin: "14px 0 8px", fontFamily: "var(--font-serif, Georgia, serif)",
          }}>
            Contratação recebida
          </h1>
          <p style={{ fontSize: 13, color: "var(--qa-ref-ink-soft)", maxWidth: 560, lineHeight: 1.6, margin: 0 }}>
            Sua solicitação foi registrada com sucesso pela Equipe Quero Armas.
          </p>
          <p style={{ fontSize: 12, color: "var(--qa-ref-ink-soft)", maxWidth: 560, lineHeight: 1.6, marginTop: 8 }}>
            Agora nossa equipe validará sua contratação e dará sequência ao fluxo
            adequado conforme o serviço contratado.
          </p>

          <div style={{
            marginTop: 16, maxWidth: 560, display: "flex", alignItems: "flex-start", gap: 8,
            borderRadius: 10, border: "1px solid var(--qa-ref-accent-strong)", background: "var(--qa-ref-accent-soft)",
            padding: "10px 12px", fontSize: 12, color: "var(--qa-ref-accent)",
          }}>
            <AlertCircle size={15} style={{ marginTop: 1, flexShrink: 0 }} />
            <p style={{ margin: 0 }}>
              Nenhuma cobrança automática foi gerada neste momento. A Equipe Quero
              Armas validará os dados antes da continuidade.
            </p>
          </div>

          <div style={{ marginTop: 20, display: "grid", gridTemplateColumns: "1fr auto", gap: 12 }}>
            <KanbanCard>
              <KanbanTag tone="accent">Serviço contratado</KanbanTag>
              <div style={{ fontSize: 14, fontWeight: 800, textTransform: "uppercase", color: "var(--qa-ref-ink)", marginTop: 6 }}>
                {loading ? "Carregando…" : catalogo?.nome || slug.toUpperCase()}
              </div>
              <div style={{ display: "flex", gap: 14, marginTop: 6, fontSize: 11, color: "var(--qa-ref-ink-soft)", flexWrap: "wrap" }}>
                {preco && (
                  <span>
                    Valor: <strong style={{ color: "var(--qa-ref-ink)" }}>{preco}</strong>
                    {catalogo?.recorrente && " /mês"}
                  </span>
                )}
                {venda?.id && (
                  <span>
                    Protocolo: <strong style={{ color: "var(--qa-ref-ink)" }}>#{venda.id}</strong>
                  </span>
                )}
              </div>
            </KanbanCard>

            <div style={{ display: "flex", alignItems: "center" }}>
              <KanbanTag tone={badge.tone}>{badge.label}</KanbanTag>
            </div>
          </div>
        </div>
      </header>

      {/* CONTENT */}
      <main style={{ maxWidth: 900, margin: "0 auto", padding: "32px 20px 48px", display: "flex", flexDirection: "column", gap: 32 }}>
        {/* TIMELINE */}
        <section>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <h2 style={{ fontSize: 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--qa-ref-ink)", margin: 0 }}>
              Sua jornada
            </h2>
            <KanbanTag tone="accent">Etapa {currentStep} de {TIMELINE.length}</KanbanTag>
          </div>

          <div style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 6 }}>
            {TIMELINE.map((t, i) => {
              const n = i + 1;
              const done = n < currentStep;
              const active = n === currentStep;
              return (
                <div key={t.label} style={{ flex: "0 0 130px", display: "flex", flexDirection: "column", alignItems: "center", gap: 8, textAlign: "center" }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
                    border: `2px solid ${active ? "var(--qa-ref-accent)" : done ? "var(--qa-ref-success)" : "var(--qa-ref-border)"}`,
                    background: active ? "var(--qa-ref-accent)" : done ? "var(--qa-ref-success)" : "var(--qa-ref-paper-2)",
                    color: active ? "#1a1206" : done ? "#0a1a0e" : "var(--qa-ref-ink-soft)",
                  }}>
                    <t.Icon size={17} />
                  </div>
                  <div>
                    <div style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--qa-ref-ink-soft)" }}>
                      {String(n).padStart(2, "0")}
                    </div>
                    <div style={{
                      fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", lineHeight: 1.3, marginTop: 2,
                      color: active ? "var(--qa-ref-accent)" : done ? "var(--qa-ref-success)" : "var(--qa-ref-ink-soft)",
                    }}>
                      {t.label}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* PRÓXIMAS AÇÕES */}
        <section>
          <h2 style={{ fontSize: 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--qa-ref-ink)", marginBottom: 12 }}>
            O que acontece agora
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 10 }}>
            {proximasAcoes.map((c) => (
              <KanbanCard key={c.title}>
                <div style={{ display: "flex", gap: 10 }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                    background: "var(--qa-ref-accent-soft)", color: "var(--qa-ref-accent)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    <c.Icon size={15} />
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 11.5, fontWeight: 700, textTransform: "uppercase", color: "var(--qa-ref-ink)" }}>
                      {c.title}
                    </div>
                    <p style={{ fontSize: 11.5, color: "var(--qa-ref-ink-soft)", lineHeight: 1.5, margin: "3px 0 0" }}>{c.desc}</p>
                  </div>
                </div>
              </KanbanCard>
            ))}
          </div>
        </section>

        {/* CTAs */}
        <section style={{
          borderRadius: 16, background: "var(--qa-ref-paper)", border: "0.5px solid var(--qa-ref-border)", padding: 20,
          paddingBottom: "max(env(safe-area-inset-bottom), 20px)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <Sparkles size={15} color="var(--qa-ref-accent)" />
            <h2 style={{ fontSize: 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--qa-ref-ink)", margin: 0 }}>
              Próximo passo
            </h2>
          </div>
          <p style={{ fontSize: 12, color: "var(--qa-ref-ink-soft)", lineHeight: 1.6, maxWidth: 560, margin: 0 }}>
            Você pode acompanhar o andamento pelo portal do cliente, falar com um
            especialista no WhatsApp ou voltar ao catálogo.
          </p>

          <div style={{ marginTop: 18, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10 }}>
            <button
              onClick={() => navigate(hasPortal ? "/area-do-cliente" : "/area-do-cliente/login")}
              style={{
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                padding: "12px 16px", borderRadius: 12, border: "none", cursor: "pointer",
                background: "var(--qa-ref-accent)", color: "#1a1206",
                fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em",
              }}
            >
              <LayoutDashboard size={15} /> {hasPortal ? "Ir para portal" : "Acessar portal"}
            </button>

            <a
              href={WHATSAPP}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                padding: "12px 16px", borderRadius: 12, textDecoration: "none",
                background: "var(--qa-ref-success)", color: "#0a1a0e",
                fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em",
              }}
            >
              <MessageCircle size={15} /> Falar com especialista
            </a>

            <button
              onClick={() => navigate("/servicos")}
              style={{
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                padding: "12px 16px", borderRadius: 12, cursor: "pointer",
                background: "var(--qa-ref-paper-2)", border: "0.5px solid var(--qa-ref-border)", color: "var(--qa-ref-ink)",
                fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em",
              }}
            >
              <ArrowLeft size={15} /> Voltar ao catálogo
            </button>
          </div>
        </section>

        {loading && (
          <div style={{ textAlign: "center", fontSize: 11, color: "var(--qa-ref-ink-soft)", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, width: "100%" }}>
            <Loader2 size={13} className="animate-spin" /> Carregando detalhes…
          </div>
        )}

        <p style={{ textAlign: "center", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--qa-ref-ink-soft)" }}>
          Equipe Quero Armas · Suporte e acompanhamento dedicado
        </p>
      </main>
    </div>
  );
}
