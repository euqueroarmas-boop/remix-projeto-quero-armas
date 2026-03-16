import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Monitor, Cpu, HardDrive, MemoryStick, CheckCircle, ArrowRight, Pencil } from "lucide-react";
import type { Plan } from "./PlanSelector";

interface Props {
  open: boolean;
  onClose: () => void;
  onProceed: () => void;
  plan: Plan;
  computersQty: number;
  monthlyValue: number;
}

const BudgetPopup = ({ open, onClose, onProceed, plan, computersQty, monthlyValue }: Props) => {
  const totalContract = monthlyValue * 36;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg p-0 gap-0 bg-card border-border overflow-hidden">
        {/* Header */}
        <div className="bg-primary/5 border-b border-primary/10 px-6 py-5 text-center">
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-3">
            <Monitor className="w-6 h-6 text-primary" />
          </div>
          <h3 className="text-xl font-heading font-bold text-foreground">Orçamento Instantâneo</h3>
          <p className="text-sm text-muted-foreground mt-1">Confira os detalhes da sua configuração</p>
        </div>

        {/* Specs */}
        <div className="px-6 py-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 border border-border">
              <Cpu className="w-4 h-4 text-primary shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">Processador</p>
                <p className="text-sm font-semibold text-foreground">{plan.cpu}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 border border-border">
              <MemoryStick className="w-4 h-4 text-primary shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">Memória RAM</p>
                <p className="text-sm font-semibold text-foreground">{plan.ram}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 border border-border">
              <HardDrive className="w-4 h-4 text-primary shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">Armazenamento</p>
                <p className="text-sm font-semibold text-foreground">{plan.ssd}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 border border-border">
              <Monitor className="w-4 h-4 text-primary shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">Modelo</p>
                <p className="text-sm font-semibold text-foreground">Dell OptiPlex</p>
              </div>
            </div>
          </div>

          {/* Values */}
          <div className="bg-background border border-primary/20 rounded-xl p-4 space-y-3">
            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground">Quantidade de máquinas</span>
              <span className="font-semibold text-foreground">{computersQty}</span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground">Valor mensal por máquina</span>
              <span className="font-semibold text-foreground">R$ {plan.price.toLocaleString("pt-BR")},00</span>
            </div>
            <div className="flex justify-between items-center text-sm border-t border-border pt-3">
              <span className="font-semibold text-foreground">Valor total mensal</span>
              <span className="text-xl font-bold text-primary">R$ {monthlyValue.toLocaleString("pt-BR")},00</span>
            </div>
            <p className="text-xs text-muted-foreground">Prazo mínimo contratual: <strong>36 meses</strong></p>
          </div>

          {/* Included */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Incluído no contrato</p>
            {["Suporte técnico remoto e presencial", "Manutenção preventiva mensal", "Substituição imediata de equipamentos"].map((item) => (
              <div key={item} className="flex items-center gap-2 text-sm text-foreground">
                <CheckCircle className="w-3.5 h-3.5 text-primary shrink-0" />
                <span>{item}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border flex gap-3">
          <Button variant="outline" onClick={onClose} className="flex-1 h-12">
            <Pencil className="w-4 h-4 mr-2" />
            Editar configuração
          </Button>
          <Button onClick={onProceed} className="flex-1 h-12 bg-primary hover:bg-primary/90 text-primary-foreground">
            Prosseguir
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default BudgetPopup;
