import { useState } from "react";
import { MessageSquare, Plus, Send, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import type { CustomerData } from "@/pages/AreaDoClientePage";
import { useClientServiceRequests } from "../hooks/useClientData";
import SectionHeader from "../shared/SectionHeader";
import StatusBadge from "../shared/StatusBadge";
import LoadingSkeleton from "../shared/LoadingSkeleton";
import EmptyState from "../shared/EmptyState";
import { useTranslation } from "react-i18next";

const serviceTypes = [
  { value: "suporte", label: "Suporte Técnico" },
  { value: "infraestrutura", label: "Infraestrutura" },
  { value: "rede", label: "Rede / Conectividade" },
  { value: "servidor", label: "Servidores" },
  { value: "backup", label: "Backup" },
  { value: "seguranca", label: "Segurança" },
  { value: "outro", label: "Outro" },
];

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function PortalSolicitacoes({ customer }: { customer: CustomerData }) {
  const { t } = useTranslation();
  const { requests, loading, setRequests } = useClientServiceRequests(customer.id);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", service_type: "suporte" });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    setSaving(true);

    const { data, error } = await supabase
      .from("service_requests")
      .insert({
        customer_id: customer.id,
        title: form.title,
        description: form.description,
        service_type: form.service_type,
        status: "recebido",
      })
      .select()
      .single();

    if (!error && data) {
      setRequests((prev) => [data, ...prev]);
      await supabase.from("client_events").insert({
        customer_id: customer.id,
        event_type: "solicitacao",
         title: t("clientPortal.requests.newRequestOpened"),
        description: form.title,
        related_id: data.id,
        related_table: "service_requests",
      });
    }

    setSaving(false);
    setShowForm(false);
    setForm({ title: "", description: "", service_type: "suporte" });
  };

  return (
    <div className="space-y-6">
      <SectionHeader
        icon={MessageSquare}
        title={t("clientPortal.tabs.solicitacoes")}
        description={t("clientPortal.requests.description")}
        action={
          <Button size="sm" onClick={() => setShowForm(!showForm)}>
            <Plus size={14} className="mr-1" /> {t("clientPortal.requests.newRequest")}
          </Button>
        }
      />

      {showForm && (
        <Card className="border-primary/30">
          <CardContent className="p-5">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                 <label className="text-xs text-muted-foreground mb-1 block">{t("clientPortal.requests.serviceType")}</label>
                <Select value={form.service_type} onValueChange={(v) => setForm({ ...form, service_type: v })}>
                  <SelectTrigger className="bg-card"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {serviceTypes.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                 <label className="text-xs text-muted-foreground mb-1 block">{t("clientPortal.requests.title")}</label>
                 <Input placeholder={t("clientPortal.requests.titlePlaceholder")} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="bg-card" />
              </div>
              <div>
                 <label className="text-xs text-muted-foreground mb-1 block">{t("clientPortal.requests.descriptionLabel")}</label>
                 <Textarea placeholder={t("clientPortal.requests.descriptionPlaceholder")} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="bg-card" rows={4} />
              </div>
              <div className="flex gap-2 justify-end">
                 <Button type="button" variant="ghost" size="sm" onClick={() => setShowForm(false)}>{t("clientPortal.cancel")}</Button>
                <Button type="submit" size="sm" disabled={saving || !form.title.trim()}>
                  {saving ? <Loader2 size={14} className="animate-spin mr-1" /> : <Send size={14} className="mr-1" />}
                  {t("clientPortal.send")}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <LoadingSkeleton rows={4} />
      ) : requests.length === 0 ? (
         <EmptyState icon={MessageSquare} title={t("clientPortal.requests.emptyTitle")} description={t("clientPortal.requests.emptyDescription")} />
      ) : (
        <div className="space-y-2">
          {requests.map((r) => (
            <Card key={r.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="text-sm font-heading font-bold text-foreground truncate">{r.title}</h4>
                      <StatusBadge status={r.status} />
                    </div>
                    {r.description && <p className="text-xs text-muted-foreground line-clamp-2">{r.description}</p>}
                    <p className="text-[10px] text-muted-foreground mt-1">
                      {serviceTypes.find((t) => t.value === r.service_type)?.label || r.service_type} • {formatDate(r.created_at)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
