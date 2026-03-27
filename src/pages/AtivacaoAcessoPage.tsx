import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { AlertTriangle, Check, Copy, ExternalLink, KeyRound, Loader2, MessageCircle, RefreshCw } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import SeoHead from "@/components/SeoHead";
import { Button } from "@/components/ui/button";
import { ErrorBlock } from "@/components/ui/ErrorBlock";
import { ensurePortalAccess, fetchPurchaseInfo, type ClientCredentials, type PurchaseInfo } from "@/lib/postPurchase";
import { logAndPersistError, type WmtiError } from "@/lib/errorLogger";
import { openWhatsAppRaw } from "@/lib/whatsapp";

const AtivacaoAcessoPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const quoteId = searchParams.get("quote");
  const [purchase, setPurchase] = useState<PurchaseInfo | null>(null);
  const [credentials, setCredentials] = useState<ClientCredentials | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastError, setLastError] = useState<WmtiError | null>(null);
  const [copied, setCopied] = useState<"email" | "password" | "">("");

  const handleWhatsAppHelp = () => {
    openWhatsAppRaw(t("ativacao.whatsAppMsg"));
  };

  const copyValue = async (value: string, field: "email" | "password") => {
    await navigator.clipboard.writeText(value);
    setCopied(field);
    window.setTimeout(() => setCopied(""), 1800);
  };

  const loadAccess = async () => {
    if (!quoteId) {
      setError(t("ativacao.errorNoQuote"));
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    setLastError(null);

    try {
      const [purchaseData, access] = await Promise.all([
        fetchPurchaseInfo(quoteId),
        ensurePortalAccess(quoteId),
      ]);

      setPurchase(purchaseData);

      if (!access.success || !access.email || !access.temp_password) {
        throw new Error(access.error || t("ativacao.errorGeneric"));
      }

      setCredentials({
        email: access.email,
        temp_password: access.temp_password,
        password_change_required: access.password_change_required ?? true,
        user_created: access.user_created,
        user_recovered: access.user_recovered,
      });
    } catch (err) {
      const wmtiErr = await logAndPersistError({
        action: "ativacao_acesso",
        message: err instanceof Error ? err.message : t("ativacao.errorAction"),
        error: err,
        quoteId: quoteId || undefined,
        functionName: "ensure-client-access",
      });
      setError(wmtiErr.message);
      setLastError(wmtiErr);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAccess();
  }, [quoteId]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SeoHead title={t("ativacao.title")} description={t("ativacao.metaDescription")} />
      <Navbar />

      <main className="section-dark pt-24 md:pt-28 pb-20">
        <div className="container max-w-3xl space-y-6">
          <div className="space-y-3 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-primary/25 bg-primary/10">
              <KeyRound className="h-8 w-8 text-primary" />
            </div>
            <h1 className="text-3xl font-heading font-bold">{t("ativacao.heading")}</h1>
            <p className="text-sm text-muted-foreground">{t("ativacao.subtitle")}</p>
          </div>

          <section className="rounded-2xl border border-border bg-card p-5 md:p-6 space-y-5 shadow-lg">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-primary">{t("ativacao.statusLabel")}</p>
                <h2 className="mt-1 text-xl font-heading font-bold">{t("ativacao.statusHeading")}</h2>
              </div>
              <span className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                {t("ativacao.statusBadge")}
              </span>
            </div>

            {loading ? (
              <div className="flex items-center justify-center gap-3 rounded-xl border border-primary/15 bg-primary/5 px-4 py-10 text-sm text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                {t("ativacao.loadingMsg")}
              </div>
            ) : error ? (
              <ErrorBlock
                title={t("ativacao.errorTitle")}
                message={error}
                error={lastError}
                onRetry={loadAccess}
                retryLabel={t("ativacao.retryLabel")}
              />
            ) : credentials ? (
              <div className="space-y-5">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-xl border border-border bg-muted/30 p-4">
                    <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">{t("ativacao.loginLabel")}</p>
                    <div className="mt-2 flex items-center justify-between gap-3">
                      <p className="min-w-0 truncate font-mono text-sm text-foreground">{credentials.email}</p>
                      <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" onClick={() => copyValue(credentials.email, "email")}>{copied === "email" ? <Check className="h-4 w-4 text-primary" /> : <Copy className="h-4 w-4" />}</Button>
                    </div>
                  </div>

                  <div className="rounded-xl border border-primary/25 bg-primary/5 p-4">
                    <p className="text-[11px] uppercase tracking-[0.2em] text-primary">{t("ativacao.passwordLabel")}</p>
                    <div className="mt-2 flex items-center justify-between gap-3">
                      <p className="min-w-0 truncate font-mono text-sm font-bold text-primary">{credentials.temp_password}</p>
                      <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" onClick={() => copyValue(credentials.temp_password, "password")}>{copied === "password" ? <Check className="h-4 w-4 text-primary" /> : <Copy className="h-4 w-4" />}</Button>
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-100">
                  <p className="font-semibold">{t("ativacao.passwordWarningTitle")}</p>
                  <p className="mt-1 text-amber-100/80">{t("ativacao.passwordWarningDesc")}</p>
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
                    {t("ativacao.btnPortal")}
                  </Button>
                  <Button variant="outline" onClick={() => navigate(`/contrato-final/${quoteId}`)} className="w-full">
                    {t("ativacao.btnReceipt")}
                  </Button>
                  <Button variant="outline" onClick={() => copyValue(credentials.email, "email")} className="w-full">
                    {t("ativacao.btnCopyLogin")}
                  </Button>
                  <button onClick={handleWhatsAppHelp} className="inline-flex h-10 items-center justify-center rounded-md border border-border px-4 text-sm font-medium hover:bg-muted">
                    <MessageCircle className="mr-2 h-4 w-4" />
                    {t("ativacao.btnWhatsApp")}
                  </button>
                </div>
              </div>
            ) : null}
          </section>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default AtivacaoAcessoPage;