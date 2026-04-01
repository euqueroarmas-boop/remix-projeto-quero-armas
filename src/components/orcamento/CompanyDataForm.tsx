import { useState, useEffect } from "react";
import { z } from "zod";
import { Loader2, ArrowRight, Building2, User, MapPin, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useBrasilApiLookup } from "@/hooks/useBrasilApiLookup";

/* ─── Canonical data shape ─── */
export interface CompanyFormData {
  cnpjOuCpf: string;
  razaoSocial: string;
  nomeFantasia: string;
  responsavel: string;
  responsavelCpf: string;
  email: string;
  whatsapp: string;
  telefone: string;
  cep: string;
  endereco: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  uf: string;
  isPJ: boolean;
}

/* ─── Validation ─── */
const validateCpf = (cpf: string): boolean => {
  const digits = cpf.replace(/\D/g, "");
  if (digits.length !== 11 || /^(\d)\1+$/.test(digits)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(digits[i]) * (10 - i);
  let rest = (sum * 10) % 11;
  if (rest === 10) rest = 0;
  if (rest !== parseInt(digits[9])) return false;
  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(digits[i]) * (11 - i);
  rest = (sum * 10) % 11;
  if (rest === 10) rest = 0;
  return rest === parseInt(digits[10]);
};

const schema = z.object({
  cnpjOuCpf: z.string().trim().min(11, "Informe o CPF ou CNPJ"),
  razaoSocial: z.string().trim().min(2, "Informe o nome ou razão social"),
  responsavel: z.string().trim().min(2, "Informe o responsável"),
  responsavelCpf: z.string().refine((v) => validateCpf(v), "CPF do responsável inválido"),
  email: z.string().trim().email("E-mail inválido"),
  whatsapp: z.string().trim().min(14, "WhatsApp inválido"),
  cep: z.string().refine((v) => v.replace(/\D/g, "").length === 8, "CEP inválido"),
  endereco: z.string().trim().min(3, "Informe o logradouro"),
  numero: z.string().trim().min(1, "Informe o número"),
  cidade: z.string().trim().min(2, "Informe a cidade"),
  uf: z.string().trim().min(2, "Informe o estado"),
});

/* ─── Masks ─── */
const maskCnpjCpf = (v: string) => {
  const d = v.replace(/\D/g, "").slice(0, 14);
  if (d.length <= 11)
    return d.replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d{1,2})$/, "$1-$2");
  return d.replace(/(\d{2})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1/$2").replace(/(\d{4})(\d{1,2})$/, "$1-$2");
};

const maskCpf = (v: string) => {
  const d = v.replace(/\D/g, "").slice(0, 11);
  return d.replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d{1,2})$/, "$1-$2");
};

const maskCep = (v: string) => {
  const d = v.replace(/\D/g, "").slice(0, 8);
  return d.replace(/(\d{5})(\d{1,3})/, "$1-$2");
};

const maskPhone = (v: string) => {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 10) return d.replace(/(\d{2})(\d)/, "($1) $2").replace(/(\d{4})(\d{1,4})$/, "$1-$2");
  return d.replace(/(\d{2})(\d)/, "($1) $2").replace(/(\d{5})(\d{1,4})$/, "$1-$2");
};

/* ─── Props ─── */
interface Props {
  onComplete: (data: CompanyFormData) => Promise<void>;
  loading?: boolean;
  initialData?: Partial<CompanyFormData>;
  submitLabel?: string;
}

const fieldClass = "h-12 bg-card border-border";

const CompanyDataForm = ({ onComplete, loading: externalLoading, initialData, submitLabel }: Props) => {
  const { toast } = useToast();
  const { lookupCnpj, lookupCep, cnpjLoading, cepLoading } = useBrasilApiLookup();
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState<CompanyFormData>({
    cnpjOuCpf: "", razaoSocial: "", nomeFantasia: "", responsavel: "", responsavelCpf: "",
    email: "", whatsapp: "", telefone: "", cep: "", endereco: "", numero: "",
    complemento: "", bairro: "", cidade: "", uf: "", isPJ: false,
  });

  useEffect(() => {
    if (!initialData) return;
    setForm((prev) => ({ ...prev, ...initialData }));
  }, [initialData]);

  const update = (field: keyof CompanyFormData, value: string | boolean) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const rawDoc = form.cnpjOuCpf.replace(/\D/g, "");
  const isPJ = rawDoc.length > 11;

  /* ─── CNPJ auto-fill ─── */
  useEffect(() => {
    if (rawDoc.length !== 14) return;
    lookupCnpj(rawDoc).then((data) => {
      if (!data) {
        toast({ title: "CNPJ não encontrado", description: "Preencha os dados manualmente.", variant: "destructive" });
        return;
      }
      setForm((prev) => ({
        ...prev,
        razaoSocial: data.razao_social || prev.razaoSocial,
        nomeFantasia: data.nome_fantasia || prev.nomeFantasia,
        endereco: data.logradouro || prev.endereco,
        numero: data.numero || prev.numero,
        complemento: data.complemento || prev.complemento,
        bairro: data.bairro || prev.bairro,
        cidade: data.municipio || prev.cidade,
        uf: data.uf || prev.uf,
        cep: data.cep ? maskCep(data.cep) : prev.cep,
        telefone: data.ddd_telefone_1 ? maskPhone(data.ddd_telefone_1.replace(/\D/g, "")) : prev.telefone,
        isPJ: true,
      }));
      toast({ title: "Dados encontrados!", description: data.razao_social || "" });
    });
  }, [rawDoc]);

  /* ─── CEP auto-fill ─── */
  const rawCep = form.cep.replace(/\D/g, "");
  useEffect(() => {
    if (rawCep.length !== 8) return;
    lookupCep(rawCep).then((data) => {
      if (!data) return;
      setForm((prev) => ({
        ...prev,
        endereco: data.street || prev.endereco,
        bairro: data.neighborhood || prev.bairro,
        cidade: data.city || prev.cidade,
        uf: data.state || prev.uf,
      }));
    });
  }, [rawCep]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      toast({ title: "Revise os dados", description: parsed.error.issues[0]?.message || "Dados inválidos", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      await onComplete({ ...form, isPJ });
    } catch {
      toast({ title: "Erro ao salvar", description: "Tente novamente.", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const isLoading = submitting || externalLoading;

  return (
    <form onSubmit={handleSubmit} className="space-y-8" noValidate>
      {/* Intro */}
      <div className="flex items-start gap-3 bg-primary/5 border border-primary/20 rounded-lg p-4">
        <Info className="w-5 h-5 text-primary shrink-0 mt-0.5" />
        <p className="text-sm text-muted-foreground">
          Informe os dados da empresa e do responsável pela contratação. O sistema preencherá automaticamente CNPJ e CEP quando possível.
        </p>
      </div>

      {/* ─── BLOCK 1: Company Data ─── */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 pb-2 border-b border-border">
          <Building2 className="w-5 h-5 text-primary" />
          <h3 className="text-base font-bold text-foreground">Dados da Empresa</h3>
        </div>

        <div>
          <Label className="mb-1.5 block text-sm">CPF ou CNPJ *</Label>
          <div className="relative">
            <Input
              value={form.cnpjOuCpf}
              onChange={(e) => update("cnpjOuCpf", maskCnpjCpf(e.target.value))}
              className={`${fieldClass} pr-10`}
              placeholder="000.000.000-00 ou 00.000.000/0001-00"
              maxLength={18}
              autoComplete="off"
              inputMode="numeric"
              required
              data-testid="campo-cnpj"
            />
            {cnpjLoading && <Loader2 className="w-4 h-4 animate-spin absolute right-3 top-4 text-primary" />}
          </div>
          {isPJ && <p className="text-xs text-primary mt-1">Empresa identificada — preenchimento automático ativado</p>}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label className="mb-1.5 block text-sm">{isPJ ? "Razão Social" : "Nome Completo"} *</Label>
            <Input value={form.razaoSocial} onChange={(e) => update("razaoSocial", e.target.value)} className={fieldClass} placeholder={isPJ ? "Razão social da empresa" : "Seu nome completo"} required data-testid="campo-razao-social" />
          </div>
          {isPJ && (
            <div>
              <Label className="mb-1.5 block text-sm">Nome Fantasia</Label>
              <Input value={form.nomeFantasia} onChange={(e) => update("nomeFantasia", e.target.value)} className={fieldClass} placeholder="Nome fantasia (opcional)" />
            </div>
          )}
        </div>
      </div>

      {/* ─── BLOCK 2: Responsible Person ─── */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 pb-2 border-b border-border">
          <User className="w-5 h-5 text-primary" />
          <h3 className="text-base font-bold text-foreground">Responsável pela Contratação</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label className="mb-1.5 block text-sm">Responsável *</Label>
            <Input value={form.responsavel} onChange={(e) => update("responsavel", e.target.value)} className={fieldClass} placeholder="Nome completo do responsável" autoComplete="name" required data-testid="campo-representante-nome" />
            <p className="text-xs text-muted-foreground mt-1">Pessoa que está autorizando esta contratação</p>
          </div>
          <div>
            <Label className="mb-1.5 block text-sm">CPF do Responsável *</Label>
            <Input value={form.responsavelCpf} onChange={(e) => update("responsavelCpf", maskCpf(e.target.value))} className={fieldClass} placeholder="000.000.000-00" maxLength={14} autoComplete="off" inputMode="numeric" required data-testid="campo-representante-cpf" />
          </div>
          <div>
            <Label className="mb-1.5 block text-sm">E-mail *</Label>
            <Input type="email" value={form.email} onChange={(e) => update("email", e.target.value)} className={fieldClass} placeholder="responsavel@email.com" autoComplete="email" required data-testid="campo-representante-email" />
          </div>
          <div>
            <Label className="mb-1.5 block text-sm">WhatsApp do Responsável *</Label>
            <Input value={form.whatsapp} onChange={(e) => update("whatsapp", maskPhone(e.target.value))} className={fieldClass} placeholder="(00) 00000-0000" maxLength={15} autoComplete="tel" inputMode="tel" required data-testid="campo-whatsapp" />
            <p className="text-xs text-muted-foreground mt-1">Utilizado para contato direto sobre este atendimento</p>
          </div>
          <div>
            <Label className="mb-1.5 block text-sm">Telefone Comercial</Label>
            <Input value={form.telefone} onChange={(e) => update("telefone", maskPhone(e.target.value))} className={fieldClass} placeholder="(00) 0000-0000" maxLength={15} autoComplete="tel" inputMode="tel" data-testid="campo-representante-telefone" />
          </div>
        </div>
      </div>

      {/* ─── BLOCK 3: Address ─── */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 pb-2 border-b border-border">
          <MapPin className="w-5 h-5 text-primary" />
          <h3 className="text-base font-bold text-foreground">Endereço</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <Label className="mb-1.5 block text-sm">CEP *</Label>
            <div className="relative">
              <Input value={form.cep} onChange={(e) => update("cep", maskCep(e.target.value))} className={`${fieldClass} pr-10`} placeholder="00000-000" maxLength={9} autoComplete="postal-code" inputMode="numeric" required data-testid="campo-cep" />
              {cepLoading && <Loader2 className="w-4 h-4 animate-spin absolute right-3 top-4 text-primary" />}
            </div>
          </div>
          <div className="md:col-span-2">
            <Label className="mb-1.5 block text-sm">Logradouro *</Label>
            <Input value={form.endereco} onChange={(e) => update("endereco", e.target.value)} className={fieldClass} placeholder="Rua, Avenida..." autoComplete="street-address" required data-testid="campo-logradouro" />
          </div>
          <div>
            <Label className="mb-1.5 block text-sm">Número *</Label>
            <Input value={form.numero} onChange={(e) => update("numero", e.target.value)} className={fieldClass} placeholder="123" required data-testid="campo-numero" />
          </div>
          <div>
            <Label className="mb-1.5 block text-sm">Complemento</Label>
            <Input value={form.complemento} onChange={(e) => update("complemento", e.target.value)} className={fieldClass} placeholder="Sala, andar..." data-testid="campo-complemento" />
          </div>
          <div>
            <Label className="mb-1.5 block text-sm">Bairro</Label>
            <Input value={form.bairro} onChange={(e) => update("bairro", e.target.value)} className={fieldClass} placeholder="Bairro" data-testid="campo-bairro" />
          </div>
          <div>
            <Label className="mb-1.5 block text-sm">Cidade *</Label>
            <Input value={form.cidade} onChange={(e) => update("cidade", e.target.value)} className={fieldClass} placeholder="Sua cidade" autoComplete="address-level2" required data-testid="campo-cidade" />
          </div>
          <div>
            <Label className="mb-1.5 block text-sm">UF *</Label>
            <Input value={form.uf} onChange={(e) => update("uf", e.target.value.toUpperCase().slice(0, 2))} className={fieldClass} placeholder="SP" maxLength={2} autoComplete="address-level1" required data-testid="campo-uf" />
          </div>
        </div>
      </div>

      <Button type="submit" disabled={isLoading} className="w-full h-14 text-base bg-primary hover:bg-primary/90 text-primary-foreground" data-testid="botao-prosseguir-cadastro">
        {isLoading ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <ArrowRight className="w-5 h-5 mr-2" />}
        {submitLabel || "Continuar para o contrato"}
      </Button>
    </form>
  );
};

export default CompanyDataForm;
