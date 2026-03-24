import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AlertTriangle, Check, Copy, ExternalLink, KeyRound, Loader2, MessageCircle, RefreshCw } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import WhatsAppButton from "@/components/WhatsAppButton";
import SeoHead from "@/components/SeoHead";
import { Button } from "@/components/ui/button";
import { ensurePortalAccess, fetchPurchaseInfo, type ClientCredentials, type PurchaseInfo } from "@/lib/postPurchase";

const AtivacaoAcessoPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const quoteId = searchParams.get("quote");
  const [purchase, setPurchase] = useState<PurchaseInfo | null>(null);
  const [credentials, setCredentials] = useState<ClientCredentials | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<"email" | "password" | "">("");

  const whatsappHref = useMemo(() => {
    const text = encodeURIComponent("Olá! Preciso de ajuda com a liberação do meu acesso ao portal do cliente.");
    return `https://wa.me/5511963166915?text=${text}`;
  }, []);

  const copyValue = async (value: string, field: "email" | "password") => {
    await navigator.clipboard.writeText(value);
    setCopied(field);
    window.setTimeout(() => setCopied(""), 1800);
  };

  const loadAccess = async () => {
    if (!quoteId) {
      setError("Pedido não identificado.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const [purchaseData, access] = await Promise.all([
        fetchPurchaseInfo(quoteId),
        ensurePortalAccess(quoteId),
      ]);

      setPurchase(purchaseData);

      if (!access.success || !access.email || !access.temp_password) {
        throw new Error(access.error || "Não foi possível liberar o acesso agora.");
      }

      setCredentials({
        email: access.email,
        temp_password: access.temp_password,
        password_change_required: access.password_change_required ?? true,
        user_created: access.user_created,
        user_recovered: access.user_recovered,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao liberar o acesso.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAccess();
  }, [quoteId]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SeoHead title="Acesso liberado | WMTi" description="Ative seu acesso ao portal do cliente após a confirmação do pagamento." />
      <Navbar />

      <main className="section-dark pt-24 md:pt-28 pb-20">
        <div className="container max-w-3xl space-y-6">
          <div className="space-y-3 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-primary/25 bg-primary/10">
              <KeyRound className="h-8 w-8 text-primary" />
            </div>
            <h1 className="text-3xl font-heading font-bold">Liberação do acesso ao portal</h1>
            <p className="text-sm text-muted-foreground">Aqui o sistema finaliza sua liberação, recupera credenciais pendentes e entrega seu acesso sem depender do webhook.</p>
          </div>

          <section className="rounded-2xl border border-border bg-card p-5 md:p-6 space-y-5 shadow-lg">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-primary">Status da contratação</p>
                <h2 className="mt-1 text-xl font-heading font-bold">Acesso ao portal liberado sob demanda</h2>
              </div>
              <span className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                Pagamento validado
              </span>
            </div>

            {loading ? (
              <div className="flex items-center justify-center gap-3 rounded-xl border border-primary/15 bg-primary/5 px-4 py-10 text-sm text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                Validando pagamento, corrigindo o acesso e preparando suas credenciais...
              </div>
            ) : error ? (
              <div className="space-y-4 rounded-xl border border-destructive/30 bg-destructive/10 p-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="mt-0.5 h-5 w-5 text-destructive" />
                  <div>
                    <p className="font-semibold text-foreground">Não foi possível liberar o acesso agora</p>
                    <p className="text-sm text-muted-foreground">{error}</p>
                  </div>
                </div>
                <div className="flex flex-col gap-3 sm:flex-row">
                  <Button onClick={loadAccess} className="sm:flex-1">
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Gerar acesso agora
                  </Button>
                  <Button variant="outline" className="sm:flex-1" onClick={() => navigate(`/compra-concluida?quote=${quoteId}`)}>
                    Voltar ao comprovante
                  </Button>
                </div>
              </div>
            ) : credentials ? (
              <div className="space-y-5">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-xl border border-border bg-muted/30 p-4">
                    <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Login</p>
                    <div className="mt-2 flex items-center justify-between gap-3">
                      <p className="min-w-0 truncate font-mono text-sm text-foreground">{credentials.email}</p>
                      <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" onClick={() => copyValue(credentials.email, "email")}>{copied === "email" ? <Check className="h-4 w-4 text-primary" /> : <Copy className="h-4 w-4" />}</Button>
                    </div>
                  </div>

                  <div className="rounded-xl border border-primary/25 bg-primary/5 p-4">
                    <p className="text-[11px] uppercase tracking-[0.2em] text-primary">Senha temporária</p>
                    <div className="mt-2 flex items-center justify-between gap-3">
                      <p className="min-w-0 truncate font-mono text-sm font-bold text-primary">{credentials.temp_password}</p>
                      <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" onClick={() => copyValue(credentials.temp_password, "password")}>{copied === "password" ? <Check className="h-4 w-4 text-primary" /> : <Copy className="h-4 w-4" />}</Button>
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-100">
                  <p className="font-semibold">Troca obrigatória de senha no primeiro acesso</p>
                  <p className="mt-1 text-amber-100/80">Entre com estas credenciais, defina sua nova senha e pronto: o acesso fica regularizado para sua empresa.</p>
                </div>

                {purchase && (
                  <div className="rounded-xl border border-border bg-background/40 p-4 text-sm">
                    <p className="font-semibold text-foreground">{purchase.serviceName}</p>
                    <p className="mt-1 text-muted-foreground">{purchase.customerName} • {purchase.purchaseDate}</p>
                  </div>
                )}

                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <Button onClick={() => navigate("/area-do-cliente")} className="w-full">
                    <ExternalLink className="mr-2 h-4 w-4" />
                    Acessar portal
                  </Button>
                  <Button variant="outline" onClick={() => navigate(`/contrato-final/${quoteId}`)} className="w-full">
                    Baixar comprovante
                  </Button>
                  <Button variant="outline" onClick={() => copyValue(credentials.email, "email")} className="w-full">
                    Copiar login
                  </Button>
                  <a href={whatsappHref} target="_blank" rel="noreferrer" className="inline-flex h-10 items-center justify-center rounded-md border border-border px-4 text-sm font-medium hover:bg-muted">
                    <MessageCircle className="mr-2 h-4 w-4" />
                    WhatsApp
                  </a>
                </div>
              </div>
            ) : null}
          </section>
        </div>
      </main>

      <Footer />
      <WhatsAppButton />
    </div>
  );
};

export default AtivacaoAcessoPage;