import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowLeft, ArrowRight, CheckCircle2, MessageCircle,
  Server, Shield, HardDrive, Lock, Activity, Wifi,
  Network, Cloud, Monitor, Heart, AlertTriangle, Database,
} from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import WhatsAppButton from "@/components/WhatsAppButton";
import hospitalTech from "@/assets/hospital-tech.jpg";

const fadeIn = {
  initial: { opacity: 0, y: 20 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true as const },
  transition: { duration: 0.5 },
};

const painIcons = [Monitor, Database, AlertTriangle, Server, HardDrive, Lock];
const solIcons = [Server, Shield, HardDrive, Activity, Cloud, Network];
const benIcons = [Heart, Lock, Activity, Shield, Server, Database];

const TiHospitaisClinicasPage = () => {
  const { t } = useTranslation();
  const k = "custom.hospitais";

  const painPoints = t(`${k}.painPoints`, { returnObjects: true }) as string[];
  const solutions = t(`${k}.solutions`, { returnObjects: true }) as { title: string; desc: string; specs: string[] }[];
  const benefits = t(`${k}.benefits`, { returnObjects: true }) as { title: string; text: string }[];
  const lgpdCards = t(`${k}.lgpdCards`, { returnObjects: true }) as { label: string; desc: string }[];
  const faq = t(`${k}.faq`, { returnObjects: true }) as { question: string; answer: string }[];
  const relatedLinks = t(`${k}.relatedLinks`, { returnObjects: true }) as { label: string; href: string }[];
  const whatsappMsg = t(`${k}.whatsappMsg`);

  useEffect(() => {
    document.title = t(`${k}.metaTitle`);
    const desc = document.querySelector('meta[name="description"]');
    if (desc) desc.setAttribute("content", t(`${k}.metaDesc`));
    window.scrollTo(0, 0);
  }, [t]);

  return (
    <div className="min-h-screen">
      <Navbar />

      {/* Hero */}
      <section className="relative pt-14 md:pt-16 overflow-hidden">
        <div className="absolute inset-0">
          <img src={hospitalTech} alt={t(`${k}.imgAlt`)} className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).src = "/placeholder.svg"; }} />
          <div className="absolute inset-0 bg-secondary/90" />
        </div>
        <div className="relative container py-20 md:py-32">
          <motion.div {...fadeIn} className="max-w-4xl">
            <Link to="/" className="inline-flex items-center gap-2 font-mono text-xs uppercase tracking-wider text-muted-foreground hover:text-primary transition-colors mb-8">
              <ArrowLeft size={14} /> {t(`${k}.back`)}
            </Link>
            <p className="font-mono text-xs tracking-[0.3em] uppercase text-primary mb-4">{t(`${k}.heroTag`)}</p>
            <h1 className="text-3xl md:text-5xl lg:text-6xl mb-6">
              {t(`${k}.heroTitle1`)}<span className="text-primary">{t(`${k}.heroHighlight`)}</span>{t(`${k}.heroTitle2`)}
            </h1>
            <p className="font-body text-lg md:text-xl text-muted-foreground max-w-2xl leading-relaxed mb-8">
              {t(`${k}.heroDescription`)}
            </p>
            <div className="flex flex-wrap gap-4">
              <a href={`https://wa.me/5511963166915?text=${encodeURIComponent(whatsappMsg)}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-8 py-4 font-mono text-sm font-bold uppercase tracking-wider hover:brightness-110 transition-all">
                <MessageCircle size={16} /> {t(`${k}.ctaDiag`)}
              </a>
              <a href="#contato-saude" className="inline-flex items-center gap-2 border border-muted-foreground/30 text-foreground px-8 py-4 font-mono text-sm font-bold uppercase tracking-wider hover:border-primary hover:text-primary transition-all">
                {t(`${k}.ctaSpecialist`)}
              </a>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Introduction */}
      <section className="section-light py-16 md:py-24">
        <div className="container">
          <motion.div {...fadeIn} className="max-w-3xl">
            <p className="font-mono text-xs tracking-[0.3em] uppercase text-primary mb-4">{t(`${k}.introTag`)}</p>
            <h2 className="text-2xl md:text-3xl mb-6">
              {t(`${k}.introTitle1`)}<span className="text-primary">{t(`${k}.introHighlight`)}</span>
            </h2>
            <div className="font-body text-muted-foreground leading-relaxed space-y-4">
              <p>{t(`${k}.introP1`)}</p>
              <p>{t(`${k}.introP2`)}</p>
              <p>{t(`${k}.introP3`)}</p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Pain Points */}
      <section className="section-dark py-16 md:py-24">
        <div className="container">
          <motion.div {...fadeIn} className="mb-12">
            <p className="font-mono text-xs tracking-[0.3em] uppercase text-destructive mb-4">{t(`${k}.painTag`)}</p>
            <h2 className="text-2xl md:text-4xl">
              {t(`${k}.painTitle1`)}<span className="text-primary">{t(`${k}.painHighlight`)}</span>
            </h2>
          </motion.div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-px bg-border">
            {painPoints.map((text, i) => {
              const Icon = painIcons[i];
              return (
                <motion.div key={i} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.4, delay: i * 0.08 }} className="bg-secondary p-8">
                  <Icon size={20} className="text-destructive mb-4" strokeWidth={1.5} />
                  <p className="font-body text-sm text-muted-foreground leading-relaxed">{text}</p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Solutions */}
      <section className="section-light py-16 md:py-24">
        <div className="container">
          <motion.div {...fadeIn} className="mb-12">
            <p className="font-mono text-xs tracking-[0.3em] uppercase text-primary mb-4">{t(`${k}.solutionTag`)}</p>
            <h2 className="text-2xl md:text-4xl">
              {t(`${k}.solutionTitle1`)}<span className="text-primary">{t(`${k}.solutionHighlight`)}</span>
            </h2>
          </motion.div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {solutions.map((s, i) => {
              const Icon = solIcons[i];
              return (
                <motion.div key={i} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.4, delay: i * 0.08 }} className="border border-border p-8 hover:border-primary/40 transition-colors">
                  <Icon size={24} className="text-primary mb-4" strokeWidth={1.5} />
                  <h3 className="font-mono text-sm font-bold uppercase tracking-wider mb-3">{s.title}</h3>
                  <p className="font-body text-sm text-muted-foreground leading-relaxed mb-4">{s.desc}</p>
                  <ul className="space-y-2">
                    {s.specs.map((spec) => (
                      <li key={spec} className="flex items-center gap-2">
                        <CheckCircle2 size={14} className="text-primary shrink-0" />
                        <span className="font-mono text-xs text-muted-foreground">{spec}</span>
                      </li>
                    ))}
                  </ul>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section className="section-dark py-16 md:py-24">
        <div className="container">
          <motion.div {...fadeIn} className="mb-12">
            <p className="font-mono text-xs tracking-[0.3em] uppercase text-primary mb-4">{t(`${k}.benefitsTag`)}</p>
            <h2 className="text-2xl md:text-4xl">
              {t(`${k}.benefitsTitle1`)}<span className="text-primary">{t(`${k}.benefitsHighlight`)}</span>{t(`${k}.benefitsTitle2`)}
            </h2>
          </motion.div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-px bg-border">
            {benefits.map((b, i) => {
              const Icon = benIcons[i];
              return (
                <motion.div key={i} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.4, delay: i * 0.08 }} className="bg-secondary p-8">
                  <Icon size={20} className="text-primary mb-4" strokeWidth={1.5} />
                  <h3 className="font-mono text-sm font-bold mb-2">{b.title}</h3>
                  <p className="font-body text-sm text-muted-foreground leading-relaxed">{b.text}</p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* LGPD */}
      <section className="section-light py-16 md:py-24">
        <div className="container max-w-4xl">
          <motion.div {...fadeIn}>
            <p className="font-mono text-xs tracking-[0.3em] uppercase text-primary mb-4">{t(`${k}.lgpdTag`)}</p>
            <h2 className="text-2xl md:text-3xl mb-6">
              {t(`${k}.lgpdTitle1`)}<span className="text-primary">{t(`${k}.lgpdHighlight`)}</span>
            </h2>
            <div className="font-body text-muted-foreground leading-relaxed space-y-4">
              <p dangerouslySetInnerHTML={{ __html: t(`${k}.lgpdP1`) }} />
              <p>{t(`${k}.lgpdP2`)}</p>
              <p dangerouslySetInnerHTML={{ __html: t(`${k}.lgpdP3`) }} />
            </div>
            <div className="grid sm:grid-cols-3 gap-6 mt-8">
              {lgpdCards.map((item) => (
                <div key={item.label} className="border border-border p-4">
                  <p className="font-mono text-xs font-bold text-primary mb-1">{item.label}</p>
                  <p className="font-body text-xs text-muted-foreground">{item.desc}</p>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* FAQ */}
      <section className="section-dark py-16 md:py-24">
        <div className="container max-w-3xl">
          <motion.div {...fadeIn} className="mb-12">
            <p className="font-mono text-xs tracking-[0.3em] uppercase text-primary mb-4">{t(`${k}.faqTag`)}</p>
            <h2 className="text-2xl md:text-4xl">{t(`${k}.faqTitle`)}</h2>
          </motion.div>
          <div className="space-y-px">
            {faq.map((item, i) => (
              <motion.details key={i} initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.3, delay: i * 0.05 }} className="bg-secondary group">
                <summary className="p-6 cursor-pointer font-mono text-sm font-bold hover:text-primary transition-colors list-none flex justify-between items-center">
                  {item.question}
                  <ArrowRight size={16} className="text-primary group-open:rotate-90 transition-transform shrink-0 ml-4" />
                </summary>
                <div className="px-6 pb-6">
                  <p className="font-body text-sm text-muted-foreground leading-relaxed">{item.answer}</p>
                </div>
              </motion.details>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section id="contato-saude" className="section-light py-16 md:py-24">
        <div className="container max-w-3xl text-center">
          <motion.div {...fadeIn}>
            <h2 className="text-2xl md:text-4xl mb-4">
              {t(`${k}.ctaTitle1`)}<span className="text-primary">{t(`${k}.ctaHighlight`)}</span>
            </h2>
            <p className="font-body text-muted-foreground max-w-xl mx-auto mb-8 leading-relaxed">{t(`${k}.ctaDescription`)}</p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <a href={`https://wa.me/5511963166915?text=${encodeURIComponent(whatsappMsg)}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-8 py-4 font-mono text-sm font-bold uppercase tracking-wider hover:brightness-110 transition-all">
                <MessageCircle size={16} /> {t(`${k}.ctaDiagBtn`)}
              </a>
              <a href="https://wa.me/5511963166915" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 border border-border text-foreground px-8 py-4 font-mono text-sm uppercase tracking-wider hover:border-primary hover:text-primary transition-all">
                {t(`${k}.ctaWhatsapp`)}
              </a>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Related */}
      <section className="section-dark py-12 border-t border-border">
        <div className="container">
          <p className="font-mono text-xs tracking-[0.3em] uppercase text-muted-foreground mb-6">{t(`${k}.relatedTag`)}</p>
          <div className="flex flex-wrap gap-3">
            {relatedLinks.map((link) => (
              <Link key={link.href} to={link.href} className="inline-flex items-center gap-2 border border-border px-4 py-2 font-mono text-xs uppercase tracking-wider text-muted-foreground hover:border-primary hover:text-primary transition-colors">
                {link.label} <ArrowRight size={12} />
              </Link>
            ))}
          </div>
        </div>
      </section>

      <Footer />
      <WhatsAppButton />
    </div>
  );
};

export default TiHospitaisClinicasPage;
