import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Send, Loader2, CheckCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const OrcamentoLeadHero = () => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const serviceOptions = t("orcamentoHero.serviceOptions", { returnObjects: true }) as string[];
  const rawInterest = searchParams.get("interesse") || searchParams.get("servico") || "";
  const initialInterest = rawInterest
    ? serviceOptions.find((o) => o.toLowerCase().includes(rawInterest.toLowerCase())) || rawInterest
    : "";

  const [form, setForm] = useState({
    nome: "",
    email: "",
    telefone: "",
    empresa: "",
    interesse: initialInterest,
    mensagem: "",
  });
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nome || !form.email || !form.mensagem) {
      toast({ title: t("orcamentoHero.errorRequired"), variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.functions.invoke("submit-lead", {
        body: {
          name: form.nome,
          email: form.email,
          phone: form.telefone || null,
          company: form.empresa || null,
          service_interest: form.interesse || null,
          message: form.mensagem,
          source_page: "/orcamento-ti",
        },
      });
      if (error) throw error;
      setSubmitted(true);
      toast({ title: t("orcamentoHero.successToast") });
    } catch {
      toast({ title: t("orcamentoHero.errorSubmit"), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const set = (key: string, val: string) => setForm((p) => ({ ...p, [key]: val }));

  const inputCls =
    "w-full bg-input border border-border px-4 py-3.5 font-body text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-primary focus:outline-none transition-colors rounded";

  return (
    <section className="relative py-20 md:py-28 section-dark overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-background via-card to-background opacity-80" />
      <div className="absolute top-20 right-10 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />

      <div className="container relative z-10">
        <div className="grid lg:grid-cols-2 gap-12 md:gap-20 items-start">
          {/* LEFT: Copy */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <p className="font-mono text-xs tracking-[0.3em] uppercase text-primary mb-4">
              // {t("orcamentoHero.tag", { defaultValue: "SEM COMPROMISSO" })}
            </p>
            <h1 className="text-3xl md:text-4xl lg:text-5xl font-heading font-bold mb-6 leading-tight">
              {t("orcamentoHero.title1", { defaultValue: "Receba uma proposta" })}
              <br />
              <span className="text-primary">
                {t("orcamentoHero.title2", { defaultValue: "em até 48 horas." })}
              </span>
            </h1>
            <p className="font-body text-muted-foreground text-base md:text-lg max-w-lg leading-relaxed mb-8">
              {t("orcamentoHero.desc", {
                defaultValue:
                  "Preencha o formulário, conte sua situação e receba um diagnóstico gratuito com proposta de valor fixo mensal. Sem letra miúda, sem surpresas, sem enrolação.",
              })}
            </p>

            <div className="space-y-3">
              {[
                t("orcamentoHero.b1", { defaultValue: "Diagnóstico técnico gratuito" }),
                t("orcamentoHero.b2", { defaultValue: "Proposta com valor fixo mensal" }),
                t("orcamentoHero.b3", { defaultValue: "Resposta em até 48 horas" }),
                t("orcamentoHero.b4", { defaultValue: "Sem compromisso ou fidelidade forçada" }),
              ].map((b) => (
                <div key={b} className="flex items-center gap-2 text-sm text-foreground/90">
                  <CheckCircle className="w-4 h-4 text-primary shrink-0" />
                  <span>{b}</span>
                </div>
              ))}
            </div>
          </motion.div>

          {/* RIGHT: Form */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.15 }}
          >
            {submitted ? (
              <div className="bg-card border border-primary/20 rounded-lg p-10 text-center space-y-4">
                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
                  <Send className="w-8 h-8 text-primary" />
                </div>
                <h3 className="text-xl font-heading font-bold">{t("orcamentoHero.successTitle")}</h3>
                <p className="text-muted-foreground text-sm">
                  {t("orcamentoHero.successDesc")}
                </p>
              </div>
            ) : (
              <form
                onSubmit={handleSubmit}
                className="bg-card border border-border rounded-lg p-7 md:p-9 space-y-5"
              >
                <h3 className="font-heading text-lg font-semibold text-primary mb-2">{t("orcamentoHero.formTitle")}</h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="font-mono text-xs tracking-[0.2em] uppercase text-primary mb-1.5 block">
                      {t("orcamentoHero.labelNome")} *
                    </label>
                    <input className={inputCls} value={form.nome} onChange={(e) => set("nome", e.target.value)} placeholder={t("orcamentoHero.placeholderNome")} required />
                  </div>
                  <div>
                    <label className="font-mono text-xs tracking-[0.2em] uppercase text-primary mb-1.5 block">
                      {t("orcamentoHero.labelEmail")} *
                    </label>
                    <input type="email" className={inputCls} value={form.email} onChange={(e) => set("email", e.target.value)} placeholder={t("orcamentoHero.placeholderEmail")} required />
                  </div>
                  <div>
                    <label className="font-mono text-xs tracking-[0.2em] uppercase text-primary mb-1.5 block">
                      {t("orcamentoHero.labelTelefone")}
                    </label>
                    <input className={inputCls} value={form.telefone} onChange={(e) => set("telefone", e.target.value)} placeholder={t("orcamentoHero.placeholderTelefone")} />
                  </div>
                  <div>
                    <label className="font-mono text-xs tracking-[0.2em] uppercase text-primary mb-1.5 block">
                      {t("orcamentoHero.labelEmpresa")}
                    </label>
                    <input className={inputCls} value={form.empresa} onChange={(e) => set("empresa", e.target.value)} placeholder={t("orcamentoHero.placeholderEmpresa")} />
                  </div>
                </div>

                <div>
                  <label className="font-mono text-xs tracking-[0.2em] uppercase text-primary mb-1.5 block">
                    {t("orcamentoHero.labelInteresse")}
                  </label>
                  <select
                    className={inputCls}
                    value={form.interesse}
                    onChange={(e) => set("interesse", e.target.value)}
                  >
                    <option value="">{t("orcamentoHero.placeholderInteresse")}</option>
                    {serviceOptions.map((o) => (
                      <option key={o} value={o}>{o}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-mono text-xs tracking-[0.2em] uppercase text-primary mb-1.5 block">
                    {t("orcamentoHero.labelMensagem")} *
                  </label>
                  <textarea
                    rows={3}
                    className={`${inputCls} resize-none`}
                    value={form.mensagem}
                    onChange={(e) => set("mensagem", e.target.value)}
                    placeholder={t("orcamentoHero.placeholderMensagem")}
                    required
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full inline-flex items-center justify-center gap-2 bg-primary text-primary-foreground px-8 py-4 font-mono text-sm font-bold uppercase tracking-wider hover:brightness-110 transition-all rounded disabled:opacity-50"
                >
                  {loading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                  {loading ? t("orcamentoHero.submitting") : t("orcamentoHero.submitBtn")}
                </button>
              </form>
            )}
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default OrcamentoLeadHero;
