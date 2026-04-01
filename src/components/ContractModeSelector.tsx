import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import { Clock, CalendarCheck, CheckCircle2, ArrowRight } from "lucide-react";

export type ContractMode = "sob_demanda" | "recorrente";
export type AllowedModes = "both" | "sob_demanda_only" | "recorrente_only";

interface Props {
  mode: ContractMode | null;
  onSelect: (mode: ContractMode) => void;
  allowedModes?: AllowedModes;
}

const options = [
  {
    id: "sob_demanda" as ContractMode,
    icon: Clock,
    titleKey: "contractMode.sobDemandaTitle",
    titleFallback: "Sob demanda / por hora",
    microKey: "contractMode.sobDemandaMicro",
    microFallback: "Para urgências, correções pontuais e suporte imediato.",
    continueTitleKey: "contractMode.sobDemandaContinueTitle",
    continueTitleFallback: "Seu servidor precisa voltar a operar sem erro e sem improviso",
    continueTextKey: "contractMode.sobDemandaContinueText",
    continueTextFallback: "Quando um servidor falha, o problema não é técnico apenas — ele trava operação, acesso, arquivos e produtividade. O atendimento sob demanda é para quem precisa resolver agora, com rapidez e critério técnico.",
    ctaKey: "contractMode.sobDemandaCta",
    ctaFallback: "Continuar com atendimento por hora",
  },
  {
    id: "recorrente" as ContractMode,
    icon: CalendarCheck,
    titleKey: "contractMode.recorrenteTitle",
    titleFallback: "Plano mensal / recorrente",
    microKey: "contractMode.recorrenteMicro",
    microFallback: "Para monitoramento, prevenção e suporte contínuo.",
    continueTitleKey: "contractMode.recorrenteContinueTitle",
    continueTitleFallback: "Evite que seu servidor pare quando sua empresa mais precisa",
    continueTextKey: "contractMode.recorrenteContinueText",
    continueTextFallback: "A maioria das empresas só percebe a importância da administração de servidores depois da queda, da lentidão ou da perda. O plano recorrente existe para prevenir falhas, manter estabilidade e reduzir risco operacional.",
    ctaKey: "contractMode.recorrenteCta",
    ctaFallback: "Continuar com plano mensal",
  },
];

const ContractModeSelector = ({ mode, onSelect, allowedModes = "both" }: Props) => {
  const { t } = useTranslation();
  const [confirmed, setConfirmed] = useState(false);

  useEffect(() => {
    if (allowedModes === "sob_demanda_only" && !mode) onSelect("sob_demanda");
    if (allowedModes === "recorrente_only" && !mode) onSelect("recorrente");
  }, [allowedModes, mode, onSelect]);

  if (allowedModes === "sob_demanda_only" || allowedModes === "recorrente_only") {
    return null;
  }

  const selectedOpt = options.find((o) => o.id === mode);

  const handleSelect = (id: ContractMode) => {
    setConfirmed(false);
    onSelect(id);
  };

  const handleContinue = () => {
    setConfirmed(true);
  };

  if (confirmed && mode) return null;

  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="py-8 md:py-12"
    >
      <div className="container max-w-2xl mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-6">
          <p className="font-mono text-[10px] tracking-[0.3em] uppercase text-primary mb-2">
            {t("contractMode.tag", "Modelo de contratação")}
          </p>
          <h2 className="text-lg md:text-2xl font-bold text-foreground mb-1.5">
            {t("contractMode.titleV2", "Escolha como deseja contratar")}
          </h2>
          <p className="text-xs md:text-sm text-muted-foreground max-w-md mx-auto leading-relaxed">
            {t("contractMode.subtitleV2", "Se precisa resolver uma urgência, siga pelo atendimento sob demanda. Se quer estabilidade e suporte contínuo, escolha o plano mensal.")}
          </p>
        </div>

        {/* Selector */}
        <div className="flex flex-col gap-2.5">
          {options.map((opt) => {
            const isActive = mode === opt.id;
            const isOther = mode !== null && !isActive;
            const Icon = opt.icon;

            return (
              <motion.button
                key={opt.id}
                onClick={() => handleSelect(opt.id)}
                layout
                transition={{ duration: 0.25 }}
                className={`relative flex items-center gap-3.5 rounded-xl border px-4 py-3.5 md:px-5 md:py-4 text-left cursor-pointer transition-all duration-300 ${
                  isActive
                    ? "border-primary bg-primary/5 shadow-[0_0_20px_-6px_hsl(var(--primary)/0.25)]"
                    : isOther
                    ? "border-border/50 bg-card/50 opacity-60 hover:opacity-80"
                    : "border-border bg-card hover:border-primary/30"
                }`}
              >
                {/* Icon */}
                <div
                  className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                    isActive ? "bg-primary/15" : "bg-muted"
                  }`}
                >
                  <Icon
                    className={`w-4 h-4 ${
                      isActive ? "text-primary" : "text-muted-foreground"
                    }`}
                  />
                </div>

                {/* Text */}
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm md:text-base font-semibold text-foreground leading-tight">
                    {t(opt.titleKey, opt.titleFallback)}
                  </h3>
                  <p className="text-[11px] md:text-xs text-muted-foreground mt-0.5 leading-snug">
                    {t(opt.microKey, opt.microFallback)}
                  </p>
                </div>

                {/* Check */}
                {isActive && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="shrink-0"
                  >
                    <CheckCircle2 className="w-5 h-5 text-primary" />
                  </motion.div>
                )}
              </motion.button>
            );
          })}
        </div>

        {/* Continue block after selection */}
        <AnimatePresence mode="wait">
          {selectedOpt && !confirmed && (
            <motion.div
              key={selectedOpt.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.3, delay: 0.1 }}
              className="mt-5 rounded-xl border border-border/60 bg-card/80 backdrop-blur-sm p-5 md:p-6"
            >
              <h3 className="text-sm md:text-base font-bold text-foreground mb-2 leading-snug">
                {t(selectedOpt.continueTitleKey, selectedOpt.continueTitleFallback)}
              </h3>
              <p className="text-xs md:text-sm text-muted-foreground leading-relaxed mb-4">
                {t(selectedOpt.continueTextKey, selectedOpt.continueTextFallback)}
              </p>
              <button
                onClick={handleContinue}
                className="inline-flex items-center gap-2 bg-primary text-primary-foreground text-sm font-semibold px-5 py-2.5 rounded-lg hover:bg-primary/90 transition-colors"
              >
                {t(selectedOpt.ctaKey, selectedOpt.ctaFallback)}
                <ArrowRight className="w-4 h-4" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.section>
  );
};

export default ContractModeSelector;
