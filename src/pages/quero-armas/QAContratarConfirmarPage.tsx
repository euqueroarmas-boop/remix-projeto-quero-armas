import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import {
  Loader2,
  AlertCircle,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import { fetchChecklistEtapa02 } from "@/lib/quero-armas/etapa02Checklist";
import { useCart } from "@/shared/cart/CartProvider";
import InlineContractReader from "@/components/quero-armas/contratar/InlineContractReader";

/* =============================================================================
 * Design tokens — Escala neutra canônica LIGHT (AAA Pass).
 * Ver mem://style/quero-armas/canonical-neutral-scale
 * ============================================================================= */
const D = {
  /* Light AAA scale */
  bg:        "#FAFAFA", // page background
  paper:     "#FFFFFF", // card background
  border:    "#E5E5E5",
  borderHairline: "#F5F5F5",
  divider:   "#D4D4D4",
  ink:       "#0A0A0A",
  inkStrong: "#171717",
  inkBody:   "#404040",
  inkMuted:  "#737373",
  inkFaint:  "#A3A3A3",
  inkGhost:  "#D4D4D4",
  /* Microdots de status (apenas dots ≤ 8px) */
  dotOk:     "#28C840",
  dotWarn:   "#FEBC2E",
  dotError:  "#FF5F57",
};

interface Catalogo {
  id: string;
  slug: string;
  nome: string;
  descricao_curta: string | null;
  preco: number | null;
  recorrente: boolean;
  gera_processo: boolean;
  servico_id: number | null;
}

interface ClienteData {
  id: number;
  nome_completo: string;
  cpf: string | null;
  email: string | null;
  estado_civil: string | null;
  profissao: string | null;
  cep: string | null;
  endereco: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  cidade: string | null;
  estado: string | null;
}

const ESTADOS_CIVIS = ["SOLTEIRO(A)", "CASADO(A)", "DIVORCIADO(A)", "VIÚVO(A)", "UNIÃO ESTÁVEL"];

/* ── Tradução de erros do checkout ──────────────────────────────────────────
 * supabase.functions.invoke devolve FunctionsHttpError com mensagem genérica
 * ("Edge Function returned a non-2xx status code"); o corpo real fica em
 * error.context (Response). Sem isso, qualquer recusa do Asaas vira um toast
 * inútil e o cliente acha que o botão "não funciona". */
async function extractFnError(err: unknown): Promise<Record<string, any> | null> {
  try {
    const ctx = (err as any)?.context;
    if (ctx && typeof ctx.json === "function") return await ctx.json();
  } catch { /* corpo não-JSON */ }
  return null;
}

function explainCheckoutError(body: Record<string, any> | null, fallback: string): string {
  if (!body) return fallback;
  const asaasDesc = Array.isArray(body?.details?.errors)
    ? body.details.errors.map((e: any) => e?.description).filter(Boolean).join(" · ")
    : null;
  switch (body.error) {
    case "cliente_incompleto":
      return "Seu cadastro está incompleto (nome, CPF ou e-mail). Atualize seus dados na área do cliente e tente novamente.";
    case "asaas_customer_failed":
      return asaasDesc
        ? `O banco recusou seus dados de cadastro: ${asaasDesc}`
        : "O banco recusou seus dados de cadastro. Confira CPF, e-mail e celular.";
    case "asaas_payment_failed":
      return asaasDesc
        ? `O banco recusou a cobrança: ${asaasDesc}`
        : "O banco recusou a geração da cobrança. Tente novamente em instantes.";
    case "asaas_network_customer":
    case "asaas_network_payment":
      return "Falha de comunicação com o banco. Tente novamente em instantes.";
    case "venda_ja_paga":
    case "cobranca_ja_confirmada":
      return "Esta contratação já está paga. Veja seus processos na área do cliente.";
    case "checkout_token_invalido":
    case "checkout_token_expirado":
      return "Sua sessão de checkout expirou. Recarregue a página e tente novamente.";
    case "service_unavailable":
      return "Este serviço está temporariamente indisponível no catálogo.";
    case "valor_invalido":
      return "Serviço sem preço válido configurado. Fale com a equipe.";
    default:
      return typeof body.error === "string" ? `${fallback} (${body.error})` : fallback;
  }
}

type Confirmacao = "sim" | "nao" | null;

/* ── Primitivos LIGHT (Ficha catalográfica) ────────────────────────────────── */

function Section({
  n, label, statusDot = "ok", children,
}: {
  n: number;
  label: string;
  statusDot?: "ok" | "warn" | "error";
  children: React.ReactNode;
}) {
  const dotColor =
    statusDot === "error" ? D.dotError :
    statusDot === "warn"  ? D.dotWarn  : D.dotOk;
  return (
    <div style={{ position: "relative", paddingLeft: 32, borderLeft: `1px solid ${D.border}` }}>
      <span style={{
        position: "absolute", left: -4.5, top: 0,
        width: 8, height: 8, borderRadius: "50%", background: dotColor,
      }} />
      <h2 style={{
        fontFamily: "Oswald, sans-serif",
        fontSize: 11, fontWeight: 600, textTransform: "uppercase",
        letterSpacing: "0.2em", color: D.inkFaint, margin: "0 0 8px",
      }}>
        {String(n).padStart(2, "0")} {label}
      </h2>
      {children}
    </div>
  );
}

function ToggleConfirm({ value, onChange, labelSim, labelNao }: {
  value: Confirmacao;
  onChange: (v: "sim" | "nao") => void;
  labelSim: string;
  labelNao: string;
}) {
  return (
    <div style={{ display: "inline-flex", background: "#F5F5F5", padding: 4 }}>
      {(["sim", "nao"] as const).map((opt) => {
        const sel = value === opt;
        return (
          <button
            key={opt} type="button" onClick={() => onChange(opt)}
            style={{
              padding: "6px 12px",
              fontFamily: "Inter, sans-serif",
              fontSize: 10, fontWeight: 700, textTransform: "uppercase",
              letterSpacing: "0.04em",
              background: sel ? "#FFFFFF" : "transparent",
              border: sel ? `1px solid ${D.border}` : "1px solid transparent",
              boxShadow: sel ? "0 1px 2px rgba(0,0,0,0.05)" : "none",
              color: sel ? D.inkStrong : D.inkFaint,
              cursor: "pointer",
              transition: "all .15s",
            }}
          >
            {opt === "sim" ? labelSim : labelNao}
          </button>
        );
      })}
    </div>
  );
}

function LightInput({ placeholder, value, onChange, wide, maxLength }: {
  placeholder: string; value: string; onChange: (v: string) => void;
  wide?: boolean; maxLength?: number;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <input
      placeholder={placeholder}
      value={value}
      maxLength={maxLength}
      onChange={(e) => onChange(e.target.value)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      className={wide ? "qa-input-wide" : ""}
      style={{
        height: 38, padding: "0 2px",
        fontSize: 13, textTransform: "uppercase", letterSpacing: "0.04em",
        background: "transparent",
        border: "none",
        borderBottom: `1px solid ${focused ? D.ink : D.border}`,
        color: D.inkStrong, outline: "none", width: "100%", boxSizing: "border-box",
        transition: "border-color .15s",
      }}
    />
  );
}

/* ── Página principal ───────────────────────────────────────────────────────── */

export default function QAContratarConfirmarPage() {
  const navigate = useNavigate();
  const { slug = "" } = useParams();
  const { addItem, clear } = useCart();
  const [userEmail, setUserEmail] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [catalogo, setCatalogo] = useState<Catalogo | null>(null);
  const [cliente, setCliente] = useState<ClienteData | null>(null);
  const [docsReaproveitados, setDocsReaproveitados] = useState<string[]>([]);

  const [enderecoOk, setEnderecoOk] = useState<Confirmacao>(null);
  const [novoCep, setNovoCep] = useState("");
  const [novoEndereco, setNovoEndereco] = useState("");
  const [novoNumero, setNovoNumero] = useState("");
  const [novoComplemento, setNovoComplemento] = useState("");
  const [novoBairro, setNovoBairro] = useState("");
  const [novaCidade, setNovaCidade] = useState("");
  const [novoEstado, setNovoEstado] = useState("");

  const [dadosOk, setDadosOk] = useState<Confirmacao>(null);
  const [novoEstadoCivil, setNovoEstadoCivil] = useState("");
  const [novaProfissao, setNovaProfissao] = useState("");

  const [aceiteContrato, setAceiteContrato] = useState(false);

  const [legadoBlock, setLegadoBlock] = useState<{
    homologacao_status?: string | null;
    recadastramento_status?: string | null;
  } | null>(null);

  useEffect(() => {
    (async () => {
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) {
        navigate(`/area-do-cliente/contratar/${slug}/identificar`, { replace: true });
        return;
      }
      const uid = sess.session.user.id;
      setUserEmail(sess.session.user.email ?? null);

      const { data: cat } = await supabase
        .from("qa_servicos_catalogo" as any)
        .select("id, slug, nome, descricao_curta, preco, recorrente, gera_processo, servico_id")
        .eq("slug", slug).eq("ativo", true).maybeSingle();
      if (!cat) {
        toast.error("Serviço não encontrado.");
        navigate("/area-do-cliente/contratar", { replace: true });
        return;
      }
      setCatalogo(cat as any);

      const { data: link } = await supabase
        .from("cliente_auth_links" as any)
        .select("qa_cliente_id")
        .eq("user_id", uid).not("qa_cliente_id", "is", null)
        .order("activated_at", { ascending: false, nullsFirst: false })
        .limit(1).maybeSingle();
      const clienteId = (link as any)?.qa_cliente_id;
      if (!clienteId) {
        toast.error("Cadastro de cliente não encontrado.");
        navigate("/area-do-cliente", { replace: true });
        return;
      }

      const { data: cli } = await supabase
        .from("qa_clientes")
        .select("id, nome_completo, cpf, email, estado_civil, profissao, cep, endereco, numero, complemento, bairro, cidade, estado")
        .eq("id", clienteId).maybeSingle();
      if (cli) setCliente(cli as any);

      try {
        const [checklist, docsResp] = await Promise.all([
          fetchChecklistEtapa02(slug),
          supabase.functions.invoke("qa-cadastro-carregar-cliente", { body: {} }),
        ]);
        const docsValidos = Array.isArray((docsResp.data as any)?.documentos_validos)
          ? ((docsResp.data as any).documentos_validos as Array<{ tipo_documento?: string | null }>)
          : [];
        const itensCompativeis = checklist.filter((item) =>
          docsValidos.some((doc) =>
            item.tiposCompativeis.includes(String(doc.tipo_documento || "").toUpperCase())
          )
        );
        setDocsReaproveitados(
          Array.from(new Set(itensCompativeis.map((item) => item.shortName || item.label)))
        );
      } catch {
        setDocsReaproveitados([]);
      }
      setLoading(false);
    })();
  }, [slug, navigate]);

  const enderecoAtualLinha = useMemo(() => {
    if (!cliente) return "";
    return [
      cliente.endereco, cliente.numero, cliente.complemento, cliente.bairro,
      cliente.cidade && cliente.estado ? `${cliente.cidade} / ${cliente.estado}` : cliente.cidade,
      cliente.cep,
    ].filter(Boolean).join(", ");
  }, [cliente]);

  const valorNumerico = useMemo(() => {
    const n = Number(catalogo?.preco ?? 0);
    return Number.isFinite(n) && n > 0 ? n : 0;
  }, [catalogo]);

  const podeConfirmar =
    enderecoOk !== null && dadosOk !== null && aceiteContrato && !submitting && !loading && cliente && catalogo;

  const iniciaisNome = useMemo(() => {
    if (!cliente?.nome_completo) return "?";
    const parts = cliente.nome_completo.trim().split(" ").filter(Boolean);
    return parts.length >= 2 ? `${parts[0][0]}${parts[parts.length - 1][0]}` : parts[0]?.[0] ?? "?";
  }, [cliente]);

  async function handleConfirmar() {
    if (!cliente || !catalogo) return;
    setSubmitting(true);
    try {
      const { data: verifData, error: verifErr } = await supabase.rpc(
        "qa_verificar_cliente_pode_contratar" as any,
        { p_cliente_id: cliente.id, p_catalogo_slug: catalogo.slug } as any
      );
      if (verifErr) throw verifErr;
      const verif = (verifData ?? {}) as {
        pode_contratar?: boolean; motivo?: string;
        homologacao_status?: string | null; recadastramento_status?: string | null;
      };
      if (verif.pode_contratar === false) {
        setLegadoBlock({ homologacao_status: verif.homologacao_status ?? null, recadastramento_status: verif.recadastramento_status ?? null });
        toast.error("Recadastramento obrigatório antes de contratar.");
        setSubmitting(false);
        return;
      }

      if (enderecoOk === "nao" || dadosOk === "nao") {
        const { error: errUpd } = await supabase.rpc(
          "qa_atualizar_dados_basicos_cliente" as any,
          {
            p_cliente_id: cliente.id,
            p_estado_civil: dadosOk === "nao" ? novoEstadoCivil : null,
            p_profissao: dadosOk === "nao" ? novaProfissao : null,
            p_cep: enderecoOk === "nao" ? novoCep : null,
            p_endereco: enderecoOk === "nao" ? novoEndereco : null,
            p_numero: enderecoOk === "nao" ? novoNumero : null,
            p_complemento: enderecoOk === "nao" ? novoComplemento : null,
            p_bairro: enderecoOk === "nao" ? novoBairro : null,
            p_cidade: enderecoOk === "nao" ? novaCidade : null,
            p_estado: enderecoOk === "nao" ? novoEstado : null,
          } as any
        );
        if (errUpd) throw errUpd;
      }

      if (!valorNumerico) {
        toast.error("Serviço sem preço configurado no catálogo. Fale com a equipe.");
        return;
      }
      addItem({
        service_id: catalogo.id,          // UUID do catálogo (esperado pela edge function)
        service_slug: catalogo.slug,
        service_name: catalogo.nome,
        unit_price_cents: Math.round(valorNumerico * 100),
        quantity: 1,
      });

      /* Fluxo direto: cria venda + inicia pagamento (PIX padrão) e redireciona
       * ao checkout hospedado do Asaas. Após a confirmação, o Asaas devolve o
       * cliente para a página de conclusão via successUrl. */
      const successUrl =
        `${window.location.origin}/area-do-cliente/contratar/${catalogo.slug}/sucesso`;

      const { data: vendaData, error: vendaErr } = await supabase.functions.invoke(
        "qa-checkout-criar-venda",
        {
          body: {
            cart: [{ servico_id: catalogo.id, slug: catalogo.slug, quantidade: 1 }],
          },
        },
      );
      if (vendaErr) {
        const body = await extractFnError(vendaErr);
        throw new Error(explainCheckoutError(body, "Falha ao registrar venda."));
      }
      const venda = vendaData as any;
      if (!venda?.ok || !venda?.venda_id || !venda?.checkout_token) {
        throw new Error(venda?.error || "Falha ao registrar venda.");
      }

      const { data: payData, error: payErr } = await supabase.functions.invoke(
        "qa-checkout-iniciar-pagamento",
        {
          body: {
            venda_id: venda.venda_id,
            checkout_token: venda.checkout_token,
            billing_type: "PIX",
            success_url: `${successUrl}?venda=${venda.venda_id}`,
          },
        },
      );
      if (payErr) {
        const body = await extractFnError(payErr);
        throw new Error(explainCheckoutError(body, "Falha ao gerar cobrança."));
      }
      const pay = payData as any;
      const invoiceUrl = pay?.asaas_invoice_url;
      if (!invoiceUrl) throw new Error(pay?.error || "Cobrança sem link de pagamento.");

      /* Registra aceite de contrato (best-effort) — agora com venda_id real */
      try {
        await supabase.functions.invoke("qa-contract-aceite-registrar", {
          body: {
            cliente_id: cliente.id,
            venda_id: venda.venda_id,
            solicitacao_id: null,
            servico_slug: catalogo.slug,
            servico_slugs: [catalogo.slug],
            servico_preco: valorNumerico,
            dados_pessoais: {
              nome_completo: cliente.nome_completo,
              cpf: cliente.cpf,
              email: cliente.email,
              estado_civil: dadosOk === "nao" && novoEstadoCivil ? novoEstadoCivil : cliente.estado_civil,
              profissao: dadosOk === "nao" && novaProfissao ? novaProfissao : cliente.profissao,
            },
            user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
            template_codigo: "CONTRATO_PRINCIPAL_MVP_QUERO_ARMAS",
          },
        });
      } catch (aceiteFail: any) {
        console.warn("[confirmar] aceite-registrar falhou:", aceiteFail);
      }

      toast.success("Redirecionando para o pagamento seguro…");
      clear();
      window.location.href = invoiceUrl;
      return;
    } catch (e: any) {
      console.error("[contratar/confirmar] erro:", e);
      toast.error(e?.message || "Não foi possível concluir a contratação.");
    } finally {
      setSubmitting(false);
    }
  }

  /* ── Loading ───────────────────────────────────────────────────────────── */
  if (loading) {
    return (
      <div style={{ background: D.bg, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Loader2 size={26} color={D.inkStrong} style={{ animation: "qa-spin 1s linear infinite" }} />
        <style>{`@keyframes qa-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (!catalogo || !cliente) return null;

  /* ── Bloqueio legacy ───────────────────────────────────────────────────── */
  if (legadoBlock) {
    const waLink = "https://wa.me/5562994040220?text=" +
      encodeURIComponent(`Olá! Sou cliente antigo da Quero Armas (CPF ${cliente.cpf || "—"}) e quero atualizar meu cadastro para contratar o serviço ${catalogo.nome}.`);
    return (
      <div style={{ background: D.bg, minHeight: "100vh", padding: "40px 16px" }}>
        <div style={{ maxWidth: 520, margin: "0 auto" }}>
          <div style={{ background: D.paper, border: `1px solid ${D.border}`, padding: 24 }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
              <div style={{ width: 38, height: 38, background: "#F5F5F5", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <AlertCircle size={20} color={D.dotError} />
              </div>
              <div>
                <h1 style={{ fontSize: 15, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em", color: D.ink, marginBottom: 8 }}>
                  Recadastramento obrigatório
                </h1>
                <p style={{ fontSize: 13, color: D.inkBody, lineHeight: 1.7, margin: 0 }}>
                  Seu cadastro veio do sistema antigo da Quero Armas. Para comprar um novo serviço, precisamos atualizar seus documentos no sistema novo.
                </p>
                <p style={{ fontSize: 10, color: D.inkFaint, marginTop: 10, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                  Status: {legadoBlock.homologacao_status || "pendente"} · Recadastramento: {legadoBlock.recadastramento_status || "—"}
                </p>
              </div>
            </div>
            <div style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 8 }}>
              <button type="button" onClick={() => navigate("/area-do-cliente?secao=arsenal")}
                style={{ padding: "12px 16px", background: D.inkStrong, color: "#FAFAFA", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", border: "none", cursor: "pointer", width: "100%" }}>
                Enviar documentos agora
              </button>
              <a href={waLink} target="_blank" rel="noopener noreferrer"
                style={{ display: "block", textAlign: "center", padding: "12px 16px", background: "#F5F5F5", color: D.inkStrong, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", textDecoration: "none", border: `1px solid ${D.border}` }}>
                Falar com a Equipe Quero Armas
              </a>
              <button type="button" onClick={() => navigate("/area-do-cliente")}
                style={{ padding: "12px 16px", background: "transparent", color: D.inkMuted, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", border: `1px solid ${D.border}`, cursor: "pointer", width: "100%" }}>
                Voltar ao portal
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ── Render principal — Ficha Catalográfica LIGHT ──────────────────────── */
  const userEmailDisplay = userEmail || cliente.email || "";
  const userInitials = (userEmailDisplay || "?").slice(0, 2).toUpperCase();
  const podeConfirmarBool = Boolean(podeConfirmar);

  return (
    <div style={{ background: D.bg, minHeight: "100vh", color: D.inkStrong, WebkitFontSmoothing: "antialiased", fontFamily: "Inter, sans-serif" }}>
      <style>{`
        @keyframes qa-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .qa-addr-grid {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          gap: 18px 28px;
          margin-top: 18px;
        }
        .qa-input-wide { grid-column: span 3 !important; }
        @media (max-width: 768px) {
          .qa-addr-grid { grid-template-columns: 1fr 1fr !important; }
          .qa-input-wide { grid-column: span 2 !important; }
        }
        @media (max-width: 480px) {
          .qa-addr-grid { grid-template-columns: 1fr !important; }
          .qa-input-wide { grid-column: span 1 !important; }
        }
      `}</style>

      <div style={{ display: "flex", justifyContent: "center", padding: "32px 16px" }}>
        <article style={{
          width: "100%", maxWidth: 720,
          background: D.paper, border: `1px solid ${D.border}`,
          boxShadow: "0 1px 3px rgba(0,0,0,0.05)", overflow: "hidden",
        }}>

          {/* ── Header ───────────────────────────────────────────────── */}
          <header style={{
            borderBottom: `1px solid ${D.border}`,
            padding: "14px 24px",
            display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: 12,
            fontFamily: "Oswald, sans-serif",
            fontSize: 10, textTransform: "uppercase", letterSpacing: "0.2em",
            color: D.inkMuted,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <button onClick={() => navigate("/area-do-cliente/contratar")} style={{ background: "none", border: "none", padding: 0, color: D.inkMuted, cursor: "pointer", letterSpacing: "0.2em" }}>
                VOLTAR
              </button>
              <span style={{ color: D.inkGhost, fontWeight: 300 }}>/</span>
              <span style={{ color: D.ink, fontWeight: 700 }}>CHECKOUT QUERO ARMAS</span>
            </div>
            <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
              <span style={{ opacity: 0.5 }}>{userInitials}</span>
              <span style={{ textTransform: "lowercase", letterSpacing: "0.04em" }}>{userEmailDisplay}</span>
            </div>
          </header>

          {/* ── Stepper ──────────────────────────────────────────────── */}
          <nav style={{
            borderBottom: `1px solid ${D.borderHairline}`,
            background: D.bg, padding: "12px 24px",
            display: "flex", justifyContent: "space-between", gap: 8,
            fontFamily: "Oswald, sans-serif",
            fontSize: 11, textTransform: "uppercase", letterSpacing: "0.04em",
          }}>
            {[
              { n: 1, label: "01 IDENTIFICAÇÃO" },
              { n: 2, label: "02 DADOS" },
              { n: 3, label: "03 CONFIRMAÇÃO" },
              { n: 4, label: "04 PAGAMENTO" },
            ].map((s) => {
              const active = s.n === 3;
              return (
                <span key={s.n} style={{
                  color: active ? D.ink : D.inkFaint, position: "relative", paddingBottom: 4,
                  borderBottom: active ? `2px solid ${D.ink}` : "2px solid transparent",
                }}>
                  {s.label}
                </span>
              );
            })}
          </nav>

          {/* ── Conteúdo ─────────────────────────────────────────────── */}
          <div style={{ padding: "48px 48px 56px" }}>
            {/* Heading editorial */}
            <header style={{ marginBottom: 48 }}>
              <h1 style={{
                fontFamily: "Oswald, sans-serif",
                fontSize: 48, fontWeight: 700, letterSpacing: "-0.025em",
                lineHeight: 0.9, textTransform: "uppercase", color: D.ink, margin: 0,
              }}>
                CONFIRMAÇÃO<br />
                <span style={{ color: D.inkGhost, fontSize: 36 }}>·</span> TITULAR
              </h1>
              <div style={{ marginTop: 18, display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ height: 1, width: 32, background: D.ink }} />
                <p style={{
                  margin: 0, fontSize: 12, fontWeight: 700, textTransform: "uppercase",
                  letterSpacing: "0.08em", color: D.inkBody,
                }}>
                  {cliente.nome_completo} — CPF {cliente.cpf || "—"}
                </p>
              </div>
            </header>

            <div style={{ display: "flex", flexDirection: "column", gap: 40 }}>

              {/* 01 Endereço */}
              <Section
                n={1}
                label="ENDEREÇO"
                statusDot={enderecoOk === "sim" ? "ok" : enderecoOk === "nao" ? "warn" : "error"}
              >
                <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: 16, alignItems: "flex-start" }}>
                  <p style={{ margin: 0, fontSize: 14, lineHeight: 1.7, color: D.ink, fontWeight: 500, maxWidth: 480 }}>
                    {enderecoAtualLinha || <span style={{ fontStyle: "italic", color: D.inkFaint }}>SEM ENDEREÇO CADASTRADO</span>}
                  </p>
                  <ToggleConfirm
                    value={enderecoOk} onChange={setEnderecoOk}
                    labelSim="É O MESMO" labelNao="MUDOU"
                  />
                </div>
                {enderecoOk === "nao" && (
                  <div className="qa-addr-grid">
                    <LightInput placeholder="CEP" value={novoCep} onChange={setNovoCep} />
                    <LightInput placeholder="ESTADO (UF)" value={novoEstado} onChange={(v) => setNovoEstado(v.toUpperCase())} maxLength={2} />
                    <LightInput placeholder="RUA / AVENIDA" value={novoEndereco} onChange={(v) => setNovoEndereco(v.toUpperCase())} wide />
                    <LightInput placeholder="NÚMERO" value={novoNumero} onChange={setNovoNumero} />
                    <LightInput placeholder="COMPLEMENTO" value={novoComplemento} onChange={(v) => setNovoComplemento(v.toUpperCase())} />
                    <LightInput placeholder="BAIRRO" value={novoBairro} onChange={(v) => setNovoBairro(v.toUpperCase())} />
                    <LightInput placeholder="CIDADE" value={novaCidade} onChange={(v) => setNovaCidade(v.toUpperCase())} />
                  </div>
                )}
              </Section>

              {/* 02 Estado civil e profissão */}
              <Section
                n={2}
                label="ESTADO CIVIL E PROFISSÃO"
                statusDot={dadosOk === "nao" ? "warn" : "ok"}
              >
                <div style={{ display: "flex", flexDirection: "column", gap: 14, alignItems: "flex-start" }}>
                  <p style={{ margin: 0, fontSize: 14, fontWeight: 500, color: D.ink }}>
                    {(cliente.estado_civil || "—").replace(/\(.*$/, "").toUpperCase()} <span style={{ color: D.inkGhost, margin: "0 6px" }}>·</span> {(cliente.profissao || "—")}
                  </p>
                  <ToggleConfirm
                    value={dadosOk} onChange={setDadosOk}
                    labelSim="É O MESMO" labelNao="MUDOU"
                  />
                </div>
                {dadosOk === "nao" && (
                  <div style={{ marginTop: 18, display: "flex", flexDirection: "column", gap: 12 }}>
                    <select value={novoEstadoCivil} onChange={(e) => setNovoEstadoCivil(e.target.value)}
                      style={{
                        height: 40, padding: "0 12px",
                        fontSize: 13, textTransform: "uppercase",
                        background: "#FFFFFF", border: `1px solid ${D.border}`,
                        color: D.ink, outline: "none", width: "100%", fontFamily: "Inter, sans-serif",
                      }}>
                      <option value="">ESTADO CIVIL (MANTER O ATUAL SE VAZIO)</option>
                      {ESTADOS_CIVIS.map((ec) => <option key={ec} value={ec}>{ec}</option>)}
                    </select>
                    <LightInput placeholder="PROFISSÃO (MANTER ATUAL SE VAZIO)" value={novaProfissao} onChange={(v) => setNovaProfissao(v.toUpperCase())} wide />
                  </div>
                )}
              </Section>

              {/* 03 Documentos reaproveitados */}
              <Section n={3} label="DOCUMENTOS REAPROVEITADOS" statusDot="ok">
                {docsReaproveitados.length === 0 ? (
                  <p style={{ margin: 0, fontStyle: "italic", color: D.inkFaint, fontSize: 13 }}>
                    Nenhum documento prévio validado — você enviará todos no processo novo.
                  </p>
                ) : (
                  <div>
                    <p style={{ margin: "0 0 10px", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: D.inkMuted }}>
                      {docsReaproveitados.length} DOCUMENTO{docsReaproveitados.length > 1 ? "S" : ""} JÁ VALIDADO{docsReaproveitados.length > 1 ? "S" : ""} NO SEU ARSENAL
                    </p>
                    <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 6 }}>
                      {docsReaproveitados.map((nome) => (
                        <li key={nome} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, color: D.ink }}>
                          <span style={{
                            width: 16, height: 16, flexShrink: 0,
                            background: D.ink, color: "#FFFFFF",
                            display: "inline-flex", alignItems: "center", justifyContent: "center",
                          }}>
                            <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="square">
                              <path d="M2 6l3 3 5-6" />
                            </svg>
                          </span>
                          <span style={{ fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                            {String(nome).toUpperCase()}
                          </span>
                        </li>
                      ))}
                    </ul>
                    <p style={{ margin: "10px 0 0", fontSize: 11, color: D.inkFaint, lineHeight: 1.6 }}>
                      Estes documentos serão reaproveitados automaticamente — você não precisa enviá-los novamente.
                    </p>
                  </div>
                )}
              </Section>

              {/* 04 Valor do serviço */}
              <Section n={4} label="VALOR DO SERVIÇO" statusDot="ok">
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <span style={{
                    fontSize: 10, fontWeight: 700, textTransform: "uppercase",
                    letterSpacing: "0.1em", color: D.inkFaint,
                  }}>
                    PREÇO OFICIAL
                  </span>
                  <span style={{
                    fontFamily: "Oswald, sans-serif",
                    fontSize: 32, fontWeight: 700, letterSpacing: "-0.025em",
                    color: D.ink,
                  }}>
                    {valorNumerico > 0
                      ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(valorNumerico)
                      : "—"}
                  </span>
                </div>
              </Section>

              {/* 05 Contrato e aceite */}
              <Section
                n={5}
                label="CONTRATO E ACEITE OBRIGATÓRIO"
                statusDot={aceiteContrato ? "ok" : "error"}
              >
                <p style={{ margin: "0 0 14px", fontSize: 12, lineHeight: 1.7, color: D.inkBody, maxWidth: 560 }}>
                  Leia o contrato de adesão na íntegra abaixo. Ao marcar o aceite, você concorda com os{" "}
                  <a href="/termos" target="_blank" rel="noopener noreferrer" style={{ color: D.ink, textDecoration: "none", borderBottom: `1px solid ${D.divider}`, display: "inline-flex", alignItems: "center", gap: 3 }}>
                    TERMOS DE SERVIÇO <ExternalLink size={10} />
                  </a>{" "}e a{" "}
                  <a href="/privacidade" target="_blank" rel="noopener noreferrer" style={{ color: D.ink, textDecoration: "none", borderBottom: `1px solid ${D.divider}`, display: "inline-flex", alignItems: "center", gap: 3 }}>
                    POLÍTICA DE PRIVACIDADE <ExternalLink size={10} />
                  </a>{" "}da Quero Armas. O aceite eletrônico possui validade jurídica conforme a Lei n.º 14.063/2020.
                </p>

                <InlineContractReader
                  servicoSlug={catalogo.slug}
                  vars={{
                    cliente_nome: cliente.nome_completo || "—",
                    cliente_cpf_cnpj: cliente.cpf || "—",
                    cliente_endereco: enderecoAtualLinha || "—",
                    cliente_email: cliente.email || userEmail || "—",
                    cliente_telefone: "—",
                    servico_slug: catalogo.slug,
                    servico_nome: catalogo.nome,
                    servico_preco: valorNumerico > 0
                      ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(valorNumerico)
                      : "—",
                  }}
                />

                <label
                  onClick={() => setAceiteContrato((v) => !v)}
                  style={{ display: "flex", alignItems: "flex-start", gap: 14, cursor: "pointer", marginTop: 16 }}
                >
                  <span style={{
                    marginTop: 2, width: 18, height: 18, flexShrink: 0,
                    border: `2px solid ${aceiteContrato ? D.ink : D.border}`,
                    background: aceiteContrato ? D.ink : "transparent",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    transition: "all .15s",
                  }}>
                    {aceiteContrato && (
                      <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="square">
                        <path d="M2 6l3 3 5-6" />
                      </svg>
                    )}
                  </span>
                  <span style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.02em", color: D.inkBody, lineHeight: 1.4, flex: 1 }}>
                    LI E ACEITO INTEGRALMENTE OS TERMOS DO CONTRATO DE PRESTAÇÃO DE SERVIÇOS E POLÍTICA DE PRIVACIDADE.
                  </span>
                </label>
              </Section>
            </div>

            {/* ── CTA ────────────────────────────────────────────────── */}
            <div style={{ marginTop: 64 }}>
              <button
                type="button"
                disabled={!podeConfirmarBool}
                onClick={handleConfirmar}
                style={{
                  width: "100%",
                  background: podeConfirmarBool ? D.inkStrong : "#A3A3A3",
                  color: "#FFFFFF",
                  padding: "24px",
                  fontFamily: "Oswald, sans-serif",
                  fontSize: 20, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.3em",
                  border: "none",
                  cursor: podeConfirmarBool ? "pointer" : "not-allowed",
                  transition: "background .15s, letter-spacing .2s",
                }}
              >
                {submitting ? (
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 12, justifyContent: "center" }}>
                    <Loader2 size={16} style={{ animation: "qa-spin 1s linear infinite" }} />
                    PROCESSANDO
                  </span>
                ) : (
                  "IR PARA PAGAMENTO"
                )}
              </button>
              <p style={{
                textAlign: "center", marginTop: 24,
                fontSize: 9, fontWeight: 500, textTransform: "uppercase",
                letterSpacing: "0.2em", color: D.inkGhost,
              }}>
                AMBIENTE SEGURO
              </p>
            </div>
          </div>
        </article>
      </div>
    </div>
  );
}
