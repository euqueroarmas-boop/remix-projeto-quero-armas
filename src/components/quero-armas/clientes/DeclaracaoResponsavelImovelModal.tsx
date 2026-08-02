import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Upload, X, ShieldCheck, AlertTriangle, FileDown, Trash2 } from "lucide-react";
import type { ResidenciaTerceiroPayload } from "./ResidenciaTerceiroModal";
import { baixarDeclaracaoResidencia } from "@/lib/quero-armas/declaracaoResidenciaDownload";

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
  const [apagando, setApagando] = useState(false);
  const [declaracaoId, setDeclaracaoId] = useState<string | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  /** Retomada: dados da declaração já gravada no servidor (Golden Record). */
  const [dadosSalvos, setDadosSalvos] = useState<ResidenciaTerceiroPayload | null>(null);
  const [comprovanteSalvoId, setComprovanteSalvoId] = useState<string | null>(null);
  const [retomando, setRetomando] = useState(false);
  const [resultado, setResultado] = useState<
    { conforme: boolean; motivos: string[]; signatario: string | null; data: string | null } | null
  >(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Se o cliente fechar a tela, ao reabrir o pop-up volta exatamente neste
  // passo: a declaração já está gerada, parseada e salva no servidor.
  useEffect(() => {
    if (!open || !qaClienteId || declaracaoId) return;
    let vivo = true;
    (async () => {
      setRetomando(true);
      try {
        const { data } = await supabase.functions.invoke("qa-declaracao-residencia", {
          body: { acao: "atual", qa_cliente_id: qaClienteId },
        });
        const decl = (data as any)?.declaracao;
        if (!vivo || !decl) return;
        setDeclaracaoId(String(decl.id));
        setDadosSalvos(decl.dados as ResidenciaTerceiroPayload);
        setComprovanteSalvoId(decl.documento_comprovante_id ?? null);
        if (decl.status === "assinada_rejeitada" && decl.motivo_reprovacao) {
          setResultado({ conforme: false, motivos: [decl.motivo_reprovacao], signatario: null, data: null });
        }
      } finally {
        if (vivo) setRetomando(false);
      }
    })();
    return () => { vivo = false; };
  }, [open, qaClienteId, declaracaoId]);

  const dadosEfetivos = dados ?? dadosSalvos;

  if (!open || (!dadosEfetivos && !retomando)) return null;

  const titular = (dadosEfetivos?.responsavel_nome || "DONO DO IMÓVEL").toUpperCase();
  const requerente = (interessadoNome || "VOCÊ").toUpperCase();

  async function gerar() {
    if (!qaClienteId || !dadosEfetivos) {
      toast.error("Não foi possível identificar seu cadastro.");
      return;
    }
    setGerando(true);
    try {
      const { data, error } = await supabase.functions.invoke("qa-declaracao-residencia", {
        body: {
          acao: "gerar",
          qa_cliente_id: qaClienteId,
          documento_comprovante_id: documentoComprovanteId ?? comprovanteSalvoId ?? null,
          responsavel_nome: dadosEfetivos!.responsavel_nome,
          responsavel_cpf: dadosEfetivos!.responsavel_documento,
          responsavel_estado_civil: dadosEfetivos!.estado_civil,
          responsavel_profissao: dadosEfetivos!.profissao,
          responsavel_doc_path: dadosEfetivos!.responsavel_arquivo_path,
          mora_desde: dadosEfetivos!.mora_desde,
        },
      });
      if (error) throw error;
      const payload = data as { declaracao_id?: string; pdf_url?: string; error?: string };
      if (payload?.error) throw new Error(payload.error);
      setDeclaracaoId(payload.declaracao_id ?? null);
      setPdfUrl(payload.pdf_url ?? null);
      if (payload.declaracao_id) await baixarDeclaracaoResidencia(payload.declaracao_id);
      toast.success("Declaração baixada. Envie ao dono do imóvel para assinar no GOV.BR.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível gerar a declaração.");
    } finally {
      setGerando(false);
    }
  }

  // Baixar novamente REGENERA o documento com a versão vigente do modelo
  // (endereço do comprovante, dados em negrito, layout atual) e então baixa.
  async function baixarNovamente() {
    await gerar();
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

  /** Apaga a declaração e o comprovante de terceiro: a exigência de endereço
   *  reabre do zero para o cliente enviar uma conta no próprio nome. */
  async function apagarDeclaracao() {
    if (!declaracaoId) {
      onFechar();
      return;
    }
    if (!window.confirm("Apagar esta declaração e o comprovante em nome de terceiro? Você poderá enviar uma conta no seu próprio nome.")) return;
    setApagando(true);
    try {
      const { data, error } = await supabase.functions.invoke("qa-declaracao-residencia", {
        body: { acao: "cancelar", declaracao_id: declaracaoId },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      setDeclaracaoId(null);
      setDadosSalvos(null);
      setComprovanteSalvoId(null);
      setResultado(null);
      setPdfUrl(null);
      toast.success("Declaração apagada. Envie um comprovante no seu próprio nome.");
      onValidada();
      onFechar();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível apagar a declaração.");
    } finally {
      setApagando(false);
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
      className="fixed inset-0 z-[300] flex items-start sm:items-center justify-center bg-black/60 backdrop-blur-sm px-3 pb-3 pt-[max(1rem,env(safe-area-inset-top))] sm:p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
    >
      <div className="relative w-full sm:max-w-2xl bg-white rounded-xl sm:rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[calc(100dvh-max(2rem,env(safe-area-inset-top)))] sm:max-h-[90dvh]">
        <button
          type="button"
          onClick={onFechar}
          aria-label="Fechar"
          className="absolute top-3 right-3 z-20 rounded-full bg-[#8A1224] p-2 text-white hover:bg-[#6f0f1e] transition-colors"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="shrink-0 border-b border-[#E4E4E4] bg-white">
          <div className="min-h-10 bg-[#FFF7F8] border-b border-[#8A1224]/20 px-5 pr-14 py-2.5 flex items-center">
            <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#8A1224]">
              Grupo 2 · Comprovação de endereço
            </span>
          </div>
          <div className="px-5 sm:px-6 pt-4 pb-4 pr-14">
          <p className="mb-1.5 text-[9px] font-bold uppercase tracking-[0.14em] text-[#6A6A6A]">
            Declaração do responsável · Assinatura GOV.BR
          </p>
          <h2 className="text-[22px] sm:text-2xl font-bold text-[#0A0A0A] leading-tight tracking-normal">
            Declaração do responsável pelo imóvel
          </h2>
          <p className="mt-2 rounded-md border border-[#E4E4E4] bg-[#FAFAFA] px-3 py-2 text-[13px] leading-relaxed text-[#3A3A3A]">
            Responsável pelo imóvel: <strong>{titular}</strong> · Interessado no processo:{" "}
            <strong>{requerente}</strong>
          </p>
          </div>
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

          {declaracaoId ? (
            <div className="mt-5 flex flex-col sm:flex-row gap-2">
              <button
                type="button"
                onClick={baixarNovamente}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-[#0A0A0A] bg-white px-3 py-2.5 text-[11px] font-bold uppercase tracking-[0.14em] text-[#0A0A0A] hover:bg-[#0A0A0A] hover:text-white transition-colors"
              >
                <FileDown className="h-3.5 w-3.5" />
                Baixar declaração novamente
              </button>
              <button
                type="button"
                onClick={apagarDeclaracao}
                disabled={apagando}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-[#8A1224]/40 bg-white px-3 py-2.5 text-[11px] font-bold uppercase tracking-[0.14em] text-[#8A1224] hover:bg-[#8A1224] hover:text-white disabled:opacity-50 transition-colors"
              >
                {apagando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                Apagar e enviar no meu nome
              </button>
            </div>
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
