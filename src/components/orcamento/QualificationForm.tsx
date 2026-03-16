import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Monitor,
  Clock,
  Cpu,
  Server,
  Wrench,
  AlertTriangle,
  HardDrive,
  Wifi,
  Users,
  ArrowRight,
  Building2,
  Briefcase,
  Shield,
  Phone,
  Mail,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import type { CommercialPath } from "./PathSelector";
import { recommendRentalPlan } from "./rentalRecommendation";

export interface QualificationData {
  computersQty: number;
  averageAge?: string;
  isMinCoreI3?: boolean;
  serversQty?: number;
  frequentMaintenance?: boolean;
  downtimeImpact?: boolean;
  needsBackup?: boolean;
  needsRemoteAccess?: boolean;
  needsActiveDirectory?: boolean;
  segment?: string;
  employeesRange?: string;
  dailyUsers?: number;
  equipmentType?: string;
  includeMonitor?: string;
  monitorsQty?: number;
  activities?: string[];
  manyTabs?: string;
  hasServer?: string;
  wantsServer?: string;
  hasFirewall?: string;
  hasAutomaticBackup?: string;
  currentSupport?: string;
  problemFrequency?: string;
  growthForecast?: string;
  cnpj?: string;
  companyName?: string;
  address?: string;
  city?: string;
  state?: string;
  cep?: string;
  contactPhone?: string;
  contactEmail?: string;
}

interface Props {
  onComplete: (data: QualificationData) => void;
  completed: boolean;
  data: QualificationData | null;
  path?: CommercialPath | null;
}

type StepType = "number" | "radio" | "boolean";

interface LegacyStep {
  icon: React.ElementType;
  question: string;
  field: keyof QualificationData;
  type: StepType;
  options?: { value: string; label: string }[];
}

const legacySteps: LegacyStep[] = [
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

const segmentOptions = [
  "Advocacia",
  "Clínica ou hospital",
  "Contabilidade",
  "Indústria",
  "Comércio",
  "Cartório",
  "Escritório administrativo",
  "Tecnologia",
  "Outro",
];

const employeesOptions = ["até 3", "4 a 10", "11 a 20", "21 a 50", "mais de 50"];
const equipmentOptions = ["Desktop", "Notebook", "Ambos", "Preciso de recomendação"];
const monitorOptions = ["Sim", "Não", "Alguns"];
const activityOptions = [
  "Navegador e e-mail",
  "Pacote Office",
  "Sistemas jurídicos",
  "Sistemas contábeis",
  "ERP empresarial",
  "Software de engenharia",
  "Software de design",
  "Programação",
  "Uso misto",
];
const manyTabsOptions = ["Sim", "Não", "Às vezes"];
const yesNoUnknownOptions = ["Sim", "Não", "Não sei"];
const serverNeedOptions = ["Sim", "Não", "Preciso de recomendação"];
const currentSupportOptions = [
  "Técnico interno",
  "Técnico externo quando necessário",
  "Empresa de suporte",
  "Não temos suporte",
];
const problemFrequencyOptions = ["Raramente", "Mensalmente", "Semanalmente", "Quase todos os dias"];
const growthOptions = ["Não", "Até 5 novos usuários", "Até 10 novos usuários", "Mais de 10 novos usuários"];

const formatCnpj = (value: string) => {
  const digits = value.replace(/\D/g, "").slice(0, 14);
  return digits
    .replace(/(\d{2})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1/$2")
    .replace(/(\d{4})(\d{1,2})$/, "$1-$2");
};

const formatCep = (value: string) => {
  const digits = value.replace(/\D/g, "").slice(0, 8);
  return digits.replace(/(\d{5})(\d{1,3})/, "$1-$2");
};

const formatPhone = (value: string) => {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 10) {
    return digits
      .replace(/(\d{2})(\d)/, "($1) $2")
      .replace(/(\d{4})(\d{1,4})$/, "$1-$2");
  }
  return digits
    .replace(/(\d{2})(\d)/, "($1) $2")
    .replace(/(\d{5})(\d{1,4})$/, "$1-$2");
};

const RadioCardGroup = ({
  name,
  options,
  value,
  onChange,
}: {
  name: string;
  options: string[];
  value: string;
  onChange: (value: string) => void;
}) => (
  <RadioGroup value={value} onValueChange={onChange} className="space-y-3">
    {options.map((option) => (
      <Label
        key={`${name}-${option}`}
        className="flex items-center gap-3 p-4 rounded-lg border border-border hover:border-primary/50 cursor-pointer transition-colors"
      >
        <RadioGroupItem value={option} />
        <span>{option}</span>
      </Label>
    ))}
  </RadioGroup>
);

const RentalQualificationForm = ({ onComplete, completed, data: completedData }: Omit<Props, "path">) => {
  const [form, setForm] = useState<QualificationData>({
    computersQty: 0,
    activities: [],
  });
  const [cnpjLoading, setCnpjLoading] = useState(false);
  const rawCnpj = form.cnpj?.replace(/\D/g, "") || "";

  useEffect(() => {
    const fetchCompanyData = async () => {
      if (rawCnpj.length !== 14) return;
      setCnpjLoading(true);
      try {
        const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${rawCnpj}`);
        if (!response.ok) throw new Error("CNPJ não encontrado");
        const company = await response.json();
        setForm((prev) => ({
          ...prev,
          companyName: company.razao_social || prev.companyName,
          address: [company.logradouro, company.numero, company.bairro].filter(Boolean).join(", ") || prev.address,
          city: company.municipio || prev.city,
          state: company.uf || prev.state,
          cep: company.cep ? formatCep(company.cep) : prev.cep,
          contactPhone: company.ddd_telefone_1 ? formatPhone(company.ddd_telefone_1) : prev.contactPhone,
        }));
      } catch (error) {
        console.warn("[WMTi][rental-form] Falha ao consultar CNPJ:", error);
      } finally {
        setCnpjLoading(false);
      }
    };

    fetchCompanyData();
  }, [rawCnpj]);

  const updateField = (field: keyof QualificationData, value: string | number | string[]) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const toggleActivity = (activity: string, checked: boolean) => {
    setForm((prev) => ({
      ...prev,
      activities: checked
        ? [...(prev.activities || []), activity]
        : (prev.activities || []).filter((item) => item !== activity),
    }));
  };

  const validateAndSubmit = () => {
    if (!form.segment) return alert("Selecione o segmento da empresa.");
    if (!form.employeesRange) return alert("Selecione a quantidade de funcionários.");
    if (!form.dailyUsers || form.dailyUsers < 1) return alert("Informe quantos usuários usarão computadores diariamente.");
    if (!form.computersQty || form.computersQty < 1) return alert("Informe quantos computadores deseja alugar.");
    if (!form.equipmentType) return alert("Selecione o tipo de equipamento.");
    if (!form.includeMonitor) return alert("Selecione se a locação inclui monitor.");
    if (form.includeMonitor === "Alguns" && (!form.monitorsQty || form.monitorsQty < 1)) {
      return alert("Informe quantos monitores precisam ser incluídos.");
    }
    if (!form.activities?.length) return alert("Selecione ao menos uma atividade realizada nos computadores.");
    if (!form.manyTabs) return alert("Selecione o perfil de uso simultâneo de sistemas.");
    if (!form.hasServer) return alert("Informe se a empresa possui servidor.");
    if (form.hasServer === "Não" && !form.wantsServer) return alert("Informe se deseja incluir servidor na solução.");
    if (!form.hasFirewall) return alert("Informe se a empresa possui firewall.");
    if (!form.hasAutomaticBackup) return alert("Informe se a empresa possui backup automático.");
    if (!form.currentSupport) return alert("Informe como a empresa resolve problemas de informática hoje.");
    if (!form.problemFrequency) return alert("Informe a frequência dos problemas de informática.");
    if (!form.growthForecast) return alert("Informe a previsão de crescimento da equipe.");
    if (rawCnpj.length !== 14) return alert("Informe um CNPJ válido.");
    if (!form.companyName?.trim()) return alert("Informe a razão social da empresa.");
    if (!form.contactEmail?.trim()) return alert("Informe o e-mail para envio do diagnóstico.");

    onComplete({
      ...form,
      needsBackup: form.hasAutomaticBackup !== "Sim",
      needsRemoteAccess:
        form.equipmentType === "Notebook" ||
        form.equipmentType === "Ambos" ||
        form.growthForecast === "Até 10 novos usuários" ||
        form.growthForecast === "Mais de 10 novos usuários",
    });
  };

  if (completed && completedData) {
    const recommendedPlan = recommendRentalPlan(completedData);
    const recommendedPlanLabel =
      recommendedPlan === "essencial"
        ? "Configuração básica"
        : recommendedPlan === "equilibrio"
          ? "Configuração intermediária"
          : "Configuração avançada";

    return (
      <section id="qualification" className="py-16 section-dark">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 text-primary rounded-full mb-4">
              <Briefcase className="w-4 h-4" />
              <span className="text-sm font-semibold">Perfil de locação concluído</span>
            </div>
            <p className="text-muted-foreground text-sm">
              {completedData.companyName || "Empresa"} · {completedData.computersQty} computadores · {recommendedPlanLabel}
            </p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section id="qualification" className="py-20 bg-card">
      <div className="container mx-auto px-4">
        <div className="max-w-4xl mx-auto space-y-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center"
          >
            <span className="inline-block px-4 py-1.5 mb-4 text-xs font-semibold tracking-widest uppercase bg-primary/10 text-primary rounded-full border border-primary/20">
              Qualificação
            </span>
            <h2 className="text-2xl md:text-4xl font-heading font-bold mb-3">
              Dimensione sua <span className="text-primary">locação de computadores</span>
            </h2>
            <p className="text-muted-foreground">
              Responda aos blocos abaixo para gerar a configuração recomendada sem depender do parque atual.
            </p>
          </motion.div>

          <div className="bg-background/60 border border-border rounded-2xl p-6 md:p-8 space-y-8">
            <div className="space-y-5">
              <div className="flex items-center gap-3">
                <Building2 className="w-5 h-5 text-primary" />
                <h3 className="font-heading text-xl font-bold">Bloco 1 — Perfil da empresa</h3>
              </div>
              <div>
                <Label className="mb-2 block">Qual é o segmento da empresa?</Label>
                <RadioCardGroup name="segment" options={segmentOptions} value={form.segment || ""} onChange={(value) => updateField("segment", value)} />
              </div>
              <div>
                <Label className="mb-2 block">Quantos funcionários trabalham atualmente na empresa?</Label>
                <RadioCardGroup name="employees" options={employeesOptions} value={form.employeesRange || ""} onChange={(value) => updateField("employeesRange", value)} />
              </div>
              <div>
                <Label className="mb-2 block">Quantos usuários utilizarão computadores diariamente?</Label>
                <Input
                  type="number"
                  min={1}
                  value={form.dailyUsers || ""}
                  onChange={(e) => updateField("dailyUsers", Number(e.target.value || 0))}
                  className="h-12 bg-muted border-border"
                  placeholder="Digite a quantidade de usuários"
                />
              </div>
            </div>

            <div className="space-y-5 border-t border-border pt-8">
              <div className="flex items-center gap-3">
                <Monitor className="w-5 h-5 text-primary" />
                <h3 className="font-heading text-xl font-bold">Bloco 2 — Dimensionamento da locação</h3>
              </div>
              <div>
                <Label className="mb-2 block">Quantos computadores deseja alugar?</Label>
                <Input
                  type="number"
                  min={1}
                  value={form.computersQty || ""}
                  onChange={(e) => updateField("computersQty", Number(e.target.value || 0))}
                  className="h-12 bg-muted border-border"
                  placeholder="Digite a quantidade de computadores que deseja alugar."
                />
              </div>
              <div>
                <Label className="mb-2 block">Que tipo de equipamento você deseja?</Label>
                <RadioCardGroup name="equipment" options={equipmentOptions} value={form.equipmentType || ""} onChange={(value) => updateField("equipmentType", value)} />
              </div>
              <div>
                <Label className="mb-2 block">Os computadores precisam incluir monitor?</Label>
                <RadioCardGroup name="monitor" options={monitorOptions} value={form.includeMonitor || ""} onChange={(value) => updateField("includeMonitor", value)} />
              </div>
              {form.includeMonitor === "Alguns" && (
                <div>
                  <Label className="mb-2 block">Quantos monitores precisam ser incluídos?</Label>
                  <Input
                    type="number"
                    min={1}
                    value={form.monitorsQty || ""}
                    onChange={(e) => updateField("monitorsQty", Number(e.target.value || 0))}
                    className="h-12 bg-muted border-border"
                    placeholder="Digite a quantidade de monitores"
                  />
                </div>
              )}
            </div>

            <div className="space-y-5 border-t border-border pt-8">
              <div className="flex items-center gap-3">
                <Cpu className="w-5 h-5 text-primary" />
                <h3 className="font-heading text-xl font-bold">Bloco 3 — Perfil de uso</h3>
              </div>
              <div>
                <Label className="mb-3 block">Quais atividades são realizadas nesses computadores?</Label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {activityOptions.map((activity) => {
                    const checked = form.activities?.includes(activity) || false;
                    return (
                      <label
                        key={activity}
                        className="flex items-center gap-3 p-4 rounded-lg border border-border hover:border-primary/40 cursor-pointer transition-colors"
                      >
                        <Checkbox checked={checked} onCheckedChange={(value) => toggleActivity(activity, value === true)} />
                        <span className="text-sm">{activity}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
              <div>
                <Label className="mb-2 block">Os usuários costumam utilizar muitos sistemas ou abas ao mesmo tempo?</Label>
                <RadioCardGroup name="manyTabs" options={manyTabsOptions} value={form.manyTabs || ""} onChange={(value) => updateField("manyTabs", value)} />
              </div>
            </div>

            <div className="space-y-5 border-t border-border pt-8">
              <div className="flex items-center gap-3">
                <Shield className="w-5 h-5 text-primary" />
                <h3 className="font-heading text-xl font-bold">Bloco 4 — Infraestrutura</h3>
              </div>
              <div>
                <Label className="mb-2 block">A empresa possui servidor?</Label>
                <RadioCardGroup name="hasServer" options={yesNoUnknownOptions} value={form.hasServer || ""} onChange={(value) => updateField("hasServer", value)} />
              </div>
              {form.hasServer === "Não" && (
                <div>
                  <Label className="mb-2 block">Deseja incluir servidor na solução?</Label>
                  <RadioCardGroup name="wantsServer" options={serverNeedOptions} value={form.wantsServer || ""} onChange={(value) => updateField("wantsServer", value)} />
                </div>
              )}
              <div>
                <Label className="mb-2 block">A empresa possui firewall ou equipamento de segurança de rede?</Label>
                <RadioCardGroup name="hasFirewall" options={yesNoUnknownOptions} value={form.hasFirewall || ""} onChange={(value) => updateField("hasFirewall", value)} />
              </div>
              <div>
                <Label className="mb-2 block">A empresa possui sistema de backup automático?</Label>
                <RadioCardGroup name="hasBackup" options={yesNoUnknownOptions} value={form.hasAutomaticBackup || ""} onChange={(value) => updateField("hasAutomaticBackup", value)} />
              </div>
            </div>

            <div className="space-y-5 border-t border-border pt-8">
              <div className="flex items-center gap-3">
                <Wrench className="w-5 h-5 text-primary" />
                <h3 className="font-heading text-xl font-bold">Bloco 5 — Suporte</h3>
              </div>
              <div>
                <Label className="mb-2 block">Como sua empresa resolve problemas de informática atualmente?</Label>
                <RadioCardGroup name="support" options={currentSupportOptions} value={form.currentSupport || ""} onChange={(value) => updateField("currentSupport", value)} />
              </div>
              <div>
                <Label className="mb-2 block">Com que frequência ocorrem problemas de informática?</Label>
                <RadioCardGroup name="frequency" options={problemFrequencyOptions} value={form.problemFrequency || ""} onChange={(value) => updateField("problemFrequency", value)} />
              </div>
            </div>

            <div className="space-y-5 border-t border-border pt-8">
              <div className="flex items-center gap-3">
                <Users className="w-5 h-5 text-primary" />
                <h3 className="font-heading text-xl font-bold">Bloco 6 — Crescimento</h3>
              </div>
              <div>
                <Label className="mb-2 block">Existe previsão de crescimento da equipe nos próximos 12 meses?</Label>
                <RadioCardGroup name="growth" options={growthOptions} value={form.growthForecast || ""} onChange={(value) => updateField("growthForecast", value)} />
              </div>
            </div>

            <div className="space-y-5 border-t border-border pt-8">
              <div className="flex items-center gap-3">
                <Mail className="w-5 h-5 text-primary" />
                <h3 className="font-heading text-xl font-bold">Bloco 7 — Dados da empresa</h3>
              </div>
              <div>
                <Label className="mb-2 block">CNPJ da empresa</Label>
                <div className="relative">
                  <Input
                    value={form.cnpj || ""}
                    onChange={(e) => updateField("cnpj", formatCnpj(e.target.value))}
                    className="h-12 bg-muted border-border pr-10"
                    placeholder="00.000.000/0001-00"
                  />
                  {cnpjLoading && <Clock className="w-4 h-4 absolute right-3 top-4 text-primary animate-spin" />}
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Tentamos preencher automaticamente razão social, endereço, cidade, estado e CEP via BrasilAPI.
                </p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="mb-2 block">Razão social</Label>
                  <Input
                    value={form.companyName || ""}
                    onChange={(e) => updateField("companyName", e.target.value)}
                    className="h-12 bg-muted border-border"
                    placeholder="Razão social da empresa"
                  />
                </div>
                <div>
                  <Label className="mb-2 block">Telefone de contato</Label>
                  <Input
                    value={form.contactPhone || ""}
                    onChange={(e) => updateField("contactPhone", formatPhone(e.target.value))}
                    className="h-12 bg-muted border-border"
                    placeholder="(12) 99999-9999"
                  />
                </div>
                <div className="md:col-span-2">
                  <Label className="mb-2 block">E-mail para envio do diagnóstico</Label>
                  <Input
                    type="email"
                    value={form.contactEmail || ""}
                    onChange={(e) => updateField("contactEmail", e.target.value)}
                    className="h-12 bg-muted border-border"
                    placeholder="email@empresa.com"
                  />
                </div>
                <div className="md:col-span-2">
                  <Label className="mb-2 block">Endereço</Label>
                  <Input
                    value={form.address || ""}
                    onChange={(e) => updateField("address", e.target.value)}
                    className="h-12 bg-muted border-border"
                    placeholder="Rua, número e bairro"
                  />
                </div>
                <div>
                  <Label className="mb-2 block">Cidade</Label>
                  <Input
                    value={form.city || ""}
                    onChange={(e) => updateField("city", e.target.value)}
                    className="h-12 bg-muted border-border"
                    placeholder="Cidade"
                  />
                </div>
                <div>
                  <Label className="mb-2 block">Estado</Label>
                  <Input
                    value={form.state || ""}
                    onChange={(e) => updateField("state", e.target.value.toUpperCase().slice(0, 2))}
                    className="h-12 bg-muted border-border"
                    placeholder="SP"
                  />
                </div>
                <div>
                  <Label className="mb-2 block">CEP</Label>
                  <Input
                    value={form.cep || ""}
                    onChange={(e) => updateField("cep", formatCep(e.target.value))}
                    className="h-12 bg-muted border-border"
                    placeholder="00000-000"
                  />
                </div>
              </div>
            </div>

            <Button onClick={validateAndSubmit} className="w-full h-14 text-base bg-primary hover:bg-primary/90 text-primary-foreground">
              Ver resultado
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
};

const LegacyQualificationForm = ({ onComplete, completed, data: completedData }: Omit<Props, "path">) => {
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

  const currentStep = legacySteps[step];

  const handleNext = () => {
    let nextData = data;

    if (currentStep.type === "number") {
      const num = parseInt(numberInput);
      const final = !isNaN(num) && num >= 0 ? Math.min(num, 500) : currentStep.field === "serversQty" ? 0 : 1;
      nextData = { ...data, [currentStep.field]: final };
      setData(nextData);
      setNumberInput(String(final));
    }

    if (step < legacySteps.length - 1) {
      setStep(step + 1);
      const nextStep = legacySteps[step + 1];
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
              {completedData.computersQty} computadores · Idade: {ageLabel} · {completedData.serversQty || 0} servidor(es)
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
              Responda {legacySteps.length} perguntas rápidas para um orçamento personalizado.
            </p>
          </motion.div>

          <div className="flex gap-1.5 mb-8">
            {legacySteps.map((_, i) => (
              <div
                key={i}
                className={`h-1.5 flex-1 rounded-full transition-colors ${i <= step ? "bg-primary" : "bg-muted"}`}
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
                value={String(data[currentStep.field] || "")}
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

            <Button onClick={handleNext} className="w-full mt-6 h-12 bg-primary hover:bg-primary/90 text-primary-foreground">
              {step < legacySteps.length - 1 ? "Próxima pergunta" : "Ver resultado"}
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

const QualificationForm = (props: Props) => {
  if (props.path === "locacao") {
    return <RentalQualificationForm onComplete={props.onComplete} completed={props.completed} completedData={props.data} />;
  }

  return <LegacyQualificationForm onComplete={props.onComplete} completed={props.completed} completedData={props.data} />;
};

export default QualificationForm;
