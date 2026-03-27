import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import {
  ShieldCheck, HardDrive, Cloud, Server, Lock, Activity,
  FileCheck, AlertTriangle, Zap, Network, Eye, KeyRound,
  FileWarning, Clock, BookOpen, Database, Wifi, Shield,
  Users, ArrowLeft, CheckCircle2, MessageCircle,
} from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import SeoHead from "@/components/SeoHead";
import { openWhatsApp } from "@/lib/whatsapp";

const fadeIn = {
  initial: { opacity: 0, y: 20 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true },
  transition: { duration: 0.5 },
};

const changesIcons = [FileWarning, Clock, Lock, Eye, Zap, Users];
const stageIcons = [BookOpen, Server, Lock, Eye, Network];
const diffIcons = [Server, Shield, Cloud, KeyRound, Activity, FileCheck];

const Provimento213 = () => {
  const { t } = useTranslation();
  const k = "custom.provimento213";

  const stats = t(`${k}.stats`, { returnObjects: true }) as { value: string; label: string }[];
  const changesCards = t(`${k}.changesCards`, { returnObjects: true }) as { title: string; text: string }[];
  const classes = t(`${k}.classes`, { returnObjects: true }) as { name: string; revenue: string; rpo: string; rto: string; backupFull: string; prazoInicial: string; prazoTotal: string; highlights: string[] }[];
  const stages = t(`${k}.stages`, { returnObjects: true }) as { title: string; prazo: string; items: string[]; services: string[] }[];
  const differentials = t(`${k}.differentials`, { returnObjects: true }) as { title: string; description: string }[];

  return (
    <div className="min-h-screen">
      <SeoHead
        title="Provimento 213 CNJ — Adequação de TI para Cartórios | WMTi"
        description="Guia completo do Provimento 213 do CNJ: requisitos de backup, segurança, firewall e infraestrutura obrigatória para serventias extrajudiciais."
        canonical="https://www.wmti.com.br/cartorios/provimento-213"
      />
      <Navbar />

      {/* Hero */}
      <section className="section-dark pt-28 pb-24 border-b-4 border-primary">
        <div className="container">
          <motion.div {...fadeIn} className="max-w-4xl">
            <Link to="/" className="inline-flex items-center gap-2 font-mono text-xs uppercase tracking-wider text-gunmetal-foreground/50 hover:text-primary transition-colors mb-8">
              <ArrowLeft size={14} /> {t(`${k}.back`)}
            </Link>
            <div className="flex items-center gap-3 mb-6">
              <ShieldCheck size={20} className="text-primary" />
              <p className="font-mono text-xs tracking-[0.3em] uppercase text-primary">// {t(`${k}.heroTag`)}</p>
            </div>
            <h1 className="text-3xl md:text-5xl lg:text-6xl mb-6">
              {t(`${k}.heroTitle1`).split("\n").map((line, i) => <span key={i}>{line}{i < t(`${k}.heroTitle1`).split("\n").length - 1 && <br />}</span>)}
              <span className="text-primary">{t(`${k}.heroHighlight`)}</span>
              {t(`${k}.heroTitle2`).split("\n").map((line, i) => <span key={i}>{i > 0 && <br />}{line}</span>)}
            </h1>
            <p className="font-body text-lg md:text-xl text-gunmetal-foreground/70 max-w-2xl leading-relaxed mb-8">
              {t(`${k}.heroDescription`)}
            </p>
            <div className="flex flex-wrap gap-4 mb-12">
              <button onClick={() => openWhatsApp({ pageTitle: "Provimento 213 CNJ", intent: "proposal" })} className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-8 py-4 font-mono text-sm font-bold uppercase tracking-wider hover:brightness-110 transition-all">
                <MessageCircle size={16} /> {t(`${k}.primaryCta`)}
              </button>
              <a href="https://atos.cnj.jus.br/atos/detalhar/6734" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 border border-gunmetal-foreground/30 text-gunmetal-foreground px-8 py-4 font-mono text-sm font-bold uppercase tracking-wider hover:border-primary hover:text-primary transition-all">
                {t(`${k}.secondaryCta`)}
              </a>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-gunmetal-foreground/10">
              {stats.map((stat) => (
                <div key={stat.label} className="bg-secondary p-5 text-center">
                  <p className="font-mono text-2xl md:text-3xl font-bold text-primary">{stat.value}</p>
                  <p className="font-body text-xs text-gunmetal-foreground/50 mt-1">{stat.label}</p>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* O que muda */}
      <section className="section-light py-24">
        <div className="container">
          <motion.div {...fadeIn} className="mb-16 max-w-3xl">
            <p className="font-mono text-xs tracking-[0.3em] uppercase text-primary mb-4">// {t(`${k}.changesTag`)}</p>
            <h2 className="text-2xl md:text-4xl mb-6">
              {t(`${k}.changesTitle1`)}<span className="text-primary">{t(`${k}.changesHighlight`)}</span>
            </h2>
            <p className="font-body text-muted-foreground leading-relaxed">{t(`${k}.changesDescription`)}</p>
          </motion.div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-px bg-border">
            {changesCards.map((item, i) => {
              const Icon = changesIcons[i];
              return (
                <motion.div key={i} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.4, delay: i * 0.08 }} className="bg-background p-8 group hover:bg-muted transition-colors">
                  <Icon size={18} className="text-primary mb-4" strokeWidth={1.5} />
                  <h3 className="text-base font-mono font-bold mb-3">{item.title}</h3>
                  <p className="font-body text-sm text-muted-foreground leading-relaxed">{item.text}</p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Classes */}
      <section className="section-dark py-24">
        <div className="container">
          <motion.div {...fadeIn} className="mb-16">
            <p className="font-mono text-xs tracking-[0.3em] uppercase text-primary mb-4">// {t(`${k}.classesTag`)}</p>
            <h2 className="text-2xl md:text-4xl max-w-2xl">
              {t(`${k}.classesTitle1`)}<span className="text-primary">{t(`${k}.classesHighlight`)}</span>
            </h2>
          </motion.div>
          <div className="grid md:grid-cols-3 gap-px bg-gunmetal-foreground/10">
            {classes.map((cls, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.4, delay: i * 0.1 }} className="bg-secondary p-8">
                <p className="font-mono text-2xl font-bold text-primary mb-1">{cls.name}</p>
                <p className="font-mono text-sm text-gunmetal-foreground/80 mb-4">{cls.revenue}</p>
                <div className="space-y-3 mb-6">
                  {[
                    [t(`${k}.maxRpo`), cls.rpo, true],
                    [t(`${k}.maxRto`), cls.rto, true],
                    [t(`${k}.fullBackup`), cls.backupFull, false],
                    [t(`${k}.initialDeadline`), cls.prazoInicial, false],
                    [t(`${k}.totalDeadline`), cls.prazoTotal, false],
                  ].map(([label, value, isPrimary]) => (
                    <div key={label as string} className="flex justify-between font-mono text-xs">
                      <span className="text-gunmetal-foreground/50">{label as string}</span>
                      <span className={isPrimary ? "text-primary font-bold" : "text-gunmetal-foreground font-bold"}>{value as string}</span>
                    </div>
                  ))}
                </div>
                <div className="border-t border-gunmetal-foreground/10 pt-4 space-y-2">
                  {cls.highlights.map((h) => (
                    <div key={h} className="flex items-center gap-2">
                      <CheckCircle2 size={12} className="text-primary shrink-0" />
                      <span className="font-body text-xs text-gunmetal-foreground/70">{h}</span>
                    </div>
                  ))}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Stages */}
      <section className="section-light py-24">
        <div className="container">
          <motion.div {...fadeIn} className="mb-16">
            <p className="font-mono text-xs tracking-[0.3em] uppercase text-primary mb-4">// {t(`${k}.roadmapTag`)}</p>
            <h2 className="text-2xl md:text-4xl max-w-3xl">
              {t(`${k}.roadmapTitle1`)}<span className="text-primary">{t(`${k}.roadmapHighlight`)}</span>
            </h2>
          </motion.div>
          <div className="space-y-px">
            {stages.map((stage, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.4, delay: i * 0.08 }} className="bg-muted border border-border">
                <div className="p-8 md:p-10">
                  <div className="flex items-start gap-6 mb-6">
                    <div className="flex items-center justify-center w-14 h-14 bg-primary text-primary-foreground font-mono text-xl font-bold shrink-0">
                      {String(i + 1).padStart(2, "0")}
                    </div>
                    <div className="flex-1">
                      <div className="flex flex-wrap items-center gap-3 mb-2">
                        <h3 className="text-lg md:text-xl font-mono font-bold">{stage.title}</h3>
                        <span className="font-mono text-[10px] tracking-wider uppercase text-muted-foreground border border-border px-2 py-0.5">{stage.prazo}</span>
                      </div>
                    </div>
                  </div>
                  <div className="grid md:grid-cols-2 gap-8 ml-0 md:ml-20">
                    <div>
                      <p className="font-mono text-xs tracking-wider uppercase text-primary mb-4">{t(`${k}.cnjRequirementsLabel`)}</p>
                      <ul className="space-y-2">
                        {stage.items.map((item) => (
                          <li key={item} className="flex items-start gap-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                            <span className="font-body text-sm text-muted-foreground">{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <p className="font-mono text-xs tracking-wider uppercase text-primary mb-4">{t(`${k}.wmtiHowLabel`)}</p>
                      <ul className="space-y-2">
                        {stage.services.map((s) => (
                          <li key={s} className="flex items-start gap-2">
                            <CheckCircle2 size={14} className="text-primary mt-0.5 shrink-0" />
                            <span className="font-body text-sm text-foreground font-medium">{s}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Differentials */}
      <section className="section-dark py-24">
        <div className="container">
          <motion.div {...fadeIn} className="mb-16">
            <p className="font-mono text-xs tracking-[0.3em] uppercase text-primary mb-4">// {t(`${k}.diffTag`)}</p>
            <h2 className="text-2xl md:text-4xl max-w-2xl">
              {t(`${k}.diffTitle1`)}<span className="text-primary">{t(`${k}.diffHighlight`)}</span>
            </h2>
          </motion.div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-px bg-gunmetal-foreground/10">
            {differentials.map((dif, i) => {
              const Icon = diffIcons[i];
              return (
                <motion.div key={i} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.4, delay: i * 0.08 }} className="bg-secondary p-8">
                  <Icon size={20} className="text-primary mb-4" strokeWidth={1.5} />
                  <h3 className="font-mono text-base font-bold mb-3">{dif.title}</h3>
                  <p className="font-body text-sm text-gunmetal-foreground/60 leading-relaxed">{dif.description}</p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* CTA Final */}
      <section className="section-light py-24">
        <div className="container">
          <motion.div {...fadeIn} className="border border-border p-8 md:p-16 text-center">
            <AlertTriangle size={32} className="text-primary mx-auto mb-6" />
            <p className="font-mono text-xs tracking-[0.3em] uppercase text-primary mb-4">// {t(`${k}.finalTag`)}</p>
            <h2 className="text-xl md:text-3xl mb-4">
              {t(`${k}.finalTitle1`)}<br /><span className="text-primary">{t(`${k}.finalHighlight`)}</span>
            </h2>
            <p className="font-body text-muted-foreground max-w-2xl mx-auto mb-8 leading-relaxed">{t(`${k}.finalDescription`)}</p>
            <div className="flex flex-wrap justify-center gap-4">
              <button onClick={() => openWhatsApp({ pageTitle: "Provimento 213 CNJ", intent: "specialist" })} className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-8 py-4 font-mono text-sm font-bold uppercase tracking-wider hover:brightness-110 transition-all">
                <MessageCircle size={16} /> {t(`${k}.finalCta`)}
              </button>
              <a href={`mailto:${t(`${k}.finalEmail`)}`} className="inline-flex items-center gap-2 border border-border text-foreground px-8 py-4 font-mono text-sm font-bold uppercase tracking-wider hover:border-primary hover:text-primary transition-all">
                {t(`${k}.finalEmail`)}
              </a>
            </div>
          </motion.div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default Provimento213;
