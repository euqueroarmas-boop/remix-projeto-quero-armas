import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { Calculator, AlertTriangle, TrendingDown } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const CartorioDowntimeCalculator = () => {
  const { t } = useTranslation();
  const [dailyServices, setDailyServices] = useState(80);
  const [avgValue, setAvgValue] = useState(120);
  const [downtimeHours, setDowntimeHours] = useState(4);

  const result = useMemo(() => {
    const hourlyRevenue = (dailyServices * avgValue) / 8;
    const loss = hourlyRevenue * downtimeHours;
    const dailyLoss = dailyServices * avgValue;
    const weeklyLoss = loss * 2;
    return { hourlyLoss: hourlyRevenue, totalLoss: loss, dailyLoss, weeklyLoss };
  }, [dailyServices, avgValue, downtimeHours]);

  return (
    <section className="py-16 md:py-24 bg-card border-y border-border">
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-10"
        >
          <span className="inline-block px-4 py-1.5 mb-4 text-xs font-semibold tracking-widest uppercase bg-destructive/10 text-destructive rounded-full border border-destructive/20">
            <AlertTriangle className="inline w-3 h-3 mr-1 -mt-0.5" />
            {t("custom.cartorioCalc.tag")}
          </span>
          <h2 className="text-2xl md:text-4xl font-heading font-bold mb-3">
            {t("custom.cartorioCalc.title1")}
            <span className="text-destructive">{t("custom.cartorioCalc.titleHighlight")}</span>
            {t("custom.cartorioCalc.title2")}
          </h2>
          <p className="text-muted-foreground max-w-xl mx-auto">
            {t("custom.cartorioCalc.subtitle")}
          </p>
        </motion.div>

        <div className="max-w-3xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="bg-background border border-border rounded-2xl p-6 md:p-10"
          >
            <div className="grid md:grid-cols-3 gap-6 mb-8">
              <div>
                <label className="block text-sm font-medium mb-2">
                  {t("custom.cartorioCalc.fieldServices")}
                </label>
                <Input
                  type="number"
                  min={1}
                  value={dailyServices}
                  onChange={(e) => setDailyServices(Math.max(1, Number(e.target.value)))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">
                  {t("custom.cartorioCalc.fieldAvgValue")}
                </label>
                <Input
                  type="number"
                  min={1}
                  value={avgValue}
                  onChange={(e) => setAvgValue(Math.max(1, Number(e.target.value)))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">
                  {t("custom.cartorioCalc.fieldHours")}
                </label>
                <Input
                  type="number"
                  min={1}
                  max={24}
                  value={downtimeHours}
                  onChange={(e) => setDowntimeHours(Math.min(24, Math.max(1, Number(e.target.value))))}
                />
              </div>
            </div>

            {/* Results */}
            <div className="border-t border-border pt-6">
              <div className="grid md:grid-cols-3 gap-6 mb-6">
                <div className="text-center p-4 bg-destructive/5 rounded-xl border border-destructive/10">
                  <TrendingDown className="w-5 h-5 text-destructive mx-auto mb-2" />
                  <p className="text-xs text-muted-foreground mb-1">{t("custom.cartorioCalc.resultPerHour")}</p>
                  <p className="text-2xl font-heading font-bold text-destructive">
                    R$ {result.hourlyLoss.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}
                  </p>
                </div>
                <div className="text-center p-4 bg-destructive/5 rounded-xl border border-destructive/10">
                  <AlertTriangle className="w-5 h-5 text-destructive mx-auto mb-2" />
                  <p className="text-xs text-muted-foreground mb-1">
                    {t("custom.cartorioCalc.resultDowntime", { hours: downtimeHours })}
                  </p>
                  <p className="text-3xl font-heading font-bold text-destructive">
                    R$ {result.totalLoss.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}
                  </p>
                </div>
                <div className="text-center p-4 bg-destructive/5 rounded-xl border border-destructive/10">
                  <Calculator className="w-5 h-5 text-destructive mx-auto mb-2" />
                  <p className="text-xs text-muted-foreground mb-1">{t("custom.cartorioCalc.resultDaily")}</p>
                  <p className="text-2xl font-heading font-bold text-destructive">
                    R$ {result.dailyLoss.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}
                  </p>
                </div>
              </div>

              <div className="text-center">
                <p className="text-sm text-muted-foreground mb-4">
                  {t("custom.cartorioCalc.callout")}
                </p>
                <a
                  href={`https://wa.me/5511963166915?text=${encodeURIComponent(t("custom.cartorioCalc.whatsappMessage"))}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Button size="lg" className="font-bold">
                    {t("custom.cartorioCalc.cta")}
                  </Button>
                </a>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default CartorioDowntimeCalculator;
