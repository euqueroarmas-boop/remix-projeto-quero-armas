// ============================================================================
// DeferimentoEntregaPanel — o cliente finalmente recebe o que comprou
// ----------------------------------------------------------------------------
// Até 18/08/2026 o fluxo terminava numa palavra. "Deferido" era um rótulo em
// `qa_processos.status`: sem e-mail, sem passo de entrega, sem baixa do serviço,
// sem registro no Arsenal. Para um serviço chamado "Autorização de Compra", o
// produto final não tinha lugar no sistema — o cliente pagava, entregava
// documento por documento durante meses, e no fim via a palavra numa tela. O
// papel chegava por fora, quando chegava.
//
// Este é o último passo da fila, e ele é o único que não cobra nada: entrega.
//
// A VALIDADE APARECE EM DESTAQUE de propósito. Autorização de compra vence, e
// vencida obriga a refazer o processo inteiro. O documento já está no Arsenal
// com a data — o monitoramento de vencimento pega a partir dali — mas o cliente
// precisa ver isso na hora em que recebe, não só quando o alerta chegar.
//
// SEM URL DO SUPABASE: download por blob.
// Ver mem://constraints/no-supabase-url-leak.
// ============================================================================

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, Download, Loader2, PartyPopper, ShieldAlert } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const BUCKET_HUB = "qa-documentos";

export interface DeferimentoEntregaPanelProps {
  processoId: string;
  documentoId: string;
  servicoLabel?: string | null;
  onConfirmado?: () => void;
}

function dataBR(iso: string | null | undefined): string {
  if (!iso) return "—";
  const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : String(iso);
}

export default function DeferimentoEntregaPanel({
  processoId,
  documentoId,
  servicoLabel,
  onConfirmado,
}: DeferimentoEntregaPanelProps) {
  const [doc, setDoc] = useState<{
    nome_documento: string | null;
    tipo_documento: string;
    data_validade: string | null;
    arquivo_storage_path: string | null;
    arquivo_nome: string | null;
  } | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [baixando, setBaixando] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const [baixouAlgumaVez, setBaixouAlgumaVez] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const { data } = await supabase
        .from("qa_documentos_cliente")
        .select("nome_documento, tipo_documento, data_validade, arquivo_storage_path, arquivo_nome")
        .eq("id", documentoId)
        .maybeSingle();
      setDoc((data as typeof doc) ?? null);
    } finally {
      setCarregando(false);
    }
  }, [documentoId]);

  useEffect(() => { void carregar(); }, [carregar]);

  const baixar = async () => {
    if (!doc?.arquivo_storage_path) {
      toast.error("O arquivo ainda não está disponível. Fale com a nossa equipe.");
      return;
    }
    setBaixando(true);
    try {
      const { data, error } = await supabase.storage
        .from(BUCKET_HUB)
        .download(doc.arquivo_storage_path);
      if (error) throw error;
      const url = URL.createObjectURL(data);
      const a = document.createElement("a");
      a.href = url;
      a.download = doc.arquivo_nome || `${doc.tipo_documento}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      setBaixouAlgumaVez(true);
    } catch (e) {
      toast.error("Não deu para baixar: " + ((e as Error)?.message ?? "erro"));
    } finally {
      setBaixando(false);
    }
  };

  const confirmar = async () => {
    setConfirmando(true);
    try {
      const { data, error } = await supabase.functions.invoke("qa-processo-deferir", {
        body: { processo_id: processoId, acao: "confirmar_recebimento" },
      });
      if (error) throw error;
      const err = (data as { error?: string } | null)?.error;
      if (err) throw new Error(err);
      toast.success("Recebimento confirmado. Seu documento fica guardado no Arsenal.");
      onConfirmado?.();
    } catch (e) {
      toast.error("Não deu para confirmar: " + ((e as Error)?.message ?? "erro"));
    } finally {
      setConfirmando(false);
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

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
        <div className="flex items-start gap-2">
          <PartyPopper className="h-5 w-5 text-emerald-600 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-bold text-emerald-900">Deferido</p>
            <p className="text-sm text-emerald-800 mt-1 leading-relaxed">
              Saiu a decisão e ela é favorável. {servicoLabel ? `O seu processo de ${servicoLabel} ` : "O seu processo "}
              foi concluído, e o documento já é seu.
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
        <p className="text-sm font-semibold text-slate-900">
          {doc?.nome_documento || String(doc?.tipo_documento ?? "").replace(/_/g, " ")}
        </p>
        <button
          onClick={baixar}
          disabled={baixando}
          className="mt-3 w-full h-11 inline-flex items-center justify-center gap-2 rounded-lg text-sm font-bold uppercase tracking-wide text-white bg-[#7A1F2B] hover:bg-[#661925] disabled:opacity-60"
        >
          {baixando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          {baixando ? "Baixando…" : "Baixar meu documento"}
        </button>
      </div>

      {/*
        A VALIDADE VEM EM DESTAQUE. Autorização de compra vence, e vencida
        obriga a refazer o processo inteiro — não é detalhe de rodapé.
      */}
      {doc?.data_validade && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3">
          <div className="flex items-start gap-2">
            <ShieldAlert className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-amber-900">
                Válido até {dataBR(doc.data_validade)}
              </p>
              <p className="text-sm text-amber-800 mt-1 leading-relaxed">
                Guardamos esta data no seu Arsenal e avisamos com antecedência quando a
                renovação se aproximar. Você não precisa controlar isso sozinho.
              </p>
            </div>
          </div>
        </div>
      )}

      <button
        onClick={confirmar}
        disabled={confirmando}
        className="w-full h-11 inline-flex items-center justify-center gap-2 rounded-lg text-sm font-bold uppercase tracking-wide text-white bg-[#2F8F4A] hover:bg-[#27793E] disabled:opacity-60"
      >
        {confirmando ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
        {baixouAlgumaVez ? "Recebi, pode fechar" : "Confirmar que recebi"}
      </button>
      <p className="text-sm text-slate-500 leading-relaxed">
        O documento continua guardado na sua Área do Cliente. Confirmar só tira este aviso
        da sua lista.
      </p>
    </div>
  );
}
