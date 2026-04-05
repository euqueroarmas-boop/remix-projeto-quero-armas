import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
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

const buildSchema = (t: (key: string) => string) =>
  z.object({
    cnpjOuCpf: z.string().trim().min(11, t("checkout.validationCpfCnpj")),
    razaoSocial: z.string().trim().min(2, t("checkout.validationName")),
    responsavel: z.string().trim().min(2, t("checkout.validationResponsible")),
    responsavelCpf: z.string().refine((v) => validateCpf(v), t("checkout.validationCpfInvalid")),
    email: z.string().trim().email(t("checkout.validationEmail")),
    whatsapp: z.string().trim().min(14, t("checkout.validationWhatsapp")),
    cep: z.string().refine((v) => v.replace(/\D/g, "").length === 8, t("checkout.validationCep")),
    endereco: z.string().trim().min(3, t("checkout.validationAddress")),
    numero: z.string().trim().min(1, t("checkout.validationNumber")),
    cidade: z.string().trim().min(2, t("checkout.validationCity")),
    uf: z.string().trim().min(2, t("checkout.validationState")),
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
  const { t } = useTranslation();
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
        toast({ title: t("checkout.cnpjNotFound"), description: t("checkout.cnpjNotFoundDesc"), variant: "destructive" });
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
      toast({ title: t("checkout.dataFound"), description: data.razao_social || "" });
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
    const schema = buildSchema(t);
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      toast({ title: t("checkout.reviewData"), description: parsed.error.issues[0]?.message || t("checkout.invalidData"), variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      await onComplete({ ...form, isPJ });
    } catch {
      toast({ title: t("checkout.saveError"), description: t("checkout.saveErrorDesc"), variant: "destructive" });
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
          {t("checkout.introText")}
        </p>
      </div>

      {/* ─── BLOCK 1: Company Data ─── */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 pb-2 border-b border-border">
          <Building2 className="w-5 h-5 text-primary" />
          <h3 className="text-base font-bold text-foreground">{t("checkout.companyData")}</h3>
        </div>

        <div>
          <Label className="mb-1.5 block text-sm">{t("checkout.cpfCnpj")} *</Label>
          <div className="relative">
            <Input
              value={form.cnpjOuCpf}
              onChange={(e) => update("cnpjOuCpf", maskCnpjCpf(e.target.value))}
              className={`${fieldClass} pr-10`}
              placeholder={t("checkout.cpfCnpjPlaceholder")}
              maxLength={18}
              autoComplete="off"
              inputMode="numeric"
              required
              data-testid="campo-cnpj"
            />
            {cnpjLoading && <Loader2 className="w-4 h-4 animate-spin absolute right-3 top-4 text-primary" />}
          </div>
          {isPJ && <p className="text-xs text-primary mt-1">{t("checkout.companyIdentified")}</p>}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label className="mb-1.5 block text-sm">{isPJ ? t("checkout.razaoSocial") : t("checkout.nomeCompleto")} *</Label>
            <Input value={form.razaoSocial} onChange={(e) => update("razaoSocial", e.target.value)} className={fieldClass} placeholder={isPJ ? t("checkout.razaoSocialPlaceholder") : t("checkout.nomeCompletoPlaceholder")} required data-testid="campo-razao-social" />
          </div>
          {isPJ && (
            <div>
              <Label className="mb-1.5 block text-sm">{t("checkout.nomeFantasia")}</Label>
              <Input value={form.nomeFantasia} onChange={(e) => update("nomeFantasia", e.target.value)} className={fieldClass} placeholder={t("checkout.nomeFantasiaPlaceholder")} />
            </div>
          )}
        </div>
      </div>

      {/* ─── BLOCK 2: Responsible Person ─── */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 pb-2 border-b border-border">
          <User className="w-5 h-5 text-primary" />
          <h3 className="text-base font-bold text-foreground">{t("checkout.responsibleSection")}</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label className="mb-1.5 block text-sm">{t("checkout.responsavel")} *</Label>
            <Input value={form.responsavel} onChange={(e) => update("responsavel", e.target.value)} className={fieldClass} placeholder={t("checkout.responsavelPlaceholder")} autoComplete="name" required data-testid="campo-representante-nome" />
            <p className="text-xs text-muted-foreground mt-1">{t("checkout.responsavelHelper")}</p>
          </div>
          <div>
            <Label className="mb-1.5 block text-sm">{t("checkout.responsavelCpf")} *</Label>
            <Input value={form.responsavelCpf} onChange={(e) => update("responsavelCpf", maskCpf(e.target.value))} className={fieldClass} placeholder="000.000.000-00" maxLength={14} autoComplete="off" inputMode="numeric" required data-testid="campo-representante-cpf" />
          </div>
          <div>
            <Label className="mb-1.5 block text-sm">{t("checkout.email")} *</Label>
            <Input type="email" value={form.email} onChange={(e) => update("email", e.target.value)} className={fieldClass} placeholder={t("checkout.emailPlaceholder")} autoComplete="email" required data-testid="campo-representante-email" />
          </div>
          <div>
            <Label className="mb-1.5 block text-sm">{t("checkout.whatsapp")} *</Label>
            <Input value={form.whatsapp} onChange={(e) => update("whatsapp", maskPhone(e.target.value))} className={fieldClass} placeholder={t("checkout.whatsappPlaceholder")} maxLength={15} autoComplete="tel" inputMode="tel" required data-testid="campo-whatsapp" />
            <p className="text-xs text-muted-foreground mt-1">{t("checkout.whatsappHelper")}</p>
          </div>
          <div>
            <Label className="mb-1.5 block text-sm">{t("checkout.telefoneComercial")}</Label>
            <Input value={form.telefone} onChange={(e) => update("telefone", maskPhone(e.target.value))} className={fieldClass} placeholder={t("checkout.telefonePlaceholder")} maxLength={15} autoComplete="tel" inputMode="tel" data-testid="campo-representante-telefone" />
          </div>
        </div>
      </div>

      {/* ─── BLOCK 3: Address ─── */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 pb-2 border-b border-border">
          <MapPin className="w-5 h-5 text-primary" />
          <h3 className="text-base font-bold text-foreground">{t("checkout.addressSection")}</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <Label className="mb-1.5 block text-sm">{t("checkout.cep")} *</Label>
            <div className="relative">
              <Input value={form.cep} onChange={(e) => update("cep", maskCep(e.target.value))} className={`${fieldClass} pr-10`} placeholder={t("checkout.cepPlaceholder")} maxLength={9} autoComplete="postal-code" inputMode="numeric" required data-testid="campo-cep" />
              {cepLoading && <Loader2 className="w-4 h-4 animate-spin absolute right-3 top-4 text-primary" />}
            </div>
          </div>
          <div className="md:col-span-2">
            <Label className="mb-1.5 block text-sm">{t("checkout.logradouro")} *</Label>
            <Input value={form.endereco} onChange={(e) => update("endereco", e.target.value)} className={fieldClass} placeholder={t("checkout.logradouroPlaceholder")} autoComplete="street-address" required data-testid="campo-logradouro" />
          </div>
          <div>
            <Label className="mb-1.5 block text-sm">{t("checkout.numero")} *</Label>
            <Input value={form.numero} onChange={(e) => update("numero", e.target.value)} className={fieldClass} placeholder={t("checkout.numeroPlaceholder")} required data-testid="campo-numero" />
          </div>
          <div>
            <Label className="mb-1.5 block text-sm">{t("checkout.complemento")}</Label>
            <Input value={form.complemento} onChange={(e) => update("complemento", e.target.value)} className={fieldClass} placeholder={t("checkout.complementoPlaceholder")} data-testid="campo-complemento" />
          </div>
          <div>
            <Label className="mb-1.5 block text-sm">{t("checkout.bairro")}</Label>
            <Input value={form.bairro} onChange={(e) => update("bairro", e.target.value)} className={fieldClass} placeholder={t("checkout.bairroPlaceholder")} data-testid="campo-bairro" />
          </div>
          <div>
            <Label className="mb-1.5 block text-sm">{t("checkout.cidade")} *</Label>
            <Input value={form.cidade} onChange={(e) => update("cidade", e.target.value)} className={fieldClass} placeholder={t("checkout.cidadePlaceholder")} autoComplete="address-level2" required data-testid="campo-cidade" />
          </div>
          <div>
            <Label className="mb-1.5 block text-sm">{t("checkout.uf")} *</Label>
            <Input value={form.uf} onChange={(e) => update("uf", e.target.value.toUpperCase().slice(0, 2))} className={fieldClass} placeholder={t("checkout.ufPlaceholder")} maxLength={2} autoComplete="address-level1" required data-testid="campo-uf" />
          </div>
        </div>
      </div>

      <Button type="submit" disabled={isLoading} className="w-full h-14 text-base bg-primary hover:bg-primary/90 text-primary-foreground" data-testid="botao-prosseguir-cadastro">
        {isLoading ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <ArrowRight className="w-5 h-5 mr-2" />}
        {submitLabel || t("checkout.continueToContract")}
      </Button>
    </form>
  );
};

export default CompanyDataForm;
