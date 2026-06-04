import { useEffect, useMemo, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  Loader2,
  ShoppingCart,
  Lock,
  CheckCircle2,
  AlertCircle,
  QrCode,
  Barcode,
  CreditCard,
  ExternalLink,
  Copy,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCart } from "@/shared/cart/CartProvider";
import { useAuth } from "@/shared/auth/AuthProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { formatBRL } from "@/shared/lib/formatters";
import {
  isValidIdentificacao,
  snapshotCart,
} from "@/lib/quero-armas/checkoutSnapshot";

/**
 * FASE 2C-1 — Finalização do checkout Quero Armas.
 *
 * Cria qa_vendas + qa_itens_venda a partir do carrinho (snapshot de preço
 * congelado no momento da compra). NÃO gera cobrança Asaas, NÃO cria
 * contrato/processo/checklist e NÃO libera Arsenal nesta fase.
 *
 * Cliente logado → reaproveita qa_cliente vinculado.
 * Cliente público → coleta nome/CPF/e-mail/celular e a edge function
 * `qa-checkout-criar-venda` reaproveita por CPF/e-mail ou cria novo cadastro.
 */
type BillingType = "PIX" | "BOLETO" | "CREDIT_CARD";

interface VendaCriada {
  venda_id: number;
  checkout_token: string;
  total: number;
}

interface CobrancaResult {
  asaas_payment_id?: string | null;
  asaas_invoice_url?: string | null;
  asaas_bank_slip_url?: string | null;
  asaas_pix_payload?: string | null;
  asaas_due_date?: string | null;
  cobranca_status?: string | null;
  billing_type?: BillingType;
  reused?: boolean;
}

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

  async function handleFinalizar() {
    if (!podeFinalizar) return;
    setSubmitting(true);
    try {
      const cart = items.map((i) => ({
        servico_id: i.service_id,
        slug: i.service_slug,
        quantidade: i.quantity,
      }));
      const payload: any = { cart };
      if (!isLogged) {
        payload.identificacao = {
          nome_completo: nome,
          cpf,
          email,
          celular,
        };
      }
      const { data, error } = await supabase.functions.invoke(
        "qa-checkout-criar-venda",
        { body: payload },
      );
      if (error) throw error;
      const r = data as any;
      if (!r?.ok || !r?.venda_id || !r?.checkout_token) {
        throw new Error(r?.error || "Falha ao criar venda");
      }
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
      const { data, error } = await supabase.functions.invoke(
        "qa-checkout-iniciar-pagamento",
        {
          body: {
            venda_id: venda.venda_id,
            checkout_token: venda.checkout_token,
            billing_type: billingType,
          },
        },
      );
      if (error) throw error;
      const r = data as any;
      if (!r?.success && !r?.asaas_payment_id) {
        throw new Error(r?.error || "Falha ao gerar cobrança");
      }
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

  function copy(text: string, label = "Copiado") {
    if (!text) return;
    navigator.clipboard?.writeText(text).then(() => toast.success(label));
  }

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-accent" />
      </div>
    );
  }

  return (
    <div className="qa-scope min-h-screen bg-background">
      <div className="container max-w-3xl py-10">
        <div className="mb-6">
          <Link to="/carrinho" className="text-xs uppercase tracking-widest text-muted-foreground hover:text-accent">
            ← Voltar ao carrinho
          </Link>
          <h1 className="mt-3 font-heading text-2xl font-bold uppercase tracking-tight sm:text-3xl">
            Finalizar compra
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Confirme seus dados, crie o pedido e gere o pagamento.
          </p>
        </div>

        {/* PASSO 3 — cobrança gerada */}
        {cobranca && (
          <div className="rounded-lg border border-border bg-surface-elevated/30 p-5 mb-5">
            <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-emerald-600 mb-3">
              <CheckCircle2 className="h-3.5 w-3.5" /> Aguardando pagamento
            </div>
            <p className="text-sm text-muted-foreground mb-3">
              Pedido <strong>#{venda?.venda_id}</strong> ·{" "}
              {cobranca.asaas_due_date && (
                <>Vencimento: <strong>{cobranca.asaas_due_date}</strong></>
              )}
            </p>

            {cobranca.billing_type === "PIX" && cobranca.asaas_pix_payload && (
              <div className="rounded-md border border-border p-3 mb-3">
                <div className="text-[11px] uppercase tracking-widest text-muted-foreground mb-2 flex items-center gap-2">
                  <QrCode className="h-3.5 w-3.5" /> PIX copia e cola
                </div>
                <textarea
                  readOnly
                  className="w-full text-xs font-mono p-2 border rounded bg-muted/40 break-all"
                  rows={4}
                  value={cobranca.asaas_pix_payload}
                />
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2"
                  onClick={() => copy(cobranca.asaas_pix_payload!, "Código PIX copiado")}
                >
                  <Copy className="mr-2 h-3.5 w-3.5" /> Copiar código PIX
                </Button>
              </div>
            )}

            {cobranca.billing_type === "BOLETO" && cobranca.asaas_bank_slip_url && (
              <a
                href={cobranca.asaas_bank_slip_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm hover:bg-muted/40"
              >
                <Barcode className="h-4 w-4" /> Abrir boleto
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            )}

            {cobranca.asaas_invoice_url && (
              <div className="mt-2">
                <a
                  href={cobranca.asaas_invoice_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-sm text-accent underline"
                >
                  Abrir fatura completa <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </div>
            )}

            <p className="mt-4 text-xs text-muted-foreground">
              Assim que confirmarmos seu pagamento, você receberá um e-mail e o acesso ao
              portal será liberado.
            </p>
          </div>
        )}

        {/* PASSO 2 — escolher forma de pagamento (após venda criada) */}
        {venda && !cobranca && (
          <div className="rounded-lg border border-border bg-surface-elevated/30 p-5 mb-5">
            <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-3">
              Forma de pagamento
            </div>
            <div className="grid grid-cols-3 gap-2">
              {(["PIX", "BOLETO", "CREDIT_CARD"] as BillingType[]).map((t) => {
                const Icon = t === "PIX" ? QrCode : t === "BOLETO" ? Barcode : CreditCard;
                const label = t === "PIX" ? "PIX" : t === "BOLETO" ? "Boleto" : "Cartão";
                const active = billingType === t;
                return (
                  <button
                    key={t}
                    onClick={() => setBillingType(t)}
                    className={`flex flex-col items-center gap-1 rounded-md border px-3 py-3 text-xs font-bold uppercase tracking-wider transition ${
                      active ? "border-accent bg-accent/10 text-accent" : "border-border text-muted-foreground hover:border-accent/40"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {label}
                  </button>
                );
              })}
            </div>
            <Button
              onClick={handleIniciarPagamento}
              disabled={paying}
              size="lg"
              className="w-full mt-4 font-heading uppercase tracking-wide"
            >
              {paying ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Gerando cobrança...</>
              ) : (
                <><Lock className="mr-2 h-4 w-4" /> Gerar cobrança</>
              )}
            </Button>
          </div>
        )}

        {/* PASSO 1 — só se a venda ainda não foi criada */}
        {!venda && (
        <>

        <div className="rounded-lg border border-border bg-surface-elevated/30 p-5 mb-5">
          <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-3">
            <ShoppingCart className="h-3.5 w-3.5" /> Resumo do pedido
          </div>
          <ul className="divide-y divide-border">
            {snapshot.lines.map((l) => (
              <li key={l.service_id} className="py-2 flex items-center justify-between text-sm">
                <div className="min-w-0">
                  <div className="font-medium uppercase tracking-tight truncate">{l.service_name}</div>
                  <div className="text-xs text-muted-foreground">
                    {formatBRL(l.unit_price_cents)} × {l.quantity}
                  </div>
                </div>
                <div className="font-bold text-accent ml-3 shrink-0">
                  {formatBRL(l.subtotal_cents)}
                </div>
              </li>
            ))}
          </ul>
          <div className="mt-3 pt-3 border-t border-border flex items-center justify-between">
            <span className="text-xs uppercase tracking-widest text-muted-foreground">Total</span>
            <span className="text-xl font-extrabold text-accent">{formatBRL(totalCents)}</span>
          </div>
        </div>

        {isLogged ? (
          <div className="rounded-lg border border-border bg-surface-elevated/20 p-5 mb-5">
            <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-1">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> Identificação
            </div>
            <p className="text-sm">
              Logado como <strong>{user?.email}</strong>. Vamos vincular o pedido ao seu cadastro.
            </p>
          </div>
        ) : (
          <div className="rounded-lg border border-border bg-surface-elevated/20 p-5 mb-5 space-y-3">
            <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
              Identificação
            </div>
            <p className="text-xs text-muted-foreground">
              Já tem conta?{" "}
              <Link to="/area-do-cliente/login" className="underline">
                Entrar
              </Link>
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2">
                <Label>Nome completo</Label>
                <Input value={nome} onChange={(e) => setNome(e.target.value.toUpperCase())} />
              </div>
              <div>
                <Label>CPF</Label>
                <Input value={cpf} onChange={(e) => setCpf(e.target.value)} placeholder="000.000.000-00" />
              </div>
              <div>
                <Label>Celular</Label>
                <Input value={celular} onChange={(e) => setCelular(e.target.value)} placeholder="(00) 00000-0000" />
              </div>
              <div className="sm:col-span-2">
                <Label>E-mail</Label>
                <Input value={email} onChange={(e) => setEmail(e.target.value)} type="email" />
              </div>
            </div>
            {!identificacaoOk && (nome || cpf || email || celular) && (
              <div className="flex items-start gap-2 text-xs text-amber-600">
                <AlertCircle className="h-4 w-4 shrink-0" />
                Preencha nome, CPF, e-mail e celular válidos.
              </div>
            )}
          </div>
        )}

        <label className="flex items-start gap-2 text-sm mb-5 cursor-pointer">
          <input
            type="checkbox"
            checked={aceite}
            onChange={(e) => setAceite(e.target.checked)}
            className="mt-0.5"
          />
          <span className="text-muted-foreground">
            Confirmo os dados e autorizo a Quero Armas a iniciar o atendimento. O pagamento será
            gerado em seguida.
          </span>
        </label>

        <Button
          onClick={handleFinalizar}
          disabled={!podeFinalizar}
          size="lg"
          className="w-full font-heading uppercase tracking-wide"
        >
          {submitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Registrando pedido...
            </>
          ) : (
            <>
              <Lock className="mr-2 h-4 w-4" />
              Finalizar compra
            </>
          )}
        </Button>
        </>
        )}
      </div>
    </div>
  );
}