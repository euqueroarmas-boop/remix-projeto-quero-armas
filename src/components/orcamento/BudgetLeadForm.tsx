import { useState } from "react";
import { z } from "zod";
import { motion } from "framer-motion";
import { Send, Loader2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

export interface LeadFormData {
  companyName: string;
  contactName: string;
  email: string;
  phone: string;
  city: string;
  observations: string;
}

interface Props {
  onSubmit: (data: LeadFormData) => Promise<void>;
  submitted: boolean;
  onContinueToContract?: () => void;
}

const leadSchema = z.object({
  companyName: z.string().trim().min(2, "Informe o nome da empresa").max(120, "Nome da empresa muito longo"),
  contactName: z.string().trim().min(2, "Informe o nome do contato").max(120, "Nome do contato muito longo"),
  email: z.string().trim().email("E-mail inválido").max(255, "E-mail muito longo"),
  phone: z.string().trim().max(25, "Telefone muito longo"),
  city: z.string().trim().max(120, "Cidade muito longa"),
  observations: z.string().trim().max(1000, "Observações muito longas"),
});

const BudgetLeadForm = ({ onSubmit, submitted, onContinueToContract }: Props) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState<LeadFormData>({
    companyName: "",
    contactName: "",
    email: "",
    phone: "",
    city: "",
    observations: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const parsed = leadSchema.safeParse(form);
    if (!parsed.success) {
      toast({
        title: "Revise os dados do formulário",
        description: parsed.error.issues[0]?.message || "Dados inválidos.",
        variant: "destructive",
      });
      return;
    }

    const normalized: LeadFormData = {
      companyName: form.companyName.trim(),
      contactName: form.contactName.trim(),
      email: form.email.trim(),
      phone: form.phone.trim(),
      city: form.city.trim(),
      observations: form.observations.trim(),
    };

    setLoading(true);
    try {
      await onSubmit(normalized);
      toast({ title: "Orçamento enviado com sucesso!", description: "Agora você pode revisar e assinar o contrato." });
    } catch {
      toast({ title: "Erro ao enviar", description: "Tente novamente.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <section id="lead-form" className="py-20 section-dark">
        <div className="container mx-auto px-4 text-center">
          <div className="max-w-md mx-auto bg-card border border-primary/20 rounded-2xl p-8 space-y-4">
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
              <Send className="w-8 h-8 text-primary" />
            </div>
            <h3 className="text-xl font-heading font-bold">Orçamento recebido!</h3>
            <p className="text-muted-foreground text-sm">
              Nosso time analisará sua solicitação e entrará em contato em até 24 horas.
            </p>
            <Button
              onClick={onContinueToContract}
              className="w-full h-12 text-base bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              Continuar para contrato
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section id="lead-form" className="py-20 section-dark">
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-10"
        >
          <span className="inline-block px-4 py-1.5 mb-4 text-xs font-semibold tracking-widest uppercase bg-primary/10 text-primary rounded-full border border-primary/20">
            Solicitar Orçamento
          </span>
          <h2 className="text-2xl md:text-4xl font-heading font-bold mb-3">
            Preencha para receber sua <span className="text-primary">proposta</span>
          </h2>
        </motion.div>

        <form onSubmit={handleSubmit} className="max-w-2xl mx-auto space-y-4" noValidate>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="mb-1.5 block text-sm">Nome da empresa *</Label>
              <Input
                value={form.companyName}
                onChange={(e) => setForm({ ...form, companyName: e.target.value })}
                className="h-12 bg-card border-border"
                placeholder="Razão social"
                required
              />
            </div>
            <div>
              <Label className="mb-1.5 block text-sm">Nome do contato *</Label>
              <Input
                value={form.contactName}
                onChange={(e) => setForm({ ...form, contactName: e.target.value })}
                className="h-12 bg-card border-border"
                placeholder="Seu nome"
                required
              />
            </div>
            <div>
              <Label className="mb-1.5 block text-sm">E-mail *</Label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="h-12 bg-card border-border"
                placeholder="email@empresa.com"
                required
              />
            </div>
            <div>
              <Label className="mb-1.5 block text-sm">Telefone</Label>
              <Input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="h-12 bg-card border-border"
                placeholder="(12) 99999-9999"
              />
            </div>
            <div>
              <Label className="mb-1.5 block text-sm">Cidade</Label>
              <Input
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
                className="h-12 bg-card border-border"
                placeholder="Sua cidade"
              />
            </div>
          </div>
          <div>
            <Label className="mb-1.5 block text-sm">Observações</Label>
            <Textarea
              value={form.observations}
              onChange={(e) => setForm({ ...form, observations: e.target.value })}
              className="bg-card border-border"
              placeholder="Informações adicionais sobre sua necessidade..."
              rows={3}
            />
          </div>
          <Button
            type="submit"
            disabled={loading}
            className="w-full h-14 text-base bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin mr-2" />
            ) : (
              <Send className="w-5 h-5 mr-2" />
            )}
            Solicitar orçamento personalizado
          </Button>
        </form>
      </div>
    </section>
  );
};

export default BudgetLeadForm;
