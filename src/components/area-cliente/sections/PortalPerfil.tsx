import { useState } from "react";
import { Building2, Save, Loader2, Check } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import type { CustomerData } from "@/pages/AreaDoClientePage";
import SectionHeader from "../shared/SectionHeader";

function formatCnpj(v: string) {
  if (v.length === 14) return v.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  if (v.length === 11) return v.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  return v;
}

export default function PortalPerfil({ customer }: { customer: CustomerData }) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [form, setForm] = useState({
    telefone: customer.telefone || "",
    email: customer.email,
    endereco: customer.endereco || "",
    cidade: customer.cidade || "",
    cep: customer.cep || "",
  });

  const handleSave = async () => {
    setSaving(true);
    await supabase.from("customers").update(form).eq("id", customer.id);
    setSaving(false);
    setSaved(true);
    setEditing(false);
    setTimeout(() => setSaved(false), 3000);
  };

  const fields = [
    { label: "Razão Social", value: customer.razao_social, readonly: true },
    { label: "Nome Fantasia", value: customer.nome_fantasia || "—", readonly: true },
    { label: "CNPJ/CPF", value: formatCnpj(customer.cnpj_ou_cpf), readonly: true },
    { label: "Responsável", value: customer.responsavel, readonly: true },
    { label: "E-mail", value: form.email, key: "email" as const },
    { label: "Telefone", value: form.telefone, key: "telefone" as const },
    { label: "Endereço", value: form.endereco, key: "endereco" as const },
    { label: "Cidade", value: form.cidade, key: "cidade" as const },
    { label: "CEP", value: form.cep, key: "cep" as const },
  ];

  return (
    <div className="space-y-6">
      <SectionHeader
        icon={Building2}
        title="Perfil da Empresa"
        description="Dados cadastrais"
        action={
          !editing ? (
            <Button size="sm" variant="outline" onClick={() => setEditing(true)}>Editar</Button>
          ) : (
            <div className="flex gap-2">
              <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>Cancelar</Button>
              <Button size="sm" onClick={handleSave} disabled={saving}>
                {saving ? <Loader2 size={14} className="animate-spin mr-1" /> : <Save size={14} className="mr-1" />}
                Salvar
              </Button>
            </div>
          )
        }
      />

      {saved && (
        <div className="flex items-center gap-2 text-sm text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-4 py-2">
          <Check size={16} /> Dados atualizados com sucesso
        </div>
      )}

      <Card>
        <CardContent className="p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {fields.map((f) => (
              <div key={f.label}>
                <label className="text-[11px] text-muted-foreground uppercase tracking-wider font-mono mb-1.5 block">{f.label}</label>
                {f.readonly || !editing ? (
                  <p className="text-sm text-foreground font-medium">{f.value || "—"}</p>
                ) : (
                  <Input
                    value={f.value}
                    onChange={(e) => setForm({ ...form, [f.key!]: e.target.value })}
                    className="bg-card text-sm"
                  />
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
