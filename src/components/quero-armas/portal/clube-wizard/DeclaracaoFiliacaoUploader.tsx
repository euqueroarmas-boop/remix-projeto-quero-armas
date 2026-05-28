// ============================================================================
// DeclaracaoFiliacaoUploader
// ----------------------------------------------------------------------------
// Recebe PDF/JPG/PNG da declaração de filiação, envia em base64 para a edge
// `qa-extrair-declaracao-filiacao` e devolve os dados extraídos. NÃO persiste.
// ============================================================================
import { useRef, useState } from "react";
import { FileUp, Loader2, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export interface DeclaracaoExtraida {
  clube?: {
    nome?: string;
    cnpj?: string;
    numero_cr?: string;
    data_cr?: string;
    endereco?: string;
    cidade?: string;
    uf?: string;
  };
  filiacao?: {
    numero?: string;
    validade?: string;
    data_admissao?: string;
  };
  cliente?: { nome?: string; cpf?: string };
}

interface Props {
  onExtracted: (data: DeclaracaoExtraida, fileName: string) => void;
  onCancel: () => void;
}

const MAX_BYTES = 10 * 1024 * 1024;
const ACCEPT = "application/pdf,image/jpeg,image/png,image/jpg";

export default function DeclaracaoFiliacaoUploader({ onExtracted, onCancel }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  const handleFile = async (file: File) => {
    setErro(null);
    if (!ACCEPT.split(",").includes(file.type)) {
      setErro("Formato inválido. Envie PDF, JPG ou PNG.");
      return;
    }
    if (file.size > MAX_BYTES) {
      setErro("Arquivo muito grande (máximo 10MB).");
      return;
    }
    setFileName(file.name);
    setLoading(true);
    try {
      const base64 = await fileToBase64(file);
      const { data, error } = await supabase.functions.invoke("qa-extrair-declaracao-filiacao", {
        body: { file_base64: base64, mime_type: file.type, file_name: file.name },
      });
      if (error) throw error;
      if (!data || (data as any)?.error) throw new Error((data as any)?.error || "Falha na extração");
      onExtracted((data as any)?.dados ?? {}, file.name);
    } catch (e: any) {
      setErro(e?.message || "Não conseguimos ler essa declaração agora.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void handleFile(f);
        }}
      />
      <button
        type="button"
        disabled={loading}
        onClick={() => inputRef.current?.click()}
        className="w-full rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 px-4 py-8 hover:border-[#7A1F2B] hover:bg-[#FBF3F4] transition-colors disabled:opacity-60"
      >
        <div className="flex flex-col items-center gap-2 text-slate-600">
          {loading ? <Loader2 className="h-6 w-6 animate-spin" /> : <FileUp className="h-6 w-6" />}
          <div className="text-[13px] font-bold uppercase">
            {loading ? "Lendo sua declaração..." : "Enviar declaração de filiação"}
          </div>
          <div className="text-[11px] text-slate-500">PDF, JPG ou PNG · até 10MB</div>
          {fileName && !loading && <div className="text-[11px] font-mono text-slate-500 mt-1">{fileName}</div>}
        </div>
      </button>

      {erro && (
        <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{erro}</span>
        </div>
      )}

      <button
        type="button"
        onClick={onCancel}
        disabled={loading}
        className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-[12px] font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
      >
        Voltar
      </button>
    </div>
  );
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      const s = String(r.result || "");
      const comma = s.indexOf(",");
      resolve(comma >= 0 ? s.slice(comma + 1) : s);
    };
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}