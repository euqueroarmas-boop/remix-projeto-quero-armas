// ============================================================================
// Efetiva necessidade — Parte A: questionário e recepção das provas
//
// Regra de negócio (usuário, 31/07/2026):
//
//   PRIMEIRO chamam-se as provas, DEPOIS a narrativa.
//
// Perguntar "por que você precisa de uma arma?" logo de cara produz respostas
// vagas — o cliente não sabe o que é relevante juridicamente. Perguntar "você
// tem boletim de ocorrência?" produz um documento. E documento é fato; relato
// solto é alegação.
//
// Por isso o fluxo é: perguntas objetivas → o cliente anexa o que tem → o
// sistema LÊ cada prova (parser local; IA só se o layout for desconhecido) →
// confirma por e-mail citando o que leu → e só então, na Parte B, monta a
// narrativa cronológica para ele aprovar.
//
// Quem não tem prova nenhuma cai no relato detalhado — é o único material que
// a equipe terá, então as perguntas ali são mais exigentes.
// ============================================================================
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Loader2, X, Upload, Check, FileText, ShieldAlert, ArrowRight, Pencil, RefreshCw, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { extrairTextoPdf } from "@/lib/quero-armas/extracaoLocalPdf";
import { parseCertidao } from "@/lib/quero-armas/parsersCertidoes";

interface Props {
  open: boolean;
  processoId: string;
  clienteId: number;
  onClose: () => void;
  onConcluido?: () => void;
}

type TipoProva = "boletim_ocorrencia" | "inquerito_policial" | "acao_criminal" | "outro";

interface Prova {
  id: string;
  tipo: TipoProva;
  numero: string | null;
  data_fato: string | null;
  naturezas: string[] | null;
  arquivo_nome: string | null;
  leitura_por: string | null;
}

/**
 * As perguntas, na ordem em que reduzem o esforço do cliente: primeiro o que
 * ele pode ter guardado num arquivo, depois o que só ele sabe contar.
 */
const PERGUNTAS: Array<{
  campo: "tem_bo" | "tem_inquerito" | "tem_acao_criminal" | "sofre_ameaca";
  pergunta: string;
  ajuda: string;
  tipoProva?: TipoProva;
}> = [
  {
    campo: "tem_bo",
    pergunta: "Você já registrou algum boletim de ocorrência?",
    ajuda: "Ameaça, furto, roubo, invasão, violência, perseguição — qualquer fato que a polícia registrou. Tem mais de um? Envie todos. Cada boletim é uma prova a mais do seu lado. Não precisa estar no seu nome: se aconteceu com pai, mãe, esposa, marido, companheira(o), filhos ou quem mora com você, e isso mexeu com a sua segurança, sua casa, sua rotina ou seu trabalho, conta do mesmo jeito. E conta também o que aconteceu no trabalho, ou por causa dele: ameaça de cliente, paciente, aluno, detento, colega, fornecedor ou de alguém insatisfeito; abordagem no expediente, no trajeto, na ronda, na entrega, no atendimento externo, no plantão. Se o risco vem da sua atividade, ele entra aqui.",
    tipoProva: "boletim_ocorrencia",
  },
  {
    campo: "tem_inquerito",
    pergunta: "Algum desses casos virou inquérito policial?",
    ajuda: "Inquérito instaurado mostra que a autoridade considerou o fato sério o bastante para investigar.",
    tipoProva: "inquerito_policial",
  },
  {
    campo: "tem_acao_criminal",
    pergunta: "Você moveu ação criminal contra alguém?",
    ajuda: "Queixa-crime ou ação penal. Envie a petição ou o andamento processual.",
    tipoProva: "acao_criminal",
  },
  {
    campo: "sofre_ameaca",
    pergunta: "Você está sendo ameaçado ou se sente ameaçado por algum motivo?",
    ajuda: "Mesmo sem registro policial. Conte o que está acontecendo — isso será desenvolvido na sua defesa.",
  },
];

/**
 * Tamanho mínimo do relato para quem NÃO tem nenhuma prova documental.
 *
 * Definido pelo usuário em 1000 caracteres. Não é burocracia: sem BO, sem
 * inquérito e sem ação, este texto é a peça inteira. Um parágrafo curto não dá
 * à equipe material para fundamentar coisa nenhuma perante a PF.
 */
const RELATO_MINIMO = 1000;

const LABEL_TIPO: Record<TipoProva, string> = {
  boletim_ocorrencia: "Boletim de Ocorrência",
  inquerito_policial: "Inquérito policial",
  acao_criminal: "Ação criminal",
  outro: "Documento complementar",
};

const dataBR = (iso: string | null | undefined) => {
  const m = String(iso ?? "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : null;
};

export default function EfetivaNecessidadeModal({
  open, processoId, clienteId, onClose, onConcluido,
}: Props) {
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [registroId, setRegistroId] = useState<string | null>(null);
  const [respostas, setRespostas] = useState<Record<string, boolean | null>>({});
  const [relato, setRelato] = useState("");
  const [contexto, setContexto] = useState("");
  const [provas, setProvas] = useState<Prova[]>([]);
  const [enviandoTipo, setEnviandoTipo] = useState<TipoProva | null>(null);
  /* Parte B — o relato que a IA monta e o cliente lê, ajusta e aprova. */
  const [etapa, setEtapa] = useState<"provas" | "narrativa">("provas");
  const [narrativa, setNarrativa] = useState("");
  const [gerando, setGerando] = useState(false);
  const [editandoNarrativa, setEditandoNarrativa] = useState(false);
  const [narrativaTocada, setNarrativaTocada] = useState(false);
  const [aprovando, setAprovando] = useState(false);
  const [salvandoCampo, setSalvandoCampo] = useState<null | "salvando" | "salvo">(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const tipoAlvoRef = useRef<TipoProva>("boletim_ocorrencia");

  /* ── Carrega ou cria o questionário do processo ───────────────────────── */
  useEffect(() => {
    if (!open || !processoId) return;
    let cancelado = false;
    (async () => {
      setCarregando(true);
      try {
        const { data: existente } = await supabase
          .from("qa_efetiva_necessidade" as any)
          .select("*")
          .eq("processo_id", processoId)
          .maybeSingle();

        let reg = existente as any;
        if (!reg) {
          const { data: criado, error } = await supabase
            .from("qa_efetiva_necessidade" as any)
            .insert({ processo_id: processoId, cliente_id: clienteId })
            .select("*")
            .single();
          if (error) throw error;
          reg = criado;
        }
        if (cancelado) return;

        setRegistroId(reg.id);
        setRespostas({
          tem_bo: reg.tem_bo, tem_inquerito: reg.tem_inquerito,
          tem_acao_criminal: reg.tem_acao_criminal, sofre_ameaca: reg.sofre_ameaca,
        });
        setRelato(reg.relato_cliente ?? "");
        setContexto(reg.contexto_risco ?? "");
        setNarrativa(reg.narrativa_final ?? reg.narrativa_gerada ?? "");

        const { data: ps } = await supabase
          .from("qa_efetiva_necessidade_provas" as any)
          .select("id, tipo, numero, data_fato, naturezas, arquivo_nome, leitura_por")
          .eq("efetiva_necessidade_id", reg.id)
          .order("created_at");
        if (!cancelado) setProvas((ps ?? []) as unknown as Prova[]);
      } catch (e) {
        console.error("[efetiva necessidade] carga:", e);
        toast.error("Não foi possível abrir o formulário. Tente de novo.");
      } finally {
        if (!cancelado) setCarregando(false);
      }
    })();
    return () => { cancelado = true; };
  }, [open, processoId, clienteId]);

  /* ── Cada resposta é salva na hora ────────────────────────────────────── */
  const responder = useCallback(async (campo: string, valor: boolean) => {
    setRespostas((p) => ({ ...p, [campo]: valor }));
    if (!registroId) return;
    const { error } = await supabase
      .from("qa_efetiva_necessidade" as any)
      .update({ [campo]: valor, updated_at: new Date().toISOString() })
      .eq("id", registroId);
    if (error) {
      console.error("[efetiva necessidade] resposta:", error);
      toast.error("Não foi possível salvar esta resposta.");
    }
  }, [registroId]);

  const salvarTexto = useCallback(async (campo: "relato_cliente" | "contexto_risco", valor: string) => {
    if (!registroId) return;
    await supabase
      .from("qa_efetiva_necessidade" as any)
      .update({ [campo]: valor, updated_at: new Date().toISOString() })
      .eq("id", registroId);
  }, [registroId]);

  /* ── Autosave enquanto digita — nada de esperar o foco sair ─────────────
   * O cliente escreve num celular, troca de app, volta. Se o texto só
   * gravasse no blur, ele perderia o relato justamente na hora em que mais
   * escreveu. 800 ms depois da última tecla, grava sozinho.                */
  useEffect(() => {
    if (!registroId || carregando) return;
    setSalvandoCampo("salvando");
    const t = setTimeout(async () => {
      await salvarTexto("relato_cliente", relato);
      setSalvandoCampo("salvo");
    }, 800);
    return () => clearTimeout(t);
  }, [relato, registroId, carregando, salvarTexto]);

  useEffect(() => {
    if (!registroId || carregando) return;
    const t = setTimeout(() => void salvarTexto("contexto_risco", contexto), 800);
    return () => clearTimeout(t);
  }, [contexto, registroId, carregando, salvarTexto]);

  /* ── Parte B: a IA monta o relato em primeira pessoa ────────────────── */
  const gerarNarrativa = useCallback(async () => {
    if (!registroId) return;
    setGerando(true);
    try {
      await salvarTexto("relato_cliente", relato);
      await salvarTexto("contexto_risco", contexto);
      const { data, error } = await supabase.functions.invoke("qa-efetiva-narrativa", {
        body: { registro_id: registroId },
      });
      if (error || !data?.narrativa) throw new Error(data?.error || error?.message || "Falha ao montar o relato");
      setNarrativa(String(data.narrativa));
      setNarrativaTocada(false);
      setEditandoNarrativa(false);
      setEtapa("narrativa");
    } catch (e) {
      console.error("[efetiva necessidade] narrativa:", e);
      toast.error(e instanceof Error ? e.message : "Não foi possível montar o relato agora.");
    } finally {
      setGerando(false);
    }
  }, [registroId, relato, contexto, salvarTexto]);

  const aprovarNarrativa = useCallback(async () => {
    if (!registroId || narrativa.trim().length < 200) return;
    setAprovando(true);
    try {
      const { data, error } = await supabase.functions.invoke("qa-efetiva-aprovar", {
        body: {
          registro_id: registroId,
          texto_final: narrativa.trim(),
          editado: narrativaTocada,
          user_agent: navigator.userAgent,
          accept_language: navigator.language,
        },
      });
      if (error || data?.error) throw new Error(data?.error || error?.message || "Falha ao registrar a aprovação");
      toast.success("Relato aprovado. Enviamos o arquivo completo para o seu e-mail e liberamos o agendamento dos exames.");
      onConcluido?.();
      onClose();
    } catch (e) {
      console.error("[efetiva necessidade] aprovação:", e);
      toast.error(e instanceof Error ? e.message : "Não foi possível registrar a sua aprovação.");
    } finally {
      setAprovando(false);
    }
  }, [registroId, narrativa, narrativaTocada, onConcluido, onClose]);

  /* ── Recepção da prova: lê, grava e avisa ─────────────────────────────── */
  const receberArquivo = useCallback(async (file: File) => {
    if (!registroId) return;
    const tipo = tipoAlvoRef.current;
    setEnviandoTipo(tipo);
    try {
      // 1) Leitura LOCAL primeiro. O BO é PDF gerado pela Delegacia: o texto
      //    está lá, exato. A IA só entraria se o layout fosse desconhecido —
      //    e nesse caso o campo fica vazio, nunca chutado.
      let lidos: Record<string, unknown> = {};
      let leituraPor: "parser" | "manual" = "manual";
      if (file.type === "application/pdf") {
        try {
          const doc = parseCertidao(await extrairTextoPdf(file));
          if (doc?.orgao === "boletim_ocorrencia") {
            lidos = doc as unknown as Record<string, unknown>;
            leituraPor = "parser";
          }
        } catch (e) {
          console.warn("[efetiva necessidade] leitura local:", e);
        }
      }

      // 2) Sobe o arquivo
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120);
      const path = `cliente-docs/qa-${clienteId}/efetiva_necessidade/${Date.now()}_${safeName}`;
      const { error: upErr } = await supabase.storage
        .from("qa-documentos").upload(path, file, { contentType: file.type });
      if (upErr) throw upErr;

      // 3) Grava a prova com o que foi lido
      const { data: prova, error } = await supabase
        .from("qa_efetiva_necessidade_provas" as any)
        .insert({
          efetiva_necessidade_id: registroId,
          tipo,
          arquivo_storage_path: path,
          arquivo_nome: file.name,
          numero: (lidos.numero_bo as string) ?? null,
          protocolo: (lidos.protocolo as string) ?? null,
          orgao: (lidos.delegacia as string) ?? null,
          data_fato: (lidos.data_fato as string) ?? null,
          local_fato: (lidos.local_fato as string) ?? null,
          naturezas: (lidos.naturezas as string[]) ?? null,
          vitima_nome: (lidos.vitima_nome as string) ?? null,
          relato: (lidos.relato as string) ?? null,
          dados_extraidos: lidos,
          leitura_por: leituraPor,
        })
        .select("id, tipo, numero, data_fato, naturezas, arquivo_nome, leitura_por")
        .single();
      if (error) throw error;

      setProvas((p) => [...p, prova as unknown as Prova]);

      // 4) E-mail específico, citando o que foi lido. Best-effort: falha de
      //    e-mail não desfaz o envio da prova.
      void supabase.functions.invoke("qa-notify-event", {
        body: {
          evento: "prova_recebida",
          cliente_id: clienteId,
          tipo_prova: LABEL_TIPO[tipo],
          numero: (lidos.numero_bo as string) ?? "",
          orgao: (lidos.delegacia as string) ?? "",
          data_fato: dataBR(lidos.data_fato as string) ?? "",
          naturezas: (lidos.naturezas as string[]) ?? [],
          local_fato: (lidos.local_fato as string) ?? "",
          total_provas: provas.length + 1,
          referencia_tabela: "qa_efetiva_necessidade_provas",
          referencia_id: (prova as any)?.id ?? null,
        },
      });

      toast.success(
        leituraPor === "parser"
          ? `${LABEL_TIPO[tipo]} lido e registrado. Você recebeu a confirmação por e-mail.`
          : `${LABEL_TIPO[tipo]} recebido. A equipe vai analisar o conteúdo.`,
      );
    } catch (e) {
      console.error("[efetiva necessidade] prova:", e);
      toast.error("Não foi possível enviar este arquivo. Tente novamente.");
    } finally {
      setEnviandoTipo(null);
    }
  }, [registroId, clienteId, provas.length]);

  const abrirSeletor = (tipo: TipoProva) => {
    tipoAlvoRef.current = tipo;
    inputRef.current?.click();
  };

  const semProvaNenhuma = useMemo(
    () => PERGUNTAS.slice(0, 3).every((q) => respostas[q.campo] === false) && provas.length === 0,
    [respostas, provas.length],
  );

  const todasRespondidas = PERGUNTAS.every((q) => typeof respostas[q.campo] === "boolean");
  const podeConcluir = todasRespondidas && (provas.length > 0 || relato.trim().length >= RELATO_MINIMO);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-3 sm:p-4 overflow-y-auto">
      <div className="relative flex max-h-[calc(100dvh-1.5rem)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl sm:max-h-[90dvh]">
        <div className="shrink-0 flex items-start justify-between gap-3 border-b border-zinc-200 px-6 py-5 pr-14">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#7A1F2B]">
              Efetiva necessidade
            </p>
            <h2 className="mt-1 text-[18px] font-semibold text-zinc-900">
              Vamos reunir as provas do seu caso
            </h2>
            <p className="mt-1 text-[12px] leading-relaxed text-zinc-500">
              Nossa equipe usa esse material para escrever a peça que fundamenta, perante a
              Polícia Federal, por que você precisa da arma. Quanto mais concreto, mais forte.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="absolute top-3 right-3 z-20 rounded-full bg-[#8A1224] p-2 text-white hover:bg-[#6f0f1e] transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {carregando ? (
          <div className="flex min-h-0 flex-1 items-center justify-center gap-2 px-6 py-16 text-[13px] text-zinc-500">
            <Loader2 className="h-4 w-4 animate-spin" /> Abrindo…
          </div>
        ) : etapa === "narrativa" ? (
          <div className="no-scrollbar min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-6 py-5">
            <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4">
              <p className="text-[11px] font-bold uppercase tracking-wider text-[#7A1F2B]">
                Leia com atenção
              </p>
              <p className="mt-1 text-[12px] leading-relaxed text-zinc-600">
                Montamos abaixo o seu relato, em primeira pessoa, cruzando as suas respostas, os
                documentos que você enviou e os dados do seu cadastro (profissão, rotina e
                endereço). <strong>Você pode editar o texto</strong>, pedir para refazer, e só
                depois aprovar. Ao aprovar, este texto passa a ser a base da sua defesa.
              </p>
            </div>

            {editandoNarrativa ? (
              <textarea
                value={narrativa}
                onChange={(e) => { setNarrativa(e.target.value); setNarrativaTocada(true); }}
                rows={22}
                className="w-full rounded-lg border border-[#7A1F2B]/40 px-3 py-3 text-[13px] leading-relaxed text-zinc-800 focus:border-[#7A1F2B] focus:outline-none"
              />
            ) : (
              <div className="space-y-3 rounded-lg border border-zinc-200 bg-white p-4">
                {narrativa.split("\n").filter((l) => l.trim()).map((l, i) => (
                  <p key={i} className="text-[13px] leading-relaxed text-zinc-800">{l}</p>
                ))}
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setEditandoNarrativa((v) => !v)}
                className="inline-flex items-center gap-2 rounded-lg border border-zinc-300 px-3 py-2 text-[12px] font-semibold text-zinc-700 hover:bg-zinc-50"
              >
                <Pencil className="h-3.5 w-3.5" />
                {editandoNarrativa ? "Concluir edição" : "Editar o texto"}
              </button>
              <button
                type="button"
                onClick={() => void gerarNarrativa()}
                disabled={gerando}
                className="inline-flex items-center gap-2 rounded-lg border border-zinc-300 px-3 py-2 text-[12px] font-semibold text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
              >
                {gerando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                Refazer o relato
              </button>
              <button
                type="button"
                onClick={() => setEtapa("provas")}
                className="inline-flex items-center gap-2 rounded-lg border border-zinc-300 px-3 py-2 text-[12px] font-semibold text-zinc-700 hover:bg-zinc-50"
              >
                Voltar e corrigir provas
              </button>
            </div>

            <p className="text-[11px] leading-relaxed text-zinc-500">
              Ao aprovar, registramos a data, a hora e o carimbo da sua conexão, geramos um único
              arquivo assinado com este relato, as suas respostas e todos os anexos, e enviamos
              para o seu e-mail. Depois disso, o agendamento dos exames é liberado.
            </p>
          </div>
        ) : (
          <div className="no-scrollbar min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain px-6 py-5">
            {PERGUNTAS.map((q) => (
              <div key={q.campo} className="rounded-lg border border-zinc-200 p-4">
                <p className="text-[14px] font-semibold text-zinc-900">{q.pergunta}</p>
                <p className="mt-1 text-[12px] leading-relaxed text-zinc-500">{q.ajuda}</p>

                <div className="mt-3 flex gap-2">
                  {[true, false].map((v) => (
                    <button
                      key={String(v)}
                      type="button"
                      onClick={() => void responder(q.campo, v)}
                      className={`rounded-lg border px-4 py-2 text-[12px] font-semibold transition-colors ${
                        respostas[q.campo] === v
                          ? "border-[#7A1F2B] bg-[#7A1F2B]/5 text-[#7A1F2B]"
                          : "border-zinc-200 text-zinc-600 hover:bg-zinc-50"
                      }`}
                    >
                      {v ? "Sim" : "Não"}
                    </button>
                  ))}
                </div>

                {respostas[q.campo] === true && q.tipoProva && (
                  <button
                    type="button"
                    onClick={() => abrirSeletor(q.tipoProva!)}
                    disabled={enviandoTipo !== null}
                    className="mt-3 inline-flex items-center gap-2 rounded-lg border border-[#7A1F2B]/30 bg-[#7A1F2B]/5 px-3 py-2 text-[12px] font-semibold text-[#7A1F2B] hover:bg-[#7A1F2B]/10 disabled:opacity-50"
                  >
                    {enviandoTipo === q.tipoProva
                      ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      : <Upload className="h-3.5 w-3.5" />}
                    Anexar {LABEL_TIPO[q.tipoProva].toLowerCase()}
                  </button>
                )}
              </div>
            ))}

            {provas.length > 0 && (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
                <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-800">
                  Provas recebidas ({provas.length})
                </p>
                <ul className="mt-2 space-y-2">
                  {provas.map((pr) => (
                    <li key={pr.id} className="flex items-start gap-2 text-[12px] text-emerald-900">
                      <FileText className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      <span>
                        <strong>{LABEL_TIPO[pr.tipo]}</strong>
                        {pr.numero ? ` nº ${pr.numero}` : ""}
                        {pr.naturezas?.length ? ` — ${pr.naturezas.join(", ")}` : ""}
                        {pr.data_fato ? ` — fato em ${dataBR(pr.data_fato)}` : ""}
                        {pr.leitura_por === "parser" && (
                          <span className="ml-1 text-emerald-700">· lido automaticamente</span>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {semProvaNenhuma && (
              <div className="rounded-lg border border-amber-300 bg-amber-50 p-4">
                <div className="flex items-start gap-2">
                  <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
                  <p className="text-[12px] leading-relaxed text-amber-900">
                    Sem registro policial, o seu relato é o único material que a equipe terá.
                    Conte com o máximo de detalhes: <strong>o que aconteceu, quando, onde, quem
                    estava envolvido</strong> e por que você se sente em risco hoje.
                  </p>
                </div>
              </div>
            )}

            <div>
              <label className="text-[12px] font-semibold text-zinc-800">
                Conte o que está acontecendo
                {semProvaNenhuma && <span className="text-red-500"> *</span>}
              </label>
              <p className="mt-1 text-[11px] leading-relaxed text-zinc-500">
                Escreva com detalhes. O relato deve ter no mínimo {RELATO_MINIMO} caracteres: datas,
                locais, pessoas envolvidas, o que aconteceu, o que foi dito ou feito, se houve
                ameaça direta ou indireta, e por que isso ainda representa risco para você hoje.
              </p>
              <textarea
                value={relato}
                onChange={(e) => setRelato(e.target.value)}
                onBlur={() => void salvarTexto("relato_cliente", relato)}
                rows={6}
                placeholder="Descreva os fatos em ordem: datas, locais, pessoas envolvidas, o que foi dito ou feito."
                className="mt-2 w-full rounded-lg border border-zinc-200 px-3 py-2 text-[13px] leading-relaxed focus:border-[#7A1F2B] focus:outline-none"
              />
              {semProvaNenhuma && relato.trim().length < RELATO_MINIMO && (
                <p className="mt-1 text-[11px] text-amber-700">
                  Faltam {RELATO_MINIMO - relato.trim().length} caracteres. Sem prova documental,
                  o detalhamento é o que sustenta o pedido — não economize.
                </p>
              )}
            </div>

            <div>
              <label className="text-[12px] font-semibold text-zinc-800">
                O que, na sua rotina, aumenta o risco?
              </label>
              <textarea
                value={contexto}
                onChange={(e) => setContexto(e.target.value)}
                onBlur={() => void salvarTexto("contexto_risco", contexto)}
                rows={3}
                placeholder="Ex.: moro em zona rural isolada, transporto valores, trabalho à noite, resido sozinho com idosos."
                className="mt-1.5 w-full rounded-lg border border-zinc-200 px-3 py-2 text-[13px] leading-relaxed focus:border-[#7A1F2B] focus:outline-none"
              />
            </div>
          </div>
        )}

        <div className="shrink-0 flex items-center justify-between gap-3 border-t border-zinc-200 px-6 py-4">
          <p className="text-[10px] leading-tight text-zinc-400">
            {etapa === "narrativa"
              ? <>Você é quem aprova.<br />Nada é enviado sem a sua concordância.</>
              : <>
                  {salvandoCampo === "salvando" ? "Salvando…" : "Tudo é salvo enquanto você digita."}
                  <br />Pode parar e continuar quando quiser.
                </>}
          </p>
          {etapa === "narrativa" ? (
            <button
              type="button"
              disabled={aprovando || narrativa.trim().length < 200}
              onClick={() => void aprovarNarrativa()}
              className="inline-flex items-center gap-2 rounded-lg bg-[#7A1F2B] px-5 py-2.5 text-[12px] font-bold uppercase tracking-[0.14em] text-white transition-colors hover:bg-[#63161f] disabled:opacity-40"
            >
              {aprovando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5" />}
              Concordo e aprovo
            </button>
          ) : (
            <button
              type="button"
              disabled={!podeConcluir || salvando || gerando}
              onClick={() => void gerarNarrativa()}
              className="inline-flex items-center gap-2 rounded-lg bg-[#7A1F2B] px-5 py-2.5 text-[12px] font-bold uppercase tracking-[0.14em] text-white transition-colors hover:bg-[#63161f] disabled:opacity-40"
            >
              {gerando || salvando ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                : podeConcluir ? <Check className="h-3.5 w-3.5" />
                : <ArrowRight className="h-3.5 w-3.5" />}
              {gerando ? "Montando seu relato…" : "Gerar meu relato"}
            </button>
          )}
        </div>

        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (f) void receberArquivo(f);
          }}
        />
      </div>
    </div>,
    document.body,
  );
}
