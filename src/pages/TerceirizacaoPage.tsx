import { useEffect } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Users, ShieldCheck, TrendingUp, Briefcase, RefreshCcw,
  HeadphonesIcon, BarChart3, Building2, ArrowRight
} from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import WhatsAppButton from "@/components/WhatsAppButton";

const fadeIn = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true },
  transition: { duration: 0.5 },
};

const benefits = [
  { icon: RefreshCcw, title: "Continuidade operacional", desc: "Seus processos seguem funcionando sem interrupção, com os mesmos profissionais que já conhecem sua operação." },
  { icon: ShieldCheck, title: "Redução de responsabilidade", desc: "A responsabilidade trabalhista e administrativa sobre a equipe de TI passa a ser da WMTi." },
  { icon: Users, title: "Reaproveitamento de talentos", desc: "Profissionais já existentes na empresa são absorvidos pela WMTi, preservando o conhecimento interno." },
  { icon: Briefcase, title: "Gestão especializada", desc: "Equipe gerenciada por especialistas em TI com processos estruturados e metas definidas." },
  { icon: BarChart3, title: "Previsibilidade de custos", desc: "Custos fixos e planejáveis, sem surpresas com encargos, rescisões ou passivos trabalhistas." },
  { icon: TrendingUp, title: "Ganho de produtividade", desc: "Com gestão técnica centralizada, a equipe opera com mais foco, eficiência e suporte contínuo." },
  { icon: HeadphonesIcon, title: "Suporte estruturado", desc: "A WMTi oferece estrutura completa de suporte, ferramentas e processos para a equipe gerenciada." },
  { icon: Building2, title: "Foco no core business", desc: "Sua empresa se concentra no que faz de melhor, enquanto a WMTi cuida da operação de TI." },
];

const sections = [
  {
    title: "Como funciona a terceirização de mão de obra em TI",
    content: "A WMTi assume a gestão completa dos profissionais de TI da sua empresa. Recontratamos ou absorvemos os colaboradores já existentes para dentro da nossa estrutura administrativa e operacional, mantendo a continuidade dos serviços e eliminando a complexidade de gestão de pessoas na área de tecnologia."
  },
  {
    title: "Reaproveitamento de profissionais já existentes",
    content: "Diferente de modelos tradicionais de terceirização, a WMTi valoriza os profissionais que já conhecem sua operação. Esses colaboradores são absorvidos pela WMTi, garantindo que o conhecimento dos processos internos, sistemas e rotinas da empresa seja preservado integralmente."
  },
  {
    title: "Redução de encargos administrativos e operacionais",
    content: "Ao transferir a equipe de TI para a gestão da WMTi, sua empresa elimina a responsabilidade direta sobre folha de pagamento, encargos trabalhistas, férias, benefícios e todas as obrigações administrativas relacionadas a esses profissionais."
  },
  {
    title: "Continuidade do conhecimento interno",
    content: "A transição é transparente para a operação. Os mesmos profissionais continuam atuando nos mesmos processos, com o mesmo conhecimento — mas agora sob uma gestão técnica especializada que potencializa seus resultados."
  },
  {
    title: "Gestão técnica e administrativa centralizada",
    content: "A WMTi oferece gestão integrada que combina administração de pessoas, acompanhamento de desempenho, treinamento contínuo e suporte técnico especializado — tudo centralizado para garantir eficiência máxima."
  },
  {
    title: "Mais previsibilidade, controle e suporte especializado",
    content: "Com um contrato claro e custos previsíveis, sua empresa ganha controle sobre o investimento em TI. A WMTi fornece relatórios, indicadores de desempenho e suporte contínuo para toda a equipe gerenciada."
  },
];

const TerceirizacaoPage = () => {
  useEffect(() => {
    document.title = "Terceirização de Mão de Obra em TI | WMTi";
    const meta = document.querySelector('meta[name="description"]');
    if (meta) {
      meta.setAttribute("content", "A WMTi oferece terceirização de mão de obra em TI, incluindo absorção e gestão de profissionais já existentes, com mais controle, continuidade e redução de responsabilidade operacional para sua empresa.");
    }
    window.scrollTo(0, 0);
  }, []);

  const whatsappMsg = encodeURIComponent("Olá! Gostaria de saber mais sobre terceirização de mão de obra em TI pela WMTi.");

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />

      {/* Hero */}
      <section className="relative pt-28 pb-20 md:pt-36 md:pb-28 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-transparent" />
        <div className="container relative z-10">
          <motion.div {...fadeIn} className="max-w-3xl">
            <span className="inline-block font-mono text-xs uppercase tracking-[0.2em] text-primary mb-4">
              Serviços WMTi
            </span>
            <h1 className="font-display text-3xl md:text-5xl font-bold leading-tight mb-6">
              Terceirização de Mão de Obra em TI
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground leading-relaxed mb-4">
              Mantenha a continuidade operacional da sua empresa enquanto transfere a responsabilidade pela administração da equipe de TI para a WMTi.
            </p>
            <p className="text-base text-muted-foreground leading-relaxed mb-8">
              <strong className="text-foreground">Recontratamos ou absorvemos os profissionais de TI já existentes da sua empresa</strong> para dentro da administração da WMTi, assumindo a gestão operacional e reduzindo a responsabilidade direta da contratante sobre essa estrutura.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <a
                href={`https://wa.me/5512981156000?text=${whatsappMsg}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 bg-primary text-primary-foreground font-mono text-sm uppercase tracking-wider px-6 py-3 hover:bg-primary/90 transition-colors"
              >
                Solicitar análise da operação
                <ArrowRight size={16} />
              </a>
              <Link
                to="/suporte-ti-jacarei"
                className="inline-flex items-center justify-center gap-2 border border-border text-foreground font-mono text-sm uppercase tracking-wider px-6 py-3 hover:border-primary/50 hover:text-primary transition-colors"
              >
                Conheça nosso suporte
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Content sections */}
      <section className="py-16 md:py-24">
        <div className="container">
          <div className="grid gap-12 md:gap-16 max-w-4xl">
            {sections.map((section, idx) => (
              <motion.div
                key={idx}
                {...fadeIn}
                transition={{ ...fadeIn.transition, delay: idx * 0.08 }}
              >
                <div className="flex items-start gap-4">
                  <div className="w-8 h-8 flex items-center justify-center bg-primary/10 text-primary font-mono text-sm font-bold shrink-0 mt-1">
                    {String(idx + 1).padStart(2, "0")}
                  </div>
                  <div>
                    <h2 className="font-display text-xl md:text-2xl font-bold mb-3">
                      {section.title}
                    </h2>
                    <p className="text-muted-foreground leading-relaxed">
                      {section.content}
                    </p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section className="py-16 md:py-24 bg-card/50">
        <div className="container">
          <motion.div {...fadeIn} className="text-center mb-12">
            <span className="inline-block font-mono text-xs uppercase tracking-[0.2em] text-primary mb-3">
              Vantagens
            </span>
            <h2 className="font-display text-2xl md:text-3xl font-bold">
              Benefícios da terceirização com a WMTi
            </h2>
          </motion.div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {benefits.map((b, idx) => (
              <motion.div
                key={idx}
                {...fadeIn}
                transition={{ ...fadeIn.transition, delay: idx * 0.06 }}
                className="bg-card border border-border/60 p-6 hover:border-primary/30 transition-colors group"
              >
                <b.icon size={28} className="text-primary mb-4 group-hover:scale-110 transition-transform" />
                <h3 className="font-display text-sm font-bold uppercase tracking-wider mb-2">
                  {b.title}
                </h3>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  {b.desc}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 md:py-24">
        <div className="container">
          <motion.div {...fadeIn} className="max-w-2xl mx-auto text-center">
            <h2 className="font-display text-2xl md:text-3xl font-bold mb-4">
              Solicite uma análise da sua operação de TI
            </h2>
            <p className="text-muted-foreground mb-8 leading-relaxed">
              Fale com a WMTi e descubra como a terceirização da mão de obra em TI pode reduzir custos, eliminar riscos e melhorar a produtividade da sua equipe.
            </p>
            <a
              href={`https://wa.me/5512981156000?text=${whatsappMsg}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 bg-primary text-primary-foreground font-mono text-sm uppercase tracking-wider px-8 py-4 hover:bg-primary/90 transition-colors"
            >
              Fale com a WMTi sobre terceirização
              <ArrowRight size={16} />
            </a>
          </motion.div>
        </div>
      </section>

      <Footer />
      <WhatsAppButton />
    </div>
  );
};

export default TerceirizacaoPage;
