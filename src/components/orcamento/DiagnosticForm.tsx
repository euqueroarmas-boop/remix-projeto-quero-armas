import { useState } from "react";
import { z } from "zod";
import { motion } from "framer-motion";
import { ClipboardList, Monitor, Clock, Server, HardDrive, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

export interface DiagnosticData {
  computersCurrent: number;
  averagePcAge: string;
  maintenanceFrequency: string;
  hasServer: boolean;
  hasBackup: boolean;
}

interface Props {
  onComplete: (data: DiagnosticData) => void;
  completed: boolean;
}

const DiagnosticForm = ({ onComplete, completed }: Props) => {
  const { toast } = useToast();
  const [step, setStep] = useState(0);
  const [data, setData] = useState<DiagnosticData>({
    computersCurrent: 5,
    averagePcAge: "3-5",
    maintenanceFrequency: "mensal",
    hasServer: false,
    hasBackup: false,
  });
  const [computersInput, setComputersInput] = useState(String(5));

  const steps = [
    {
      icon: Monitor,
      question: "Quantos computadores existem na empresa?",
      field: "computersCurrent" as const,
      type: "number",
    },
    {
      icon: Clock,
      question: "Qual a idade média dos computadores?",
      field: "averagePcAge" as const,
      type: "radio",
      options: [
        { value: "0-2", label: "Menos de 2 anos" },
        { value: "3-5", label: "3 a 5 anos" },
        { value: "5+", label: "Mais de 5 anos" },
      ],
    },
    {
      icon: ClipboardList,
      question: "Com que frequência ocorre manutenção?",
      field: "maintenanceFrequency" as const,
      type: "radio",
      options: [
        { value: "semanal", label: "Semanal" },
        { value: "mensal", label: "Mensal" },
        { value: "raramente", label: "Raramente" },
        { value: "nunca", label: "Nunca" },
      ],
    },
    {
      icon: Server,
      question: "A empresa possui servidor?",
      field: "hasServer" as const,
      type: "boolean",
    },
    {
      icon: HardDrive,
      question: "Existe backup automático?",
      field: "hasBackup" as const,
      type: "boolean",
    },
  ];

  const currentStep = steps[step];
  const computersSchema = z.coerce
    .number({ invalid_type_error: "Informe um número válido." })
    .int("Use apenas números inteiros")
    .min(1, "O mínimo é 1 computador")
    .max(500, "O máximo é 500 computadores");

  const handleNext = () => {
    let nextData = data;

    if (currentStep.type === "number") {
      const parsed = computersSchema.safeParse(computersInput.trim());

      if (!parsed.success) {
        toast({
          title: "Número inválido",
          description: parsed.error.issues[0]?.message || "Preencha o campo corretamente.",
          variant: "destructive",
        });
        return;
      }

      nextData = { ...data, computersCurrent: parsed.data };
      setData(nextData);
      setComputersInput(String(parsed.data));
    }

    if (step < steps.length - 1) {
      setStep(step + 1);
    } else {
      onComplete(nextData);
    }
  };

  if (completed) {
    return (
      <section id="diagnostic" className="py-20 section-dark">
        <div className="container mx-auto px-4">
          <div className="max-w-2xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 text-primary rounded-full mb-4">
              <ClipboardList className="w-4 h-4" />
              <span className="text-sm font-semibold">Diagnóstico concluído</span>
            </div>
            <p className="text-muted-foreground">
              {data.computersCurrent} computadores · Idade média: {data.averagePcAge} anos ·
              Servidor: {data.hasServer ? "Sim" : "Não"} · Backup: {data.hasBackup ? "Sim" : "Não"}
            </p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section id="diagnostic" className="py-20 bg-card">
      <div className="container mx-auto px-4">
        <div className="max-w-2xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-10"
          >
            <span className="inline-block px-4 py-1.5 mb-4 text-xs font-semibold tracking-widest uppercase bg-primary/10 text-primary rounded-full border border-primary/20">
              Diagnóstico Rápido
            </span>
            <h2 className="text-2xl md:text-4xl font-heading font-bold mb-3">
              Como está sua <span className="text-primary">infraestrutura</span> atual?
            </h2>
            <p className="text-muted-foreground">
              Responda {steps.length} perguntas rápidas para um diagnóstico personalizado.
            </p>
          </motion.div>

          {/* Progress bar */}
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
                type="number"
                min={1}
                max={500}
                value={data.computersCurrent}
                onChange={(e) =>
                  setData({ ...data, computersCurrent: parseInt(e.target.value) || 1 })
                }
                className="text-lg h-14 bg-muted border-border"
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
                      data[currentStep.field as "hasServer" | "hasBackup"] === val
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
              {step < steps.length - 1 ? "Próxima pergunta" : "Finalizar diagnóstico"}
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default DiagnosticForm;
