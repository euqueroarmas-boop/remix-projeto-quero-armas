import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { Calculator, AlertTriangle, TrendingDown, Info } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { openWhatsApp } from "@/lib/whatsapp";

const HOURS_PER_DAY = 8;

const CartorioDowntimeCalculator = () => {
  const { t } = useTranslation();
  const [dailyServices, setDailyServices] = useState(80);
  const [avgValue, setAvgValue] = useState(120);
  const [downtimeHours, setDowntimeHours] = useState(4);

  const result = useMemo(() => {
    const dailyRevenue = dailyServices * avgValue;
    const hourlyRevenue = dailyRevenue / HOURS_PER_DAY;
    const totalLoss = hourlyRevenue * downtimeHours;
    return { hourlyLoss: hourlyRevenue, totalLoss, dailyRevenue };
  }, [dailyServices, avgValue, downtimeHours]);

  const exampleDaily = dailyServices * avgValue;
  const exampleHourly = exampleDaily / HOURS_PER_DAY;

  return (
    <section className="py-16 md:py-24 bg-card border-y border-border">
      <div className="container mx-auto px-4">
        <div className="text-center mb-10">

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
        </div>

        <div className="max-w-3xl mx-auto">
          <div className="bg-background border border-border rounded-2xl p-6 md:p-10">
            <div className="grid md:grid-cols-2 gap-6 mb-6">
              <div>
                <label className="block text-sm font-medium mb-2 text-foreground">
                  {t("custom.cartorioCalc.fieldServices")}
                </label>
                <Input
                  type="number"
                  min={1}
                  value={dailyServices}
                  onChange={(e) => setDailyServices(Math.max(1, Number(e.target.value)))}
                  className="bg-muted border-border text-foreground placeholder:text-muted-foreground"
                  placeholder="Ex: 80"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2 text-foreground">
                  {t("custom.cartorioCalc.fieldAvgValue")}
                </label>
                <Input
                  type="number"
                  min={1}
                  value={avgValue}
                  onChange={(e) => setAvgValue(Math.max(1, Number(e.target.value)))}
                  className="bg-muted border-border text-foreground placeholder:text-muted-foreground"
                  placeholder="Ex: 120"
                />
              </div>
            </div>

            {/* Slider for downtime hours */}
            <div className="mb-6">
              <label className="block text-sm font-medium mb-2 text-foreground">
                {t("custom.cartorioCalc.fieldHours")}
              </label>
              <div className="flex items-center gap-4">
                <Slider
                  value={[downtimeHours]}
                  onValueChange={(v) => setDowntimeHours(v[0])}
                  min={1}
                  max={HOURS_PER_DAY}
                  step={1}
                  className="flex-1"
                />
                <span className="text-lg font-heading font-bold text-foreground min-w-[3ch] text-center">
                  {downtimeHours}h
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                {t("custom.cartorioCalc.fieldHoursHelp")}
              </p>
            </div>

            {/* Example explanation */}
            <div className="bg-muted/50 border border-border rounded-lg p-4 mb-6 flex items-start gap-3">
              <Info className="w-4 h-4 text-primary mt-0.5 shrink-0" />
              <p className="text-xs text-muted-foreground leading-relaxed">
                {t("custom.cartorioCalc.example", {
                  services: dailyServices,
                  value: avgValue,
                  daily: exampleDaily.toLocaleString("pt-BR", { maximumFractionDigits: 0 }),
                  hourly: exampleHourly.toLocaleString("pt-BR", { maximumFractionDigits: 0 }),
                })}
              </p>
            </div>

            {/* Results */}
            <div className="border-t border-border pt-6">
              <div className="grid md:grid-cols-3 gap-6 mb-4">
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
                    R$ {result.dailyRevenue.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}
                  </p>
                </div>
              </div>

              <p className="text-xs text-muted-foreground text-center mb-6">
                {t("custom.cartorioCalc.disclaimer")}
              </p>

              <div className="text-center">
                <p className="text-sm text-muted-foreground mb-4">
                  {t("custom.cartorioCalc.callout")}
                </p>
                <a
                  href={whatsappLink(buildContextualWhatsAppMessage({ pageTitle: t("custom.cartorioCalc.title"), intent: "diagnosis" }))}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Button size="lg" className="font-bold btn-glow">
                    {t("custom.cartorioCalc.cta")}
                  </Button>
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default CartorioDowntimeCalculator;
