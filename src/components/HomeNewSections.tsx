import { motion } from "framer-motion";
import {
  Wifi,
  Server,
  Monitor,
  ShieldAlert,
  Headphones,
  HardDrive,
  Clock,
  Target,
  Lock,
  Activity,
  Wrench,
  TrendingUp,
  ChevronDown,
} from "lucide-react";
import { useState } from "react";

const fade = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true },
  transition: { duration: 0.5 },
};

/* ─── AUTORIDADE ─── */
export const HomeAuthority = () => (
  <section className="py-12 md:py-16 bg-background border-y border-border">
    <div className="container">
      <motion.div {...fade} className="text-center mb-8">
        <h2 className="text-2xl md:text-4xl mb-3">
          Tecnologia confiável para <span className="text-primary">empresas.</span>
        </h2>
        <p className="font-body text-muted-foreground text-sm md:text-base max-w-2xl mx-auto leading-relaxed">
          A WMTi atua há mais de 15 anos oferecendo soluções de tecnologia para
          empresas que dependem de infraestrutura confiável para operar.
        </p>
      </motion.div>
      <div className="flex flex-wrap justify-center items-center gap-8 md:gap-16">
        {["Dell Technologies", "Microsoft", "ESET", "pfSense"].map((name, i) => (
          <motion.div
            key={name}
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: i * 0.1 }}
            className="font-heading text-lg md:text-xl font-bold text-muted-foreground/40 hover:text-primary transition-colors duration-300 cursor-default"
          >
            {name}
          </motion.div>
        ))}
      </div>
    </div>
  </section>
);

/* ─── PROBLEMAS ─── */
const problems = [
  { icon: Wifi, title: "Rede lenta ou instável" },
  { icon: Server, title: "Servidor antigo ou mal configurado" },
  { icon: Monitor, title: "Sistemas travando constantemente" },
  { icon: ShieldAlert, title: "Falta de segurança contra ataques" },
  { icon: Headphones, title: "Falta de suporte técnico confiável" },
  { icon: HardDrive, title: "Equipamentos inadequados" },
];

export const HomeProblems = () => (
  <section className="py-16 md:py-24 section-dark">
    <div className="container">
      <motion.div {...fade} className="mb-10 md:mb-14">
        <p className="font-mono text-xs tracking-[0.3em] uppercase text-primary mb-4">
          // Diagnóstico
        </p>
        <h2 className="text-2xl md:text-4xl lg:text-5xl max-w-2xl mb-4">
          Problemas que <span className="text-primary">resolvemos.</span>
        </h2>
        <p className="font-body text-muted-foreground text-sm md:text-base max-w-xl leading-relaxed">
          Se sua empresa enfrenta algum desses problemas, a WMTi pode ajudar.
        </p>
      </motion.div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-px bg-border">
        {problems.map((p, i) => (
          <motion.div
            key={p.title}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4, delay: i * 0.06 }}
            className="flex flex-col items-start gap-3 p-5 md:p-8 bg-background"
          >
            <p.icon size={24} className="text-primary" strokeWidth={1.5} />
            <span className="font-mono text-xs md:text-sm uppercase tracking-wider text-foreground">
              {p.title}
            </span>
          </motion.div>
        ))}
      </div>
    </div>
  </section>
);

/* ─── DIFERENCIAIS ─── */
const differentials = [
  { icon: Clock, title: "Mais de 15 anos de experiência" },
  { icon: Target, title: "Planejamento estratégico de TI" },
  { icon: Lock, title: "Infraestrutura corporativa segura" },
  { icon: Activity, title: "Monitoramento de redes" },
  { icon: Wrench, title: "Suporte técnico especializado" },
  { icon: TrendingUp, title: "Soluções escaláveis" },
];

export const HomeDifferentials = () => (
  <section className="py-16 md:py-24 bg-background">
    <div className="container">
      <motion.div {...fade} className="mb-10 md:mb-14">
        <p className="font-mono text-xs tracking-[0.3em] uppercase text-primary mb-4">
          // Diferenciais
        </p>
        <h2 className="text-2xl md:text-4xl lg:text-5xl max-w-2xl mb-4">
          Por que escolher a <span className="text-primary">WMTi.</span>
        </h2>
      </motion.div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
        {differentials.map((d, i) => (
          <motion.div
            key={d.title}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4, delay: i * 0.08 }}
            className="flex items-center gap-4 p-5 md:p-6 border border-border hover:border-primary/40 transition-colors group"
          >
            <div className="w-10 h-10 flex items-center justify-center border border-primary/30 bg-primary/5 group-hover:bg-primary/10 transition-colors shrink-0">
              <d.icon size={20} className="text-primary" strokeWidth={1.5} />
            </div>
            <span className="font-mono text-xs md:text-sm uppercase tracking-wider text-muted-foreground group-hover:text-primary transition-colors">
              {d.title}
            </span>
          </motion.div>
        ))}
      </div>
    </div>
  </section>
);

/* ─── FAQ SEO ─── */
const faqItems = [
  {
    q: "Quanto custa montar uma infraestrutura de TI?",
    a: "O custo depende do porte da empresa, quantidade de usuários e nível de segurança necessário. A WMTi realiza um diagnóstico gratuito para apresentar uma proposta personalizada e adequada à realidade de cada negócio.",
  },
  {
    q: "A WMTi atende pequenas empresas?",
    a: "Sim. A WMTi atende empresas de todos os portes, desde pequenos escritórios até grandes operações corporativas, sempre com soluções dimensionadas para cada necessidade.",
  },
  {
    q: "Vocês oferecem suporte técnico?",
    a: "Sim. Oferecemos suporte técnico especializado com monitoramento proativo, atendimento remoto e presencial, e SLA personalizado para garantir a continuidade da sua operação.",
  },
  {
    q: "Vocês oferecem locação de computadores?",
    a: "Sim. A WMTi oferece locação de desktops Dell OptiPlex e notebooks para empresas, com suporte técnico incluso, sem investimento inicial e com substituição garantida em caso de falha.",
  },
];

export const HomeFaq = () => {
  const [open, setOpen] = useState<number | null>(null);

  return (
    <section className="py-16 md:py-24 section-dark">
      <div className="container max-w-3xl">
        <motion.div {...fade} className="mb-10 md:mb-14 text-center">
          <p className="font-mono text-xs tracking-[0.3em] uppercase text-primary mb-4">
            // FAQ
          </p>
          <h2 className="text-2xl md:text-4xl mb-4">
            Perguntas <span className="text-primary">frequentes.</span>
          </h2>
        </motion.div>

        <div className="space-y-2">
          {faqItems.map((item, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.3, delay: i * 0.05 }}
              className="border border-border"
            >
              <button
                onClick={() => setOpen(open === i ? null : i)}
                className="w-full flex items-center justify-between gap-4 p-5 md:p-6 text-left hover:bg-muted/30 transition-colors"
              >
                <span className="font-heading text-sm md:text-base font-semibold text-foreground">
                  {item.q}
                </span>
                <ChevronDown
                  size={18}
                  className={`text-primary shrink-0 transition-transform ${open === i ? "rotate-180" : ""}`}
                />
              </button>
              {open === i && (
                <div className="px-5 md:px-6 pb-5 md:pb-6">
                  <p className="font-body text-sm text-muted-foreground leading-relaxed">
                    {item.a}
                  </p>
                </div>
              )}
            </motion.div>
          ))}
        </div>

        {/* JSON-LD FAQ Schema */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "FAQPage",
              mainEntity: faqItems.map((f) => ({
                "@type": "Question",
                name: f.q,
                acceptedAnswer: { "@type": "Answer", text: f.a },
              })),
            }),
          }}
        />
      </div>
    </section>
  );
};

/* ─── CTA FINAL ─── */
export const HomeCta = () => (
  <section className="py-16 md:py-24 bg-background">
    <div className="container">
      <motion.div {...fade} className="text-center max-w-2xl mx-auto">
        <h2 className="text-2xl md:text-4xl lg:text-5xl mb-6">
          Precisa melhorar a infraestrutura de TI da sua{" "}
          <span className="text-primary">empresa?</span>
        </h2>
        <p className="font-body text-muted-foreground text-sm md:text-base mb-8 leading-relaxed">
          Solicite um diagnóstico gratuito e descubra como a WMTi pode ajudar
          sua empresa a operar com mais segurança, estabilidade e performance.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <a
            href="#contato"
            className="group inline-flex items-center justify-center gap-2 bg-primary text-primary-foreground px-8 py-4 font-mono text-sm font-bold uppercase tracking-wider hover:brightness-110 transition-all shadow-[0_0_30px_hsl(var(--primary)/0.3)]"
          >
            Solicitar Diagnóstico de TI
            <span className="group-hover:translate-x-1 transition-transform">→</span>
          </a>
          <a
            href="https://wa.me/5511963166915?text=Ol%C3%A1%2C%20gostaria%20de%20falar%20com%20um%20especialista%20em%20TI."
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 border border-primary/40 text-primary px-6 py-4 font-mono text-sm font-bold uppercase tracking-wider hover:bg-primary/10 transition-all"
          >
            Falar com Especialista
          </a>
        </div>
      </motion.div>
    </div>
  </section>
);
