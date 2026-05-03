import { useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Loader2, Sparkles, UploadCloud, X, AlertTriangle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

/**
 * Camada de IA/OCR para o modal "Novo Cliente" da Equipe Quero Armas.
 *
 * - Aceita múltiplos arquivos (imagens, PDFs) e/ou texto livre.
 * - Chama a edge function `qa-cliente-prefill` (Lovable AI / Gemini Vision).
 * - Devolve via onApply um objeto parcial que o modal usa para popular o
 *   formulário existente — sem destruir nada e sempre revisável.
 * - Exibe campos extraídos, confiança e warnings antes de aplicar.
 */

export type PrefillFields = Record<string, any> & {
  warnings?: string[];
  confidence?: Record<string, number>;
  acervo?: any[];
};

const MAX_FILES = 10;
const MAX_BYTES = 20 * 1024 * 1024; // 20MB

function fileToDataUrl(f: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result || ""));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(f);
  });
}

function confidenceTone(c?: number) {
  if (c == null) return "text-slate-400";
  if (c >= 0.85) return "text-emerald-600";
  if (c >= 0.6) return "text-amber-600";
  return "text-red-600";
}

const FIELD_LABELS: Record<string, string> = {
  nome_completo: "Nome", cpf: "CPF", cnpj: "CNPJ", rg: "RG/CIN",
  tipo_documento_identidade: "Tipo doc.", emissor_rg: "Emissor",
  data_expedicao_rg: "Expedição", data_nascimento: "Nascimento",
  sexo: "Sexo", nacionalidade: "Nacionalidade", estado_civil: "Estado civil",
  profissao: "Profissão", escolaridade: "Escolaridade",
  nome_mae: "Mãe", nome_pai: "Pai",
  naturalidade_municipio: "Naturalidade", naturalidade_uf: "UF nat.",
  titulo_eleitor: "Título", cnh: "CNH", ctps: "CTPS", pis_pasep: "PIS/PASEP",
  celular: "Celular", telefone_secundario: "Tel. 2", email: "E-mail",
  cep: "CEP", endereco: "Logradouro", numero: "Nº", complemento: "Compl.",
  bairro: "Bairro", cidade: "Cidade", estado: "UF", pais: "País",
  cep_secundario: "CEP 2", endereco_secundario: "Logradouro 2",
  numero_secundario: "Nº 2", complemento_secundario: "Compl. 2",
  bairro_secundario: "Bairro 2", cidade_secundario: "Cidade 2",
  estado_secundario: "UF 2", pais_secundario: "País 2",
  cr_numero: "CR nº", cr_categoria: "CR cat.", cr_data_emissao: "CR emissão",
  cr_data_validade: "CR validade", cr_orgao_emissor: "CR órgão",
};

export default function ClienteAIPrefill({
  onApply,
}: {
  onApply: (fields: PrefillFields) => void;
}) {
  const [open, setOpen] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<PrefillFields | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const addFiles = (list: FileList | null) => {
    if (!list) return;
    const next: File[] = [...files];
    for (const f of Array.from(list)) {
      if (next.length >= MAX_FILES) {
        toast.error(`Máximo de ${MAX_FILES} arquivos.`);
        break;
      }
      if (f.size > MAX_BYTES) {
        toast.error(`"${f.name}" excede 20MB.`);
        continue;
      }
      next.push(f);
    }
    setFiles(next);
    if (inputRef.current) inputRef.current.value = "";
  };

  const removeFile = (i: number) => setFiles(files.filter((_, idx) => idx !== i));

  const reset = () => {
    setFiles([]); setText(""); setResult(null);
  };

  const run = async () => {
    if (files.length === 0 && !text.trim()) {
      toast.error("Envie ao menos 1 arquivo ou cole um texto.");
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const payloadFiles = await Promise.all(
        files.map(async (f) => ({
          name: f.name,
          mime: f.type || "application/octet-stream",
          data_url: await fileToDataUrl(f),
        })),
      );
      const { data, error } = await supabase.functions.invoke("qa-cliente-prefill", {
        body: { files: payloadFiles, text },
      });
      if (error) throw new Error(error.message || "Falha na extração");
      const fields = (data as any)?.fields ?? {};
      setResult(fields);
      const filled = Object.keys(fields).filter(
        (k) => k !== "confidence" && k !== "warnings" && k !== "acervo" && fields[k],
      ).length;
      toast.success(`IA extraiu ${filled} campo(s). Revise antes de aplicar.`);
    } catch (e: any) {
      toast.error(e?.message || "Não foi possível extrair os dados.");
    } finally {
      setLoading(false);
    }
  };

  const apply = () => {
    if (!result) return;
    onApply(result);
    toast.success("Formulário pré-preenchido. Revise os campos antes de salvar.");
    setOpen(false);
    reset();
  };

  if (!open) {
    return (
      <div className="rounded-xl border border-violet-200 bg-gradient-to-r from-violet-50 to-indigo-50 px-4 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <Sparkles className="h-4 w-4 text-violet-600 shrink-0" />
          <div className="min-w-0">
            <p className="text-[12px] font-bold uppercase tracking-wide text-violet-700">
              Preencher cadastro com IA
            </p>
            <p className="text-[10px] text-violet-600/80 truncate">
              Envie RG, CIN, CNH, comprovante, CR, CRAF, GTE, contrato, ficha, print ou cole texto livre.
            </p>
          </div>
        </div>
        <Button
          size="sm"
          onClick={() => setOpen(true)}
          className="h-8 bg-violet-600 hover:bg-violet-700 text-white text-[11px] uppercase font-semibold gap-1.5"
        >
          <Sparkles className="h-3.5 w-3.5" /> Usar IA
        </Button>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-violet-200 bg-violet-50/30 p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-violet-600" />
          <p className="text-[12px] font-bold uppercase tracking-wide text-violet-700">
            Preencher cadastro com IA
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => { setOpen(false); reset(); }} className="h-7 text-[11px]">
          Fechar
        </Button>
      </div>

      {/* Upload area */}
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); addFiles(e.dataTransfer.files); }}
        onClick={() => inputRef.current?.click()}
        className="border-2 border-dashed border-violet-200 rounded-lg p-4 text-center cursor-pointer hover:border-violet-400 transition-colors bg-white/60"
      >
        <UploadCloud className="h-5 w-5 mx-auto text-violet-500" />
        <p className="text-[11px] text-violet-700 mt-1 font-semibold uppercase">
          Clique ou arraste arquivos (imagens, PDFs — até {MAX_FILES})
        </p>
        <p className="text-[10px] text-slate-500">
          RG, CIN, CNH, CPF, comprovante de endereço, CR, CRAF, GTE, contrato, procuração, ficha…
        </p>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept="image/*,application/pdf"
          className="hidden"
          onChange={(e) => addFiles(e.target.files)}
        />
      </div>

      {files.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {files.map((f, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-1 bg-white border border-slate-200 rounded-md px-2 py-1 text-[10px] text-slate-700"
            >
              <span className="truncate max-w-[140px]">{f.name}</span>
              <button onClick={() => removeFile(i)} className="text-slate-400 hover:text-red-500">
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={3}
        placeholder="Cole aqui texto livre, observações internas ou dados cadastrais soltos…"
        className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-400"
      />

      <div className="flex items-center justify-end gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={reset}
          disabled={loading}
          className="h-8 text-[11px] uppercase"
        >
          Limpar
        </Button>
        <Button
          size="sm"
          onClick={run}
          disabled={loading}
          className="h-8 bg-violet-600 hover:bg-violet-700 text-white text-[11px] uppercase gap-1.5"
        >
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
          {loading ? "Extraindo…" : "Extrair com IA"}
        </Button>
      </div>

      {/* Resultado para revisão */}
      {result && (
        <div className="rounded-lg border border-violet-200 bg-white p-3 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-bold uppercase tracking-wide text-violet-700">
              Dados extraídos — revise antes de aplicar
            </p>
            <Button
              size="sm"
              onClick={apply}
              className="h-7 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] uppercase gap-1"
            >
              <CheckCircle2 className="h-3 w-3" /> Aplicar no formulário
            </Button>
          </div>

          {Array.isArray(result.warnings) && result.warnings.length > 0 && (
            <div className="space-y-1">
              {result.warnings.map((w, i) => (
                <div key={i} className="flex items-start gap-1.5 text-[10px] text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1">
                  <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
                  <span>{w}</span>
                </div>
              ))}
            </div>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 text-[10px]">
            {Object.entries(result)
              .filter(([k, v]) =>
                k !== "confidence" && k !== "warnings" && k !== "acervo" &&
                v != null && String(v).trim() !== "")
              .map(([k, v]) => {
                const conf = result.confidence?.[k];
                return (
                  <div key={k} className="border border-slate-100 rounded px-2 py-1 bg-slate-50/60">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-[9px] uppercase font-semibold text-slate-500 truncate">
                        {FIELD_LABELS[k] ?? k}
                      </span>
                      {conf != null && (
                        <span className={`text-[9px] font-mono ${confidenceTone(conf)}`}>
                          {Math.round(conf * 100)}%
                        </span>
                      )}
                    </div>
                    <div className="text-slate-800 truncate" title={String(v)}>{String(v)}</div>
                  </div>
                );
              })}
          </div>

          {Array.isArray(result.acervo) && result.acervo.length > 0 && (
            <div className="text-[10px] text-slate-600 border-t border-slate-100 pt-2">
              <span className="font-semibold uppercase text-slate-500">
                Acervo identificado:
              </span>{" "}
              {result.acervo.length} item(ns) — serão registrados nas observações para cadastro manual.
            </div>
          )}
        </div>
      )}
    </div>
  );
}