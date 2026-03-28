import { useState } from "react";
import { useTranslation } from "react-i18next";
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
  razaoSocial: z.string().trim().min(2).max(200),
  nomeFantasia: z.string().trim().max(200).optional(),
  cnpjOuCpf: z.string().trim().min(11).max(18),
  responsavel: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(255),
  telefone: z.string().trim().max(25).optional(),
  endereco: z.string().trim().min(5).max(300),
  cidade: z.string().trim().min(2).max(120),
  cep: z.string().trim().min(8).max(10),
});

interface Props {
  visible: boolean;
  onComplete: (data: CustomerData) => Promise<void>;
  completed: boolean;
}

const formatCnpjCpf = (value: string) => {
  const digits = value.replace(/\D/g, "");
  if (digits.length <= 11) return digits.replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d{1,2})$/, "$1-$2");
  return digits.replace(/(\d{2})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1/$2").replace(/(\d{4})(\d{1,2})$/, "$1-$2");
};
const formatCep = (value: string) => { const digits = value.replace(/\D/g, ""); return digits.replace(/(\d{5})(\d{1,3})/, "$1-$2"); };
const formatPhone = (value: string) => {
  const digits = value.replace(/\D/g, "");
  if (digits.length <= 10) return digits.replace(/(\d{2})(\d)/, "($1) $2").replace(/(\d{4})(\d{1,4})$/, "$1-$2");
  return digits.replace(/(\d{2})(\d)/, "($1) $2").replace(/(\d{5})(\d{1,4})$/, "$1-$2");
};

const CustomerDataForm = ({ visible, onComplete, completed }: Props) => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState<CustomerData>({
    razaoSocial: "", nomeFantasia: "", cnpjOuCpf: "", responsavel: "", email: "", telefone: "", endereco: "", cidade: "", cep: "",
  });

  if (!visible) return null;

  if (completed) {
    return (
      <section id="customer-data" className="py-16 bg-card">
        <div className="container mx-auto px-4 text-center">
          <div className="max-w-md mx-auto bg-background border border-primary/20 rounded-2xl p-8">
            <Building2 className="w-12 h-12 text-primary mx-auto mb-4" />
            <h3 className="text-xl font-heading font-bold mb-2">{t("customerForm.successTitle")}</h3>
            <p className="text-muted-foreground text-sm">{form.razaoSocial} — {form.cnpjOuCpf}</p>
          </div>
        </div>
      </section>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = customerSchema.safeParse(form);
    if (!parsed.success) {
      toast({ title: t("customerForm.validationError"), description: parsed.error.issues[0]?.message || "", variant: "destructive" });
      return;
    }
    setLoading(true);
    try { await onComplete(form); } catch { toast({ title: t("customerForm.saveError"), description: t("customerForm.retryMsg"), variant: "destructive" }); } finally { setLoading(false); }
  };

  const update = (field: keyof CustomerData, value: string) => setForm((prev) => ({ ...prev, [field]: value }));

  return (
    <section id="customer-data" className="py-20 section-dark">
      <div className="container mx-auto px-4">
        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-10">
          <span className="inline-block px-4 py-1.5 mb-4 text-xs font-semibold tracking-widest uppercase bg-primary/10 text-primary rounded-full border border-primary/20">
            {t("customerForm.tag")}
          </span>
          <h2 className="text-2xl md:text-4xl font-heading font-bold mb-3">
            {t("customerForm.title")} <span className="text-primary">{t("customerForm.titleHighlight")}</span>
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto text-sm">{t("customerForm.desc")}</p>
        </motion.div>

        <form onSubmit={handleSubmit} className="max-w-3xl mx-auto space-y-4" noValidate>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="mb-1.5 block text-sm">{t("customerForm.razaoSocial")}</Label>
              <Input value={form.razaoSocial} onChange={(e) => update("razaoSocial", e.target.value)} className="h-12 bg-card border-border" placeholder={t("customerForm.razaoPlaceholder")} required />
            </div>
            <div>
              <Label className="mb-1.5 block text-sm">{t("customerForm.nomeFantasia")}</Label>
              <Input value={form.nomeFantasia} onChange={(e) => update("nomeFantasia", e.target.value)} className="h-12 bg-card border-border" placeholder={t("customerForm.nomeFantasiaPlaceholder")} />
            </div>
            <div>
              <Label className="mb-1.5 block text-sm">{t("customerForm.cnpjCpf")}</Label>
              <Input value={form.cnpjOuCpf} onChange={(e) => update("cnpjOuCpf", formatCnpjCpf(e.target.value))} className="h-12 bg-card border-border" placeholder={t("customerForm.cnpjPlaceholder")} maxLength={18} required />
            </div>
            <div>
              <Label className="mb-1.5 block text-sm">{t("customerForm.responsavel")}</Label>
              <Input value={form.responsavel} onChange={(e) => update("responsavel", e.target.value)} className="h-12 bg-card border-border" placeholder={t("customerForm.responsavelPlaceholder")} required />
            </div>
            <div>
              <Label className="mb-1.5 block text-sm">{t("customerForm.email")}</Label>
              <Input type="email" value={form.email} onChange={(e) => update("email", e.target.value)} className="h-12 bg-card border-border" placeholder={t("customerForm.emailPlaceholder")} required />
            </div>
            <div>
              <Label className="mb-1.5 block text-sm">{t("customerForm.phone")}</Label>
              <Input value={form.telefone} onChange={(e) => update("telefone", formatPhone(e.target.value))} className="h-12 bg-card border-border" placeholder={t("customerForm.phonePlaceholder")} maxLength={15} />
            </div>
            <div className="md:col-span-2">
              <Label className="mb-1.5 block text-sm">{t("customerForm.address")}</Label>
              <Input value={form.endereco} onChange={(e) => update("endereco", e.target.value)} className="h-12 bg-card border-border" placeholder={t("customerForm.addressPlaceholder")} required />
            </div>
            <div>
              <Label className="mb-1.5 block text-sm">{t("customerForm.city")}</Label>
              <Input value={form.cidade} onChange={(e) => update("cidade", e.target.value)} className="h-12 bg-card border-border" placeholder={t("customerForm.cityPlaceholder")} required />
            </div>
            <div>
              <Label className="mb-1.5 block text-sm">{t("customerForm.cep")}</Label>
              <Input value={form.cep} onChange={(e) => update("cep", formatCep(e.target.value))} className="h-12 bg-card border-border" placeholder={t("customerForm.cepPlaceholder")} maxLength={9} required />
            </div>
          </div>
          <Button type="submit" disabled={loading} className="w-full h-14 text-base bg-primary hover:bg-primary/90 text-primary-foreground">
            {loading ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <ArrowRight className="w-5 h-5 mr-2" />}
            {t("customerForm.submit")}
          </Button>
        </form>
      </div>
    </section>
  );
};

export default CustomerDataForm;
