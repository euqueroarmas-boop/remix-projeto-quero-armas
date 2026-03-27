import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Monitor, Wrench, DollarSign, RefreshCw, Headphones, ShieldCheck,
  CheckCircle2, ArrowRight, AlertTriangle, TrendingDown, Clock, Ban,
  Zap, Building2, Award, Calculator, Send, Loader2,
  Minus, Plus, Laptop, MessageCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { openWhatsApp } from "@/lib/whatsapp";
import { useBrasilApiLookup } from "@/hooks/useBrasilApiLookup";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import SeoHead from "@/components/SeoHead";

/* ─── Plans (prices stay fixed) ─── */
const PLANS_DATA = [
  { id: "essencial", price: 249, popular: false },
  { id: "equilibrio", price: 299, popular: true },
  { id: "performance", price: 399, popular: false },
] as const;

const painIcons = [AlertTriangle, DollarSign, Clock, Ban, TrendingDown];
const benefitIcons = [Monitor, Wrench, RefreshCw, Headphones, DollarSign, ShieldCheck];
const authIcons = [Award, Building2, ShieldCheck, Zap];

/* ─── Format helpers ─── */
const formatCnpjCpf = (value: string) => {
  const digits = value.replace(/\D/g, "").slice(0, 14);
  if (digits.length <= 11) {
    return digits.replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d{1,2})$/, "$1-$2");
  }
  return digits.replace(/(\d{2})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1/$2").replace(/(\d{4})(\d{1,2})$/, "$1-$2");
};
const formatCep = (value: string) => { const d = value.replace(/\D/g, "").slice(0, 8); return d.replace(/(\d{5})(\d{1,3})/, "$1-$2"); };
const formatPhone = (value: string) => {
  const d = value.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 10) return d.replace(/(\d{2})(\d)/, "($1) $2").replace(/(\d{4})(\d{1,4})$/, "$1-$2");
  return d.replace(/(\d{2})(\d)/, "($1) $2").replace(/(\d{5})(\d{1,4})$/, "$1-$2");
};

const LocacaoComputadoresPage = () => {
  const { t } = useTranslation();
  const k = "custom.locacao";
  const navigate = useNavigate();
  const { toast } = useToast();
  const { lookupCnpj, lookupCep, cnpjLoading, cepLoading } = useBrasilApiLookup();

  const painPoints = t(`${k}.painPoints`, { returnObjects: true }) as string[];
  const benefits = t(`${k}.benefits`, { returnObjects: true }) as { title: string; desc: string }[];
  const comparisons = t(`${k}.comparisons`, { returnObjects: true }) as { item: string; compra: string; locacao: string }[];
  const compHeaders = t(`${k}.compHeaders`, { returnObjects: true }) as string[];
  const authItems = t(`${k}.authItems`, { returnObjects: true }) as string[];
  const plans = t(`${k}.plans`, { returnObjects: true }) as { name: string; cpu: string }[];
  const planIncludes = t(`${k}.planIncludes`, { returnObjects: true }) as string[];
  const nbTags = t(`${k}.nbTags`, { returnObjects: true }) as string[];
  const nbFeatures = t(`${k}.nbFeatures`, { returnObjects: true }) as { label: string; desc: string }[];

  /* ── Calculator state ── */
  const [selectedPlan, setSelectedPlan] = useState("equilibrio");
  const [qty, setQty] = useState(5);
  const planData = PLANS_DATA.find((p) => p.id === selectedPlan) || PLANS_DATA[1];
  const planName = plans[PLANS_DATA.findIndex((p) => p.id === selectedPlan)] ?.name || plans[1]?.name;
  const total = planData.price * qty;

  /* ── Lead capture ── */
  const [showLead, setShowLead] = useState(false);
  const [leadSent, setLeadSent] = useState(false);
  const [leadLoading, setLeadLoading] = useState(false);
  const [lead, setLead] = useState({ responsavel: "", whatsapp: "", email: "", empresa: "", nomeFantasia: "", cnpj: "", cidade: "", uf: "", cep: "", endereco: "", numero: "", complemento: "", bairro: "" });

  const rawCnpj = lead.cnpj.replace(/\D/g, "");
  const rawCep = lead.cep.replace(/\D/g, "");

  useEffect(() => {
    if (rawCnpj.length !== 14) return;
    lookupCnpj(rawCnpj).then((data) => {
      if (!data) { toast({ title: "CNPJ não encontrado", description: "Preencha manualmente.", variant: "destructive" }); return; }
      setLead((prev) => ({ ...prev, empresa: data.razao_social || prev.empresa, nomeFantasia: data.nome_fantasia || prev.nomeFantasia, endereco: data.logradouro || prev.endereco, numero: data.numero || prev.numero, complemento: data.complemento || prev.complemento, bairro: data.bairro || prev.bairro, cidade: data.municipio || prev.cidade, uf: data.uf || prev.uf, cep: data.cep ? formatCep(data.cep) : prev.cep, whatsapp: !prev.whatsapp && data.ddd_telefone_1 ? formatPhone(data.ddd_telefone_1.replace(/\D/g, "")) : prev.whatsapp }));
      toast({ title: "Dados encontrados!", description: data.razao_social || "" });
    });
  }, [rawCnpj]);

  useEffect(() => {
    if (rawCep.length !== 8) return;
    lookupCep(rawCep).then((data) => {
      if (!data) return;
      setLead((prev) => ({ ...prev, endereco: data.street || prev.endereco, bairro: data.neighborhood || prev.bairro, cidade: data.city || prev.cidade, uf: data.state || prev.uf }));
    });
  }, [rawCep]);

  const handleLeadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lead.responsavel.trim() || !lead.whatsapp.trim()) { toast({ title: "Preencha nome e WhatsApp", variant: "destructive" }); return; }
    setLeadLoading(true);
    try {
      const { data: existing } = await supabase.from("leads").select("id").eq("whatsapp", lead.whatsapp.trim()).maybeSingle();
      if (!existing) {
        await supabase.from("leads").insert({ name: lead.responsavel.trim(), email: lead.email.trim() || `${lead.whatsapp.replace(/\D/g, "")}@pendente.com`, phone: lead.whatsapp.trim(), whatsapp: lead.whatsapp.trim(), company: lead.empresa.trim() || null, service_interest: `Locação - ${planName} x${qty} = R$${total}/mês`, source_page: "/locacao-de-computadores-para-empresas-jacarei", lead_status: "lead_capturado" });
      }
      await supabase.from("proposals").insert({ plan: selectedPlan, computers_qty: qty, unit_price: planData.price, total_value: total, contract_months: 36, status: "proposta_gerada" });
      setLeadSent(true);
      toast({ title: "Proposta gerada com sucesso!" });
    } catch { toast({ title: "Erro ao enviar", variant: "destructive" }); } finally { setLeadLoading(false); }
  };

  const handleAdvanceToContract = () => {
    const params = new URLSearchParams({ plano: selectedPlan, qty: String(qty), preco: String(planData.price), empresa: lead.empresa, nomeFantasia: lead.nomeFantasia, responsavel: lead.responsavel, email: lead.email, whatsapp: lead.whatsapp, cnpj: lead.cnpj, cidade: lead.cidade, uf: lead.uf, cep: lead.cep, endereco: lead.endereco, numero: lead.numero, complemento: lead.complemento, bairro: lead.bairro });
    navigate(`/contratar/locacao-de-computadores-para-empresas-jacarei?${params.toString()}`);
  };

  const scrollToCalc = () => { document.getElementById("calculadora")?.scrollIntoView({ behavior: "smooth" }); };

  return (
    <div className="min-h-screen">
      <SeoHead title={t(`${k}.metaTitle`)} description={t(`${k}.metaDesc`)} canonical="/locacao-de-computadores-para-empresas-jacarei" />
      <Navbar />

      {/* HERO */}
      <section className="section-dark pt-24 md:pt-32 pb-16 md:pb-24 border-b-4 border-primary relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none"><div className="absolute top-1/4 right-0 w-96 h-96 bg-primary/5 rounded-full blur-[120px]" /></div>
        <div className="container relative z-10">
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
            <p className="font-mono text-xs tracking-[0.3em] uppercase text-primary mb-6">{t(`${k}.heroTag`)}</p>
            <h1 className="text-3xl md:text-5xl lg:text-6xl max-w-4xl mb-6 leading-tight">
              {t(`${k}.heroTitle1`)}<span className="text-primary">{t(`${k}.heroHighlight`)}</span>
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mb-8 leading-relaxed">{t(`${k}.heroDescription`)}</p>
            <div className="flex flex-wrap gap-4">
              <Button size="lg" onClick={scrollToCalc} className="h-14 px-8 text-base"><Calculator size={18} className="mr-2" /> {t(`${k}.ctaCalc`)}</Button>
              <button onClick={() => openWhatsApp({ pageTitle: "Locação de Computadores", intent: "specialist" })}>
                <Button size="lg" variant="outline" className="h-14 px-8 text-base">{t(`${k}.ctaSpecialist`)}</Button>
              </button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* PAIN POINTS */}
      <section className="section-light py-16 md:py-20">
        <div className="container">
          <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }}>
            <p className="font-mono text-xs tracking-[0.3em] uppercase text-primary mb-4">{t(`${k}.painTag`)}</p>
            <h2 className="text-2xl md:text-4xl mb-10 max-w-2xl">{t(`${k}.painTitle1`)}<span className="text-primary">{t(`${k}.painHighlight`)}</span></h2>
          </motion.div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {painPoints.map((text, i) => { const Icon = painIcons[i]; return (
              <motion.div key={i} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.08 }} className="flex items-start gap-4 p-5 bg-card border border-border rounded-lg">
                <div className="w-10 h-10 border border-destructive/30 rounded-lg flex items-center justify-center shrink-0"><Icon size={18} className="text-destructive" /></div>
                <p className="text-sm text-foreground leading-relaxed">{text}</p>
              </motion.div>
            ); })}
          </div>
        </div>
      </section>

      {/* SOLUTION */}
      <section className="section-dark py-16 md:py-20">
        <div className="container">
          <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }}>
            <p className="font-mono text-xs tracking-[0.3em] uppercase text-primary mb-4">{t(`${k}.solutionTag`)}</p>
            <h2 className="text-2xl md:text-4xl mb-4 max-w-3xl">{t(`${k}.solutionTitle1`)}<span className="text-primary">{t(`${k}.solutionHighlight`)}</span></h2>
            <p className="text-muted-foreground max-w-2xl mb-10">{t(`${k}.solutionDescription`)}</p>
          </motion.div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-px bg-border">
            {benefits.map((b, i) => { const Icon = benefitIcons[i]; return (
              <motion.div key={i} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.08 }} className="bg-background p-6 group hover:bg-muted/50 transition-colors">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 border border-border flex items-center justify-center group-hover:border-primary transition-colors"><Icon size={18} className="text-primary" /></div>
                  <h3 className="font-mono text-sm font-bold">{b.title}</h3>
                </div>
                <p className="text-sm text-muted-foreground">{b.desc}</p>
              </motion.div>
            ); })}
          </div>
        </div>
      </section>

      {/* COMPARISON */}
      <section className="section-light py-16 md:py-20">
        <div className="container">
          <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }}>
            <p className="font-mono text-xs tracking-[0.3em] uppercase text-primary mb-4">{t(`${k}.compTag`)}</p>
            <h2 className="text-2xl md:text-3xl mb-8">{t(`${k}.compTitle1`)}<span className="text-primary">{t(`${k}.compHighlight`)}</span></h2>
          </motion.div>
          <div className="border border-border overflow-x-auto rounded-lg">
            <table className="w-full min-w-[420px]">
              <thead><tr className="bg-muted">
                <th className="text-left font-mono text-xs uppercase tracking-wider p-4 text-muted-foreground" />
                <th className="text-left font-mono text-xs uppercase tracking-wider p-4 text-muted-foreground">{compHeaders[1]}</th>
                <th className="text-left font-mono text-xs uppercase tracking-wider p-4 text-primary">{compHeaders[2]}</th>
              </tr></thead>
              <tbody>{comparisons.map((r) => (
                <tr key={r.item} className="border-t border-border">
                  <td className="p-4 text-sm font-medium">{r.item}</td>
                  <td className="p-4 text-sm text-muted-foreground">{r.compra}</td>
                  <td className="p-4 text-sm text-primary font-medium flex items-center gap-2"><CheckCircle2 size={14} className="text-primary shrink-0" /> {r.locacao}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </div>
      </section>

      {/* AUTHORITY */}
      <section className="section-dark py-16 md:py-20">
        <div className="container">
          <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} className="text-center">
            <p className="font-mono text-xs tracking-[0.3em] uppercase text-primary mb-4">{t(`${k}.authTag`)}</p>
            <h2 className="text-2xl md:text-3xl mb-10">{t(`${k}.authTitle1`)}<span className="text-primary">{t(`${k}.authHighlight`)}</span>{t(`${k}.authTitle2`)}</h2>
            <div className="flex flex-wrap justify-center gap-6 md:gap-12">
              {authItems.map((text, i) => { const Icon = authIcons[i]; return (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center"><Icon size={18} className="text-primary" /></div>
                  <span className="text-sm font-medium text-foreground">{text}</span>
                </div>
              ); })}
            </div>
          </motion.div>
        </div>
      </section>

      {/* PLANS */}
      <section className="section-light py-16 md:py-20">
        <div className="container">
          <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }}>
            <p className="font-mono text-xs tracking-[0.3em] uppercase text-primary mb-4">{t(`${k}.plansTag`)}</p>
            <h2 className="text-2xl md:text-3xl mb-2">{t(`${k}.plansTitle1`)}<span className="text-primary">{t(`${k}.plansHighlight`)}</span></h2>
            <p className="text-sm text-muted-foreground mb-10">{t(`${k}.plansSubtitle`)}</p>
          </motion.div>
          <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            {PLANS_DATA.map((p, i) => (
              <motion.div key={p.id} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} onClick={() => { setSelectedPlan(p.id); scrollToCalc(); }}
                className={`relative p-6 border-2 rounded-xl cursor-pointer transition-all hover:border-primary/50 ${p.popular ? "border-primary bg-primary/5" : "border-border bg-card"}`}>
                {p.popular && <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 bg-primary text-primary-foreground text-[10px] font-bold uppercase tracking-wider rounded-full">{t(`${k}.planPopular`)}</span>}
                <h3 className="font-heading text-lg font-bold mb-1">{plans[i]?.name}</h3>
                <p className="text-xs text-muted-foreground mb-4">{plans[i]?.cpu}</p>
                <p className="text-3xl font-bold text-primary">R$ {p.price}<span className="text-base font-normal text-muted-foreground">/mês</span></p>
                <p className="text-[10px] text-muted-foreground mt-1">{t(`${k}.planPerStation`)}</p>
                <ul className="mt-4 space-y-1.5 text-xs text-muted-foreground">
                  {planIncludes.map((inc) => <li key={inc} className="flex items-center gap-1.5"><CheckCircle2 size={12} className="text-primary" /> {inc}</li>)}
                </ul>
                <Button size="sm" className="w-full mt-5" variant={p.popular ? "default" : "outline"}>{t(`${k}.planSelect`)}</Button>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* NOTEBOOKS */}
      <section className="section-dark py-16 md:py-20 border-t border-border">
        <div className="container max-w-4xl">
          <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} className="text-center mb-10">
            <p className="font-mono text-xs tracking-[0.3em] uppercase text-primary mb-4">{t(`${k}.nbTag`)}</p>
            <h2 className="text-2xl md:text-3xl mb-3">{t(`${k}.nbTitle1`)}<span className="text-primary">{t(`${k}.nbHighlight`)}</span>{t(`${k}.nbTitle2`)}</h2>
            <p className="text-muted-foreground max-w-xl mx-auto text-sm leading-relaxed">{t(`${k}.nbDescription`)}</p>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="bg-card border-2 border-primary/20 rounded-2xl p-8 md:p-10">
            <div className="flex flex-col md:flex-row items-center gap-8">
              <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0"><Laptop size={36} className="text-primary" /></div>
              <div className="flex-1 text-center md:text-left">
                <h3 className="font-heading text-xl font-bold mb-2">{t(`${k}.nbCardTitle`)}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed mb-1">{t(`${k}.nbCardDesc`)}</p>
                <div className="flex flex-wrap gap-3 mt-4 justify-center md:justify-start">
                  {nbTags.map((tag) => <span key={tag} className="inline-flex items-center gap-1 px-3 py-1 bg-primary/5 border border-primary/20 rounded-full text-xs text-primary font-medium"><CheckCircle2 size={10} /> {tag}</span>)}
                </div>
              </div>
            </div>
            <div className="mt-8 pt-6 border-t border-border">
              <div className="bg-secondary/50 rounded-xl p-5 text-center mb-6">
                <p className="text-xs font-mono uppercase tracking-wide text-muted-foreground mb-1">{t(`${k}.nbValueLabel`)}</p>
                <p className="text-2xl font-bold text-foreground">{t(`${k}.nbValue`)}</p>
                <p className="text-xs text-muted-foreground mt-1">{t(`${k}.nbValueDesc`)}</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6 text-center">
                {nbFeatures.map((item) => (
                  <div key={item.label} className="p-3 bg-background rounded-lg border border-border">
                    <p className="text-xs font-bold text-foreground">{item.label}</p>
                    <p className="text-[10px] text-muted-foreground">{item.desc}</p>
                  </div>
                ))}
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                <button onClick={() => openWhatsApp({ pageTitle: "Locação de Notebooks Corporativos", intent: "proposal" })} className="flex-1">
                  <Button size="lg" className="w-full h-14 text-base bg-primary hover:bg-primary/90"><MessageCircle size={18} className="mr-2" />{t(`${k}.nbCta`)}</Button>
                </button>
                <a href="mailto:contato@wmti.com.br?subject=Proposta%20de%20Loca%C3%A7%C3%A3o%20de%20Notebooks&body=Ol%C3%A1!%20Gostaria%20de%20receber%20uma%20proposta%20de%20loca%C3%A7%C3%A3o%20de%20notebooks%20corporativos." className="flex-1">
                  <Button size="lg" variant="outline" className="w-full h-14 text-base">{t(`${k}.nbEmail`)}</Button>
                </a>
              </div>
            </div>
          </motion.div>
          <p className="text-xs text-muted-foreground text-center mt-6" dangerouslySetInnerHTML={{ __html: t(`${k}.nbTip`) }} />
        </div>
      </section>

      {/* CALCULATOR */}
      <section id="calculadora" className="section-dark py-16 md:py-20">
        <div className="container max-w-2xl">
          <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} className="text-center mb-10">
            <p className="font-mono text-xs tracking-[0.3em] uppercase text-primary mb-4">{t(`${k}.calcTag`)}</p>
            <h2 className="text-2xl md:text-3xl mb-2">{t(`${k}.calcTitle1`)}<span className="text-primary">{t(`${k}.calcHighlight`)}</span></h2>
            <p className="text-muted-foreground text-sm">{t(`${k}.calcSubtitle`)}</p>
          </motion.div>
          <div className="bg-card border border-border rounded-xl p-6 md:p-8 space-y-6">
            <div>
              <label className="text-xs text-muted-foreground font-mono uppercase mb-2 block">{t(`${k}.calcPlanLabel`)}</label>
              <div className="grid grid-cols-3 gap-2">
                {PLANS_DATA.map((p, i) => (
                  <button key={p.id} onClick={() => setSelectedPlan(p.id)} className={`p-3 rounded-lg border-2 text-center transition-all ${selectedPlan === p.id ? "border-primary bg-primary/5" : "border-border hover:border-primary/30"}`}>
                    <p className="text-xs font-bold">{plans[i]?.name}</p>
                    <p className="text-primary font-bold">R$ {p.price}</p>
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground font-mono uppercase mb-2 block">{t(`${k}.calcQtyLabel`)}</label>
              <div className="flex items-center justify-center gap-6">
                <button onClick={() => setQty(Math.max(1, qty - 1))} className="w-12 h-12 border border-border rounded-lg flex items-center justify-center hover:border-primary transition-colors"><Minus size={18} /></button>
                <span className="text-4xl font-bold text-primary">{qty}</span>
                <button onClick={() => setQty(qty + 1)} className="w-12 h-12 border border-border rounded-lg flex items-center justify-center hover:border-primary transition-colors"><Plus size={18} /></button>
              </div>
            </div>
            <div className="bg-secondary rounded-xl p-6 text-center">
              <p className="text-xs text-muted-foreground font-mono uppercase mb-2">{t(`${k}.calcResultLabel`)}</p>
              <p className="text-4xl md:text-5xl font-bold text-primary">R$ {total.toLocaleString("pt-BR")}<span className="text-lg font-normal text-muted-foreground">{t(`${k}.calcResultUnit`)}</span></p>
              <p className="text-xs text-muted-foreground mt-2">{t(`${k}.calcResultDesc`, { qty, plan: planName, price: planData.price })}</p>
            </div>

            {!showLead && !leadSent && (
              <Button onClick={() => setShowLead(true)} className="w-full h-14 text-base">{t(`${k}.calcCta`)} <ArrowRight size={18} className="ml-2" /></Button>
            )}

            {showLead && !leadSent && (
              <form onSubmit={handleLeadSubmit} className="space-y-4 border-t border-border pt-6">
                <p className="text-sm font-heading font-bold text-center mb-4">{t(`${k}.formTitle`)}</p>
                <div>
                  <Label className="text-xs text-muted-foreground mb-1 block">{t(`${k}.formCnpj`)}</Label>
                  <div className="relative">
                    <Input value={lead.cnpj} onChange={(e) => setLead({ ...lead, cnpj: formatCnpjCpf(e.target.value) })} placeholder="00.000.000/0001-00" className="bg-background pr-10" maxLength={18} />
                    {cnpjLoading && <Loader2 className="w-4 h-4 animate-spin absolute right-3 top-3 text-primary" />}
                  </div>
                  {rawCnpj.length === 14 && !cnpjLoading && lead.empresa && <p className="text-xs text-primary mt-1">✓ {lead.empresa}</p>}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div><Label className="text-xs text-muted-foreground mb-1 block">{t(`${k}.formName`)}</Label><Input value={lead.responsavel} onChange={(e) => setLead({ ...lead, responsavel: e.target.value })} placeholder="Seu nome" className="bg-background" required /></div>
                  <div><Label className="text-xs text-muted-foreground mb-1 block">{t(`${k}.formWhatsapp`)}</Label><Input value={lead.whatsapp} onChange={(e) => setLead({ ...lead, whatsapp: formatPhone(e.target.value) })} placeholder="(12) 99999-9999" className="bg-background" maxLength={15} required /></div>
                  <div><Label className="text-xs text-muted-foreground mb-1 block">{t(`${k}.formEmail`)}</Label><Input type="email" value={lead.email} onChange={(e) => setLead({ ...lead, email: e.target.value })} placeholder="email@empresa.com" className="bg-background" /></div>
                  <div><Label className="text-xs text-muted-foreground mb-1 block">{t(`${k}.formCompany`)}</Label><Input value={lead.empresa} onChange={(e) => setLead({ ...lead, empresa: e.target.value })} placeholder="Razão social" className="bg-background" /></div>
                </div>
                <div className="border-t border-border pt-3">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">{t(`${k}.formAddress`)}</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div><Label className="text-xs text-muted-foreground mb-1 block">{t(`${k}.formCep`)}</Label><div className="relative"><Input value={lead.cep} onChange={(e) => setLead({ ...lead, cep: formatCep(e.target.value) })} placeholder="00000-000" className="bg-background pr-10" maxLength={9} />{cepLoading && <Loader2 className="w-4 h-4 animate-spin absolute right-3 top-3 text-primary" />}</div></div>
                    <div><Label className="text-xs text-muted-foreground mb-1 block">{t(`${k}.formCity`)}</Label><Input value={lead.cidade} onChange={(e) => setLead({ ...lead, cidade: e.target.value })} placeholder="Jacareí" className="bg-background" /></div>
                    <div><Label className="text-xs text-muted-foreground mb-1 block">{t(`${k}.formUf`)}</Label><Input value={lead.uf} onChange={(e) => setLead({ ...lead, uf: e.target.value.toUpperCase().slice(0, 2) })} placeholder="SP" className="bg-background" maxLength={2} /></div>
                    <div><Label className="text-xs text-muted-foreground mb-1 block">{t(`${k}.formStreet`)}</Label><Input value={lead.endereco} onChange={(e) => setLead({ ...lead, endereco: e.target.value })} placeholder="Rua, Avenida..." className="bg-background" /></div>
                    <div><Label className="text-xs text-muted-foreground mb-1 block">{t(`${k}.formNumber`)}</Label><Input value={lead.numero} onChange={(e) => setLead({ ...lead, numero: e.target.value })} placeholder="123" className="bg-background" /></div>
                    <div><Label className="text-xs text-muted-foreground mb-1 block">{t(`${k}.formNeighborhood`)}</Label><Input value={lead.bairro} onChange={(e) => setLead({ ...lead, bairro: e.target.value })} placeholder="Bairro" className="bg-background" /></div>
                  </div>
                </div>
                <Button type="submit" disabled={leadLoading} className="w-full h-14 text-base">
                  {leadLoading ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Send className="w-5 h-5 mr-2" />}{t(`${k}.formSubmit`)}
                </Button>
              </form>
            )}

            {leadSent && (
              <div className="border-t border-border pt-6 space-y-6">
                <div className="bg-secondary rounded-xl p-6 space-y-4">
                  <div className="flex items-center gap-2 text-primary"><CheckCircle2 size={20} /> <span className="font-heading font-bold">{t(`${k}.proposalTitle`)}</span></div>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div><span className="text-muted-foreground">{t(`${k}.proposalPlan`)}</span> <span className="font-bold">{planName}</span></div>
                    <div><span className="text-muted-foreground">{t(`${k}.proposalQty`)}</span> <span className="font-bold">{qty} {t(`${k}.proposalMachines`)}</span></div>
                    <div><span className="text-muted-foreground">{t(`${k}.proposalUnit`)}</span> <span className="font-bold">R$ {planData.price}/mês</span></div>
                    <div><span className="text-muted-foreground">{t(`${k}.proposalTotal`)}</span> <span className="font-bold text-primary">R$ {total}/mês</span></div>
                    <div><span className="text-muted-foreground">{t(`${k}.proposalTerm`)}</span> <span className="font-bold">{t(`${k}.proposalTermValue`)}</span></div>
                    <div><span className="text-muted-foreground">{t(`${k}.proposalStatus`)}</span> <span className="font-bold text-emerald-400">{t(`${k}.proposalStatusValue`)}</span></div>
                  </div>
                  <p className="text-xs text-muted-foreground">{t(`${k}.proposalValidity`)}</p>
                </div>
                <Button onClick={handleAdvanceToContract} className="w-full h-14 text-base">{t(`${k}.proposalAdvance`)} <ArrowRight size={18} className="ml-2" /></Button>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="section-light py-16 md:py-20">
        <div className="container text-center">
          <h2 className="text-2xl md:text-4xl mb-4">{t(`${k}.finalTitle1`)}<span className="text-primary">{t(`${k}.finalHighlight`)}</span>{t(`${k}.finalTitle2`)}</h2>
          <p className="text-muted-foreground max-w-xl mx-auto mb-8">{t(`${k}.finalDescription`)}</p>
          <div className="flex flex-wrap justify-center gap-4">
            <Button size="lg" onClick={scrollToCalc} className="h-14 px-8 text-base"><Calculator size={18} className="mr-2" /> {t(`${k}.finalCalc`)}</Button>
            <button onClick={() => openWhatsApp({ pageTitle: "Locação de Computadores", intent: "proposal" })}>
              <Button size="lg" variant="outline" className="h-14 px-8 text-base">{t(`${k}.finalWhatsapp`)}</Button>
            </button>
          </div>
        </div>
      </section>

      {/* LOCAL SEO */}
      <section className="section-dark py-12">
        <div className="container">
          <p className="text-sm text-muted-foreground leading-relaxed max-w-3xl">{t(`${k}.localSeo`)}</p>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default LocacaoComputadoresPage;
