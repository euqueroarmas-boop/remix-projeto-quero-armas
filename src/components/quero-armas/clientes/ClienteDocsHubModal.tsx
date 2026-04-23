import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Upload, Sparkles, X, FileText, Image as ImageIcon, Paperclip } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const TIPOS = [
  { value: "cr", label: "CR — Certificado de Registro (CAC)" },
  { value: "craf", label: "CRAF — Registro de Arma (Exército/SIGMA)" },
  { value: "sinarm", label: "SINARM — Posse/Porte (PF)" },
  { value: "gt", label: "GT — Guia de Tráfego" },
  { value: "gte", label: "GTE — Guia de Tráfego Eventual" },
  { value: "autorizacao_compra", label: "AC — Autorização de Compra" },
  { value: "outro", label: "Outro documento SIGMA/SINARM" },
] as const;

type FormState = {
  tipo_documento: string;
  numero_documento: string;
  orgao_emissor: string;
  data_emissao: string;
  data_validade: string;
  observacoes: string;
  arma_marca: string;
  arma_modelo: string;
  arma_calibre: string;
  arma_numero_serie: string;
  arma_especie: string;
};

const EMPTY: FormState = {
  tipo_documento: "cr",
  numero_documento: "",
  orgao_emissor: "",
  data_emissao: "",
  data_validade: "",
  observacoes: "",
  arma_marca: "",
  arma_modelo: "",
  arma_calibre: "",
  arma_numero_serie: "",
  arma_especie: "",
};

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function sanitize(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80);
}

interface Props {
  open: boolean;
  onClose: () => void;
  customerId: string;
  qaClienteId?: number | null;
  onSaved: () => void;
}

export function ClienteDocsHubModal({ open, onClose, customerId, qaClienteId, onSaved }: Props) {
  const [form, setForm] = useState<FormState>(EMPTY);
  const [file, setFile] = useState<File | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [saving, setSaving] = useState(false);

  const showArmaFields = form.tipo_documento !== "cr";

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleExtract() {
    if (!file) {
      toast.error("Selecione um arquivo (imagem ou PDF) primeiro.");
      return;
    }
    if (!file.type.startsWith("image/")) {
      toast.message("A IA funciona melhor com fotos/imagens. PDFs serão anexados sem extração automática.");
      return;
    }
    setExtracting(true);
    try {
      const dataUrl = await fileToDataUrl(file);
      const { data, error } = await supabase.functions.invoke("qa-extract-cliente-doc", {
        body: { tipo_documento: form.tipo_documento, imageDataUrl: dataUrl },
      });
      if (error) throw error;
      const s = (data as any)?.sugestao || {};
      setForm((prev) => ({
        ...prev,
        numero_documento: s.numero_documento || prev.numero_documento,
        orgao_emissor: s.orgao_emissor || prev.orgao_emissor,
        data_emissao: s.data_emissao || prev.data_emissao,
        data_validade: s.data_validade || prev.data_validade,
        observacoes: s.observacoes || prev.observacoes,
        arma_marca: s.arma_marca || prev.arma_marca,
        arma_modelo: s.arma_modelo || prev.arma_modelo,
        arma_calibre: s.arma_calibre || prev.arma_calibre,
        arma_numero_serie: s.arma_numero_serie || prev.arma_numero_serie,
        arma_especie: s.arma_especie || prev.arma_especie,
      }));
      toast.success("Campos preenchidos pela IA. Revise antes de salvar.");
    } catch (e: any) {
      console.error("[extract] error:", e);
      toast.error(e?.message || "Falha ao processar com IA.");
    } finally {
      setExtracting(false);
    }
  }

  async function handleSave() {
    if (!form.tipo_documento) {
      toast.error("Escolha o tipo de documento.");
      return;
    }
    setSaving(true);
    try {
      let storagePath: string | null = null;
      let fileName: string | null = null;
      let mime: string | null = null;

      if (file) {
        const safe = sanitize(file.name);
        const path = `cliente-docs/${customerId}/${form.tipo_documento}/${Date.now()}_${safe}`;
        const { error: upErr } = await supabase.storage
          .from("qa-documentos")
          .upload(path, file, { upsert: false, contentType: file.type });
        if (upErr) throw upErr;
        storagePath = path;
        fileName = file.name;
        mime = file.type || null;
      }

      const payload: any = {
        customer_id: customerId,
        qa_cliente_id: qaClienteId ?? null,
        tipo_documento: form.tipo_documento,
        numero_documento: form.numero_documento || null,
        orgao_emissor: form.orgao_emissor || null,
        data_emissao: form.data_emissao || null,
        data_validade: form.data_validade || null,
        observacoes: form.observacoes || null,
        arma_marca: showArmaFields ? form.arma_marca || null : null,
        arma_modelo: showArmaFields ? form.arma_modelo || null : null,
        arma_calibre: showArmaFields ? form.arma_calibre || null : null,
        arma_numero_serie: showArmaFields ? form.arma_numero_serie || null : null,
        arma_especie: showArmaFields ? form.arma_especie || null : null,
        arquivo_storage_path: storagePath,
        arquivo_nome: fileName,
        arquivo_mime: mime,
        ia_status: storagePath ? "sugerido" : "nao_processado",
      };

      const { error: insErr } = await supabase
        .from("qa_documentos_cliente" as any)
        .insert(payload);
      if (insErr) throw insErr;

      toast.success("Documento adicionado.");
      setForm(EMPTY);
      setFile(null);
      onSaved();
      onClose();
    } catch (e: any) {
      console.error("[save doc] error:", e);
      toast.error(e?.message || "Falha ao salvar documento.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-sm uppercase tracking-wider">Adicionar Documento</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 text-[12px]">
          <div>
            <Label className="text-[10px] uppercase tracking-wider text-slate-500">Tipo</Label>
            <Select value={form.tipo_documento} onValueChange={(v) => update("tipo_documento", v)}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                {TIPOS.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-lg border border-dashed border-slate-300 p-3 bg-slate-50/50">
            <Label className="text-[10px] uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <Upload className="h-3 w-3" /> Arquivo (foto ou PDF)
            </Label>
            <Input
              type="file"
              accept="image/*,application/pdf"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="h-9 mt-1.5"
            />
            {file && (
              <div className="flex items-center justify-between mt-2 px-2 py-1 bg-white rounded border text-[10px] text-slate-600">
                <span className="truncate">{file.name}</span>
                <button type="button" onClick={() => setFile(null)} className="text-slate-400 hover:text-red-500">
                  <X className="h-3 w-3" />
                </button>
              </div>
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full mt-2 h-8 text-[11px]"
              onClick={handleExtract}
              disabled={!file || extracting || !file?.type?.startsWith("image/")}
            >
              {extracting ? <Loader2 className="h-3 w-3 mr-1.5 animate-spin" /> : <Sparkles className="h-3 w-3 mr-1.5" />}
              {extracting ? "Lendo com IA..." : "Preencher com IA"}
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="col-span-2">
              <Label className="text-[10px] uppercase tracking-wider text-slate-500">Número do documento</Label>
              <Input value={form.numero_documento} onChange={(e) => update("numero_documento", e.target.value)} className="h-9" />
            </div>
            <div>
              <Label className="text-[10px] uppercase tracking-wider text-slate-500">Órgão emissor</Label>
              <Input value={form.orgao_emissor} onChange={(e) => update("orgao_emissor", e.target.value)} className="h-9" />
            </div>
            <div>
              <Label className="text-[10px] uppercase tracking-wider text-slate-500">Data emissão</Label>
              <Input type="date" value={form.data_emissao} onChange={(e) => update("data_emissao", e.target.value)} className="h-9" />
            </div>
            <div className="col-span-2">
              <Label className="text-[10px] uppercase tracking-wider text-slate-500">Validade</Label>
              <Input type="date" value={form.data_validade} onChange={(e) => update("data_validade", e.target.value)} className="h-9" />
            </div>
          </div>

          {showArmaFields && (
            <div className="rounded-lg border border-slate-200 p-3 bg-blue-50/30">
              <div className="text-[10px] font-bold uppercase tracking-wider text-blue-700 mb-2">Dados da arma</div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-[10px] text-slate-500">Espécie</Label>
                  <Input value={form.arma_especie} onChange={(e) => update("arma_especie", e.target.value)} className="h-9" placeholder="Pistola..." />
                </div>
                <div>
                  <Label className="text-[10px] text-slate-500">Marca</Label>
                  <Input value={form.arma_marca} onChange={(e) => update("arma_marca", e.target.value)} className="h-9" />
                </div>
                <div>
                  <Label className="text-[10px] text-slate-500">Modelo</Label>
                  <Input value={form.arma_modelo} onChange={(e) => update("arma_modelo", e.target.value)} className="h-9" />
                </div>
                <div>
                  <Label className="text-[10px] text-slate-500">Calibre</Label>
                  <Input value={form.arma_calibre} onChange={(e) => update("arma_calibre", e.target.value)} className="h-9" />
                </div>
                <div className="col-span-2">
                  <Label className="text-[10px] text-slate-500">Nº de série</Label>
                  <Input value={form.arma_numero_serie} onChange={(e) => update("arma_numero_serie", e.target.value)} className="h-9" />
                </div>
              </div>
            </div>
          )}

          <div>
            <Label className="text-[10px] uppercase tracking-wider text-slate-500">Observações</Label>
            <Textarea value={form.observacoes} onChange={(e) => update("observacoes", e.target.value)} rows={2} className="text-[12px]" />
          </div>

          <div className="flex gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={onClose} className="flex-1 h-9 text-[11px]">Cancelar</Button>
            <Button size="sm" onClick={handleSave} disabled={saving} className="flex-1 h-9 text-[11px]">
              {saving && <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />}
              Salvar documento
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default ClienteDocsHubModal;