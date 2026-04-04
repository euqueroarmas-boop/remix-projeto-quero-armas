import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Clock, TrendingDown, Code2, Gauge, Zap, FileText, ArrowRight, MessageSquare, AlertTriangle } from "lucide-react";
import { Link } from "react-router-dom";
import { useInfraStore } from "@/stores/useInfraStore";
import { openWhatsApp } from "@/lib/whatsapp";

const PRICE_TABLE: Record<number, number> = {
  1: 200, 2: 190, 3: 180, 4: 170, 5: 160, 6: 155, 7: 150, 8: 145,
};
const BASE_PRICE = 200;

const PROJECT_TYPES = [
  { key: "site_institucional", label: "Site Institucional" },
  { key: "landing_page", label: "Landing Page" },
  { key: "sistema_web", label: "Sistema Web" },
  { key: "painel_admin", label: "Painel Administrativo" },
  { key: "integracao_api", label: "Integração / API" },
  { key: "manutencao", label: "Manutenção / Evolução" },
] as const;

const COMPLEXIDADE = [
  { key: "baixa", label: "Baixa", mult: 1.0, desc: "Layout simples, poucas páginas" },
  { key: "media", label: "Média", mult: 1.2, desc: "Funcionalidades customizadas" },
  { key: "alta", label: "Alta", mult: 1.5, desc: "Integrações complexas, IA, APIs" },
] as const;

type PrazoOption = { key: string; label: string; mult: number };

const URGENCIA_CONFIG: Record<string, {
  label: string;
  minHours: number;
  prazos: PrazoOption[];
  message?: string;
}> = {
  normal: {
    label: "Normal",
    minHours: 1,
    prazos: [
      { key: "flexivel", label: "Flexível", mult: 1.0 },
      { key: "30_dias", label: "Até 30 dias", mult: 1.0 },
      { key: "60_dias", label: "Até 60 dias", mult: 1.0 },
      { key: "90_dias", label: "Até 90 dias", mult: 1.0 },
    ],
  },
  prioritario: {
    label: "Prioritário",
    minHours: 2,
    prazos: [
      { key: "mesmo_dia", label: "Mesmo dia", mult: 1.25 },
      { key: "24h", label: "Em até 24h", mult: 1.15 },
    ],
    message: "Projeto entra em faixa de antecipação de execução",
  },
  urgente: {
    label: "Urgente",
    minHours: 2,
    prazos: [
      { key: "1h", label: "Até 1h", mult: 1.8 },
      { key: "2h", label: "Até 2h", mult: 1.6 },
      { key: "4h", label: "Até 4h", mult: 1.4 },
      { key: "8h", label: "Até 8h", mult: 1.25 },
    ],
    message: "Execução imediata com alocação prioritária da equipe técnica",
  },
};

const CONTINUIDADE_OPTIONS = [
  { key: "nao", label: "Não preciso" },
  { key: "mensal", label: "Suporte mensal" },
  { key: "sob_demanda", label: "Sob demanda" },
] as const;

const fadeIn = {
  initial: { opacity: 0, y: 20 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true as const },
  transition: { duration: 0.5 },
};

/* ── Sub-components defined outside to avoid remount ── */

const SelectField = ({
  icon: Icon,
  label,
  value,
  onChange,
  options,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: readonly { key: string; label: string; desc?: string; mult?: number }[];
}) => (
  <div className="bg-secondary p-5">
    <label className="font-mono text-xs uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
      <Icon size={14} className="text-primary" />
      {label}
    </label>
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full bg-background border border-border px-3 py-2.5 text-sm font-body text-foreground focus:outline-none focus:border-primary appearance-none cursor-pointer"
    >
      {options.map((opt) => (
        <option key={opt.key} value={opt.key}>
          {opt.label}
          {opt.mult && opt.mult > 1 ? ` (+${Math.round((opt.mult - 1) * 100)}%)` : ""}
          {opt.desc ? ` — ${opt.desc}` : ""}
        </option>
      ))}
    </select>
  </div>
);

const SummaryRow = ({ label, value, highlight }: { label: string; value: string; highlight?: string }) => (
  <div className="flex items-center justify-between font-mono text-sm">
    <span className="text-muted-foreground">{label}</span>
    <span className="text-foreground">
      {value}
      {highlight && <span className="ml-2 text-xs text-primary">{highlight}</span>}
    </span>
  </div>
);

const WebDevCalculator = () => {
  const { sobDemanda, setSobDemanda } = useInfraStore();
  const [hours, setHours] = useState(sobDemanda.horas);
  const [projectType, setProjectType] = useState<string>("site_institucional");
  const [complexidade, setComplexidade] = useState<string>("baixa");
  const [urgencia, setUrgencia] = useState<string>("normal");
  const [prazo, setPrazo] = useState<string>("flexivel");
  const [continuidade, setContinuidade] = useState<string>("nao");
  const [observacoes, setObservacoes] = useState("");

  const urgConfig = URGENCIA_CONFIG[urgencia];

  // When urgency changes, reset prazo to first available and enforce min hours
  useEffect(() => {
    const cfg = URGENCIA_CONFIG[urgencia];
    if (!cfg) return;
    const validKeys = cfg.prazos.map((p) => p.key);
    if (!validKeys.includes(prazo)) {
      setPrazo(cfg.prazos[0].key);
    }
    if (hours < cfg.minHours) {
      setHours(cfg.minHours);
    }
  }, [urgencia]); // intentionally only on urgencia change

  // Sync hours with global store
  useEffect(() => {
    setSobDemanda({ horas: hours });
  }, [hours, setSobDemanda]);

  const unitPrice = PRICE_TABLE[Math.min(hours, 8)] ?? 145;
  const subtotal = hours * unitPrice;
  const fullPrice = hours * BASE_PRICE;

  const compMult = COMPLEXIDADE.find((c) => c.key === complexidade)?.mult ?? 1;
  const prazoMult = urgConfig.prazos.find((p) => p.key === prazo)?.mult ?? 1;

  const totalFinal = Math.round(subtotal * compMult * prazoMult);
  const savings = fullPrice - subtotal;
  const discountPct = hours > 1 ? Math.round(((BASE_PRICE - unitPrice) / BASE_PRICE) * 100) : 0;
  const additionalsValue = totalFinal - subtotal;

  const projectLabel = PROJECT_TYPES.find((p) => p.key === projectType)?.label ?? "";
  const prazoLabel = urgConfig.prazos.find((p) => p.key === prazo)?.label ?? "";

  const handleHoursChange = (v: number) => {
    const min = urgConfig.minHours;
    setHours(Math.max(min, Math.min(8, v || min)));
  };

  return (
    <section className="section-dark py-16 md:py-24 border-t border-border">
      <div className="container">
        <motion.div {...fadeIn}>
          <p className="font-mono text-xs tracking-[0.3em] uppercase text-primary mb-4">
            // Calculadora de Projeto Web
          </p>
          <h2 className="text-2xl md:text-4xl mb-2">
            Estime o custo do seu projeto{" "}
            <span className="text-primary">em minutos</span>
          </h2>
          <p className="font-body text-muted-foreground mb-10 leading-relaxed max-w-2xl">
            Informe os detalhes abaixo e veja uma estimativa real com base no seu cenário.
          </p>

          <div className="grid lg:grid-cols-[1fr_380px] gap-8">
            {/* ── Left: Form ── */}
            <div className="space-y-4">
              <SelectField icon={Code2} label="Tipo de projeto" value={projectType} onChange={setProjectType} options={PROJECT_TYPES} />

              {/* Hours */}
              <div className="bg-secondary p-5">
                <label className="font-mono text-xs uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
                  <Clock size={14} className="text-primary" />
                  Quantidade de horas (mín. {urgConfig.minHours}h)
                </label>
                <div className="flex items-center gap-4">
                  <input
                    type="number"
                    min={urgConfig.minHours}
                    max={8}
                    value={hours}
                    onChange={(e) => handleHoursChange(Number(e.target.value))}
                    className="w-24 bg-background border border-border px-3 py-2.5 text-center text-lg font-bold font-mono text-primary focus:outline-none focus:border-primary"
                  />
                  <div className="font-body text-sm text-muted-foreground">
                    <span className="text-foreground font-medium">R$ {unitPrice}/h</span>
                    {discountPct > 0 && (
                      <span className="ml-2 text-primary text-xs font-mono">-{discountPct}% desconto</span>
                    )}
                  </div>
                </div>
              </div>

              <SelectField icon={Gauge} label="Complexidade do projeto" value={complexidade} onChange={setComplexidade} options={COMPLEXIDADE} />

              {/* Urgência */}
              <SelectField
                icon={Zap}
                label="Urgência"
                value={urgencia}
                onChange={setUrgencia}
                options={[
                  { key: "normal", label: "Normal", desc: "Prazo padrão" },
                  { key: "prioritario", label: "Prioritário", desc: "Antecipação de execução (mín. 2h)" },
                  { key: "urgente", label: "Urgente", desc: "Execução imediata (mín. 2h)" },
                ]}
              />

              {/* Urgency message */}
              {urgConfig.message && (
                <div className="flex items-start gap-2 bg-primary/10 border border-primary/20 px-4 py-3">
                  <AlertTriangle size={16} className="text-primary mt-0.5 shrink-0" />
                  <p className="font-body text-sm text-primary">{urgConfig.message}</p>
                </div>
              )}

              {/* Prazo - dynamic based on urgency */}
              <SelectField
                icon={Clock}
                label="Prazo desejado"
                value={prazo}
                onChange={setPrazo}
                options={urgConfig.prazos}
              />

              <SelectField icon={FileText} label="Continuidade / suporte pós-projeto" value={continuidade} onChange={setContinuidade} options={CONTINUIDADE_OPTIONS} />

              {/* Observações */}
              <div className="bg-secondary p-5">
                <label className="font-mono text-xs uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
                  <FileText size={14} className="text-primary" />
                  Observações do projeto (opcional)
                </label>
                <textarea
                  placeholder="Descreva brevemente o projeto, funcionalidades desejadas, referências..."
                  value={observacoes}
                  onChange={(e) => setObservacoes(e.target.value)}
                  rows={3}
                  className="w-full bg-background border border-border px-3 py-2.5 text-sm font-body text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary resize-none"
                />
              </div>
            </div>

            {/* ── Right: Summary ── */}
            <div className="lg:sticky lg:top-24 self-start space-y-4">
              <div className="bg-secondary p-6 space-y-3">
                <h3 className="font-mono text-xs uppercase tracking-wider text-primary mb-3">Resumo do projeto</h3>

                <SummaryRow label="Tipo" value={projectLabel} />
                <SummaryRow label="Horas" value={`${hours}h`} />
                <SummaryRow label="Valor/hora" value={`R$ ${unitPrice}`} highlight={discountPct > 0 ? `-${discountPct}%` : undefined} />

                <div className="h-px bg-muted-foreground/10" />

                <SummaryRow label="Subtotal" value={`R$ ${subtotal.toLocaleString("pt-BR")}`} />

                {savings > 0 && (
                  <div className="flex items-center justify-between font-mono text-sm">
                    <span className="flex items-center gap-1.5 text-muted-foreground">
                      <TrendingDown size={12} className="text-primary" /> Desconto volume
                    </span>
                    <span className="text-primary font-bold">-R$ {savings.toLocaleString("pt-BR")}</span>
                  </div>
                )}

                <div className="h-px bg-muted-foreground/10" />

                <SummaryRow
                  label="Complexidade"
                  value={COMPLEXIDADE.find((c) => c.key === complexidade)?.label ?? ""}
                  highlight={compMult > 1 ? `×${compMult}` : undefined}
                />
                <SummaryRow label="Urgência" value={urgConfig.label} />
                <SummaryRow
                  label="Prazo"
                  value={prazoLabel}
                  highlight={prazoMult > 1 ? `×${prazoMult}` : undefined}
                />

                {additionalsValue > 0 && (
                  <div className="flex items-center justify-between font-mono text-sm">
                    <span className="text-muted-foreground">Adicionais</span>
                    <span className="text-foreground">+R$ {additionalsValue.toLocaleString("pt-BR")}</span>
                  </div>
                )}
                {continuidade !== "nao" && (
                  <SummaryRow label="Continuidade" value={CONTINUIDADE_OPTIONS.find((c) => c.key === continuidade)?.label ?? ""} />
                )}

                <div className="h-px bg-muted-foreground/10" />

                <div className="flex items-center justify-between font-mono pt-1">
                  <span className="text-foreground font-bold">Total estimado</span>
                  <span className="text-primary text-2xl font-bold">
                    R$ {totalFinal.toLocaleString("pt-BR")}
                  </span>
                </div>

                <p className="font-body text-xs text-muted-foreground/60 leading-relaxed pt-2">
                  Este é um valor estimado com base nas informações fornecidas. O escopo final pode ajustar o orçamento.
                </p>
              </div>

              <Link
                to={`/contratar-servico?modo=sob_demanda&horas=${hours}&valor=${totalFinal}&servico=${encodeURIComponent("Desenvolvimento Web — " + projectLabel)}`}
                className="w-full inline-flex items-center justify-center gap-2 bg-primary text-primary-foreground px-6 py-4 font-mono text-sm font-bold uppercase tracking-wider hover:brightness-110 transition-all"
              >
                Contratar horas de desenvolvimento <ArrowRight size={16} />
              </Link>

              <button
                onClick={() =>
                  openWhatsApp({
                    pageTitle: "Desenvolvimento Web",
                    intent: "proposal",
                    detail: `Projeto: ${projectLabel} | ${hours}h | R$ ${totalFinal} | Complexidade: ${complexidade} | Urgência: ${urgConfig.label} | Prazo: ${prazoLabel}`,
                  })
                }
                className="w-full inline-flex items-center justify-center gap-2 border border-border text-foreground px-6 py-3 font-mono text-sm uppercase tracking-wider hover:bg-muted transition-colors"
              >
                <MessageSquare size={16} /> Solicitar análise técnica do projeto
              </button>

              <p className="font-body text-xs text-center text-muted-foreground/50">
                Preencha seus dados, gere o contrato e siga para pagamento seguro.
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default WebDevCalculator;
