import { useState } from "react";
import { useTranslation } from "react-i18next";
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
  companyName: z.string().trim().min(2).max(120),
  contactName: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(255),
  phone: z.string().trim().max(25),
  city: z.string().trim().max(120),
  observations: z.string().trim().max(1000),
});

const BudgetLeadForm = ({ onSubmit, submitted, onContinueToContract }: Props) => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState<LeadFormData>({
    companyName: "", contactName: "", email: "", phone: "", city: "", observations: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = leadSchema.safeParse(form);
    if (!parsed.success) {
      toast({ title: t("leadForm.validationError"), description: parsed.error.issues[0]?.message || "", variant: "destructive" });
      return;
    }
    const normalized: LeadFormData = {
      companyName: form.companyName.trim(), contactName: form.contactName.trim(),
      email: form.email.trim(), phone: form.phone.trim(), city: form.city.trim(), observations: form.observations.trim(),
    };
    setLoading(true);
    try {
      await onSubmit(normalized);
      toast({ title: t("leadForm.toastSuccess"), description: t("leadForm.toastSuccessDesc") });
    } catch {
      toast({ title: t("leadForm.toastError"), description: t("leadForm.toastErrorDesc"), variant: "destructive" });
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
            <h3 className="text-xl font-heading font-bold">{t("leadForm.successTitle")}</h3>
            <p className="text-muted-foreground text-sm">{t("leadForm.successDesc")}</p>
            <Button onClick={onContinueToContract} className="w-full h-12 text-base bg-primary hover:bg-primary/90 text-primary-foreground">
              {t("leadForm.continueToContract")}
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
        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-10">
          <span className="inline-block px-4 py-1.5 mb-4 text-xs font-semibold tracking-widest uppercase bg-primary/10 text-primary rounded-full border border-primary/20">
            {t("leadForm.tag")}
          </span>
          <h2 className="text-2xl md:text-4xl font-heading font-bold mb-3">
            {t("leadForm.title")} <span className="text-primary">{t("leadForm.titleHighlight")}</span>
          </h2>
        </motion.div>

        <form onSubmit={handleSubmit} className="max-w-2xl mx-auto space-y-4" noValidate>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="mb-1.5 block text-sm">{t("leadForm.companyName")}</Label>
              <Input value={form.companyName} onChange={(e) => setForm({ ...form, companyName: e.target.value })} className="h-12 bg-card border-border" placeholder={t("leadForm.companyPlaceholder")} required />
            </div>
            <div>
              <Label className="mb-1.5 block text-sm">{t("leadForm.contactName")}</Label>
              <Input value={form.contactName} onChange={(e) => setForm({ ...form, contactName: e.target.value })} className="h-12 bg-card border-border" placeholder={t("leadForm.contactPlaceholder")} required />
            </div>
            <div>
              <Label className="mb-1.5 block text-sm">{t("leadForm.email")}</Label>
              <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="h-12 bg-card border-border" placeholder={t("leadForm.emailPlaceholder")} required />
            </div>
            <div>
              <Label className="mb-1.5 block text-sm">{t("leadForm.phone")}</Label>
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="h-12 bg-card border-border" placeholder={t("leadForm.phonePlaceholder")} />
            </div>
            <div>
              <Label className="mb-1.5 block text-sm">{t("leadForm.city")}</Label>
              <Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} className="h-12 bg-card border-border" placeholder={t("leadForm.cityPlaceholder")} />
            </div>
          </div>
          <div>
            <Label className="mb-1.5 block text-sm">{t("leadForm.observations")}</Label>
            <Textarea value={form.observations} onChange={(e) => setForm({ ...form, observations: e.target.value })} className="bg-card border-border" placeholder={t("leadForm.observationsPlaceholder")} rows={3} />
          </div>
          <Button type="submit" disabled={loading} className="w-full h-14 text-base bg-primary hover:bg-primary/90 text-primary-foreground">
            {loading ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Send className="w-5 h-5 mr-2" />}
            {t("leadForm.submit")}
          </Button>
        </form>
      </div>
    </section>
  );
};

export default BudgetLeadForm;
