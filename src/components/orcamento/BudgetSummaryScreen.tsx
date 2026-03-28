import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { Monitor, CheckCircle, ArrowLeft, FileText, Loader2, ClipboardList } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Plan } from "./PlanSelector";
import type { QualificationData } from "./QualificationForm";

interface Props {
  visible: boolean;
  effectivePath: "locacao" | "suporte" | null;
  plan: Plan;
  qualification: QualificationData | null;
  computersQty: number;
  monthlyValue: number;
  onGoBack: () => void;
  onProceed: () => void;
  loading: boolean;
}

const BudgetSummaryScreen = ({ visible, effectivePath, plan, qualification, computersQty, monthlyValue, onGoBack, onProceed, loading }: Props) => {
  const { t } = useTranslation();

  if (!visible) return null;

  const isRental = effectivePath === "locacao";

  const summaryLabels = t("qualification.summaryLabels", { returnObjects: true }) as Record<string, string>;

  const qItems: { label: string; value: string }[] = [];
  if (qualification) {
    const q = qualification;
    if (q.segment) qItems.push({ label: summaryLabels.segment, value: q.segment });
    if (q.employeesRange) qItems.push({ label: summaryLabels.employees, value: q.employeesRange });
    if (q.dailyUsers) qItems.push({ label: summaryLabels.dailyUsers, value: String(q.dailyUsers) });
    if (q.computersQty) qItems.push({ label: summaryLabels.computers, value: String(q.computersQty) });
    if (q.equipmentType) qItems.push({ label: summaryLabels.equipmentType, value: q.equipmentType });
    if (q.includeMonitor) qItems.push({ label: summaryLabels.includeMonitor, value: q.includeMonitor });
    if (q.activities?.length) qItems.push({ label: summaryLabels.activities, value: q.activities.join(", ") });
    if (q.manyTabs) qItems.push({ label: summaryLabels.manyTabs, value: q.manyTabs });
    if (q.hasServer) qItems.push({ label: summaryLabels.hasServer, value: q.hasServer });
    if (q.hasFirewall) qItems.push({ label: summaryLabels.hasFirewall, value: q.hasFirewall });
    if (q.hasAutomaticBackup) qItems.push({ label: summaryLabels.hasBackup, value: q.hasAutomaticBackup });
    if (q.hasInternalTech) qItems.push({ label: summaryLabels.hasInternalTech, value: q.hasInternalTech });
    if (q.problemFrequency) qItems.push({ label: summaryLabels.problemFrequency, value: q.problemFrequency });
    if (q.growthForecast) qItems.push({ label: summaryLabels.growthForecast, value: q.growthForecast });
    if (q.companyName) qItems.push({ label: summaryLabels.company, value: q.companyName });
    if (q.contactEmail) qItems.push({ label: summaryLabels.email, value: q.contactEmail });
    if (q.contactPhone) qItems.push({ label: summaryLabels.phone, value: q.contactPhone });
    if (q.city) qItems.push({ label: summaryLabels.city, value: `${q.city}${q.state ? `/${q.state}` : ""}` });
  }

  return (
    <section className="py-16 bg-card">
      <div className="container mx-auto px-4">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-2xl mx-auto">
          <div className="text-center mb-8">
            <span className="inline-block px-4 py-1.5 mb-4 text-xs font-semibold tracking-widest uppercase bg-primary/10 text-primary rounded-full border border-primary/20">
              {t("budgetSummary.tag")}
            </span>
            <h2 className="text-2xl md:text-3xl font-heading font-bold">
              {t("budgetSummary.title")} <span className="text-primary">{t("budgetSummary.titleHighlight")}</span>
            </h2>
          </div>

          <div className="bg-background border border-border rounded-2xl overflow-hidden">
            {qItems.length > 0 && (
              <div className="p-6 border-b border-border">
                <div className="flex items-center gap-3 mb-4">
                  <ClipboardList className="w-5 h-5 text-primary" />
                  <h3 className="font-heading font-bold text-foreground">{t("budgetSummary.formAnswers")}</h3>
                </div>
                <div className="space-y-2 text-sm">
                  {qItems.map((item) => (
                    <div key={item.label} className="flex justify-between gap-4">
                      <span className="text-muted-foreground shrink-0">{item.label}</span>
                      <span className="font-semibold text-foreground text-right">{item.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {isRental && (
              <div className="p-6 border-b border-border">
                <div className="flex items-center gap-3 mb-4">
                  <Monitor className="w-5 h-5 text-primary" />
                  <h3 className="font-heading font-bold text-foreground">{t("budgetSummary.selectedConfig")}</h3>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">{t("budgetSummary.config")}</span><span className="font-semibold text-foreground">{plan.name} — {plan.cpu}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">{t("budgetSummary.memoryStorage")}</span><span className="font-semibold text-foreground">{plan.ram} / {plan.ssd}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">{t("budgetSummary.quantity")}</span><span className="font-semibold text-foreground">{computersQty} {computersQty > 1 ? t("investCalc.computerPlural") : t("investCalc.computer")}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">{t("budgetSummary.unitMonthly")}</span><span className="font-semibold text-foreground">R$ {plan.price.toLocaleString("pt-BR")},00</span></div>
                  <div className="flex justify-between border-t border-border pt-2"><span className="font-semibold text-foreground">{t("budgetSummary.totalMonthly")}</span><span className="text-lg font-bold text-primary">R$ {monthlyValue.toLocaleString("pt-BR")},00</span></div>
                </div>
              </div>
            )}

            {!isRental && (
              <div className="p-6 border-b border-border">
                <div className="flex items-center gap-3 mb-4">
                  <Monitor className="w-5 h-5 text-primary" />
                  <h3 className="font-heading font-bold text-foreground">{t("budgetSummary.monthlySupport")}</h3>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">{t("budgetSummary.computers")}</span><span className="font-semibold text-foreground">{computersQty}</span></div>
                  <div className="flex justify-between border-t border-border pt-2"><span className="font-semibold text-foreground">{t("budgetSummary.monthlyValue")}</span><span className="text-lg font-bold text-primary">R$ {monthlyValue.toLocaleString("pt-BR")},00</span></div>
                </div>
              </div>
            )}

            <div className="p-6 border-b border-border">
              <h3 className="font-heading font-bold text-foreground mb-3">{t("budgetSummary.includedServices")}</h3>
              <div className="space-y-2">
                {[
                  t("budgetSummary.remoteSupport"),
                  t("budgetSummary.monitoring"),
                  t("budgetSummary.preventive"),
                  ...(isRental ? [t("budgetSummary.equipmentReplacement")] : []),
                ].map((item) => (
                  <div key={item} className="flex items-center gap-2 text-sm text-foreground">
                    <CheckCircle className="w-4 h-4 text-primary shrink-0" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-6 border-b border-border">
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">{t("budgetSummary.contractTerm")}</span>
                <span className="font-semibold text-foreground">{t("budgetSummary.term36")}</span>
              </div>
            </div>

            <div className="p-6 bg-primary/5">
              <div className="flex justify-between items-center">
                <span className="font-heading font-bold text-foreground">{t("budgetSummary.totalContractMonthly")}</span>
                <span className="text-2xl font-bold text-primary">R$ {monthlyValue.toLocaleString("pt-BR")},00</span>
              </div>
              {isRental && (
                <p className="text-xs text-muted-foreground mt-1 text-right">
                  {t("budgetSummary.totalIn36")} R$ {(monthlyValue * 36).toLocaleString("pt-BR")},00
                </p>
              )}
            </div>
          </div>

          <div className="flex gap-3 mt-6">
            <Button variant="outline" onClick={onGoBack} className="flex-1 h-12">
              <ArrowLeft className="w-4 h-4 mr-2" />
              {t("budgetSummary.changeOrder")}
            </Button>
            <Button onClick={onProceed} disabled={loading} className="flex-1 h-12 bg-primary hover:bg-primary/90 text-primary-foreground">
              {loading ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />{t("budgetSummary.saving")}</>
              ) : (
                <><FileText className="w-4 h-4 mr-2" />{t("budgetSummary.generateContract")}</>
              )}
            </Button>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default BudgetSummaryScreen;
