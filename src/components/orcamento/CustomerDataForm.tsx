import { useState } from "react";
import { z } from "zod";
import { motion } from "framer-motion";
import { Building2, Loader2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

export interface CustomerData {
  razaoSocial: string;
  nomeFantasia: string;
  cnpjOuCpf: string;
  responsavel: string;
  email: string;
  telefone: string;
  endereco: string;
  cidade: string;
  cep: string;
}

const customerSchema = z.object({
  razaoSocial: z.string().trim().min(2, "Informe a razão social").max(200),
  nomeFantasia: z.string().trim().max(200).optional(),
  cnpjOuCpf: z.string().trim().min(11, "Informe o CNPJ ou CPF").max(18),
  responsavel: z.string().trim().min(2, "Informe o responsável").max(120),
  email: z.string().trim().email("E-mail inválido").max(255),
  telefone: z.string().trim().max(25).optional(),
  endereco: z.string().trim().min(5, "Informe o endereço").max(300),
  cidade: z.string().trim().min(2, "Informe a cidade").max(120),
  cep: z.string().trim().min(8, "Informe o CEP").max(10),
});

interface Props {
  visible: boolean;
  onComplete: (data: CustomerData) => Promise<void>;
  completed: boolean;
}

const formatCnpjCpf = (value: string) => {
  const digits = value.replace(/\D/g, "");
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
  const digits = value.replace(/\D/g, "");
  return digits.replace(/(\d{5})(\d{1,3})/, "$1-$2");
};

const formatPhone = (value: string) => {
  const digits = value.replace(/\D/g, "");
  if (digits.length <= 10) {
    return digits
      .replace(/(\d{2})(\d)/, "($1) $2")
      .replace(/(\d{4})(\d{1,4})$/, "$1-$2");
  }
  return digits
    .replace(/(\d{2})(\d)/, "($1) $2")
    .replace(/(\d{5})(\d{1,4})$/, "$1-$2");
};

const CustomerDataForm = ({ visible, onComplete, completed }: Props) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState<CustomerData>({
    razaoSocial: "",
    nomeFantasia: "",
    cnpjOuCpf: "",
    responsavel: "",
    email: "",
    telefone: "",
    endereco: "",
    cidade: "",
    cep: "",
  });

  if (!visible) return null;

  if (completed) {
    return (
      <section id="customer-data" className="py-16 bg-card">
        <div className="container mx-auto px-4 text-center">
          <div className="max-w-md mx-auto bg-background border border-primary/20 rounded-2xl p-8">
            <Building2 className="w-12 h-12 text-primary mx-auto mb-4" />
            <h3 className="text-xl font-heading font-bold mb-2">Dados cadastrados!</h3>
            <p className="text-muted-foreground text-sm">
              {form.razaoSocial} — {form.cnpjOuCpf}
            </p>
          </div>
        </div>
      </section>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = customerSchema.safeParse(form);
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
      await onComplete(form);
    } catch {
      toast({ title: "Erro ao salvar", description: "Tente novamente.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const update = (field: keyof CustomerData, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <section id="customer-data" className="py-20 section-dark">
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-10"
        >
          <span className="inline-block px-4 py-1.5 mb-4 text-xs font-semibold tracking-widest uppercase bg-primary/10 text-primary rounded-full border border-primary/20">
            Dados da Empresa
          </span>
          <h2 className="text-2xl md:text-4xl font-heading font-bold mb-3">
            Preencha os dados para o <span className="text-primary">contrato</span>
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto text-sm">
            Essas informações serão usadas para gerar o contrato automaticamente.
          </p>
        </motion.div>

        <form onSubmit={handleSubmit} className="max-w-3xl mx-auto space-y-4" noValidate>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="mb-1.5 block text-sm">Razão Social *</Label>
              <Input
                value={form.razaoSocial}
                onChange={(e) => update("razaoSocial", e.target.value)}
                className="h-12 bg-card border-border"
                placeholder="Empresa LTDA"
                required
              />
            </div>
            <div>
              <Label className="mb-1.5 block text-sm">Nome Fantasia</Label>
              <Input
                value={form.nomeFantasia}
                onChange={(e) => update("nomeFantasia", e.target.value)}
                className="h-12 bg-card border-border"
                placeholder="Nome comercial"
              />
            </div>
            <div>
              <Label className="mb-1.5 block text-sm">CNPJ ou CPF *</Label>
              <Input
                value={form.cnpjOuCpf}
                onChange={(e) => update("cnpjOuCpf", formatCnpjCpf(e.target.value))}
                className="h-12 bg-card border-border"
                placeholder="00.000.000/0000-00"
                maxLength={18}
                required
              />
            </div>
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
            <div className="md:col-span-2">
              <Label className="mb-1.5 block text-sm">Endereço *</Label>
              <Input
                value={form.endereco}
                onChange={(e) => update("endereco", e.target.value)}
                className="h-12 bg-card border-border"
                placeholder="Rua, número, bairro"
                required
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
              <Label className="mb-1.5 block text-sm">CEP *</Label>
              <Input
                value={form.cep}
                onChange={(e) => update("cep", formatCep(e.target.value))}
                className="h-12 bg-card border-border"
                placeholder="00000-000"
                maxLength={9}
                required
              />
            </div>
          </div>

          <Button
            type="submit"
            disabled={loading}
            className="w-full h-14 text-base bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin mr-2" />
            ) : (
              <ArrowRight className="w-5 h-5 mr-2" />
            )}
            Continuar para o contrato
          </Button>
        </form>
      </div>
    </section>
  );
};

export default CustomerDataForm;
