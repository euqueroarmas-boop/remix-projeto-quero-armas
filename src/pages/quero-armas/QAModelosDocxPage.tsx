import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { FileText, Upload, Plus, Loader2, CheckCircle, XCircle } from "lucide-react";
import { useQAAuth } from "@/components/quero-armas/hooks/useQAAuth";

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
  const { user, profile } = useQAAuth();
  const [modelos, setModelos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Form state
  const [nomeModelo, setNomeModelo] = useState("");
  const [tipoPeca, setTipoPeca] = useState("defesa_posse_arma");
  const [descricao, setDescricao] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const loadModelos = async () => {
    setLoading(true);
    const { data } = await supabase.from("qa_modelos_docx" as any).select("*").order("created_at", { ascending: false });
    setModelos((data as any[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { loadModelos(); }, []);

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
        nome_modelo: nomeModelo,
        tipo_peca: tipoPeca,
        descricao,
        arquivo_template_path: path,
        variaveis_suportadas_json: VARIAVEIS,
        ativo: true,
        versao: "1.0",
        created_by: user.id,
      });
      if (insertErr) throw insertErr;

      toast.success("Modelo cadastrado com sucesso");
      setShowForm(false);
      setNomeModelo(""); setDescricao(""); setSelectedFile(null);
      loadModelos();
    } catch (err: any) {
      toast.error(err.message || "Erro ao cadastrar modelo");
    } finally {
      setUploading(false);
    }
  };

  const toggleAtivo = async (id: string, ativo: boolean) => {
    await supabase.from("qa_modelos_docx" as any).update({ ativo: !ativo }).eq("id", id);
    loadModelos();
    toast.success(ativo ? "Modelo desativado" : "Modelo ativado");
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <FileText className="h-6 w-6 text-amber-500" /> Modelos DOCX
          </h1>
          <p className="text-sm text-slate-500 mt-1">Templates para geração de peças editáveis</p>
        </div>
        {profile?.perfil !== "leitura_auditoria" && (
          <Button onClick={() => setShowForm(!showForm)} className="bg-amber-600 hover:bg-amber-700">
            <Plus className="h-4 w-4 mr-2" /> Novo Modelo
          </Button>
        )}
      </div>

      {/* Variables info */}
      <div className="bg-white border border-slate-200 rounded-xl p-4">
        <h3 className="text-xs font-medium text-slate-600 mb-2">Variáveis Suportadas</h3>
        <div className="flex flex-wrap gap-2">
          {VARIAVEIS.map(v => (
            <code key={v} className="text-[10px] px-2 py-1 rounded bg-white text-amber-400/70 border border-slate-200 font-mono">{v}</code>
          ))}
        </div>
      </div>

      {/* New model form */}
      {showForm && (
        <div className="bg-white border border-amber-500/20 rounded-xl p-5 space-y-4">
          <h3 className="text-sm font-medium text-slate-700">Cadastrar Novo Modelo</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-slate-600 text-xs">Nome do Modelo</Label>
              <Input value={nomeModelo} onChange={e => setNomeModelo(e.target.value)}
                className="bg-white border-slate-200 text-slate-800" placeholder="Ex: Petição Inicial - Registro de Arma" />
            </div>
            <div className="space-y-2">
              <Label className="text-slate-600 text-xs">Tipo de Peça</Label>
              <Select value={tipoPeca} onValueChange={setTipoPeca}>
                <SelectTrigger className="bg-white border-slate-200 text-slate-700"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TIPOS_PECA.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-slate-600 text-xs">Descrição</Label>
            <Textarea value={descricao} onChange={e => setDescricao(e.target.value)}
              className="bg-white border-slate-200 text-slate-800" rows={2} placeholder="Descrição do modelo e quando utilizá-lo..." />
          </div>
          <div className="space-y-2">
            <Label className="text-slate-600 text-xs">Arquivo Template (.docx)</Label>
            <Input type="file" accept=".docx" onChange={e => setSelectedFile(e.target.files?.[0] || null)}
              className="bg-white border-slate-200 text-slate-600" />
          </div>
          <div className="flex gap-2">
            <Button onClick={handleSubmit} disabled={uploading} className="bg-amber-600 hover:bg-amber-700">
              {uploading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Upload className="h-4 w-4 mr-2" />} Salvar Modelo
            </Button>
            <Button variant="ghost" onClick={() => setShowForm(false)} className="text-slate-600">Cancelar</Button>
          </div>
        </div>
      )}

      {/* Models list */}
      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-amber-500" /></div>
      ) : modelos.length === 0 ? (
        <div className="text-center py-12 text-slate-500">
          <FileText className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p>Nenhum modelo cadastrado</p>
          <p className="text-xs mt-1">Cadastre templates DOCX para geração de peças</p>
        </div>
      ) : (
        <div className="space-y-2">
          {modelos.map((m: any) => (
            <div key={m.id} className="flex items-center gap-4 bg-white border border-slate-200 rounded-lg p-4 hover:border-slate-200 transition-all">
              {m.ativo ? <CheckCircle className="h-4 w-4 text-emerald-400 shrink-0" /> : <XCircle className="h-4 w-4 text-slate-400 shrink-0" />}
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-slate-700">{m.nome_modelo}</div>
                <div className="text-xs text-slate-500 flex items-center gap-2 mt-0.5">
                  <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">{m.tipo_peca?.replace(/_/g, " ")}</span>
                  <span>v{m.versao}</span>
                  <span>{new Date(m.created_at).toLocaleDateString("pt-BR")}</span>
                </div>
                {m.descricao && <p className="text-xs text-slate-400 mt-1 line-clamp-1">{m.descricao}</p>}
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
