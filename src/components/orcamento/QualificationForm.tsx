import { useEffect, useState } from "react";
import { useBrasilApiLookup } from "@/hooks/useBrasilApiLookup";
import { motion, AnimatePresence } from "framer-motion";
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
  ArrowLeft,
  Building2,
  Briefcase,
  Shield,
  Phone,
  Mail,
  TrendingUp,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent } from "@/components/ui/dialog";
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
  hasInternalTech?: string;
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
  { icon: Monitor, question: "Quantos computadores existem hoje na empresa?", field: "computersQty", type: "number" },
  { icon: Clock, question: "Qual a idade média dos computadores?", field: "averageAge", type: "radio", options: [{ value: "0-2", label: "Menos de 2 anos" }, { value: "3-4", label: "3 a 4 anos" }, { value: "5+", label: "Mais de 4 anos" }] },
  { icon: Cpu, question: "Os computadores são no mínimo Core i3?", field: "isMinCoreI3", type: "boolean" },
  { icon: Server, question: "Quantos servidores Windows Server existem?", field: "serversQty", type: "number" },
  { icon: Wrench, question: "Sua empresa gasta frequentemente com manutenção?", field: "frequentMaintenance", type: "boolean" },
  { icon: AlertTriangle, question: "Quando um computador para, isso afeta a operação?", field: "downtimeImpact", type: "boolean" },
  { icon: HardDrive, question: "Existe necessidade de backup?", field: "needsBackup", type: "boolean" },
  { icon: Wifi, question: "Existe necessidade de acesso remoto?", field: "needsRemoteAccess", type: "boolean" },
  { icon: Users, question: "Existe necessidade de Active Directory, usuários por departamento ou GPOs?", field: "needsActiveDirectory", type: "boolean" },
];

const segmentOptions = ["Advocacia", "Clínica ou hospital", "Contabilidade", "Indústria", "Comércio", "Cartório", "Escritório administrativo", "Tecnologia", "Outro"];
const employeesOptions = ["até 3", "4 a 10", "11 a 20", "21 a 50", "mais de 50"];
const equipmentOptions = ["Desktop", "Notebook", "Ambos", "Preciso de recomendação"];
const monitorOptions = ["Sim", "Não", "Alguns"];
const activityOptions = ["Navegador e e-mail", "Pacote Office", "Sistemas jurídicos", "Sistemas contábeis", "ERP empresarial", "Software de engenharia", "Software de design", "Programação", "Uso misto"];
const manyTabsOptions = ["Sim", "Não", "Às vezes"];
const yesNoUnknownOptions = ["Sim", "Não", "Não sei"];
const serverNeedOptions = ["Sim", "Não", "Preciso de recomendação"];
const currentSupportOptions = ["Técnico interno", "Técnico externo quando necessário", "Empresa de suporte", "Não temos suporte"];
const problemFrequencyOptions = ["Raramente", "Mensalmente", "Semanalmente", "Quase todos os dias"];
const growthOptions = ["Não", "Até 5 novos usuários", "Até 10 novos usuários", "Mais de 10 novos usuários"];

const formatCnpj = (value: string) => {
  const digits = value.replace(/\D/g, "").slice(0, 14);
  return digits.replace(/(\d{2})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1/$2").replace(/(\d{4})(\d{1,2})$/, "$1-$2");
};
const formatCep = (value: string) => {
  const digits = value.replace(/\D/g, "").slice(0, 8);
  return digits.replace(/(\d{5})(\d{1,3})/, "$1-$2");
};
const formatPhone = (value: string) => {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 10) return digits.replace(/(\d{2})(\d)/, "($1) $2").replace(/(\d{4})(\d{1,4})$/, "$1-$2");
  return digits.replace(/(\d{2})(\d)/, "($1) $2").replace(/(\d{5})(\d{1,4})$/, "$1-$2");
};

const RadioCardGroup = ({ name, options, value, onChange }: { name: string; options: string[]; value: string; onChange: (v: string) => void }) => (
  <RadioGroup value={value} onValueChange={onChange} className="space-y-2">
    {options.map((option) => (
      <Label key={`${name}-${option}`} className="flex items-center gap-3 p-3 rounded-lg border border-border hover:border-primary/50 cursor-pointer transition-colors text-sm">
        <RadioGroupItem value={option} />
        <span>{option}</span>
      </Label>
    ))}
  </RadioGroup>
);

/* ─── Wizard block definitions ─── */
interface WizardBlock {
  id: string;
  title: string;
  icon: React.ElementType;
}

const wizardBlocks: WizardBlock[] = [
  { id: "perfil", title: "Perfil da empresa", icon: Building2 },
  { id: "dimensionamento", title: "Dimensionamento", icon: Monitor },
  { id: "uso", title: "Perfil de uso", icon: Cpu },
  { id: "infra", title: "Infraestrutura", icon: Shield },
  { id: "suporte", title: "Suporte", icon: Wrench },
  { id: "crescimento", title: "Crescimento", icon: TrendingUp },
  { id: "dados", title: "Dados da empresa", icon: Mail },
];

/* ─── RentalQualificationForm (modal wizard) ─── */
const RentalQualificationForm = ({ onComplete, completed, data: completedData }: Omit<Props, "path">) => {
  const [open, setOpen] = useState(false);
  const [blockIndex, setBlockIndex] = useState(0);
  const [form, setForm] = useState<QualificationData>({ computersQty: 0, activities: [] });
  const { lookupCnpj, cnpjLoading } = useBrasilApiLookup();
  const [blockError, setBlockError] = useState<string | null>(null);
  const rawCnpj = form.cnpj?.replace(/\D/g, "") || "";

  useEffect(() => {
    if (rawCnpj.length !== 14) return;
    lookupCnpj(rawCnpj).then((company) => {
      if (!company) return;
      setForm((prev) => ({
        ...prev,
        companyName: company.razao_social || prev.companyName,
        address: [company.logradouro, company.numero, company.bairro].filter(Boolean).join(", ") || prev.address,
        city: company.municipio || prev.city,
        state: company.uf || prev.state,
        cep: company.cep ? formatCep(company.cep) : prev.cep,
        contactPhone: company.ddd_telefone_1 ? formatPhone(company.ddd_telefone_1) : prev.contactPhone,
      }));
    });
  }, [rawCnpj, lookupCnpj]);

  const updateField = (field: keyof QualificationData, value: string | number | string[]) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setBlockError(null);
  };

  const toggleActivity = (activity: string, checked: boolean) => {
    setForm((prev) => ({
      ...prev,
      activities: checked ? [...(prev.activities || []), activity] : (prev.activities || []).filter((item) => item !== activity),
    }));
    setBlockError(null);
  };

  const validateBlock = (idx: number): string | null => {
    switch (idx) {
      case 0:
        if (!form.segment) return "Selecione o segmento da empresa.";
        if (!form.employeesRange) return "Selecione a quantidade de funcionários.";
        if (!form.dailyUsers || form.dailyUsers < 1) return "Informe quantos usuários usarão computadores.";
        return null;
      case 1:
        if (!form.computersQty || form.computersQty < 1) return "Informe quantos computadores deseja alugar.";
        if (!form.equipmentType) return "Selecione o tipo de equipamento.";
        if (!form.includeMonitor) return "Selecione se a locação inclui monitor.";
        if (form.includeMonitor === "Alguns" && (!form.monitorsQty || form.monitorsQty < 1)) return "Informe quantos monitores.";
        return null;
      case 2:
        if (!form.activities?.length) return "Selecione ao menos uma atividade.";
        if (!form.manyTabs) return "Selecione o perfil de uso simultâneo.";
        return null;
      case 3:
        if (!form.hasServer) return "Informe se a empresa possui servidor.";
        if (form.hasServer === "Não" && !form.wantsServer) return "Informe se deseja incluir servidor.";
        if (!form.hasFirewall) return "Informe se a empresa possui firewall.";
        if (!form.hasAutomaticBackup) return "Informe se a empresa possui backup automático.";
        return null;
      case 4:
        if (!form.hasInternalTech) return "Informe se possui técnico interno.";
        if (!form.problemFrequency) return "Informe a frequência dos problemas.";
        return null;
      case 5:
        if (!form.growthForecast) return "Informe a previsão de crescimento.";
        return null;
      case 6:
        if (rawCnpj.length !== 14) return "Informe um CNPJ válido.";
        if (!form.companyName?.trim()) return "Informe a razão social.";
        if (!form.contactEmail?.trim()) return "Informe o e-mail.";
        return null;
      default:
        return null;
    }
  };

  const handleNext = () => {
    const error = validateBlock(blockIndex);
    if (error) {
      setBlockError(error);
      return;
    }
    setBlockError(null);
    if (blockIndex < wizardBlocks.length - 1) {
      setBlockIndex(blockIndex + 1);
    } else {
      onComplete({
        ...form,
        needsBackup: form.hasAutomaticBackup !== "Sim",
        needsRemoteAccess: form.equipmentType === "Notebook" || form.equipmentType === "Ambos" || form.growthForecast === "Até 10 novos usuários" || form.growthForecast === "Mais de 10 novos usuários",
      });
      setOpen(false);
    }
  };

  const handleBack = () => {
    setBlockError(null);
    if (blockIndex > 0) setBlockIndex(blockIndex - 1);
  };

  const currentBlock = wizardBlocks[blockIndex];
  const progress = ((blockIndex + 1) / wizardBlocks.length) * 100;

  if (completed && completedData) {
    const recommendedPlan = recommendRentalPlan(completedData);
    const recommendedPlanLabel = recommendedPlan === "essencial" ? "Configuração básica" : recommendedPlan === "equilibrio" ? "Configuração intermediária" : "Configuração avançada";
    return (
      <section id="qualification" className="py-16 section-dark">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 text-primary rounded-full mb-4">
              <Briefcase className="w-4 h-4" />
              <span className="text-sm font-semibold">Perfil de locação concluído</span>
            </div>
            <p className="text-muted-foreground text-sm">{completedData.companyName || "Empresa"} · {completedData.computersQty} computadores · {recommendedPlanLabel}</p>
          </div>
        </div>
      </section>
    );
  }

  /* ─── Block content renderers ─── */
  const renderBlock = () => {
    switch (blockIndex) {
      case 0:
        return (
          <div className="space-y-5">
            <div>
              <Label className="mb-2 block text-sm font-medium">Qual é o segmento da empresa?</Label>
              <RadioCardGroup name="segment" options={segmentOptions} value={form.segment || ""} onChange={(v) => updateField("segment", v)} />
            </div>
            <div>
              <Label className="mb-2 block text-sm font-medium">Quantos funcionários trabalham na empresa?</Label>
              <RadioCardGroup name="employees" options={employeesOptions} value={form.employeesRange || ""} onChange={(v) => updateField("employeesRange", v)} />
            </div>
            <div>
              <Label className="mb-2 block text-sm font-medium">Quantos usuários utilizarão computadores diariamente?</Label>
              <Input type="number" min={1} value={form.dailyUsers || ""} onChange={(e) => updateField("dailyUsers", Number(e.target.value || 0))} className="h-11 bg-muted border-border" placeholder="Digite a quantidade de usuários" />
            </div>
          </div>
        );
      case 1:
        return (
          <div className="space-y-5">
            <div>
              <Label className="mb-2 block text-sm font-medium">Quantos computadores deseja alugar?</Label>
              <Input type="number" min={1} value={form.computersQty || ""} onChange={(e) => updateField("computersQty", Number(e.target.value || 0))} className="h-11 bg-muted border-border" placeholder="Digite a quantidade de computadores que deseja alugar." />
            </div>
            <div>
              <Label className="mb-2 block text-sm font-medium">Que tipo de equipamento você deseja?</Label>
              <RadioCardGroup name="equipment" options={equipmentOptions} value={form.equipmentType || ""} onChange={(v) => updateField("equipmentType", v)} />
            </div>
            <div>
              <Label className="mb-2 block text-sm font-medium">Os computadores precisam incluir monitor?</Label>
              <RadioCardGroup name="monitor" options={monitorOptions} value={form.includeMonitor || ""} onChange={(v) => updateField("includeMonitor", v)} />
            </div>
            {form.includeMonitor === "Alguns" && (
              <div>
                <Label className="mb-2 block text-sm font-medium">Quantos monitores precisam ser incluídos?</Label>
                <Input type="number" min={1} value={form.monitorsQty || ""} onChange={(e) => updateField("monitorsQty", Number(e.target.value || 0))} className="h-11 bg-muted border-border" placeholder="Quantidade de monitores" />
              </div>
            )}
          </div>
        );
      case 2:
        return (
          <div className="space-y-5">
            <div>
              <Label className="mb-3 block text-sm font-medium">Quais atividades são realizadas nesses computadores?</Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {activityOptions.map((activity) => (
                  <label key={activity} className="flex items-center gap-3 p-3 rounded-lg border border-border hover:border-primary/40 cursor-pointer transition-colors text-sm">
                    <Checkbox checked={form.activities?.includes(activity) || false} onCheckedChange={(value) => toggleActivity(activity, value === true)} />
                    <span>{activity}</span>
                  </label>
                ))}
              </div>
            </div>
            <div>
              <Label className="mb-2 block text-sm font-medium">Os usuários costumam utilizar muitos sistemas ou abas ao mesmo tempo?</Label>
              <RadioCardGroup name="manyTabs" options={manyTabsOptions} value={form.manyTabs || ""} onChange={(v) => updateField("manyTabs", v)} />
            </div>
          </div>
        );
      case 3:
        return (
          <div className="space-y-5">
            <div>
              <Label className="mb-2 block text-sm font-medium">A empresa possui servidor?</Label>
              <RadioCardGroup name="hasServer" options={yesNoUnknownOptions} value={form.hasServer || ""} onChange={(v) => updateField("hasServer", v)} />
            </div>
            {form.hasServer === "Não" && (
              <div>
                <Label className="mb-2 block text-sm font-medium">Deseja incluir servidor na solução?</Label>
                <RadioCardGroup name="wantsServer" options={serverNeedOptions} value={form.wantsServer || ""} onChange={(v) => updateField("wantsServer", v)} />
              </div>
            )}
            <div>
              <Label className="mb-2 block text-sm font-medium">A empresa possui firewall ou segurança de rede?</Label>
              <RadioCardGroup name="hasFirewall" options={yesNoUnknownOptions} value={form.hasFirewall || ""} onChange={(v) => updateField("hasFirewall", v)} />
            </div>
            <div>
              <Label className="mb-2 block text-sm font-medium">A empresa possui backup automático?</Label>
              <RadioCardGroup name="hasBackup" options={yesNoUnknownOptions} value={form.hasAutomaticBackup || ""} onChange={(v) => updateField("hasAutomaticBackup", v)} />
            </div>
          </div>
        );
      case 4:
        return (
          <div className="space-y-5">
            <div>
              <Label className="mb-2 block text-sm font-medium">Sua empresa possui técnico de TI interno?</Label>
              <RadioCardGroup name="hasInternalTech" options={["Sim", "Não"]} value={form.hasInternalTech || ""} onChange={(v) => updateField("hasInternalTech", v)} />
            </div>
            <div>
              <Label className="mb-2 block text-sm font-medium">Com que frequência ocorrem problemas de informática?</Label>
              <RadioCardGroup name="frequency" options={problemFrequencyOptions} value={form.problemFrequency || ""} onChange={(v) => updateField("problemFrequency", v)} />
            </div>
          </div>
        );
      case 5:
        return (
          <div className="space-y-5">
            <div>
              <Label className="mb-2 block text-sm font-medium">Existe previsão de crescimento da equipe nos próximos 12 meses?</Label>
              <RadioCardGroup name="growth" options={growthOptions} value={form.growthForecast || ""} onChange={(v) => updateField("growthForecast", v)} />
            </div>
          </div>
        );
      case 6:
        return (
          <div className="space-y-5">
            <div>
              <Label className="mb-2 block text-sm font-medium">CNPJ da empresa</Label>
              <div className="relative">
                <Input value={form.cnpj || ""} onChange={(e) => updateField("cnpj", formatCnpj(e.target.value))} className="h-11 bg-muted border-border pr-10" placeholder="00.000.000/0001-00" />
                {cnpjLoading && <Clock className="w-4 h-4 absolute right-3 top-3.5 text-primary animate-spin" />}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Preenchimento automático via BrasilAPI.</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label className="mb-2 block text-sm font-medium">Razão social</Label>
                <Input value={form.companyName || ""} onChange={(e) => updateField("companyName", e.target.value)} className="h-11 bg-muted border-border" placeholder="Razão social" />
              </div>
              <div>
                <Label className="mb-2 block text-sm font-medium">Telefone</Label>
                <Input value={form.contactPhone || ""} onChange={(e) => updateField("contactPhone", formatPhone(e.target.value))} className="h-11 bg-muted border-border" placeholder="(12) 99999-9999" />
              </div>
              <div className="sm:col-span-2">
                <Label className="mb-2 block text-sm font-medium">E-mail para envio do diagnóstico</Label>
                <Input type="email" value={form.contactEmail || ""} onChange={(e) => updateField("contactEmail", e.target.value)} className="h-11 bg-muted border-border" placeholder="email@empresa.com" />
              </div>
              <div className="sm:col-span-2">
                <Label className="mb-2 block text-sm font-medium">Endereço</Label>
                <Input value={form.address || ""} onChange={(e) => updateField("address", e.target.value)} className="h-11 bg-muted border-border" placeholder="Rua, número e bairro" />
              </div>
              <div>
                <Label className="mb-2 block text-sm font-medium">Cidade</Label>
                <Input value={form.city || ""} onChange={(e) => updateField("city", e.target.value)} className="h-11 bg-muted border-border" placeholder="Cidade" />
              </div>
              <div>
                <Label className="mb-2 block text-sm font-medium">Estado</Label>
                <Input value={form.state || ""} onChange={(e) => updateField("state", e.target.value.toUpperCase().slice(0, 2))} className="h-11 bg-muted border-border" placeholder="SP" maxLength={2} />
              </div>
              <div>
                <Label className="mb-2 block text-sm font-medium">CEP</Label>
                <Input value={form.cep || ""} onChange={(e) => updateField("cep", formatCep(e.target.value))} className="h-11 bg-muted border-border" placeholder="00000-000" />
              </div>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <>
      {/* Trigger section on the page */}
      <section id="qualification" className="py-20 bg-card">
        <div className="container mx-auto px-4">
          <div className="max-w-2xl mx-auto text-center">
            <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
              <span className="inline-block px-4 py-1.5 mb-4 text-xs font-semibold tracking-widest uppercase bg-primary/10 text-primary rounded-full border border-primary/20">
                Qualificação
              </span>
              <h2 className="text-2xl md:text-4xl font-heading font-bold mb-3">
                Dimensione sua <span className="text-primary">locação de computadores</span>
              </h2>
              <p className="text-muted-foreground mb-8">
                Responda 7 perguntas rápidas para gerar sua configuração recomendada.
              </p>
              <Button
                onClick={() => { setOpen(true); setBlockIndex(0); setBlockError(null); }}
                className="h-14 px-10 text-base bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                Iniciar diagnóstico
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Wizard Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden p-0 gap-0 bg-card border-border [&>button]:hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-6 pt-5 pb-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                <currentBlock.icon className="w-4 h-4 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium">Etapa {blockIndex + 1} de {wizardBlocks.length}</p>
                <h3 className="text-base font-heading font-bold text-foreground">{currentBlock.title}</h3>
              </div>
            </div>
            <button onClick={() => setOpen(false)} className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Progress bar */}
          <div className="px-6 pb-3">
            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-primary rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.3, ease: "easeOut" }}
              />
            </div>
            {/* Step dots */}
            <div className="flex justify-between mt-2">
              {wizardBlocks.map((block, i) => (
                <div key={block.id} className="flex flex-col items-center">
                  <div className={`w-2 h-2 rounded-full transition-colors ${i <= blockIndex ? "bg-primary" : "bg-muted-foreground/30"}`} />
                </div>
              ))}
            </div>
          </div>

          {/* Content */}
          <div className="px-6 pb-4 overflow-y-auto max-h-[55vh]">
            <AnimatePresence mode="wait">
              <motion.div
                key={blockIndex}
                initial={{ opacity: 0, x: 30 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -30 }}
                transition={{ duration: 0.2 }}
              >
                {renderBlock()}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Error */}
          {blockError && (
            <div className="px-6 pb-2">
              <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-sm text-destructive">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{blockError}</span>
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center gap-3 px-6 py-4 border-t border-border">
            <Button variant="outline" onClick={handleBack} disabled={blockIndex === 0} className="h-11 px-5">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Voltar
            </Button>
            <Button onClick={handleNext} className="flex-1 h-11 bg-primary hover:bg-primary/90 text-primary-foreground">
              {blockIndex < wizardBlocks.length - 1 ? (
                <>
                  Próximo
                  <ArrowRight className="w-4 h-4 ml-2" />
                </>
              ) : (
                <>
                  Ver resultado
                  <ArrowRight className="w-4 h-4 ml-2" />
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

/* ─── Legacy form (support path) ─── */
const LegacyQualificationForm = ({ onComplete, completed, data: completedData }: Omit<Props, "path">) => {
  const [step, setStep] = useState(0);
  const [data, setData] = useState<QualificationData>({
    computersQty: 5, averageAge: "3-4", isMinCoreI3: true, serversQty: 0,
    frequentMaintenance: false, downtimeImpact: true, needsBackup: true, needsRemoteAccess: false, needsActiveDirectory: false,
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
      if (nextStep.type === "number") setNumberInput(String(nextData[nextStep.field] ?? 0));
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
            <p className="text-muted-foreground text-sm">{completedData.computersQty} computadores · Idade: {ageLabel} · {completedData.serversQty || 0} servidor(es)</p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section id="qualification" className="py-20 bg-card">
      <div className="container mx-auto px-4">
        <div className="max-w-2xl mx-auto">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-10">
            <span className="inline-block px-4 py-1.5 mb-4 text-xs font-semibold tracking-widest uppercase bg-primary/10 text-primary rounded-full border border-primary/20">Qualificação</span>
            <h2 className="text-2xl md:text-4xl font-heading font-bold mb-3">Conte-nos sobre sua <span className="text-primary">infraestrutura</span></h2>
            <p className="text-muted-foreground">Responda {legacySteps.length} perguntas rápidas para um orçamento personalizado.</p>
          </motion.div>
          <div className="flex gap-1.5 mb-8">
            {legacySteps.map((_, i) => (
              <div key={i} className={`h-1.5 flex-1 rounded-full transition-colors ${i <= step ? "bg-primary" : "bg-muted"}`} />
            ))}
          </div>
          <motion.div key={step} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.3 }} className="bg-background/50 border border-border rounded-xl p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <currentStep.icon className="w-5 h-5 text-primary" />
              </div>
              <h3 className="text-lg font-semibold">{currentStep.question}</h3>
            </div>
            {currentStep.type === "number" && (
              <Input type="text" inputMode="numeric" value={numberInput} onChange={(e) => setNumberInput(e.target.value.replace(/[^0-9]/g, ""))} onBlur={() => { const num = parseInt(numberInput); if (!isNaN(num) && num >= 0) setData({ ...data, [currentStep.field]: Math.min(num, 500) }); }} className="text-lg h-14 bg-muted border-border" placeholder="Digite o número" />
            )}
            {currentStep.type === "radio" && currentStep.options && (
              <RadioGroup value={String(data[currentStep.field] || "")} onValueChange={(v) => setData({ ...data, [currentStep.field]: v })} className="space-y-3">
                {currentStep.options.map((opt) => (
                  <Label key={opt.value} className="flex items-center gap-3 p-4 rounded-lg border border-border hover:border-primary/50 cursor-pointer transition-colors">
                    <RadioGroupItem value={opt.value} />
                    <span>{opt.label}</span>
                  </Label>
                ))}
              </RadioGroup>
            )}
            {currentStep.type === "boolean" && (
              <div className="flex gap-4">
                {[true, false].map((val) => (
                  <button key={String(val)} onClick={() => setData({ ...data, [currentStep.field]: val })} className={`flex-1 p-4 rounded-lg border text-center font-medium transition-colors ${data[currentStep.field] === val ? "border-primary bg-primary/10 text-primary" : "border-border hover:border-primary/30 text-foreground"}`}>
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
    return <RentalQualificationForm onComplete={props.onComplete} completed={props.completed} data={props.data} />;
  }
  return <LegacyQualificationForm onComplete={props.onComplete} completed={props.completed} data={props.data} />;
};

export default QualificationForm;
