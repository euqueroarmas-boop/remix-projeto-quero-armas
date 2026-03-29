import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Server, Minus, Plus, ArrowRight, Monitor, Layers } from "lucide-react";

const HOST_PRICE = 350;
const VM_PRICE = 200;

const fadeIn = {
  initial: { opacity: 0, y: 20 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true as const },
  transition: { duration: 0.5 },
};

const ServerAdminCalculator = () => {
  const navigate = useNavigate();
  const [hosts, setHosts] = useState(1);
  const [vms, setVms] = useState(0);

  const totalMonthly = hosts * HOST_PRICE + vms * VM_PRICE;

  const handleContract = () => {
    navigate(`/contratar/administracao-de-servidores?hosts=${hosts}&vms=${vms}`);
  };

  return (
    <section className="section-light py-16 md:py-24" id="calculadora-servidores">
      <div className="container max-w-3xl">
        <motion.div {...fadeIn}>
          <p className="font-mono text-xs tracking-[0.3em] uppercase text-primary mb-4">
            Calculadora de Servidores
          </p>
          <h2 className="text-2xl md:text-3xl mb-2">
            Monte seu plano de <span className="text-primary">administração</span>
          </h2>
          <p className="font-body text-muted-foreground mb-8 max-w-xl leading-relaxed">
            Selecione a quantidade de servidores físicos (hosts) e máquinas virtuais (VMs) que precisam de administração contínua.
          </p>

          {/* Explanations */}
          <div className="grid sm:grid-cols-2 gap-4 mb-8">
            <div className="bg-card border border-border rounded-lg p-4 flex items-start gap-3">
              <Server size={20} className="text-primary mt-0.5 shrink-0" />
              <div>
                <p className="font-mono text-xs font-bold text-foreground mb-1">HOST (Servidor Físico)</p>
                <p className="font-body text-xs text-muted-foreground leading-relaxed">
                  Host é o servidor físico principal onde o ambiente pode estar instalado ou de onde as máquinas virtuais são executadas.
                </p>
              </div>
            </div>
            <div className="bg-card border border-border rounded-lg p-4 flex items-start gap-3">
              <Layers size={20} className="text-primary mt-0.5 shrink-0" />
              <div>
                <p className="font-mono text-xs font-bold text-foreground mb-1">VM (Máquina Virtual)</p>
                <p className="font-body text-xs text-muted-foreground leading-relaxed">
                  Máquina virtual (VM) é um servidor virtualizado que funciona como uma instância independente dentro de um host físico.
                </p>
              </div>
            </div>
          </div>

          {/* Counters */}
          <div className="bg-secondary rounded-lg p-6 space-y-6">
            {/* Host counter */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Server size={18} className="text-primary" />
                <div>
                  <p className="font-mono text-sm font-bold text-foreground">Hosts</p>
                  <p className="font-body text-xs text-muted-foreground">R$ {HOST_PRICE.toLocaleString("pt-BR")}/mês cada</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setHosts(Math.max(1, hosts - 1))}
                  disabled={hosts <= 1}
                  className="w-10 h-10 flex items-center justify-center border border-border text-muted-foreground hover:border-primary hover:text-primary transition-colors rounded disabled:opacity-30 disabled:cursor-not-allowed"
                  aria-label="Diminuir hosts"
                >
                  <Minus size={16} />
                </button>
                <span className="text-2xl font-bold text-primary w-8 text-center">{hosts}</span>
                <button
                  onClick={() => setHosts(hosts + 1)}
                  className="w-10 h-10 flex items-center justify-center border border-border text-muted-foreground hover:border-primary hover:text-primary transition-colors rounded"
                  aria-label="Aumentar hosts"
                >
                  <Plus size={16} />
                </button>
              </div>
            </div>

            <div className="h-px bg-border" />

            {/* VM counter */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Layers size={18} className="text-primary" />
                <div>
                  <p className="font-mono text-sm font-bold text-foreground">Máquinas Virtuais</p>
                  <p className="font-body text-xs text-muted-foreground">R$ {VM_PRICE.toLocaleString("pt-BR")}/mês cada</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setVms(Math.max(0, vms - 1))}
                  disabled={vms <= 0}
                  className="w-10 h-10 flex items-center justify-center border border-border text-muted-foreground hover:border-primary hover:text-primary transition-colors rounded disabled:opacity-30 disabled:cursor-not-allowed"
                  aria-label="Diminuir VMs"
                >
                  <Minus size={16} />
                </button>
                <span className="text-2xl font-bold text-primary w-8 text-center">{vms}</span>
                <button
                  onClick={() => setVms(vms + 1)}
                  className="w-10 h-10 flex items-center justify-center border border-border text-muted-foreground hover:border-primary hover:text-primary transition-colors rounded"
                  aria-label="Aumentar VMs"
                >
                  <Plus size={16} />
                </button>
              </div>
            </div>

            <div className="h-px bg-border" />

            {/* Summary */}
            <div className="space-y-2">
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
              <div className="h-px bg-border" />
              <div className="flex justify-between font-mono text-base font-bold">
                <span className="text-foreground">Mensalidade estimada</span>
                <span className="text-primary text-xl">R$ {totalMonthly.toLocaleString("pt-BR")}/mês</span>
              </div>
            </div>

            {/* Minimum term notice */}
            <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 text-center">
              <p className="font-mono text-xs text-primary font-bold">
                Contratação recorrente com permanência mínima de 12 meses
              </p>
            </div>

            {/* CTA */}
            <button
              onClick={handleContract}
              className="w-full inline-flex items-center justify-center gap-2 bg-primary text-primary-foreground px-8 py-4 font-mono text-sm font-bold uppercase tracking-wider hover:brightness-110 transition-all rounded"
            >
              <ArrowRight size={16} />
              Contratar Administração de Servidores
            </button>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default ServerAdminCalculator;
