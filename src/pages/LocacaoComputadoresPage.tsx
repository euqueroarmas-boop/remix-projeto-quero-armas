import { useState, useMemo } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Monitor, Wrench, DollarSign, RefreshCw, Headphones, ShieldCheck,
  CheckCircle2, ArrowRight, AlertTriangle, TrendingDown, Clock, Users,
  Award, Minus, Plus, Star, Check, Loader2, Send, ChevronRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import WhatsAppButton from "@/components/WhatsAppButton";
import SeoHead from "@/components/SeoHead";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { logSistema } from "@/lib/logSistema";

/* ─── Plans ─── */
const plans = [
  {
    id: "essencial", name: "Básico", cpu: "Intel Core i3", ram: "8GB RAM", ssd: "240GB SSD",
    extras: ["Placa de rede Gigabit", 'Monitor Dell 18.5"', "Teclado e mouse"], price: 249, popular: false,
  },
  {
    id: "equilibrio", name: "Intermediário", cpu: "Intel Core i5", ram: "16GB RAM", ssd: "240GB SSD",
    extras: ["Placa de rede Gigabit", 'Monitor Dell 18.5"', "Teclado e mouse"], price: 299, popular: true,
  },
  {
    id: "performance", name: "Avançado", cpu: "Intel Core i7", ram: "16GB RAM", ssd: "240GB SSD",
    extras: ["Placa de rede Gigabit", 'Monitor Dell 18.5"', "Teclado e mouse"], price: 399, popular: false,
  },
];

const painPoints = [
  { icon: AlertTriangle, text: "Computadores lentos travando a operação" },
  { icon: TrendingDown, text: "Manutenções inesperadas estourando o orçamento" },
  { icon: Clock, text: "Equipe parada esperando conserto" },
  { icon: Monitor, text: "Máquinas antigas que não rodam seus softwares" },
  { icon: DollarSign, text: "Sem previsibilidade financeira com TI" },
];

const benefits = [
  { icon: Monitor, title: "Estação completa", text: "Dell OptiPlex + monitor + teclado + mouse — tudo incluso, pronto para uso." },
  { icon: Wrench, title: "Manutenção inclusa", text: "Preventiva e corretiva sem custo extra. Sem surpresas na fatura." },
  { icon: RefreshCw, title: "Troca sem custo", text: "Queimou qualquer componente? Substituímos sem burocracia." },
  { icon: Headphones, title: "Suporte 24/7", text: "Equipe técnica disponível 24h para atendimento remoto e presencial." },
  { icon: DollarSign, title: "Economia real", text: "Sem investimento inicial, sem depreciação, sem técnicos avulsos." },
  { icon: ShieldCheck, title: "Sempre atualizado", text: "Equipamentos renovados periodicamente para máxima produtividade." },
];

const comparisons = [
  { item: "Investimento inicial", compra: "R$ 4.000+", locacao: "R$ 0" },
  { item: "Manutenção", compra: "Por sua conta", locacao: "Inclusa" },
  { item: "Troca de peças", compra: "Custo extra", locacao: "Sem custo" },
  { item: "Depreciação", compra: "Perde valor todo ano", locacao: "Não se aplica" },
  { item: "Suporte técnico", compra: "Contratar à parte", locacao: "24/7 incluso" },
  { item: "Atualização", compra: "Comprar novo", locacao: "Troca periódica" },
];

type FlowStep = "landing" | "calculator" | "lead" | "proposal";

const LocacaoComputadoresPage = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [step, setStep] = useState<FlowStep>("landing");
  const [selectedPlan, setSelectedPlan] = useState("equilibrio");
  const [qty, setQty] = useState(1);

  // Lead form
  const [leadForm, setLeadForm] = useState({
    nome: "", whatsapp: "", email: "", empresa: "", cidade: "", cnpj: "",
  });
  const [leadLoading, setLeadLoading] = useState(false);
  const [leadId, setLeadId] = useState<string | null>(null);

  const plan = plans.find(p => p.id === selectedPlan) || plans[1];
  const totalValue = plan.price * qty;

  const scrollTo = (id: string) => {
    setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
  };

  const handleStartCalculator = () => {
    setStep("calculator");
    scrollTo("calculator");
  };

  const handleShowLeadForm = () => {
    setStep("lead");
    scrollTo("lead-form");
  };

  const handleSubmitLead = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!leadForm.nome.trim() || !leadForm.whatsapp.trim()) {
      toast({ title: "Preencha nome e WhatsApp", variant: "destructive" });
      return;
    }

    setLeadLoading(true);
    try {
      // Check for existing lead by whatsapp or email
      let existingLeadId: string | null = null;
      if (leadForm.email) {
        const { data } = await supabase.from("leads").select("id").eq("email", leadForm.email).maybeSingle();
        if (data) existingLeadId = (data as any).id;
      }

      let finalLeadId = existingLeadId;
      if (!finalLeadId) {
        const insertPayload: Record<string, unknown> = {
          name: leadForm.nome,
          email: leadForm.email || `lead_${Date.now()}@pendente.com`,
          phone: leadForm.whatsapp,
          company: leadForm.empresa || null,
          service_interest: "locacao-computadores",
          source_page: "/locacao-de-computadores-para-empresas-jacarei",
          utm_source: searchParams.get("utm_source") || null,
          utm_medium: searchParams.get("utm_medium") || null,
          utm_campaign: searchParams.get("utm_campaign") || null,
        };
        const { data: newLead, error } = await supabase.from("leads").insert(insertPayload as any).select().single();
        if (error) throw error;
        finalLeadId = (newLead as any).id;
      }
      setLeadId(finalLeadId);

      // Create proposal
      const proposalPayload: Record<string, unknown> = {
        lead_id: finalLeadId,
        plan: selectedPlan,
        computers_qty: qty,
        unit_price: plan.price,
        total_value: totalValue,
        contract_months: 36,
        status: "proposta_gerada",
      };
      const { error: propErr } = await supabase.from("proposals" as any).insert(proposalPayload).select().single();
      if (propErr) throw propErr;

      await logSistema({
        tipo: "checkout",
        status: "success",
        mensagem: "Lead capturado e proposta gerada",
        payload: { lead_name: leadForm.nome, plan: selectedPlan, qty, total: totalValue },
      });

      setStep("proposal");
      scrollTo("proposal");
      toast({ title: "Proposta gerada com sucesso!" });
    } catch (err) {
      console.error("[WMTi] Lead error:", err);
      toast({ title: "Erro ao enviar", description: "Tente novamente.", variant: "destructive" });
    } finally {
      setLeadLoading(false);
    }
  };

  const handleGoToContract = () => {
    // Navigate to orcamento-ti with locacao path pre-selected
    navigate(`/orcamento-ti?caminho=locacao&plano=${selectedPlan}&qtd=${qty}`);
  };

  return (
    <div className="min-h-screen">
      <SeoHead
        title="Locação de Computadores para Empresas em Jacareí | A partir de R$ 249/mês | WMTi"
        description="Aluguel de computadores Dell OptiPlex para empresas. A partir de R$ 249/mês com manutenção, troca e suporte 24/7 inclusos. Sem investimento inicial."
        canonical="/locacao-de-computadores-para-empresas-jacarei"
      />
      <Navbar />

      {/* ─── HERO ─── */}
      <section className="relative min-h-[85vh] flex items-center section-dark overflow-hidden pt-16">
        <div className="absolute inset-0 bg-gradient-to-br from-background via-secondary to-background opacity-90" />
        <div className="absolute top-20 right-10 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />

        <div className="container mx-auto px-4 py-16 relative z-10">
          <div className="max-w-4xl mx-auto">
            <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
              <span className="inline-block px-4 py-1.5 mb-6 text-xs font-semibold tracking-widest uppercase bg-primary/10 text-primary rounded-full border border-primary/20">
                Locação de Computadores para Empresas
              </span>

              <h1 className="text-3xl md:text-5xl lg:text-6xl font-heading font-bold mb-6 leading-tight">
                Pare de perder dinheiro com computadores lentos, manutenção constante e{" "}
                <span className="text-primary">paradas na operação</span>
              </h1>

              <p className="text-lg md:text-xl text-muted-foreground mb-8 max-w-3xl leading-relaxed">
                Alugue computadores Dell OptiPlex com suporte incluso, custo mensal previsível e implantação profissional para sua empresa.
                A partir de <span className="text-primary font-semibold">R$ 249/mês</span> por estação completa.
              </p>

              <div className="flex flex-col sm:flex-row gap-4">
                <Button size="lg" className="text-base px-8 py-6 bg-primary hover:bg-primary/90 text-primary-foreground" onClick={handleStartCalculator}>
                  Calcular meu investimento
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
                <Button size="lg" variant="outline" className="text-base px-8 py-6 border-primary/30 hover:bg-primary/10"
                  onClick={() => window.open("https://wa.me/5512981156000?text=Olá! Gostaria de saber mais sobre a locação de computadores.", "_blank")}>
                  Falar com especialista
                </Button>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ─── PAIN POINTS ─── */}
      <section className="py-16 section-dark border-t border-border">
        <div className="container mx-auto px-4">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-10">
            <h2 className="text-2xl md:text-4xl font-heading font-bold mb-3">
              Sua empresa sofre com <span className="text-primary">esses problemas?</span>
            </h2>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-4xl mx-auto">
            {painPoints.map((p, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.08 }}
                className="flex items-center gap-3 p-4 rounded-xl bg-card border border-border">
                <p.icon className="w-5 h-5 text-destructive flex-shrink-0" />
                <span className="text-sm text-foreground">{p.text}</span>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── SOLUTION ─── */}
      <section className="py-16 section-dark border-t border-border">
        <div className="container mx-auto px-4">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-10">
            <span className="inline-block px-4 py-1.5 mb-4 text-xs font-semibold tracking-widest uppercase bg-primary/10 text-primary rounded-full border border-primary/20">
              A Solução WMTi
            </span>
            <h2 className="text-2xl md:text-4xl font-heading font-bold mb-3">
              Tudo incluso, <span className="text-primary">sem surpresas</span>
            </h2>
          </motion.div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-5xl mx-auto">
            {benefits.map((b, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.06 }}
                className="p-6 rounded-xl bg-card border border-border hover:border-primary/30 transition-colors">
                <b.icon className="w-8 h-8 text-primary mb-3" />
                <h3 className="font-heading font-bold text-foreground mb-1">{b.title}</h3>
                <p className="text-sm text-muted-foreground">{b.text}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── COMPARISON ─── */}
      <section className="py-16 section-dark border-t border-border">
        <div className="container mx-auto px-4">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-10">
            <h2 className="text-2xl md:text-4xl font-heading font-bold mb-3">
              Comprar vs. <span className="text-primary">Locar com WMTi</span>
            </h2>
          </motion.div>

          <div className="max-w-3xl mx-auto border border-border rounded-xl overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-card">
                  <th className="text-left text-xs font-mono uppercase tracking-wider p-4 text-muted-foreground" />
                  <th className="text-left text-xs font-mono uppercase tracking-wider p-4 text-muted-foreground">Comprar</th>
                  <th className="text-left text-xs font-mono uppercase tracking-wider p-4 text-primary">Locar WMTi</th>
                </tr>
              </thead>
              <tbody>
                {comparisons.map((row) => (
                  <tr key={row.item} className="border-t border-border">
                    <td className="p-4 text-sm font-medium text-foreground">{row.item}</td>
                    <td className="p-4 text-sm text-muted-foreground">{row.compra}</td>
                    <td className="p-4 text-sm text-primary font-medium flex items-center gap-2">
                      <CheckCircle2 size={14} className="text-primary flex-shrink-0" /> {row.locacao}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ─── AUTHORITY ─── */}
      <section className="py-16 section-dark border-t border-border">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center">
            <Award className="w-12 h-12 text-primary mx-auto mb-4" />
            <h2 className="text-2xl md:text-3xl font-heading font-bold mb-4">
              Mais de <span className="text-primary">15 anos</span> de experiência
            </h2>
            <p className="text-muted-foreground mb-6">
              A WMTi Tecnologia da Informação é parceira oficial Dell, Microsoft e ESET. 
              Atendemos empresas em Jacareí, São José dos Campos, Taubaté e todo o Vale do Paraíba.
            </p>
            <div className="flex justify-center gap-8 text-sm text-muted-foreground">
              <div className="text-center"><p className="text-2xl font-bold text-primary">500+</p><p>Clientes ativos</p></div>
              <div className="text-center"><p className="text-2xl font-bold text-primary">15+</p><p>Anos de mercado</p></div>
              <div className="text-center"><p className="text-2xl font-bold text-primary">24/7</p><p>Suporte técnico</p></div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── PLANS ─── */}
      <section id="plans" className="py-20 section-dark border-t border-border">
        <div className="container mx-auto px-4">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-12">
            <span className="inline-block px-4 py-1.5 mb-4 text-xs font-semibold tracking-widest uppercase bg-primary/10 text-primary rounded-full border border-primary/20">
              Planos
            </span>
            <h2 className="text-2xl md:text-4xl font-heading font-bold mb-3">
              Escolha o plano ideal para sua <span className="text-primary">empresa</span>
            </h2>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {plans.map((p, i) => {
              const isSelected = selectedPlan === p.id;
              return (
                <motion.div key={p.id} initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}
                  onClick={() => { setSelectedPlan(p.id); setStep("calculator"); }}
                  className={`relative cursor-pointer rounded-2xl border-2 p-6 transition-all duration-300 hover:scale-[1.02] ${
                    isSelected ? "border-primary bg-primary/5 shadow-lg shadow-primary/10" : "border-border bg-card hover:border-primary/30"
                  } ${p.popular ? "md:-mt-4" : ""}`}>
                  {p.popular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 bg-primary text-primary-foreground text-xs font-bold rounded-full flex items-center gap-1">
                      <Star className="w-3 h-3" /> Mais escolhido
                    </div>
                  )}
                  <h3 className="text-xl font-heading font-bold mb-1">{p.name}</h3>
                  <p className="text-sm text-muted-foreground mb-4">{p.cpu}</p>
                  <div className="space-y-2 mb-6">
                    <div className="flex items-center gap-2 text-sm"><Check className="w-4 h-4 text-primary" /> {p.ram}</div>
                    <div className="flex items-center gap-2 text-sm"><Check className="w-4 h-4 text-primary" /> {p.ssd}</div>
                    {p.extras.map((e, j) => (
                      <div key={j} className="flex items-center gap-2 text-sm"><Check className="w-4 h-4 text-primary" /> {e}</div>
                    ))}
                  </div>
                  <div className="border-t border-border pt-4">
                    <span className="text-3xl font-heading font-bold text-primary">R${p.price}</span>
                    <span className="text-sm text-muted-foreground">/computador/mês</span>
                  </div>
                </motion.div>
              );
            })}
          </div>

          <div className="mt-8 text-center">
            <Button size="lg" className="text-base px-8 py-6 bg-primary hover:bg-primary/90 text-primary-foreground" onClick={handleStartCalculator}>
              Calcular investimento <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </div>
        </div>
      </section>

      {/* ─── CALCULATOR ─── */}
      {(step === "calculator" || step === "lead" || step === "proposal") && (
        <section id="calculator" className="py-20 section-dark border-t-4 border-primary">
          <div className="container mx-auto px-4">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-10">
              <span className="inline-block px-4 py-1.5 mb-4 text-xs font-semibold tracking-widest uppercase bg-primary/10 text-primary rounded-full border border-primary/20">
                Calculadora
              </span>
              <h2 className="text-2xl md:text-4xl font-heading font-bold mb-3">
                Calcule seu <span className="text-primary">investimento</span>
              </h2>
            </motion.div>

            <div className="max-w-lg mx-auto">
              {/* Plan selection */}
              <div className="grid grid-cols-3 gap-2 mb-6">
                {plans.map(p => (
                  <button key={p.id} onClick={() => setSelectedPlan(p.id)}
                    className={`p-3 rounded-lg border-2 text-center transition-all ${
                      selectedPlan === p.id ? "border-primary bg-primary/10" : "border-border bg-card hover:border-primary/30"
                    }`}>
                    <p className="text-xs text-muted-foreground">{p.name}</p>
                    <p className="text-lg font-bold text-primary">R${p.price}</p>
                  </button>
                ))}
              </div>

              {/* Quantity */}
              <Card className="mb-6">
                <CardContent className="p-6">
                  <p className="text-sm text-muted-foreground mb-4 text-center">Quantidade de computadores</p>
                  <div className="flex items-center justify-center gap-6">
                    <button onClick={() => setQty(Math.max(1, qty - 1))} className="w-12 h-12 flex items-center justify-center border border-border rounded-lg hover:border-primary transition-colors">
                      <Minus size={20} className="text-muted-foreground" />
                    </button>
                    <div className="text-center">
                      <span className="text-5xl font-bold text-primary">{qty}</span>
                      <p className="text-xs text-muted-foreground">computador{qty > 1 ? "es" : ""}</p>
                    </div>
                    <button onClick={() => setQty(qty + 1)} className="w-12 h-12 flex items-center justify-center border border-border rounded-lg hover:border-primary transition-colors">
                      <Plus size={20} className="text-muted-foreground" />
                    </button>
                  </div>
                </CardContent>
              </Card>

              {/* Total */}
              <Card className="border-primary/30 mb-6">
                <CardContent className="p-6 text-center">
                  <p className="text-sm text-muted-foreground mb-2">Investimento mensal</p>
                  <p className="text-4xl font-heading font-bold text-primary">
                    R$ {totalValue.toLocaleString("pt-BR")}<span className="text-lg text-muted-foreground">/mês</span>
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {qty} × R$ {plan.price}/mês • Plano {plan.name} • 36 meses
                  </p>
                </CardContent>
              </Card>

              <Button className="w-full h-14 text-base bg-primary hover:bg-primary/90 text-primary-foreground" onClick={handleShowLeadForm}>
                Ver proposta detalhada <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </div>
          </div>
        </section>
      )}

      {/* ─── LEAD FORM ─── */}
      {(step === "lead" || step === "proposal") && step !== "proposal" && (
        <section id="lead-form" className="py-20 section-dark border-t border-border">
          <div className="container mx-auto px-4">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-10">
              <h2 className="text-2xl md:text-3xl font-heading font-bold mb-3">
                Preencha para receber sua <span className="text-primary">proposta</span>
              </h2>
              <p className="text-muted-foreground text-sm">Apenas nome e WhatsApp são obrigatórios</p>
            </motion.div>

            <form onSubmit={handleSubmitLead} className="max-w-lg mx-auto space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="mb-1.5 block text-sm">Nome do responsável *</Label>
                  <Input value={leadForm.nome} onChange={e => setLeadForm({ ...leadForm, nome: e.target.value })}
                    className="h-12 bg-card border-border" placeholder="Seu nome" required />
                </div>
                <div>
                  <Label className="mb-1.5 block text-sm">WhatsApp *</Label>
                  <Input value={leadForm.whatsapp} onChange={e => setLeadForm({ ...leadForm, whatsapp: e.target.value })}
                    className="h-12 bg-card border-border" placeholder="(12) 99999-9999" required />
                </div>
                <div>
                  <Label className="mb-1.5 block text-sm">E-mail</Label>
                  <Input type="email" value={leadForm.email} onChange={e => setLeadForm({ ...leadForm, email: e.target.value })}
                    className="h-12 bg-card border-border" placeholder="email@empresa.com" />
                </div>
                <div>
                  <Label className="mb-1.5 block text-sm">Empresa</Label>
                  <Input value={leadForm.empresa} onChange={e => setLeadForm({ ...leadForm, empresa: e.target.value })}
                    className="h-12 bg-card border-border" placeholder="Nome da empresa" />
                </div>
                <div>
                  <Label className="mb-1.5 block text-sm">Cidade</Label>
                  <Input value={leadForm.cidade} onChange={e => setLeadForm({ ...leadForm, cidade: e.target.value })}
                    className="h-12 bg-card border-border" placeholder="Sua cidade" />
                </div>
                <div>
                  <Label className="mb-1.5 block text-sm">CNPJ</Label>
                  <Input value={leadForm.cnpj} onChange={e => setLeadForm({ ...leadForm, cnpj: e.target.value })}
                    className="h-12 bg-card border-border" placeholder="00.000.000/0001-00" />
                </div>
              </div>

              <Button type="submit" disabled={leadLoading} className="w-full h-14 text-base bg-primary hover:bg-primary/90 text-primary-foreground">
                {leadLoading ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Send className="w-5 h-5 mr-2" />}
                Gerar minha proposta
              </Button>
            </form>
          </div>
        </section>
      )}

      {/* ─── PROPOSAL ─── */}
      {step === "proposal" && (
        <section id="proposal" className="py-20 section-dark border-t-4 border-primary">
          <div className="container mx-auto px-4">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-2xl mx-auto">
              <div className="text-center mb-8">
                <CheckCircle2 className="w-16 h-16 text-primary mx-auto mb-4" />
                <h2 className="text-2xl md:text-3xl font-heading font-bold mb-2">
                  Sua <span className="text-primary">proposta</span> está pronta!
                </h2>
                <p className="text-muted-foreground">Válida por 15 dias</p>
              </div>

              <Card className="border-primary/20 mb-6">
                <CardContent className="p-6 space-y-4">
                  <div className="flex justify-between items-center border-b border-border pb-3">
                    <span className="text-muted-foreground text-sm">Empresa</span>
                    <span className="text-foreground font-medium">{leadForm.empresa || leadForm.nome}</span>
                  </div>
                  <div className="flex justify-between items-center border-b border-border pb-3">
                    <span className="text-muted-foreground text-sm">Plano</span>
                    <span className="text-foreground font-medium">{plan.name} ({plan.cpu})</span>
                  </div>
                  <div className="flex justify-between items-center border-b border-border pb-3">
                    <span className="text-muted-foreground text-sm">Quantidade</span>
                    <span className="text-foreground font-medium">{qty} computador{qty > 1 ? "es" : ""}</span>
                  </div>
                  <div className="flex justify-between items-center border-b border-border pb-3">
                    <span className="text-muted-foreground text-sm">Valor unitário</span>
                    <span className="text-foreground font-medium">R$ {plan.price},00/mês</span>
                  </div>
                  <div className="flex justify-between items-center border-b border-border pb-3">
                    <span className="text-muted-foreground text-sm">Prazo contratual</span>
                    <span className="text-foreground font-medium">36 meses</span>
                  </div>
                  <div className="flex justify-between items-center pt-2">
                    <span className="text-foreground font-bold text-lg">Total mensal</span>
                    <span className="text-primary font-bold text-2xl">R$ {totalValue.toLocaleString("pt-BR")},00</span>
                  </div>

                  <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 mt-4">
                    <p className="text-sm text-foreground mb-2 font-medium">Incluso em todos os planos:</p>
                    <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                      <span>✓ Monitor Dell 18.5"</span>
                      <span>✓ Teclado e mouse</span>
                      <span>✓ Manutenção preventiva</span>
                      <span>✓ Manutenção corretiva</span>
                      <span>✓ Troca de peças sem custo</span>
                      <span>✓ Suporte técnico 24/7</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Button className="w-full h-14 text-base bg-primary hover:bg-primary/90 text-primary-foreground" onClick={handleGoToContract}>
                Avançar para contrato <ArrowRight className="w-5 h-5 ml-2" />
              </Button>

              <p className="text-xs text-muted-foreground text-center mt-4">
                Ao clicar, você será direcionado para preencher os dados de cadastro e assinar o contrato eletrônico.
              </p>
            </motion.div>
          </div>
        </section>
      )}

      {/* ─── FINAL CTA ─── */}
      <section className="py-16 section-dark border-t border-border">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-2xl md:text-3xl font-heading font-bold mb-4">
            A partir de <span className="text-primary">R$ 249/mês</span> por estação completa
          </h2>
          <p className="text-muted-foreground mb-8 max-w-xl mx-auto">
            Sem investimento inicial, sem dor de cabeça com manutenção, sem surpresas. Foque no que importa: o seu negócio.
          </p>
          <Button size="lg" className="text-base px-8 py-6 bg-primary hover:bg-primary/90 text-primary-foreground" onClick={handleStartCalculator}>
            Calcular investimento <ArrowRight className="w-5 h-5 ml-2" />
          </Button>
        </div>
      </section>

      {/* ─── LOCAL ─── */}
      <section className="py-12 section-dark border-t border-border">
        <div className="container mx-auto px-4">
          <p className="text-sm text-muted-foreground text-center max-w-3xl mx-auto">
            Atendemos empresas em Jacareí, São José dos Campos, Taubaté e todo o Vale do Paraíba com entrega, instalação e retirada presencial.
            Os computadores são entregues configurados, com sistema operacional e prontos para uso. Ideal para escritórios, clínicas, lojas, indústrias e cartórios.
          </p>
        </div>
      </section>

      <Footer />
      <WhatsAppButton />
    </div>
  );
};

export default LocacaoComputadoresPage;
