import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  Loader2, ShoppingCart, Lock, CheckCircle2, AlertCircle,
  QrCode, Barcode, CreditCard, ExternalLink, Copy,
  LayoutDashboard, FileText,
} from "lucide-react";
import QRCodeLib from "qrcode";
import { supabase } from "@/integrations/supabase/client";
import { useCart } from "@/shared/cart/CartProvider";
import { useAuth } from "@/shared/auth/AuthProvider";
import { toast } from "sonner";
import { formatBRL } from "@/shared/lib/formatters";
import { isValidIdentificacao, snapshotCart } from "@/lib/quero-armas/checkoutSnapshot";
import CheckoutShell from "@/components/quero-armas/checkout/CheckoutShell";
import ContractPreviewCard from "@/pages/quero-armas/cadastro-refinado/components/ContractPreviewCard";
import { openMinutaContratoQueroArmas } from "@/lib/quero-armas/minutaContratoDownload";
import "@/pages/quero-armas/cadastro-refinado/styles/cadastroRefinado.css";

/* ── Design tokens (idênticos ao CheckoutShell) ──────────────────────────────── */
const D = {
  bg: "#050505",
  paper: "#171717",
  paper2: "#111111",
  border: "rgba(255,255,255,0.09)",
  borderSoft: "rgba(255,255,255,0.05)",
  ink: "#f0ece5",
  inkSoft: "#ccc5b9",
  inkFaint: "#6b6560",
  red: "#c4253b",
  redDeep: "#7A1F2B",
  redAlpha: "rgba(196,37,59,0.12)",
  redAlphaStrong: "rgba(196,37,59,0.30)",
  redGlow: "rgba(196,37,59,0.40)",
  success: "#7fbf6a",
  successAlpha: "rgba(127,191,106,0.10)",
  successBorder: "rgba(127,191,106,0.30)",
  warning: "#e0a030",
  warningAlpha: "rgba(224,160,48,0.10)",
  warningBorder: "rgba(224,160,48,0.30)",
};

type BillingType = "PIX" | "BOLETO" | "CREDIT_CARD";

interface VendaCriada { venda_id: number; checkout_token: string; total: number; }
interface CobrancaResult {
  asaas_payment_id?: string | null;
  asaas_invoice_url?: string | null;
  asaas_bank_slip_url?: string | null;
  asaas_pix_payload?: string | null;
  asaas_due_date?: string | null;
  cobranca_status?: string | null;
  billing_type?: BillingType;
  reused?: boolean;
  pago?: boolean;
  numero_protocolo?: string | null;
}

/* ── Primitivos de UI ─────────────────────────────────────────────────────────── */

function DarkCard({ children, accentLine = false, successBorder = false }: {
  children: React.ReactNode; accentLine?: boolean; successBorder?: boolean;
}) {
  return (
    <div style={{
      background: D.paper,
      border: `1px solid ${successBorder ? D.successBorder : D.border}`,
      borderRadius: 14, overflow: "hidden",
      boxShadow: successBorder ? `0 0 16px ${D.successAlpha}` : "none",
    }}>
      {accentLine && (
        <div style={{ height: 2, background: `linear-gradient(to right, ${D.red}, ${D.redDeep})`, boxShadow: `0 0 10px ${D.redGlow}` }} />
      )}
      {successBorder && (
        <div style={{ height: 2, background: `linear-gradient(to right, ${D.success}, rgba(127,191,106,0.1))` }} />
      )}
      <div style={{ padding: "18px 20px" }}>{children}</div>
    </div>
  );
}

function SectionTitle({ icon: Icon, label, variant = "default" }: {
  icon: any; label: string; variant?: "default" | "success" | "accent";
}) {
  const color = variant === "success" ? D.success : variant === "accent" ? D.red : D.inkFaint;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
      <div style={{ width: 26, height: 26, borderRadius: 8, background: variant === "success" ? D.successAlpha : D.redAlpha, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <Icon size={14} color={color} />
      </div>
      <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.14em", color }}>
        {label}
      </span>
    </div>
  );
}

function DarkInput({ label, value, onChange, placeholder, type = "text" }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <div>
      <div style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: D.inkFaint, marginBottom: 6 }}>{label}</div>
      <input
        type={type} value={value} placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
        style={{
          width: "100%", height: 40, padding: "0 14px",
          fontSize: 13, background: D.paper2,
          border: `1.5px solid ${focused ? D.red : D.border}`,
          borderRadius: 8, color: D.ink, outline: "none",
          boxShadow: focused ? `0 0 0 3px ${D.redAlpha}` : "none",
          transition: "border-color .15s, box-shadow .15s", boxSizing: "border-box",
        }}
      />
    </div>
  );
}

/* ── Componente principal ─────────────────────────────────────────────────────── */

export default function QACheckoutFinalizarPage() {
  const navigate = useNavigate();
  const { items, totalCents, itemCount, clear } = useCart();
  const { user, loading: authLoading } = useAuth();

  const [submitting, setSubmitting] = useState(false);
  const [paying, setPaying] = useState(false);
  const [nome, setNome] = useState("");
  const [cpf, setCpf] = useState("");
  const [email, setEmail] = useState("");
  const [celular, setCelular] = useState("");
  const [aceite, setAceite] = useState(false);
  const [billingType, setBillingType] = useState<BillingType>("PIX");
  const [venda, setVenda] = useState<VendaCriada | null>(null);
  const [cobranca, setCobranca] = useState<CobrancaResult | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [baixandoContrato, setBaixandoContrato] = useState(false);
  const [erroBaixarContrato, setErroBaixarContrato] = useState<string | null>(null);
  const [clienteLogado, setClienteLogado] = useState<{
    nome_completo: string | null; cpf: string | null; email: string | null; celular: string | null;
    cep: string | null; endereco: string | null; numero: string | null; complemento: string | null;
    bairro: string | null; cidade: string | null; estado: string | null;
  } | null>(null);
  const paymentConfirmedRef = useRef(false);

  // Carrega dados do cliente já cadastrado para qualificar o contrato (nome, CPF, endereço)
  useEffect(() => {
    if (!user) { setClienteLogado(null); return; }
    let cancel = false;
    (async () => {
      const { data: link } = await supabase
        .from("cliente_auth_links" as any)
        .select("qa_cliente_id")
        .eq("user_id", user.id)
        .not("qa_cliente_id", "is", null)
        .order("activated_at", { ascending: false, nullsFirst: false })
        .limit(1)
        .maybeSingle();
      const clienteId = (link as any)?.qa_cliente_id;
      if (!clienteId) return;
      const { data: cli } = await supabase
        .from("qa_clientes")
        .select("nome_completo, cpf, email, celular, cep, endereco, numero, complemento, bairro, cidade, estado")
        .eq("id", clienteId)
        .maybeSingle();
      if (!cancel && cli) setClienteLogado(cli as any);
    })();
    return () => { cancel = true; };
  }, [user]);

  // Render QR code quando o payload PIX chega
  useEffect(() => {
    if (!cobranca || cobranca.billing_type !== "PIX" || !cobranca.asaas_pix_payload) {
      setQrDataUrl(null);
      return;
    }
    QRCodeLib.toDataURL(cobranca.asaas_pix_payload, {
      margin: 1,
      width: 220,
      errorCorrectionLevel: "M",
    })
      .then(setQrDataUrl)
      .catch((e) => console.warn("[QACheckoutFinalizar] QR gen failed:", e));
  }, [cobranca?.asaas_pix_payload, cobranca?.billing_type]);

  async function handleBaixarContrato() {
    if (!venda) return;
    setErroBaixarContrato(null);
    setBaixandoContrato(true);
    try {
      await openMinutaContratoQueroArmas({
        vendaId: venda.venda_id,
        checkoutToken: venda.checkout_token,
      });
    } catch (e: any) {
      console.error("[QACheckoutFinalizar] baixar contrato falhou:", e);
      setErroBaixarContrato("Não foi possível baixar o contrato agora. Nossa equipe foi notificada.");
    } finally {
      setBaixandoContrato(false);
    }
  }

  useEffect(() => {
    if (!authLoading && itemCount === 0 && !venda) {
      navigate("/carrinho", { replace: true });
    }
  }, [authLoading, itemCount, navigate, venda]);

  const snapshot = useMemo(() => snapshotCart(items), [items]);
  const isLogged = !!user;
  const identificacaoOk = isLogged
    ? true
    : isValidIdentificacao({ nome_completo: nome, cpf, email, celular });
  const podeFinalizar = aceite && identificacaoOk && !submitting && itemCount > 0;
  const portalPath = isLogged
    ? "/area-do-cliente"
    : `/area-do-cliente/login?next=${encodeURIComponent("/area-do-cliente")}`;

  useEffect(() => {
    if (!venda || !cobranca) return;
    let cancelled = false;

    const checkStatus = async () => {
      try {
        const { data, error } = await supabase.functions.invoke("qa-checkout-status", {
          body: {
            venda_id: venda.venda_id,
            checkout_token: venda.checkout_token,
          },
        });
        if (cancelled || error || !data) return;
        const status = data as any;
        setCobranca((prev) => prev ? {
          ...prev,
          pago: !!status.pago,
          numero_protocolo: status.numero_protocolo ?? prev.numero_protocolo ?? null,
          cobranca_status: status.cobranca_status ?? prev.cobranca_status ?? null,
          asaas_invoice_url: status.asaas_invoice_url ?? prev.asaas_invoice_url ?? null,
          asaas_bank_slip_url: status.asaas_bank_slip_url ?? prev.asaas_bank_slip_url ?? null,
          asaas_pix_payload: status.asaas_pix_payload ?? prev.asaas_pix_payload ?? null,
          asaas_due_date: status.asaas_due_date ?? prev.asaas_due_date ?? null,
        } : prev);
        if (status.pago && !paymentConfirmedRef.current) {
          paymentConfirmedRef.current = true;
          toast.success("Pagamento confirmado. Seu portal já pode ser acessado.");
        }
      } catch {
        // Polling auxiliar: falha silenciosa para não travar o acesso ao portal.
      }
    };

    void checkStatus();
    const interval = window.setInterval(checkStatus, 8000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [venda, cobranca?.asaas_payment_id]);

  /* slug e summary para o CheckoutShell */
  const primeiroSlug = items[0]?.service_slug ?? "";
  const summary = items[0] ? {
    nome: items.length > 1 ? `${items.length} serviços` : items[0].service_name,
    descricao_curta: items.length > 1 ? items.map(i => i.service_name).join(", ") : null,
    preco: totalCents / 100,
    recorrente: false,
  } : null;

  /* Adapter para ContractPreviewCard — usa apenas dadosPessoais + slugs */
  const contratoState = useMemo(() => {
    const slugsBundle = items.map((i) => i.service_slug).filter(Boolean);
    return {
      servicoSlug: slugsBundle[0] ?? null,
      servicosSlugs: slugsBundle,
      dadosPessoais: {
        nome_completo: (isLogged ? clienteLogado?.nome_completo : nome) || "",
        cpf: (isLogged ? clienteLogado?.cpf : cpf) || "",
        email: (isLogged ? clienteLogado?.email : email) || "",
        telefone: (isLogged ? clienteLogado?.celular : celular) || "",
        data_nascimento: "",
        endereco_cep: clienteLogado?.cep || "",
        endereco_logradouro: clienteLogado?.endereco || "",
        endereco_numero: clienteLogado?.numero || "",
        endereco_complemento: clienteLogado?.complemento || "",
        endereco_bairro: clienteLogado?.bairro || "",
        endereco_cidade: clienteLogado?.cidade || "",
        endereco_estado: clienteLogado?.estado || "",
      },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;
  }, [items, isLogged, clienteLogado, nome, cpf, email, celular]);

  async function handleFinalizar() {
    if (!podeFinalizar) return;
    setSubmitting(true);
    try {
      // Resolve UUIDs canônicos pelo slug — evita IDs legados numéricos ou "null"
      // que estejam guardados no localStorage de sessões anteriores.
      const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      const cart = await Promise.all(
        items.map(async (i) => {
          let servico_id = i.service_id;
          if (!UUID_RE.test(servico_id)) {
            const { data: cat } = await supabase
              .from("qa_servicos_catalogo" as any)
              .select("id")
              .eq("slug", i.service_slug)
              .eq("ativo", true)
              .maybeSingle();
            servico_id = (cat as any)?.id ?? servico_id;
          }
          return { servico_id, slug: i.service_slug, quantidade: i.quantity };
        })
      );

      const payload: any = { cart };
      if (!isLogged) payload.identificacao = { nome_completo: nome, cpf, email, celular };

      const { data, error } = await supabase.functions.invoke("qa-checkout-criar-venda", { body: payload });
      if (error) {
        // Extrai o corpo real do erro da edge function para diagnóstico
        const body = await (error as any).context?.json?.().catch?.(() => null);
        const detail = body?.error ?? body?.message ?? error.message;
        console.error("[checkout/finalizar] edge error:", detail, body);
        throw new Error(detail || "Não foi possível finalizar a compra.");
      }
      const r = data as any;
      if (!r?.ok || !r?.venda_id || !r?.checkout_token) throw new Error(r?.error || "Falha ao criar venda");
      setVenda({ venda_id: r.venda_id, checkout_token: r.checkout_token, total: r.total });
      toast.success("Pedido registrado! Escolha como pagar.");
      clear();
    } catch (e: any) {
      console.error("[checkout/finalizar]", e);
      toast.error(e?.message || "Não foi possível finalizar a compra.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleIniciarPagamento() {
    if (!venda || paying) return;
    setPaying(true);
    try {
      const { data, error } = await supabase.functions.invoke("qa-checkout-iniciar-pagamento", {
        body: { venda_id: venda.venda_id, checkout_token: venda.checkout_token, billing_type: billingType },
      });
      if (error) throw error;
      const r = data as any;
      if (!r?.success && !r?.asaas_payment_id) throw new Error(r?.error || "Falha ao gerar cobrança");
      setCobranca({
        asaas_payment_id: r.asaas_payment_id,
        asaas_invoice_url: r.asaas_invoice_url,
        asaas_bank_slip_url: r.asaas_bank_slip_url,
        asaas_pix_payload: r.asaas_pix_payload,
        asaas_due_date: r.asaas_due_date,
        cobranca_status: r.cobranca_status,
        billing_type: r.billing_type ?? billingType,
        reused: !!r.reused,
      });
      toast.success(r.reused ? "Cobrança já existia — recuperada." : "Cobrança gerada com sucesso.");
    } catch (e: any) {
      console.error("[checkout/iniciar-pagamento]", e);
      toast.error(e?.message || "Não foi possível gerar a cobrança.");
    } finally {
      setPaying(false);
    }
  }

  function copyText(text: string, label = "Copiado") {
    navigator.clipboard?.writeText(text).then(() => toast.success(label));
  }

  if (authLoading) {
    return (
      <div style={{ background: D.bg, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Loader2 size={26} color={D.red} style={{ animation: "qa-fin-spin 1s linear infinite" }} />
        <style>{`@keyframes qa-fin-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <>
      <style>{`
        @keyframes qa-fin-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .qa-pay-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
        @media (max-width: 480px) { .qa-pay-grid { grid-template-columns: 1fr !important; } }
        .qa-id-grid  { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        .qa-id-full  { grid-column: span 2; }
        @media (max-width: 540px) {
          .qa-id-grid { grid-template-columns: 1fr !important; }
          .qa-id-full { grid-column: span 1 !important; }
        }
      `}</style>

      <CheckoutShell step={4} slug={primeiroSlug} backTo="/carrinho" summary={summary}>

        {/* ── PASSO 3 — Aguardando pagamento ────────────────────────── */}
        {cobranca && (
          <DarkCard successBorder>
            <SectionTitle
              icon={CheckCircle2}
              label={cobranca.pago ? "Pagamento confirmado" : "Aguardando pagamento"}
              variant="success"
            />

            <div style={{ fontSize: 13, color: D.inkSoft, marginBottom: 16 }}>
              {cobranca.numero_protocolo ? (
                <>Protocolo <strong style={{ color: D.ink }}>{cobranca.numero_protocolo}</strong></>
              ) : (
                <>Pedido temporário <strong style={{ color: D.ink }}>#{venda?.venda_id}</strong></>
              )}
              {!cobranca.pago && cobranca.asaas_due_date && (
                <> · Vencimento: <strong style={{ color: D.ink }}>{cobranca.asaas_due_date}</strong></>
              )}
            </div>

            {cobranca.billing_type === "PIX" && cobranca.asaas_pix_payload && (
              <div style={{ background: D.paper2, border: `1px solid ${D.border}`, borderRadius: 10, padding: "14px 16px", marginBottom: 14 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 10 }}>
                  <QrCode size={13} color={D.inkFaint} />
                  <span style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: D.inkFaint }}>PIX copia e cola</span>
                </div>
                {qrDataUrl && (
                  <div style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}>
                    <img
                      src={qrDataUrl}
                      alt="QR Code do PIX"
                      width={180}
                      height={180}
                      style={{ borderRadius: 8, background: "#fff", padding: 8 }}
                    />
                  </div>
                )}
                <textarea
                  readOnly
                  rows={4}
                  value={cobranca.asaas_pix_payload}
                  style={{
                    width: "100%", background: D.bg, border: `1px solid ${D.borderSoft}`,
                    borderRadius: 6, color: D.inkSoft, fontSize: 11, fontFamily: "monospace",
                    padding: "10px 12px", resize: "none", outline: "none", boxSizing: "border-box",
                    lineHeight: 1.5, wordBreak: "break-all",
                  }}
                />
                <button
                  type="button"
                  onClick={() => copyText(cobranca.asaas_pix_payload!, "Código PIX copiado")}
                  style={{
                    marginTop: 10, display: "inline-flex", alignItems: "center", gap: 6,
                    padding: "8px 16px", borderRadius: 8, border: `1px solid ${D.successBorder}`,
                    background: D.successAlpha, color: D.success,
                    fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", cursor: "pointer",
                  }}
                >
                  <Copy size={13} /> Copiar código PIX
                </button>
              </div>
            )}

            {cobranca.billing_type === "BOLETO" && cobranca.asaas_bank_slip_url && (
              <a href={cobranca.asaas_bank_slip_url} target="_blank" rel="noopener noreferrer"
                style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 18px", borderRadius: 10, background: D.redAlpha, border: `1px solid ${D.redAlphaStrong}`, color: D.ink, fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", textDecoration: "none" }}>
                <Barcode size={15} /> Abrir boleto <ExternalLink size={12} />
              </a>
            )}

            {cobranca.asaas_invoice_url && (
              <div style={{ marginTop: 14 }}>
                <a href={cobranca.asaas_invoice_url} target="_blank" rel="noopener noreferrer"
                  style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: D.red, textDecoration: "none", borderBottom: `1px solid ${D.redAlphaStrong}` }}>
                  Abrir fatura completa <ExternalLink size={12} />
                </a>
              </div>
            )}

            {cobranca.pago && (
              <div style={{ marginTop: 14 }}>
                <button
                  type="button"
                  onClick={handleBaixarContrato}
                  disabled={baixandoContrato}
                  style={{
                    width: "100%", display: "flex", alignItems: "center", justifyContent: "center",
                    gap: 8, padding: "12px 18px", borderRadius: 10,
                    border: `1px solid ${D.border}`, background: D.paper2, color: D.ink,
                    fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em",
                    cursor: baixandoContrato ? "default" : "pointer", opacity: baixandoContrato ? 0.6 : 1,
                    boxSizing: "border-box",
                  }}
                >
                  {baixandoContrato ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />}
                  {baixandoContrato ? "Gerando contrato…" : "Baixar contrato aceito"}
                </button>
                {erroBaixarContrato && (
                  <p style={{ marginTop: 8, fontSize: 11, color: D.warning }}>{erroBaixarContrato}</p>
                )}
              </div>
            )}

            <p style={{ marginTop: 16, fontSize: 11, color: D.inkFaint, lineHeight: 1.7 }}>
              {cobranca.pago
                ? "Acompanhe os próximos passos, documentos e mensagens pela área do cliente."
                : "Assim que confirmarmos seu pagamento, você receberá um e-mail e o acesso ao portal será liberado automaticamente."}
            </p>
            <Link
              to={portalPath}
              style={{
                marginTop: 16,
                width: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 10,
                padding: "14px 18px",
                borderRadius: 12,
                background: `linear-gradient(135deg, ${D.red} 0%, ${D.redDeep} 100%)`,
                color: "#fff",
                fontSize: 12,
                fontWeight: 800,
                textTransform: "uppercase",
                letterSpacing: "0.1em",
                textDecoration: "none",
                boxShadow: `0 6px 24px ${D.redGlow}`,
                boxSizing: "border-box",
              }}
            >
              <LayoutDashboard size={17} />
              Ir para área do cliente
            </Link>
          </DarkCard>
        )}

        {/* ── PASSO 2 — Escolher forma de pagamento ─────────────────── */}
        {venda && !cobranca && (
          <DarkCard accentLine>
            <SectionTitle icon={CreditCard} label="Forma de pagamento" variant="accent" />

            <div className="qa-pay-grid">
              {([
                { t: "PIX" as BillingType, Icon: QrCode, label: "PIX" },
                { t: "BOLETO" as BillingType, Icon: Barcode, label: "Boleto" },
                { t: "CREDIT_CARD" as BillingType, Icon: CreditCard, label: "Cartão" },
              ]).map(({ t, Icon, label }) => {
                const active = billingType === t;
                return (
                  <button key={t} type="button" onClick={() => setBillingType(t)} style={{
                    display: "flex", flexDirection: "column", alignItems: "center", gap: 8,
                    padding: "16px 12px", borderRadius: 12, cursor: "pointer", transition: "all .15s",
                    background: active ? D.redAlpha : D.paper2,
                    border: `2px solid ${active ? D.red : D.borderSoft}`,
                    color: active ? D.red : D.inkFaint,
                    boxShadow: active ? `0 0 12px ${D.redAlpha}` : "none",
                    fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em",
                  }}>
                    <Icon size={20} />
                    {label}
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={handleIniciarPagamento}
              disabled={paying}
              style={{
                width: "100%", marginTop: 16, display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
                padding: "16px 24px", borderRadius: 12, border: "none", cursor: paying ? "not-allowed" : "pointer",
                fontSize: 13, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.1em",
                background: paying ? D.paper2 : `linear-gradient(135deg, ${D.red} 0%, ${D.redDeep} 100%)`,
                color: paying ? D.inkFaint : "#fff",
                boxShadow: paying ? "none" : `0 6px 24px ${D.redGlow}`,
                transition: "all .2s",
              }}
            >
              {paying
                ? <><Loader2 size={18} style={{ animation: "qa-fin-spin 1s linear infinite" }} /> Gerando cobrança…</>
                : <><Lock size={18} /> Gerar cobrança</>}
            </button>
          </DarkCard>
        )}

        {/* ── PASSO 1 — Resumo + Identificação + Aceite ─────────────── */}
        {!venda && (
          <>
            {/* Resumo do pedido */}
            <DarkCard>
              <SectionTitle icon={ShoppingCart} label="Resumo do pedido" />
              <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                {snapshot.lines.map((l, i) => (
                  <div key={l.service_id} style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
                    padding: "12px 0",
                    borderTop: i > 0 ? `1px solid ${D.borderSoft}` : "none",
                  }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: D.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {l.service_name}
                      </div>
                      <div style={{ fontSize: 11, color: D.inkFaint, marginTop: 2 }}>
                        {formatBRL(l.unit_price_cents)} × {l.quantity}
                      </div>
                    </div>
                    <div style={{ fontSize: 15, fontWeight: 800, color: D.red, flexShrink: 0 }}>
                      {formatBRL(l.subtotal_cents)}
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 4, paddingTop: 14, borderTop: `1px solid ${D.border}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.14em", color: D.inkFaint }}>Total</span>
                <span style={{ fontSize: 26, fontWeight: 800, color: D.ink }}>{formatBRL(totalCents)}</span>
              </div>
            </DarkCard>

            {/* Identificação */}
            {isLogged ? (
              <DarkCard>
                <SectionTitle icon={CheckCircle2} label="Identificação" variant="success" />
                <p style={{ fontSize: 13, color: D.inkSoft }}>
                  Logado como <strong style={{ color: D.ink }}>{user?.email}</strong>. Vamos vincular o pedido ao seu cadastro.
                </p>
              </DarkCard>
            ) : (
              <DarkCard>
                <SectionTitle icon={CheckCircle2} label="Identificação" />
                <p style={{ fontSize: 12, color: D.inkFaint, marginBottom: 14 }}>
                  Já tem conta?{" "}
                  <Link to="/area-do-cliente/login" style={{ color: D.red, textDecoration: "none", borderBottom: `1px solid ${D.redAlphaStrong}` }}>
                    Entrar
                  </Link>
                </p>
                <div className="qa-id-grid">
                  <div className="qa-id-full">
                    <DarkInput label="Nome completo" value={nome} onChange={(v) => setNome(v.toUpperCase())} />
                  </div>
                  <DarkInput label="CPF" value={cpf} onChange={setCpf} placeholder="000.000.000-00" />
                  <DarkInput label="Celular" value={celular} onChange={setCelular} placeholder="(00) 00000-0000" />
                  <div className="qa-id-full">
                    <DarkInput label="E-mail" value={email} onChange={setEmail} type="email" />
                  </div>
                </div>
                {!identificacaoOk && (nome || cpf || email || celular) && (
                  <div style={{ marginTop: 12, display: "flex", alignItems: "flex-start", gap: 8, background: D.warningAlpha, border: `1px solid ${D.warningBorder}`, borderRadius: 8, padding: "10px 14px" }}>
                    <AlertCircle size={14} color={D.warning} style={{ flexShrink: 0, marginTop: 1 }} />
                    <span style={{ fontSize: 12, color: D.warning }}>Preencha nome, CPF, e-mail e celular válidos.</span>
                  </div>
                )}
              </DarkCard>
            )}

            {/* Minuta do contrato — leitura obrigatória antes do aceite */}
            <div className="qa-refinado" style={{ background: "transparent", minHeight: "unset", color: "inherit" }}>
              <ContractPreviewCard
                state={contratoState}
                precoServico={totalCents / 100}
                nomeServico={items.length === 1 ? items[0]?.service_name ?? null : null}
              />
            </div>

            {/* Aceite */}
            <button
              type="button"
              onClick={() => setAceite((v) => !v)}
              style={{
                width: "100%", display: "flex", alignItems: "flex-start", gap: 14,
                cursor: "pointer", textAlign: "left",
                background: aceite ? D.successAlpha : D.paper,
                border: `2px solid ${aceite ? D.successBorder : D.border}`,
                borderRadius: 14, padding: "16px 18px",
                transition: "all .2s",
                boxShadow: aceite ? `0 0 16px ${D.successAlpha}` : "none",
              }}
            >
              <div style={{
                width: 22, height: 22, borderRadius: 6, flexShrink: 0, marginTop: 1,
                background: aceite ? D.success : "transparent",
                border: `2px solid ${aceite ? D.success : D.border}`,
                display: "flex", alignItems: "center", justifyContent: "center",
                transition: "all .2s",
              }}>
                {aceite && (
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path d="M2 6l3 3 5-5" stroke="#050505" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </div>
              <span style={{ fontSize: 13, color: aceite ? D.success : D.inkSoft, lineHeight: 1.65, flex: 1 }}>
                <strong style={{ color: aceite ? D.success : D.ink }}>Li e aceito</strong> o contrato de adesão de serviços acima e autorizo a Quero Armas a iniciar o atendimento após a confirmação do pagamento.
              </span>
            </button>

            {/* CTA Finalizar */}
            <button
              type="button"
              onClick={handleFinalizar}
              disabled={!podeFinalizar}
              style={{
                width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
                padding: "18px 24px", borderRadius: 14, border: "none",
                cursor: podeFinalizar ? "pointer" : "not-allowed",
                fontSize: 13, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.1em",
                background: podeFinalizar
                  ? `linear-gradient(135deg, ${D.red} 0%, ${D.redDeep} 100%)`
                  : D.paper2,
                color: podeFinalizar ? "#fff" : D.inkFaint,
                boxShadow: podeFinalizar ? `0 6px 30px ${D.redGlow}, 0 0 0 1px ${D.redAlphaStrong}` : "none",
                transition: "all .25s",
              }}
            >
              {submitting
                ? <><Loader2 size={20} style={{ animation: "qa-fin-spin 1s linear infinite" }} /> Registrando pedido…</>
                : <><Lock size={20} /> Finalizar compra</>}
            </button>
          </>
        )}

      </CheckoutShell>
    </>
  );
}
