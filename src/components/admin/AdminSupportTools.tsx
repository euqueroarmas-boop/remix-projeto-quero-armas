import { useState, useEffect, useCallback } from "react";
import { adminQuerySingle } from "@/lib/adminApi";
import { supabase } from "@/integrations/supabase/client";
import { getValidAdminToken } from "@/lib/adminSession";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SectionHeader } from "@/components/admin/ui/AdminPrimitives";
import { Plus, Loader2, Pencil, Trash2, Upload, Link, Wrench, Power } from "lucide-react";
import { toast } from "sonner";

interface SupportTool {
  id: string;
  name: string;
  description: string | null;
  tool_type: "upload" | "link";
  file_url: string | null;
  external_url: string | null;
  icon_url: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
}

export default function AdminSupportTools() {
  const [tools, setTools] = useState<SupportTool[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<SupportTool | null>(null);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    name: "",
    description: "",
    tool_type: "link" as "upload" | "link",
    external_url: "",
    icon_url: "",
  });
  const [file, setFile] = useState<File | null>(null);

  const fetchTools = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminQuerySingle({
        table: "support_tools",
        select: "*",
        order: { column: "sort_order", ascending: true },
      });
      setTools((res.data as SupportTool[]) || []);
    } catch {
      toast.error("Erro ao carregar ferramentas");
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchTools(); }, [fetchTools]);

  const resetForm = () => {
    setForm({ name: "", description: "", tool_type: "link", external_url: "", icon_url: "" });
    setFile(null);
    setEditing(null);
    setShowForm(false);
  };

  const openEdit = (tool: SupportTool) => {
    setEditing(tool);
    setForm({
      name: tool.name,
      description: tool.description || "",
      tool_type: tool.tool_type,
      external_url: tool.external_url || "",
      icon_url: tool.icon_url || "",
    });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error("Nome é obrigatório"); return; }
    setSaving(true);

    try {
      let fileUrl = editing?.file_url || null;

      if (form.tool_type === "upload" && file) {
        const ext = file.name.split(".").pop();
        const path = `tools/${Date.now()}-${form.name.replace(/\s+/g, "-").toLowerCase()}.${ext}`;
        const { error: upErr } = await supabase.storage.from("support-tools").upload(path, file);
        if (upErr) throw upErr;
        const { data: urlData } = supabase.storage.from("support-tools").getPublicUrl(path);
        fileUrl = urlData.publicUrl;
      }

      const token = getValidAdminToken();
      const url = `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/support_tools`;
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        Prefer: "return=representation",
        "x-admin-token": token || "",
      };

      const body: any = {
        name: form.name,
        description: form.description || null,
        tool_type: form.tool_type,
        external_url: form.tool_type === "link" ? form.external_url || null : null,
        file_url: form.tool_type === "upload" ? fileUrl : null,
        icon_url: form.icon_url || null,
      };

      if (editing) {
        // Use admin-data edge function for update via RPC
        const { error } = await supabase.functions.invoke("admin-data", {
          body: {
            type: "update",
            table: "support_tools",
            id: editing.id,
            data: body,
          },
          headers: { "x-admin-token": token || "" },
        });
        if (error) throw error;
      } else {
        const { error } = await supabase.functions.invoke("admin-data", {
          body: {
            type: "insert",
            table: "support_tools",
            data: body,
          },
          headers: { "x-admin-token": token || "" },
        });
        if (error) throw error;
      }

      toast.success(editing ? "Ferramenta atualizada" : "Ferramenta adicionada");
      resetForm();
      fetchTools();
    } catch (err: any) {
      toast.error(err?.message || "Erro ao salvar");
    }
    setSaving(false);
  };

  const toggleActive = async (tool: SupportTool) => {
    try {
      const token = getValidAdminToken();
      await supabase.functions.invoke("admin-data", {
        body: {
          type: "update",
          table: "support_tools",
          id: tool.id,
          data: { is_active: !tool.is_active },
        },
        headers: { "x-admin-token": token || "" },
      });
      toast.success(tool.is_active ? "Ferramenta desativada" : "Ferramenta ativada");
      fetchTools();
    } catch {
      toast.error("Erro ao atualizar status");
    }
  };

  const deleteTool = async (tool: SupportTool) => {
    if (!confirm(`Remover "${tool.name}"?`)) return;
    try {
      const token = getValidAdminToken();
      await supabase.functions.invoke("admin-data", {
        body: {
          type: "delete",
          table: "support_tools",
          id: tool.id,
        },
        headers: { "x-admin-token": token || "" },
      });
      toast.success("Ferramenta removida");
      fetchTools();
    } catch {
      toast.error("Erro ao remover");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <SectionHeader title="Ferramentas de Suporte" subtitle="Gerencie arquivos e links de suporte remoto disponíveis para clientes" />
        <Button size="sm" onClick={() => { resetForm(); setShowForm(true); }}>
          <Plus size={14} className="mr-1" /> Adicionar
        </Button>
      </div>

      {showForm && (
        <Card className="border-primary/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">{editing ? "Editar Ferramenta" : "Nova Ferramenta"}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 block">Nome *</label>
              <Input placeholder="TeamViewer" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="bg-muted/30 border-border/50" />
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 block">Descrição</label>
              <Textarea placeholder="Acesso remoto rápido e seguro" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="bg-muted/30 border-border/50 min-h-[60px]" />
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 block">Tipo</label>
              <Select value={form.tool_type} onValueChange={(v) => setForm({ ...form, tool_type: v as "upload" | "link" })}>
                <SelectTrigger className="bg-muted/30 border-border/50"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="link">Link externo</SelectItem>
                  <SelectItem value="upload">Upload de arquivo</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {form.tool_type === "link" ? (
              <div>
                <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 block">URL</label>
                <Input placeholder="https://download.teamviewer.com/..." value={form.external_url} onChange={(e) => setForm({ ...form, external_url: e.target.value })} className="bg-muted/30 border-border/50" />
              </div>
            ) : (
              <div>
                <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 block">Arquivo (.exe, .msi)</label>
                <Input type="file" accept=".exe,.msi,.dmg,.pkg,.zip" onChange={(e) => setFile(e.target.files?.[0] || null)} className="bg-muted/30 border-border/50" />
              </div>
            )}
            <div>
              <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 block">URL do Ícone (opcional)</label>
              <Input placeholder="https://..." value={form.icon_url} onChange={(e) => setForm({ ...form, icon_url: e.target.value })} className="bg-muted/30 border-border/50" />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" size="sm" onClick={resetForm}>Cancelar</Button>
              <Button size="sm" onClick={handleSave} disabled={saving}>
                {saving ? <Loader2 size={14} className="animate-spin mr-1" /> : null}
                {editing ? "Salvar" : "Adicionar"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <div className="text-center py-12 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />Carregando...</div>
      ) : tools.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground text-sm">Nenhuma ferramenta cadastrada</div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {tools.map((tool) => (
            <Card key={tool.id} className={`transition-all ${!tool.is_active ? "opacity-50" : ""}`}>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3">
                    {tool.icon_url ? (
                      <img src={tool.icon_url} alt={tool.name} className="w-8 h-8 rounded object-contain" />
                    ) : (
                      <div className="w-8 h-8 rounded bg-primary/10 flex items-center justify-center">
                        <Wrench size={16} className="text-primary" />
                      </div>
                    )}
                    <div>
                      <p className="text-sm font-medium text-foreground">{tool.name}</p>
                      <p className="text-[11px] text-muted-foreground">{tool.description}</p>
                    </div>
                  </div>
                  <Badge variant={tool.is_active ? "default" : "secondary"} className="text-[9px] shrink-0">
                    {tool.is_active ? "Ativo" : "Inativo"}
                  </Badge>
                </div>
                <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                  {tool.tool_type === "link" ? <Link size={12} /> : <Upload size={12} />}
                  <span>{tool.tool_type === "link" ? "Link externo" : "Upload"}</span>
                </div>
                <div className="flex gap-1.5 pt-1">
                  <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => openEdit(tool)}>
                    <Pencil size={12} className="mr-1" /> Editar
                  </Button>
                  <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => toggleActive(tool)}>
                    <Power size={12} className="mr-1" /> {tool.is_active ? "Desativar" : "Ativar"}
                  </Button>
                  <Button size="sm" variant="ghost" className="h-7 text-xs text-destructive hover:text-destructive" onClick={() => deleteTool(tool)}>
                    <Trash2 size={12} className="mr-1" /> Remover
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
