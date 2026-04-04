import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { Server, Layers, Monitor, Minus, Plus, ArrowRight, MessageCircle, TrendingDown, AlertTriangle, Shield, Zap } from "lucide-react";
import { openWhatsApp } from "@/lib/whatsapp";
import { useInfraStore, SLA_MULTIPLIER, CRITICIDADE_MULTIPLIER, SLA_LABELS, CRITICIDADE_LABELS, type SlaType, type CriticidadeType } from "@/stores/useInfraStore";

/* ── Pricing constants ── */
const WORKSTATION_BASE = 150;
const MAX_AUTO_WORKSTATIONS = 30;
const MAX_DISCOUNT_PCT = 27.5;

function getServerPrices(os: ServerOsType) {
  if (os === "linux") return { host: 500, vm: 350 };
  return { host: 350, vm: 200 };
}

/* Progressive discount: linear from 0% at 1 station to 27.5% at 30 stations */
function workstationDiscount(qty: number): number {
  if (qty <= 1) return 0;
  if (qty >= MAX_AUTO_WORKSTATIONS) return MAX_DISCOUNT_PCT;
  return (MAX_DISCOUNT_PCT * (qty - 1)) / (MAX_AUTO_WORKSTATIONS - 1);
}

type OsType = "windows" | "linux" | "macos";
type ServerOsType = "windows_server" | "linux";

const SERVER_OS_OPTIONS: { id: ServerOsType; label: string }[] = [
  { id: "windows_server", label: "Windows Server" },
  { id: "linux", label: "Linux" },
];

const WS_OS_OPTIONS: { id: OsType; label: string }[] = [
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
  decreaseLabel,
  increaseLabel,
}: {
  icon: typeof Server;
  label: string;
  sublabel: string;
  value: number;
  min: number;
  onDec: () => void;
  onInc: () => void;
  testPrefix: string;
  decreaseLabel: string;
  increaseLabel: string;
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
        aria-label={`${decreaseLabel} ${label}`}
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
        aria-label={`${increaseLabel} ${label}`}
        data-testid={`inc-${testPrefix}`}
      >
        <Plus size={16} />
      </button>
    </div>
  </div>
);

const UnifiedInfraCalculator = ({ contractHref = "/orcamento-ti", pageTitle }: Props) => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const k = "infraCalc";
  const { recorrente, setRecorrente } = useInfraStore();
  const hosts = recorrente.hosts;
  const vms = recorrente.vms;
  const workstations = recorrente.estacoes;
  const serverOs = recorrente.sistemaServidores;
  const wsOs = recorrente.sistemaEstacoes;
  const setHosts = (v: number) => setRecorrente({ hosts: v });
  const setVms = (v: number) => setRecorrente({ vms: v });
  const setWorkstations = (v: number) => setRecorrente({ estacoes: v });
  const setServerOs = (v: "windows_server" | "linux") => setRecorrente({ sistemaServidores: v });
  const setWsOs = (v: OsType) => setRecorrente({ sistemaEstacoes: v });

  const cur = t(`${k}.currency`, "R$");
  const fmt = (v: number) => `${cur} ${v.toLocaleString("pt-BR")}`;

  /* Server prices based on OS */
  const { host: HOST_PRICE, vm: VM_PRICE } = getServerPrices(serverOs);

  /* Server subtotal */
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
      os_servidores: serverOs,
      os_estacoes: wsOs,
      subtotal_servidores: String(serverSubtotal),
      subtotal_estacoes: String(wsSubtotal),
      total_mensal: String(totalMonthly),
    });
    console.log("[WMTi] CHECKOUT_REDIRECT_RECORRENTE", { hosts, vms, workstations, serverOs, wsOs, serverSubtotal, wsSubtotal, totalMonthly });
    navigate(`${contractHref}?${params.toString()}`);
  };

  return (
    <section className="py-16 md:py-24" id="calculadora-recorrente">
      <div className="container max-w-4xl">
        <motion.div {...fadeIn}>
          <p className="font-mono text-xs tracking-[0.3em] uppercase text-primary mb-4">
            {t(`${k}.tag`)}
          </p>
          <h2 className="text-2xl md:text-3xl mb-2">
            {t(`${k}.title1`)}<span className="text-primary">{t(`${k}.titleHighlight`)}</span>{t(`${k}.title2`, "")}
          </h2>
          <p className="font-body text-muted-foreground mb-10 max-w-2xl leading-relaxed">
            {t(`${k}.subtitle`)}
          </p>

          <div className="grid md:grid-cols-2 gap-6">
            {/* ── LEFT: Inputs ── */}
            <div className="space-y-6">
              {/* Section 1: Servers */}
              <div className="bg-card border border-border rounded-xl p-6">
                <p className="font-mono text-[10px] tracking-[0.3em] uppercase text-primary mb-4 font-bold">
                  {t(`${k}.section1`)}
                </p>

                <div className="space-y-3 mb-5">
                  <div className="flex items-start gap-2.5">
                    <Server size={14} className="text-primary mt-0.5 shrink-0" />
                    <div>
                      <p className="font-mono text-[10px] font-bold text-foreground">{t(`${k}.hostTitle`)}</p>
                      <p className="font-body text-[10px] text-muted-foreground leading-relaxed">{t(`${k}.hostDesc`)}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <Layers size={14} className="text-primary mt-0.5 shrink-0" />
                    <div>
                      <p className="font-mono text-[10px] font-bold text-foreground">{t(`${k}.vmTitle`)}</p>
                      <p className="font-body text-[10px] text-muted-foreground leading-relaxed">{t(`${k}.vmDesc`)}</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <CounterRow
                    icon={Server}
                    label={t(`${k}.hosts`)}
                    sublabel={`${fmt(HOST_PRICE)}${t(`${k}.perMonth`)}`}
                    value={hosts}
                    min={1}
                    onDec={() => setHosts(Math.max(1, hosts - 1))}
                    onInc={() => setHosts(hosts + 1)}
                    testPrefix="host"
                    decreaseLabel={t(`${k}.decrease`)}
                    increaseLabel={t(`${k}.increase`)}
                  />
                  <div className="h-px bg-border" />
                  <CounterRow
                    icon={Layers}
                    label={t(`${k}.vms`)}
                    sublabel={`${fmt(VM_PRICE)}${t(`${k}.perMonth`)}`}
                    value={vms}
                    min={0}
                    onDec={() => setVms(Math.max(0, vms - 1))}
                    onInc={() => setVms(vms + 1)}
                    testPrefix="vm"
                    decreaseLabel={t(`${k}.decrease`)}
                    increaseLabel={t(`${k}.increase`)}
                  />
                </div>

                {/* Server OS selection */}
                <div className="mt-5">
                  <p className="font-mono text-[10px] text-muted-foreground mb-2">Sistema operacional dos servidores</p>
                  <div className="flex gap-2">
                    {SERVER_OS_OPTIONS.map((os) => (
                      <button
                        key={os.id}
                        onClick={() => setServerOs(os.id)}
                        className={`px-3 py-1.5 rounded text-xs font-mono font-bold transition-all border ${
                          serverOs === os.id
                            ? "bg-primary/10 border-primary text-primary"
                            : "border-border text-muted-foreground hover:border-primary/50"
                        }`}
                      >
                        {os.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Section 2: Workstations */}
              <div className="bg-card border border-border rounded-xl p-6">
                <p className="font-mono text-[10px] tracking-[0.3em] uppercase text-primary mb-4 font-bold">
                  {t(`${k}.section2`)}
                </p>

                <div className="flex items-start gap-2.5 mb-5">
                  <Monitor size={14} className="text-primary mt-0.5 shrink-0" />
                  <div>
                    <p className="font-mono text-[10px] font-bold text-foreground">{t(`${k}.wsTitle`)}</p>
                    <p className="font-body text-[10px] text-muted-foreground leading-relaxed">
                      {t(`${k}.wsDesc`, { max: MAX_DISCOUNT_PCT })}
                    </p>
                  </div>
                </div>

                <CounterRow
                  icon={Monitor}
                  label={t(`${k}.stations`)}
                  sublabel={`${fmt(WORKSTATION_BASE)}${t(`${k}.perMonth`)}`}
                  value={workstations}
                  min={0}
                  onDec={() => setWorkstations(Math.max(0, workstations - 1))}
                  onInc={() => setWorkstations(workstations + 1)}
                  testPrefix="ws"
                  decreaseLabel={t(`${k}.decrease`)}
                  increaseLabel={t(`${k}.increase`)}
                />

                {workstations > 0 && (
                  <div className="mt-5">
                    <p className="font-mono text-[10px] text-muted-foreground mb-2">{t(`${k}.os`)}</p>
                    <div className="flex gap-2">
                      {WS_OS_OPTIONS.map((os) => (
                        <button
                          key={os.id}
                          onClick={() => setWsOs(os.id)}
                          className={`px-3 py-1.5 rounded text-xs font-mono font-bold transition-all border ${
                            wsOs === os.id
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

                {workstations > 1 && !wsExceedsLimit && (
                  <div className="mt-4 flex items-center gap-2 bg-primary/5 border border-primary/20 rounded-lg p-3">
                    <TrendingDown size={14} className="text-primary shrink-0" />
                    <p className="font-mono text-xs text-primary font-bold">
                      {t(`${k}.discountApplied`, { pct: discountPct.toFixed(1), savings: wsDiscount.toFixed(0) })}
                    </p>
                  </div>
                )}

                {wsExceedsLimit && (
                  <div className="mt-4 flex items-center gap-2 bg-amber-500/10 border border-amber-500/30 rounded-lg p-3">
                    <AlertTriangle size={14} className="text-amber-500 shrink-0" />
                    <p className="font-mono text-xs text-amber-600 font-bold">
                      {t(`${k}.exceedsLimit`, { max: MAX_AUTO_WORKSTATIONS })}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* ── RIGHT: Summary ── */}
            <div className="flex flex-col">
              <div className="bg-card border border-border rounded-xl p-6 sticky top-24 space-y-4">
                <p className="font-mono text-[10px] tracking-[0.3em] uppercase text-primary font-bold mb-2">
                  {t(`${k}.summaryTag`)}
                </p>

                {hosts > 0 && (
                  <div className="flex justify-between font-mono text-sm text-muted-foreground">
                    <span>{hosts} host{hosts > 1 ? "s" : ""} × {fmt(HOST_PRICE)}</span>
                    <span>{fmt(hosts * HOST_PRICE)}</span>
                  </div>
                )}
                {vms > 0 && (
                  <div className="flex justify-between font-mono text-sm text-muted-foreground">
                    <span>{vms} VM{vms > 1 ? "s" : ""} × {fmt(VM_PRICE)}</span>
                    <span>{fmt(vms * VM_PRICE)}</span>
                  </div>
                )}

                {(hosts > 0 || vms > 0) && (
                  <>
                    <div className="flex justify-between font-mono text-sm font-bold text-foreground">
                      <span>{t(`${k}.subtotalServers`)}</span>
                      <span>{fmt(serverSubtotal)}/{t(`${k}.perMonth`).replace("/", "").trim().split(" ")[0]}</span>
                    </div>
                    <div className="flex justify-between font-mono text-xs text-muted-foreground">
                      <span>SO: {SERVER_OS_OPTIONS.find(o => o.id === serverOs)?.label}</span>
                    </div>
                  </>
                )}

                {workstations > 0 && !wsExceedsLimit && (
                  <>
                    <div className="h-px bg-border" />
                    <div className="flex justify-between font-mono text-sm text-muted-foreground">
                      <span>{workstations} {workstations > 1 ? t(`${k}.stationPlural`) : t(`${k}.station`)} ({WS_OS_OPTIONS.find(o => o.id === wsOs)?.label})</span>
                      <span className="line-through text-muted-foreground/50">{fmt(wsGross)}</span>
                    </div>
                    {discountPct > 0 && (
                      <div className="flex justify-between font-mono text-xs text-primary">
                        <span>{t(`${k}.discount`, { pct: discountPct.toFixed(1) })}</span>
                        <span>- {fmt(Number(wsDiscount.toFixed(0)))}</span>
                      </div>
                    )}
                    <div className="flex justify-between font-mono text-sm font-bold text-foreground">
                      <span>{t(`${k}.subtotalStations`)}</span>
                      <span>{fmt(Number(wsSubtotal.toFixed(0)))}/{t(`${k}.perMonth`).replace("/", "").trim().split(" ")[0]}</span>
                    </div>
                  </>
                )}

                {wsExceedsLimit && workstations > 0 && (
                  <>
                    <div className="h-px bg-border" />
                    <div className="font-mono text-xs text-amber-600 text-center py-2">
                      {t(`${k}.customProposal`)}
                    </div>
                  </>
                )}

                <div className="h-px bg-border" />
                <div className="flex justify-between font-mono text-lg font-bold">
                  <span className="text-foreground">{t(`${k}.totalMonthly`)}</span>
                  <span className="text-primary text-2xl">
                    {fmt(totalMonthly)}/{t(`${k}.perMonth`).replace("/", "").trim().split(" ")[0]}
                  </span>
                </div>

                <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 text-center">
                  <p className="font-mono text-[10px] text-primary font-bold">
                    {t(`${k}.minTerm`)}
                  </p>
                </div>

                {!wsExceedsLimit ? (
                  <button
                    onClick={handleContract}
                    className="w-full inline-flex items-center justify-center gap-2 bg-primary text-primary-foreground px-8 py-4 font-mono text-sm font-bold uppercase tracking-wider hover:brightness-110 transition-all rounded"
                    data-testid="cta-contratar-recorrente"
                  >
                    <ArrowRight size={16} />
                    {t(`${k}.ctaContract`)}
                  </button>
                ) : (
                  <button
                    onClick={() => openWhatsApp({ pageTitle, intent: "proposal" })}
                    className="w-full inline-flex items-center justify-center gap-2 bg-primary text-primary-foreground px-8 py-4 font-mono text-sm font-bold uppercase tracking-wider hover:brightness-110 transition-all rounded"
                  >
                    <MessageCircle size={16} />
                    {t(`${k}.ctaProposal`)}
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
