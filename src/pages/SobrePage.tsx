import { useEffect } from "react";
import { motion } from "framer-motion";
import { Target, Eye, Heart, ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import WhatsAppButton from "@/components/WhatsAppButton";

const fadeIn = {
  initial: { opacity: 0, y: 20 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true as const },
  transition: { duration: 0.5 },
};

const values = [
  { title: "Excelência Técnica", desc: "Buscamos a perfeição em cada projeto. Certificações Dell e Microsoft não são apenas selos — são compromisso com a qualidade." },
  { title: "Integridade", desc: "Transparência total com nossos clientes. Recomendamos apenas o que é necessário e entregamos o que prometemos." },
  { title: "Responsabilidade", desc: "Tratamos a infraestrutura do cliente como se fosse nossa. Cada servidor, cada backup, cada firewall recebe atenção máxima." },
  { title: "Inovação Contínua", desc: "Investimos em capacitação constante para oferecer as melhores soluções do mercado." },
  { title: "Compromisso com o Cliente", desc: "Nosso sucesso é medido pelo sucesso dos nossos clientes. Suporte proativo, não reativo." },
  { title: "Servir com Propósito", desc: "Acreditamos que nosso trabalho é uma forma de servir. Como nos ensina Colossenses 3:23 — 'Tudo o que fizerem, façam de todo o coração, como para o Senhor, e não para os homens.'" },
];

const SobrePage = () => {
  useEffect(() => {
    document.title = "Sobre a WMTi | Missão, Visão e Valores";
    const desc = document.querySelector('meta[name="description"]');
    if (desc) desc.setAttribute("content", "Conheça a WMTi: missão, visão e valores. Empresa de TI em Jacareí especializada em infraestrutura corporativa com certificações Dell e Microsoft.");
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="min-h-screen">
      <Navbar />

      {/* Hero */}
      <section className="section-dark pt-24 md:pt-28 pb-16 md:pb-24 border-b-4 border-primary">
        <div className="container">
          <motion.div {...fadeIn} className="max-w-4xl">
            <Link
              to="/"
              className="inline-flex items-center gap-2 font-mono text-xs uppercase tracking-wider text-muted-foreground hover:text-primary transition-colors mb-8"
            >
              <ArrowLeft size={14} /> Voltar ao início
            </Link>
            <p className="font-mono text-xs tracking-[0.3em] uppercase text-primary mb-4">// Sobre a WMTi</p>
            <h1 className="text-3xl md:text-5xl lg:text-6xl mb-6">
              Tecnologia com <span className="text-primary">propósito.</span>
            </h1>
            <p className="font-body text-lg md:text-xl text-muted-foreground max-w-2xl leading-relaxed">
              Há mais de 10 anos, entregamos infraestrutura de TI corporativa que faz a diferença no dia a dia das empresas.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Missão */}
      <section className="section-light py-16 md:py-24">
        <div className="container max-w-4xl">
          <motion.div {...fadeIn} className="grid md:grid-cols-[auto_1fr] gap-8 items-start">
            <div className="w-16 h-16 bg-primary/10 flex items-center justify-center">
              <Target size={28} className="text-primary" />
            </div>
            <div>
              <p className="font-mono text-xs tracking-[0.3em] uppercase text-primary mb-3">// Missão</p>
              <h2 className="text-2xl md:text-3xl mb-4">Nossa Missão</h2>
              <p className="font-body text-lg text-muted-foreground leading-relaxed">
                Prover infraestrutura de TI corporativa confiável, segura e escalável, permitindo que nossos clientes foquem no que fazem de melhor enquanto cuidamos da tecnologia que sustenta seus negócios.
              </p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Visão */}
      <section className="section-dark py-16 md:py-24">
        <div className="container max-w-4xl">
          <motion.div {...fadeIn} className="grid md:grid-cols-[auto_1fr] gap-8 items-start">
            <div className="w-16 h-16 bg-primary/10 flex items-center justify-center">
              <Eye size={28} className="text-primary" />
            </div>
            <div>
              <p className="font-mono text-xs tracking-[0.3em] uppercase text-primary mb-3">// Visão</p>
              <h2 className="text-2xl md:text-3xl mb-4">Nossa Visão</h2>
              <p className="font-body text-lg text-muted-foreground leading-relaxed">
                Ser reconhecida como a principal empresa de infraestrutura de TI do Brasil, referência em excelência técnica, inovação e compromisso com a segurança da informação em todos os segmentos que atendemos.
              </p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Valores */}
      <section className="section-light py-16 md:py-24">
        <div className="container">
          <motion.div {...fadeIn} className="mb-12 flex items-start gap-6">
            <div className="w-16 h-16 bg-primary/10 flex items-center justify-center shrink-0">
              <Heart size={28} className="text-primary" />
            </div>
            <div>
              <p className="font-mono text-xs tracking-[0.3em] uppercase text-primary mb-3">// Valores</p>
              <h2 className="text-2xl md:text-3xl">Nossos Valores</h2>
            </div>
          </motion.div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-px bg-border">
            {values.map((v, i) => (
              <motion.div
                key={v.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.08 }}
                className="bg-background p-8"
              >
                <h3 className="font-mono text-sm font-bold uppercase tracking-wider mb-3">{v.title}</h3>
                <p className="font-body text-sm text-muted-foreground leading-relaxed">{v.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Colossenses 3:23 */}
      <section className="section-dark py-16 md:py-24">
        <div className="container max-w-3xl text-center">
          <motion.div {...fadeIn}>
            <blockquote className="text-xl md:text-2xl italic text-muted-foreground leading-relaxed mb-6">
              "Tudo o que fizerem, façam de todo o coração, como para o Senhor, e não para os homens."
            </blockquote>
            <p className="font-mono text-sm text-primary tracking-wider">— Colossenses 3:23</p>
          </motion.div>
        </div>
      </section>

      <Footer />
      <WhatsAppButton />
    </div>
  );
};

export default SobrePage;
