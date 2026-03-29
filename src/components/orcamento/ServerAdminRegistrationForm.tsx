import { useState, useEffect } from "react";
import { z } from "zod";
import { Loader2, ArrowRight, Building2, User, MapPin, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useBrasilApiLookup } from "@/hooks/useBrasilApiLookup";

/* ─── Types ─── */
export interface ServerAdminRegistrationData {
  cnpj: string;
  razaoSocial: string;
  nomeFantasia: string;
  emailEmpresa: string;
  telefoneEmpresa: string;
  responsavelNome: string;
  responsavelCpf: string;
  responsavelEmail: string;
  responsavelTelefone: string;
  cep: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  uf: string;
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
  cnpj: z.string().refine((v) => v.replace(/\D/g, "").length === 14, "CNPJ inválido"),
  razaoSocial: z.string().trim().min(2, "Informe a razão social"),
  responsavelNome: z.string().trim().min(2, "Informe o nome do responsável"),
  responsavelCpf: z.string().refine((v) => validateCpf(v), "CPF inválido"),
  responsavelEmail: z.string().trim().email("E-mail inválido"),
  responsavelTelefone: z.string().trim().min(14, "Telefone inválido"),
  cep: z.string().refine((v) => v.replace(/\D/g, "").length === 8, "CEP inválido"),
  logradouro: z.string().trim().min(3, "Informe o logradouro"),
  numero: z.string().trim().min(1, "Informe o número"),
  bairro: z.string().trim().min(1, "Informe o bairro"),
  cidade: z.string().trim().min(2, "Informe a cidade"),
  uf: z.string().trim().min(2, "Informe o estado"),
});

/* ─── Masks ─── */
const maskCnpj = (v: string) => {
  const d = v.replace(/\D/g, "").slice(0, 14);
  return d
    .replace(/(\d{2})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1/$2")
    .replace(/(\d{4})(\d{1,2})$/, "$1-$2");
};

const maskCpf = (v: string) => {
  const d = v.replace(/\D/g, "").slice(0, 11);
  return d
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
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

/* ─── Component ─── */
interface Props {
  onComplete: (data: ServerAdminRegistrationData) => Promise<void>;
  loading?: boolean;
}

const ServerAdminRegistrationForm = ({ onComplete, loading: externalLoading }: Props) => {
  const { toast } = useToast();
  const { lookupCnpj, lookupCep, cnpjLoading, cepLoading } = useBrasilApiLookup();
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState<ServerAdminRegistrationData>({
    cnpj: "", razaoSocial: "", nomeFantasia: "", emailEmpresa: "", telefoneEmpresa: "",
    responsavelNome: "", responsavelCpf: "", responsavelEmail: "", responsavelTelefone: "",
    cep: "", logradouro: "", numero: "", complemento: "", bairro: "", cidade: "", uf: "",
  });

  const update = (field: keyof ServerAdminRegistrationData, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  /* ─── CNPJ auto-fill ─── */
  const rawCnpj = form.cnpj.replace(/\D/g, "");
  useEffect(() => {
    if (rawCnpj.length !== 14) return;
    lookupCnpj(rawCnpj).then((data) => {
      if (!data) {
        toast({ title: "CNPJ não encontrado", description: "Não foi possível buscar os dados do CNPJ automaticamente. Você pode preencher manualmente.", variant: "destructive" });
        return;
      }
      setForm((prev) => ({
        ...prev,
        razaoSocial: data.razao_social || prev.razaoSocial,
        nomeFantasia: data.nome_fantasia || prev.nomeFantasia,
        logradouro: data.logradouro || prev.logradouro,
        numero: data.numero || prev.numero,
        complemento: data.complemento || prev.complemento,
        bairro: data.bairro || prev.bairro,
        cidade: data.municipio || prev.cidade,
        uf: data.uf || prev.uf,
        cep: data.cep ? maskCep(data.cep) : prev.cep,
        telefoneEmpresa: data.ddd_telefone_1 ? maskPhone(data.ddd_telefone_1.replace(/\D/g, "")) : prev.telefoneEmpresa,
      }));
      toast({ title: "Dados encontrados!", description: data.razao_social || "" });
    });
  }, [rawCnpj]);

  /* ─── CEP auto-fill ─── */
  const rawCep = form.cep.replace(/\D/g, "");
  useEffect(() => {
    if (rawCep.length !== 8) return;
    lookupCep(rawCep).then((data) => {
      if (!data) {
        toast({ title: "CEP não encontrado", description: "Não foi possível buscar o endereço pelo CEP. Preencha manualmente.", variant: "destructive" });
        return;
      }
      setForm((prev) => ({
        ...prev,
        logradouro: data.street || prev.logradouro,
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
      await onComplete(form);
    } catch {
      toast({ title: "Erro ao salvar", description: "Tente novamente.", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const isLoading = submitting || externalLoading;

  const fieldClass = "h-12 bg-card border-border";

  return (
    <form onSubmit={handleSubmit} className="space-y-8" noValidate>
      {/* Intro text */}
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
          <Label className="mb-1.5 block text-sm">CNPJ *</Label>
          <div className="relative">
            <Input
              value={form.cnpj}
              onChange={(e) => update("cnpj", maskCnpj(e.target.value))}
              className={`${fieldClass} pr-10`}
              placeholder="00.000.000/0001-00"
              maxLength={18}
              autoComplete="off"
              inputMode="numeric"
              required
            />
            {cnpjLoading && <Loader2 className="w-4 h-4 animate-spin absolute right-3 top-4 text-primary" />}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label className="mb-1.5 block text-sm">Razão Social *</Label>
            <Input value={form.razaoSocial} onChange={(e) => update("razaoSocial", e.target.value)} className={fieldClass} placeholder="Razão social da empresa" autoComplete="organization" required />
          </div>
          <div>
            <Label className="mb-1.5 block text-sm">Nome Fantasia</Label>
            <Input value={form.nomeFantasia} onChange={(e) => update("nomeFantasia", e.target.value)} className={fieldClass} placeholder="Nome fantasia (opcional)" />
          </div>
          <div>
            <Label className="mb-1.5 block text-sm">E-mail da empresa</Label>
            <Input type="email" value={form.emailEmpresa} onChange={(e) => update("emailEmpresa", e.target.value)} className={fieldClass} placeholder="contato@empresa.com.br" autoComplete="email" />
          </div>
          <div>
            <Label className="mb-1.5 block text-sm">Telefone da empresa</Label>
            <Input value={form.telefoneEmpresa} onChange={(e) => update("telefoneEmpresa", maskPhone(e.target.value))} className={fieldClass} placeholder="(00) 0000-0000" maxLength={15} autoComplete="tel" inputMode="tel" />
          </div>
        </div>
      </div>

      {/* ─── BLOCK 2: Responsible Person ─── */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 pb-2 border-b border-border">
          <User className="w-5 h-5 text-primary" />
          <h3 className="text-base font-bold text-foreground">Responsável pela Contratação</h3>
        </div>
        <p className="text-xs text-muted-foreground">Informe também o CPF do responsável pela contratação.</p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label className="mb-1.5 block text-sm">Nome completo *</Label>
            <Input value={form.responsavelNome} onChange={(e) => update("responsavelNome", e.target.value)} className={fieldClass} placeholder="Nome completo do responsável" autoComplete="name" required />
          </div>
          <div>
            <Label className="mb-1.5 block text-sm">CPF *</Label>
            <Input value={form.responsavelCpf} onChange={(e) => update("responsavelCpf", maskCpf(e.target.value))} className={fieldClass} placeholder="000.000.000-00" maxLength={14} autoComplete="off" inputMode="numeric" required />
          </div>
          <div>
            <Label className="mb-1.5 block text-sm">E-mail *</Label>
            <Input type="email" value={form.responsavelEmail} onChange={(e) => update("responsavelEmail", e.target.value)} className={fieldClass} placeholder="responsavel@email.com" autoComplete="email" required />
          </div>
          <div>
            <Label className="mb-1.5 block text-sm">Telefone *</Label>
            <Input value={form.responsavelTelefone} onChange={(e) => update("responsavelTelefone", maskPhone(e.target.value))} className={fieldClass} placeholder="(00) 00000-0000" maxLength={15} autoComplete="tel" inputMode="tel" required />
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
              <Input value={form.cep} onChange={(e) => update("cep", maskCep(e.target.value))} className={`${fieldClass} pr-10`} placeholder="00000-000" maxLength={9} autoComplete="postal-code" inputMode="numeric" required />
              {cepLoading && <Loader2 className="w-4 h-4 animate-spin absolute right-3 top-4 text-primary" />}
            </div>
          </div>
          <div className="md:col-span-2">
            <Label className="mb-1.5 block text-sm">Logradouro *</Label>
            <Input value={form.logradouro} onChange={(e) => update("logradouro", e.target.value)} className={fieldClass} placeholder="Rua, Avenida..." autoComplete="street-address" required />
          </div>
          <div>
            <Label className="mb-1.5 block text-sm">Número *</Label>
            <Input value={form.numero} onChange={(e) => update("numero", e.target.value)} className={fieldClass} placeholder="123" required />
          </div>
          <div>
            <Label className="mb-1.5 block text-sm">Complemento</Label>
            <Input value={form.complemento} onChange={(e) => update("complemento", e.target.value)} className={fieldClass} placeholder="Sala, andar..." />
          </div>
          <div>
            <Label className="mb-1.5 block text-sm">Bairro *</Label>
            <Input value={form.bairro} onChange={(e) => update("bairro", e.target.value)} className={fieldClass} placeholder="Bairro" required />
          </div>
          <div>
            <Label className="mb-1.5 block text-sm">Cidade *</Label>
            <Input value={form.cidade} onChange={(e) => update("cidade", e.target.value)} className={fieldClass} placeholder="Sua cidade" autoComplete="address-level2" required />
          </div>
          <div>
            <Label className="mb-1.5 block text-sm">UF *</Label>
            <Input value={form.uf} onChange={(e) => update("uf", e.target.value.toUpperCase().slice(0, 2))} className={fieldClass} placeholder="SP" maxLength={2} autoComplete="address-level1" required />
          </div>
        </div>
      </div>

      <Button type="submit" disabled={isLoading} className="w-full h-14 text-base bg-primary hover:bg-primary/90 text-primary-foreground">
        {isLoading ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <ArrowRight className="w-5 h-5 mr-2" />}
        Continuar para o contrato
      </Button>
    </form>
  );
};

export default ServerAdminRegistrationForm;
