import { useEffect, useMemo, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Loader2, ShoppingCart, Lock, CheckCircle2, AlertCircle } from "lucide-react";
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
export default function QACheckoutFinalizarPage() {
  const navigate = useNavigate();
  const { items, totalCents, itemCount, clear } = useCart();
  const { user, loading: authLoading } = useAuth();

  const [submitting, setSubmitting] = useState(false);
  const [nome, setNome] = useState("");
  const [cpf, setCpf] = useState("");
  const [email, setEmail] = useState("");
  const [celular, setCelular] = useState("");
  const [aceite, setAceite] = useState(false);

  useEffect(() => {
    if (!authLoading && itemCount === 0) {
      navigate("/carrinho", { replace: true });
    }
  }, [authLoading, itemCount, navigate]);

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
      if (!r?.ok || !r?.venda_id) {
        throw new Error(r?.error || "Falha ao criar venda");
      }
      const slug = items[0]?.service_slug || "servico";
      toast.success("Pedido registrado! Em breve você receberá as instruções de pagamento.");
      clear();
      navigate(
        `/area-do-cliente/contratar/${slug}/sucesso?venda=${r.venda_id}`,
        { replace: true },
      );
    } catch (e: any) {
      console.error("[checkout/finalizar]", e);
      toast.error(e?.message || "Não foi possível finalizar a compra.");
    } finally {
      setSubmitting(false);
    }
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
            Confirme seus dados e crie seu pedido. O pagamento será gerado na sequência.
          </p>
        </div>

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
      </div>
    </div>
  );
}