import { useState } from "react";
import { Eye, Download, AlertTriangle, CheckCircle2, FileImage, IdCard, Home, User, Loader2, MailWarning } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePrivateStorageUrl } from "@/hooks/usePrivateStorageUrl";
import { toast } from "sonner";

/**
 * Cards operacionais para os 3 documentos do cadastro público
 * (selfie, identidade, comprovante de endereço).
 * Reaproveita o bucket privado `qa-cadastro-selfies` e os caminhos
 * já gravados em `qa_cadastro_publico`. NÃO substitui o
 * `CadastroDocumentosCard` — convive ao lado dele e dá ao operador
 * uma visão "status + Ver/Baixar/Solicitar correção" por documento.
 */

const BUCKET = "qa-cadastro-selfies";

type Slot = {
  key: "documento_identidade_path" | "comprovante_endereco_path" | "selfie_path";
  label: string;
  Icon: any;
  pendenciaLabel: string;
};

const SLOTS: Slot[] = [
  { key: "documento_identidade_path", label: "Documento de Identidade", Icon: IdCard, pendenciaLabel: "Documento de identidade não enviado." },
  { key: "comprovante_endereco_path", label: "Comprovante de Endereço", Icon: Home, pendenciaLabel: "Comprovante de endereço não enviado." },
  { key: "selfie_path", label: "Selfie do Titular", Icon: User, pendenciaLabel: "Selfie do titular não enviada." },
];

function fmt(d?: string | null) {
  if (!d) return null;
  try { return new Date(d).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }); } catch { return d; }
}

function DocCard({
  path,
  label,
  Icon,
  createdAt,
  pendenciaLabel,
  onSolicitarCorrecao,
  clienteNome,
}: {
  path: string | null | undefined;
  label: string;
  Icon: any;
  createdAt?: string | null;
  pendenciaLabel: string;
  onSolicitarCorrecao?: (item: string) => void;
  clienteNome?: string | null;
}) {
  const url = usePrivateStorageUrl(BUCKET, path);
  const [downloading, setDownloading] = useState(false);
  const presente = !!path;

  const handleVer = () => {
    if (!url) return;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const handleBaixar = async () => {
    if (!url || !path) return;
    setDownloading(true);
    try {
      const resp = await fetch(url);
      const blob = await resp.blob();
      const ext = (path.split(".").pop() || "jpg").toLowerCase();
      const safeName = (clienteNome || "documento").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      const safeLabel = label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      const a = document.createElement("a");
      const obj = URL.createObjectURL(blob);
      a.href = obj;
      a.download = `${safeName}-${safeLabel}.${ext}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(obj);
    } catch (err: any) {
      console.error("[doc-baixar]", err);
      toast.error("Falha ao baixar o arquivo");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div
      className={`rounded-xl border p-3 flex flex-col gap-2 ${
        presente ? "bg-white border-slate-200" : "bg-[#FBF3F4] border-[#E5C2C6]"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className="w-7 h-7 rounded-md inline-flex items-center justify-center shrink-0"
            style={{
              background: presente ? "#ECFDF5" : "#FEE2E2",
              color: presente ? "#047857" : "#991B1B",
            }}
          >
            <Icon className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <div className="text-[11px] font-bold uppercase tracking-wide text-slate-800 truncate">
              {label}
            </div>
            <div className="text-[9px] uppercase tracking-wider text-slate-500">
              Origem: Cadastro público
            </div>
          </div>
        </div>
        <span
          className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider shrink-0 ${
            presente
              ? "text-emerald-700 bg-emerald-50 border-emerald-200"
              : "text-red-700 bg-red-50 border-red-200"
          }`}
        >
          {presente ? <CheckCircle2 className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
          {presente ? "Enviado" : "Ausente"}
        </span>
      </div>

      {presente ? (
        <>
          {url ? (
            <button
              type="button"
              onClick={handleVer}
              className="relative w-full h-28 rounded-md overflow-hidden border bg-slate-100 hover:ring-2 hover:ring-[#7A1F2B] transition-all"
              style={{ borderColor: "hsl(220 13% 88%)" }}
              title="Abrir documento"
            >
              {(() => {
                const ext = (path || "").split(".").pop()?.toLowerCase();
                if (ext === "pdf") {
                  return (
                    <div className="w-full h-full flex flex-col items-center justify-center text-slate-500 text-[10px] uppercase tracking-wider">
                      <FileImage className="h-6 w-6 mb-1" />
                      PDF
                    </div>
                  );
                }
                return (
                  <img
                    src={url}
                    alt={label}
                    loading="lazy"
                    decoding="async"
                    className={`w-full h-full ${label.toLowerCase().includes("selfie") ? "object-cover" : "object-contain"}`}
                  />
                );
              })()}
            </button>
          ) : (
            <div className="w-full h-28 rounded-md flex items-center justify-center bg-slate-50 border border-slate-200">
              <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
            </div>
          )}
          {createdAt && (
            <div className="text-[9px] text-slate-500 uppercase tracking-wider">
              Recebido em {fmt(createdAt)}
            </div>
          )}
          <div className="flex flex-wrap gap-2 mt-auto">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={handleVer}
              disabled={!url}
              className="h-8 flex-1 min-w-[88px] text-[10px] font-semibold uppercase tracking-wider gap-1"
            >
              <Eye className="h-3.5 w-3.5" /> Ver
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={handleBaixar}
              disabled={!url || downloading}
              className="h-8 flex-1 min-w-[88px] text-[10px] font-semibold uppercase tracking-wider gap-1"
            >
              {downloading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
              Baixar
            </Button>
            {onSolicitarCorrecao && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => onSolicitarCorrecao(`Reenviar ${label.toLowerCase()} (arquivo atual com problema).`)}
                className="h-8 flex-1 min-w-[88px] text-[10px] font-semibold uppercase tracking-wider gap-1 border-[#E5C2C6] text-[#7A1F2B] hover:bg-[#FBF3F4]"
                title="Solicitar correção deste documento"
              >
                <MailWarning className="h-3.5 w-3.5" /> Corrigir
              </Button>
            )}
          </div>
        </>
      ) : (
        <>
          <div className="w-full rounded-md bg-white/60 border border-dashed border-[#E5C2C6] p-3 text-[11px] text-[#7A1F2B] leading-snug">
            Documento não enviado pelo cliente.
          </div>
          {onSolicitarCorrecao && (
            <Button
              type="button"
              size="sm"
              onClick={() => onSolicitarCorrecao(pendenciaLabel)}
              className="h-8 w-full text-[10px] font-bold uppercase tracking-wider gap-1.5 mt-auto"
              style={{ background: "#7A1F2B", color: "#fff" }}
            >
              <MailWarning className="h-3.5 w-3.5" />
              Solicitar correção
            </Button>
          )}
        </>
      )}
    </div>
  );
}

export default function DocumentosOperacionaisGrid({
  cadastro,
  onSolicitarCorrecao,
}: {
  cadastro: any;
  onSolicitarCorrecao?: (itemPendencia: string) => void;
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {SLOTS.map((s) => (
        <DocCard
          key={s.key}
          path={cadastro?.[s.key]}
          label={s.label}
          Icon={s.Icon}
          createdAt={cadastro?.created_at}
          pendenciaLabel={s.pendenciaLabel}
          onSolicitarCorrecao={onSolicitarCorrecao}
          clienteNome={cadastro?.nome_completo}
        />
      ))}
    </div>
  );
}
