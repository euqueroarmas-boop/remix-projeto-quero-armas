/**
 * CrafUploadIAModal
 *
 * Fluxo de envio de CRAF com leitura por IA + confirmação humana.
 *
 * Etapas:
 *  1) Cliente escolhe arquivo (PDF/imagem) e ele é enviado ao bucket `qa-documentos`.
 *  2) O arquivo é convertido em data URL e enviado para a Edge Function
 *     `qa-extract-cliente-doc` (tipo_documento = "craf"). A IA devolve uma
 *     sugestão estruturada (marca/modelo/calibre/série/SIGMA/validade).
 *  3) O cliente revê os campos extraídos, ajusta se quiser e CONFIRMA.
 *  4) Salvamos em `public.qa_crafs` (a fonte canônica de CRAF) usando os
 *     campos já existentes — sem alterar schema, sem fonte paralela.
 *
 * Diretriz Global Quero Armas:
 *  - NÃO substitui o `CrafModal` antigo (continua usado para edição manual).
 *  - NÃO duplica armazenamento — apenas reaproveita storage + edge function
 *    `qa-extract-cliente-doc` (já em uso pelo cliente CAC).
 *  - NÃO altera tabelas existentes; usa as colunas atuais de `qa_crafs`.
 */
import { useEffect, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Upload,
  Loader2,
  Sparkles,
  CheckCircle2,
  FileText,
  AlertTriangle,
  Crosshair,
  Hash,
  CalendarDays,
  FileCheck,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  clienteId: number;
}

type Phase = "pick" | "uploading" | "extracting" | "review" | "saving";

interface Sugestao {
  numero_documento: string | null;
  data_validade: string | null; // ISO yyyy-mm-dd
  arma_marca: string | null;
  arma_modelo: string | null;
  arma_calibre: string | null;
  arma_numero_serie: string | null;
  arma_especie: string | null;
  observacoes: string | null;
}

const isoToBr = (iso: string | null): string => {
  if (!iso) return "";
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  return "";
};

const applyDateMask = (raw: string): string => {
  const d = raw.replace(/\D/g, "").slice(0, 8);
  if (d.length <= 2) return d;
  if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`;
  return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
};

const brToIso = (br: string): string | null => {
  const m = br.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  return `${m[3]}-${m[2]}-${m[1]}`;
};

const fileToDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error("Falha ao ler arquivo"));
    r.readAsDataURL(file);
  });

const sanitizeFilename = (name: string) =>
  name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .slice(0, 80);

const buildNomeArma = (s: Sugestao): string => {
  const partes = [s.arma_marca, s.arma_modelo].filter(Boolean).join(" ").trim();
  const cal = (s.arma_calibre || "").trim();
  if (partes && cal) return `${partes} · ${cal}`.toUpperCase();
  if (partes) return partes.toUpperCase();
  return "";
};

export function CrafUploadIAModal({ open, onClose, onSaved, clienteId }: Props) {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [phase, setPhase] = useState<Phase>("pick");
  const [file, setFile] = useState<File | null>(null);
  const [storagePath, setStoragePath] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  // Campos editáveis exibidos para o cliente confirmar
  const [nomeArma, setNomeArma] = useState("");
  const [nomeCraf, setNomeCraf] = useState("");
  const [numeroArma, setNumeroArma] = useState("");
  const [numeroSigma, setNumeroSigma] = useState("");
  const [dataValidadeBr, setDataValidadeBr] = useState("");

  // Reset ao abrir/fechar
  useEffect(() => {
    if (!open) {
      setPhase("pick");
      setFile(null);
      setStoragePath(null);
      setErro(null);
      setNomeArma("");
      setNomeCraf("");
      setNumeroArma("");
      setNumeroSigma("");
      setDataValidadeBr("");
    }
  }, [open]);

  const onPick = () => fileRef.current?.click();

  const onFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    e.target.value = "";
    if (f.size > 20 * 1024 * 1024) {
      toast.error("Arquivo muito grande (limite 20 MB).");
      return;
    }
    setErro(null);
    setFile(f);
    setPhase("uploading");

    try {
      // 1) Upload no bucket compartilhado
      const path = `crafs/${clienteId}/${Date.now()}_${sanitizeFilename(f.name)}`;
      const { error: upErr } = await supabase.storage
        .from("qa-documentos")
        .upload(path, f, {
          contentType: f.type || "application/pdf",
          upsert: false,
        });
      if (upErr) throw upErr;
      setStoragePath(path);

      // 2) Extração IA
      setPhase("extracting");
      const dataUrl = await fileToDataUrl(f);
      const { data, error } = await supabase.functions.invoke(
        "qa-extract-cliente-doc",
        { body: { tipo_documento: "craf", imageDataUrl: dataUrl } },
      );
      if (error) throw error;
      const sugestao = (data as any)?.sugestao as Sugestao | undefined;
      if (!sugestao) throw new Error("A IA não devolveu dados estruturados.");

      // 3) Pré-preenche campos para revisão
      setNomeArma(buildNomeArma(sugestao));
      setNomeCraf((sugestao.numero_documento || "").toUpperCase());
      setNumeroArma((sugestao.arma_numero_serie || "").toUpperCase());
      setNumeroSigma((sugestao.numero_documento || "").toUpperCase());
      setDataValidadeBr(isoToBr(sugestao.data_validade));
      setPhase("review");
    } catch (err: any) {
      console.error("[CrafUploadIAModal] erro", err);
      setErro(err?.message || "Falha ao processar o CRAF.");
      setPhase("pick");
      setFile(null);
    }
  };

  const confirmar = async () => {
    if (!nomeArma.trim()) {
      toast.error("Confirme o nome da arma antes de salvar.");
      return;
    }
    setPhase("saving");
    try {
      const payload: Record<string, any> = {
        cliente_id: clienteId,
        nome_arma: nomeArma.trim().toUpperCase(),
        nome_craf: nomeCraf.trim() ? nomeCraf.trim().toUpperCase() : null,
        numero_arma: numeroArma.trim() ? numeroArma.trim().toUpperCase() : null,
        numero_sigma: numeroSigma.trim() ? numeroSigma.trim().toUpperCase() : null,
        data_validade: brToIso(dataValidadeBr) || null,
      };
      const { error } = await supabase.from("qa_crafs" as any).insert(payload);
      if (error) throw error;
      toast.success("CRAF cadastrado.");
      onSaved();
      onClose();
    } catch (e: any) {
      console.error("[CrafUploadIAModal] save", e);
      toast.error(e?.message || "Falha ao salvar CRAF.");
      setPhase("review");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && phase !== "uploading" && phase !== "extracting" && phase !== "saving" && onClose()}>
      <DialogContent
        onOpenAutoFocus={(e) => e.preventDefault()}
        className="
          !p-0 border-0 bg-white shadow-2xl overflow-hidden
          !fixed !left-1/2 !-translate-x-1/2
          !top-auto !bottom-0 !translate-y-0 !rounded-t-2xl !rounded-b-none
          sm:!top-[5vh] sm:!bottom-auto sm:!rounded-2xl
          !w-full sm:!w-[calc(100vw-2rem)] !max-w-full sm:!max-w-lg
          flex flex-col !max-h-[100dvh] sm:!max-h-[90vh]
        "
      >
        <DialogHeader className="px-5 pt-5 pb-3 border-b border-slate-200/70">
          <DialogTitle className="flex items-center gap-2 text-[12px] font-bold uppercase tracking-[0.18em] text-slate-700">
            <Sparkles className="h-4 w-4 text-amber-500" />
            Enviar CRAF · Leitura com IA
          </DialogTitle>
          <p className="text-[11px] text-slate-500 mt-1">
            A IA lê seu CRAF (PDF ou foto) e preenche os campos. Você confere e confirma.
          </p>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Hidden file input */}
          <input
            ref={fileRef}
            type="file"
            accept="application/pdf,image/*"
            hidden
            onChange={onFileSelected}
          />

          {/* Etapa: escolha de arquivo */}
          {phase === "pick" && (
            <div className="space-y-3">
              {erro && (
                <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-[11px] text-red-700">
                  <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                  <span>{erro}</span>
                </div>
              )}
              <button
                type="button"
                onClick={onPick}
                className="w-full rounded-xl border-2 border-dashed border-amber-300 bg-amber-50/50 hover:bg-amber-50 px-4 py-8 flex flex-col items-center gap-2 transition"
              >
                <Upload className="h-6 w-6 text-amber-600" />
                <span className="text-[12px] font-bold uppercase tracking-wider text-amber-800">
                  Selecionar CRAF
                </span>
                <span className="text-[10px] text-slate-500">
                  PDF ou imagem · até 20 MB
                </span>
              </button>
            </div>
          )}

          {/* Etapa: processando */}
          {(phase === "uploading" || phase === "extracting") && (
            <div className="flex flex-col items-center justify-center gap-3 py-8">
              <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
              <p className="text-[12px] font-semibold uppercase tracking-wider text-slate-600">
                {phase === "uploading" ? "Enviando arquivo…" : "IA lendo o CRAF…"}
              </p>
              <p className="text-[10px] text-slate-400">Isso leva alguns segundos.</p>
            </div>
          )}

          {/* Etapa: revisão */}
          {(phase === "review" || phase === "saving") && (
            <div className="space-y-4">
              <div className="flex items-start gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-[11px] text-emerald-800">
                <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
                <span>
                  A IA leu seu CRAF. <strong>Confira os dados abaixo</strong> e ajuste o que for preciso antes de confirmar.
                </span>
              </div>

              {file && (
                <div className="flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] text-slate-600">
                  <FileText className="h-4 w-4 text-slate-400" />
                  <span className="truncate">{file.name}</span>
                </div>
              )}

              <Field label="Nome da arma" icon={Crosshair} required value={nomeArma} onChange={setNomeArma} />
              <Field label="Nº CRAF / Documento" icon={FileCheck} value={nomeCraf} onChange={setNomeCraf} />
              <div className="grid grid-cols-2 gap-3">
                <Field label="Nº Série da arma" icon={Hash} value={numeroArma} onChange={setNumeroArma} />
                <Field label="Nº SIGMA" icon={Hash} value={numeroSigma} onChange={setNumeroSigma} />
              </div>
              <Field
                label="Validade (DD/MM/AAAA)"
                icon={CalendarDays}
                value={dataValidadeBr}
                onChange={(v) => setDataValidadeBr(applyDateMask(v))}
                placeholder="DD/MM/AAAA"
                maxLength={10}
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-200/70 px-5 py-3 flex items-center justify-end gap-2 bg-slate-50/60">
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            disabled={phase === "uploading" || phase === "extracting" || phase === "saving"}
          >
            Cancelar
          </Button>
          {phase === "review" && (
            <Button
              size="sm"
              onClick={confirmar}
              className="bg-amber-600 hover:bg-amber-700 text-white"
            >
              <CheckCircle2 className="h-4 w-4 mr-1" />
              Confirmar e salvar
            </Button>
          )}
          {phase === "saving" && (
            <Button size="sm" disabled className="bg-amber-600 text-white">
              <Loader2 className="h-4 w-4 mr-1 animate-spin" /> Salvando…
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  value,
  onChange,
  icon: Icon,
  required,
  placeholder,
  maxLength,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  icon?: any;
  required?: boolean;
  placeholder?: string;
  maxLength?: number;
}) {
  return (
    <div>
      <label className="flex items-center gap-1.5 text-[10px] font-semibold text-slate-500 uppercase tracking-[0.1em] mb-1.5">
        {Icon && <Icon className="h-3 w-3 text-amber-500" />}
        {label}
        {required && <span className="text-red-400">*</span>}
      </label>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        maxLength={maxLength}
        className="h-9 text-sm uppercase bg-white border-slate-200/80 text-slate-800 rounded-md
          placeholder:text-slate-300 font-medium
          focus-visible:ring-2 focus-visible:ring-amber-500/20 focus-visible:border-amber-400"
      />
    </div>
  );
}

export default CrafUploadIAModal;