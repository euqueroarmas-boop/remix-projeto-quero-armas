import { useState } from "react";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { Minus, Plus, Clock, TrendingDown } from "lucide-react";
import { Link } from "react-router-dom";
import { generatePriceTable } from "@/data/servicePricingCatalog";

const fadeIn = {
  initial: { opacity: 0, y: 20 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true as const },
  transition: { duration: 0.5 },
};

interface HoursCalculatorProps {
  serviceName?: string;
  contractHref?: string;
  /** Base price per hour (default: R$200) */
  basePrice?: number;
  /** Whether progressive discount applies */
  hasProgressiveDiscount?: boolean;
  /** Max discount percentage (default: 27.5) */
  maxDiscountPercent?: number;
}

const HoursCalculator = ({
  serviceName,
  contractHref,
  basePrice = 200,
  hasProgressiveDiscount = true,
  maxDiscountPercent = 27.5,
}: HoursCalculatorProps) => {
  const { t } = useTranslation();
  const [hours, setHours] = useState(1);

  const priceTable = generatePriceTable(basePrice, hasProgressiveDiscount, maxDiscountPercent);

  const unitPrice = priceTable[Math.min(hours, 8)] ?? priceTable[8];
  const fullPrice = hours * basePrice;
  const promoPrice = Math.round(hours * unitPrice * 100) / 100;
  const savings = Math.round((fullPrice - promoPrice) * 100) / 100;
  const discountPct = hours > 1 && hasProgressiveDiscount
    ? Math.round(((basePrice - unitPrice) / basePrice) * 100)
    : 0;

  const formatCurrency = (val: number) =>
    val % 1 === 0
      ? `R$ ${val.toLocaleString("pt-BR")},00`
      : `R$ ${val.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <section className="section-dark py-16 md:py-24" data-section-type="calculator">
      <div className="container max-w-3xl">
        <motion.div {...fadeIn}>
          <p className="font-mono text-xs tracking-[0.3em] uppercase text-primary mb-4">
            {t("hoursCalc.tag")}
          </p>
          <h2 className="text-2xl md:text-4xl mb-2">
            {t("hoursCalc.title")} <span className="text-primary">{t("hoursCalc.titleHighlight")}</span>
          </h2>
          <p className="font-body text-muted-foreground mb-2 leading-relaxed">
            {serviceName
              ? `Calcule o investimento para ${serviceName}.`
              : t("hoursCalc.desc")}
          </p>
          {hasProgressiveDiscount && (
            <p className="font-body text-sm text-muted-foreground/70 mb-10 leading-relaxed">
              {t("hoursCalc.desc2")}
            </p>
          )}
          {!hasProgressiveDiscount && (
            <p className="font-body text-sm text-muted-foreground/70 mb-10 leading-relaxed">
              Valor fixo por hora técnica — sem variação de preço por volume.
            </p>
          )}

          <div className="bg-secondary p-8 mb-6">
            <div className="flex items-center justify-center gap-6 mb-6">
              <button
                onClick={() => setHours(Math.max(1, hours - 1))}
                className="w-12 h-12 flex items-center justify-center border border-muted-foreground/30 text-muted-foreground hover:border-primary hover:text-primary transition-colors"
                aria-label={t("hoursCalc.decreaseHours")}
              >
                <Minus size={20} />
              </button>
              <div className="text-center">
                <span className="text-5xl font-bold text-primary">{hours}</span>
                <p className="font-mono text-xs text-muted-foreground mt-1">
                  {hours > 1 ? t("hoursCalc.hours") : t("hoursCalc.hour")}{" "}
                  {hours > 1 ? t("hoursCalc.technicals") : t("hoursCalc.technical")}
                </p>
              </div>
              <button
                onClick={() => setHours(Math.min(8, hours + 1))}
                className="w-12 h-12 flex items-center justify-center border border-muted-foreground/30 text-muted-foreground hover:border-primary hover:text-primary transition-colors"
                aria-label={t("hoursCalc.increaseHours")}
              >
                <Plus size={20} />
              </button>
            </div>

            <div className="space-y-3 mb-6">
              <div className="flex items-center justify-between font-mono text-sm">
                <span className="flex items-center gap-2 text-muted-foreground">
                  <Clock size={14} /> {t("hoursCalc.pricePerHour")}
                </span>
                <span className="text-foreground">
                  {formatCurrency(unitPrice)}
                  {discountPct > 0 && (
                    <span className="ml-2 text-xs text-primary">-{discountPct}%</span>
                  )}
                </span>
              </div>

              {hasProgressiveDiscount && savings > 0 && (
                <div className="flex items-center justify-between font-mono text-sm">
                  <span className="text-muted-foreground">{t("hoursCalc.fullPrice")}</span>
                  <span className="text-muted-foreground/50 line-through">
                    {formatCurrency(fullPrice)}
                  </span>
                </div>
              )}

              <div className="h-px bg-muted-foreground/10" />

              <div className="flex items-center justify-between font-mono text-base font-bold">
                <span className="text-foreground">{t("hoursCalc.promoPrice")}</span>
                <span className="text-primary text-xl">
                  {formatCurrency(promoPrice)}
                </span>
              </div>
            </div>

            {savings > 0 && hasProgressiveDiscount && (
              <div className="bg-primary/10 border border-primary/30 p-4 flex items-center gap-3">
                <TrendingDown size={20} className="text-primary shrink-0" />
                <p className="font-mono text-sm font-bold text-primary">
                  {t("hoursCalc.saving")} {formatCurrency(savings)}
                </p>
              </div>
            )}
          </div>

          {hasProgressiveDiscount && (
            <details className="bg-secondary mb-6 group">
              <summary className="p-4 cursor-pointer font-mono text-xs uppercase tracking-wider text-muted-foreground hover:text-primary transition-colors flex justify-between items-center">
                {t("hoursCalc.discountTable")}
                <Plus size={14} className="text-primary group-open:rotate-45 transition-transform" />
              </summary>
              <div className="px-4 pb-4">
                <div className="grid grid-cols-3 gap-px text-xs font-mono">
                  <div className="bg-secondary p-2 text-muted-foreground/50">{t("hoursCalc.colHours")}</div>
                  <div className="bg-secondary p-2 text-muted-foreground/50">{t("hoursCalc.colPerHour")}</div>
                  <div className="bg-secondary p-2 text-muted-foreground/50">{t("hoursCalc.colTotal")}</div>
                  {Object.entries(priceTable).map(([h, price]) => (
                    <div key={h} className={`contents ${Number(h) === hours ? "[&>div]:text-primary [&>div]:font-bold" : ""}`}>
                      <div className="bg-secondary/50 p-2 text-muted-foreground">{h}h</div>
                      <div className="bg-secondary/50 p-2 text-muted-foreground">{formatCurrency(price)}</div>
                      <div className="bg-secondary/50 p-2 text-muted-foreground">{formatCurrency(Number(h) * price)}</div>
                    </div>
                  ))}
                </div>
              </div>
            </details>
          )}

          <Link
            to={contractHref
              ? `${contractHref}?modo=sob_demanda&horas=${hours}&valor=${promoPrice}&source=service_calculator`
              : `/orcamento-ti?servico=${encodeURIComponent(serviceName || "Horas Técnicas")}&horas=${hours}&valor=${promoPrice}&source=service_calculator`
            }
            onClick={() => console.log("[WMTi] CHECKOUT_REDIRECT_AVULSO", { contractHref, hours, promoPrice, serviceName })}
            className="w-full inline-flex items-center justify-center gap-2 bg-primary text-primary-foreground px-8 py-4 font-mono text-sm font-bold uppercase tracking-wider hover:brightness-110 transition-all mb-3"
          >
            {t("hoursCalc.buyHours", "COMPRAR AGORA")}
          </Link>
          <p className="font-body text-xs text-center text-muted-foreground/60">
            {t("hoursCalc.buyDesc")}
          </p>
        </motion.div>
      </div>
    </section>
  );
};

export default HoursCalculator;
