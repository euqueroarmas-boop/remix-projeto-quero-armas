import { useState } from "react";
import { useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { Send, Loader2, MessageCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { openWhatsApp } from "@/lib/whatsapp";
import { trackWhatsApp, track } from "@/lib/tracking";

interface ServiceContactFormProps {
  serviceName: string;
  /** Extra context from calculator (e.g. "3 horas selecionadas — R$ 540") */
  calculatorContext?: string;
}

const ServiceContactForm = ({ serviceName, calculatorContext }: ServiceContactFormProps) => {
  const { t } = useTranslation();
  const location = useLocation();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    nome: "",
    email: "",
    whatsapp: "",
    empresa: "",
    mensagem: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nome || !form.email || !form.mensagem) {
      toast({ title: "Preencha os campos obrigatórios.", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.functions.invoke("submit-lead", {
        body: {
          name: form.nome,
          email: form.email,
          phone: form.whatsapp || null,
          company: form.empresa || null,
          service_interest: serviceName,
          message: `${form.mensagem}${calculatorContext ? `\n\n[Contexto do cálculo: ${calculatorContext}]` : ""}`,
          source_page: location.pathname,
        },
      });
      if (error) throw error;
      toast({ title: "Mensagem enviada com sucesso!" });
      track("form_submit", "service-contact-form", { service: serviceName });
      setForm({ nome: "", email: "", whatsapp: "", empresa: "", mensagem: "" });
    } catch {
      toast({ title: "Erro ao enviar. Tente novamente.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="py-16 md:py-20 bg-background" data-section-type="contact-form">
      <div className="container max-w-2xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <p className="font-mono text-xs tracking-[0.3em] uppercase text-primary mb-4">
            // FALE CONOSCO
          </p>
          <h2 className="text-2xl md:text-3xl mb-2">
            Fale com a WMTi sobre <span className="text-primary">{serviceName}</span>
          </h2>
          <p className="font-body text-muted-foreground mb-8">
            Preencha o formulário e nossa equipe entrará em contato.
          </p>

          <form onSubmit={handleSubmit} className="space-y-5 bg-card border border-border p-6 md:p-8 rounded-lg">
            {[
              { label: "Nome *", key: "nome" as const, type: "text", placeholder: "Seu nome completo" },
              { label: "E-mail *", key: "email" as const, type: "email", placeholder: "seu@email.com.br" },
              { label: "WhatsApp", key: "whatsapp" as const, type: "tel", placeholder: "(11) 99999-9999" },
              { label: "Empresa", key: "empresa" as const, type: "text", placeholder: "Nome da empresa" },
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
                  className="w-full bg-input border border-border px-4 py-3 font-body text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-primary focus:outline-none transition-colors rounded"
                />
              </div>
            ))}

            <div>
              <label className="font-mono text-xs tracking-[0.2em] uppercase text-primary mb-2 block">
                Mensagem *
              </label>
              <textarea
                rows={4}
                placeholder="Descreva sua necessidade..."
                value={form.mensagem}
                onChange={(e) => setForm((prev) => ({ ...prev, mensagem: e.target.value }))}
                className="w-full bg-input border border-border px-4 py-3 font-body text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-primary focus:outline-none transition-colors resize-none rounded"
              />
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <button
                type="submit"
                disabled={loading}
                className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-6 py-3 font-mono text-sm font-bold uppercase tracking-wider hover:brightness-110 transition-all flex-1 justify-center disabled:opacity-50 rounded"
              >
                {loading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                {loading ? "Enviando..." : "Enviar Mensagem"}
              </button>
              <button
                type="button"
                onClick={() => {
                  trackWhatsApp("service-contact-form", serviceName);
                  openWhatsApp({ pageTitle: serviceName, intent: "specialist" });
                }}
                className="inline-flex items-center gap-2 border border-primary/40 text-primary px-6 py-3 font-mono text-sm font-bold uppercase tracking-wider hover:bg-primary/10 transition-all justify-center rounded"
              >
                <MessageCircle size={16} />
                WhatsApp
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </section>
  );
};

export default ServiceContactForm;
