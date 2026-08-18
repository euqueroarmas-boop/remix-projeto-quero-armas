// ============================================================================
// PecaAprovacaoPanel — o cliente lê a própria petição antes de ela ir à PF
// ----------------------------------------------------------------------------
// A peça gerada pela IA vivia inteira na área da equipe: escrita, revisada e
// protocolada sem que o requerente visse uma linha. O documento que sustenta o
// pedido dele — o que a Polícia Federal lê e que decide o processo — passava
// direto.
//
// ── POR QUE A CONFERÊNCIA IMPORTA, e não é formalidade ──────────────────────
// Nos indeferimentos reais que analisamos, dois motivos não tinham nada a ver
// com mérito: divergência de NOME e de ENDEREÇO entre o que foi declarado e o
// que os documentos diziam. Quem pega isso é o cliente, não o revisor — ele é
// o único que sabe a data certa do fato, o nome da rua e o número do boletim.
//
// Por isso o texto vem EDITÁVEL, e por isso existe o botão de devolver: aprovar
// não pode ser o único caminho quando ele discorda.
//
// Renderizado como `corpo` de uma pendência do PendenciasGuiadasPopup — o
// canal do cliente (mem://constraints/quero-armas-popup-guiado-canal-do-cliente).
// ============================================================================

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, Loader2, Pencil, Undo2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export interface PecaParaAprovar {
  id: string;
  titulo_geracao: string | null;
  tipo_peca: string | null;
  minuta_gerada: string | null;
  texto_final: string | null;
  status_cliente: string;
  devolucao_motivo: string | null;
}

export interface PecaAprovacaoPanelProps {
  peca: PecaParaAprovar;
  servicoLabel?: string | null;
  onDecidido?: () => void;
}

export default function PecaAprovacaoPanel({
  peca,
  servicoLabel,
  onDecidido,
}: PecaAprovacaoPanelProps) {
  const [texto, setTexto] = useState(peca.texto_final ?? peca.minuta_gerada ?? "");
  const [editando, setEditando] = useState(false);
  const [pedindoAjuste, setPedindoAjuste] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [enviando, setEnviando] = useState(false);

  // A equipe pode reescrever a peça enquanto esta tela está aberta.
  useEffect(() => {
    setTexto(peca.texto_final ?? peca.minuta_gerada ?? "");
    setEditando(false);
    setPedindoAjuste(false);
    setMotivo("");
  }, [peca.id, peca.minuta_gerada, peca.texto_final]);

  const decidir = async (acao: "aprovar" | "devolver") => {
    if (acao === "aprovar" && texto.trim().length < 200) {
      toast.error("O texto ficou curto demais. Fale com a equipe antes de aprovar.");
      return;
    }
    if (acao === "devolver" && motivo.trim().length < 5) {
      toast.error("Conte o que precisa mudar, com as suas palavras.");
      return;
    }
    setEnviando(true);
    try {
      const { data, error } = await supabase.functions.invoke("qa-peca-aprovar-cliente", {
        body: {
          geracao_id: peca.id,
          acao,
          ...(acao === "aprovar" ? { texto } : { motivo: motivo.trim() }),
        },
      });
      if (error) throw error;
      const err = (data as { error?: string } | null)?.error;
      if (err) throw new Error(err);
      toast.success(
        acao === "aprovar"
          ? "Petição aprovada. Nossa equipe segue com a entrega."
          : "Pedido de ajuste enviado. A equipe vai corrigir e te devolver.",
      );
      onDecidido?.();
    } catch (e) {
      toast.error("Não deu para registrar: " + ((e as Error)?.message ?? "erro"));
    } finally {
      setEnviando(false);
    }
  };

  if (peca.status_cliente === "aprovada") {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 flex items-start gap-2">
        <CheckCircle2 className="h-4 w-4 text-emerald-600 mt-0.5 shrink-0" />
        <p className="text-sm text-emerald-900">
          Você já aprovou esta petição. Nossa equipe segue com a entrega ao órgão.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {peca.status_cliente === "devolvida" && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3">
          <p className="text-sm font-semibold text-amber-900">
            Você pediu um ajuste e a equipe está trabalhando nele
          </p>
          {peca.devolucao_motivo && (
            <p className="text-sm text-amber-800 mt-1">“{peca.devolucao_motivo}”</p>
          )}
        </div>
      )}

      <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
        <p className="text-sm font-semibold text-slate-900">
          {peca.titulo_geracao || "Sua petição"}
        </p>
        {servicoLabel && (
          <p className="text-sm text-slate-500 mt-0.5">{servicoLabel}</p>
        )}
        <p className="text-sm text-slate-600 mt-2 leading-relaxed">
          Este é o documento que vai sustentar o seu pedido na Polícia Federal. Leia com
          atenção as <strong>datas, endereços e nomes</strong> — depois de protocolado o
          texto não pode mais ser corrigido, e a autoridade seguinte lê exatamente o que
          estiver aqui.
        </p>
      </div>

      {/* O texto, editável. Quem viveu o fato é ele. */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2 border-b border-slate-100 bg-slate-50">
          <span className="text-sm font-semibold text-slate-700">Texto da petição</span>
          <button
            onClick={() => setEditando((v) => !v)}
            className="text-sm font-semibold text-[#7A1F2B] hover:underline inline-flex items-center gap-1"
          >
            <Pencil className="h-3.5 w-3.5" />
            {editando ? "Parar de editar" : "Corrigir algo"}
          </button>
        </div>
        {editando ? (
          <textarea
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            rows={16}
            className="w-full px-4 py-3 text-sm text-slate-800 leading-relaxed resize-y focus:outline-none"
          />
        ) : (
          <div className="px-4 py-3 max-h-96 overflow-y-auto">
            {texto.split("\n").filter((l) => l.trim()).map((p, i) => (
              <p key={i} className="text-sm text-slate-800 leading-relaxed mb-2">{p}</p>
            ))}
          </div>
        )}
      </div>

      {pedindoAjuste ? (
        <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 space-y-2">
          <p className="text-sm font-semibold text-amber-900">O que precisa mudar?</p>
          <p className="text-sm text-amber-800">
            Escreva com as suas palavras. Ex.: “a data do boletim está errada, foi 12/03”.
          </p>
          <textarea
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            rows={3}
            placeholder="Conte o que está errado…"
            className="w-full rounded-lg border border-amber-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300"
          />
          <div className="flex gap-2">
            <button
              onClick={() => decidir("devolver")}
              disabled={enviando}
              className="h-10 px-4 rounded-lg text-sm font-bold text-white bg-amber-600 hover:bg-amber-700 disabled:opacity-60 inline-flex items-center gap-2"
            >
              {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Undo2 className="h-4 w-4" />}
              Enviar pedido de ajuste
            </button>
            <button
              onClick={() => setPedindoAjuste(false)}
              className="h-10 px-4 rounded-lg text-sm font-semibold text-slate-600 hover:bg-slate-100"
            >
              Voltar
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <button
            onClick={() => decidir("aprovar")}
            disabled={enviando}
            className="w-full h-11 inline-flex items-center justify-center gap-2 rounded-lg text-sm font-bold uppercase tracking-wide text-white bg-[#2F8F4A] hover:bg-[#27793E] disabled:opacity-60"
          >
            {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            Está correto — aprovar
          </button>
          <button
            onClick={() => setPedindoAjuste(true)}
            className="w-full h-10 inline-flex items-center justify-center gap-2 rounded-lg text-sm font-semibold text-amber-800 border border-amber-300 bg-amber-50 hover:bg-amber-100"
          >
            <AlertTriangle className="h-4 w-4" />
            Tem algo errado — pedir ajuste
          </button>
          {/* Aprovar aqui não é rascunho: dispara o aviso e libera o protocolo. */}
          <p className="text-sm text-slate-500 leading-relaxed">
            Ao aprovar, a petição é liberada para entrega. Guardamos data, hora e uma
            impressão digital do texto que você aprovou.
          </p>
        </div>
      )}
    </div>
  );
}
