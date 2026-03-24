import { useState, useEffect } from "react";
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
import { useBrasilApiLookup } from "@/hooks/useBrasilApiLookup";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import WhatsAppButton from "@/components/WhatsAppButton";
import SeoHead from "@/components/SeoHead";

/* ─── Plans ─── */
const PLANS = [
  { id: "essencial", name: "Básico", cpu: "Intel Core i3", price: 249, popular: false },
  { id: "equilibrio", name: "Intermediário", cpu: "Intel Core i5", price: 299, popular: true },
  { id: "performance", name: "Avançado", cpu: "Intel Core i7", price: 399, popular: false },
] as const;

/* ─── Pain Points ─── */
const painPoints = [
  { icon: AlertTriangle, text: "Computador fica lento, trava, e ninguém consegue trabalhar direito" },
  { icon: DollarSign, text: "Manutenção, troca de peça, e o ciclo de gasto nunca acaba" },
  { icon: Clock, text: "Equipe perdendo tempo e produtividade com equipamento ruim" },
  { icon: Ban, text: "Máquinas ultrapassadas que viram obstáculo, não ferramenta" },
  { icon: TrendingDown, text: "Depreciação constante — o equipamento perde valor todo mês" },
];

/* ─── Benefits ─── */
const benefits = [
  { icon: Monitor, title: "Equipamentos atualizados", desc: "Você recebe máquinas prontas para trabalhar, não para dar problema." },
  { icon: Wrench, title: "Manutenção incluída", desc: "Deu problema? Resolve. Sem custo extra, sem burocracia." },
  { icon: RefreshCw, title: "Substituição quando necessário", desc: "Ficou defasado? Troca. Precisa expandir? Escala. Simples." },
  { icon: Headphones, title: "Suporte completo", desc: "Atendimento remoto e presencial. Você não se preocupa." },
  { icon: DollarSign, title: "Investimento no funcionamento", desc: "Você deixa de gastar com máquina e passa a investir na sua empresa." },
  { icon: ShieldCheck, title: "Muda o jogo", desc: "Computador deixa de ser problema e vira ferramenta de verdade." },
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

/* ─── Format helpers ─── */
const formatCnpjCpf = (value: string) => {
  const digits = value.replace(/\D/g, "").slice(0, 14);
  if (digits.length <= 11) {
    return digits
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
  }
  return digits
    .replace(/(\d{2})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1/$2")
    .replace(/(\d{4})(\d{1,2})$/, "$1-$2");
};

const formatCep = (value: string) => {
  const digits = value.replace(/\D/g, "").slice(0, 8);
  return digits.replace(/(\d{5})(\d{1,3})/, "$1-$2");
};

const formatPhone = (value: string) => {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 10) {
    return digits
      .replace(/(\d{2})(\d)/, "($1) $2")
      .replace(/(\d{4})(\d{1,4})$/, "$1-$2");
  }
  return digits
    .replace(/(\d{2})(\d)/, "($1) $2")
    .replace(/(\d{5})(\d{1,4})$/, "$1-$2");
};

const LocacaoComputadoresPage = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { lookupCnpj, lookupCep, cnpjLoading, cepLoading } = useBrasilApiLookup();

  /* ── Calculator state ── */
  const [selectedPlan, setSelectedPlan] = useState("equilibrio");
  const [qty, setQty] = useState(5);
  const plan = PLANS.find((p) => p.id === selectedPlan) || PLANS[1];
  const total = plan.price * qty;

  /* ── Lead capture ── */
  const [showLead, setShowLead] = useState(false);
  const [leadSent, setLeadSent] = useState(false);
  const [leadLoading, setLeadLoading] = useState(false);
  const [lead, setLead] = useState({
    responsavel: "",
    whatsapp: "",
    email: "",
    empresa: "",
    nomeFantasia: "",
    cnpj: "",
    cidade: "",
    uf: "",
    cep: "",
    endereco: "",
    numero: "",
    complemento: "",
    bairro: "",
  });

  const rawCnpj = lead.cnpj.replace(/\D/g, "");
  const rawCep = lead.cep.replace(/\D/g, "");

  // CNPJ auto-fill
  useEffect(() => {
    if (rawCnpj.length !== 14) return;
    lookupCnpj(rawCnpj).then((data) => {
      if (!data) {
        toast({ title: "CNPJ não encontrado", description: "Preencha manualmente.", variant: "destructive" });
        return;
      }
      setLead((prev) => ({
        ...prev,
        empresa: data.razao_social || prev.empresa,
        nomeFantasia: data.nome_fantasia || prev.nomeFantasia,
        endereco: data.logradouro || prev.endereco,
        numero: data.numero || prev.numero,
        complemento: data.complemento || prev.complemento,
        bairro: data.bairro || prev.bairro,
        cidade: data.municipio || prev.cidade,
        uf: data.uf || prev.uf,
        cep: data.cep ? formatCep(data.cep) : prev.cep,
        whatsapp: !prev.whatsapp && data.ddd_telefone_1 ? formatPhone(data.ddd_telefone_1.replace(/\D/g, "")) : prev.whatsapp,
      }));
      toast({ title: "Dados encontrados!", description: data.razao_social || "" });
    });
  }, [rawCnpj]);

  // CEP auto-fill
  useEffect(() => {
    if (rawCep.length !== 8) return;
    lookupCep(rawCep).then((data) => {
      if (!data) return;
      setLead((prev) => ({
        ...prev,
        endereco: data.street || prev.endereco,
        bairro: data.neighborhood || prev.bairro,
        cidade: data.city || prev.cidade,
        uf: data.state || prev.uf,
      }));
    });
  }, [rawCep]);

  const handleLeadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lead.responsavel.trim() || !lead.whatsapp.trim()) {
      toast({ title: "Preencha nome e WhatsApp", variant: "destructive" });
      return;
    }
    setLeadLoading(true);
    try {
      const { data: existing } = await supabase
        .from("leads")
        .select("id")
        .eq("whatsapp", lead.whatsapp.trim())
        .maybeSingle();

      if (!existing) {
        await supabase.from("leads").insert({
          name: lead.responsavel.trim(),
          email: lead.email.trim() || `${lead.whatsapp.replace(/\D/g, "")}@pendente.com`,
          phone: lead.whatsapp.trim(),
          whatsapp: lead.whatsapp.trim(),
          company: lead.empresa.trim() || null,
          service_interest: `Locação - ${plan.name} x${qty} = R$${total}/mês`,
          source_page: "/locacao-de-computadores-para-empresas-jacarei",
          lead_status: "lead_capturado",
        });
      }

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

  const handleAdvanceToContract = () => {
    // Pass all lead data via URL params so the ContractingWizard can pre-fill
    const params = new URLSearchParams({
      plano: selectedPlan,
      qty: String(qty),
      preco: String(plan.price),
      empresa: lead.empresa,
      nomeFantasia: lead.nomeFantasia,
      responsavel: lead.responsavel,
      email: lead.email,
      whatsapp: lead.whatsapp,
      cnpj: lead.cnpj,
      cidade: lead.cidade,
      uf: lead.uf,
      cep: lead.cep,
      endereco: lead.endereco,
      numero: lead.numero,
      complemento: lead.complemento,
      bairro: lead.bairro,
    });
    navigate(`/contratar/locacao-de-computadores-para-empresas-jacarei?${params.toString()}`);
  };

  const scrollToCalc = () => {
    document.getElementById("calculadora")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="min-h-screen">
      <SeoHead
        title="Locação de Computadores para Empresas em Jacareí — Pare de gastar dinheiro com máquinas que só dão problema | WMTi"
        description="Locação de computadores para empresas em Jacareí. Equipamentos atualizados, manutenção incluída, suporte completo e substituição quando necessário. Pare de gastar com máquina e invista no funcionamento da sua empresa."
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
              Pare de gastar dinheiro com máquinas que <span className="text-primary">só dão problema</span>
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mb-8 leading-relaxed">
              Comprar computador parece uma decisão inteligente. Até começar a dar problema. Primeiro fica mais lento. Depois começa a travar. Depois alguém reclama que não consegue trabalhar direito. Depois vem manutenção, troca de peça, e então… você precisa trocar tudo de novo. Isso não é investimento — é um ciclo contínuo de gasto.
            </p>
            <div className="flex flex-wrap gap-4">
              <Button size="lg" onClick={scrollToCalc} className="h-14 px-8 text-base">
                <Calculator size={18} className="mr-2" /> Calcular investimento
              </Button>
              <a
                href="https://wa.me/5511963166915?text=Olá! Gostaria de saber mais sobre locação de computadores."
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
              A locação da WMTi <span className="text-primary">elimina esse ciclo</span>
            </h2>
            <p className="text-muted-foreground max-w-2xl mb-10">
              Você não compra. Você não se preocupa. Você não perde tempo. Equipamentos atualizados, manutenção incluída, suporte completo e substituição quando necessário.
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
            <p className="font-mono text-xs tracking-[0.3em] uppercase text-primary mb-4">// Desktops — contratação online</p>
            <h2 className="text-2xl md:text-3xl mb-2">Escolha o plano ideal para sua <span className="text-primary">empresa</span></h2>
            <p className="text-sm text-muted-foreground mb-10">Estações Dell OptiPlex completas. Contrate 100% online — do orçamento ao pagamento.</p>
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

      {/* ══════ NOTEBOOKS SOB CONSULTA ══════ */}
      <section className="section-dark py-16 md:py-20 border-t border-border">
        <div className="container max-w-4xl">
          <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} className="text-center mb-10">
            <p className="font-mono text-xs tracking-[0.3em] uppercase text-primary mb-4">// Notebooks</p>
            <h2 className="text-2xl md:text-3xl mb-3">Precisa de <span className="text-primary">notebooks</span> ao invés de desktops?</h2>
            <p className="text-muted-foreground max-w-xl mx-auto text-sm leading-relaxed">
              Notebooks corporativos exigem configuração personalizada — modelo, tela, autonomia de bateria
              e perfil de uso variam muito entre empresas. Por isso, montamos propostas sob medida.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="bg-card border-2 border-primary/20 rounded-2xl p-8 md:p-10"
          >
            <div className="flex flex-col md:flex-row items-center gap-8">
              <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
                <Laptop size={36} className="text-primary" />
              </div>
              <div className="flex-1 text-center md:text-left">
                <h3 className="font-heading text-xl font-bold mb-2">Locação de Notebooks Dell</h3>
                <p className="text-sm text-muted-foreground leading-relaxed mb-1">
                  Dell Latitude e Vostro para equipes externas, gerentes e profissionais que precisam de mobilidade.
                </p>
                <div className="flex flex-wrap gap-3 mt-4 justify-center md:justify-start">
                  {["Dell Latitude", "Dell Vostro", "Core i5 / i7", "Tela 14\" ou 15\"", "SSD + 16GB RAM", "Suporte incluso"].map((tag) => (
                    <span key={tag} className="inline-flex items-center gap-1 px-3 py-1 bg-primary/5 border border-primary/20 rounded-full text-xs text-primary font-medium">
                      <CheckCircle2 size={10} /> {tag}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-8 pt-6 border-t border-border">
              <div className="bg-secondary/50 rounded-xl p-5 text-center mb-6">
                <p className="text-xs font-mono uppercase tracking-wide text-muted-foreground mb-1">Valor</p>
                <p className="text-2xl font-bold text-foreground">Sob consulta</p>
                <p className="text-xs text-muted-foreground mt-1">Proposta personalizada em até 24h</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6 text-center">
                {[
                  { label: "Contrato flexível", desc: "12 a 36 meses" },
                  { label: "Troca garantida", desc: "Em caso de defeito" },
                  { label: "Suporte 24/7", desc: "Remoto e presencial" },
                ].map((item) => (
                  <div key={item.label} className="p-3 bg-background rounded-lg border border-border">
                    <p className="text-xs font-bold text-foreground">{item.label}</p>
                    <p className="text-[10px] text-muted-foreground">{item.desc}</p>
                  </div>
                ))}
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <a
                  href="https://wa.me/5511963166915?text=Ol%C3%A1!%20Preciso%20de%20uma%20proposta%20de%20loca%C3%A7%C3%A3o%20de%20notebooks%20corporativos%20para%20minha%20empresa."
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1"
                >
                  <Button size="lg" className="w-full h-14 text-base bg-primary hover:bg-primary/90">
                    <MessageCircle size={18} className="mr-2" />
                    Solicitar proposta de notebooks
                  </Button>
                </a>
                <a
                  href="mailto:contato@wmti.com.br?subject=Proposta%20de%20Loca%C3%A7%C3%A3o%20de%20Notebooks&body=Ol%C3%A1!%20Gostaria%20de%20receber%20uma%20proposta%20de%20loca%C3%A7%C3%A3o%20de%20notebooks%20corporativos."
                  className="flex-1"
                >
                  <Button size="lg" variant="outline" className="w-full h-14 text-base">
                    Enviar e-mail
                  </Button>
                </a>
              </div>
            </div>
          </motion.div>

          <p className="text-xs text-muted-foreground text-center mt-6">
            💡 <strong>Dica:</strong> Para equipes fixas (escritório), a locação de desktops é mais econômica.
            Notebooks são ideais para equipes externas ou profissionais que precisam de mobilidade.
          </p>
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
              <form onSubmit={handleLeadSubmit} className="space-y-4 border-t border-border pt-6">
                <p className="text-sm font-heading font-bold text-center mb-4">Preencha para receber sua proposta</p>

                {/* CNPJ first — triggers auto-fill */}
                <div>
                  <Label className="text-xs text-muted-foreground mb-1 block">CNPJ</Label>
                  <div className="relative">
                    <Input
                      value={lead.cnpj}
                      onChange={(e) => setLead({ ...lead, cnpj: formatCnpjCpf(e.target.value) })}
                      placeholder="00.000.000/0001-00"
                      className="bg-background pr-10"
                      maxLength={18}
                    />
                    {cnpjLoading && <Loader2 className="w-4 h-4 animate-spin absolute right-3 top-3 text-primary" />}
                  </div>
                  {rawCnpj.length === 14 && !cnpjLoading && lead.empresa && (
                    <p className="text-xs text-primary mt-1">✓ {lead.empresa}</p>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1 block">Nome do responsável *</Label>
                    <Input value={lead.responsavel} onChange={(e) => setLead({ ...lead, responsavel: e.target.value })} placeholder="Seu nome" className="bg-background" required />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1 block">WhatsApp *</Label>
                    <Input value={lead.whatsapp} onChange={(e) => setLead({ ...lead, whatsapp: formatPhone(e.target.value) })} placeholder="(12) 99999-9999" className="bg-background" maxLength={15} required />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1 block">E-mail</Label>
                    <Input type="email" value={lead.email} onChange={(e) => setLead({ ...lead, email: e.target.value })} placeholder="email@empresa.com" className="bg-background" />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1 block">Empresa</Label>
                    <Input value={lead.empresa} onChange={(e) => setLead({ ...lead, empresa: e.target.value })} placeholder="Razão social" className="bg-background" />
                  </div>
                </div>

                {/* Address section - auto-filled by CNPJ or CEP */}
                <div className="border-t border-border pt-3">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Endereço</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs text-muted-foreground mb-1 block">CEP</Label>
                      <div className="relative">
                        <Input
                          value={lead.cep}
                          onChange={(e) => setLead({ ...lead, cep: formatCep(e.target.value) })}
                          placeholder="00000-000"
                          className="bg-background pr-10"
                          maxLength={9}
                        />
                        {cepLoading && <Loader2 className="w-4 h-4 animate-spin absolute right-3 top-3 text-primary" />}
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground mb-1 block">Cidade</Label>
                      <Input value={lead.cidade} onChange={(e) => setLead({ ...lead, cidade: e.target.value })} placeholder="Jacareí" className="bg-background" />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground mb-1 block">UF</Label>
                      <Input value={lead.uf} onChange={(e) => setLead({ ...lead, uf: e.target.value.toUpperCase().slice(0, 2) })} placeholder="SP" className="bg-background" maxLength={2} />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground mb-1 block">Logradouro</Label>
                      <Input value={lead.endereco} onChange={(e) => setLead({ ...lead, endereco: e.target.value })} placeholder="Rua, Avenida..." className="bg-background" />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground mb-1 block">Número</Label>
                      <Input value={lead.numero} onChange={(e) => setLead({ ...lead, numero: e.target.value })} placeholder="123" className="bg-background" />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground mb-1 block">Bairro</Label>
                      <Input value={lead.bairro} onChange={(e) => setLead({ ...lead, bairro: e.target.value })} placeholder="Bairro" className="bg-background" />
                    </div>
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

                <Button onClick={handleAdvanceToContract} className="w-full h-14 text-base">
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
            Você deixa de gastar com máquina e passa a <span className="text-primary">investir no funcionamento</span> da sua empresa
          </h2>
          <p className="text-muted-foreground max-w-xl mx-auto mb-8">
            Equipamentos atualizados, manutenção incluída, suporte completo. Se der problema, resolve. Se ficar defasado, troca. Se precisar expandir, escala. E isso muda completamente o jogo.
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
