// ============================================================================
// RecursoAprovacaoPanel — o cliente lê o próprio relato e confirma
// ----------------------------------------------------------------------------
// A PF negou, o cliente enviou o que ela pediu, e a IA montou o relato dos
// fatos na voz dele. Antes de a equipe transformar isso em peça e protocolar,
// ele precisa ler e dizer "é isso mesmo".
//
// ── POR QUE A CONFERÊNCIA IMPORTA TANTO ─────────────────────────────────────
// Recurso protocolado com fato errado não se conserta. Ele vira parte do
// processo, e a próxima autoridade lê aquilo — inclusive a data trocada, o nome
// da rua errado, o número de boletim que não é o dele. A tela existe para
// pegar isso antes, e por isso o texto vem EDITÁVEL: quem viveu o fato é ele.
//
// ── POR QUE PRIMEIRA PESSOA ─────────────────────────────────────────────────
// Texto na terceira pessoa ("o requerente registrou") é lido como documento de
// escritório e aprovado no automático, sem conferir. Na voz dele ("eu
// registrei"), ele lê como se fosse dele e corrige. A voz não é enfeite: é o
// que faz a conferência de fato acontecer.
//
// O botão diz o que vai acontecer — "aprovar e enviar para a equipe" — porque
// aprovar aqui não é rascunho: dispara o aviso e a peça começa a ser escrita.
// ============================================================================

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, FileSignature, Loader2, Pencil } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export interface RecursoParaAprovar {
  id: string;
  status: string;
  narrativa_gerada: string | null;
  narrativa_final: string | null;
  aprovado_em: string | null;
  editada_pelo_cliente: boolean | null;
  provas_json?: Array<{ tipo?: string; nome?: string }> | null;
}

export interface RecursoAprovacaoPanelProps {
  recurso: RecursoParaAprovar;
  /** Nome de quem assinou a decisão, quando o texto da PF traz. */
  delegadoNome?: string | null;
  onAprovado?: () => void;
}

export default function RecursoAprovacaoPanel({
  recurso,
  delegadoNome,
  onAprovado,
}: RecursoAprovacaoPanelProps) {
  const [texto, setTexto] = useState(recurso.narrativa_final ?? recurso.narrativa_gerada ?? "");
  const [editando, setEditando] = useState(false);
  const [enviando, setEnviando] = useState(false);

  // O relato pode ser refeito pela equipe enquanto a tela está aberta.
  useEffect(() => {
    setTexto(recurso.narrativa_final ?? recurso.narrativa_gerada ?? "");
    setEditando(false);
  }, [recurso.id, recurso.narrativa_gerada, recurso.narrativa_final]);

  const jaAprovado = ["aprovado", "enviado_equipe", "protocolado"].includes(recurso.status);

  const aprovar = async () => {
    if (texto.trim().length < 200) {
      toast.error("O texto ficou curto demais. Fale com a equipe antes de aprovar.");
      return;
    }
    setEnviando(true);
    try {
      const { data, error } = await supabase.functions.invoke("qa-recurso-aprovar", {
        body: { recurso_id: recurso.id, texto },
      });
      if (error) throw error;
      if ((data as { error?: string } | null)?.error) {
        throw new Error(String((data as { error: string }).error));
      }
      toast.success("Aprovado. A nossa equipe já foi avisada e vai redigir o recurso.");
      onAprovado?.();
    } catch (e) {
      toast.error("Não conseguimos registrar a sua aprovação: " + ((e as Error)?.message ?? "erro"));
    } finally {
      setEnviando(false);
    }
  };

  if (jaAprovado) {
    return (
      <section className="mt-3 overflow-hidden rounded-lg border-2 border-emerald-300 bg-emerald-50">
        <div className="px-3 py-2.5">
          <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.08em] text-emerald-800">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Você já aprovou o seu recurso
          </p>
          <p className="mt-1 text-[12px] leading-snug text-emerald-900">
            A nossa equipe recebeu e está redigindo a peça com base no seu relato. Quando
            protocolarmos, o seu processo volta para análise da Polícia Federal e você é avisado
            por e-mail.
          </p>
        </div>
        <details className="border-t border-emerald-200 px-3 py-2">
          <summary className="cursor-pointer list-none text-[10px] font-bold uppercase tracking-wider text-emerald-800">
            Reler o que eu aprovei
          </summary>
          <p className="mt-1.5 whitespace-pre-wrap rounded-md bg-white px-3 py-2 text-[11px] leading-relaxed text-slate-800">
            {recurso.narrativa_final ?? recurso.narrativa_gerada}
          </p>
        </details>
      </section>
    );
  }

  return (
    <section className="mt-3 overflow-hidden rounded-lg border-2 border-[#8A1224] bg-white">
      <header className="border-b border-[#E5C2C6] bg-[#FBF3F4] px-3 py-2.5">
        <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.1em] text-[#7A1F2B]">
          <FileSignature className="h-3.5 w-3.5" />
          Leia e confirme antes de recorrermos
        </p>
        <p className="mt-1 text-[12px] leading-snug text-[#7A1F2B]">
          Montamos o relato dos fatos com o que você nos enviou, escrito como se fosse você
          falando — porque os fatos são seus. Leia com calma e confira <strong>datas, nomes,
          endereços e números de boletim</strong>.
        </p>
        <p className="mt-1 text-[11px] leading-snug text-slate-600">
          {delegadoNome
            ? `É este relato que vai responder ao que o delegado ${delegadoNome} apontou.`
            : "É este relato que vai responder ao que a Polícia Federal apontou."}{" "}
          Depois de protocolado não dá para corrigir: o texto passa a fazer parte do processo.
        </p>
      </header>

      {editando ? (
        <textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          rows={16}
          className="w-full resize-y border-0 px-3 py-2.5 text-[12px] leading-relaxed text-slate-800 outline-none"
        />
      ) : (
        <p className="whitespace-pre-wrap px-3 py-2.5 text-[12px] leading-relaxed text-slate-800">
          {texto}
        </p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 bg-slate-50 px-3 py-2.5">
        <button
          type="button"
          onClick={() => setEditando((v) => !v)}
          className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-600 hover:text-[#8A1224]"
        >
          <Pencil className="h-3.5 w-3.5" />
          {editando ? "Parar de editar" : "Tem algo errado? Corrija aqui"}
        </button>
        <button
          type="button"
          onClick={aprovar}
          disabled={enviando}
          className="inline-flex items-center gap-1.5 rounded-md bg-[#8A1224] px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-white hover:bg-[#6f0f1e] disabled:opacity-60"
        >
          {enviando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
          {enviando ? "Enviando…" : "Está correto — enviar para a equipe"}
        </button>
      </div>
    </section>
  );
}
