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
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      <DialogContent className="max-w-md max-h-[88vh] overflow-y-auto bg-zinc-950 border border-white/10 text-zinc-100 p-0">
        <DialogHeader className="px-5 pt-5 pb-3 border-b border-white/10">
          <DialogTitle className="text-[13px] uppercase tracking-[0.18em] font-semibold text-zinc-50 flex items-center gap-2">
            <FileText className="h-4 w-4 text-amber-400" />
            Adicionar Documento
          </DialogTitle>
          <p className="text-[11px] text-zinc-500 mt-1">Anexe seu documento e deixe a IA preencher os campos para você revisar.</p>
        </DialogHeader>

        <div className="px-5 py-4 space-y-4">
          {/* TIPO */}
          <div className="space-y-1.5">
            <Label className="text-[10px] uppercase tracking-[0.16em] text-zinc-500 font-semibold">Tipo de documento</Label>
            <Select value={form.tipo_documento} onValueChange={(v) => update("tipo_documento", v)}>
              <SelectTrigger className="h-10 bg-zinc-900 border-white/10 text-zinc-100 hover:border-white/20 focus:border-amber-500/40 focus:ring-amber-500/20">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-zinc-900 border-white/10 text-zinc-100">
                {TIPOS.map((t) => (
                  <SelectItem key={t.value} value={t.value} className="focus:bg-white/5 focus:text-zinc-50">
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* UPLOAD CARD */}
          <div className="rounded-xl border border-white/10 bg-gradient-to-br from-zinc-900 to-zinc-900/40 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-[10px] uppercase tracking-[0.16em] text-zinc-400 font-semibold flex items-center gap-1.5">
                <Paperclip className="h-3 w-3 text-amber-400" />
                Arquivo (foto ou PDF)
              </Label>
              {file && (
                <span className="text-[9px] uppercase tracking-wider text-emerald-400/90 font-semibold">Anexado</span>
              )}
            </div>

            {!file ? (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full rounded-lg border border-dashed border-white/15 bg-zinc-950/50 hover:bg-zinc-900 hover:border-amber-500/30 transition-colors p-5 flex flex-col items-center justify-center gap-2 group"
              >
                <div className="h-9 w-9 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center group-hover:scale-105 transition-transform">
                  <Upload className="h-4 w-4 text-amber-400" />
                </div>
                <div className="text-center">
                  <div className="text-[12px] font-medium text-zinc-200">Toque para enviar</div>
                  <div className="text-[10px] text-zinc-500 mt-0.5">JPG, PNG ou PDF · até 20MB</div>
                </div>
              </button>
            ) : (
              <div className="rounded-lg border border-white/10 bg-zinc-950/60 p-3 flex items-center gap-3">
                <div className="h-9 w-9 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
                  {file.type.startsWith("image/") ? (
                    <ImageIcon className="h-4 w-4 text-emerald-400" />
                  ) : (
                    <FileText className="h-4 w-4 text-emerald-400" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[11px] font-medium text-zinc-100 truncate">{file.name}</div>
                  <div className="text-[10px] text-zinc-500">{(file.size / 1024).toFixed(0)} KB</div>
                </div>
                <button
                  type="button"
                  onClick={() => setFile(null)}
                  className="h-7 w-7 rounded-md bg-white/5 hover:bg-red-500/15 text-zinc-400 hover:text-red-400 flex items-center justify-center transition-colors shrink-0"
                  aria-label="Remover arquivo"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,application/pdf"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="hidden"
            />

            <Button
              type="button"
              size="sm"
              className="w-full h-9 text-[11px] uppercase tracking-wider font-semibold bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-zinc-950 border-0 shadow-lg shadow-amber-500/10 disabled:opacity-40 disabled:cursor-not-allowed"
              onClick={handleExtract}
              disabled={!file || extracting || !file?.type?.startsWith("image/")}
            >
              {extracting ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5 mr-1.5" />}
              {extracting ? "Lendo com IA..." : "Preencher com IA"}
            </Button>
            <p className="text-[10px] text-zinc-500 text-center -mt-1">A IA sugere os campos · você revisa antes de salvar.</p>
          </div>

          {/* CAMPOS */}
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-[10px] uppercase tracking-[0.16em] text-zinc-500 font-semibold">Número do documento</Label>
              <Input
                value={form.numero_documento}
                onChange={(e) => update("numero_documento", e.target.value)}
                className="h-10 bg-zinc-900 border-white/10 text-zinc-100 placeholder:text-zinc-600 focus-visible:ring-amber-500/20 focus-visible:border-amber-500/40"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-[10px] uppercase tracking-[0.16em] text-zinc-500 font-semibold">Órgão emissor</Label>
                <Input
                  value={form.orgao_emissor}
                  onChange={(e) => update("orgao_emissor", e.target.value)}
                  className="h-10 bg-zinc-900 border-white/10 text-zinc-100 placeholder:text-zinc-600 focus-visible:ring-amber-500/20 focus-visible:border-amber-500/40"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] uppercase tracking-[0.16em] text-zinc-500 font-semibold">Data emissão</Label>
                <Input
                  type="date"
                  value={form.data_emissao}
                  onChange={(e) => update("data_emissao", e.target.value)}
                  className="h-10 bg-zinc-900 border-white/10 text-zinc-100 focus-visible:ring-amber-500/20 focus-visible:border-amber-500/40 [color-scheme:dark]"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] uppercase tracking-[0.16em] text-zinc-500 font-semibold">Validade</Label>
              <Input
                type="date"
                value={form.data_validade}
                onChange={(e) => update("data_validade", e.target.value)}
                className="h-10 bg-zinc-900 border-white/10 text-zinc-100 focus-visible:ring-amber-500/20 focus-visible:border-amber-500/40 [color-scheme:dark]"
              />
            </div>
          </div>

          {showArmaFields && (
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.03] p-4 space-y-3">
              <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-amber-400 flex items-center gap-1.5">
                <span className="h-1 w-1 rounded-full bg-amber-400" />
                Dados da arma
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-[10px] uppercase tracking-wider text-zinc-500">Espécie</Label>
                  <Input value={form.arma_especie} onChange={(e) => update("arma_especie", e.target.value)} placeholder="Pistola..." className="h-10 bg-zinc-900 border-white/10 text-zinc-100 placeholder:text-zinc-600 focus-visible:ring-amber-500/20 focus-visible:border-amber-500/40" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] uppercase tracking-wider text-zinc-500">Marca</Label>
                  <Input value={form.arma_marca} onChange={(e) => update("arma_marca", e.target.value)} className="h-10 bg-zinc-900 border-white/10 text-zinc-100 focus-visible:ring-amber-500/20 focus-visible:border-amber-500/40" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] uppercase tracking-wider text-zinc-500">Modelo</Label>
                  <Input value={form.arma_modelo} onChange={(e) => update("arma_modelo", e.target.value)} className="h-10 bg-zinc-900 border-white/10 text-zinc-100 focus-visible:ring-amber-500/20 focus-visible:border-amber-500/40" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] uppercase tracking-wider text-zinc-500">Calibre</Label>
                  <Input value={form.arma_calibre} onChange={(e) => update("arma_calibre", e.target.value)} className="h-10 bg-zinc-900 border-white/10 text-zinc-100 focus-visible:ring-amber-500/20 focus-visible:border-amber-500/40" />
                </div>
                <div className="col-span-2 space-y-1.5">
                  <Label className="text-[10px] uppercase tracking-wider text-zinc-500">Nº de série</Label>
                  <Input value={form.arma_numero_serie} onChange={(e) => update("arma_numero_serie", e.target.value)} className="h-10 bg-zinc-900 border-white/10 text-zinc-100 focus-visible:ring-amber-500/20 focus-visible:border-amber-500/40" />
                </div>
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <Label className="text-[10px] uppercase tracking-[0.16em] text-zinc-500 font-semibold">Observações</Label>
            <Textarea
              value={form.observacoes}
              onChange={(e) => update("observacoes", e.target.value)}
              rows={2}
              className="text-[12px] bg-zinc-900 border-white/10 text-zinc-100 placeholder:text-zinc-600 focus-visible:ring-amber-500/20 focus-visible:border-amber-500/40 resize-none"
            />
          </div>
        </div>

        {/* FOOTER STICKY */}
        <div className="sticky bottom-0 px-5 py-3 border-t border-white/10 bg-zinc-950/95 backdrop-blur flex gap-2">
          <Button variant="outline" size="sm" onClick={onClose} className="flex-1 h-10 text-[11px] uppercase tracking-wider font-semibold bg-transparent border-white/10 text-zinc-300 hover:bg-white/5 hover:text-zinc-100">
            Cancelar
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={saving}
            className="flex-1 h-10 text-[11px] uppercase tracking-wider font-semibold bg-zinc-100 text-zinc-950 hover:bg-white shadow-lg"
          >
            {saving && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
            Salvar documento
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default ClienteDocsHubModal;