import { useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, ArrowRight, CheckCircle2, MessageCircle, ChevronRight } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import HoursCalculator from "@/components/orcamento/HoursCalculator";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import WhatsAppButton from "@/components/WhatsAppButton";
import SeoHead from "@/components/SeoHead";
import JsonLd, { buildFaqSchema, buildBreadcrumbSchema, buildServiceSchema } from "@/components/JsonLd";

interface FAQ {
  question: string;
  answer: string;
}

interface ServicePageProps {
  title: string;
  metaTitle: string;
  metaDescription: string;
  tag: string;
  headline: React.ReactNode;
  description: string;
  benefits: { icon: LucideIcon; title: string; text: string }[];
  painPoints: string[];
  solutions: string[];
  faq: FAQ[];
  relatedLinks: { label: string; href: string }[];
  whatsappMessage: string;
  localContent?: string;
  canonicalSlug?: string;
  shouldIndex?: boolean;
  heroImage?: string;
  heroImageAlt?: string;
}

const fadeIn = {
  initial: { opacity: 0, y: 20 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true as const },
  transition: { duration: 0.5 },
};

const ServicePageTemplate = ({
  title,
  metaTitle,
  metaDescription,
  tag,
  headline,
  description,
  benefits,
  painPoints,
  solutions,
  faq,
  relatedLinks,
  whatsappMessage,
  localContent,
  canonicalSlug,
  shouldIndex = true,
  heroImage,
  heroImageAlt,
}: ServicePageProps) => {
  const location = useLocation();
  const baseUrl = "https://wmti.com.br";
  const currentPath = location.pathname;
  const canonicalUrl = canonicalSlug
    ? `${baseUrl}/${canonicalSlug}`
    : `${baseUrl}${currentPath}`;

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [currentPath]);

  // Breadcrumb items
  const breadcrumbItems = [
    { name: "Home", url: `${baseUrl}/` },
    { name: tag, url: `${baseUrl}${currentPath}` },
  ];

  return (
    <div className="min-h-screen">
      <SeoHead
        title={metaTitle}
        description={metaDescription}
        canonical={canonicalUrl}
        noindex={!shouldIndex}
      />
      <JsonLd data={buildFaqSchema(faq)} />
      <JsonLd data={buildBreadcrumbSchema(breadcrumbItems)} />
      <JsonLd
        data={buildServiceSchema({
          name: tag,
          description: metaDescription,
          url: canonicalUrl,
        })}
      />
      <Navbar />

      <section className="section-dark pt-24 md:pt-28 pb-16 md:pb-24 border-b-4 border-primary">
        <div className="container">
          <div className={`${heroImage ? 'grid md:grid-cols-2 gap-12 items-center' : ''}`}>
            <motion.div {...fadeIn} className="max-w-4xl">
              {/* Breadcrumbs */}
              <nav aria-label="Breadcrumb" className="mb-6">
                <ol className="flex items-center gap-1 font-mono text-xs text-gunmetal-foreground/50">
                  <li>
                    <Link to="/" className="hover:text-primary transition-colors">Home</Link>
                  </li>
                  <ChevronRight size={10} className="shrink-0" />
                  <li className="text-primary truncate" aria-current="page">{tag}</li>
                </ol>
              </nav>

              <p className="font-mono text-xs tracking-[0.3em] uppercase text-primary mb-4">
                // {tag}
              </p>
              <h1 className="text-3xl md:text-5xl lg:text-6xl mb-6">{headline}</h1>
              <p className="font-body text-lg md:text-xl text-gunmetal-foreground/70 max-w-2xl leading-relaxed mb-8">
                {description}
              </p>

              <div className="flex flex-wrap gap-4">
                <Link
                  to="/orcamento-ti"
                  className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-8 py-4 font-mono text-sm font-bold uppercase tracking-wider hover:brightness-110 transition-all"
                >
                  <ArrowRight size={16} />
                  Contrate este serviço
                </Link>
                <a
                  href={`https://wa.me/5511963166915?text=${encodeURIComponent(whatsappMessage)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 border border-gunmetal-foreground/30 text-gunmetal-foreground px-8 py-4 font-mono text-sm font-bold uppercase tracking-wider hover:border-primary hover:text-primary transition-all"
                >
                  <MessageCircle size={16} />
                  Falar com especialista
                </a>
              </div>
            </motion.div>

            {heroImage && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: 0.2 }}
                className="hidden md:block"
              >
                <img
                  src={heroImage}
                  alt={heroImageAlt || tag}
                  className="w-full h-auto rounded-sm shadow-lg object-cover aspect-[4/3]"
                  loading="eager"
                />
              </motion.div>
            )}
          </div>
        </div>
      </section>

      {/* Pain Points & Solutions */}
      <section className="section-light py-16 md:py-24">
        <div className="container">
          <div className="grid md:grid-cols-2 gap-12 md:gap-16">
            <motion.div {...fadeIn}>
              <p className="font-mono text-xs tracking-[0.3em] uppercase text-destructive mb-4">
                // Problemas comuns
              </p>
              <h2 className="text-2xl md:text-3xl mb-6">
                Sua empresa enfrenta isso?
              </h2>
              <ul className="space-y-4">
                {painPoints.map((point) => (
                  <li key={point} className="flex items-start gap-3">
                    <span className="w-2 h-2 rounded-full bg-destructive mt-2 shrink-0" />
                    <p className="font-body text-muted-foreground leading-relaxed">{point}</p>
                  </li>
                ))}
              </ul>
            </motion.div>

            <motion.div {...fadeIn}>
              <p className="font-mono text-xs tracking-[0.3em] uppercase text-primary mb-4">
                // Nossa solução
              </p>
              <h2 className="text-2xl md:text-3xl mb-6">
                Como a <span className="text-primary">WMTi</span> resolve
              </h2>
              <ul className="space-y-4">
                {solutions.map((solution) => (
                  <li key={solution} className="flex items-start gap-3">
                    <CheckCircle2 size={18} className="text-primary mt-0.5 shrink-0" />
                    <p className="font-body text-muted-foreground leading-relaxed">{solution}</p>
                  </li>
                ))}
              </ul>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section className="section-dark py-16 md:py-24">
        <div className="container">
          <motion.div {...fadeIn} className="mb-12">
            <p className="font-mono text-xs tracking-[0.3em] uppercase text-primary mb-4">
              // Benefícios
            </p>
            <h2 className="text-2xl md:text-4xl">
              Por que escolher a <span className="text-primary">WMTi</span>
            </h2>
          </motion.div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-px bg-gunmetal-foreground/10">
            {benefits.map((b, i) => (
              <motion.div
                key={b.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.08 }}
                className="bg-secondary p-8"
              >
                <b.icon size={20} className="text-primary mb-4" strokeWidth={1.5} />
                <h3 className="font-mono text-sm font-bold mb-2">{b.title}</h3>
                <p className="font-body text-sm text-gunmetal-foreground/60 leading-relaxed">{b.text}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Local SEO content */}
      {localContent && (
        <section className="section-light py-16 md:py-24">
          <div className="container max-w-3xl">
            <motion.div {...fadeIn}>
              <p className="font-mono text-xs tracking-[0.3em] uppercase text-primary mb-4">
                // Atendimento regional
              </p>
              <div className="font-body text-muted-foreground leading-relaxed space-y-4">
                <p>{localContent}</p>
              </div>
            </motion.div>
          </div>
        </section>
      )}

      {/* FAQ */}
      <section className="section-dark py-16 md:py-24">
        <div className="container max-w-3xl">
          <motion.div {...fadeIn} className="mb-12">
            <p className="font-mono text-xs tracking-[0.3em] uppercase text-primary mb-4">
              // Perguntas frequentes
            </p>
            <h2 className="text-2xl md:text-4xl">FAQ</h2>
          </motion.div>

          <div className="space-y-px">
            {faq.map((item, i) => (
              <motion.details
                key={i}
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.3, delay: i * 0.05 }}
                className="bg-secondary group"
              >
                <summary className="p-6 cursor-pointer font-mono text-sm font-bold text-gunmetal-foreground hover:text-primary transition-colors list-none flex justify-between items-center">
                  {item.question}
                  <ArrowRight size={16} className="text-primary group-open:rotate-90 transition-transform shrink-0 ml-4" />
                </summary>
                <div className="px-6 pb-6">
                  <p className="font-body text-sm text-gunmetal-foreground/70 leading-relaxed">{item.answer}</p>
                </div>
              </motion.details>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section id="contato-servico" className="section-light py-16 md:py-24">
        <div className="container max-w-3xl text-center">
          <motion.div {...fadeIn}>
            <h2 className="text-2xl md:text-4xl mb-4">
              Pronto para melhorar sua <span className="text-primary">infraestrutura?</span>
            </h2>
            <p className="font-body text-muted-foreground max-w-xl mx-auto mb-8 leading-relaxed">
              Solicite um diagnóstico gratuito. Nossa equipe técnica avalia sua infraestrutura atual e apresenta um projeto personalizado.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <a
                href={`https://wa.me/5511963166915?text=${encodeURIComponent(whatsappMessage)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-8 py-4 font-mono text-sm font-bold uppercase tracking-wider hover:brightness-110 transition-all"
              >
                <MessageCircle size={16} />
                Falar no WhatsApp
              </a>
              <Link
                to="/orcamento-ti"
                className="inline-flex items-center gap-2 border border-border text-foreground px-8 py-4 font-mono text-sm uppercase tracking-wider hover:border-primary hover:text-primary transition-all"
              >
                Solicitar orçamento online
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Related services */}
      {relatedLinks.length > 0 && (
        <section className="section-dark py-12 border-t border-gunmetal-foreground/10">
          <div className="container">
            <p className="font-mono text-xs tracking-[0.3em] uppercase text-muted-foreground mb-6">
              // Serviços relacionados
            </p>
            <div className="flex flex-wrap gap-3">
              {relatedLinks.map((link) => (
                <Link
                  key={link.href}
                  to={link.href}
                  className="inline-flex items-center gap-2 border border-gunmetal-foreground/20 px-4 py-2 font-mono text-xs uppercase tracking-wider text-gunmetal-foreground/60 hover:border-primary hover:text-primary transition-colors"
                >
                  {link.label}
                  <ArrowRight size={12} />
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      <Footer />
      <WhatsAppButton />
    </div>
  );
};

export default ServicePageTemplate;
