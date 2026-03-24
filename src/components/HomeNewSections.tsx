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
          Empresas que <span className="text-primary">crescem</span> confiam na WMTi.
        </h2>
        <p className="font-body text-muted-foreground text-sm md:text-base max-w-2xl mx-auto leading-relaxed">
          Quando a TI funciona, sua equipe produz mais, seus clientes são
          atendidos sem falhas e você dorme tranquilo. É isso que entregamos
          há mais de 15 anos.
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
  { icon: Wifi, title: "Rede lenta travando vendas" },
  { icon: Server, title: "Servidor que cai toda semana" },
  { icon: Monitor, title: "Computadores lentos parando a equipe" },
  { icon: ShieldAlert, title: "Medo de ataque ou perda de dados" },
  { icon: Headphones, title: "Sem suporte quando mais precisa" },
  { icon: HardDrive, title: "Equipamentos ultrapassados" },
];

export const HomeProblems = () => (
  <section className="py-16 md:py-24 section-dark">
    <div className="container">
      <motion.div {...fade} className="mb-10 md:mb-14">
        <p className="font-mono text-xs tracking-[0.3em] uppercase text-primary mb-4">
          // Isso te parece familiar?
        </p>
        <h2 className="text-2xl md:text-4xl lg:text-5xl max-w-2xl mb-4">
          Quanto sua empresa <span className="text-primary">perde</span> com esses problemas?
        </h2>
        <p className="font-body text-muted-foreground text-sm md:text-base max-w-xl leading-relaxed">
          Cada hora parada custa caro. Cada dado perdido é irrecuperável.
          Se você se identificou, é hora de agir.
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
  { icon: Clock, title: "15+ anos resolvendo TI de empresa" },
  { icon: Target, title: "Plano sob medida para seu negócio" },
  { icon: Lock, title: "Segurança que protege seu faturamento" },
  { icon: Activity, title: "Monitoramento 24/7 — antes de cair, resolvemos" },
  { icon: Wrench, title: "Suporte rápido quando você mais precisa" },
  { icon: TrendingUp, title: "TI que cresce junto com a empresa" },
];

export const HomeDifferentials = () => (
  <section className="py-16 md:py-24 bg-background">
    <div className="container">
      <motion.div {...fade} className="mb-10 md:mb-14">
        <p className="font-mono text-xs tracking-[0.3em] uppercase text-primary mb-4">
          // Por que a WMTi
        </p>
        <h2 className="text-2xl md:text-4xl lg:text-5xl max-w-2xl mb-4">
          Resultados que você <span className="text-primary">sente no caixa.</span>
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
    q: "Quanto custa resolver minha TI de uma vez?",
    a: "Depende do tamanho da sua operação. Fazemos um diagnóstico gratuito e entregamos uma proposta com valor fixo mensal — sem surpresas. Empresas a partir de 5 computadores já contratam a partir de R$120/mês por máquina.",
  },
  {
    q: "Atende empresas pequenas?",
    a: "Sim. A maioria dos nossos clientes tem entre 5 e 50 computadores. Montamos soluções proporcionais ao seu porte, sem exageros e sem subestimar riscos.",
  },
  {
    q: "E se o servidor cair fora do horário comercial?",
    a: "Nosso monitoramento é 24/7. Se algo acontecer, a equipe já é acionada automaticamente antes de você perceber. E nos planos com SLA, o atendimento emergencial está garantido.",
  },
  {
    q: "Posso alugar computadores ao invés de comprar?",
    a: "Sim. A locação de desktops Dell começa em R$249/mês por unidade, com suporte incluso, troca garantida e sem investimento inicial. Ideal para quem quer previsibilidade financeira.",
  },
];

export const HomeFaq = () => {
  const [open, setOpen] = useState<number | null>(null);

  return (
    <section className="py-16 md:py-24 section-dark">
      <div className="container max-w-3xl">
        <motion.div {...fade} className="mb-10 md:mb-14 text-center">
          <p className="font-mono text-xs tracking-[0.3em] uppercase text-primary mb-4">
            // Tire suas dúvidas
          </p>
          <h2 className="text-2xl md:text-4xl mb-4">
            Perguntas que todo gestor faz <span className="text-primary">antes de contratar.</span>
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
          Sua TI pode funcionar <span className="text-primary">sem dor de cabeça.</span>
        </h2>
        <p className="font-body text-muted-foreground text-sm md:text-base mb-8 leading-relaxed">
          Peça um diagnóstico gratuito e receba uma proposta clara, com preço
          fixo e sem surpresas. Em 48 horas você sabe exatamente o que precisa.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <a
            href="#contato"
            className="group inline-flex items-center justify-center gap-2 bg-primary text-primary-foreground px-8 py-4 font-mono text-sm font-bold uppercase tracking-wider hover:brightness-110 transition-all shadow-[0_0_30px_hsl(var(--primary)/0.3)]"
          >
            Quero meu diagnóstico gratuito
            <span className="group-hover:translate-x-1 transition-transform">→</span>
          </a>
          <a
            href="https://wa.me/5511963166915?text=Ol%C3%A1%2C%20quero%20resolver%20minha%20TI.%20Podem%20me%20ajudar%3F"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 border border-primary/40 text-primary px-6 py-4 font-mono text-sm font-bold uppercase tracking-wider hover:bg-primary/10 transition-all"
          >
            Resolver agora pelo WhatsApp
          </a>
        </div>
      </motion.div>
    </div>
  </section>
);
