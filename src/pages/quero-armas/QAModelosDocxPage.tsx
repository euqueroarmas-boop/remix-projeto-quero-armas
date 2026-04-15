import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { FileText, Upload, Plus, Loader2, CheckCircle, XCircle } from "lucide-react";
import { useQAAuthContext } from "@/components/quero-armas/QAAuthContext";

const TIPOS_PECA = [
  { value: "defesa_posse_arma", label: "Defesa para Posse de Arma" },
  { value: "defesa_porte_arma", label: "Defesa para Porte de Arma" },
  { value: "recurso_administrativo", label: "Recurso Administrativo" },
  { value: "resposta_a_notificacao", label: "Resposta à Notificação" },
];

const VARIAVEIS = [
  "{{titulo}}", "{{cliente_nome}}", "{{cidade}}", "{{estado}}", "{{enderecamento}}",
  "{{preambulo}}", "{{resumo_fatico}}", "{{fundamentacao}}",
  "{{jurisprudencia}}", "{{alegacoes_finais}}", "{{pedidos}}", "{{fechamento}}",
  "{{data_atual}}", "{{assinatura}}",
];

export default function QAModelosDocxPage() {
  const { user, profile } = useQAAuthContext();
  const [modelos, setModelos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [nomeModelo, setNomeModelo] = useState("");
  const [tipoPeca, setTipoPeca] = useState("defesa_posse_arma");
  const [descricao, setDescricao] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const loadModelos = async () => {
    setLoading(true);
    try {
      const { data } = await supabase.from("qa_modelos_docx" as any).select("*").order("created_at", { ascending: false });
      setModelos((data as any[]) ?? []);
    } catch (err) {
      console.error("[QAModelosDocx] loadModelos error:", err);
    } finally {
      setLoading(false);
    }
  };

  const _loadedRef = useRef(false);
  useEffect(() => { if (_loadedRef.current) return; _loadedRef.current = true; loadModelos(); }, []);

  const handleSubmit = async () => {
    if (!nomeModelo.trim()) { toast.error("Informe o nome do modelo"); return; }
    if (!selectedFile) { toast.error("Selecione um arquivo .docx"); return; }
    if (!user) return;

    setUploading(true);
    try {
      const path = `templates/${user.id}/${Date.now()}_${selectedFile.name}`;
      const { error: uploadErr } = await supabase.storage.from("qa-templates").upload(path, selectedFile);
      if (uploadErr) throw uploadErr;

      const { error: insertErr } = await supabase.from("qa_modelos_docx" as any).insert({
        nome_modelo: nomeModelo, tipo_peca: tipoPeca, descricao,
        arquivo_template_path: path, variaveis_suportadas_json: VARIAVEIS,
        ativo: true, versao: "1.0", created_by: user.id,
      });
      if (insertErr) throw insertErr;

      toast.success("Modelo cadastrado com sucesso");
      setShowForm(false);
      setNomeModelo(""); setDescricao(""); setSelectedFile(null);
      loadModelos();
    } catch (err: any) {
      toast.error(err.message || "Erro ao cadastrar modelo");
    } finally { setUploading(false); }
  };

  const toggleAtivo = async (id: string, ativo: boolean) => {
    await supabase.from("qa_modelos_docx" as any).update({ ativo: !ativo }).eq("id", id);
    loadModelos();
    toast.success(ativo ? "Modelo desativado" : "Modelo ativado");
  };

  return (
    <div className="space-y-5 md:space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight flex items-center gap-2" style={{ color: "hsl(220 20% 18%)" }}>
            <FileText className="h-5 w-5" style={{ color: "hsl(230 80% 56%)" }} /> Modelos DOCX
          </h1>
          <p className="text-sm mt-0.5" style={{ color: "hsl(220 10% 62%)" }}>Templates para geração de peças editáveis</p>
        </div>
        {profile?.perfil !== "leitura_auditoria" && (
          <button onClick={() => setShowForm(!showForm)} className="qa-btn-primary flex items-center gap-1.5 no-glow">
            <Plus className="h-3.5 w-3.5" /> Novo Modelo
          </button>
        )}
      </div>

      {/* Variables info */}
      <div className="qa-card p-4">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider mb-2" style={{ color: "hsl(220 10% 45%)" }}>Variáveis Suportadas</h3>
        <div className="flex flex-wrap gap-2">
          {VARIAVEIS.map(v => (
            <code key={v} className="text-[10px] px-2 py-1 rounded-lg font-mono" style={{ background: "hsl(220 20% 97%)", color: "hsl(230 80% 56%)", border: "1px solid hsl(220 13% 91%)" }}>{v}</code>
          ))}
        </div>
      </div>

      {/* New model form */}
      {showForm && (
        <div className="qa-card p-5 space-y-4" style={{ borderColor: "hsl(230 80% 90%)" }}>
          <h3 className="text-sm font-semibold" style={{ color: "hsl(220 20% 18%)" }}>Cadastrar Novo Modelo</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-[11px] font-medium uppercase" style={{ color: "hsl(220 10% 45%)" }}>Nome do Modelo</Label>
              <Input value={nomeModelo} onChange={e => setNomeModelo(e.target.value)}
                className="h-9 bg-white border-slate-200 text-slate-800 uppercase" placeholder="Ex: Petição Inicial - Registro de Arma" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px] font-medium uppercase" style={{ color: "hsl(220 10% 45%)" }}>Tipo de Peça</Label>
              <Select value={tipoPeca} onValueChange={setTipoPeca}>
                <SelectTrigger className="h-9 bg-white border-slate-200 text-slate-700 uppercase"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TIPOS_PECA.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-[11px] font-medium uppercase" style={{ color: "hsl(220 10% 45%)" }}>Descrição</Label>
            <Textarea value={descricao} onChange={e => setDescricao(e.target.value)}
              className="bg-white border-slate-200 text-slate-800 uppercase" rows={2} placeholder="Descrição do modelo e quando utilizá-lo..." />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[11px] font-medium uppercase" style={{ color: "hsl(220 10% 45%)" }}>Arquivo Template (.docx)</Label>
            <Input type="file" accept=".docx" onChange={e => setSelectedFile(e.target.files?.[0] || null)}
              className="h-9 bg-white border-slate-200 text-slate-600" />
          </div>
          <div className="flex gap-2">
            <button onClick={handleSubmit} disabled={uploading} className="qa-btn-primary h-9 px-4 text-xs flex items-center gap-1.5 no-glow">
              {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
              Salvar Modelo
            </button>
            <button onClick={() => setShowForm(false)} className="qa-btn-outline h-9 px-4 text-xs">Cancelar</button>
          </div>
        </div>
      )}

      {/* Models list */}
      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-2 border-slate-200 border-t-blue-500 rounded-full animate-spin" />
        </div>
      ) : modelos.length === 0 ? (
        <div className="text-center py-16">
          <FileText className="h-12 w-12 mx-auto mb-3" style={{ color: "hsl(220 13% 85%)" }} />
          <p className="text-sm" style={{ color: "hsl(220 10% 55%)" }}>Nenhum modelo cadastrado</p>
          <p className="text-xs mt-1" style={{ color: "hsl(220 10% 70%)" }}>Cadastre templates DOCX para geração de peças</p>
        </div>
      ) : (
        <div className="space-y-2">
          {modelos.map((m: any) => (
            <div key={m.id} className="qa-card qa-hover-lift p-4 flex items-center gap-4">
              {m.ativo ? <CheckCircle className="h-4 w-4 text-emerald-500 shrink-0" /> : <XCircle className="h-4 w-4 shrink-0" style={{ color: "hsl(220 10% 70%)" }} />}
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-semibold uppercase" style={{ color: "hsl(220 20% 18%)" }}>{m.nome_modelo}</div>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  <span className="qa-badge text-[10px] uppercase">{m.tipo_peca?.replace(/_/g, " ")}</span>
                  <span className="text-[10px]" style={{ color: "hsl(220 10% 55%)" }}>v{m.versao}</span>
                  <span className="text-[10px]" style={{ color: "hsl(220 10% 62%)" }}>{new Date(m.created_at).toLocaleDateString("pt-BR")}</span>
                </div>
                {m.descricao && <p className="text-xs mt-1 line-clamp-1 uppercase" style={{ color: "hsl(220 10% 55%)" }}>{m.descricao}</p>}
              </div>
              {profile?.perfil === "administrador" && (
                <Switch checked={m.ativo} onCheckedChange={() => toggleAtivo(m.id, m.ativo)} />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
