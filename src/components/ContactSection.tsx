import { useState } from "react";
import { useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { ArrowRight, Send, Loader2, MessageCircle, Mail, MapPin, Phone } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { openWhatsApp, openWhatsAppRaw, WHATSAPP_DISPLAY } from "@/lib/whatsapp";
import { trackWhatsApp, track } from "@/lib/tracking";

const ContactSection = () => {
  const { t } = useTranslation();
  const serviceOptions = t("contact.serviceOptions", { returnObjects: true }) as string[];

  const [form, setForm] = useState({
    nome: "",
    email: "",
    telefone: "",
    empresa: "",
    interesse: "",
    mensagem: "",
  });
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const location = useLocation();

  const getUtmParams = () => {
    const params = new URLSearchParams(window.location.search);
    return {
      utm_source: params.get("utm_source") || null,
      utm_medium: params.get("utm_medium") || null,
      utm_campaign: params.get("utm_campaign") || null,
    };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nome || !form.email || !form.mensagem) {
      toast({ title: t("contact.preencherCampos"), variant: "destructive" });
      return;
    }

    setLoading(true);
    const utm = getUtmParams();

    try {
      const { data, error: fnError } = await supabase.functions.invoke("submit-lead", {
        body: {
          name: form.nome,
          email: form.email,
          phone: form.telefone || null,
          company: form.empresa || null,
          service_interest: form.interesse || null,
          message: form.mensagem,
          source_page: location.pathname,
          ...utm,
        },
      });

      if (fnError) throw fnError;
      if (data && !data.success) {
        const msgs = (data.errors as string[]) || ["Erro desconhecido"];
        toast({ title: msgs.join(". "), variant: "destructive" });
        setLoading(false);
        return;
      }

      toast({ title: t("contact.sucesso") });

      const waMsg = `*Solicitação de Orçamento — WMTi*\n\n*Nome:* ${form.nome}\n*Email:* ${form.email}\n*Telefone:* ${form.telefone || "Não informado"}\n*Empresa:* ${form.empresa || "Não informada"}\n*Interesse:* ${form.interesse || "Não informado"}\n\n*Mensagem:*\n${form.mensagem}`;

      track("form_submit", "contact-form", { interesse: form.interesse });
      setTimeout(() => {
        trackWhatsApp("contact-form", "orcamento");
        openWhatsAppRaw(waMsg);
      }, 1000);

      setForm({ nome: "", email: "", telefone: "", empresa: "", interesse: "", mensagem: "" });
    } catch {
      toast({ title: t("contact.erro"), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleWhatsApp = () => {
    trackWhatsApp("contact-section", "orcamento");
    openWhatsApp({ intent: "general" });
  };

  return (
    <section id="contato" className="py-24 md:py-32 bg-background">
      <div id="orcamento" className="container">
        <div className="grid lg:grid-cols-2 gap-16 md:gap-24">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="flex flex-col justify-between"
          >
            <div>
              <p className="font-mono text-xs tracking-[0.3em] uppercase text-primary mb-4">
                {t("contact.tag")}
              </p>
              <h2 className="text-2xl md:text-4xl lg:text-5xl font-bold mb-5 md:mb-6 leading-tight">
                {t("contact.title1")}
                <br />
                <span className="text-primary">{t("contact.title2")}</span>
              </h2>
              <p className="font-body text-muted-foreground text-base md:text-lg max-w-lg leading-relaxed mb-8 md:mb-10">
                {t("contact.desc")}
              </p>
            </div>

            <div className="space-y-4">
              <p className="font-mono text-[10px] tracking-[0.3em] uppercase text-primary/70 mb-1">
                {t("contact.channels")}
              </p>
              <a href="mailto:contato@wmti.com.br" className="flex items-center gap-3 group">
                <span className="flex items-center justify-center w-9 h-9 rounded-md bg-primary/10 text-primary group-hover:bg-primary/20 transition-colors">
                  <Mail size={16} />
                </span>
                <span className="font-mono text-sm text-muted-foreground group-hover:text-foreground transition-colors">
                  contato@wmti.com.br
                </span>
              </a>
              <a href={WHATSAPP_BASE_URL} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 group">
                <span className="flex items-center justify-center w-9 h-9 rounded-md bg-primary/10 text-primary group-hover:bg-primary/20 transition-colors">
                  <Phone size={16} />
                </span>
                <span className="font-mono text-sm text-muted-foreground group-hover:text-foreground transition-colors">
                  (11) 96316-6915
                </span>
              </a>
              <div className="flex items-start gap-3">
                <span className="flex items-center justify-center w-9 h-9 rounded-md bg-primary/10 text-primary shrink-0">
                  <MapPin size={16} />
                </span>
                <span className="font-mono text-sm text-muted-foreground leading-relaxed">
                  Rua José Benedito Duarte, 140
                  <br />
                  Parque Itamarati — Jacareí, SP
                </span>
              </div>
            </div>
          </motion.div>

          <motion.form
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="space-y-6 md:space-y-7 bg-card border border-border p-7 md:p-9 lg:p-12 shadow-[0_10px_50px_rgba(0,0,0,0.4)]"
            style={{ borderRadius: "var(--radius)" }}
            onSubmit={handleSubmit}
          >
            <h3 className="font-heading text-xl md:text-2xl font-semibold tracking-wide text-primary mb-6">
              {t("contact.formTitle")}
            </h3>

            {[
              { label: t("contact.nome"), key: "nome" as const, type: "text", placeholder: t("contact.nomePlaceholder") },
              { label: t("contact.email"), key: "email" as const, type: "email", placeholder: t("contact.emailPlaceholder") },
              { label: t("contact.telefone"), key: "telefone" as const, type: "tel", placeholder: t("contact.telefonePlaceholder") },
              { label: t("contact.empresa"), key: "empresa" as const, type: "text", placeholder: t("contact.empresaPlaceholder") },
            ].map((field) => (
              <div key={field.key}>
                <label className="font-mono text-xs tracking-[0.2em] uppercase text-primary mb-2 block">
                  {field.label}
                </label>
                <input
                  type={field.type}
                  placeholder={field.placeholder}
                  value={form[field.key]}
                  onChange={(e) => setForm((prev) => ({ ...prev, [field.key]: e.target.value }))}
                  className="w-full bg-input border border-border px-4 py-3.5 font-body text-sm md:text-base text-foreground placeholder:text-muted-foreground/50 focus:border-primary focus:outline-none transition-colors"
                  style={{ borderRadius: "var(--radius)" }}
                />
              </div>
            ))}

            <div>
              <label className="font-mono text-xs tracking-[0.2em] uppercase text-primary mb-2 block">
                {t("contact.interesse")}
              </label>
              <select
                value={form.interesse}
                onChange={(e) => setForm((prev) => ({ ...prev, interesse: e.target.value }))}
                className="w-full bg-input border border-border px-4 py-3.5 font-body text-sm md:text-base text-foreground focus:border-primary focus:outline-none transition-colors"
                style={{ borderRadius: "var(--radius)" }}
              >
                <option value="" className="bg-secondary">{t("contact.interesseDefault")}</option>
                {serviceOptions.map((opt) => (
                  <option key={opt} value={opt} className="bg-secondary">{opt}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="font-mono text-xs tracking-[0.2em] uppercase text-primary mb-2 block">
                {t("contact.mensagem")}
              </label>
              <textarea
                rows={4}
                placeholder={t("contact.mensagemPlaceholder")}
                value={form.mensagem}
                onChange={(e) => setForm((prev) => ({ ...prev, mensagem: e.target.value }))}
                className="w-full bg-input border border-border px-4 py-3.5 font-body text-sm md:text-base text-foreground placeholder:text-muted-foreground/50 focus:border-primary focus:outline-none transition-colors resize-none"
                style={{ borderRadius: "var(--radius)" }}
              />
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                type="submit"
                disabled={loading}
                className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-8 py-4 font-mono text-sm font-bold uppercase tracking-wider hover:brightness-110 transition-all flex-1 justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ borderRadius: "var(--radius)" }}
              >
                {loading ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Send size={16} />
                )}
                {loading ? t("contact.btnEnviando") : t("contact.btnEnviar")}
                {!loading && <ArrowRight size={16} />}
              </button>
              <button
                type="button"
                onClick={handleWhatsApp}
                className="inline-flex items-center gap-2 border border-primary/40 text-primary px-6 py-4 font-mono text-sm font-bold uppercase tracking-wider hover:bg-primary/10 transition-all justify-center"
                style={{ borderRadius: "var(--radius)" }}
              >
                <MessageCircle size={16} />
                {t("contact.btnWhatsapp")}
              </button>
            </div>
          </motion.form>
        </div>
      </div>
    </section>
  );
};

export default ContactSection;
