import { useState, useEffect } from "react";
import { z } from "zod";
import { Loader2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useBrasilApiLookup } from "@/hooks/useBrasilApiLookup";

export interface RegistrationData {
  razaoSocial: string;
  nomeFantasia: string;
  cnpjOuCpf: string;
  responsavel: string;
  email: string;
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

const registrationSchema = z.object({
  razaoSocial: z.string().trim().min(2, "Informe o nome ou razão social"),
  cnpjOuCpf: z.string().trim().min(11, "Informe o CNPJ ou CPF"),
  responsavel: z.string().trim().min(2, "Informe o responsável"),
  email: z.string().trim().email("E-mail inválido"),
  cep: z.string().trim().min(8, "Informe o CEP"),
  endereco: z.string().trim().min(3, "Informe o endereço"),
  numero: z.string().trim().min(1, "Informe o número"),
  cidade: z.string().trim().min(2, "Informe a cidade"),
  uf: z.string().trim().min(2, "Informe o estado"),
});

interface Props {
  onComplete: (data: RegistrationData) => Promise<void>;
  loading?: boolean;
  initialData?: Partial<RegistrationData>;
}

const formatCnpjCpf = (value: string) => {
  const digits = value.replace(/\D/g, "").slice(0, 14);
  if (digits.length <= 11) {
    return digits
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
  }
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

const QuickRegistrationForm = ({ onComplete, loading: externalLoading, initialData }: Props) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const { lookupCnpj, lookupCep, cnpjLoading, cepLoading } = useBrasilApiLookup();

  const [form, setForm] = useState<RegistrationData>({
    razaoSocial: "",
    nomeFantasia: "",
    cnpjOuCpf: "",
    responsavel: "",
    email: "",
    telefone: "",
    cep: "",
    endereco: "",
    numero: "",
    complemento: "",
    bairro: "",
    cidade: "",
    uf: "",
    isPJ: false,
  });

  useEffect(() => {
    if (!initialData) return;
    setForm((prev) => ({ ...prev, ...initialData }));
  }, [initialData]);

  const update = (field: keyof RegistrationData, value: string | boolean) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  // Auto-detect PJ vs PF
  const rawDoc = form.cnpjOuCpf.replace(/\D/g, "");
  const isPJ = rawDoc.length > 11;

  // CNPJ auto-fill via edge function
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
        endereco: [data.logradouro, data.complemento].filter(Boolean).join(", ") || prev.endereco,
        numero: data.numero || prev.numero,
        bairro: data.bairro || prev.bairro,
        cidade: data.municipio || prev.cidade,
        uf: data.uf || prev.uf,
        cep: data.cep ? formatCep(data.cep) : prev.cep,
        telefone: data.ddd_telefone_1 ? formatPhone(data.ddd_telefone_1.replace(/\D/g, "")) : prev.telefone,
        isPJ: true,
      }));
      toast({ title: "Dados encontrados!", description: `${data.razao_social}` });
    });
  }, [rawDoc, lookupCnpj, toast]);

  // CEP auto-fill via edge function
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
  }, [rawCep, lookupCep]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const parsed = registrationSchema.safeParse(form);
    if (!parsed.success) {
      toast({
        title: "Revise os dados",
        description: parsed.error.issues[0]?.message || "Dados inválidos.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      await onComplete({ ...form, isPJ });
    } catch {
      toast({ title: "Erro ao salvar", description: "Tente novamente.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const isSubmitting = loading || externalLoading;

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      {/* Document field — primary trigger */}
      <div>
        <Label className="mb-1.5 block text-sm">CPF ou CNPJ *</Label>
        <div className="relative">
          <Input
            value={form.cnpjOuCpf}
            onChange={(e) => update("cnpjOuCpf", formatCnpjCpf(e.target.value))}
            className="h-12 bg-card border-border pr-10"
            placeholder="000.000.000-00 ou 00.000.000/0001-00"
            maxLength={18}
            required
          />
          {cnpjLoading && (
            <Loader2 className="w-4 h-4 animate-spin absolute right-3 top-4 text-primary" />
          )}
        </div>
        {isPJ && (
          <p className="text-xs text-primary mt-1">Pessoa Jurídica detectada — dados serão preenchidos automaticamente</p>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label className="mb-1.5 block text-sm">{isPJ ? "Razão Social" : "Nome Completo"} *</Label>
          <Input
            value={form.razaoSocial}
            onChange={(e) => update("razaoSocial", e.target.value)}
            className="h-12 bg-card border-border"
            placeholder={isPJ ? "Empresa LTDA" : "Seu nome completo"}
            required
          />
        </div>
        {isPJ && (
          <div>
            <Label className="mb-1.5 block text-sm">Nome Fantasia</Label>
            <Input
              value={form.nomeFantasia}
              onChange={(e) => update("nomeFantasia", e.target.value)}
              className="h-12 bg-card border-border"
              placeholder="Nome comercial"
            />
          </div>
        )}
        <div>
          <Label className="mb-1.5 block text-sm">Responsável *</Label>
          <Input
            value={form.responsavel}
            onChange={(e) => update("responsavel", e.target.value)}
            className="h-12 bg-card border-border"
            placeholder="Nome do responsável"
            required
          />
        </div>
        <div>
          <Label className="mb-1.5 block text-sm">E-mail *</Label>
          <Input
            type="email"
            value={form.email}
            onChange={(e) => update("email", e.target.value)}
            className="h-12 bg-card border-border"
            placeholder="email@empresa.com"
            required
          />
        </div>
        <div>
          <Label className="mb-1.5 block text-sm">Telefone</Label>
          <Input
            value={form.telefone}
            onChange={(e) => update("telefone", formatPhone(e.target.value))}
            className="h-12 bg-card border-border"
            placeholder="(12) 99999-9999"
            maxLength={15}
          />
        </div>
      </div>

      {/* Address */}
      <div className="pt-2 border-t border-border">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Endereço</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <Label className="mb-1.5 block text-sm">CEP *</Label>
            <div className="relative">
              <Input
                value={form.cep}
                onChange={(e) => update("cep", formatCep(e.target.value))}
                className="h-12 bg-card border-border pr-10"
                placeholder="00000-000"
                maxLength={9}
                required
              />
              {cepLoading && (
                <Loader2 className="w-4 h-4 animate-spin absolute right-3 top-4 text-primary" />
              )}
            </div>
          </div>
          <div className="md:col-span-2">
            <Label className="mb-1.5 block text-sm">Logradouro *</Label>
            <Input
              value={form.endereco}
              onChange={(e) => update("endereco", e.target.value)}
              className="h-12 bg-card border-border"
              placeholder="Rua, Avenida..."
              required
            />
          </div>
          <div>
            <Label className="mb-1.5 block text-sm">Número *</Label>
            <Input
              value={form.numero}
              onChange={(e) => update("numero", e.target.value)}
              className="h-12 bg-card border-border"
              placeholder="123"
              required
            />
          </div>
          <div>
            <Label className="mb-1.5 block text-sm">Complemento</Label>
            <Input
              value={form.complemento}
              onChange={(e) => update("complemento", e.target.value)}
              className="h-12 bg-card border-border"
              placeholder="Sala, andar..."
            />
          </div>
          <div>
            <Label className="mb-1.5 block text-sm">Bairro</Label>
            <Input
              value={form.bairro}
              onChange={(e) => update("bairro", e.target.value)}
              className="h-12 bg-card border-border"
              placeholder="Bairro"
            />
          </div>
          <div>
            <Label className="mb-1.5 block text-sm">Cidade *</Label>
            <Input
              value={form.cidade}
              onChange={(e) => update("cidade", e.target.value)}
              className="h-12 bg-card border-border"
              placeholder="Sua cidade"
              required
            />
          </div>
          <div>
            <Label className="mb-1.5 block text-sm">UF *</Label>
            <Input
              value={form.uf}
              onChange={(e) => update("uf", e.target.value.toUpperCase().slice(0, 2))}
              className="h-12 bg-card border-border"
              placeholder="SP"
              maxLength={2}
              required
            />
          </div>
        </div>
      </div>

      <Button
        type="submit"
        disabled={isSubmitting}
        className="w-full h-14 text-base bg-primary hover:bg-primary/90 text-primary-foreground"
      >
        {isSubmitting ? (
          <Loader2 className="w-5 h-5 animate-spin mr-2" />
        ) : (
          <ArrowRight className="w-5 h-5 mr-2" />
        )}
        Continuar para o contrato
      </Button>
    </form>
  );
};

export default QuickRegistrationForm;
