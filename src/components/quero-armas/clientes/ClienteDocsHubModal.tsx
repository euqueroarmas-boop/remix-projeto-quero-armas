import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Loader2,
  Upload,
  Sparkles,
  X,
  FileText,
  Image as ImageIcon,
  ShieldCheck,
  Calendar,
  Hash,
  Building2,
  Crosshair,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

const TIPOS = [
  { value: "cr", label: "CR — Certificado de Registro", short: "CR · CAC" },
  { value: "craf", label: "CRAF — Registro de Arma (Exército)", short: "CRAF · SIGMA" },
  { value: "sinarm", label: "SINARM — Posse / Porte (PF)", short: "SINARM · PF" },
  { value: "gt", label: "GT — Guia de Tráfego", short: "GT" },
  { value: "gte", label: "GTE — Guia de Tráfego Eventual", short: "GTE" },
  { value: "autorizacao_compra", label: "AC — Autorização de Compra", short: "AC" },
  { value: "outro", label: "Outro documento SIGMA / SINARM", short: "Outro" },
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

/* -------- Field primitives -------- */
function Field({
  label,
  icon: Icon,
  children,
  className,
}: {
  label: string;
  icon?: any;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("group block space-y-1.5", className)}>
      <span className="flex items-center gap-1.5 text-[11px] font-medium text-slate-600">
        {Icon && <Icon className="h-3 w-3 text-slate-400 group-focus-within:text-amber-600 transition-colors" />}
        {label}
      </span>
      {children}
    </label>
  );
}

const inputCls =
  "h-11 rounded-xl bg-white border border-slate-200 text-slate-900 text-sm placeholder:text-slate-300 shadow-sm transition-all hover:border-slate-300 focus-visible:ring-2 focus-visible:ring-amber-500/30 focus-visible:border-amber-500 focus-visible:ring-offset-0";

export function ClienteDocsHubModal({ open, onClose, customerId, qaClienteId, onSaved }: Props) {
  const [form, setForm] = useState<FormState>(EMPTY);
  const [file, setFile] = useState<File | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const showArmaFields = form.tipo_documento !== "cr";
  const tipoAtual = TIPOS.find((t) => t.value === form.tipo_documento);

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

      const { error: insErr } = await supabase.from("qa_documentos_cliente" as any).insert(payload);
      if (insErr) throw insErr;

      toast.success("Documento adicionado com sucesso.");
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

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) setFile(f);
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg p-0 gap-0 overflow-hidden bg-slate-50 border-0 shadow-2xl rounded-2xl max-h-[92vh]">
        {/* HERO */}
        <div className="relative px-6 pt-6 pb-5 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white overflow-hidden">
          <div className="absolute -top-16 -right-16 h-48 w-48 rounded-full bg-amber-500/20 blur-3xl" />
          <div className="absolute -bottom-20 -left-10 h-40 w-40 rounded-full bg-amber-400/10 blur-3xl" />
          <div className="relative flex items-start gap-3">
            <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 shadow-lg shadow-amber-500/30 flex items-center justify-center shrink-0">
              <ShieldCheck className="h-5 w-5 text-slate-900" strokeWidth={2.5} />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-base font-semibold leading-tight">Adicionar Documento</h2>
              <p className="text-[12px] text-slate-300 mt-0.5 leading-snug">
                Anexe seu documento — a IA preenche e você revisa.
              </p>
            </div>
            <button
              onClick={onClose}
              className="h-8 w-8 rounded-lg bg-white/10 hover:bg-white/20 transition-colors flex items-center justify-center text-white/80 hover:text-white"
              aria-label="Fechar"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* BODY */}
        <div className="overflow-y-auto px-6 py-5 space-y-5">
          {/* TIPO PILL */}
          <div>
            <div className="text-[11px] font-medium text-slate-600 mb-2">Que tipo de documento é?</div>
            <Select value={form.tipo_documento} onValueChange={(v) => update("tipo_documento", v)}>
              <SelectTrigger className={cn(inputCls, "h-12 font-medium")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                {TIPOS.map((t) => (
                  <SelectItem key={t.value} value={t.value} className="text-sm">
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* UPLOAD */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="text-[11px] font-medium text-slate-600">Arquivo</div>
              {tipoAtual && (
                <span className="text-[10px] font-semibold tracking-wider uppercase text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                  {tipoAtual.short}
                </span>
              )}
            </div>

            {!file ? (
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={onDrop}
                onClick={() => fileInputRef.current?.click()}
                className={cn(
                  "cursor-pointer rounded-2xl border-2 border-dashed bg-white transition-all p-6 flex flex-col items-center justify-center gap-3 text-center",
                  dragOver
                    ? "border-amber-500 bg-amber-50/60 scale-[1.01]"
                    : "border-slate-200 hover:border-amber-400 hover:bg-amber-50/30",
                )}
              >
                <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-amber-100 to-amber-200 flex items-center justify-center shadow-sm">
                  <Upload className="h-5 w-5 text-amber-700" strokeWidth={2.2} />
                </div>
                <div>
                  <div className="text-sm font-semibold text-slate-900">Toque ou arraste o arquivo</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">JPG · PNG · PDF · até 20MB</div>
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-slate-200 bg-white p-3 flex items-center gap-3 shadow-sm">
                <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-emerald-100 to-emerald-200 flex items-center justify-center shrink-0">
                  {file.type.startsWith("image/") ? (
                    <ImageIcon className="h-5 w-5 text-emerald-700" />
                  ) : (
                    <FileText className="h-5 w-5 text-emerald-700" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-slate-900 truncate">{file.name}</div>
                  <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
                    <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                    {(file.size / 1024).toFixed(0)} KB · pronto
                  </div>
                </div>
                <button
                  onClick={() => setFile(null)}
                  className="h-9 w-9 rounded-xl bg-slate-100 hover:bg-red-50 text-slate-500 hover:text-red-600 flex items-center justify-center transition-colors shrink-0"
                  aria-label="Remover arquivo"
                >
                  <X className="h-4 w-4" />
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

            {/* AI BUTTON */}
            <button
              type="button"
              onClick={handleExtract}
              disabled={!file || extracting || !file?.type?.startsWith("image/")}
              className="mt-3 w-full h-12 rounded-xl relative overflow-hidden group disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:shadow-lg hover:shadow-amber-500/30 active:scale-[0.99]"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-amber-500 via-amber-500 to-orange-500" />
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
              <span className="relative flex items-center justify-center gap-2 text-white text-sm font-semibold">
                {extracting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
                {extracting ? "A IA está lendo o documento..." : "Preencher com IA ✨"}
              </span>
            </button>
            <p className="text-[11px] text-slate-500 text-center mt-2">
              A IA sugere os campos. Você revisa e ajusta antes de salvar.
            </p>
          </div>

          {/* DIVIDER */}
          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-slate-200" />
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Dados do documento</span>
            <div className="h-px flex-1 bg-slate-200" />
          </div>

          {/* CAMPOS */}
          <div className="space-y-3">
            <Field label="Número do documento" icon={Hash}>
              <Input
                value={form.numero_documento}
                onChange={(e) => update("numero_documento", e.target.value)}
                placeholder="Ex.: 1234567"
                className={inputCls}
              />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Órgão emissor" icon={Building2}>
                <Input
                  value={form.orgao_emissor}
                  onChange={(e) => update("orgao_emissor", e.target.value)}
                  placeholder="PF, EB..."
                  className={inputCls}
                />
              </Field>
              <Field label="Emissão" icon={Calendar}>
                <Input
                  type="date"
                  value={form.data_emissao}
                  onChange={(e) => update("data_emissao", e.target.value)}
                  className={inputCls}
                />
              </Field>
            </div>

            <Field label="Validade" icon={Calendar}>
              <Input
                type="date"
                value={form.data_validade}
                onChange={(e) => update("data_validade", e.target.value)}
                className={inputCls}
              />
            </Field>
          </div>

          {/* ARMA */}
          {showArmaFields && (
            <div className="rounded-2xl border border-amber-200/70 bg-gradient-to-br from-amber-50 to-orange-50/40 p-4 space-y-3">
              <div className="flex items-center gap-2 text-[12px] font-semibold text-amber-800">
                <div className="h-7 w-7 rounded-lg bg-amber-200/70 flex items-center justify-center">
                  <Crosshair className="h-3.5 w-3.5 text-amber-700" />
                </div>
                Dados da arma
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Espécie">
                  <Input
                    value={form.arma_especie}
                    onChange={(e) => update("arma_especie", e.target.value)}
                    placeholder="Pistola..."
                    className={inputCls}
                  />
                </Field>
                <Field label="Marca">
                  <Input
                    value={form.arma_marca}
                    onChange={(e) => update("arma_marca", e.target.value)}
                    placeholder="Taurus..."
                    className={inputCls}
                  />
                </Field>
                <Field label="Modelo">
                  <Input
                    value={form.arma_modelo}
                    onChange={(e) => update("arma_modelo", e.target.value)}
                    className={inputCls}
                  />
                </Field>
                <Field label="Calibre">
                  <Input
                    value={form.arma_calibre}
                    onChange={(e) => update("arma_calibre", e.target.value)}
                    placeholder=".380, 9mm..."
                    className={inputCls}
                  />
                </Field>
                <Field label="Nº de série" className="col-span-2">
                  <Input
                    value={form.arma_numero_serie}
                    onChange={(e) => update("arma_numero_serie", e.target.value)}
                    className={inputCls}
                  />
                </Field>
              </div>
            </div>
          )}

          <Field label="Observações (opcional)">
            <Textarea
              value={form.observacoes}
              onChange={(e) => update("observacoes", e.target.value)}
              rows={2}
              placeholder="Alguma informação extra que devamos saber..."
              className="rounded-xl bg-white border-slate-200 text-slate-900 text-sm placeholder:text-slate-300 shadow-sm focus-visible:ring-2 focus-visible:ring-amber-500/30 focus-visible:border-amber-500 resize-none"
            />
          </Field>
        </div>

        {/* FOOTER */}
        <div className="px-6 py-4 border-t border-slate-200 bg-white flex gap-2.5">
          <Button
            variant="outline"
            onClick={onClose}
            className="flex-1 h-11 rounded-xl border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-900 font-medium"
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving}
            className="flex-[1.4] h-11 rounded-xl bg-gradient-to-r from-slate-900 to-slate-800 hover:from-slate-800 hover:to-slate-700 text-white font-semibold shadow-lg shadow-slate-900/20"
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Salvando...
              </>
            ) : (
              <>
                <ShieldCheck className="h-4 w-4 mr-2" />
                Salvar documento
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default ClienteDocsHubModal;
