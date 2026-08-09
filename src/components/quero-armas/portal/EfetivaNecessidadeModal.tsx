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
import { Loader2, X, Upload, Check, FileText, ShieldAlert, ArrowRight, Pencil, RefreshCw, ShieldCheck, Copy, Plus, ExternalLink } from "lucide-react";
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

interface Acrescimo {
  id: string;
  texto: string;
  created_at: string;
}

interface LinkBo {
  uf: string;
  nome_orgao: string | null;
  url_abrir: string | null;
  url_acompanhar: string | null;
  observacao: string | null;
}

/** Limite do texto que o cliente leva à delegacia. Regra do usuário. */
const LIMITE_BO = 500;

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

/**
 * A fila de etapas — um bloco por tela, no mesmo padrão do pop-up guiado.
 *
 * Antes tudo vinha empilhado num scroll único e o cliente pulava campo. Aqui
 * cada bloco vira um passo navegável (Anterior / Próximo), com contador,
 * trilha numerada e o rodapé fixo do padrão guiado.
 */
type PassoTipo = "pergunta" | "relato" | "contexto" | "revisao";

const PASSOS: Array<{
  id: string;
  tipo: PassoTipo;
  titulo: string;
  campo?: (typeof PERGUNTAS)[number]["campo"];
}> = [
  ...PERGUNTAS.map((q) => ({
    id: q.campo,
    tipo: "pergunta" as const,
    titulo: q.pergunta,
    campo: q.campo,
  })),
  { id: "relato", tipo: "relato", titulo: "Conte o que está acontecendo" },
  { id: "contexto", tipo: "contexto", titulo: "O que, na sua rotina, aumenta o risco?" },
  { id: "revisao", tipo: "revisao", titulo: "Revisão e geração do relato" },
];

const TRILHA_ROTULO: Record<string, string> = {
  tem_bo: "Boletim de ocorrência",
  tem_inquerito: "Inquérito policial",
  tem_acao_criminal: "Ação criminal",
  sofre_ameaca: "Ameaça atual",
  relato: "Seu relato",
  contexto: "Rotina de risco",
  revisao: "Revisão e geração",
};

const PASSO_REVISAO = PASSOS.length - 1;

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
  const [passoIndex, setPassoIndex] = useState(0);
  const [maxVisitado, setMaxVisitado] = useState(0);
  const [avisoAnexo, setAvisoAnexo] = useState<string | null>(null);
  const [narrativa, setNarrativa] = useState("");
  const [textoBo, setTextoBo] = useState("");
  const [textoBoTocado, setTextoBoTocado] = useState(false);
  const [editandoBo, setEditandoBo] = useState(false);
  const [acrescimos, setAcrescimos] = useState<Acrescimo[]>([]);
  const [novoAcrescimo, setNovoAcrescimo] = useState("");
  const [campoAcrescimoAberto, setCampoAcrescimoAberto] = useState(false);
  const [salvandoAcrescimo, setSalvandoAcrescimo] = useState(false);
  const [linkBo, setLinkBo] = useState<LinkBo | null>(null);
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
        setTextoBo(reg.texto_bo ?? "");
        if (reg.narrativa_final || reg.narrativa_gerada) {
          setEtapa("narrativa");
          setPassoIndex(PASSO_REVISAO);
          setMaxVisitado(PASSO_REVISAO);
        } else {
          // Retoma na primeira etapa ainda não respondida.
          const iPergunta = PERGUNTAS.findIndex(
            (q) => typeof (reg as any)[q.campo] !== "boolean",
          );
          const destino = iPergunta >= 0
            ? iPergunta
            : String(reg.relato_cliente ?? "").trim() ? PASSOS.length - 2 : PASSOS.length - 3;
          setPassoIndex(destino);
          setMaxVisitado(destino);
        }

        const { data: acs } = await supabase
          .from("qa_efetiva_necessidade_acrescimos" as any)
          .select("id, texto, created_at")
          .eq("efetiva_necessidade_id", reg.id)
          .order("ordem");
        if (!cancelado) setAcrescimos((acs ?? []) as unknown as Acrescimo[]);

        const { data: cli } = await supabase
          .from("qa_clientes" as any)
          .select("estado")
          .eq("id", clienteId)
          .maybeSingle();
        const uf = String((cli as any)?.estado ?? "").toUpperCase();
        if (uf) {
          const { data: lk } = await supabase
            .from("qa_bo_links_uf" as any)
            .select("uf, nome_orgao, url_abrir, url_acompanhar, observacao")
            .eq("uf", uf)
            .maybeSingle();
          if (!cancelado) setLinkBo((lk as unknown as LinkBo) ?? null);
        }

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
      setTextoBo(String(data.texto_bo ?? ""));
      setTextoBoTocado(false);
      setEditandoBo(false);
      setCampoAcrescimoAberto(false);
      setNovoAcrescimo("");
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

  /* ── Fatos novos: nada é sobrescrito, tudo vira histórico ─────────────── */
  const adicionarAcrescimo = useCallback(async () => {
    const texto = novoAcrescimo.trim();
    if (!registroId || texto.length < 20) return;
    setSalvandoAcrescimo(true);
    try {
      const { data, error } = await supabase
        .from("qa_efetiva_necessidade_acrescimos" as any)
        .insert({
          efetiva_necessidade_id: registroId,
          texto,
          ordem: acrescimos.length + 1,
          origem: "cliente",
        })
        .select("id, texto, created_at")
        .single();
      if (error) throw error;
      setAcrescimos((p) => [...p, data as unknown as Acrescimo]);
      setNovoAcrescimo("");
      setCampoAcrescimoAberto(false);
      toast.success("Fato registrado. Agora refaça o relato para ele entrar no texto.");
    } catch (e) {
      console.error("[efetiva necessidade] acréscimo:", e);
      toast.error("Não foi possível salvar este fato. Tente novamente.");
    } finally {
      setSalvandoAcrescimo(false);
    }
  }, [registroId, novoAcrescimo, acrescimos.length]);

  const copiar = useCallback(async (texto: string) => {
    try {
      await navigator.clipboard.writeText(texto);
      toast.success("Texto copiado.");
    } catch {
      toast.error("Não foi possível copiar. Selecione o texto e copie manualmente.");
    }
  }, []);

  const aprovarNarrativa = useCallback(async () => {
    if (!registroId || narrativa.trim().length < 200) return;
    setAprovando(true);
    try {
      const { data, error } = await supabase.functions.invoke("qa-efetiva-aprovar", {
        body: {
          registro_id: registroId,
          texto_final: narrativa.trim(),
          editado: narrativaTocada,
          texto_bo: textoBo.trim().slice(0, LIMITE_BO),
          texto_bo_editado: textoBoTocado,
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
  }, [registroId, narrativa, narrativaTocada, textoBo, textoBoTocado, onConcluido, onClose]);

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

  const passo = PASSOS[passoIndex];
  const perguntaAtual = passo?.campo
    ? PERGUNTAS.find((q) => q.campo === passo.campo) ?? null
    : null;

  /** Uma etapa está concluída quando o que ela pede já foi entregue. */
  const passoConcluido = useCallback((i: number) => {
    const p = PASSOS[i];
    if (!p) return false;
    if (p.tipo === "pergunta") return typeof respostas[p.campo!] === "boolean";
    if (p.tipo === "relato") return !semProvaNenhuma || relato.trim().length >= RELATO_MINIMO;
    if (p.tipo === "contexto") return contexto.trim().length > 0;
    return false;
  }, [respostas, relato, contexto, semProvaNenhuma]);

  /** O "Próximo" só trava onde a regra de negócio já travava antes. */
  const podeAvancar = useMemo(() => {
    if (!passo) return false;
    if (passo.tipo === "pergunta") return typeof respostas[passo.campo!] === "boolean";
    if (passo.tipo === "relato") return !semProvaNenhuma || relato.trim().length >= RELATO_MINIMO;
    return true;
  }, [passo, respostas, relato, semProvaNenhuma]);

  const irPara = useCallback((i: number) => {
    const destino = Math.max(0, Math.min(PASSOS.length - 1, i));
    setAvisoAnexo(null);
    setPassoIndex(destino);
    setMaxVisitado((m) => Math.max(m, destino));
  }, []);

  const avancar = useCallback(() => {
    const p = PASSOS[passoIndex];
    // Marcou "sim" e não anexou nada: avisa uma vez, mas não bloqueia.
    if (p?.tipo === "pergunta" && perguntaAtual?.tipoProva && respostas[p.campo!] === true) {
      const temAnexo = provas.some((pr) => pr.tipo === perguntaAtual.tipoProva);
      if (!temAnexo && !avisoAnexo) {
        setAvisoAnexo(
          "Você marcou que tem. Anexe o arquivo agora ou volte e marque “Não” — sem o documento, o fato vira apenas alegação.",
        );
        return;
      }
    }
    irPara(passoIndex + 1);
  }, [passoIndex, perguntaAtual, respostas, provas, avisoAnexo, irPara]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-3 sm:p-4 overflow-y-auto">
      <div className="relative flex max-h-[calc(100dvh-1.5rem)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl sm:max-h-[90dvh]">
        <div className="shrink-0 flex items-start justify-between gap-3 border-b border-zinc-200 px-6 py-5 pr-14">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#7A1F2B]">
              Efetiva necessidade · Passo {passoIndex + 1} de {PASSOS.length}
            </p>
            <h2 className="mt-1 text-[18px] font-semibold text-zinc-900">
              {passo?.titulo ?? "Vamos reunir as provas do seu caso"}
            </h2>
            {passoIndex === 0 && (
              <p className="mt-1 text-[12px] leading-relaxed text-zinc-500">
                Nossa equipe usa esse material para escrever a peça que fundamenta, perante a
                Polícia Federal, por que você precisa da arma. Quanto mais concreto, mais forte.
              </p>
            )}
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
        ) : passoIndex === PASSO_REVISAO && narrativa ? (
          <div className="no-scrollbar min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-6 py-5">
            <Trilha passoIndex={passoIndex} maxVisitado={maxVisitado} passoConcluido={passoConcluido} irPara={irPara} />
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

            {/* ── Fatos novos: abre um campo, guarda no histórico e refaz ─── */}
            <div className="rounded-lg border border-zinc-200 p-4">
              <p className="text-[12px] font-semibold text-zinc-900">Aconteceu mais alguma coisa?</p>
              <p className="mt-1 text-[11px] leading-relaxed text-zinc-500">
                Se você lembrou de outro fato, ou algo novo aconteceu depois, escreva aqui. Nada do
                que você já contou é apagado: o relato é reescrito somando o fato novo.
              </p>

              {acrescimos.length > 0 && (
                <ul className="mt-3 space-y-2">
                  {acrescimos.map((a, i) => (
                    <li key={a.id} className="rounded-md bg-zinc-50 p-3 text-[12px] leading-relaxed text-zinc-700">
                      <span className="mr-1 font-semibold text-zinc-500">{i + 1}.</span>
                      {a.texto}
                    </li>
                  ))}
                </ul>
              )}

              {campoAcrescimoAberto ? (
                <div className="mt-3">
                  <textarea
                    value={novoAcrescimo}
                    onChange={(e) => setNovoAcrescimo(e.target.value)}
                    rows={4}
                    placeholder="Conte o fato novo: quando foi, onde, quem estava envolvido e o que foi dito ou feito."
                    className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-[13px] leading-relaxed focus:border-[#7A1F2B] focus:outline-none"
                  />
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={salvandoAcrescimo || novoAcrescimo.trim().length < 20}
                      onClick={() => void adicionarAcrescimo()}
                      className="inline-flex items-center gap-2 rounded-lg bg-[#7A1F2B] px-3 py-2 text-[12px] font-semibold text-white hover:bg-[#63161f] disabled:opacity-40"
                    >
                      {salvandoAcrescimo ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                      Guardar este fato
                    </button>
                    <button
                      type="button"
                      onClick={() => { setCampoAcrescimoAberto(false); setNovoAcrescimo(""); }}
                      className="rounded-lg border border-zinc-300 px-3 py-2 text-[12px] font-semibold text-zinc-700 hover:bg-zinc-50"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setCampoAcrescimoAberto(true)}
                  className="mt-3 inline-flex items-center gap-2 rounded-lg border border-[#7A1F2B]/30 bg-[#7A1F2B]/5 px-3 py-2 text-[12px] font-semibold text-[#7A1F2B] hover:bg-[#7A1F2B]/10"
                >
                  <Plus className="h-3.5 w-3.5" /> Adicionar um fato novo
                </button>
              )}

              {acrescimos.length > 0 && (
                <button
                  type="button"
                  onClick={() => void gerarNarrativa()}
                  disabled={gerando}
                  className="mt-3 inline-flex items-center gap-2 rounded-lg border border-zinc-300 px-3 py-2 text-[12px] font-semibold text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
                >
                  {gerando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                  Refazer o relato com os fatos novos
                </button>
              )}
            </div>

            {/* ── Texto pronto para o cliente registrar o BO ───────────────── */}
            {textoBo && (
              <div className="rounded-lg border border-[#7A1F2B]/30 bg-[#7A1F2B]/[0.03] p-4">
                <p className="text-[11px] font-bold uppercase tracking-wider text-[#7A1F2B]">
                  Texto para você registrar o boletim de ocorrência
                </p>
                <p className="mt-1 text-[12px] leading-relaxed text-zinc-600">
                  O que você contou traz fatos que não estão em nenhum boletim. Leve o texto abaixo
                  à delegacia — ele descreve, com as suas palavras, a situação de risco em que você
                  se encontra hoje. Leia antes: você é quem assina o registro.
                </p>

                {editandoBo ? (
                  <textarea
                    value={textoBo}
                    onChange={(e) => { setTextoBo(e.target.value.slice(0, LIMITE_BO)); setTextoBoTocado(true); }}
                    rows={7}
                    className="mt-3 w-full rounded-lg border border-[#7A1F2B]/40 px-3 py-2 text-[13px] leading-relaxed text-zinc-800 focus:border-[#7A1F2B] focus:outline-none"
                  />
                ) : (
                  <p className="mt-3 rounded-lg border border-zinc-200 bg-white p-3 text-[13px] leading-relaxed text-zinc-800">
                    {textoBo}
                  </p>
                )}

                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className="text-[11px] text-zinc-400">{textoBo.length}/{LIMITE_BO} caracteres</span>
                  <button
                    type="button"
                    onClick={() => void copiar(textoBo)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 px-3 py-1.5 text-[12px] font-semibold text-zinc-700 hover:bg-zinc-50"
                  >
                    <Copy className="h-3.5 w-3.5" /> Copiar o texto
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditandoBo((v) => !v)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 px-3 py-1.5 text-[12px] font-semibold text-zinc-700 hover:bg-zinc-50"
                  >
                    <Pencil className="h-3.5 w-3.5" /> {editandoBo ? "Concluir edição" : "Ajustar"}
                  </button>
                </div>

                {/* Como abrir o BO — passo a passo, no padrão do pop-up guiado */}
                <div className="mt-4 rounded-lg border border-zinc-200 bg-white p-3">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">
                    Como registrar o seu boletim
                  </p>
                  <ol className="mt-2 space-y-2 text-[12px] leading-relaxed text-zinc-700">
                    <li><strong>1.</strong> Copie o texto acima.</li>
                    <li>
                      <strong>2.</strong> Abra a delegacia eletrônica
                      {linkBo?.url_abrir ? (
                        <>
                          {" "}da <strong>{linkBo.nome_orgao ?? linkBo.uf}</strong> e escolha comunicar ocorrência.{" "}
                          <a
                            href={linkBo.url_abrir}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 font-semibold text-[#7A1F2B] underline"
                          >
                            Abrir agora <ExternalLink className="h-3 w-3" />
                          </a>
                        </>
                      ) : (
                        <> da Polícia Civil do seu estado e escolha comunicar ocorrência. Se preferir,
                          vá pessoalmente à delegacia mais próxima.</>
                      )}
                    </li>
                    <li><strong>3.</strong> Cole o texto no campo do relato e confira os seus dados antes de enviar.</li>
                    <li>
                      <strong>4.</strong> Guarde o número do protocolo. Para acompanhar o andamento você
                      precisa do <strong>número do protocolo ou do boletim</strong>, do{" "}
                      <strong>ano do registro</strong> e do <strong>CPF do declarante</strong>.
                      {linkBo?.url_acompanhar && (
                        <>
                          {" "}
                          <a
                            href={linkBo.url_acompanhar}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 font-semibold text-[#7A1F2B] underline"
                          >
                            Acompanhar andamento <ExternalLink className="h-3 w-3" />
                          </a>
                        </>
                      )}
                    </li>
                    <li><strong>5.</strong> Quando o boletim sair, volte aqui e anexe o PDF como nova prova.</li>
                  </ol>
                </div>
              </div>
            )}

            <p className="text-[11px] leading-relaxed text-zinc-500">
              Ao aprovar, registramos a data, a hora e o carimbo da sua conexão, geramos um único
              arquivo assinado com este relato, as suas respostas e todos os anexos, e enviamos
              para o seu e-mail. Depois disso, o agendamento dos exames é liberado.
            </p>
          </div>
        ) : (
          <div className="no-scrollbar min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain px-6 py-5">
            <Trilha passoIndex={passoIndex} maxVisitado={maxVisitado} passoConcluido={passoConcluido} irPara={irPara} />

            {passo?.tipo === "pergunta" && perguntaAtual && (
              <div className="rounded-lg border border-zinc-200 p-4">
                <p className="text-[14px] font-semibold text-zinc-900">{perguntaAtual.pergunta}</p>
                <p className="mt-1 text-[12px] leading-relaxed text-zinc-500">{perguntaAtual.ajuda}</p>

                <div className="mt-3 flex gap-2">
                  {[true, false].map((v) => (
                    <button
                      key={String(v)}
                      type="button"
                      onClick={() => { setAvisoAnexo(null); void responder(perguntaAtual.campo, v); }}
                      className={`rounded-lg border px-4 py-2 text-[12px] font-semibold transition-colors ${
                        respostas[perguntaAtual.campo] === v
                          ? "border-[#7A1F2B] bg-[#7A1F2B]/5 text-[#7A1F2B]"
                          : "border-zinc-200 text-zinc-600 hover:bg-zinc-50"
                      }`}
                    >
                      {v ? "Sim" : "Não"}
                    </button>
                  ))}
                </div>

                {respostas[perguntaAtual.campo] === true && perguntaAtual.tipoProva && (
                  <button
                    type="button"
                    onClick={() => abrirSeletor(perguntaAtual.tipoProva!)}
                    disabled={enviandoTipo !== null}
                    className="mt-3 inline-flex items-center gap-2 rounded-lg border border-[#7A1F2B]/30 bg-[#7A1F2B]/5 px-3 py-2 text-[12px] font-semibold text-[#7A1F2B] hover:bg-[#7A1F2B]/10 disabled:opacity-50"
                  >
                    {enviandoTipo === perguntaAtual.tipoProva
                      ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      : <Upload className="h-3.5 w-3.5" />}
                    Anexar {LABEL_TIPO[perguntaAtual.tipoProva].toLowerCase()}
                  </button>
                )}

                {avisoAnexo && (
                  <p className="mt-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-[12px] leading-relaxed text-amber-900">
                    {avisoAnexo}
                  </p>
                )}
              </div>
            )}

            {provasDoPasso.length > 0 && (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
                <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-800">
                  Provas recebidas ({provasDoPasso.length})
                </p>
                <ul className="mt-2 space-y-2">
                  {provasDoPasso.map((pr) => (
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

            {passo?.tipo === "relato" && semProvaNenhuma && (
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

            {passo?.tipo === "relato" && (
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
                rows={10}
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
            )}

            {passo?.tipo === "contexto" && (
            <div>
              <label className="text-[12px] font-semibold text-zinc-800">
                O que, na sua rotina, aumenta o risco?
              </label>
              <textarea
                value={contexto}
                onChange={(e) => setContexto(e.target.value)}
                onBlur={() => void salvarTexto("contexto_risco", contexto)}
                rows={5}
                placeholder="Ex.: moro em zona rural isolada, transporto valores, trabalho à noite, resido sozinho com idosos."
                className="mt-1.5 w-full rounded-lg border border-zinc-200 px-3 py-2 text-[13px] leading-relaxed focus:border-[#7A1F2B] focus:outline-none"
              />
            </div>
            )}

            {passo?.tipo === "revisao" && (
              <div className="space-y-4">
                <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-[#7A1F2B]">
                    Confira antes de gerar
                  </p>
                  <ul className="mt-2 space-y-1.5 text-[12px] leading-relaxed text-zinc-700">
                    {PERGUNTAS.map((q) => (
                      <li key={q.campo}>
                        <strong>{TRILHA_ROTULO[q.campo]}:</strong>{" "}
                        {respostas[q.campo] === true ? "sim" : respostas[q.campo] === false ? "não" : "sem resposta"}
                      </li>
                    ))}
                    <li><strong>Provas anexadas:</strong> {provas.length}</li>
                    <li><strong>Relato:</strong> {relato.trim().length} caracteres</li>
                  </ul>
                </div>
                {!podeConcluir && (
                  <p className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-[12px] leading-relaxed text-amber-900">
                    Ainda falta responder alguma pergunta ou detalhar o relato. Volte pelas etapas
                    acima — sem isso não conseguimos montar o seu texto.
                  </p>
                )}
                <p className="text-[11px] leading-relaxed text-zinc-500">
                  Ao gerar, montamos o seu relato em primeira pessoa e o texto que você leva à
                  delegacia. Você lê tudo antes e só então aprova.
                </p>
              </div>
            )}
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
