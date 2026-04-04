import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Save, Loader2, RefreshCw, HelpCircle } from "lucide-react";
import { toast } from "sonner";
import type { CmsPricingRule, CriticalityAnswer } from "@/lib/cmsTypes";
import { calculateCriticality } from "@/lib/cmsTypes";
import { fetchPricingRules, savePricingRule } from "@/lib/cmsApi";

const RESOURCE_LABELS: Record<string, string> = {
  host: "Host (Servidor Físico)",
  vm: "VM (Máquina Virtual)",
  workstation: "Estação de Trabalho",
};

const OS_LABELS: Record<string, string> = {
  windows_server: "Windows Server",
  linux: "Linux",
  windows: "Windows",
  mac: "macOS",
};

export default function PricingEngine() {
  const [rules, setRules] = useState<CmsPricingRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [critMode, setCritMode] = useState<"manual" | "assisted">("manual");
  const [critAnswers, setCritAnswers] = useState<CriticalityAnswer>({
    stopsOperation: false, hasSensitiveData: false, hasCompliance: false,
    needsAfterHours: false, userCount: "small", hasRedundancy: true,
    hasBackup: true, hasMonitoring: true,
  });

  const load = async () => {
    setLoading(true);
    try {
      const data = await fetchPricingRules();
      setRules(data);
    } catch (err: any) {
      toast.error(err.message);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleSave = async (rule: CmsPricingRule) => {
    setSaving(rule.id);
    try {
      await savePricingRule(rule);
      toast.success("Regra salva!");
    } catch (err: any) {
      toast.error(err.message);
    }
    setSaving(null);
  };

  const updateRule = (id: string, field: string, value: unknown) => {
    setRules(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r));
  };

  const critResult = calculateCriticality(critAnswers);

  if (loading) return <div className="text-center py-12"><Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" /></div>;

  return (
    <div className="space-y-6">
      {/* Pricing Rules */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">Tabela de Preços</h3>
          <Button variant="ghost" size="sm" onClick={load} className="h-7 text-[10px] gap-1"><RefreshCw className="h-3 w-3" /> Atualizar</Button>
        </div>

        <div className="grid gap-3">
          {rules.map(rule => (
            <Card key={rule.id} className="border-border/60">
              <CardHeader className="py-3 px-4 flex flex-row items-center justify-between">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-xs">{RESOURCE_LABELS[rule.resource_type] || rule.resource_type}</CardTitle>
                  <Badge variant="secondary" className="text-[9px]">{OS_LABELS[rule.os_type] || rule.os_type}</Badge>
                </div>
                <Button size="sm" onClick={() => handleSave(rule)} disabled={saving === rule.id} className="h-7 text-[10px] gap-1">
                  {saving === rule.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                  Salvar
                </Button>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div>
                    <label className="text-[10px] font-medium text-muted-foreground uppercase">Preço Base (R$)</label>
                    <Input type="number" value={rule.base_price} onChange={e => updateRule(rule.id, "base_price", Number(e.target.value))} className="h-8 text-xs mt-1" />
                  </div>
                  <div>
                    <label className="text-[10px] font-medium text-muted-foreground uppercase">SLA Padrão (×)</label>
                    <Input type="number" step="0.01" value={rule.sla_standard_multiplier} onChange={e => updateRule(rule.id, "sla_standard_multiplier", Number(e.target.value))} className="h-8 text-xs mt-1" />
                  </div>
                  <div>
                    <label className="text-[10px] font-medium text-muted-foreground uppercase">SLA 24h (×)</label>
                    <Input type="number" step="0.01" value={rule.sla_24h_multiplier} onChange={e => updateRule(rule.id, "sla_24h_multiplier", Number(e.target.value))} className="h-8 text-xs mt-1" />
                  </div>
                  <div>
                    <label className="text-[10px] font-medium text-muted-foreground uppercase">Valor Mínimo (R$)</label>
                    <Input type="number" value={rule.min_value} onChange={e => updateRule(rule.id, "min_value", Number(e.target.value))} className="h-8 text-xs mt-1" />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3 mt-3">
                  <div>
                    <label className="text-[10px] font-medium text-muted-foreground uppercase">Criticidade Baixa (×)</label>
                    <Input type="number" step="0.1" value={rule.criticality_low} onChange={e => updateRule(rule.id, "criticality_low", Number(e.target.value))} className="h-8 text-xs mt-1" />
                  </div>
                  <div>
                    <label className="text-[10px] font-medium text-muted-foreground uppercase">Criticidade Média (×)</label>
                    <Input type="number" step="0.1" value={rule.criticality_medium} onChange={e => updateRule(rule.id, "criticality_medium", Number(e.target.value))} className="h-8 text-xs mt-1" />
                  </div>
                  <div>
                    <label className="text-[10px] font-medium text-muted-foreground uppercase">Criticidade Alta (×)</label>
                    <Input type="number" step="0.1" value={rule.criticality_high} onChange={e => updateRule(rule.id, "criticality_high", Number(e.target.value))} className="h-8 text-xs mt-1" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Criticality Assessor */}
      <Card className="border-border/60">
        <CardHeader className="py-3 px-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-xs flex items-center gap-2">
              <HelpCircle className="h-3.5 w-3.5" /> Motor de Criticidade
            </CardTitle>
            <Select value={critMode} onValueChange={v => setCritMode(v as any)}>
              <SelectTrigger className="w-32 h-7 text-[10px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="manual">Manual</SelectItem>
                <SelectItem value="assisted">Assistido</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          {critMode === "assisted" ? (
            <div className="space-y-3">
              {[
                { key: "stopsOperation" as const, label: "A operação para se o sistema cair?" },
                { key: "hasSensitiveData" as const, label: "Possui dados sensíveis/confidenciais?" },
                { key: "hasCompliance" as const, label: "Exige compliance regulatório?" },
                { key: "needsAfterHours" as const, label: "Precisa de suporte fora do horário?" },
              ].map(q => (
                <div key={q.key} className="flex items-center justify-between">
                  <span className="text-[11px] text-foreground">{q.label}</span>
                  <Switch checked={critAnswers[q.key]} onCheckedChange={v => setCritAnswers(prev => ({ ...prev, [q.key]: v }))} />
                </div>
              ))}
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-foreground">Número de usuários</span>
                <Select value={critAnswers.userCount} onValueChange={v => setCritAnswers(prev => ({ ...prev, userCount: v as any }))}>
                  <SelectTrigger className="w-28 h-7 text-[10px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="small">Até 10</SelectItem>
                    <SelectItem value="medium">11-50</SelectItem>
                    <SelectItem value="large">50+</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {[
                { key: "hasRedundancy" as const, label: "Possui redundância?" },
                { key: "hasBackup" as const, label: "Possui backup ativo?" },
                { key: "hasMonitoring" as const, label: "Possui monitoramento?" },
              ].map(q => (
                <div key={q.key} className="flex items-center justify-between">
                  <span className="text-[11px] text-foreground">{q.label}</span>
                  <Switch checked={critAnswers[q.key]} onCheckedChange={v => setCritAnswers(prev => ({ ...prev, [q.key]: v }))} />
                </div>
              ))}
              <div className="mt-4 p-3 rounded-lg bg-muted/30 border border-border/40 text-center">
                <p className="text-[10px] text-muted-foreground uppercase">Criticidade calculada</p>
                <Badge className={`mt-1 text-sm ${critResult === "alto" ? "bg-red-500/20 text-red-400" : critResult === "medio" ? "bg-amber-500/20 text-amber-400" : "bg-emerald-500/20 text-emerald-400"}`}>
                  {critResult.toUpperCase()}
                </Badge>
                <p className="text-[10px] text-muted-foreground mt-1">
                  Multiplicador: ×{critResult === "alto" ? "1.5" : critResult === "medio" ? "1.2" : "1.0"}
                </p>
              </div>
            </div>
          ) : (
            <p className="text-[11px] text-muted-foreground text-center py-4">
              No modo manual, selecione a criticidade diretamente na calculadora do cliente.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
