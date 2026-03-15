import { useState } from "react";
import { motion } from "framer-motion";
import { FileText, CheckSquare, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { plans } from "./PlanSelector";

interface Props {
  visible: boolean;
  selectedPlan: string;
  computersQty: number;
  monthlyValue: number;
  companyName: string;
  onSign: () => Promise<void>;
  signed: boolean;
}

const generateContractText = (
  companyName: string,
  planName: string,
  computersQty: number,
  monthlyValue: number
) => `
CONTRATO DE LOCAÇÃO DE EQUIPAMENTOS DE INFORMÁTICA

CONTRATANTE: ${companyName || "[Nome da empresa]"}
CONTRATADA: WM Tecnologia da Informação LTDA

CLÁUSULA 1 — OBJETO
A CONTRATADA se compromete a fornecer ${computersQty} (${computersQty > 1 ? computersQty + " unidades" : "uma unidade"}) de computadores Dell OptiPlex — Plano ${planName}, incluindo monitor, teclado e mouse, bem como serviços de suporte técnico durante toda a vigência do contrato.

CLÁUSULA 2 — VALOR
O valor mensal da locação será de R$ ${monthlyValue.toLocaleString("pt-BR")},00 (${monthlyValue} reais), correspondente a R$ ${(monthlyValue / computersQty).toFixed(0)}/computador/mês.

CLÁUSULA 3 — SERVIÇOS INCLUSOS
- Active Directory e controle de usuários
- Backup automatizado a cada 30 minutos
- Suporte técnico durante vigência do contrato
- Manutenção preventiva e corretiva
- Reposição de equipamentos defeituosos

CLÁUSULA 4 — VIGÊNCIA
O contrato terá vigência mínima de 12 (doze) meses a partir da data de assinatura, podendo ser renovado automaticamente por períodos iguais.

CLÁUSULA 5 — RESCISÃO
Qualquer das partes poderá rescindir o contrato mediante aviso prévio de 30 (trinta) dias.
`.trim();

const ContractSection = ({
  visible,
  selectedPlan,
  computersQty,
  monthlyValue,
  companyName,
  onSign,
  signed,
}: Props) => {
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);

  if (!visible) return null;

  const plan = plans.find((p) => p.id === selectedPlan) || plans[1];
  const contractText = generateContractText(companyName, plan.name, computersQty, monthlyValue);

  const handleSign = async () => {
    setLoading(true);
    try {
      await onSign();
    } finally {
      setLoading(false);
    }
  };

  if (signed) {
    return (
      <section id="contract-section" className="py-16 bg-card">
        <div className="container mx-auto px-4 text-center">
          <div className="max-w-md mx-auto bg-background border border-primary/20 rounded-2xl p-8">
            <CheckSquare className="w-12 h-12 text-primary mx-auto mb-4" />
            <h3 className="text-xl font-heading font-bold mb-2">Contrato assinado!</h3>
            <p className="text-muted-foreground text-sm">
              A confirmação será enviada ao seu e-mail.
            </p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="py-20 bg-card">
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-10"
        >
          <span className="inline-block px-4 py-1.5 mb-4 text-xs font-semibold tracking-widest uppercase bg-primary/10 text-primary rounded-full border border-primary/20">
            Contrato
          </span>
          <h2 className="text-2xl md:text-4xl font-heading font-bold mb-3">
            Preparação do <span className="text-primary">contrato</span>
          </h2>
        </motion.div>

        <div className="max-w-3xl mx-auto">
          <div className="bg-background border border-border rounded-xl p-6 mb-6 max-h-80 overflow-y-auto">
            <div className="flex items-center gap-2 mb-4">
              <FileText className="w-5 h-5 text-primary" />
              <span className="font-semibold text-sm">Prévia do contrato</span>
            </div>
            <pre className="text-sm text-foreground/80 whitespace-pre-wrap font-body leading-relaxed">
              {contractText}
            </pre>
          </div>

          <label className="flex items-start gap-3 mb-6 cursor-pointer">
            <Checkbox
              checked={agreed}
              onCheckedChange={(v) => setAgreed(v === true)}
              className="mt-0.5"
            />
            <span className="text-sm text-foreground/80">
              Declaro que li e concordo com os termos do contrato de locação de equipamentos.
            </span>
          </label>

          <Button
            onClick={handleSign}
            disabled={!agreed || loading}
            className="w-full h-14 text-base bg-primary hover:bg-primary/90 text-primary-foreground disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin mr-2" />
            ) : (
              <CheckSquare className="w-5 h-5 mr-2" />
            )}
            Assinar contrato digitalmente
          </Button>
        </div>
      </div>
    </section>
  );
};

export default ContractSection;
