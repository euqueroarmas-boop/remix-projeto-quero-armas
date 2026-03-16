import { motion } from "framer-motion";
import { Monitor, CheckCircle, ArrowLeft, FileText, Loader2 } from "lucide-react";
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
  if (!visible) return null;

  const isRental = effectivePath === "locacao";

  return (
    <section className="py-16 bg-card">
      <div className="container mx-auto px-4">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-2xl mx-auto">
          <div className="text-center mb-8">
            <span className="inline-block px-4 py-1.5 mb-4 text-xs font-semibold tracking-widest uppercase bg-primary/10 text-primary rounded-full border border-primary/20">
              Resumo
            </span>
            <h2 className="text-2xl md:text-3xl font-heading font-bold">
              Resumo da <span className="text-primary">contratação</span>
            </h2>
          </div>

          <div className="bg-background border border-border rounded-2xl overflow-hidden">
            {/* Equipment section */}
            {isRental && (
              <div className="p-6 border-b border-border">
                <div className="flex items-center gap-3 mb-4">
                  <Monitor className="w-5 h-5 text-primary" />
                  <h3 className="font-heading font-bold text-foreground">Computadores alugados</h3>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Configuração</span>
                    <span className="font-semibold text-foreground">{plan.name} — {plan.cpu}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Memória / Armazenamento</span>
                    <span className="font-semibold text-foreground">{plan.ram} / {plan.ssd}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Quantidade</span>
                    <span className="font-semibold text-foreground">{computersQty} computador{computersQty > 1 ? "es" : ""}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Valor unitário mensal</span>
                    <span className="font-semibold text-foreground">R$ {plan.price.toLocaleString("pt-BR")},00</span>
                  </div>
                  <div className="flex justify-between border-t border-border pt-2">
                    <span className="font-semibold text-foreground">Valor total mensal</span>
                    <span className="text-lg font-bold text-primary">R$ {monthlyValue.toLocaleString("pt-BR")},00</span>
                  </div>
                </div>
              </div>
            )}

            {/* Support section */}
            {!isRental && (
              <div className="p-6 border-b border-border">
                <div className="flex items-center gap-3 mb-4">
                  <Monitor className="w-5 h-5 text-primary" />
                  <h3 className="font-heading font-bold text-foreground">Suporte mensal</h3>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Computadores</span>
                    <span className="font-semibold text-foreground">{computersQty}</span>
                  </div>
                  <div className="flex justify-between border-t border-border pt-2">
                    <span className="font-semibold text-foreground">Valor mensal</span>
                    <span className="text-lg font-bold text-primary">R$ {monthlyValue.toLocaleString("pt-BR")},00</span>
                  </div>
                </div>
              </div>
            )}

            {/* Services included */}
            <div className="p-6 border-b border-border">
              <h3 className="font-heading font-bold text-foreground mb-3">Serviços incluídos</h3>
              <div className="space-y-2">
                {[
                  "Suporte técnico remoto",
                  "Monitoramento de infraestrutura",
                  "Manutenção preventiva",
                  ...(isRental ? ["Substituição imediata de equipamentos"] : []),
                ].map((item) => (
                  <div key={item} className="flex items-center gap-2 text-sm text-foreground">
                    <CheckCircle className="w-4 h-4 text-primary shrink-0" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Term */}
            <div className="p-6 border-b border-border">
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">Prazo contratual</span>
                <span className="font-semibold text-foreground">36 meses (mínimo)</span>
              </div>
            </div>

            {/* Total */}
            <div className="p-6 bg-primary/5">
              <div className="flex justify-between items-center">
                <span className="font-heading font-bold text-foreground">Valor total mensal do contrato</span>
                <span className="text-2xl font-bold text-primary">R$ {monthlyValue.toLocaleString("pt-BR")},00</span>
              </div>
              {isRental && (
                <p className="text-xs text-muted-foreground mt-1 text-right">
                  Total em 36 meses: R$ {(monthlyValue * 36).toLocaleString("pt-BR")},00
                </p>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 mt-6">
            <Button variant="outline" onClick={onGoBack} className="flex-1 h-12">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Alterar pedido
            </Button>
            <Button onClick={onProceed} disabled={loading} className="flex-1 h-12 bg-primary hover:bg-primary/90 text-primary-foreground">
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <FileText className="w-4 h-4 mr-2" />
                  Gerar contrato e continuar
                </>
              )}
            </Button>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default BudgetSummaryScreen;
