import { useState, useRef } from "react";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { AlertTriangle, Send, Phone, Mail, Building2, User, Loader2, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface EmergencyLeadFormProps {
  problemName: string;
  cityName?: string;
  sourcePage: string;
}

const EmergencyLeadForm = ({ problemName, cityName, sourcePage }: EmergencyLeadFormProps) => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (loading || submitted) return;

    const form = e.currentTarget;
    const data = new FormData(form);
    const name = (data.get("name") as string || "").trim();
    const email = (data.get("email") as string || "").trim();
    const phone = (data.get("phone") as string || "").trim();
    const company = (data.get("company") as string || "").trim();

    if (!name || !email || !phone) {
      toast.error("Preencha todos os campos obrigatórios.");
      return;
    }

    setLoading(true);
    try {
      const serviceInterest = cityName
        ? `${problemName} em ${cityName}`
        : problemName;

      await supabase.functions.invoke("submit-lead", {
        body: {
          name,
          email,
          phone,
          company,
          service_interest: serviceInterest,
          source_page: sourcePage,
          message: `[URGENTE] Lead via landing page de problema: ${serviceInterest}`,
        },
      });

      setSubmitted(true);
      toast.success("Recebemos seu contato! Nossa equipe entrará em contato em breve.");
    } catch {
      toast.error("Erro ao enviar. Tente pelo WhatsApp.");
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <section className="py-16 md:py-20 bg-primary/5 border-y border-primary/20">
        <div className="container max-w-2xl text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4 }}
          >
            <CheckCircle2 size={48} className="text-primary mx-auto mb-4" />
            <h3 className="text-2xl md:text-3xl font-bold mb-2">Contato recebido!</h3>
            <p className="font-body text-muted-foreground">
              Nossa equipe técnica entrará em contato em breve para resolver seu problema.
            </p>
          </motion.div>
        </div>
      </section>
    );
  }

  return (
    <section id="formulario-emergencial" className="py-16 md:py-20 bg-destructive/5 border-y-2 border-destructive/20">
      <div className="container max-w-2xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <div className="flex items-center gap-3 mb-2">
            <AlertTriangle size={20} className="text-destructive" />
            <p className="font-mono text-xs tracking-[0.3em] uppercase text-destructive">
              // ATENDIMENTO PRIORITÁRIO
            </p>
          </div>
          <h2 className="text-2xl md:text-3xl mb-2">
            Resolva agora:{" "}
            <span className="text-destructive">diagnóstico gratuito</span>
          </h2>
          <p className="font-body text-muted-foreground mb-8 leading-relaxed">
            Preencha o formulário e nossa equipe técnica entrará em contato em até{" "}
            <strong className="text-foreground">2 horas úteis</strong>
            {cityName ? ` para atender sua empresa em ${cityName}` : ""}.
          </p>

          <form ref={formRef} onSubmit={handleSubmit} className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="emergency-name" className="flex items-center gap-2 font-mono text-xs uppercase tracking-wider text-muted-foreground mb-1.5">
                  <User size={12} /> Nome *
                </label>
                <input
                  id="emergency-name"
                  name="name"
                  type="text"
                  required
                  maxLength={100}
                  placeholder="Seu nome"
                  className="w-full px-4 py-3 bg-background border border-border rounded font-body text-sm focus:border-primary focus:outline-none transition-colors"
                />
              </div>
              <div>
                <label htmlFor="emergency-company" className="flex items-center gap-2 font-mono text-xs uppercase tracking-wider text-muted-foreground mb-1.5">
                  <Building2 size={12} /> Empresa
                </label>
                <input
                  id="emergency-company"
                  name="company"
                  type="text"
                  maxLength={100}
                  placeholder="Nome da empresa"
                  className="w-full px-4 py-3 bg-background border border-border rounded font-body text-sm focus:border-primary focus:outline-none transition-colors"
                />
              </div>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="emergency-email" className="flex items-center gap-2 font-mono text-xs uppercase tracking-wider text-muted-foreground mb-1.5">
                  <Mail size={12} /> E-mail *
                </label>
                <input
                  id="emergency-email"
                  name="email"
                  type="email"
                  required
                  maxLength={255}
                  placeholder="seu@email.com"
                  className="w-full px-4 py-3 bg-background border border-border rounded font-body text-sm focus:border-primary focus:outline-none transition-colors"
                />
              </div>
              <div>
                <label htmlFor="emergency-phone" className="flex items-center gap-2 font-mono text-xs uppercase tracking-wider text-muted-foreground mb-1.5">
                  <Phone size={12} /> Telefone *
                </label>
                <input
                  id="emergency-phone"
                  name="phone"
                  type="tel"
                  required
                  maxLength={20}
                  placeholder="(11) 99999-9999"
                  className="w-full px-4 py-3 bg-background border border-border rounded font-body text-sm focus:border-primary focus:outline-none transition-colors"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full inline-flex items-center justify-center gap-2 bg-destructive text-destructive-foreground px-8 py-4 font-mono text-sm font-bold uppercase tracking-wider hover:brightness-110 transition-all rounded disabled:opacity-50"
            >
              {loading ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Send size={16} />
              )}
              {loading ? "Enviando..." : "Solicitar diagnóstico gratuito"}
            </button>
          </form>

          <p className="font-body text-xs text-muted-foreground mt-4 text-center">
            Sem compromisso. Diagnóstico e proposta totalmente gratuitos.
          </p>
        </motion.div>
      </div>
    </section>
  );
};

export default EmergencyLeadForm;