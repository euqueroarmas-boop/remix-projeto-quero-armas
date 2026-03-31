import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Server, Layers, Monitor, Minus, Plus, ArrowRight, MessageCircle, TrendingDown, AlertTriangle } from "lucide-react";
import { openWhatsApp } from "@/lib/whatsapp";

/* ── Pricing constants ── */
const HOST_PRICE = 350;
const VM_PRICE = 200;
const WORKSTATION_BASE = 150;
const MAX_AUTO_WORKSTATIONS = 30;
const MAX_DISCOUNT_PCT = 27.5;

/* Progressive discount: linear from 0% at 1 station to 27.5% at 30 stations */
function workstationDiscount(qty: number): number {
  if (qty <= 1) return 0;
  if (qty >= MAX_AUTO_WORKSTATIONS) return MAX_DISCOUNT_PCT;
  return (MAX_DISCOUNT_PCT * (qty - 1)) / (MAX_AUTO_WORKSTATIONS - 1);
}

type OsType = "windows" | "linux" | "macos";

const OS_OPTIONS: { id: OsType; label: string }[] = [
  { id: "windows", label: "Windows" },
  { id: "linux", label: "Linux" },
  { id: "macos", label: "Mac OS" },
];

const fadeIn = {
  initial: { opacity: 0, y: 20 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true as const },
  transition: { duration: 0.5 },
};

interface Props {
  contractHref?: string;
  pageTitle?: string;
}

/* ── Counter row ── */
const CounterRow = ({
  icon: Icon,
  label,
  sublabel,
  value,
  min,
  onDec,
  onInc,
  testPrefix,
}: {
  icon: typeof Server;
  label: string;
  sublabel: string;
  value: number;
  min: number;
  onDec: () => void;
  onInc: () => void;
  testPrefix: string;
}) => (
  <div className="flex items-center justify-between">
    <div className="flex items-center gap-3">
      <Icon size={18} className="text-primary shrink-0" />
      <div>
        <p className="font-mono text-sm font-bold text-foreground">{label}</p>
        <p className="font-body text-xs text-muted-foreground">{sublabel}</p>
      </div>
    </div>
    <div className="flex items-center gap-3">
      <button
        onClick={onDec}
        disabled={value <= min}
        className="w-10 h-10 flex items-center justify-center border border-border text-muted-foreground hover:border-primary hover:text-primary transition-colors rounded disabled:opacity-30 disabled:cursor-not-allowed"
        aria-label={`Diminuir ${label}`}
        data-testid={`dec-${testPrefix}`}
      >
        <Minus size={16} />
      </button>
      <span className="text-2xl font-bold text-primary w-8 text-center" data-testid={`qty-${testPrefix}`}>
        {value}
      </span>
      <button
        onClick={onInc}
        className="w-10 h-10 flex items-center justify-center border border-border text-muted-foreground hover:border-primary hover:text-primary transition-colors rounded"
        aria-label={`Aumentar ${label}`}
        data-testid={`inc-${testPrefix}`}
      >
        <Plus size={16} />
      </button>
    </div>
  </div>
);

const UnifiedInfraCalculator = ({ contractHref = "/orcamento-ti", pageTitle }: Props) => {
  const navigate = useNavigate();
  const [hosts, setHosts] = useState(1);
  const [vms, setVms] = useState(0);
  const [workstations, setWorkstations] = useState(0);
  const [osType, setOsType] = useState<OsType>("windows");

  /* Server subtotal (preserved logic) */
  const serverSubtotal = hosts * HOST_PRICE + vms * VM_PRICE;

  /* Workstation subtotal */
  const wsExceedsLimit = workstations > MAX_AUTO_WORKSTATIONS;
  const discountPct = workstationDiscount(workstations);
  const wsGross = workstations * WORKSTATION_BASE;
  const wsDiscount = wsGross * (discountPct / 100);
  const wsSubtotal = wsExceedsLimit ? 0 : wsGross - wsDiscount;

  const totalMonthly = serverSubtotal + wsSubtotal;

  const handleContract = () => {
    const params = new URLSearchParams({
      modo: "recorrente",
      hosts: String(hosts),
      vms: String(vms),
      estacoes: String(workstations),
      os: osType,
      subtotal_servidores: String(serverSubtotal),
      subtotal_estacoes: String(wsSubtotal),
      total_mensal: String(totalMonthly),
    });
    console.log("[WMTi] CHECKOUT_REDIRECT_RECORRENTE", { hosts, vms, workstations, osType, serverSubtotal, wsSubtotal, totalMonthly });
    navigate(`${contractHref}?${params.toString()}`);
  };

  return (
    <section className="py-16 md:py-24" id="calculadora-recorrente">
      <div className="container max-w-4xl">
        <motion.div {...fadeIn}>
          <p className="font-mono text-xs tracking-[0.3em] uppercase text-primary mb-4">
            Calculadora de Infraestrutura
          </p>
          <h2 className="text-2xl md:text-3xl mb-2">
            Monte seu plano de <span className="text-primary">gestão contínua</span>
          </h2>
          <p className="font-body text-muted-foreground mb-10 max-w-2xl leading-relaxed">
            Informe sua infraestrutura e receba o valor mensal com desconto progressivo aplicado automaticamente.
          </p>

          <div className="grid md:grid-cols-2 gap-6">
            {/* ── LEFT: Inputs ── */}
            <div className="space-y-6">
              {/* Section 1: Servers */}
              <div className="bg-card border border-border rounded-xl p-6">
                <p className="font-mono text-[10px] tracking-[0.3em] uppercase text-primary mb-4 font-bold">
                  Seção 1 — Servidores
                </p>

                {/* Explanations */}
                <div className="space-y-3 mb-5">
                  <div className="flex items-start gap-2.5">
                    <Server size={14} className="text-primary mt-0.5 shrink-0" />
                    <div>
                      <p className="font-mono text-[10px] font-bold text-foreground">HOST (Servidor Físico)</p>
                      <p className="font-body text-[10px] text-muted-foreground leading-relaxed">
                        Servidor físico principal onde o ambiente está instalado ou de onde as VMs são executadas.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <Layers size={14} className="text-primary mt-0.5 shrink-0" />
                    <div>
                      <p className="font-mono text-[10px] font-bold text-foreground">VM (Máquina Virtual)</p>
                      <p className="font-body text-[10px] text-muted-foreground leading-relaxed">
                        Servidor virtualizado que funciona como instância independente dentro de um host.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <CounterRow
                    icon={Server}
                    label="Hosts"
                    sublabel={`R$ ${HOST_PRICE.toLocaleString("pt-BR")}/mês cada`}
                    value={hosts}
                    min={1}
                    onDec={() => setHosts(Math.max(1, hosts - 1))}
                    onInc={() => setHosts(hosts + 1)}
                    testPrefix="host"
                  />
                  <div className="h-px bg-border" />
                  <CounterRow
                    icon={Layers}
                    label="Máquinas Virtuais"
                    sublabel={`R$ ${VM_PRICE.toLocaleString("pt-BR")}/mês cada`}
                    value={vms}
                    min={0}
                    onDec={() => setVms(Math.max(0, vms - 1))}
                    onInc={() => setVms(vms + 1)}
                    testPrefix="vm"
                  />
                </div>
              </div>

              {/* Section 2: Workstations */}
              <div className="bg-card border border-border rounded-xl p-6">
                <p className="font-mono text-[10px] tracking-[0.3em] uppercase text-primary mb-4 font-bold">
                  Seção 2 — Estações de Trabalho
                </p>

                <div className="flex items-start gap-2.5 mb-5">
                  <Monitor size={14} className="text-primary mt-0.5 shrink-0" />
                  <div>
                    <p className="font-mono text-[10px] font-bold text-foreground">ESTAÇÃO DE TRABALHO</p>
                    <p className="font-body text-[10px] text-muted-foreground leading-relaxed">
                      Computador desktop ou notebook utilizado pelos colaboradores. Desconto progressivo automático de até {MAX_DISCOUNT_PCT}%.
                    </p>
                  </div>
                </div>

                <CounterRow
                  icon={Monitor}
                  label="Estações"
                  sublabel={`R$ ${WORKSTATION_BASE.toLocaleString("pt-BR")}/mês (base)`}
                  value={workstations}
                  min={0}
                  onDec={() => setWorkstations(Math.max(0, workstations - 1))}
                  onInc={() => setWorkstations(workstations + 1)}
                  testPrefix="ws"
                />

                {/* OS Type */}
                {workstations > 0 && (
                  <div className="mt-5">
                    <p className="font-mono text-[10px] text-muted-foreground mb-2">Sistema operacional</p>
                    <div className="flex gap-2">
                      {OS_OPTIONS.map((os) => (
                        <button
                          key={os.id}
                          onClick={() => setOsType(os.id)}
                          className={`px-3 py-1.5 rounded text-xs font-mono font-bold transition-all border ${
                            osType === os.id
                              ? "bg-primary/10 border-primary text-primary"
                              : "border-border text-muted-foreground hover:border-primary/50"
                          }`}
                        >
                          {os.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Discount indicator */}
                {workstations > 1 && !wsExceedsLimit && (
                  <div className="mt-4 flex items-center gap-2 bg-primary/5 border border-primary/20 rounded-lg p-3">
                    <TrendingDown size={14} className="text-primary shrink-0" />
                    <p className="font-mono text-xs text-primary font-bold">
                      Desconto de {discountPct.toFixed(1)}% aplicado — economia de R$ {wsDiscount.toFixed(0)}/mês
                    </p>
                  </div>
                )}

                {/* Exceeds limit */}
                {wsExceedsLimit && (
                  <div className="mt-4 flex items-center gap-2 bg-amber-500/10 border border-amber-500/30 rounded-lg p-3">
                    <AlertTriangle size={14} className="text-amber-500 shrink-0" />
                    <p className="font-mono text-xs text-amber-600 font-bold">
                      Acima de {MAX_AUTO_WORKSTATIONS} estações: entre em contato para proposta personalizada.
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* ── RIGHT: Summary ── */}
            <div className="flex flex-col">
              <div className="bg-card border border-border rounded-xl p-6 sticky top-24 space-y-4">
                <p className="font-mono text-[10px] tracking-[0.3em] uppercase text-primary font-bold mb-2">
                  Resumo mensal
                </p>

                {/* Server lines */}
                {hosts > 0 && (
                  <div className="flex justify-between font-mono text-sm text-muted-foreground">
                    <span>{hosts} host{hosts > 1 ? "s" : ""} × R$ {HOST_PRICE.toLocaleString("pt-BR")}</span>
                    <span>R$ {(hosts * HOST_PRICE).toLocaleString("pt-BR")}</span>
                  </div>
                )}
                {vms > 0 && (
                  <div className="flex justify-between font-mono text-sm text-muted-foreground">
                    <span>{vms} VM{vms > 1 ? "s" : ""} × R$ {VM_PRICE.toLocaleString("pt-BR")}</span>
                    <span>R$ {(vms * VM_PRICE).toLocaleString("pt-BR")}</span>
                  </div>
                )}

                {(hosts > 0 || vms > 0) && (
                  <div className="flex justify-between font-mono text-sm font-bold text-foreground">
                    <span>Subtotal servidores</span>
                    <span>R$ {serverSubtotal.toLocaleString("pt-BR")}/mês</span>
                  </div>
                )}

                {workstations > 0 && !wsExceedsLimit && (
                  <>
                    <div className="h-px bg-border" />
                    <div className="flex justify-between font-mono text-sm text-muted-foreground">
                      <span>{workstations} estação{workstations > 1 ? "ões" : ""} ({OS_OPTIONS.find(o => o.id === osType)?.label})</span>
                      <span className="line-through text-muted-foreground/50">R$ {wsGross.toLocaleString("pt-BR")}</span>
                    </div>
                    {discountPct > 0 && (
                      <div className="flex justify-between font-mono text-xs text-primary">
                        <span>Desconto ({discountPct.toFixed(1)}%)</span>
                        <span>- R$ {wsDiscount.toFixed(0)}</span>
                      </div>
                    )}
                    <div className="flex justify-between font-mono text-sm font-bold text-foreground">
                      <span>Subtotal estações</span>
                      <span>R$ {wsSubtotal.toFixed(0)}/mês</span>
                    </div>
                  </>
                )}

                {wsExceedsLimit && workstations > 0 && (
                  <>
                    <div className="h-px bg-border" />
                    <div className="font-mono text-xs text-amber-600 text-center py-2">
                      Estações: proposta personalizada
                    </div>
                  </>
                )}

                {/* Total */}
                <div className="h-px bg-border" />
                <div className="flex justify-between font-mono text-lg font-bold">
                  <span className="text-foreground">Total mensal</span>
                  <span className="text-primary text-2xl">
                    R$ {totalMonthly.toLocaleString("pt-BR")}/mês
                  </span>
                </div>

                {/* Minimum term */}
                <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 text-center">
                  <p className="font-mono text-[10px] text-primary font-bold">
                    Contratação recorrente com permanência mínima de 12 meses
                  </p>
                </div>

                {/* CTA */}
                {!wsExceedsLimit ? (
                  <button
                    onClick={handleContract}
                    className="w-full inline-flex items-center justify-center gap-2 bg-primary text-primary-foreground px-8 py-4 font-mono text-sm font-bold uppercase tracking-wider hover:brightness-110 transition-all rounded"
                    data-testid="cta-contratar-recorrente"
                  >
                    <ArrowRight size={16} />
                    Contratar plano recorrente
                  </button>
                ) : (
                  <button
                    onClick={() => openWhatsApp({ pageTitle, intent: "proposal" })}
                    className="w-full inline-flex items-center justify-center gap-2 bg-primary text-primary-foreground px-8 py-4 font-mono text-sm font-bold uppercase tracking-wider hover:brightness-110 transition-all rounded"
                  >
                    <MessageCircle size={16} />
                    Solicitar proposta personalizada
                  </button>
                )}
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default UnifiedInfraCalculator;
