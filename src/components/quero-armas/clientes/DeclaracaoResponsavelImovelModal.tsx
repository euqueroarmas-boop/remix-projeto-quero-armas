import { useRef, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Upload, X, ShieldCheck, AlertTriangle, FileDown } from "lucide-react";
import type { ResidenciaTerceiroPayload } from "./ResidenciaTerceiroModal";

/**
 * DECLARAÇÃO DO RESPONSÁVEL PELO IMÓVEL — assinatura digital GOV.BR.
 *
 * Abre logo depois que o comprovante em nome de terceiro é aceito. O
 * documento é gerado no servidor com os dados do dono do imóvel no preâmbulo
 * e o carimbo de sessão da emissão (mesmo padrão do contrato e da procuração).
 *
 * Quem assina é o DONO DO IMÓVEL. Na volta, o servidor confronta, sem
 * tolerância: nome/CPF do signatário, data da assinatura posterior à emissão
 * e cadeia ICP-Brasil. Divergiu, reprova e diz exatamente o porquê.
 *
 * Mesma moldura do pop-up de pendências guiadas — nenhuma interface nova.
 */

async function fileToBase64(f: File): Promise<string> {
  return await new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error("Falha ao ler o arquivo."));
    r.readAsDataURL(f);
  });
}

export default function DeclaracaoResponsavelImovelModal({
  open,
  qaClienteId,
  dados,
  documentoComprovanteId,
  interessadoNome,
  onFechar,
  onValidada,
}: {
  open: boolean;
  qaClienteId: number | null;
  dados: ResidenciaTerceiroPayload | null;
  documentoComprovanteId?: string | null;
  interessadoNome: string | null;
  onFechar: () => void;
  onValidada: () => void;
}) {
  const [gerando, setGerando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [declaracaoId, setDeclaracaoId] = useState<string | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [resultado, setResultado] = useState<
    { conforme: boolean; motivos: string[]; signatario: string | null; data: string | null } | null
  >(null);
  const inputRef = useRef<HTMLInputElement>(null);

  if (!open || !dados) return null;

  const titular = (dados.responsavel_nome || "DONO DO IMÓVEL").toUpperCase();
  const requerente = (interessadoNome || "VOCÊ").toUpperCase();

  async function gerar() {
    if (!qaClienteId) {
      toast.error("Não foi possível identificar seu cadastro.");
      return;
    }
    setGerando(true);
    try {
      const { data, error } = await supabase.functions.invoke("qa-declaracao-residencia", {
        body: {
          acao: "gerar",
          qa_cliente_id: qaClienteId,
          documento_comprovante_id: documentoComprovanteId ?? null,
          responsavel_nome: dados!.responsavel_nome,
          responsavel_cpf: dados!.responsavel_documento,
          responsavel_estado_civil: dados!.estado_civil,
          responsavel_profissao: dados!.profissao,
          responsavel_doc_path: dados!.responsavel_arquivo_path,
          mora_desde: dados!.mora_desde,
        },
      });
      if (error) throw error;
      const payload = data as { declaracao_id?: string; pdf_url?: string; error?: string };
      if (payload?.error) throw new Error(payload.error);
      setDeclaracaoId(payload.declaracao_id ?? null);
      setPdfUrl(payload.pdf_url ?? null);
      if (payload.pdf_url) window.open(payload.pdf_url, "_blank", "noopener");
      toast.success("Declaração gerada. Envie ao dono do imóvel para assinar no GOV.BR.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível gerar a declaração.");
    } finally {
      setGerando(false);
    }
  }

  async function enviarAssinada(file: File) {
    if (!declaracaoId) {
      toast.error("Gere a declaração antes de enviar o arquivo assinado.");
      return;
    }
    if (file.type !== "application/pdf") {
      toast.error("Envie o PDF assinado no GOV.BR — foto ou print não têm assinatura digital.");
      return;
    }
    setEnviando(true);
    setResultado(null);
    try {
      const base64 = await fileToBase64(file);
      const { data, error } = await supabase.functions.invoke("qa-declaracao-residencia", {
        body: { acao: "enviar_assinada", declaracao_id: declaracaoId, file_base64: base64 },
      });
      if (error) throw error;
      const r = data as {
        conforme?: boolean;
        motivos?: string[];
        assinatura?: { signatario?: string | null; data_assinatura?: string | null };
        error?: string;
      };
      if (r?.error) throw new Error(r.error);
      setResultado({
        conforme: !!r.conforme,
        motivos: r.motivos ?? [],
        signatario: r.assinatura?.signatario ?? null,
        data: r.assinatura?.data_assinatura ?? null,
      });
      if (r.conforme) {
        toast.success("Declaração assinada e conferida com sucesso.");
        onValidada();
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao enviar a declaração assinada.");
    } finally {
      setEnviando(false);
    }
  }

  const passos = [
    {
      titulo: "Baixe a declaração já preenchida",
      corpo: (
        <>
          Geramos a <strong>Declaração do Responsável pelo Imóvel</strong> com os dados de{" "}
          <strong>{titular}</strong> no preâmbulo e a data desde quando <strong>{requerente}</strong> mora
          no endereço. Nada precisa ser digitado no documento.
        </>
      ),
    },
    {
      titulo: `${titular} assina no GOV.BR`,
      corpo: (
        <>
          A assinatura é do <strong>dono do imóvel</strong>, em{" "}
          <a href="https://gov.br" target="_blank" rel="noreferrer" className="underline">
            https://gov.br
          </a>
          . Assinatura de outra pessoa reprova a declaração.
        </>
      ),
    },
    {
      titulo: "Envie o PDF assinado aqui",
      corpo: (
        <>
          Conferimos automaticamente o nome e o CPF do signatário, a data da assinatura e a cadeia
          ICP-Brasil. Só o PDF assinado é aceito — foto ou print não carregam assinatura digital.
        </>
      ),
    },
  ];

  return (
    <div
      data-qa-overlay="declaracao-responsavel-imovel"
      style={{ pointerEvents: "auto" }}
      onPointerDown={(e) => e.stopPropagation()}
      className="fixed inset-0 z-[300] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
    >
      <div className="relative w-full sm:max-w-2xl bg-white sm:rounded-2xl sm:shadow-2xl overflow-hidden flex flex-col max-h-[100dvh] sm:max-h-[90dvh]">
        <button
          type="button"
          onClick={onFechar}
          aria-label="Fechar"
          className="absolute top-3 right-3 z-20 rounded-full bg-[#8A1224] p-2 text-white hover:bg-[#6f0f1e] transition-colors"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="px-6 pt-8 pb-4 shrink-0">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span className="inline-flex items-center rounded-full border border-[#8A1224]/20 bg-[#FFF7F8] px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.14em] text-[#8A1224]">
              Comprovação de endereço
            </span>
            <span className="inline-flex items-center rounded-full border border-[#E4E4E4] bg-white px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.14em] text-[#6A6A6A]">
              Assinatura GOV.BR
            </span>
            <span className="inline-flex items-center rounded-full border border-[#E4E4E4] bg-[#FAFAFA] px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.14em] text-[#6A6A6A]">
              Declaração do responsável
            </span>
          </div>
          <h2 className="text-2xl font-bold text-[#0A0A0A] leading-tight tracking-tight">
            Declaração do responsável pelo imóvel
          </h2>
          <p className="mt-2 rounded-md border border-[#E4E4E4] bg-[#FAFAFA] px-3 py-2 text-[13px] leading-relaxed text-[#3A3A3A]">
            Responsável pelo imóvel: <strong>{titular}</strong> · Interessado no processo:{" "}
            <strong>{requerente}</strong>
          </p>
        </div>

        <div className="flex-1 overflow-y-auto px-6 pb-2">
          <div className="relative">
            <div className="absolute left-[15px] top-3 bottom-3 w-px bg-[#E4E4E4]" />
            <ul className="space-y-5 relative">
              {passos.map((p, i) => (
                <li key={i} className="flex gap-4">
                  <span className="flex-shrink-0 w-8 h-8 rounded-full bg-[#FFF7F8] text-[#8A1224] border border-[#8A1224]/10 flex items-center justify-center text-xs font-bold z-10">
                    {i + 1}
                  </span>
                  <div className="pt-1">
                    <p className="text-[14px] font-semibold leading-snug text-[#0A0A0A]">{p.titulo}</p>
                    <p className="mt-1 text-[14px] leading-relaxed text-[#3A3A3A]">{p.corpo}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          {pdfUrl ? (
            <a
              href={pdfUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-5 inline-flex items-center gap-2 rounded-lg border border-[#0A0A0A] bg-white px-3 py-2.5 text-[11px] font-bold uppercase tracking-[0.14em] text-[#0A0A0A] hover:bg-[#0A0A0A] hover:text-white transition-colors"
            >
              <FileDown className="h-3.5 w-3.5" />
              Baixar declaração novamente
            </a>
          ) : null}

          {resultado ? (
            <div
              className={`mt-5 flex gap-2 rounded-lg border p-3 text-[12px] ${
                resultado.conforme
                  ? "border-[#1F7A3F]/40 bg-[#1F7A3F]/5 text-[#1F5F33]"
                  : "border-[#8A1224]/40 bg-[#8A1224]/5 text-[#8A1224]"
              }`}
            >
              {resultado.conforme ? (
                <ShieldCheck className="h-4 w-4 shrink-0" />
              ) : (
                <AlertTriangle className="h-4 w-4 shrink-0" />
              )}
              <div>
                <p className="font-bold uppercase tracking-[0.12em]">
                  {resultado.conforme ? "Assinatura conferida" : "Declaração reprovada"}
                </p>
                {resultado.signatario ? (
                  <p className="mt-1">
                    Assinada por <strong>{resultado.signatario.toUpperCase()}</strong>
                    {resultado.data
                      ? ` em ${new Date(resultado.data).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}`
                      : ""}
                    .
                  </p>
                ) : null}
                {resultado.motivos.map((m, i) => (
                  <p key={i} className="mt-1">
                    {m}
                  </p>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        <div className="mt-auto border-t border-[#E4E4E4] bg-white shrink-0">
          <div className="px-6 py-3 flex justify-between items-center border-b border-[#F0F0F0]">
            <span className="text-[10px] font-bold text-[#6A6A6A] tracking-widest uppercase">
              Resolva um por vez
            </span>
            <span className="text-[10px] font-bold text-[#8A1224] tracking-widest uppercase">
              {declaracaoId ? "Passo 2 de 2" : "Passo 1 de 2"}
            </span>
          </div>

          <input
            ref={inputRef}
            type="file"
            accept="application/pdf"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void enviarAssinada(f);
            }}
          />

          <div className="px-6 py-4 grid grid-cols-1 md:grid-cols-2 items-stretch gap-2">
            <button
              type="button"
              onClick={gerar}
              disabled={gerando}
              className="inline-flex h-14 w-full items-center justify-center gap-2 rounded-xl border border-[#E4E4E4] bg-white px-4 text-[11px] font-bold uppercase tracking-[0.14em] text-[#0A0A0A] hover:bg-[#FAFAFA] disabled:opacity-50 transition-colors"
            >
              {gerando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileDown className="h-3.5 w-3.5" />}
              {declaracaoId ? "Gerar novamente" : "Gerar declaração"}
            </button>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={!declaracaoId || enviando}
              className="inline-flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-[#8A1224] px-4 text-[11px] font-bold uppercase tracking-[0.14em] text-white hover:bg-[#6f0f1e] disabled:opacity-50 transition-colors"
            >
              {enviando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
              {enviando ? "Conferindo assinatura" : "Enviar declaração assinada"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
