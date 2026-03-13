import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowRight, Send } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const ContactSection = () => {
  const [form, setForm] = useState({ nome: "", email: "", empresa: "", mensagem: "" });
  const { toast } = useToast();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nome || !form.email || !form.mensagem) {
      toast({ title: "Preencha todos os campos obrigatórios.", variant: "destructive" });
      return;
    }

    const text = `*Solicitação de Orçamento — WMTi*%0A%0A*Nome:* ${encodeURIComponent(form.nome)}%0A*Email:* ${encodeURIComponent(form.email)}%0A*Empresa:* ${encodeURIComponent(form.empresa || "Não informada")}%0A%0A*Mensagem:*%0A${encodeURIComponent(form.mensagem)}`;
    window.open(`https://wa.me/5511963166915?text=${text}`, "_blank");

    toast({ title: "Redirecionando para o WhatsApp..." });
    setForm({ nome: "", email: "", empresa: "", mensagem: "" });
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
              className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-8 py-4 font-mono text-sm font-bold uppercase tracking-wider hover:brightness-110 transition-all w-full justify-center"
            >
              <Send size={16} />
              Enviar via WhatsApp
              <ArrowRight size={16} />
            </button>
          </motion.form>
        </div>
      </div>
    </section>
  );
};

export default ContactSection;
