import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { Target, Eye, Heart, ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import SeoHead from "@/components/SeoHead";

const fadeIn = {
  initial: { opacity: 0, y: 20 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true as const },
  transition: { duration: 0.5 },
};

const SobrePage = () => {
  const { t } = useTranslation();
  const k = "custom.sobre";
  const values = t(`${k}.values`, { returnObjects: true }) as { title: string; desc: string }[];

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="min-h-screen">
      <SeoHead
        title={t(`${k}.metaTitle`)}
        description={t(`${k}.metaDesc`)}
        canonical="https://www.wmti.com.br/institucional"
      />
      <Navbar />

      {/* Hero */}
      <section className="section-dark pt-24 md:pt-28 pb-16 md:pb-24 border-b-4 border-primary">
        <div className="container">
          <motion.div {...fadeIn} className="max-w-4xl">
            <Link to="/" className="inline-flex items-center gap-2 font-mono text-xs uppercase tracking-wider text-muted-foreground hover:text-primary transition-colors mb-8">
              <ArrowLeft size={14} /> {t(`${k}.back`)}
            </Link>
            <p className="font-mono text-xs tracking-[0.3em] uppercase text-primary mb-4">{t(`${k}.heroTag`)}</p>
            <h1 className="text-3xl md:text-5xl lg:text-6xl mb-6">
              {t(`${k}.heroTitle`)}<span className="text-primary">{t(`${k}.heroHighlight`)}</span>
            </h1>
            <p className="font-body text-lg md:text-xl text-muted-foreground max-w-2xl leading-relaxed">
              {t(`${k}.heroDescription`)}
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
              <p className="font-mono text-xs tracking-[0.3em] uppercase text-primary mb-3">{t(`${k}.missionTag`)}</p>
              <h2 className="text-2xl md:text-3xl mb-4">{t(`${k}.missionTitle`)}</h2>
              <p className="font-body text-lg text-muted-foreground leading-relaxed">{t(`${k}.missionText`)}</p>
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
              <p className="font-mono text-xs tracking-[0.3em] uppercase text-primary mb-3">{t(`${k}.visionTag`)}</p>
              <h2 className="text-2xl md:text-3xl mb-4">{t(`${k}.visionTitle`)}</h2>
              <p className="font-body text-lg text-muted-foreground leading-relaxed">{t(`${k}.visionText`)}</p>
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
              <p className="font-mono text-xs tracking-[0.3em] uppercase text-primary mb-3">{t(`${k}.valuesTag`)}</p>
              <h2 className="text-2xl md:text-3xl">{t(`${k}.valuesTitle`)}</h2>
            </div>
          </motion.div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-px bg-border">
            {values.map((v, i) => (
              <motion.div
                key={i}
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

      {/* Quote */}
      <section className="section-dark py-16 md:py-24">
        <div className="container max-w-3xl text-center">
          <motion.div {...fadeIn}>
            <blockquote className="text-xl md:text-2xl italic text-muted-foreground leading-relaxed mb-6">
              "{t(`${k}.quote`)}"
            </blockquote>
            <p className="font-mono text-sm text-primary tracking-wider">{t(`${k}.quoteRef`)}</p>
          </motion.div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default SobrePage;
