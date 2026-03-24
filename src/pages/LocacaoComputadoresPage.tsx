import { useState, useMemo, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Monitor, Wrench, DollarSign, RefreshCw, Headphones, ShieldCheck,
  CheckCircle2, ArrowRight, AlertTriangle, TrendingDown, Clock, Ban,
  Zap, Building2, Award, ChevronRight, Calculator, Send, Loader2,
  Minus, Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import WhatsAppButton from "@/components/WhatsAppButton";
import SeoHead from "@/components/SeoHead";

/* ─── Plans ─── */
const PLANS = [
  { id: "essencial", name: "Básico", cpu: "Intel Core i3", price: 249 },
  { id: "equilibrio", name: "Intermediário", cpu: "Intel Core i5", price: 299, popular: true },
  { id: "performance", name: "Avançado", cpu: "Intel Core i7", price: 399 },
] as const;

/* ─── Pain Points ─── */
const painPoints = [
  { icon: AlertTriangle, text: "Computadores lentos travando o dia inteiro" },
  { icon: DollarSign, text: "Manutenção inesperada estourando o orçamento" },
  { icon: Clock, text: "Equipe parada esperando técnico" },
  { icon: Ban, text: "Máquinas antigas que não rodam os sistemas" },
  { icon: TrendingDown, text: "Sem previsibilidade de custos com TI" },
];

/* ─── Benefits ─── */
const benefits = [
  { icon: Monitor, title: "Estação completa", desc: "Dell OptiPlex + monitor + teclado + mouse. Pronto para uso." },
  { icon: Wrench, title: "Manutenção inclusa", desc: "Preventiva e corretiva sem custo extra." },
  { icon: RefreshCw, title: "Troca sem custo", desc: "Queimou? Substituímos sem burocracia." },
  { icon: Headphones, title: "Suporte 24/7", desc: "Atendimento remoto e presencial 24h." },
  { icon: DollarSign, title: "Economia real", desc: "Sem investimento inicial, sem depreciação." },
  { icon: ShieldCheck, title: "Sempre atualizado", desc: "Equipamentos renovados periodicamente." },
];

/* ─── Comparisons ─── */
const comparisons = [
  { item: "Investimento inicial", compra: "R$ 4.000+ por máquina", locacao: "R$ 0" },
  { item: "Manutenção", compra: "Por sua conta", locacao: "100% inclusa" },
  { item: "Troca de peças", compra: "Custo extra", locacao: "Sem custo" },
  { item: "Depreciação", compra: "Perde valor todo mês", locacao: "Não se aplica" },
  { item: "Suporte técnico", compra: "Contratar à parte", locacao: "24/7 incluso" },
  { item: "Atualização", compra: "Comprar novo", locacao: "Troca periódica" },
];

const LocacaoComputadoresPage = () => {
  const navigate = useNavigate();
  const { toast } = useToast();

  /* ── Calculator state ── */
  const [selectedPlan, setSelectedPlan] = useState("equilibrio");
  const [qty, setQty] = useState(5);
  const plan = PLANS.find((p) => p.id === selectedPlan) || PLANS[1];
  const total = plan.price * qty;

  /* ── Lead capture ── */
  const [showLead, setShowLead] = useState(false);
  const [leadSent, setLeadSent] = useState(false);
  const [leadLoading, setLeadLoading] = useState(false);
  const [lead, setLead] = useState({ nome: "", whatsapp: "", email: "", empresa: "", cidade: "", cnpj: "" });

  const handleLeadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lead.nome.trim() || !lead.whatsapp.trim()) {
      toast({ title: "Preencha nome e WhatsApp", variant: "destructive" });
      return;
    }
    setLeadLoading(true);
    try {
      // Check for existing lead by whatsapp
      const { data: existing } = await supabase
        .from("leads")
        .select("id")
        .eq("whatsapp", lead.whatsapp.trim())
        .maybeSingle();

      if (!existing) {
        await supabase.from("leads").insert({
          name: lead.nome.trim(),
          email: lead.email.trim() || `${lead.whatsapp.replace(/\D/g, "")}@pendente.com`,
          phone: lead.whatsapp.trim(),
          whatsapp: lead.whatsapp.trim(),
          company: lead.empresa.trim() || null,
          service_interest: `Locação - ${plan.name} x${qty} = R$${total}/mês`,
          source_page: "/locacao-de-computadores-para-empresas-jacarei",
          lead_status: "lead_capturado",
        });
      }

      // Create proposal
      await supabase.from("proposals").insert({
        plan: selectedPlan,
        computers_qty: qty,
        unit_price: plan.price,
        total_value: total,
        contract_months: 36,
        status: "proposta_gerada",
      });

      setLeadSent(true);
      toast({ title: "Proposta gerada com sucesso!" });
    } catch {
      toast({ title: "Erro ao enviar", variant: "destructive" });
    } finally {
      setLeadLoading(false);
    }
  };

  const scrollToCalc = () => {
    document.getElementById("calculadora")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="min-h-screen">
      <SeoHead
        title="Locação de Computadores para Empresas em Jacareí | A partir de R$ 249/mês | WMTi"
        description="Aluguel de computadores Dell OptiPlex para empresas. A partir de R$ 249/mês com manutenção, troca e suporte 24/7 inclusos. Contrato de 36 meses."
        canonical="/locacao-de-computadores-para-empresas-jacarei"
      />
      <Navbar />

      {/* ══════ HERO ══════ */}
      <section className="section-dark pt-24 md:pt-32 pb-16 md:pb-24 border-b-4 border-primary relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/4 right-0 w-96 h-96 bg-primary/5 rounded-full blur-[120px]" />
        </div>
        <div className="container relative z-10">
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
            <p className="font-mono text-xs tracking-[0.3em] uppercase text-primary mb-6">// Locação de Computadores</p>
            <h1 className="text-3xl md:text-5xl lg:text-6xl max-w-4xl mb-6 leading-tight">
              Pare de perder dinheiro com computadores <span className="text-primary">lentos</span>, manutenção constante e paradas na operação
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mb-8 leading-relaxed">
              Alugue computadores com suporte incluso, custo mensal previsível e implantação profissional para sua empresa.
            </p>
            <div className="flex flex-wrap gap-4">
              <Button size="lg" onClick={scrollToCalc} className="h-14 px-8 text-base">
                <Calculator size={18} className="mr-2" /> Calcular investimento
              </Button>
              <a
                href="https://wa.me/5512981156000?text=Olá! Gostaria de saber mais sobre locação de computadores."
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button size="lg" variant="outline" className="h-14 px-8 text-base">
                  Falar com especialista
                </Button>
              </a>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ══════ PAIN POINTS ══════ */}
      <section className="section-light py-16 md:py-20">
        <div className="container">
          <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }}>
            <p className="font-mono text-xs tracking-[0.3em] uppercase text-primary mb-4">// O Problema</p>
            <h2 className="text-2xl md:text-4xl mb-10 max-w-2xl">
              Sua empresa enfrenta <span className="text-primary">algum desses problemas?</span>
            </h2>
          </motion.div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {painPoints.map((p, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
                className="flex items-start gap-4 p-5 bg-card border border-border rounded-lg"
              >
                <div className="w-10 h-10 border border-destructive/30 rounded-lg flex items-center justify-center shrink-0">
                  <p.icon size={18} className="text-destructive" />
                </div>
                <p className="text-sm text-foreground leading-relaxed">{p.text}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════ SOLUTION ══════ */}
      <section className="section-dark py-16 md:py-20">
        <div className="container">
          <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }}>
            <p className="font-mono text-xs tracking-[0.3em] uppercase text-primary mb-4">// A Solução</p>
            <h2 className="text-2xl md:text-4xl mb-4 max-w-3xl">
              Locação de computadores <span className="text-primary">com tudo incluso</span>
            </h2>
            <p className="text-muted-foreground max-w-2xl mb-10">
              Estação Dell OptiPlex completa com monitor, periféricos, manutenção, troca de peças e suporte 24/7. Zero investimento inicial.
            </p>
          </motion.div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-px bg-border">
            {benefits.map((b, i) => (
              <motion.div
                key={b.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
                className="bg-background p-6 group hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 border border-border flex items-center justify-center group-hover:border-primary transition-colors">
                    <b.icon size={18} className="text-primary" />
                  </div>
                  <h3 className="font-mono text-sm font-bold">{b.title}</h3>
                </div>
                <p className="text-sm text-muted-foreground">{b.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════ COMPARISON ══════ */}
      <section className="section-light py-16 md:py-20">
        <div className="container">
          <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }}>
            <p className="font-mono text-xs tracking-[0.3em] uppercase text-primary mb-4">// Comparativo</p>
            <h2 className="text-2xl md:text-3xl mb-8">Comprar vs. <span className="text-primary">Locar</span></h2>
          </motion.div>
          <div className="border border-border overflow-x-auto rounded-lg">
            <table className="w-full min-w-[420px]">
              <thead>
                <tr className="bg-muted">
                  <th className="text-left font-mono text-xs uppercase tracking-wider p-4 text-muted-foreground" />
                  <th className="text-left font-mono text-xs uppercase tracking-wider p-4 text-muted-foreground">Comprar</th>
                  <th className="text-left font-mono text-xs uppercase tracking-wider p-4 text-primary">Locar com WMTi</th>
                </tr>
              </thead>
              <tbody>
                {comparisons.map((r) => (
                  <tr key={r.item} className="border-t border-border">
                    <td className="p-4 text-sm font-medium">{r.item}</td>
                    <td className="p-4 text-sm text-muted-foreground">{r.compra}</td>
                    <td className="p-4 text-sm text-primary font-medium flex items-center gap-2">
                      <CheckCircle2 size={14} className="text-primary shrink-0" /> {r.locacao}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ══════ AUTHORITY ══════ */}
      <section className="section-dark py-16 md:py-20">
        <div className="container">
          <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} className="text-center">
            <p className="font-mono text-xs tracking-[0.3em] uppercase text-primary mb-4">// Por que a WMTi?</p>
            <h2 className="text-2xl md:text-3xl mb-10">Mais de <span className="text-primary">15 anos</span> de experiência em TI corporativa</h2>
            <div className="flex flex-wrap justify-center gap-6 md:gap-12">
              {[
                { icon: Award, text: "15+ anos no mercado" },
                { icon: Building2, text: "Parceiro Dell Technologies" },
                { icon: ShieldCheck, text: "Parceiro Microsoft" },
                { icon: Zap, text: "Parceiro ESET" },
              ].map((a) => (
                <div key={a.text} className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <a.icon size={18} className="text-primary" />
                  </div>
                  <span className="text-sm font-medium text-foreground">{a.text}</span>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* ══════ PLANS ══════ */}
      <section className="section-light py-16 md:py-20">
        <div className="container">
          <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }}>
            <p className="font-mono text-xs tracking-[0.3em] uppercase text-primary mb-4">// Planos</p>
            <h2 className="text-2xl md:text-3xl mb-10">Escolha o plano ideal para sua <span className="text-primary">empresa</span></h2>
          </motion.div>
          <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            {PLANS.map((p) => (
              <motion.div
                key={p.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                onClick={() => { setSelectedPlan(p.id); scrollToCalc(); }}
                className={`relative p-6 border-2 rounded-xl cursor-pointer transition-all hover:border-primary/50 ${
                  p.popular ? "border-primary bg-primary/5" : "border-border bg-card"
                }`}
              >
                {p.popular && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 bg-primary text-primary-foreground text-[10px] font-bold uppercase tracking-wider rounded-full">
                    Mais Escolhido
                  </span>
                )}
                <h3 className="font-heading text-lg font-bold mb-1">{p.name}</h3>
                <p className="text-xs text-muted-foreground mb-4">{p.cpu}</p>
                <p className="text-3xl font-bold text-primary">
                  R$ {p.price}<span className="text-base font-normal text-muted-foreground">/mês</span>
                </p>
                <p className="text-[10px] text-muted-foreground mt-1">por estação completa</p>
                <ul className="mt-4 space-y-1.5 text-xs text-muted-foreground">
                  <li className="flex items-center gap-1.5"><CheckCircle2 size={12} className="text-primary" /> Monitor + periféricos</li>
                  <li className="flex items-center gap-1.5"><CheckCircle2 size={12} className="text-primary" /> Manutenção inclusa</li>
                  <li className="flex items-center gap-1.5"><CheckCircle2 size={12} className="text-primary" /> Suporte 24/7</li>
                  <li className="flex items-center gap-1.5"><CheckCircle2 size={12} className="text-primary" /> Troca sem custo</li>
                </ul>
                <Button size="sm" className="w-full mt-5" variant={p.popular ? "default" : "outline"}>
                  Selecionar
                </Button>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════ CALCULATOR ══════ */}
      <section id="calculadora" className="section-dark py-16 md:py-20">
        <div className="container max-w-2xl">
          <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} className="text-center mb-10">
            <p className="font-mono text-xs tracking-[0.3em] uppercase text-primary mb-4">// Calculadora</p>
            <h2 className="text-2xl md:text-3xl mb-2">Calcule seu <span className="text-primary">investimento</span></h2>
            <p className="text-muted-foreground text-sm">Simule o valor mensal da locação para sua empresa</p>
          </motion.div>

          <div className="bg-card border border-border rounded-xl p-6 md:p-8 space-y-6">
            {/* Plan selector */}
            <div>
              <label className="text-xs text-muted-foreground font-mono uppercase mb-2 block">Plano</label>
              <div className="grid grid-cols-3 gap-2">
                {PLANS.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setSelectedPlan(p.id)}
                    className={`p-3 rounded-lg border-2 text-center transition-all ${
                      selectedPlan === p.id ? "border-primary bg-primary/5" : "border-border hover:border-primary/30"
                    }`}
                  >
                    <p className="text-xs font-bold">{p.name}</p>
                    <p className="text-primary font-bold">R$ {p.price}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Quantity */}
            <div>
              <label className="text-xs text-muted-foreground font-mono uppercase mb-2 block">Quantidade de computadores</label>
              <div className="flex items-center justify-center gap-6">
                <button onClick={() => setQty(Math.max(1, qty - 1))} className="w-12 h-12 border border-border rounded-lg flex items-center justify-center hover:border-primary transition-colors">
                  <Minus size={18} />
                </button>
                <span className="text-4xl font-bold text-primary">{qty}</span>
                <button onClick={() => setQty(qty + 1)} className="w-12 h-12 border border-border rounded-lg flex items-center justify-center hover:border-primary transition-colors">
                  <Plus size={18} />
                </button>
              </div>
            </div>

            {/* Result */}
            <div className="bg-secondary rounded-xl p-6 text-center">
              <p className="text-xs text-muted-foreground font-mono uppercase mb-2">Investimento mensal</p>
              <p className="text-4xl md:text-5xl font-bold text-primary">
                R$ {total.toLocaleString("pt-BR")}<span className="text-lg font-normal text-muted-foreground">/mês</span>
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                {qty} estação(ões) {plan.name} × R$ {plan.price}/mês • Contrato de 36 meses
              </p>
            </div>

            {/* Lead gate */}
            {!showLead && !leadSent && (
              <Button onClick={() => setShowLead(true)} className="w-full h-14 text-base">
                Ver proposta detalhada <ArrowRight size={18} className="ml-2" />
              </Button>
            )}

            {showLead && !leadSent && (
              <form onSubmit={handleLeadSubmit} className="space-y-3 border-t border-border pt-6">
                <p className="text-sm font-heading font-bold text-center mb-4">Preencha para receber sua proposta</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Nome *</label>
                    <Input value={lead.nome} onChange={(e) => setLead({ ...lead, nome: e.target.value })} placeholder="Seu nome" className="bg-background" required />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">WhatsApp *</label>
                    <Input value={lead.whatsapp} onChange={(e) => setLead({ ...lead, whatsapp: e.target.value })} placeholder="(12) 99999-9999" className="bg-background" required />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">E-mail</label>
                    <Input type="email" value={lead.email} onChange={(e) => setLead({ ...lead, email: e.target.value })} placeholder="email@empresa.com" className="bg-background" />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Empresa</label>
                    <Input value={lead.empresa} onChange={(e) => setLead({ ...lead, empresa: e.target.value })} placeholder="Nome da empresa" className="bg-background" />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Cidade</label>
                    <Input value={lead.cidade} onChange={(e) => setLead({ ...lead, cidade: e.target.value })} placeholder="Jacareí" className="bg-background" />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">CNPJ</label>
                    <Input value={lead.cnpj} onChange={(e) => setLead({ ...lead, cnpj: e.target.value })} placeholder="Opcional" className="bg-background" />
                  </div>
                </div>
                <Button type="submit" disabled={leadLoading} className="w-full h-14 text-base">
                  {leadLoading ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Send className="w-5 h-5 mr-2" />}
                  Gerar proposta
                </Button>
              </form>
            )}

            {leadSent && (
              <div className="border-t border-border pt-6 space-y-6">
                {/* Proposal */}
                <div className="bg-secondary rounded-xl p-6 space-y-4">
                  <div className="flex items-center gap-2 text-primary">
                    <CheckCircle2 size={20} /> <span className="font-heading font-bold">Proposta Gerada</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div><span className="text-muted-foreground">Plano:</span> <span className="font-bold">{plan.name}</span></div>
                    <div><span className="text-muted-foreground">Qtd:</span> <span className="font-bold">{qty} máquinas</span></div>
                    <div><span className="text-muted-foreground">Unitário:</span> <span className="font-bold">R$ {plan.price}/mês</span></div>
                    <div><span className="text-muted-foreground">Total:</span> <span className="font-bold text-primary">R$ {total}/mês</span></div>
                    <div><span className="text-muted-foreground">Prazo:</span> <span className="font-bold">36 meses</span></div>
                    <div><span className="text-muted-foreground">Status:</span> <span className="font-bold text-emerald-400">Ativa</span></div>
                  </div>
                  <p className="text-xs text-muted-foreground">Validade: 15 dias a partir de hoje</p>
                </div>

                <Button onClick={() => navigate("/orcamento-ti?servico=locacao-de-computadores")} className="w-full h-14 text-base">
                  Avançar para contrato <ArrowRight size={18} className="ml-2" />
                </Button>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ══════ FINAL CTA ══════ */}
      <section className="section-light py-16 md:py-20">
        <div className="container text-center">
          <h2 className="text-2xl md:text-4xl mb-4">
            A partir de <span className="text-primary">R$ 249/mês</span> por estação completa
          </h2>
          <p className="text-muted-foreground max-w-xl mx-auto mb-8">
            Sem investimento inicial, sem dor de cabeça com manutenção, sem surpresas. Foque no que importa: o seu negócio.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Button size="lg" onClick={scrollToCalc} className="h-14 px-8 text-base">
              <Calculator size={18} className="mr-2" /> Calcular agora
            </Button>
            <a href="https://wa.me/5512981156000?text=Olá! Quero saber mais sobre a locação de computadores." target="_blank" rel="noopener noreferrer">
              <Button size="lg" variant="outline" className="h-14 px-8 text-base">
                Falar pelo WhatsApp
              </Button>
            </a>
          </div>
        </div>
      </section>

      {/* ══════ LOCAL SEO ══════ */}
      <section className="section-dark py-12">
        <div className="container">
          <p className="text-sm text-muted-foreground leading-relaxed max-w-3xl">
            Atendemos empresas em Jacareí, São José dos Campos, Taubaté e todo o Vale do Paraíba com entrega, instalação e retirada presencial. 
            Os computadores são entregues configurados, com sistema operacional e prontos para uso. 
            Ideal para escritórios, clínicas, lojas, indústrias e cartórios.
          </p>
        </div>
      </section>

      <Footer />
      <WhatsAppButton />
    </div>
  );
};

export default LocacaoComputadoresPage;
