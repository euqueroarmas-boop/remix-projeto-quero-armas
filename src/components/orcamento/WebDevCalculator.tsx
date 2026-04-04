import { useState } from "react";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { Minus, Plus, Clock, TrendingDown, Code2, Gauge, Zap, FileText } from "lucide-react";
import { Link } from "react-router-dom";

/* ── Reuse existing progressive discount table ── */
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
  { key: "baixa", label: "Baixa", mult: 1.0 },
  { key: "media", label: "Média", mult: 1.2 },
  { key: "alta", label: "Alta", mult: 1.5 },
] as const;

const URGENCIA = [
  { key: "normal", label: "Normal", mult: 1.0 },
  { key: "prioritario", label: "Prioritário", mult: 1.2 },
  { key: "urgente", label: "Urgente", mult: 1.35 },
] as const;

const fadeIn = {
  initial: { opacity: 0, y: 20 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true as const },
  transition: { duration: 0.5 },
};

const WebDevCalculator = () => {
  const { t } = useTranslation();
  const [hours, setHours] = useState(4);
  const [projectType, setProjectType] = useState<string>("site_institucional");
  const [complexidade, setComplexidade] = useState<string>("baixa");
  const [urgencia, setUrgencia] = useState<string>("normal");
  const [prazo, setPrazo] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [continuidade, setContinuidade] = useState(false);

  const unitPrice = PRICE_TABLE[Math.min(hours, 8)] ?? 145;
  const totalBase = hours * unitPrice;
  const fullPrice = hours * BASE_PRICE;

  const compMult = COMPLEXIDADE.find((c) => c.key === complexidade)?.mult ?? 1;
  const urgMult = URGENCIA.find((u) => u.key === urgencia)?.mult ?? 1;

  const totalFinal = Math.round(totalBase * compMult * urgMult);
  const savings = fullPrice - totalBase;
  const discountPct = hours > 1 ? Math.round(((BASE_PRICE - unitPrice) / BASE_PRICE) * 100) : 0;

  const projectLabel = PROJECT_TYPES.find((p) => p.key === projectType)?.label ?? "";

  const Pill = ({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) => (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1.5 text-xs font-mono uppercase tracking-wider border transition-colors ${
        active
          ? "border-primary bg-primary/10 text-primary"
          : "border-muted-foreground/20 text-muted-foreground hover:border-primary/50"
      }`}
    >
      {children}
    </button>
  );

  return (
    <section className="section-dark py-16 md:py-24 border-t border-border">
      <div className="container">
        <motion.div {...fadeIn}>
          <p className="font-mono text-xs tracking-[0.3em] uppercase text-primary mb-4">
            // Calculadora de Projeto Web
          </p>
          <h2 className="text-2xl md:text-4xl mb-2">
            Estime o investimento do seu{" "}
            <span className="text-primary">projeto</span>
          </h2>
          <p className="font-body text-muted-foreground mb-10 leading-relaxed max-w-2xl">
            Configure as características do projeto e veja o valor estimado em tempo real.
            Desconto progressivo por volume de horas já aplicado automaticamente.
          </p>

          <div className="grid lg:grid-cols-[1fr_380px] gap-8">
            {/* ── Left: Form ── */}
            <div className="space-y-8">
              {/* Hours selector */}
              <div className="bg-secondary p-6">
                <label className="font-mono text-xs uppercase tracking-wider text-muted-foreground mb-4 block">
                  <Clock size={14} className="inline mr-2 text-primary" />
                  Horas técnicas estimadas
                </label>
                <div className="flex items-center justify-center gap-6">
                  <button
                    onClick={() => setHours(Math.max(1, hours - 1))}
                    className="w-10 h-10 flex items-center justify-center border border-muted-foreground/30 text-muted-foreground hover:border-primary hover:text-primary transition-colors"
                    aria-label="Diminuir horas"
                  >
                    <Minus size={18} />
                  </button>
                  <div className="text-center">
                    <span className="text-4xl font-bold text-primary">{hours}</span>
                    <p className="font-mono text-xs text-muted-foreground mt-1">
                      {hours > 1 ? "horas" : "hora"}
                    </p>
                  </div>
                  <button
                    onClick={() => setHours(Math.min(8, hours + 1))}
                    className="w-10 h-10 flex items-center justify-center border border-muted-foreground/30 text-muted-foreground hover:border-primary hover:text-primary transition-colors"
                    aria-label="Aumentar horas"
                  >
                    <Plus size={18} />
                  </button>
                </div>
              </div>

              {/* Project type */}
              <div className="bg-secondary p-6">
                <label className="font-mono text-xs uppercase tracking-wider text-muted-foreground mb-3 block">
                  <Code2 size={14} className="inline mr-2 text-primary" />
                  Tipo de projeto
                </label>
                <div className="flex flex-wrap gap-2">
                  {PROJECT_TYPES.map((pt) => (
                    <Pill key={pt.key} active={projectType === pt.key} onClick={() => setProjectType(pt.key)}>
                      {pt.label}
                    </Pill>
                  ))}
                </div>
              </div>

              {/* Complexity */}
              <div className="bg-secondary p-6">
                <label className="font-mono text-xs uppercase tracking-wider text-muted-foreground mb-3 block">
                  <Gauge size={14} className="inline mr-2 text-primary" />
                  Complexidade
                </label>
                <div className="flex flex-wrap gap-2">
                  {COMPLEXIDADE.map((c) => (
                    <Pill key={c.key} active={complexidade === c.key} onClick={() => setComplexidade(c.key)}>
                      {c.label} (×{c.mult})
                    </Pill>
                  ))}
                </div>
              </div>

              {/* Urgency */}
              <div className="bg-secondary p-6">
                <label className="font-mono text-xs uppercase tracking-wider text-muted-foreground mb-3 block">
                  <Zap size={14} className="inline mr-2 text-primary" />
                  Urgência
                </label>
                <div className="flex flex-wrap gap-2">
                  {URGENCIA.map((u) => (
                    <Pill key={u.key} active={urgencia === u.key} onClick={() => setUrgencia(u.key)}>
                      {u.label} {u.mult > 1 ? `(+${Math.round((u.mult - 1) * 100)}%)` : ""}
                    </Pill>
                  ))}
                </div>
              </div>

              {/* Optional fields */}
              <div className="bg-secondary p-6 space-y-4">
                <label className="font-mono text-xs uppercase tracking-wider text-muted-foreground block">
                  <FileText size={14} className="inline mr-2 text-primary" />
                  Informações adicionais (opcional)
                </label>
                <input
                  type="text"
                  placeholder="Prazo desejado (ex: 30 dias, 2 semanas)"
                  value={prazo}
                  onChange={(e) => setPrazo(e.target.value)}
                  className="w-full bg-background border border-border px-3 py-2 text-sm font-body text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary"
                />
                <textarea
                  placeholder="Descreva brevemente o projeto ou requisitos..."
                  value={observacoes}
                  onChange={(e) => setObservacoes(e.target.value)}
                  rows={3}
                  className="w-full bg-background border border-border px-3 py-2 text-sm font-body text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary resize-none"
                />
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={continuidade}
                    onChange={(e) => setContinuidade(e.target.checked)}
                    className="accent-primary"
                  />
                  <span className="font-body text-sm text-muted-foreground">
                    Tenho interesse em suporte contínuo após o projeto
                  </span>
                </label>
              </div>
            </div>

            {/* ── Right: Summary sidebar ── */}
            <div className="lg:sticky lg:top-24 self-start">
              <div className="bg-secondary p-6 space-y-4">
                <h3 className="font-mono text-xs uppercase tracking-wider text-primary mb-2">
                  Resumo do projeto
                </h3>

                <Row label="Tipo" value={projectLabel} />
                <Row label="Horas" value={`${hours}h`} />
                <Row label="Valor/hora" value={`R$ ${unitPrice}`} suffix={discountPct > 0 ? `-${discountPct}%` : undefined} />
                <Row label="Complexidade" value={COMPLEXIDADE.find((c) => c.key === complexidade)?.label ?? ""} suffix={compMult > 1 ? `×${compMult}` : undefined} />
                <Row label="Urgência" value={URGENCIA.find((u) => u.key === urgencia)?.label ?? ""} suffix={urgMult > 1 ? `+${Math.round((urgMult - 1) * 100)}%` : undefined} />

                {prazo && <Row label="Prazo" value={prazo} />}

                <div className="h-px bg-muted-foreground/10" />

                {savings > 0 && (
                  <div className="flex items-center justify-between font-mono text-sm">
                    <span className="text-muted-foreground">Desconto volume</span>
                    <span className="text-primary font-bold">-R$ {savings.toLocaleString("pt-BR")}</span>
                  </div>
                )}

                {(compMult > 1 || urgMult > 1) && (
                  <div className="flex items-center justify-between font-mono text-sm">
                    <span className="text-muted-foreground">Adicionais</span>
                    <span className="text-foreground">
                      +R$ {(totalFinal - totalBase).toLocaleString("pt-BR")}
                    </span>
                  </div>
                )}

                <div className="h-px bg-muted-foreground/10" />

                <div className="flex items-center justify-between font-mono">
                  <span className="text-foreground font-bold">Total estimado</span>
                  <span className="text-primary text-2xl font-bold">
                    R$ {totalFinal.toLocaleString("pt-BR")}
                  </span>
                </div>

                {continuidade && (
                  <p className="font-mono text-xs text-primary/80">
                    + suporte contínuo (a combinar)
                  </p>
                )}

                <p className="font-body text-xs text-muted-foreground/60 leading-relaxed">
                  Valor estimado com base nas informações iniciais. O escopo final pode ajustar o orçamento.
                </p>
              </div>

              <Link
                to={`/orcamento-ti?servico=${encodeURIComponent("Desenvolvimento Web — " + projectLabel)}&horas=${hours}&valor=${totalFinal}`}
                className="mt-4 w-full inline-flex items-center justify-center gap-2 bg-primary text-primary-foreground px-8 py-4 font-mono text-sm font-bold uppercase tracking-wider hover:brightness-110 transition-all"
              >
                Solicitar proposta
              </Link>
              <p className="font-body text-xs text-center text-muted-foreground/60 mt-2">
                Você será direcionado para preencher seus dados e receber uma proposta detalhada.
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

/* ── Helper ── */
const Row = ({ label, value, suffix }: { label: string; value: string; suffix?: string }) => (
  <div className="flex items-center justify-between font-mono text-sm">
    <span className="text-muted-foreground">{label}</span>
    <span className="text-foreground">
      {value}
      {suffix && <span className="ml-2 text-xs text-primary">{suffix}</span>}
    </span>
  </div>
);

export default WebDevCalculator;
