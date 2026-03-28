import { useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { ArrowLeft, ArrowRight, CheckCircle2, MessageCircle, ChevronRight, ShieldCheck, Building2, Award, Zap, AlertTriangle, Clock } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import HoursCalculator from "@/components/orcamento/HoursCalculator";
import EmergencyLeadForm from "@/components/EmergencyLeadForm";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import SeoHead from "@/components/SeoHead";
import JsonLd, { buildFaqSchema, buildBreadcrumbSchema, buildServiceSchema } from "@/components/JsonLd";
import { openWhatsApp } from "@/lib/whatsapp";

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
  showHoursCalculator?: boolean;
  cityName?: string;
  citySlug?: string;
  extraSections?: React.ReactNode;
  isProblemPage?: boolean;
  problemName?: string;
}

const fadeIn = {
  initial: { opacity: 0, y: 20 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true as const },
  transition: { duration: 0.5 },
};

/* ── Micro-CTA reusable block ── */
const MicroCta = ({ href, cityName, pageTitle }: { href: string; whatsappMessage: string; cityName?: string; pageTitle?: string }) => {
  const { t } = useTranslation();
  return (
    <motion.div {...fadeIn} className="py-8 md:py-10">
      <div className="container">
        <div className="bg-primary/5 border border-primary/20 rounded-lg p-6 md:p-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <p className="font-mono text-xs tracking-[0.3em] uppercase text-primary mb-1">{t("service.microCtaTag")}</p>
            <p className="font-body text-sm md:text-base text-foreground">
              {cityName ? t("service.microCtaTextCity", { city: cityName }) : `${t("service.microCtaText")}.`}
            </p>
          </div>
          <div className="flex gap-3 shrink-0">
            <Link
              to={href}
              className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-5 py-3 font-mono text-xs font-bold uppercase tracking-wider hover:brightness-110 transition-all btn-glow rounded"
            >
              {t("service.microCtaBtn")}
            </Link>
            <button
              onClick={() => openWhatsApp({ pageTitle, intent: "specialist" })}
              className="inline-flex items-center gap-2 border border-border text-foreground px-5 py-3 font-mono text-xs uppercase tracking-wider hover:border-primary hover:text-primary transition-all rounded"
            >
              <MessageCircle size={14} />
              WhatsApp
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

/* ── Authority bar ── */
const AuthorityBar = () => {
  const { t } = useTranslation();
  return (
    <section className="section-light py-8 md:py-10 border-b border-border">
      <div className="container">
        <div className="flex flex-wrap items-center justify-center gap-6 md:gap-10">
          {[
            { icon: Award, text: t("authority.years") },
            { icon: Building2, text: t("authority.clients") },
            { icon: ShieldCheck, text: t("authority.partners") },
            { icon: Zap, text: t("authority.sla") },
          ].map((a) => (
            <div key={a.text} className="flex items-center gap-2">
              <a.icon size={16} className="text-primary shrink-0" />
              <span className="text-xs md:text-sm font-mono font-bold text-muted-foreground">{a.text}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

/* ── "What your company avoids" block ── */
const AvoidanceBlock = ({ cityName }: { cityName?: string }) => {
  const { t } = useTranslation();
  const avoidItems = t("service.avoidItems", { returnObjects: true }) as string[];
  return (
    <section className="section-light py-16 md:py-20">
      <div className="container max-w-4xl">
        <motion.div {...fadeIn}>
          <p className="font-mono text-xs tracking-[0.3em] uppercase text-primary mb-4">
            {t("service.avoidTag")}
          </p>
          <h2 className="text-2xl md:text-3xl mb-8">
            {cityName ? t("service.avoidTitleCity", { city: cityName }) : t("service.avoidTitle")} <span className="text-primary">{t("service.avoidTitleHighlight")}</span>:
          </h2>
          <div className="grid sm:grid-cols-2 gap-4">
            {[AlertTriangle, Clock, ShieldCheck, Building2].map((Icon, i) => (
              <div key={i} className="flex items-start gap-3 p-4 bg-destructive/5 border border-destructive/10 rounded-lg">
                <Icon size={18} className="text-destructive mt-0.5 shrink-0" />
                <p className="font-body text-sm text-foreground leading-relaxed">{avoidItems[i]}</p>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
};

/* ── Urgency block ── */
const UrgencyBlock = ({ cityName, pageTitle }: { whatsappMessage: string; currentPath: string; cityName?: string; pageTitle?: string }) => {
  const { t } = useTranslation();
  return (
    <section className="py-12 md:py-16 bg-destructive/5 border-y border-destructive/10">
      <div className="container max-w-3xl text-center">
        <motion.div {...fadeIn}>
          <p className="font-mono text-xs tracking-[0.3em] uppercase text-destructive mb-4">
            {t("service.urgencyTag")}
          </p>
          <h2 className="text-2xl md:text-3xl mb-4">
            {t("service.urgencyTitle")} <span className="text-destructive">{t("service.urgencyTitleHighlight")}</span>
          </h2>
          <p className="font-body text-muted-foreground max-w-xl mx-auto mb-6 leading-relaxed">
            {t("service.urgencyDesc")}
            {" "}{cityName ? t("service.urgencyDescCity", { city: cityName }) : t("service.urgencyDescGeneric")}
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              onClick={() => openWhatsApp({ pageTitle, intent: "specialist" })}
              className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-8 py-4 font-mono text-sm font-bold uppercase tracking-wider hover:brightness-110 transition-all btn-glow rounded"
            >
              <MessageCircle size={16} />
              {t("service.urgencyCta")}
            </button>
            <Link
              to="/orcamento-ti"
              className="inline-flex items-center gap-2 border border-border text-foreground px-8 py-4 font-mono text-sm uppercase tracking-wider hover:border-primary hover:text-primary transition-all rounded"
            >
              {t("service.urgencyCtaContract")}
            </Link>
          </div>
        </motion.div>
      </div>
    </section>
  );
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
  showHoursCalculator = false,
  cityName,
  citySlug,
  extraSections,
}: ServicePageProps) => {
  const isProblemPage = arguments[0]?.isProblemPage;
  const problemName = arguments[0]?.problemName;
  const { t } = useTranslation();
  const location = useLocation();
  const baseUrl = "https://wmti.com.br";
  const currentPath = location.pathname;
  const canonicalUrl = canonicalSlug
    ? `${baseUrl}/${canonicalSlug}`
    : `${baseUrl}${currentPath}`;

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [currentPath]);

  const breadcrumbItems = [
    { name: t("service.breadcrumbHome"), url: `${baseUrl}/` },
    { name: tag, url: `${baseUrl}${currentPath}` },
  ];

  const contractHref = "/orcamento-ti";

  return (
    <div className="min-h-screen">
      <SeoHead
        title={metaTitle}
        description={metaDescription}
        canonical={canonicalUrl}
        noindex={!shouldIndex}
        ogImage={heroImage}
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

      {/* ══ HERO ══ */}
      <section className="section-dark pt-24 md:pt-28 pb-16 md:pb-24 border-b-4 border-primary">
        <div className="container">
          <div className={`${heroImage ? 'grid md:grid-cols-2 gap-12 items-center' : ''}`}>
            <motion.div {...fadeIn} className="max-w-4xl">
              <nav aria-label="Breadcrumb" className="mb-6">
                <ol className="flex items-center gap-1 font-mono text-xs text-gunmetal-foreground/50">
                  <li>
                    <Link to="/" className="hover:text-primary transition-colors">{t("service.breadcrumbHome")}</Link>
                  </li>
                  <ChevronRight size={10} className="shrink-0" />
                  <li className="text-primary truncate" aria-current="page">{tag}</li>
                </ol>
              </nav>

              <p className="font-mono text-xs tracking-[0.3em] uppercase text-primary mb-4">
                {t("service.tagPrefix")} {tag}
              </p>
              <h1 className="text-3xl md:text-5xl lg:text-6xl mb-6">{headline}</h1>
              <p className="font-body text-lg md:text-xl text-gunmetal-foreground/70 max-w-2xl leading-relaxed mb-8">
                {description}
              </p>

              <div className="flex flex-wrap gap-4">
                <Link
                  to={contractHref}
                  className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-8 py-4 font-mono text-sm font-bold uppercase tracking-wider hover:brightness-110 transition-all btn-glow"
                >
                  <ArrowRight size={16} />
                  {t("service.ctaContract")}
                </Link>
                <button
                  onClick={() => openWhatsApp({ pageTitle: title, intent: "specialist" })}
                  className="inline-flex items-center gap-2 border border-gunmetal-foreground/30 text-gunmetal-foreground px-8 py-4 font-mono text-sm font-bold uppercase tracking-wider hover:border-primary hover:text-primary transition-all"
                >
                  <MessageCircle size={16} />
                  {t("service.ctaSpecialist")}
                </button>
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

      {/* ══ AUTHORITY BAR ══ */}
      <AuthorityBar />

      {/* ══ Pain Points & Solutions ══ */}
      <section className="section-light py-16 md:py-24">
        <div className="container">
          <div className="grid md:grid-cols-2 gap-12 md:gap-16">
            <motion.div {...fadeIn}>
              <p className="font-mono text-xs tracking-[0.3em] uppercase text-destructive mb-4">
                {t("service.painTag")}
              </p>
              <h2 className="text-2xl md:text-3xl mb-6">
                {t("service.painTitle")}
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
                {t("service.solutionTag")}
              </p>
              <h2 className="text-2xl md:text-3xl mb-6">
                {t("service.solutionTitle")} <span className="text-primary">{t("service.solutionTitleHighlight")}</span> {t("service.solutionTitleEnd")}
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

      {/* ══ MICRO-CTA 1 ══ */}
      <MicroCta href="/orcamento-ti" whatsappMessage={whatsappMessage} cityName={cityName} pageTitle={title} />

      {/* ══ EMERGENCY LEAD FORM (problem pages only) ══ */}
      {isProblemPage && (
        <EmergencyLeadForm
          problemName={problemName || tag}
          cityName={cityName}
          sourcePage={currentPath}
        />
      )}

      {/* ══ Benefits ══ */}
      <section className="section-dark py-16 md:py-24">
        <div className="container">
          <motion.div {...fadeIn} className="mb-12">
            <p className="font-mono text-xs tracking-[0.3em] uppercase text-primary mb-4">
              {t("service.benefitsTag")}
            </p>
            <h2 className="text-2xl md:text-4xl">
              {t("service.benefitsTitle")} <span className="text-primary">{t("service.benefitsTitleHighlight")}{cityName ? ` em ${cityName}` : ''}</span>
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

      {/* ══ WHAT YOUR COMPANY AVOIDS ══ */}
      <AvoidanceBlock cityName={cityName} />

      {/* ══ Local SEO content ══ */}
      {localContent && (
        <section className="section-light py-16 md:py-24">
          <div className="container max-w-3xl">
            <motion.div {...fadeIn}>
              <p className="font-mono text-xs tracking-[0.3em] uppercase text-primary mb-4">
                {t("service.localTag")}
              </p>
              <div className="font-body text-muted-foreground leading-relaxed space-y-4">
                <p>{localContent}</p>
              </div>
            </motion.div>
          </div>
        </section>
      )}

      {/* ══ MICRO-CTA 2 ══ */}
      <MicroCta href={contractHref} whatsappMessage={whatsappMessage} cityName={cityName} pageTitle={title} />

      {/* ══ URGENCY BLOCK ══ */}
      <UrgencyBlock whatsappMessage={whatsappMessage} currentPath={currentPath} cityName={cityName} pageTitle={title} />

      {/* ══ FAQ ══ */}
      <section className="section-dark py-16 md:py-24">
        <div className="container max-w-3xl">
          <motion.div {...fadeIn} className="mb-12">
            <p className="font-mono text-xs tracking-[0.3em] uppercase text-primary mb-4">
              {t("service.faqTag")}
            </p>
            <h2 className="text-2xl md:text-4xl">{t("service.faqTitle")}</h2>
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

      {/* ══ Hours Calculator ══ */}
      {showHoursCalculator && <HoursCalculator serviceName={tag} />}

      {/* ══ Extra Sections (e.g. downtime calculator) ══ */}
      {extraSections}

      {/* ══ CTA FINAL FORTE ══ */}
      <section id="contato-servico" className="section-dark py-16 md:py-24 border-t-4 border-primary">
        <div className="container max-w-3xl text-center">
          <motion.div {...fadeIn}>
            <p className="font-mono text-xs tracking-[0.3em] uppercase text-primary mb-4">
              {t("service.finalTag")}
            </p>
            <h2 className="text-2xl md:text-4xl mb-4">
              {cityName ? t("service.finalTitleCity", { city: cityName }) : t("service.finalTitle")} <span className="text-destructive">{t("service.finalTitleHighlight")}</span> {t("service.finalTitleEnd")}
            </h2>
            <h3 className="text-lg md:text-xl text-muted-foreground mb-2">
              {t("service.finalSubtitle")} <span className="text-primary font-bold">{t("service.finalSubtitleHighlight")}</span>.
            </h3>
            <p className="font-body text-muted-foreground max-w-xl mx-auto mb-8 leading-relaxed">
              {cityName ? t("service.finalDescCity", { city: cityName }) : t("service.finalDesc")}
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <button
                onClick={() => openWhatsApp({ pageTitle: title, intent: "proposal" })}
                className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-8 py-4 font-mono text-sm font-bold uppercase tracking-wider hover:brightness-110 transition-all btn-glow rounded"
              >
                <MessageCircle size={16} />
                {t("service.finalCtaWhatsapp")}
              </button>
              <Link
                to="/orcamento-ti"
                className="inline-flex items-center gap-2 border border-border text-foreground px-8 py-4 font-mono text-sm uppercase tracking-wider hover:border-primary hover:text-primary transition-all rounded"
              >
                {t("service.finalCtaOnline")}
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ══ Related services ══ */}
      {relatedLinks.length > 0 && (
        <section className="section-dark py-12 border-t border-gunmetal-foreground/10">
          <div className="container">
            <p className="font-mono text-xs tracking-[0.3em] uppercase text-muted-foreground mb-6">
              // {cityName ? t("service.relatedTagCity", { city: cityName }) : t("service.relatedTag")}
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
    </div>
  );
};

export default ServicePageTemplate;
