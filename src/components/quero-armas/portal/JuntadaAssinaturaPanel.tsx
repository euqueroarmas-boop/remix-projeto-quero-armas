// ============================================================================
// JuntadaAssinaturaPanel — o dossiê chega às mãos do cliente para ser assinado
// ----------------------------------------------------------------------------
// O checklist sempre teve o passo `juntada_assinada`: antes de o processo dar
// entrada, o cliente precisa assinar no gov.br o dossiê que vai para a Polícia
// Federal. Só que ele nunca recebia o arquivo.
//
// A juntada era montada por `qa-montar-juntada`, subia para o storage, e o
// caminho ficava dentro do `dados_json` de um evento que nenhuma tela lia. Era
// uma exigência impossível de cumprir: assine um documento que você não tem.
//
// Este painel fecha o circuito. Ele mostra o que foi montado (páginas,
// documentos, e o que ficou de fora), entrega o arquivo e explica os três
// passos na ordem em que acontecem.
//
// POR QUE A ASSINATURA IMPORTA, e não é burocracia nossa: o assinador do
// gov.br carimba o PDF com a identidade verificada do requerente. É o que
// permite entregar o dossiê inteiro num arquivo só, sem reconhecimento de
// firma em cartório documento por documento.
//
// SEM URL DO SUPABASE. O arquivo é baixado como blob e entregue pelo próprio
// navegador — nunca `window.open(signedUrl)`.
// Ver mem://constraints/no-supabase-url-leak.
//
// Renderizado como `corpo` de uma pendência do PendenciasGuiadasPopup, igual
// ao AcessoGovBrPanel e ao RequerimentoSinarmRoteiro.
// ============================================================================

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Check, Download, ExternalLink, FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

/** Assinador oficial do gov.br. É onde o PDF recebe a assinatura digital. */
const URL_ASSINADOR_GOVBR = "https://assinador.iti.br/assinatura/index.xhtml";

interface JuntadaRow {
  id: string;
  versao: number;
  bucket: string;
  storage_path: string;
  paginas: number;
  montada_em: string;
  itens_json: Array<{ numero?: string; rotulo?: string; nome_documento?: string; tipo_documento?: string }> | null;
}

export interface JuntadaAssinaturaPanelProps {
  processoId: string;
  /** Abre o fluxo de envio do arquivo assinado. */
  onEntregar: () => void;
}

function dataBR(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

export default function JuntadaAssinaturaPanel({
  processoId,
  onEntregar,
}: JuntadaAssinaturaPanelProps) {
  const [juntada, setJuntada] = useState<JuntadaRow | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [baixando, setBaixando] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const { data } = await supabase
        .from("qa_processo_juntadas")
        .select("id, versao, bucket, storage_path, paginas, montada_em, itens_json")
        .eq("processo_id", processoId)
        .order("versao", { ascending: false })
        .limit(1)
        .maybeSingle();
      setJuntada((data as JuntadaRow | null) ?? null);
    } finally {
      setCarregando(false);
    }
  }, [processoId]);

  useEffect(() => { void carregar(); }, [carregar]);

  const baixar = async () => {
    if (!juntada) return;
    setBaixando(true);
    try {
      const { data, error } = await supabase.storage
        .from(juntada.bucket)
        .download(juntada.storage_path);
      if (error) throw error;
      const url = URL.createObjectURL(data);
      const a = document.createElement("a");
      a.href = url;
      a.download = `dossie-para-assinar-v${juntada.versao}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 4000);
    } catch (e) {
      toast.error("Não deu para baixar o documento: " + ((e as Error)?.message ?? "erro"));
    } finally {
      setBaixando(false);
    }
  };

  if (carregando) {
    return (
      <div className="flex items-center gap-2 py-6 text-sm text-slate-500">
        <Loader2 className="h-4 w-4 animate-spin" />
        Carregando o seu documento…
      </div>
    );
  }

  // A juntada é montada pela equipe. Enquanto ela não existir, o cliente não
  // tem o que assinar — e dizer isso é melhor do que mostrar um botão morto.
  if (!juntada) {
    return (
      <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3">
        <div className="flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-amber-900">
              O seu documento ainda está sendo montado
            </p>
            <p className="text-sm text-amber-800 mt-1 leading-relaxed">
              Nossa equipe está reunindo tudo o que você enviou num arquivo único, na ordem
              que a Polícia Federal exige. Assim que ficar pronto, ele aparece aqui para você
              assinar. Você não precisa fazer nada agora.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const documentos = Array.isArray(juntada.itens_json) ? juntada.itens_json : [];

  return (
    <div className="space-y-4">
      {/* O que foi montado */}
      <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-slate-500 shrink-0" />
              <p className="text-sm font-semibold text-slate-900">
                Seu dossiê está pronto
              </p>
            </div>
            <p className="text-sm text-slate-600 mt-1">
              {documentos.length} documento{documentos.length === 1 ? "" : "s"} ·{" "}
              {juntada.paginas} página{juntada.paginas === 1 ? "" : "s"} · montado em{" "}
              {dataBR(juntada.montada_em)}
            </p>
          </div>
          <button
            onClick={baixar}
            disabled={baixando}
            className="h-10 px-4 inline-flex items-center gap-2 rounded-lg text-sm font-semibold text-white bg-[#7A1F2B] hover:bg-[#661925] disabled:opacity-60 shrink-0"
          >
            {baixando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            {baixando ? "Baixando…" : "Baixar documento"}
          </button>
        </div>

        {documentos.length > 0 && (
          <details className="mt-3">
            <summary className="text-sm text-slate-500 cursor-pointer hover:text-slate-700">
              Ver o que está dentro
            </summary>
            <ul className="mt-2 space-y-1">
              {documentos.map((d, i) => (
                <li key={i} className="text-sm text-slate-600 flex gap-2">
                  <span className="text-slate-400 shrink-0">{d?.numero ?? "—"}</span>
                  <span>
                    {d?.rotulo ??
                      d?.nome_documento ??
                      String(d?.tipo_documento ?? "").replace(/_/g, " ")}
                  </span>
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>

      {/* Os três passos, na ordem */}
      <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
        <p className="text-sm font-semibold text-slate-900 mb-2">O que fazer agora</p>
        <ol className="space-y-2">
          <li className="text-sm text-slate-700 flex gap-2">
            <span className="font-semibold text-[#7A1F2B] shrink-0">1.</span>
            <span>Baixe o documento no botão acima.</span>
          </li>
          <li className="text-sm text-slate-700 flex gap-2">
            <span className="font-semibold text-[#7A1F2B] shrink-0">2.</span>
            <span>
              Abra o assinador do gov.br, entre com a sua conta e assine o arquivo que você
              acabou de baixar. Ele vai devolver uma versão assinada.{" "}
              <a
                href={URL_ASSINADOR_GOVBR}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 font-semibold text-[#7A1F2B] hover:underline"
              >
                Abrir o assinador <ExternalLink className="h-3 w-3" />
              </a>
            </span>
          </li>
          <li className="text-sm text-slate-700 flex gap-2">
            <span className="font-semibold text-[#7A1F2B] shrink-0">3.</span>
            <span>Volte aqui e envie o arquivo assinado. É o último passo antes da entrega.</span>
          </li>
        </ol>
        {/* Erro clássico: o cliente assina, e manda de volta o arquivo original. */}
        <p className="text-sm text-slate-500 mt-3 leading-relaxed">
          Envie o arquivo que o gov.br gerou depois de assinar — não o mesmo que você baixou.
          O nome dele costuma terminar em <strong>-assinado</strong>.
        </p>
      </div>

      <button
        onClick={onEntregar}
        className="w-full h-11 inline-flex items-center justify-center gap-2 rounded-lg text-sm font-bold uppercase tracking-wide text-white bg-[#2F8F4A] hover:bg-[#27793E]"
      >
        <Check className="h-4 w-4" />
        Enviar o documento assinado
      </button>
    </div>
  );
}
