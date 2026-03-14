import { useState } from "react";
import { useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, Send, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

const serviceOptions = [
  "Servidores Dell PowerEdge",
  "Microsoft 365",
  "Firewall pfSense",
  "Montagem de Redes",
  "Locação de Computadores",
  "Suporte de TI",
  "TI para Cartórios",
  "Infraestrutura Completa",
  "Outro",
];

const ContactSection = () => {
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
      toast({ title: "Preencha todos os campos obrigatórios.", variant: "destructive" });
      return;
    }

    setLoading(true);
    const utm = getUtmParams();

    try {
      const { error } = await supabase.from("leads").insert({
        name: form.nome,
        email: form.email,
        phone: form.telefone || null,
        company: form.empresa || null,
        service_interest: form.interesse || null,
        message: form.mensagem,
        source_page: location.pathname,
        ...utm,
      });

      if (error) throw error;

      toast({ title: "Mensagem enviada com sucesso! Redirecionando para o WhatsApp..." });
      
      const text = `*Solicitação de Orçamento — WMTi*%0A%0A*Nome:* ${encodeURIComponent(form.nome)}%0A*Email:* ${encodeURIComponent(form.email)}%0A*Telefone:* ${encodeURIComponent(form.telefone || "Não informado")}%0A*Empresa:* ${encodeURIComponent(form.empresa || "Não informada")}%0A*Interesse:* ${encodeURIComponent(form.interesse || "Não informado")}%0A%0A*Mensagem:*%0A${encodeURIComponent(form.mensagem)}`;
      
      setTimeout(() => {
        window.open(`https://wa.me/5511963166915?text=${text}`, "_blank");
      }, 1000);

      setForm({ nome: "", email: "", telefone: "", empresa: "", interesse: "", mensagem: "" });
    } catch {
      toast({ title: "Erro ao enviar. Tente novamente ou fale via WhatsApp.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <section id="contato" className="py-20 md:py-24 section-dark">
      <div className="container">
        <div className="grid lg:grid-cols-2 gap-12 md:gap-16">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <p className="font-mono text-xs tracking-[0.3em] uppercase text-primary mb-4">
              // Contato
            </p>
            <h2 className="text-2xl md:text-5xl mb-4 md:mb-6">
              Projete sua
              <br />
              infraestrutura.
            </h2>
            <p className="font-body text-gunmetal-foreground/70 text-base md:text-lg max-w-md leading-relaxed mb-6 md:mb-8">
              Cada ambiente é único. Fale com nossa equipe técnica e receba um
              projeto detalhado com especificações, prazos e investimento.
            </p>
            <div className="space-y-3 font-mono text-sm md:text-base text-gunmetal-foreground/60">
              <p>
                <span className="text-primary">email:</span> contato@wmti.com.br
              </p>
              <p>
                <span className="text-primary">whatsapp:</span>{" "}
                <a href="https://wa.me/5511963166915" className="hover:text-primary transition-colors">(11) 96316-6915</a>
              </p>
              <p>
                <span className="text-primary">endereço:</span> Rua José Benedito Duarte, 140
                <br />
                <span className="ml-[4.5ch]">Parque Itamarati — Jacareí, SP</span>
              </p>
            </div>
          </motion.div>

          <motion.form
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="space-y-5 md:space-y-6"
            onSubmit={handleSubmit}
          >
            {[
              { label: "Nome *", key: "nome" as const, type: "text", placeholder: "Seu nome completo" },
              { label: "Email *", key: "email" as const, type: "email", placeholder: "email@empresa.com.br" },
              { label: "Telefone", key: "telefone" as const, type: "tel", placeholder: "(11) 99999-9999" },
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
                  className="w-full bg-transparent border border-gunmetal-foreground/20 px-4 py-3 font-body text-sm md:text-base text-gunmetal-foreground placeholder:text-gunmetal-foreground/30 focus:border-primary focus:outline-none transition-colors"
                />
              </div>
            ))}

            <div>
              <label className="font-mono text-xs tracking-[0.2em] uppercase text-primary mb-2 block">
                Interesse
              </label>
              <select
                value={form.interesse}
                onChange={(e) => setForm((prev) => ({ ...prev, interesse: e.target.value }))}
                className="w-full bg-transparent border border-gunmetal-foreground/20 px-4 py-3 font-body text-sm md:text-base text-gunmetal-foreground focus:border-primary focus:outline-none transition-colors"
              >
                <option value="" className="bg-secondary">Selecione o serviço</option>
                {serviceOptions.map((opt) => (
                  <option key={opt} value={opt} className="bg-secondary">{opt}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="font-mono text-xs tracking-[0.2em] uppercase text-primary mb-2 block">
                Mensagem *
              </label>
              <textarea
                rows={4}
                placeholder="Descreva sua necessidade de infraestrutura..."
                value={form.mensagem}
                onChange={(e) => setForm((prev) => ({ ...prev, mensagem: e.target.value }))}
                className="w-full bg-transparent border border-gunmetal-foreground/20 px-4 py-3 font-body text-sm md:text-base text-gunmetal-foreground placeholder:text-gunmetal-foreground/30 focus:border-primary focus:outline-none transition-colors resize-none"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-8 py-4 font-mono text-sm font-bold uppercase tracking-wider hover:brightness-110 transition-all w-full justify-center disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Send size={16} />
              )}
              {loading ? "Enviando..." : "Enviar e falar no WhatsApp"}
              {!loading && <ArrowRight size={16} />}
            </button>
          </motion.form>
        </div>
      </div>
    </section>
  );
};

export default ContactSection;
