import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
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
import { openWhatsApp } from "@/lib/whatsapp";
import { trackWhatsApp } from "@/lib/tracking";
import { useState } from "react";
import type { LucideIcon } from "lucide-react";

const fade = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true },
  transition: { duration: 0.5 },
};

/* ─── AUTORIDADE ─── */
export const HomeAuthority = () => {
  const { t } = useTranslation();
  return (
    <section className="py-12 md:py-16 bg-background border-y border-border">
      <div className="container">
        <motion.div {...fade} className="text-center mb-8">
          <h2 className="text-2xl md:text-4xl mb-3">
            {t("home.authorityTitle")} <span className="text-primary">{t("home.authorityTitleHighlight")}</span> {t("home.authorityTitleEnd")}
          </h2>
          <p className="font-body text-muted-foreground text-sm md:text-base max-w-2xl mx-auto leading-relaxed">
            {t("home.authorityDesc")}
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
};

/* ─── PROBLEMAS ─── */
const problemCards: { icon: LucideIcon; labelKey: string; slug: string; desc: string }[] = [
  { icon: Wifi, labelKey: "Rede Lenta?", slug: "rede-lenta", desc: "Internet travando, quedas e lentidão na rede corporativa" },
  { icon: Server, labelKey: "Servidor Travando?", slug: "servidor-travando", desc: "Servidor caindo, reiniciando ou com erros críticos" },
  { icon: Monitor, labelKey: "Computador Lento?", slug: "computador-lento", desc: "Máquinas demorando para ligar, travar ao abrir programas" },
  { icon: ShieldAlert, labelKey: "Vírus na Rede?", slug: "virus-na-rede", desc: "Ransomware, malware ou ameaças comprometendo seus dados" },
  { icon: HardDrive, labelKey: "Sem Backup?", slug: "sem-backup", desc: "Dados sem proteção, risco de perda total de informações" },
  { icon: Headphones, labelKey: "Sem Suporte de TI?", slug: "sem-suporte-de-ti", desc: "Empresa sem equipe técnica para resolver problemas urgentes" },
];

export const HomeProblems = () => {
  const { t } = useTranslation();

  return (
    <section className="py-16 md:py-24 section-dark">
      <div className="container">
        <motion.div {...fade} className="mb-10 md:mb-14">
          <p className="font-mono text-xs tracking-[0.3em] uppercase text-primary mb-4">
            {t("home.problemsTag")}
          </p>
          <h2 className="text-2xl md:text-4xl lg:text-5xl max-w-2xl mb-4">
            {t("home.problemsTitle")} <span className="text-primary">{t("home.problemsTitleHighlight")}</span> {t("home.problemsTitleEnd")}
          </h2>
          <p className="font-body text-muted-foreground text-sm md:text-base max-w-xl leading-relaxed">
            {t("home.problemsDesc")}
          </p>
        </motion.div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-6">
          {problemCards.map((item, i) => {
            const Icon = item.icon;
            return (
              <motion.div
                key={item.slug}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.06 }}
              >
                <Link
                  to={`/${item.slug}-em-jacarei`}
                  className="flex flex-col items-start gap-3 p-5 md:p-8 bg-background border border-border hover:border-primary/50 transition-all group h-full"
                >
                  <div className="w-10 h-10 flex items-center justify-center border border-destructive/30 bg-destructive/5 group-hover:bg-destructive/10 transition-colors">
                    <Icon size={20} className="text-destructive" strokeWidth={1.5} />
                  </div>
                  <span className="font-mono text-xs md:text-sm uppercase tracking-wider text-foreground group-hover:text-primary transition-colors font-bold">
                    {item.labelKey}
                  </span>
                  <p className="font-body text-xs text-muted-foreground leading-relaxed">
                    {item.desc}
                  </p>
                  <span className="font-mono text-[10px] uppercase tracking-wider text-primary opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 mt-auto">
                    Resolver agora →
                  </span>
                </Link>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

/* ─── DIFERENCIAIS ─── */
const diffIcons: LucideIcon[] = [Clock, Target, Lock, Activity, Wrench, TrendingUp];

export const HomeDifferentials = () => {
  const { t } = useTranslation();
  const differentials = t("home.differentials", { returnObjects: true }) as string[];

  return (
    <section className="py-16 md:py-24 bg-background">
      <div className="container">
        <motion.div {...fade} className="mb-10 md:mb-14">
          <p className="font-mono text-xs tracking-[0.3em] uppercase text-primary mb-4">
            {t("home.diffTag")}
          </p>
          <h2 className="text-2xl md:text-4xl lg:text-5xl max-w-2xl mb-4">
            {t("home.diffTitle")} <span className="text-primary">{t("home.diffTitleHighlight")}</span>
          </h2>
        </motion.div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
          {differentials.map((title, i) => {
            const Icon = diffIcons[i] || Clock;
            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.08 }}
                className="flex items-center gap-4 p-5 md:p-6 border border-border hover:border-primary/40 transition-colors group"
              >
                <div className="w-10 h-10 flex items-center justify-center border border-primary/30 bg-primary/5 group-hover:bg-primary/10 transition-colors shrink-0">
                  <Icon size={20} className="text-primary" strokeWidth={1.5} />
                </div>
                <span className="font-mono text-xs md:text-sm uppercase tracking-wider text-muted-foreground group-hover:text-primary transition-colors">
                  {title}
                </span>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

/* ─── FAQ SEO ─── */
export const HomeFaq = () => {
  const { t } = useTranslation();
  const [open, setOpen] = useState<number | null>(null);
  const faqItems = t("home.faqItems", { returnObjects: true }) as { q: string; a: string }[];

  return (
    <section className="py-16 md:py-24 section-dark">
      <div className="container max-w-3xl">
        <motion.div {...fade} className="mb-10 md:mb-14 text-center">
          <p className="font-mono text-xs tracking-[0.3em] uppercase text-primary mb-4">
            {t("home.faqTag")}
          </p>
          <h2 className="text-2xl md:text-4xl mb-4">
            {t("home.faqTitle")} <span className="text-primary">{t("home.faqTitleHighlight")}</span>
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
export const HomeCta = () => {
  const { t } = useTranslation();
  return (
    <section className="py-16 md:py-24 bg-background">
      <div className="container">
        <motion.div {...fade} className="text-center max-w-2xl mx-auto">
          <h2 className="text-2xl md:text-4xl lg:text-5xl mb-6">
            {t("home.ctaTitle")} <span className="text-primary">{t("home.ctaTitleHighlight")}</span>
          </h2>
          <p className="font-body text-muted-foreground text-sm md:text-base mb-8 leading-relaxed">
            {t("home.ctaDesc")}
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <a
              href="#contato"
              className="group inline-flex items-center justify-center gap-2 bg-primary text-primary-foreground px-8 py-4 font-mono text-sm font-bold uppercase tracking-wider hover:brightness-110 transition-all shadow-[0_0_30px_hsl(var(--primary)/0.3)]"
            >
              {t("home.ctaBtn")}
              <span className="group-hover:translate-x-1 transition-transform">→</span>
            </a>
            <button
              onClick={() => {
                trackWhatsApp("home-cta", "resolver-ti");
                openWhatsApp({ intent: "general" });
              }}
              className="inline-flex items-center justify-center gap-2 border border-primary/40 text-primary px-6 py-4 font-mono text-sm font-bold uppercase tracking-wider hover:bg-primary/10 transition-all"
            >
              {t("home.ctaWhatsapp")}
            </button>
          </div>
        </motion.div>
      </div>
    </section>
  );
};
