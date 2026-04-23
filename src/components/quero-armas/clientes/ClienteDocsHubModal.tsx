import { useRef, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Calendar,
  CheckCircle2,
  Crosshair,
  FileText,
  Hash,
  Image as ImageIcon,
  Loader2,
  ShieldCheck,
  Sparkles,
  Upload,
  X,
} from "lucide-react";
import { Camera } from "lucide-react";
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
  { value: "outro", label: "Outro documento SIGMA / SINARM", short: "OUTRO" },
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

const modalTheme = {
  "--background": "0 0% 100%",
  "--foreground": "222 47% 11%",
  "--card": "0 0% 100%",
  "--card-foreground": "222 47% 11%",
  "--popover": "0 0% 100%",
  "--popover-foreground": "222 47% 11%",
  "--primary": "222 47% 11%",
  "--primary-foreground": "0 0% 100%",
  "--secondary": "210 40% 96%",
  "--secondary-foreground": "222 47% 11%",
  "--muted": "210 40% 96%",
  "--muted-foreground": "215 16% 47%",
  "--accent": "42 96% 56%",
  "--accent-foreground": "222 47% 11%",
  "--border": "214 32% 91%",
  "--input": "214 32% 91%",
  "--ring": "42 96% 56%",
} as React.CSSProperties;

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

function SectionTitle({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="h-px flex-1 bg-border" />
      <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">{title}</span>
      <div className="h-px flex-1 bg-border" />
    </div>
  );
}

function Field({
  label,
  icon: Icon,
  children,
  className,
}: {
  label: string;
  icon?: typeof Hash;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("block space-y-1.5", className)}>
      <span className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
        {Icon ? <Icon className="h-3.5 w-3.5" /> : null}
        {label}
      </span>
      {children}
    </label>
  );
}

const inputClassName =
  "h-11 rounded-xl border border-input bg-background text-foreground shadow-sm transition-all placeholder:text-muted-foreground/55 hover:border-foreground/15 focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/25 focus-visible:ring-offset-0";

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
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const showArmaFields = form.tipo_documento !== "cr";
  const tipoAtual = TIPOS.find((tipo) => tipo.value === form.tipo_documento);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleExtract() {
    if (!file) {
      toast.error("Selecione um arquivo primeiro.");
      return;
    }
    const isImage = file.type.startsWith("image/");
    const isPdf = file.type === "application/pdf";
    if (!isImage && !isPdf) {
      toast.error("Envie uma foto (JPG/PNG) ou PDF para a IA ler.");
      return;
    }

    setExtracting(true);
    try {
      const dataUrl = await fileToDataUrl(file);
      const { data, error } = await supabase.functions.invoke("qa-extract-cliente-doc", {
        body: { tipo_documento: form.tipo_documento, imageDataUrl: dataUrl },
      });

      if (error) throw error;

      const sugestao = (data as any)?.sugestao || {};
      setForm((prev) => ({
        ...prev,
        numero_documento: sugestao.numero_documento || prev.numero_documento,
        orgao_emissor: sugestao.orgao_emissor || prev.orgao_emissor,
        data_emissao: sugestao.data_emissao || prev.data_emissao,
        data_validade: sugestao.data_validade || prev.data_validade,
        observacoes: sugestao.observacoes || prev.observacoes,
        arma_marca: sugestao.arma_marca || prev.arma_marca,
        arma_modelo: sugestao.arma_modelo || prev.arma_modelo,
        arma_calibre: sugestao.arma_calibre || prev.arma_calibre,
        arma_numero_serie: sugestao.arma_numero_serie || prev.arma_numero_serie,
        arma_especie: sugestao.arma_especie || prev.arma_especie,
      }));

      toast.success("Campos sugeridos pela IA. Revise antes de salvar.");
    } catch (e: any) {
      console.error("[extract] error:", e);
      toast.error(e?.message || "Falha ao processar o documento.");
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

      const { error: insertError } = await supabase.from("qa_documentos_cliente" as any).insert(payload);
      if (insertError) throw insertError;

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

  function handleDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragOver(false);
    const droppedFile = event.dataTransfer.files?.[0];
    if (droppedFile) setFile(droppedFile);
  }

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent
        style={modalTheme}
        className="w-[calc(100vw-1rem)] max-w-xl rounded-[28px] border border-border bg-background p-0 text-foreground shadow-2xl max-h-[92dvh] overflow-hidden gap-0 flex flex-col [&>button.absolute]:hidden"
      >
        <div className="shrink-0 border-b border-border bg-gradient-to-b from-background to-muted/70 px-4 py-4 sm:px-6 sm:py-5">
          <div className="flex items-start gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-accent/18 text-accent-foreground shadow-sm">
              <ShieldCheck className="h-5 w-5" strokeWidth={2.4} />
            </div>

            <div className="min-w-0 flex-1">
              <div className="mb-1 font-tactical text-[11px] font-semibold uppercase tracking-[0.28em] text-muted-foreground">
                Hub documental
              </div>
              <h2 className="font-tactical text-[26px] font-bold uppercase leading-none tracking-[0.04em] text-foreground">
                Adicionar Documento
              </h2>
              <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
                Anexe seu documento, deixe a IA sugerir os campos e revise tudo antes de salvar.
              </p>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border bg-background text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label="Fechar"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-6 sm:py-5 [-webkit-overflow-scrolling:touch]">
          <div className="space-y-5 pb-6">
            <div className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5">
              <Field label="Que tipo de documento é?">
                <Select value={form.tipo_documento} onValueChange={(value) => update("tipo_documento", value)}>
                  <SelectTrigger className={cn(inputClassName, "h-12 rounded-2xl text-left text-sm font-medium")}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="border-border bg-popover text-popover-foreground">
                    {TIPOS.map((tipo) => (
                      <SelectItem key={tipo.value} value={tipo.value} className="focus:bg-muted focus:text-foreground">
                        {tipo.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>

            <div className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Arquivo</div>
                  <div className="mt-1 text-sm text-foreground">Envie foto ou PDF do documento</div>
                </div>
                {tipoAtual ? (
                  <span className="rounded-full bg-accent/18 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-accent-foreground">
                    {tipoAtual.short}
                  </span>
                ) : null}
              </div>

              {!file ? (
                <div className="space-y-2.5">
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    onDragOver={(event) => {
                      event.preventDefault();
                      setDragOver(true);
                    }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={handleDrop}
                    className={cn(
                      "cursor-pointer rounded-2xl border-2 border-dashed p-6 text-center transition-all",
                      dragOver ? "border-accent bg-accent/8" : "border-border bg-muted/45 hover:border-accent hover:bg-accent/6",
                    )}
                  >
                    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/18 text-accent-foreground shadow-sm">
                      <Upload className="h-5 w-5" />
                    </div>
                    <div className="mt-4 text-base font-semibold text-foreground">Toque ou arraste o arquivo</div>
                    <div className="mt-1 text-sm text-muted-foreground">JPG · PNG · PDF · até 20MB</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => cameraInputRef.current?.click()}
                    className="flex w-full items-center justify-center gap-2 rounded-2xl border border-border bg-background px-4 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-muted active:bg-muted"
                  >
                    <Camera className="h-4 w-4" />
                    Tirar foto agora
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-3 rounded-2xl border border-border bg-muted/40 p-3">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-background text-accent-foreground shadow-sm">
                    {file.type.startsWith("image/") ? <ImageIcon className="h-5 w-5" /> : <FileText className="h-5 w-5" />}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold text-foreground">{file.name}</div>
                    <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                      <CheckCircle2 className="h-3.5 w-3.5 text-accent-foreground" />
                      {(file.size / 1024).toFixed(0)} KB
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setFile(null)}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-border bg-background text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
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
                onChange={(event) => setFile(event.target.files?.[0] || null)}
                className="hidden"
              />
              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={(event) => setFile(event.target.files?.[0] || null)}
                className="hidden"
              />

              <Button
                type="button"
                onClick={handleExtract}
                disabled={!file || extracting || !(file.type.startsWith("image/") || file.type === "application/pdf")}
                className="mt-3 h-12 w-full rounded-2xl bg-accent text-accent-foreground hover:bg-accent/90"
              >
                {extracting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                {extracting ? "Lendo documento com IA..." : "Preencher com IA"}
              </Button>

              <p className="mt-2 text-center text-xs leading-relaxed text-muted-foreground">
                A IA sugere os campos e você confirma antes de salvar.
              </p>
            </div>

            <SectionTitle title="Dados do documento" />

            <div className="grid gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5">
              <Field label="Número do documento" icon={Hash}>
                <Input
                  value={form.numero_documento}
                  onChange={(event) => update("numero_documento", event.target.value)}
                  placeholder="Ex.: 1234567"
                  className={inputClassName}
                />
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Órgão emissor">
                  <Input
                    value={form.orgao_emissor}
                    onChange={(event) => update("orgao_emissor", event.target.value)}
                    placeholder="PF, EB..."
                    className={inputClassName}
                  />
                </Field>

                <Field label="Emissão" icon={Calendar}>
                  <Input
                    type="date"
                    value={form.data_emissao}
                    onChange={(event) => update("data_emissao", event.target.value)}
                    className={inputClassName}
                  />
                </Field>
              </div>

              <Field label="Validade" icon={Calendar}>
                <Input
                  type="date"
                  value={form.data_validade}
                  onChange={(event) => update("data_validade", event.target.value)}
                  className={inputClassName}
                />
              </Field>
            </div>

            {showArmaFields ? (
              <div className="rounded-2xl border border-accent/30 bg-accent/8 p-4 shadow-sm sm:p-5">
                <div className="mb-3 flex items-center gap-2">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-background text-accent-foreground shadow-sm">
                    <Crosshair className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Arma vinculada</div>
                    <div className="text-sm font-medium text-foreground">Preencha ou ajuste os dados identificados</div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <Field label="Espécie">
                    <Input
                      value={form.arma_especie}
                      onChange={(event) => update("arma_especie", event.target.value)}
                      placeholder="Pistola"
                      className={inputClassName}
                    />
                  </Field>

                  <Field label="Marca">
                    <Input
                      value={form.arma_marca}
                      onChange={(event) => update("arma_marca", event.target.value)}
                      placeholder="Taurus"
                      className={inputClassName}
                    />
                  </Field>

                  <Field label="Modelo">
                    <Input
                      value={form.arma_modelo}
                      onChange={(event) => update("arma_modelo", event.target.value)}
                      className={inputClassName}
                    />
                  </Field>

                  <Field label="Calibre">
                    <Input
                      value={form.arma_calibre}
                      onChange={(event) => update("arma_calibre", event.target.value)}
                      placeholder="9mm"
                      className={inputClassName}
                    />
                  </Field>

                  <Field label="Nº de série" className="col-span-2">
                    <Input
                      value={form.arma_numero_serie}
                      onChange={(event) => update("arma_numero_serie", event.target.value)}
                      className={inputClassName}
                    />
                  </Field>
                </div>
              </div>
            ) : null}

            <div className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5">
              <Field label="Observações">
                <Textarea
                  value={form.observacoes}
                  onChange={(event) => update("observacoes", event.target.value)}
                  rows={3}
                  placeholder="Se necessário, adicione detalhes complementares."
                  className="min-h-[110px] rounded-2xl border border-input bg-background text-sm text-foreground shadow-sm placeholder:text-muted-foreground/55 focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/25 focus-visible:ring-offset-0 resize-none"
                />
              </Field>
            </div>
          </div>
        </div>

        <div className="shrink-0 border-t border-border bg-background px-4 py-4 sm:px-6">
          <div className="flex gap-2.5">
            <Button
              variant="outline"
              onClick={onClose}
              className="h-11 flex-1 rounded-2xl border-border bg-background text-foreground hover:bg-muted"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving}
              className="h-11 flex-[1.2] rounded-2xl bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}
              {saving ? "Salvando..." : "Salvar documento"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default ClienteDocsHubModal;
