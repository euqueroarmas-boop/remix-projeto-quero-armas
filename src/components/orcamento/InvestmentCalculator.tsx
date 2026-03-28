import { useState } from "react";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { Calculator, Server, Wifi, HardDrive } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { plans } from "./PlanSelector";

export interface Addons {
  serverMigration: boolean;
  remoteAccess: boolean;
  backup: boolean;
}

interface Props {
  selectedPlan: string;
  computersQty: number;
  setComputersQty: (n: number) => void;
  usersQty: number;
  setUsersQty: (n: number) => void;
  addons: Addons;
  setAddons: (a: Addons) => void;
}

const InvestmentCalculator = ({
  selectedPlan, computersQty, setComputersQty, usersQty, setUsersQty, addons, setAddons,
}: Props) => {
  const { t } = useTranslation();
  const [computersInput, setComputersInput] = useState(String(computersQty));
  const [usersInput, setUsersInput] = useState(String(usersQty));

  const plan = plans.find((p) => p.id === selectedPlan) || plans[1];
  const monthlyValue = plan.price * computersQty;
  const totalContractValue = monthlyValue * 36;

  const handleComputersChange = (val: string) => { setComputersInput(val); const num = parseInt(val); if (!isNaN(num) && num >= 1) setComputersQty(num); };
  const handleComputersBlur = () => { const num = parseInt(computersInput); const final = !isNaN(num) && num >= 1 ? Math.min(num, 500) : 1; setComputersQty(final); setComputersInput(String(final)); };
  const handleUsersChange = (val: string) => { setUsersInput(val); const num = parseInt(val); if (!isNaN(num) && num >= 1) setUsersQty(num); };
  const handleUsersBlur = () => { const num = parseInt(usersInput); const final = !isNaN(num) && num >= 1 ? Math.min(num, 500) : 1; setUsersQty(final); setUsersInput(String(final)); };

  return (
    <section id="calculator" className="py-20 bg-card">
      <div className="container mx-auto px-4">
        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-12">
          <span className="inline-block px-4 py-1.5 mb-4 text-xs font-semibold tracking-widest uppercase bg-primary/10 text-primary rounded-full border border-primary/20">
            {t("investCalc.tag")}
          </span>
          <h2 className="text-2xl md:text-4xl font-heading font-bold mb-3">
            {t("investCalc.title")} <span className="text-primary">{t("investCalc.titleHighlight")}</span>
          </h2>
        </motion.div>

        <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-8">
          <motion.div initial={{ opacity: 0, x: -20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} className="space-y-6 bg-background/50 border border-border rounded-xl p-6">
            <div>
              <Label className="text-sm font-medium mb-2 block">{t("investCalc.computers")}</Label>
              <Input type="number" min={1} max={500} value={computersInput} onChange={(e) => handleComputersChange(e.target.value)} onBlur={handleComputersBlur} className="h-12 bg-muted border-border text-lg" />
            </div>
            <div>
              <Label className="text-sm font-medium mb-2 block">{t("investCalc.users")}</Label>
              <Input type="number" min={1} max={500} value={usersInput} onChange={(e) => handleUsersChange(e.target.value)} onBlur={handleUsersBlur} className="h-12 bg-muted border-border text-lg" />
            </div>
            <div className="space-y-3 pt-2">
              <Label className="text-sm font-medium block">{t("investCalc.addons")}</Label>
              <label className="flex items-center gap-3 p-3 rounded-lg border border-border hover:border-primary/30 cursor-pointer transition-colors">
                <Checkbox checked={addons.serverMigration} onCheckedChange={(v) => setAddons({ ...addons, serverMigration: v === true })} />
                <Server className="w-4 h-4 text-primary" />
                <span className="text-sm">{t("investCalc.serverMigration")}</span>
              </label>
              <label className="flex items-center gap-3 p-3 rounded-lg border border-border hover:border-primary/30 cursor-pointer transition-colors">
                <Checkbox checked={addons.remoteAccess} onCheckedChange={(v) => setAddons({ ...addons, remoteAccess: v === true })} />
                <Wifi className="w-4 h-4 text-primary" />
                <span className="text-sm">{t("investCalc.remoteAccess")}</span>
              </label>
              <label className="flex items-center gap-3 p-3 rounded-lg border border-border hover:border-primary/30 cursor-pointer transition-colors">
                <Checkbox checked={addons.backup} onCheckedChange={(v) => setAddons({ ...addons, backup: v === true })} />
                <HardDrive className="w-4 h-4 text-primary" />
                <span className="text-sm">{t("investCalc.backup")}</span>
              </label>
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, x: 20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} className="flex items-center">
            <div className="w-full bg-gradient-to-br from-primary/10 via-card to-primary/5 border border-primary/20 rounded-2xl p-8 text-center">
              <Calculator className="w-10 h-10 text-primary mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-muted-foreground mb-2">{t("investCalc.estimateTitle")}</h3>
              <div className="mb-4">
                <p className="text-sm text-muted-foreground">
                  {computersQty} {computersQty > 1 ? t("investCalc.computerPlural") : t("investCalc.computer")} · {t("investCalc.config")}{" "}
                  <span className="text-primary font-medium">{plan.name}</span>
                </p>
              </div>
              <div className="text-5xl md:text-6xl font-heading font-bold text-primary mb-2">
                R${monthlyValue.toLocaleString("pt-BR")}
              </div>
              <p className="text-muted-foreground text-sm">{t("investCalc.perMonth")}</p>
              <p className="text-sm text-muted-foreground mt-3">
                {t("investCalc.totalEstimate")} <span className="font-semibold text-foreground">R${totalContractValue.toLocaleString("pt-BR")}</span> {t("investCalc.in36Months")}
              </p>

              {(addons.serverMigration || addons.remoteAccess || addons.backup) && (
                <div className="mt-6 pt-4 border-t border-border space-y-1">
                  <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider mb-2">{t("investCalc.recommended")}</p>
                  {addons.serverMigration && <p className="text-sm text-foreground/80">✓ {t("investCalc.serverMigrationShort")}</p>}
                  {addons.remoteAccess && <p className="text-sm text-foreground/80">✓ {t("investCalc.remoteAccessShort")}</p>}
                  {addons.backup && <p className="text-sm text-foreground/80">✓ {t("investCalc.backupShort")}</p>}
                </div>
              )}
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default InvestmentCalculator;
