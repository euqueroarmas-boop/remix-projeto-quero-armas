import { useState } from "react";
import { motion } from "framer-motion";
import {
  Monitor, Clock, Cpu, Server, Wrench,
  AlertTriangle, HardDrive, Wifi, Users, ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

export interface QualificationData {
  computersQty: number;
  averageAge: string; // "0-2" | "3-4" | "5+"
  isMinCoreI3: boolean;
  serversQty: number;
  frequentMaintenance: boolean;
  downtimeImpact: boolean;
  needsBackup: boolean;
  needsRemoteAccess: boolean;
  needsActiveDirectory: boolean;
}

interface Props {
  onComplete: (data: QualificationData) => void;
  completed: boolean;
  data: QualificationData | null;
}

type StepType = "number" | "radio" | "boolean";

interface Step {
  icon: React.ElementType;
  question: string;
  field: keyof QualificationData;
  type: StepType;
  options?: { value: string; label: string }[];
}

const steps: Step[] = [
  {
    icon: Monitor,
    question: "Quantos computadores existem hoje na empresa?",
    field: "computersQty",
    type: "number",
  },
  {
    icon: Clock,
    question: "Qual a idade média dos computadores?",
    field: "averageAge",
    type: "radio",
    options: [
      { value: "0-2", label: "Menos de 2 anos" },
      { value: "3-4", label: "3 a 4 anos" },
      { value: "5+", label: "Mais de 4 anos" },
    ],
  },
  {
    icon: Cpu,
    question: "Os computadores são no mínimo Core i3?",
    field: "isMinCoreI3",
    type: "boolean",
  },
  {
    icon: Server,
    question: "Quantos servidores Windows Server existem?",
    field: "serversQty",
    type: "number",
  },
  {
    icon: Wrench,
    question: "Sua empresa gasta frequentemente com manutenção?",
    field: "frequentMaintenance",
    type: "boolean",
  },
  {
    icon: AlertTriangle,
    question: "Quando um computador para, isso afeta a operação?",
    field: "downtimeImpact",
    type: "boolean",
  },
  {
    icon: HardDrive,
    question: "Existe necessidade de backup?",
    field: "needsBackup",
    type: "boolean",
  },
  {
    icon: Wifi,
    question: "Existe necessidade de acesso remoto?",
    field: "needsRemoteAccess",
    type: "boolean",
  },
  {
    icon: Users,
    question: "Existe necessidade de Active Directory, usuários por departamento ou GPOs?",
    field: "needsActiveDirectory",
    type: "boolean",
  },
];

const QualificationForm = ({ onComplete, completed, data: completedData }: Props) => {
  const [step, setStep] = useState(0);
  const [data, setData] = useState<QualificationData>({
    computersQty: 5,
    averageAge: "3-4",
    isMinCoreI3: true,
    serversQty: 0,
    frequentMaintenance: false,
    downtimeImpact: true,
    needsBackup: true,
    needsRemoteAccess: false,
    needsActiveDirectory: false,
  });
  const [numberInput, setNumberInput] = useState("5");

  const currentStep = steps[step];

  const handleNext = () => {
    let nextData = data;

    if (currentStep.type === "number") {
      const num = parseInt(numberInput);
      const final = !isNaN(num) && num >= 0 ? Math.min(num, 500) : (currentStep.field === "serversQty" ? 0 : 1);
      nextData = { ...data, [currentStep.field]: final };
      setData(nextData);
      setNumberInput(String(final));
    }

    if (step < steps.length - 1) {
      setStep(step + 1);
      // Pre-fill number input for next step
      const nextStep = steps[step + 1];
      if (nextStep.type === "number") {
        setNumberInput(String(nextData[nextStep.field] ?? 0));
      }
    } else {
      onComplete(nextData);
    }
  };

  if (completed && completedData) {
    const ageLabel = completedData.averageAge === "0-2" ? "< 2 anos" : completedData.averageAge === "3-4" ? "3–4 anos" : "> 4 anos";
    return (
      <section id="qualification" className="py-16 section-dark">
        <div className="container mx-auto px-4">
          <div className="max-w-2xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 text-primary rounded-full mb-4">
              <Monitor className="w-4 h-4" />
              <span className="text-sm font-semibold">Diagnóstico concluído</span>
            </div>
            <p className="text-muted-foreground text-sm">
              {completedData.computersQty} computadores · Idade: {ageLabel} ·{" "}
              {completedData.serversQty} servidor(es) · Core i3+: {completedData.isMinCoreI3 ? "Sim" : "Não"}
            </p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section id="qualification" className="py-20 bg-card">
      <div className="container mx-auto px-4">
        <div className="max-w-2xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-10"
          >
            <span className="inline-block px-4 py-1.5 mb-4 text-xs font-semibold tracking-widest uppercase bg-primary/10 text-primary rounded-full border border-primary/20">
              Qualificação
            </span>
            <h2 className="text-2xl md:text-4xl font-heading font-bold mb-3">
              Conte-nos sobre sua <span className="text-primary">infraestrutura</span>
            </h2>
            <p className="text-muted-foreground">
              Responda {steps.length} perguntas rápidas para um orçamento personalizado.
            </p>
          </motion.div>

          {/* Progress */}
          <div className="flex gap-1.5 mb-8">
            {steps.map((_, i) => (
              <div
                key={i}
                className={`h-1.5 flex-1 rounded-full transition-colors ${
                  i <= step ? "bg-primary" : "bg-muted"
                }`}
              />
            ))}
          </div>

          <motion.div
            key={step}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3 }}
            className="bg-background/50 border border-border rounded-xl p-8"
          >
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <currentStep.icon className="w-5 h-5 text-primary" />
              </div>
              <h3 className="text-lg font-semibold">{currentStep.question}</h3>
            </div>

            {currentStep.type === "number" && (
              <Input
                type="text"
                inputMode="numeric"
                value={numberInput}
                onChange={(e) => setNumberInput(e.target.value.replace(/[^0-9]/g, ""))}
                onBlur={() => {
                  const num = parseInt(numberInput);
                  if (!isNaN(num) && num >= 0) {
                    setData({ ...data, [currentStep.field]: Math.min(num, 500) });
                  }
                }}
                className="text-lg h-14 bg-muted border-border"
                placeholder="Digite o número"
              />
            )}

            {currentStep.type === "radio" && currentStep.options && (
              <RadioGroup
                value={String(data[currentStep.field])}
                onValueChange={(v) => setData({ ...data, [currentStep.field]: v })}
                className="space-y-3"
              >
                {currentStep.options.map((opt) => (
                  <Label
                    key={opt.value}
                    className="flex items-center gap-3 p-4 rounded-lg border border-border hover:border-primary/50 cursor-pointer transition-colors"
                  >
                    <RadioGroupItem value={opt.value} />
                    <span>{opt.label}</span>
                  </Label>
                ))}
              </RadioGroup>
            )}

            {currentStep.type === "boolean" && (
              <div className="flex gap-4">
                {[true, false].map((val) => (
                  <button
                    key={String(val)}
                    onClick={() => setData({ ...data, [currentStep.field]: val })}
                    className={`flex-1 p-4 rounded-lg border text-center font-medium transition-colors ${
                      data[currentStep.field] === val
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border hover:border-primary/30 text-foreground"
                    }`}
                  >
                    {val ? "Sim" : "Não"}
                  </button>
                ))}
              </div>
            )}

            <Button
              onClick={handleNext}
              className="w-full mt-6 h-12 bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              {step < steps.length - 1 ? "Próxima pergunta" : "Ver resultado"}
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default QualificationForm;
