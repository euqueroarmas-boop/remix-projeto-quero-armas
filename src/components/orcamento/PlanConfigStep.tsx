import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Clock, Shield, Check, BadgePercent } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  type ContractTerm,
  type PlanConfig,
  type PricingBreakdown,
  calculatePricing,
  getTermDiscount,
} from "@/lib/contractPricing";

interface Props {
  valorBase: number;
  onConfirm: (config: PlanConfig, pricing: PricingBreakdown) => void;
  initialConfig?: PlanConfig | null;
}

const TERMS: ContractTerm[] = [12, 24, 36];

const PlanConfigStep = ({ valorBase, onConfirm, initialConfig }: Props) => {
  const [selectedTerm, setSelectedTerm] = useState<ContractTerm | null>(
    initialConfig?.termMonths ?? null
  );
  const [support24h, setSupport24h] = useState(initialConfig?.support24h ?? false);

  useEffect(() => {
    if (initialConfig) {
      setSelectedTerm(initialConfig.termMonths);
      setSupport24h(initialConfig.support24h);
    }
  }, [initialConfig]);

  const pricing = selectedTerm
    ? calculatePricing(valorBase, { termMonths: selectedTerm, support24h })
    : null;

  const handleConfirm = () => {
    if (!selectedTerm || !pricing) return;
    onConfirm({ termMonths: selectedTerm, support24h }, pricing);
  };

  const formatCurrency = (v: number) =>
    `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <div className="space-y-6">
      <div>
        <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
          <Clock className="w-4 h-4 text-primary" />
          Prazo contratual
        </h4>
        <div className="grid grid-cols-3 gap-3">
          {TERMS.map((term) => {
            const discount = getTermDiscount(term);
            const isSelected = selectedTerm === term;
            return (
              <button
                key={term}
                type="button"
                onClick={() => setSelectedTerm(term)}
                className={`relative p-4 rounded-xl border-2 transition-all text-center ${
                  isSelected
                    ? "border-primary bg-primary/5 shadow-md"
                    : "border-border bg-card hover:border-primary/30"
                }`}
              >
                {discount > 0 && (
                  <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide bg-primary text-primary-foreground rounded-full whitespace-nowrap">
                    <BadgePercent className="w-3 h-3" />
                    {Math.round(discount * 100)}% OFF
                  </span>
                )}
                <p className="text-xl font-heading font-bold text-foreground mt-1">{term}</p>
                <p className="text-xs text-muted-foreground">meses</p>
                {isSelected && (
                  <Check className="absolute top-2 right-2 w-4 h-4 text-primary" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div
        className={`p-4 rounded-xl border-2 transition-all ${
          support24h ? "border-primary bg-primary/5" : "border-border bg-card"
        }`}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Shield className={`w-5 h-5 ${support24h ? "text-primary" : "text-muted-foreground"}`} />
            <div>
              <p className="text-sm font-semibold text-foreground">Suporte 24h</p>
              <p className="text-xs text-muted-foreground">
                Atendimento contínuo fora do horário comercial (+35%)
              </p>
            </div>
          </div>
          <Switch checked={support24h} onCheckedChange={setSupport24h} />
        </div>
      </div>

      {pricing && selectedTerm && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4"
        >
          {/* BLOCO 1 — VALOR BASE */}
          <div className="bg-card border border-border rounded-xl p-5 space-y-2">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Valor base do plano
            </h4>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Mensalidade base</span>
              <span className="text-foreground font-medium">{formatCurrency(pricing.valorBase)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Total base ({selectedTerm} meses)</span>
              <span className="text-foreground">{formatCurrency(pricing.valorBase * selectedTerm)}</span>
            </div>
          </div>

          {/* BLOCO 2 — DESCONTO */}
          {pricing.descontoPercentual > 0 && (
            <div className="bg-primary/5 border border-primary/20 rounded-xl p-5 space-y-2">
              <h4 className="text-xs font-semibold text-primary uppercase tracking-wide">
                Desconto por fidelidade ({Math.round(pricing.descontoPercentual * 100)}%)
              </h4>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Economia mensal</span>
                <span className="text-primary font-medium">
                  -{formatCurrency(pricing.valorBase - pricing.valorComDesconto)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Economia total ({selectedTerm} meses)</span>
                <span className="text-primary font-bold">
                  -{formatCurrency((pricing.valorBase - pricing.valorComDesconto) * selectedTerm)}
                </span>
              </div>
              <div className="flex justify-between text-sm border-t border-primary/10 pt-2">
                <span className="text-muted-foreground">Mensalidade com desconto</span>
                <span className="text-foreground font-medium">{formatCurrency(pricing.valorComDesconto)}</span>
              </div>
            </div>
          )}

          {/* BLOCO 3 — ADICIONAIS */}
          {pricing.support24h && (
            <div className="bg-card border border-border rounded-xl p-5 space-y-2">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Adicionais contratados
              </h4>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Suporte 24h (+35% sobre mensalidade)</span>
                <span className="text-foreground font-medium">+{formatCurrency(pricing.valorAdicional24h)}/mês</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Total adicional ({selectedTerm} meses)</span>
                <span className="text-foreground">+{formatCurrency(pricing.valorAdicional24h * selectedTerm)}</span>
              </div>
            </div>
          )}

          {/* BLOCO 4 — TOTAL FINAL */}
          <div className="bg-card border-2 border-primary rounded-xl p-5 space-y-3">
            <h4 className="text-xs font-semibold text-primary uppercase tracking-wide">
              Totais do contrato
            </h4>
            <div className="flex justify-between items-center">
              <span className="text-sm font-semibold text-foreground">Mensalidade final</span>
              <span className="text-2xl font-heading font-bold text-primary">
                {formatCurrency(pricing.valorFinalMensal)}
              </span>
            </div>
            <div className="flex justify-between text-sm border-t border-border pt-2">
              <span className="text-muted-foreground">Total do contrato ({selectedTerm} meses)</span>
              <span className="text-lg font-heading font-bold text-foreground">
                {formatCurrency(pricing.valorFinalMensal * selectedTerm)}
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground text-center pt-1">
              Contrato de {selectedTerm} meses com renovação automática
              {pricing.support24h ? " • Suporte 24h incluso" : ""}
            </p>
          </div>
        </motion.div>
      )}

      <Button
        onClick={handleConfirm}
        disabled={!selectedTerm}
        className="w-full h-14 text-base bg-primary hover:bg-primary/90 text-primary-foreground disabled:opacity-50"
      >
        Confirmar configuração e prosseguir
      </Button>
    </div>
  );
};

export default PlanConfigStep;
