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
import { Loader2, X, Upload, Check, FileText, ShieldAlert, ArrowRight, Pencil, RefreshCw, ShieldCheck, Copy, Plus, ExternalLink, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { extrairTextoPdf } from "@/lib/quero-armas/extracaoLocalPdf";
import { parseCertidao } from "@/lib/quero-armas/parsersCertidoes";
import {
  BLOCOS_EXPLICACAO_BO,
  TERMO_BO_CODIGO,
  TERMO_BO_TEXTO,
  TERMO_BO_TITULO,
  TERMO_BO_VERSAO,
  montarTextoTermoBo,
} from "@/lib/quero-armas/boExplicacao";
import {
  EFETIVA_PASSOS_IDS,
  avaliarSuficienciaBo,
  efetivaFoiDevolvida,
  temFatoNovoForaDoTexto,
  textoBoRefeitoAposRegistro,
} from "@/lib/quero-armas/efetivaNecessidadePassos";
import {
  aguardandoOutroBo,
  casarProvaComTese,
  descreverCasamento,
  tesesPendentes,
  type CasamentoTese,
  type EfetivaTeseLike,
} from "@/lib/quero-armas/efetivaTeses";

interface Props {
  open: boolean;
  processoId: string;
  clienteId: number;
  onClose: () => void;
  onConcluido?: () => void;
  /**
   * Modo embutido: o fluxo roda DENTRO do pop-up guiado (sem overlay, sem
   * header e sem X próprios). Regra do usuário (09/08/2026): a efetiva
   * necessidade não abre um segundo pop-up — ela substitui o conteúdo do
   * checklist guiado e os seus passos contam como itens do grupo.
   */
  embedded?: boolean;
  /**
   * Quando o pop-up guiado quebra a efetiva necessidade em itens da fila, cada
   * item renderiza este componente travado em UM passo. O wizard deixa de ser
   * um fluxo paralelo: ele é o corpo do item atual do checklist.
   */
  passoId?: string;
  /** Avisa o portal que o estado do passo mudou (recontar a fila/grupo). */
  onPassoConcluido?: () => void;
  /**
   * Avisa o portal QUAL passo está em tela agora. Ao voltar uma página, a
   * contagem "N de M concluídos" do grupo precisa voltar junto — sem isso o
   * rodapé fica travado no ponto mais avançado que o cliente já atingiu.
   */
  onPassoAtualChange?: (passoId: string) => void;
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
  /* Campos lidos do documento — é com eles que o boletim é casado com a frente
   * de risco a que pertence, sem o cliente ter de adivinhar nada. */
  relato: string | null;
  local_fato: string | null;
  vitima_nome: string | null;
  created_at: string | null;
}

/** Colunas da prova que a tela precisa — inclusive as do casamento por tese. */
const COLUNAS_PROVA =
  "id, tipo, numero, data_fato, naturezas, arquivo_nome, leitura_por, relato, local_fato, vitima_nome, created_at";

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
    ajuda: "Ameaça, furto, roubo, invasão, violência, perseguição — qualquer fato que a polícia registrou. Tem mais de um? Envie todos, um por um, inclusive os antigos: boletim antigo prova reiteração — mostra que isso não é episódio isolado e soma a favor do seu pedido. Cada boletim é uma prova a mais do seu lado. Não precisa estar no seu nome: se aconteceu com pai, mãe, esposa, marido, companheira(o), filhos ou quem mora com você, e isso mexeu com a sua segurança, sua casa, sua rotina ou seu trabalho, conta do mesmo jeito. E conta também o que aconteceu no trabalho, ou por causa dele: ameaça de cliente, paciente, aluno, detento, colega, fornecedor ou de alguém insatisfeito; abordagem no expediente, no trajeto, na ronda, na entrega, no atendimento externo, no plantão. Se o risco vem da sua atividade, ele entra aqui.",
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
type PassoTipo =
  | "pergunta"
  | "relato"
  | "contexto"
  | "revisao"
  | "teses"
  | "entender_bo"
  | "registrar_bo"
  | "enviar_bo"
  | "defesa_final";

type Passo = {
  id: string;
  tipo: PassoTipo;
  titulo: string;
  campo?: (typeof PERGUNTAS)[number]["campo"];
};

const PASSOS_BASE: Passo[] = [
  ...PERGUNTAS.map((q) => ({
    id: q.campo,
    tipo: "pergunta" as const,
    titulo: q.pergunta,
    campo: q.campo,
  })),
  { id: "relato", tipo: "relato", titulo: "Conte o que está acontecendo" },
  { id: "contexto", tipo: "contexto", titulo: "O que, na sua rotina, aumenta o risco?" },
  { id: "revisao", tipo: "revisao", titulo: "Revisão e geração do relato" },
  { id: "teses", tipo: "teses", titulo: "Confira as suas frentes de risco" },
];

/**
 * Passos do boletim. Eles existem SEMPRE — quem diz se estão cumpridos é a
 * regra de negócio (`avaliarSuficienciaBo`), não a IA. Amarrá-los ao texto
 * gerado pela IA foi o que prendeu o cliente num círculo em 15/08/2026.
 */
const PASSOS_BO: Passo[] = [
  { id: "entender_bo", tipo: "entender_bo", titulo: "Antes de ir à delegacia, entenda o boletim" },
  { id: "registrar_bo", tipo: "registrar_bo", titulo: "Registrar o boletim na delegacia" },
  { id: "enviar_bo", tipo: "enviar_bo", titulo: "Enviar o boletim registrado" },
  { id: "defesa_final", tipo: "defesa_final", titulo: "Defesa final e aprovação" },
];

const TRILHA_ROTULO: Record<string, string> = {
  tem_bo: "Boletim de ocorrência",
  tem_inquerito: "Inquérito policial",
  tem_acao_criminal: "Ação criminal",
  sofre_ameaca: "Ameaça atual",
  relato: "Seu relato",
  contexto: "Rotina de risco",
  revisao: "Revisão e geração",
  teses: "Frentes de risco",
  entender_bo: "Entenda o BO",
  registrar_bo: "Registrar o BO",
  enviar_bo: "Enviar o BO",
  defesa_final: "Defesa final",
};

/* Índices por id — somar um passo à lista não pode mexer em quem retoma o
 * fluxo pelo meio. Antes eram contas sobre `PASSOS_BASE.length`. */
const indiceBase = (id: string) => PASSOS_BASE.findIndex((p) => p.id === id);
const PASSO_REVISAO = indiceBase("revisao");
const PASSO_RELATO = indiceBase("relato");
const PASSO_CONTEXTO = indiceBase("contexto");

/**
 * Trilha numerada — mesma linguagem visual da lista de passos do pop-up
 * guiado: marcador circular, linha vertical e check no que já foi cumprido.
 */
function Trilha({
  passos, passoIndex, maxVisitado, passoConcluido, irPara,
}: {
  passos: Passo[];
  passoIndex: number;
  maxVisitado: number;
  passoConcluido: (i: number) => boolean;
  irPara: (i: number) => void;
}) {
  return (
    <ol className="relative space-y-1.5 border-l border-zinc-200 pl-4">
      {passos.map((p, i) => {
        const atual = i === passoIndex;
        const feito = passoConcluido(i);
        const liberado = i <= maxVisitado;
        return (
          <li key={p.id} className="relative">
            <span
              className={`absolute -left-[1.4rem] top-0.5 flex h-4 w-4 items-center justify-center rounded-full border text-[9px] font-bold ${
                atual
                  ? "border-[#7A1F2B] bg-[#7A1F2B] text-white"
                  : feito
                    ? "border-emerald-500 bg-emerald-500 text-white"
                    : "border-zinc-300 bg-white text-zinc-400"
              }`}
            >
              {feito && !atual ? <Check className="h-2.5 w-2.5" /> : i + 1}
            </span>
            <button
              type="button"
              disabled={!liberado}
              onClick={() => irPara(i)}
              className={`text-left text-[11px] uppercase tracking-[0.08em] transition-colors ${
                atual
                  ? "font-bold text-[#7A1F2B]"
                  : liberado
                    ? "text-zinc-500 hover:text-zinc-800"
                    : "text-zinc-300"
              }`}
            >
              {TRILHA_ROTULO[p.id] ?? p.titulo}
            </button>
          </li>
        );
      })}
    </ol>
  );
}

const dataBR = (iso: string | null | undefined) => {
  const m = String(iso ?? "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : null;
};

export default function EfetivaNecessidadeModal({
  open, processoId, clienteId, onClose, onConcluido, embedded = false,
  passoId, onPassoConcluido, onPassoAtualChange,
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
  const [passoIndex, setPassoIndex] = useState(0);
  const [maxVisitado, setMaxVisitado] = useState(0);
  const [avisoAnexo, setAvisoAnexo] = useState<string | null>(null);
  const [narrativa, setNarrativa] = useState("");
  const [textoBo, setTextoBo] = useState("");
  /** BO ainda por registrar na delegacia (coluna `bo_pendente_registro`). */
  const [boPendenteRegistro, setBoPendenteRegistro] = useState(false);
  const [boRegistradoConfirmado, setBoRegistradoConfirmado] = useState(false);
  /* As duas datas do boletim. O carimbo da declaração NUNCA é apagado — quem
   * decide se o passo reabre é o confronto entre elas. */
  const [boRegistradoEm, setBoRegistradoEm] = useState<string | null>(null);
  const [textoBoGeradoEm, setTextoBoGeradoEm] = useState<string | null>(null);
  const [textoBoTocado, setTextoBoTocado] = useState(false);
  const [editandoBo, setEditandoBo] = useState(false);
  /* ── Teses de defesa: uma frente de risco, um boletim ──────────────────
   * Regra do usuário (17/08/2026). A IA propõe as frentes a partir do que o
   * cliente contou; ele confirma ou reescreve os títulos, leva um texto por
   * frente à delegacia e volta com um boletim para cada uma.               */
  const [teses, setTeses] = useState<EfetivaTeseLike[]>([]);
  const [tituloEditado, setTituloEditado] = useState<Record<string, string>>({});
  const [textoTeseEditado, setTextoTeseEditado] = useState<Record<string, string>>({});
  const [teseEmEdicao, setTeseEmEdicao] = useState<string | null>(null);
  const [salvandoTese, setSalvandoTese] = useState<string | null>(null);
  /** Boletim recém-anexado esperando o cliente confirmar a qual frente pertence. */
  const [casamento, setCasamento] = useState<{ prova: Prova; sugestao: CasamentoTese } | null>(null);
  const [confirmandoVinculo, setConfirmandoVinculo] = useState(false);
  /** Resposta do cliente à pergunta "quer abrir outro boletim?". */
  const [boQuerOutro, setBoQuerOutro] = useState<boolean | null>(null);
  const [boAguardandoDesde, setBoAguardandoDesde] = useState<string | null>(null);
  const [boDestravadoEm, setBoDestravadoEm] = useState<string | null>(null);
  const [respondendoQuerOutro, setRespondendoQuerOutro] = useState(false);
  /**
   * Travado esperando o próximo boletim? Fica AQUI, junto do estado que ele
   * lê, porque as travas do "aprovar" e do "Próximo" dependem dele — e elas
   * são declaradas antes das contas derivadas do fim do componente.
   */
  const esperandoOutroBo = useMemo(
    () =>
      aguardandoOutroBo({
        bo_quer_outro: boQuerOutro,
        bo_aguardando_desde: boAguardandoDesde,
        bo_destravado_em: boDestravadoEm,
      }),
    [boQuerOutro, boAguardandoDesde, boDestravadoEm],
  );
  const [acrescimos, setAcrescimos] = useState<Acrescimo[]>([]);
  /** Quando o texto atual foi montado — base da pergunta "quer refazer?". */
  const [narrativaGeradaEm, setNarrativaGeradaEm] = useState<string | null>(null);
  /** O cliente respondeu "agora não" à pergunta de refazer, nesta sessão. */
  const [refazerDispensado, setRefazerDispensado] = useState(false);
  const [novoAcrescimo, setNovoAcrescimo] = useState("");
  const [campoAcrescimoAberto, setCampoAcrescimoAberto] = useState(false);
  const [salvandoAcrescimo, setSalvandoAcrescimo] = useState(false);
  const [linkBo, setLinkBo] = useState<LinkBo | null>(null);
  /* ── Ciência do BO: o cliente lê a explicação e marca que entendeu ─────── */
  const [cienciaBoAceita, setCienciaBoAceita] = useState(false);
  const [cienciaBoEm, setCienciaBoEm] = useState<string | null>(null);
  const [salvandoCiencia, setSalvandoCiencia] = useState(false);
  const [ameacadorNome, setAmeacadorNome] = useState("");
  const [ameacadorCpf, setAmeacadorCpf] = useState("");
  const [gerando, setGerando] = useState(false);
  /** Motivo escrito pela equipe quando o relato volta para ajustes. */
  const [devolucaoMotivo, setDevolucaoMotivo] = useState<string | null>(null);
  const [editandoNarrativa, setEditandoNarrativa] = useState(false);
  const [narrativaTocada, setNarrativaTocada] = useState(false);
  const [aprovando, setAprovando] = useState(false);
  const [salvandoCampo, setSalvandoCampo] = useState<null | "salvando" | "salvo">(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const tipoAlvoRef = useRef<TipoProva>("boletim_ocorrencia");
  /** Último item da fila já posicionado — evita re-sincronizar a cada render. */
  const passoIdSincronizadoRef = useRef<string | null>(null);

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
        baseTextoRef.current = {
          relato_cliente: reg.relato_cliente ?? "",
          contexto_risco: reg.contexto_risco ?? "",
        };
        setNarrativa(reg.narrativa_final ?? reg.narrativa_gerada ?? "");
        setDevolucaoMotivo(
          efetivaFoiDevolvida(reg as any) ? (reg.devolucao_motivo ?? "") : null,
        );
        setTextoBo(reg.texto_bo ?? "");
        setBoPendenteRegistro(Boolean(reg.bo_pendente_registro));
        setBoRegistradoConfirmado(Boolean(reg.bo_registro_confirmado_em));
        setBoRegistradoEm(reg.bo_registro_confirmado_em ?? null);
        setTextoBoGeradoEm(reg.texto_bo_gerado_em ?? null);
        setNarrativaGeradaEm(reg.narrativa_gerada_em ?? null);
        setBoQuerOutro(typeof reg.bo_quer_outro === "boolean" ? reg.bo_quer_outro : null);
        setBoAguardandoDesde(reg.bo_aguardando_desde ?? null);
        setBoDestravadoEm(reg.bo_destravado_em ?? null);
        if (reg.narrativa_final || reg.narrativa_gerada) {
          setPassoIndex(PASSO_REVISAO);
          setMaxVisitado(PASSO_REVISAO);
        } else {
          // Retoma na primeira etapa ainda não respondida.
          const iPergunta = PERGUNTAS.findIndex(
            (q) => typeof (reg as any)[q.campo] !== "boolean",
          );
          const destino = iPergunta >= 0
            ? iPergunta
            : String(reg.relato_cliente ?? "").trim() ? PASSO_CONTEXTO : PASSO_RELATO;
          setPassoIndex(destino);
          setMaxVisitado(destino);
        }

        const { data: ts } = await supabase
          .from("qa_efetiva_teses" as any)
          .select("*")
          .eq("efetiva_necessidade_id", reg.id)
          .order("ordem");
        if (!cancelado) setTeses((ts ?? []) as unknown as EfetivaTeseLike[]);

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
          .select(COLUNAS_PROVA)
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

  /* ── Autosave que NUNCA apaga ────────────────────────────────────────────
   * Furo real (11/08/2026): o pop-up guiado monta mais de uma instância deste
   * componente e as remonta a cada recálculo da fila. Cada instância gravava
   * cegamente o seu estado local — uma instância que carregou o campo vazio
   * sobrescrevia com "" o texto recém-digitado em outra. Agora guardamos o
   * valor que veio do banco e só gravamos quando o texto realmente mudou;
   * string vazia nunca sobrescreve conteúdo existente.                      */
  const baseTextoRef = useRef<Record<"relato_cliente" | "contexto_risco", string>>({
    relato_cliente: "",
    contexto_risco: "",
  });

  const salvarTexto = useCallback(async (campo: "relato_cliente" | "contexto_risco", valor: string) => {
    if (!registroId) return;
    const base = baseTextoRef.current[campo] ?? "";
    if (valor === base) return;
    if (!valor.trim() && base.trim()) return; // vazio não apaga o que existe
    const { error } = await supabase
      .from("qa_efetiva_necessidade" as any)
      .update({ [campo]: valor, updated_at: new Date().toISOString() })
      .eq("id", registroId);
    if (!error) baseTextoRef.current[campo] = valor;
  }, [registroId]);

  /* Flush ao desmontar: avançar de passo desmonta o componente e cancelaria o
   * debounce de 800 ms, perdendo o texto digitado por último.               */
  const pendenteRef = useRef<{ relato: string; contexto: string }>({ relato: "", contexto: "" });
  pendenteRef.current = { relato, contexto };
  const salvarTextoRef = useRef(salvarTexto);
  salvarTextoRef.current = salvarTexto;
  useEffect(() => {
    return () => {
      void salvarTextoRef.current("relato_cliente", pendenteRef.current.relato);
      void salvarTextoRef.current("contexto_risco", pendenteRef.current.contexto);
    };
  }, []);

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
      // Texto de BO NUNCA é apagado por uma regeração: se a rodada não trouxe
      // texto novo, o que já estava na tela continua valendo.
      setTextoBo((atual) => String(data.texto_bo ?? "").trim() || atual);
      setNarrativaGeradaEm(String(data.narrativa_gerada_em ?? new Date().toISOString()));
      // As frentes de risco vêm junto com o relato. Tese já confirmada por ele
      // ou já coberta por um boletim volta intacta — o servidor não a reescreve.
      if (Array.isArray(data.teses)) {
        setTeses(data.teses as EfetivaTeseLike[]);
        setTituloEditado({});
        setTextoTeseEditado({});
        setTeseEmEdicao(null);
      }
      // A data do texto do BO só avança quando o texto muda de verdade. É ela
      // que reabre o passo do registro se o cliente já tinha declarado o BO.
      if (data.texto_bo_gerado_em !== undefined) {
        setTextoBoGeradoEm(data.texto_bo_gerado_em ? String(data.texto_bo_gerado_em) : null);
      }
      setRefazerDispensado(false);
      setTextoBoTocado(false);
      setEditandoBo(false);
      setCampoAcrescimoAberto(false);
      setNovoAcrescimo("");
      setNarrativaTocada(false);
      setEditandoNarrativa(false);
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
      // A pergunta "quer refazer?" nasce agora, na tela, em vez de depender de
      // o cliente achar um botão perdido no fim da página.
      setRefazerDispensado(false);
      toast.success("Fato guardado. Responda logo acima se quer refazer o seu texto com ele.");
    } catch (e) {
      console.error("[efetiva necessidade] acréscimo:", e);
      toast.error("Não foi possível salvar este fato. Tente novamente.");
    } finally {
      setSalvandoAcrescimo(false);
    }
  }, [registroId, novoAcrescimo, acrescimos.length]);

  /* ── Teses: a IA propõe, o cliente confirma ou reescreve ────────────────
   * Regra do usuário (17/08/2026): quem dá o nome à frente de risco é o
   * cliente. A confirmação fica gravada com data — é ela que libera o caminho
   * da delegacia.                                                          */
  const confirmarTese = useCallback(async (tese: EfetivaTeseLike) => {
    const id = String(tese.id ?? "");
    if (!id) return;
    const tituloNovo = (tituloEditado[id] ?? tese.titulo ?? "").trim().slice(0, 90);
    const textoNovo = (textoTeseEditado[id] ?? tese.texto_bo ?? "").trim().slice(0, LIMITE_BO);
    if (!tituloNovo) {
      toast.error("Dê um nome para esta frente de risco antes de confirmar.");
      return;
    }
    setSalvandoTese(id);
    try {
      const agora = new Date().toISOString();
      const mudouTitulo = tituloNovo !== String(tese.titulo ?? "").trim();
      const mudouTexto = textoNovo !== String(tese.texto_bo ?? "").trim();
      const patch: Record<string, unknown> = {
        titulo: tituloNovo,
        texto_bo: textoNovo || null,
        confirmada_em: agora,
        updated_at: agora,
      };
      if (mudouTitulo) patch.titulo_editado_pelo_cliente = true;
      if (mudouTexto) {
        patch.texto_bo_editado_pelo_cliente = true;
        patch.texto_bo_gerado_em = agora;
      }
      const { error } = await supabase
        .from("qa_efetiva_teses" as any)
        .update(patch)
        .eq("id", id);
      if (error) throw error;
      setTeses((lista) =>
        lista.map((t) => (String(t.id) === id ? { ...t, ...(patch as EfetivaTeseLike) } : t)),
      );
      setTeseEmEdicao(null);
      onPassoConcluido?.();
    } catch (e) {
      console.error("[efetiva necessidade] confirmar tese:", e);
      toast.error("Não foi possível salvar esta frente. Tente novamente.");
    } finally {
      setSalvandoTese(null);
    }
  }, [tituloEditado, textoTeseEditado, onPassoConcluido]);

  /**
   * O boletim anexado encaixa nesta frente? O sistema propõe pelo que leu do
   * documento (número, natureza, relato) e o CLIENTE confirma depois de ler.
   * Nada é gravado sem esse aceite.
   */
  const confirmarVinculo = useCallback(async (teseId: string) => {
    if (!casamento || !teseId || !registroId) return;
    setConfirmandoVinculo(true);
    try {
      const agora = new Date().toISOString();
      const automatico = String(casamento.sugestao.tese.id ?? "") === teseId;
      const { error } = await supabase
        .from("qa_efetiva_teses" as any)
        .update({
          prova_id: casamento.prova.id,
          vinculo_confirmado_em: agora,
          vinculo_origem: automatico ? "automatico" : "cliente",
          registro_confirmado_em: agora,
          updated_at: agora,
        })
        .eq("id", teseId);
      if (error) throw error;
      setTeses((lista) =>
        lista.map((t) =>
          String(t.id) === teseId
            ? { ...t, prova_id: casamento.prova.id, vinculo_confirmado_em: agora }
            : t,
        ),
      );
      setCasamento(null);
      // Boletim novo na mesa: a pergunta "quer abrir outro?" volta a valer.
      setBoQuerOutro(null);
      await supabase
        .from("qa_efetiva_necessidade" as any)
        .update({ bo_quer_outro: null, updated_at: agora })
        .eq("id", registroId);
      onPassoConcluido?.();
    } catch (e) {
      console.error("[efetiva necessidade] vincular boletim:", e);
      toast.error("Não foi possível ligar este boletim à sua frente de risco.");
    } finally {
      setConfirmandoVinculo(false);
    }
  }, [casamento, registroId, onPassoConcluido]);

  /**
   * "Quer abrir outro boletim?" — o laço.
   *
   * SIM: o passo trava aqui até o documento chegar. Ele pode fechar a tela; a
   * pendência continua no checklist e nada do que fez se perde. Sair sem o
   * boletim só abrindo chamado com a equipe.
   * NÃO: refazemos a síntese com o que foi lido dos boletins e ele segue para
   * a defesa final, onde aprova e a sessão é carimbada.
   */
  const responderQuerOutro = useCallback(async (quer: boolean) => {
    if (!registroId) return;
    setRespondendoQuerOutro(true);
    try {
      const agora = new Date().toISOString();
      const { error } = await supabase
        .from("qa_efetiva_necessidade" as any)
        .update({
          bo_quer_outro: quer,
          bo_aguardando_desde: quer ? agora : null,
          updated_at: agora,
        })
        .eq("id", registroId);
      if (error) throw error;
      setBoQuerOutro(quer);
      setBoAguardandoDesde(quer ? agora : null);
      onPassoConcluido?.();
      if (quer) {
        toast.success(
          "Certo. Guardamos o seu lugar aqui: quando o novo boletim sair, é só voltar e anexar.",
        );
        return;
      }
      // Encerrou o ciclo: a síntese é refeita com os dados lidos dos boletins
      // que ele anexou, e é essa versão que ele lê e aprova na defesa final.
      const chegouBoDepois = provas.some((p) => {
        const t = Date.parse(String((p as any).created_at ?? ""));
        const n = Date.parse(String(narrativaGeradaEm ?? ""));
        return Number.isFinite(t) && (!Number.isFinite(n) || t > n);
      });
      if (chegouBoDepois) await gerarNarrativa();
    } catch (e) {
      console.error("[efetiva necessidade] quer outro BO:", e);
      toast.error("Não foi possível salvar a sua resposta. Tente novamente.");
    } finally {
      setRespondendoQuerOutro(false);
    }
  }, [registroId, provas, narrativaGeradaEm, gerarNarrativa, onPassoConcluido]);

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
    /* ── Trava dura, agora também AQUI ────────────────────────────────────
     * A fila do pop-up guiado transforma cada passo num item independente, e
     * o item "Defesa final" abria direto — furando as travas do "Próximo".
     * Foi assim que um cliente fechou a efetiva necessidade em 13/08/2026 sem
     * um único boletim no processo. A trava passa a valer no próprio botão.  */
    const suf = avaliarSuficienciaBo(provas, relato);
    const boEmMaos =
      provas.some((p) => p.tipo === "boletim_ocorrencia") &&
      (!suf.exigeNovoBo || !boPendenteRegistro);
    if (!boEmMaos) {
      toast.error(
        "Antes de aprovar, conclua o passo do boletim de ocorrência: registre o boletim e anexe o documento aqui.",
      );
      return;
    }
    // Ele mesmo disse que ia abrir outro boletim: aprovar agora fecharia a
    // defesa pela metade. Sair sem o documento, só com destrava da equipe.
    if (esperandoOutroBo) {
      toast.error(
        "Você informou que vai abrir outro boletim. Anexe esse documento para aprovar — ou fale com a nossa equipe para liberar a sua continuação sem ele.",
      );
      return;
    }
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
  }, [
    registroId, narrativa, narrativaTocada, textoBo, textoBoTocado,
    provas, relato, boPendenteRegistro, esperandoOutroBo, onConcluido, onClose,
  ]);

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

      /* 1.b) Mesmo boletim outra vez?
       * Furo real (17/08/2026, cliente Mizael): sem texto separado por frente
       * de risco, ele voltou ao mesmo passo e subiu o MESMO boletim duas
       * vezes. Agora o número lido barra a repetição na hora — e ele fica
       * sabendo o que fazer em vez de duplicar o documento. */
      const numeroLido = String((lidos.numero_bo as string) ?? "").replace(/[^0-9A-Za-z]/g, "");
      if (numeroLido) {
        const jaExiste = provas.some(
          (p) =>
            p.tipo === tipo &&
            String(p.numero ?? "").replace(/[^0-9A-Za-z]/g, "") === numeroLido,
        );
        if (jaExiste) {
          toast.error(
            `Este boletim (nº ${lidos.numero_bo}) já está anexado. Se você registrou outro, na delegacia, anexe o PDF dele.`,
          );
          return;
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
        .select(COLUNAS_PROVA)
        .single();
      if (error) throw error;

      setProvas((p) => [...p, prova as unknown as Prova]);

      /* 3.b) A qual frente de risco este boletim pertence?
       * O sistema casa sozinho pelo que leu do documento e MOSTRA o encaixe.
       * Quem confirma é o cliente, depois de ler — regra do usuário. */
      if (tipo === "boletim_ocorrencia") {
        const sugestao = casarProvaComTese(prova as unknown as Prova, teses);
        if (sugestao) setCasamento({ prova: prova as unknown as Prova, sugestao });
      }

      // O boletim que faltava chegou: o passo "registrar o BO" se encerra e a
      // defesa final é liberada.
      if (tipo === "boletim_ocorrencia" && boPendenteRegistro) {
        setBoPendenteRegistro(false);
        void supabase
          .from("qa_efetiva_necessidade" as any)
          .update({ bo_pendente_registro: false, updated_at: new Date().toISOString() })
          .eq("id", registroId);
      }

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
  }, [registroId, clienteId, provas, boPendenteRegistro, teses]);

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

  /**
   * A fila de passos — 11, sempre, na ORDEM CANÔNICA da lib.
   *
   * Antes esta lista era montada a partir do `texto_bo`: sem texto, 7 passos.
   * Como o checklist sempre contou 11, o item "Registrar o boletim" da fila
   * caía num índice inexistente e renderizava a tela de Revisão, onde o botão
   * virava "Concordo e aprovo". O cliente aprovava, nada mudava, e a exigência
   * reabria — círculo fechado. Uma lista só, vinda de um lugar só.
   */
  const passos = useMemo<Passo[]>(() => {
    const porId = new Map<string, Passo>(
      [...PASSOS_BASE, ...PASSOS_BO].map((p) => [p.id, p]),
    );
    return EFETIVA_PASSOS_IDS.map((id) => porId.get(id)).filter(Boolean) as Passo[];
  }, []);

  const provasBo = useMemo(
    () => provas.filter((p) => p.tipo === "boletim_ocorrencia"),
    [provas],
  );
  /**
   * Boletim antigo prova reiteração. Só exigimos registro novo quando não há
   * nada recente — regra do usuário (09/08/2026).
   */
  const suficienciaBo = useMemo(
    () => avaliarSuficienciaBo(provas, relato),
    [provas, relato],
  );
  const boEntregue =
    provasBo.length > 0 && (!suficienciaBo.exigeNovoBo || !boPendenteRegistro);

  /* ── O laço dos boletins ────────────────────────────────────────────────
   * Uma frente de risco, um boletim. Enquanto ele disser que vai abrir outro,
   * o passo do envio fica aberto — travado de propósito. Sair sem o documento
   * só com destrava da equipe (chamado). Regra do usuário (17/08/2026).    */
  const tesesEmAberto = useMemo(() => tesesPendentes(teses), [teses]);
  const teseAtual = tesesEmAberto[0] ?? null;
  const todasTesesConfirmadas = useMemo(
    () => teses.length > 0 && teses.every((t) => !!String(t.confirmada_em ?? "").trim()),
    [teses],
  );
  /** O texto que ele leva à delegacia AGORA — o da frente de risco em aberto. */
  const textoBoDaVez = String(teseAtual?.texto_bo ?? "").trim() || textoBo;

  /**
   * O cliente mexeu no texto do boletim DEPOIS de dizer que já tinha
   * registrado? Então o BO que ele registrou não cobre mais o texto atual, e o
   * passo do registro reabre para aditamento. O carimbo da declaração dele
   * continua gravado — o que muda é só a exigência.
   */
  const boTextoMudouAposRegistro = useMemo(
    () =>
      textoBoRefeitoAposRegistro({
        bo_registro_confirmado_em: boRegistradoEm,
        texto_bo_gerado_em: textoBoGeradoEm,
      }),
    [boRegistradoEm, textoBoGeradoEm],
  );

  /** A declaração do cliente só vale enquanto o texto dela continuar valendo. */
  const registroBoValido = boEntregue || (boRegistradoConfirmado && !boTextoMudouAposRegistro);

  const passo = passos[Math.min(passoIndex, passos.length - 1)];
  const perguntaAtual = passo?.campo
    ? PERGUNTAS.find((q) => q.campo === passo.campo) ?? null
    : null;

  /** Uma etapa está concluída quando o que ela pede já foi entregue. */
  const passoConcluido = useCallback((i: number) => {
    const p = passos[i];
    if (!p) return false;
    if (p.tipo === "pergunta") return typeof respostas[p.campo!] === "boolean";
    if (p.tipo === "relato") return !semProvaNenhuma || relato.trim().length >= RELATO_MINIMO;
    if (p.tipo === "contexto") return contexto.trim().length > 0;
    if (p.tipo === "revisao") return narrativa.trim().length > 0;
    if (p.tipo === "teses") return teses.length === 0 ? narrativa.trim().length > 0 : todasTesesConfirmadas;
    if (p.tipo === "entender_bo") return cienciaBoAceita;
    if (p.tipo === "registrar_bo") return registroBoValido;
    if (p.tipo === "enviar_bo") return boEntregue && !esperandoOutroBo && !casamento;
    return false;
  }, [
    passos, respostas, relato, contexto, semProvaNenhuma, narrativa, cienciaBoAceita,
    registroBoValido, boEntregue, teses.length, todasTesesConfirmadas, esperandoOutroBo, casamento,
  ]);

  /** O "Próximo" só trava onde a regra de negócio já travava antes. */
  const podeAvancar = useMemo(() => {
    if (!passo) return false;
    if (passo.tipo === "pergunta") return typeof respostas[passo.campo!] === "boolean";
    if (passo.tipo === "relato") return !semProvaNenhuma || relato.trim().length >= RELATO_MINIMO;
    if (passo.tipo === "revisao") return narrativa.trim().length > 0;
    // Trava dura: as frentes de risco são confirmadas por ele, uma a uma.
    if (passo.tipo === "teses") {
      return teses.length === 0 ? narrativa.trim().length > 0 : todasTesesConfirmadas;
    }
    // Trava dura: sem a ciência marcada, não se manda ninguém à delegacia.
    if (passo.tipo === "entender_bo") return cienciaBoAceita;
    if (passo.tipo === "registrar_bo") return registroBoValido;
    // Trava dura: sem o boletim registrado em mãos, a defesa final não abre.
    // E, se ele disse que vai abrir outro, o passo trava até esse outro chegar.
    if (passo.tipo === "enviar_bo") return boEntregue && !esperandoOutroBo && !casamento;
    return true;
  }, [
    passo, respostas, relato, semProvaNenhuma, narrativa, cienciaBoAceita, registroBoValido,
    boEntregue, teses.length, todasTesesConfirmadas, esperandoOutroBo, casamento,
  ]);

  const irPara = useCallback((i: number) => {
    const destino = Math.max(0, Math.min(passos.length - 1, i));
    setAvisoAnexo(null);
    setPassoIndex((atual) => {
      // Voltar não pode disparar recontagem/remontagem do item da fila —
      // era isso que jogava o cliente de volta para a tela da frente.
      if (passoId && destino > atual) onPassoConcluido?.();
      return destino;
    });
    setMaxVisitado((m) => Math.max(m, destino));
    // O rodapé do pop-up guiado acompanha o passo em tela — inclusive quando
    // o cliente volta uma página.
    onPassoAtualChange?.(String(passos[destino]?.id ?? ""));
  }, [passos, passoId, onPassoConcluido, onPassoAtualChange]);

  /**
   * Travado no passo que o item da fila representa. Sem isto o wizard
   * retomaria pelo estado interno e ignoraria qual item o cliente abriu.
   */
  useEffect(() => {
    if (!passoId) return;
    // Só reposiciona quando o item da fila realmente muda. Sem esta trava o
    // efeito reexecutava a cada render do portal e desfazia o "Anterior".
    if (passoIdSincronizadoRef.current === passoId) return;
    const i = passos.findIndex((p) => p.id === passoId);
    if (i < 0) return;
    passoIdSincronizadoRef.current = passoId;
    setPassoIndex(i);
    setMaxVisitado((m) => Math.max(m, i));
    onPassoAtualChange?.(String(passoId));
  }, [passoId, passos, onPassoAtualChange]);

  const avancar = useCallback(() => {
    const p = passos[passoIndex];
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
  }, [passos, passoIndex, perguntaAtual, respostas, provas, avisoAnexo, irPara]);

  /**
   * "Já registrei o boletim" — agora fica GRAVADO. Antes era estado local: o
   * cliente clicava, avançava, e o checklist continuava cobrando o passo para
   * sempre porque ninguém tinha contado nada ao banco.
   */
  const confirmarRegistroBo = useCallback(async () => {
    const agora = new Date().toISOString();
    setBoRegistradoConfirmado(true);
    setBoRegistradoEm(agora);
    if (registroId) {
      const { error } = await supabase
        .from("qa_efetiva_necessidade" as any)
        .update({
          // Reconfirmar depois de mudar o texto ATUALIZA o carimbo — nunca o
          // apaga. Cada declaração vira uma linha na auditoria (trigger
          // trg_qa_efetiva_rastro_bo), então o histórico completo fica de pé.
          bo_registro_confirmado_em: agora,
          updated_at: agora,
        })
        .eq("id", registroId);
      if (error) console.error("[efetiva necessidade] confirmar registro BO:", error);
      else onPassoConcluido?.();
    }
    // A declaração também fica na frente de risco que ele acabou de registrar —
    // é o que permite acompanhar boletim a boletim, e não só "o boletim".
    if (teseAtual?.id) {
      void supabase
        .from("qa_efetiva_teses" as any)
        .update({ registro_confirmado_em: agora, updated_at: agora })
        .eq("id", teseAtual.id);
      setTeses((lista) =>
        lista.map((t) => (t.id === teseAtual.id ? { ...t, registro_confirmado_em: agora } : t)),
      );
    }
    irPara(passoIndex + 1);
  }, [registroId, irPara, passoIndex, onPassoConcluido, teseAtual]);

  /**
   * Há fato acrescentado que ainda não entrou no texto? É o que faz nascer a
   * pergunta de autorização. O texto que o CLIENTE digitou nunca é tocado —
   * o que se refaz é só o texto montado pela IA, e só se ele mandar.
   */
  const temFatoNovoPendente = useMemo(
    () => temFatoNovoForaDoTexto({ narrativa_gerada_em: narrativaGeradaEm }, acrescimos),
    [narrativaGeradaEm, acrescimos],
  );

  const qtdFatosNovos = useMemo(() => {
    const t = Date.parse(String(narrativaGeradaEm ?? ""));
    if (!Number.isFinite(t)) return acrescimos.length;
    return acrescimos.filter((a) => Date.parse(String(a.created_at ?? "")) > t).length;
  }, [acrescimos, narrativaGeradaEm]);

  /* ── Ciência do BO ───────────────────────────────────────────────────────
   * O aceite é permanente: fica no cadastro do cliente com o texto integral
   * que estava na tela, o hash desse texto e o carimbo da conexão. Se já
   * existe aceite desta versão, a tela abre marcada e não pede de novo.
   * ---------------------------------------------------------------------- */
  useEffect(() => {
    if (!open || !clienteId) return;
    let cancelado = false;
    (async () => {
      const { data } = await supabase
        .from("qa_cliente_ciencias" as any)
        .select("aceito_em, metadados")
        .eq("cliente_id", clienteId)
        .eq("termo_codigo", TERMO_BO_CODIGO)
        .eq("termo_versao", TERMO_BO_VERSAO)
        .order("aceito_em", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (cancelado || !data) return;
      const meta = ((data as any).metadados ?? {}) as Record<string, unknown>;
      setCienciaBoAceita(true);
      setCienciaBoEm(String((data as any).aceito_em ?? ""));
      if (typeof meta.ameacador_nome === "string") setAmeacadorNome(meta.ameacador_nome);
      if (typeof meta.ameacador_cpf === "string") setAmeacadorCpf(meta.ameacador_cpf);
    })();
    return () => { cancelado = true; };
  }, [open, clienteId]);

  const registrarCienciaBo = useCallback(async () => {
    if (cienciaBoAceita || salvandoCiencia) return;
    setSalvandoCiencia(true);
    try {
      const { data, error } = await supabase.functions.invoke("qa-registrar-ciencia", {
        body: {
          cliente_id: clienteId,
          processo_id: processoId ? Number(processoId) || null : null,
          termo_codigo: TERMO_BO_CODIGO,
          termo_versao: TERMO_BO_VERSAO,
          termo_titulo: TERMO_BO_TITULO,
          termo_texto: montarTextoTermoBo(),
          origem: "portal_cliente_efetiva_necessidade",
          metadados: {
            ameacador_nome: ameacadorNome.trim() || null,
            ameacador_cpf: ameacadorCpf.replace(/\D/g, "") || null,
            tela: "efetiva_necessidade/entender_bo",
            fuso: Intl.DateTimeFormat().resolvedOptions().timeZone,
            tela_px: `${window.screen?.width ?? 0}x${window.screen?.height ?? 0}`,
          },
        },
      });
      if (error || (data as any)?.error) throw new Error((data as any)?.error ?? error?.message);
      setCienciaBoAceita(true);
      setCienciaBoEm((data as any)?.ciencia?.aceito_em ?? new Date().toISOString());
      onPassoConcluido?.();
    } catch (e) {
      toast.error("Não consegui registrar a sua ciência. Tente de novo.");
      console.error(e);
    } finally {
      setSalvandoCiencia(false);
    }
  }, [cienciaBoAceita, salvandoCiencia, clienteId, processoId, ameacadorNome, ameacadorCpf, onPassoConcluido]);

  /** Cada etapa mostra apenas as provas que ela mesma pediu. */
  const provasDoPasso = useMemo(() => {
    if (passo?.tipo === "revisao") return provas;
    if (passo?.tipo === "enviar_bo") return provasBo;
    if (!perguntaAtual?.tipoProva) return [];
    return provas.filter((p) => p.tipo === perguntaAtual.tipoProva);
  }, [provas, provasBo, passo, perguntaAtual]);

  if (!open) return null;

  // `registrar_bo` entra AQUI sempre — mesmo sem narrativa montada. Antes,
  // sem narrativa, esse passo caía no ramo de baixo, que não tem nada para
  // ele: tela em branco no meio do caminho da delegacia.
  const narrativaNaTela =
    (!!narrativa && (passo?.tipo === "revisao" || passo?.tipo === "defesa_final")) ||
    passo?.tipo === "registrar_bo";

  /** Último passo do caminho — é onde a aprovação acontece. */
  const passoFinal = passoIndex === passos.length - 1;

  /**
   * Botão principal da barra de ação. `flex-1` + `min-w-0` fazem ele tomar o
   * espaço que sobra ao lado do "Anterior", e `whitespace-nowrap` impede a
   * quebra feia do rótulo em duas linhas nas telas estreitas.
   */
  const acaoPrincipalClasse = `inline-flex min-w-0 flex-1 items-center justify-center gap-1.5 whitespace-nowrap bg-[#7A1F2B] font-bold uppercase text-white transition-colors hover:bg-[#63161f] disabled:opacity-40 ${
    embedded
      ? "h-9 rounded-lg px-4 text-[9.5px] tracking-[0.1em]"
      : "rounded-lg px-4 py-2 text-[10px] tracking-[0.1em]"
  }`;

  const conteudo = (
      <div
        className={
          embedded
            ? "relative flex w-full flex-col"
            : "relative flex max-h-[calc(100dvh-1.5rem)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl sm:max-h-[90dvh]"
        }
      >
        <div
          className={
            embedded
              ? "shrink-0 pb-4"
              : "shrink-0 flex items-start justify-between gap-3 border-b border-zinc-200 px-6 py-5 pr-14"
          }
        >
          <div>
            {/* Em modo item da fila, o pop-up guiado já mostra grupo e
                contadores — repetir "Passo N de M" confundia o cliente. */}
            {passoId ? null : (
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#7A1F2B]">
                Efetiva necessidade · Passo {passoIndex + 1} de {passos.length}
              </p>
            )}
            <h2 className={`text-[18px] font-semibold text-zinc-900 ${passoId ? "" : "mt-1"}`}>
              {passo?.titulo ?? "Vamos reunir as provas do seu caso"}
            </h2>
            {passoIndex === 0 && (
              <p className="mt-1 text-[12px] leading-relaxed text-zinc-500">
                Nossa equipe usa esse material para escrever a peça que fundamenta, perante a
                Polícia Federal, por que você precisa da arma. Quanto mais concreto, mais forte.
              </p>
            )}
          </div>
          {embedded ? null : (
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="absolute top-3 right-3 z-20 rounded-full bg-[#8A1224] p-1.5 text-white hover:bg-[#6f0f1e] transition-colors"
          >
            <X className="h-3.5 w-3.5" />
          </button>
          )}
        </div>

        {carregando ? (
          <div className="flex min-h-0 flex-1 items-center justify-center gap-2 px-6 py-16 text-[13px] text-zinc-500">
            <Loader2 className="h-4 w-4 animate-spin" /> Abrindo…
          </div>
        ) : narrativaNaTela ? (
          <div className={embedded ? "space-y-4" : "no-scrollbar min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-6 py-5"}>
            {passoId ? null : <Trilha passos={passos} passoIndex={passoIndex} maxVisitado={maxVisitado} passoConcluido={passoConcluido} irPara={irPara} />}
            {/* Devolvido para ajustes: o cliente precisa saber O QUE mudar
                antes de aprovar de novo — senão reaprova o mesmo texto. */}
            {devolucaoMotivo !== null && (
              <div className="rounded-lg border border-[#7A1F2B]/30 bg-[#7A1F2B]/5 p-4">
                <p className="text-[11px] font-bold uppercase tracking-wider text-[#7A1F2B]">
                  Nossa equipe devolveu para ajustes
                </p>
                <p className="mt-1 text-[12px] leading-relaxed text-zinc-700">
                  {devolucaoMotivo || "Ajuste o texto abaixo e aprove novamente."}
                </p>
                <p className="mt-2 text-[11px] leading-relaxed text-zinc-500">
                  Edite o relato abaixo com o que foi pedido e aprove de novo. A sua
                  aprovação anterior fica guardada no histórico do processo.
                </p>
              </div>
            )}
            {/* ── A pergunta de autorização para refazer ────────────────────
              * Regra do usuário (15/08/2026): o texto que o CLIENTE digitou
              * nunca é refeito — só ele apaga ou edita. O texto montado pela
              * IA só é refeito se ele autorizar, respondendo aqui. Antes isso
              * dependia de o cliente achar um botão no fim da página, e o fato
              * novo simplesmente nunca entrava na defesa dele.              */}
            {temFatoNovoPendente && !refazerDispensado && passo?.tipo !== "registrar_bo" && (
              <div className="rounded-lg border border-[#7A1F2B]/40 bg-[#7A1F2B]/[0.05] p-4">
                <p className="text-[12px] font-bold uppercase tracking-wider text-[#7A1F2B]">
                  {qtdFatosNovos === 1 ? "Você acrescentou um fato novo" : `Você acrescentou ${qtdFatosNovos} fatos novos`}
                </p>
                <p className="mt-1.5 text-[13px] font-semibold leading-relaxed text-zinc-900">
                  Deseja refazer o seu texto de defesa com os novos fatos?
                </p>
                <p className="mt-1 text-[12px] leading-relaxed text-zinc-600">
                  O que você mesmo escreveu não é alterado — só você edita o seu texto. Refazemos
                  apenas o texto que montamos para você, em primeira pessoa, somando o fato novo ao
                  que já estava lá. O texto para a delegacia é refeito junto.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={gerando}
                    onClick={() => void gerarNarrativa()}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-[#7A1F2B] px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-[#63161f] disabled:opacity-50"
                  >
                    {gerando ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                    {gerando ? "Refazendo…" : "Sim, refazer com os novos fatos"}
                  </button>
                  <button
                    type="button"
                    disabled={gerando}
                    onClick={() => setRefazerDispensado(true)}
                    className="rounded-lg border border-zinc-300 px-3 py-1.5 text-[11px] font-semibold text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
                  >
                    Agora não
                  </button>
                </div>
              </div>
            )}

            {passo?.tipo === "registrar_bo" ? null : (
            <>
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
                className="inline-flex items-center gap-2 rounded-lg border border-zinc-300 px-3 py-1.5 text-[11px] font-semibold text-zinc-700 hover:bg-zinc-50"
              >
                <Pencil className="h-3.5 w-3.5" />
                {editandoNarrativa ? "Concluir edição" : "Editar o texto"}
              </button>
              <button
                type="button"
                onClick={() => void gerarNarrativa()}
                disabled={gerando}
                className="inline-flex items-center gap-2 rounded-lg border border-zinc-300 px-3 py-1.5 text-[11px] font-semibold text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
              >
                {gerando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                Refazer o relato
              </button>
              {/* Botão morto até 15/08/2026: chamava `setEtapa("provas")`, e
                  `etapa` não é lido em lugar nenhum da renderização — a tela
                  vem de `passo.tipo`. Agora ele volta de fato ao começo. */}
              <button
                type="button"
                onClick={() => irPara(0)}
                className="inline-flex items-center gap-2 rounded-lg border border-zinc-300 px-3 py-1.5 text-[11px] font-semibold text-zinc-700 hover:bg-zinc-50"
              >
                Voltar e corrigir provas
              </button>
            </div>

            {/* ── Fatos novos: abre um campo, guarda no histórico e refaz ─── */}
            <div className="rounded-lg border border-zinc-200 p-4">
              <p className="text-[12px] font-semibold text-zinc-900">Aconteceu mais alguma coisa?</p>
              <p className="mt-1 text-[11px] leading-relaxed text-zinc-500">
                Se você lembrou de outro fato, ou algo novo aconteceu depois, escreva aqui. Nada do
                que você já contou é apagado. Depois de guardar, nós perguntamos se você quer
                refazer o seu texto de defesa incluindo ele — a decisão é sua.
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
                      className="inline-flex items-center gap-1.5 rounded-lg bg-[#7A1F2B] px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-[#63161f] disabled:opacity-40"
                    >
                      {salvandoAcrescimo ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                      Guardar este fato
                    </button>
                    <button
                      type="button"
                      onClick={() => { setCampoAcrescimoAberto(false); setNovoAcrescimo(""); }}
                      className="rounded-lg border border-zinc-300 px-3 py-1.5 text-[11px] font-semibold text-zinc-700 hover:bg-zinc-50"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setCampoAcrescimoAberto(true)}
                  className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-[#7A1F2B]/30 bg-[#7A1F2B]/5 px-3 py-1.5 text-[11px] font-semibold text-[#7A1F2B] hover:bg-[#7A1F2B]/10"
                >
                  <Plus className="h-3 w-3" /> Adicionar um fato novo
                </button>
              )}

              {acrescimos.length > 0 && (
                <button
                  type="button"
                  onClick={() => void gerarNarrativa()}
                  disabled={gerando}
                  className="mt-3 inline-flex items-center gap-2 rounded-lg border border-zinc-300 px-3 py-1.5 text-[11px] font-semibold text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
                >
                  {gerando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                  Refazer o relato com os fatos novos
                </button>
              )}
            </div>
            </>
            )}

            {/* ── Texto pronto para o cliente registrar o BO ─────────────────
              * Um texto por FRENTE DE RISCO. O que aparece aqui é o da frente
              * que ainda espera boletim — e ele não menciona as outras, para o
              * registro na delegacia se sustentar sozinho.                  */}
            {textoBoDaVez && passo?.tipo !== "revisao" && (
              <div className="rounded-lg border border-[#7A1F2B]/30 bg-[#7A1F2B]/[0.03] p-4">
                <p className="text-[11px] font-bold uppercase tracking-wider text-[#7A1F2B]">
                  {teseAtual
                    ? `Texto do boletim — ${teseAtual.titulo}`
                    : "Texto para você registrar o boletim de ocorrência"}
                </p>
                <p className="mt-1 text-[12px] leading-relaxed text-zinc-600">
                  {teseAtual && tesesEmAberto.length > 1 ? (
                    <>
                      Este é o texto de <strong>uma</strong> das suas frentes — ainda faltam{" "}
                      {tesesEmAberto.length - 1}. Registre um boletim por vez: cada um trata da sua
                      situação, sem citar a outra.{" "}
                    </>
                  ) : null}
                  O que você contou traz fatos que não estão em nenhum boletim. Leve o texto abaixo
                  à delegacia — ele descreve, com as suas palavras, a situação de risco em que você
                  se encontra hoje. Leia antes: você é quem assina o registro.
                </p>

                {editandoBo ? (
                  <textarea
                    value={textoBoDaVez}
                    onChange={(e) => {
                      const valor = e.target.value.slice(0, LIMITE_BO);
                      if (teseAtual?.id) {
                        setTextoTeseEditado((m) => ({ ...m, [String(teseAtual.id)]: valor }));
                      } else {
                        setTextoBo(valor);
                        setTextoBoTocado(true);
                      }
                    }}
                    rows={7}
                    className="mt-3 w-full rounded-lg border border-[#7A1F2B]/40 px-3 py-2 text-[13px] leading-relaxed text-zinc-800 focus:border-[#7A1F2B] focus:outline-none"
                  />
                ) : (
                  <p className="mt-3 rounded-lg border border-zinc-200 bg-white p-3 text-[13px] leading-relaxed text-zinc-800">
                    {textoBoDaVez}
                  </p>
                )}

                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className="text-[11px] text-zinc-400">{textoBoDaVez.length}/{LIMITE_BO} caracteres</span>
                  <button
                    type="button"
                    onClick={() => void copiar(textoBoDaVez)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 px-3 py-1.5 text-[11px] font-semibold text-zinc-700 hover:bg-zinc-50"
                  >
                    <Copy className="h-3.5 w-3.5" /> Copiar o texto
                  </button>
                  <button
                    type="button"
                    disabled={salvandoTese !== null}
                    onClick={() => {
                      // Ajuste no texto da frente é gravado nela — e o carimbo
                      // de "texto ajustado pelo cliente" acompanha.
                      if (editandoBo && teseAtual) void confirmarTese(teseAtual);
                      setEditandoBo((v) => !v);
                    }}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 px-3 py-1.5 text-[11px] font-semibold text-zinc-700 hover:bg-zinc-50 disabled:opacity-40"
                  >
                    <Pencil className="h-3.5 w-3.5" /> {editandoBo ? "Concluir edição" : "Ajustar"}
                  </button>
                </div>

              </div>
            )}

            {/* ── Sem o texto da IA, o passo do boletim NÃO some ────────────
              * A orientação de como registrar não depende de IA nenhuma. Se o
              * texto não veio, o cliente vê o motivo e um botão para montá-lo
              * — nunca uma tela vazia e, muito menos, a tela errada.        */}
            {passo?.tipo === "registrar_bo" && !textoBoDaVez && (
              <div className="rounded-lg border border-amber-300 bg-amber-50 p-4">
                <p className="text-[12px] font-semibold text-amber-900">
                  O texto sugerido para a delegacia ainda não está pronto
                </p>
                <p className="mt-1 text-[12px] leading-relaxed text-amber-900">
                  Você pode registrar o boletim com as suas próprias palavras agora mesmo, seguindo
                  o passo a passo abaixo. Se preferir, monte o texto sugerido em um clique.
                </p>
                <button
                  type="button"
                  onClick={() => void gerarNarrativa()}
                  disabled={gerando}
                  className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-[#7A1F2B] px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-[#63161f] disabled:opacity-50"
                >
                  {gerando ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                  {gerando ? "Montando o texto…" : "Gerar o meu texto agora"}
                </button>
              </div>
            )}

            {/* ── O cliente mudou o texto depois de declarar o registro ──────
             * O carimbo da declaração dele continua gravado. O que se diz aqui
             * é o fato: ele acrescentou o fato novo DEPOIS, e o boletim que ele
             * registrou não cobre mais o texto atual. Quem precisa voltar à
             * delegacia é ele, e o histórico mostra por quê.              */}
            {passo?.tipo === "registrar_bo" && boTextoMudouAposRegistro && (
              <div className="rounded-lg border border-[#7A1F2B] bg-[#FDF6F7] p-3">
                <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[#7A1F2B]">
                  <ShieldAlert className="h-3.5 w-3.5" /> O texto do boletim mudou
                </p>
                <p className="mt-2 text-[12px] leading-relaxed text-zinc-700">
                  {boRegistradoEm && (
                    <>
                      Em <strong>{new Date(boRegistradoEm).toLocaleString("pt-BR")}</strong> você
                      informou que já tinha registrado o boletim.{" "}
                    </>
                  )}
                  Depois disso <strong>você acrescentou fato novo</strong> e pediu para refazer o
                  texto. O boletim que você registrou não fala desse fato — ou seja, ele já não
                  corresponde ao texto que está aqui embaixo.
                </p>
                <p className="mt-2 text-[12px] leading-relaxed text-zinc-700">
                  <strong>O que fazer:</strong> volte à delegacia (ou à delegacia eletrônica) e faça
                  um <strong>aditamento</strong> ao boletim já registrado com o texto novo. Não
                  precisa abrir outro boletim do zero. Depois, confirme aqui de novo.
                </p>
                <p className="mt-2 text-[11px] leading-relaxed text-zinc-500">
                  A sua declaração anterior continua registrada no seu histórico, com data e hora —
                  nada foi apagado.
                </p>
              </div>
            )}

            {/* Como abrir o BO — passo a passo, no padrão do pop-up guiado */}
            {passo?.tipo === "registrar_bo" && (
                <div className="rounded-lg border border-zinc-200 bg-white p-3">
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
            )}

            {passo?.tipo === "registrar_bo" ? (
              <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4">
                <p className="text-[12px] leading-relaxed text-zinc-600">{suficienciaBo.motivo}</p>
                {suficienciaBo.exigeNovoBo ? (
                  <>
                    <p className="mt-2 text-[12px] leading-relaxed text-zinc-600">
                      Depois de registrar, volte aqui e envie o boletim. Sem esse documento a sua
                      defesa final não é fechada — é ele que transforma o seu relato em fato registrado.
                    </p>
                    <button
                      type="button"
                      onClick={confirmarRegistroBo}
                      className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-[#7A1F2B] px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-[#63161f]"
                    >
                      <Check className="h-3 w-3" />
                      {boTextoMudouAposRegistro
                        ? "Já levei o texto novo à delegacia"
                        : "Já registrei o boletim"}
                    </button>
                  </>
                ) : (
                  <>
                    <p className="mt-2 text-[12px] font-semibold leading-relaxed text-[#7A1F2B]">
                      Seus boletins já sustentam o pedido. Você pode seguir para a defesa final.
                    </p>
                    <button
                      type="button"
                      onClick={confirmarRegistroBo}
                      className="mt-3 inline-flex items-center gap-2 rounded-lg border border-zinc-300 px-3 py-1.5 text-[11px] font-semibold text-zinc-700 hover:bg-white"
                    >
                      <Plus className="h-3.5 w-3.5" /> Quero registrar um novo boletim mesmo assim
                    </button>
                  </>
                )}
              </div>
            ) : (
            <p className="text-[11px] leading-relaxed text-zinc-500">
              Ao aprovar, registramos a data, a hora e o carimbo da sua conexão, geramos um único
              arquivo assinado com este relato, as suas respostas e todos os anexos, e enviamos
              para o seu e-mail. Depois disso, o agendamento dos exames é liberado.
            </p>
            )}
          </div>
        ) : (
          <div className={embedded ? "space-y-5" : "no-scrollbar min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain px-6 py-5"}>
            {passoId ? null : <Trilha passos={passos} passoIndex={passoIndex} maxVisitado={maxVisitado} passoConcluido={passoConcluido} irPara={irPara} />}

            {/* ── Entenda o BO: explicação obrigatória antes da delegacia ── */}
            {passo?.tipo === "entender_bo" && (
              <div className="space-y-3">
                <p className="text-[12px] leading-relaxed text-zinc-600">
                  Antes de você ir à delegacia, leia com calma. Muita gente evita registrar
                  boletim por achar que vai “criar problema” com alguém. Não é isso que acontece.
                </p>

                {BLOCOS_EXPLICACAO_BO.map((b) => (
                  <div
                    key={b.titulo}
                    className={
                      b.destaque
                        ? "rounded-lg border border-[#7A1F2B]/30 bg-[#7A1F2B]/[0.04] p-4"
                        : "rounded-lg border border-zinc-200 bg-white p-4"
                    }
                  >
                    <p className={`text-[12px] font-semibold ${b.destaque ? "text-[#7A1F2B]" : "text-zinc-900"}`}>
                      {b.titulo}
                    </p>
                    <p className="mt-1 text-[12px] leading-relaxed text-zinc-600">{b.texto}</p>
                  </div>
                ))}

                <div className="rounded-lg border border-zinc-200 p-4">
                  <p className="text-[12px] font-semibold text-zinc-900">
                    Quem está te deixando preocupado? (opcional, mas recomendado)
                  </p>
                  <p className="mt-1 text-[11px] leading-relaxed text-zinc-500">
                    Informe se souber. Nada acontece contra a pessoa por causa disso — o registro
                    apenas fica mais forte.
                  </p>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    <input
                      value={ameacadorNome}
                      onChange={(e) => setAmeacadorNome(e.target.value)}
                      disabled={cienciaBoAceita}
                      placeholder="Nome completo"
                      className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-[13px] focus:border-[#7A1F2B] focus:outline-none disabled:bg-zinc-50 disabled:text-zinc-500"
                    />
                    <input
                      value={ameacadorCpf}
                      onChange={(e) => setAmeacadorCpf(e.target.value)}
                      disabled={cienciaBoAceita}
                      inputMode="numeric"
                      placeholder="CPF (se souber)"
                      className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-[13px] focus:border-[#7A1F2B] focus:outline-none disabled:bg-zinc-50 disabled:text-zinc-500"
                    />
                  </div>
                </div>

                <label
                  className={`flex cursor-pointer items-start gap-3 rounded-lg border p-4 ${
                    cienciaBoAceita
                      ? "border-emerald-300 bg-emerald-50"
                      : "border-[#7A1F2B]/40 bg-[#7A1F2B]/[0.03]"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={cienciaBoAceita}
                    disabled={cienciaBoAceita || salvandoCiencia}
                    onChange={() => void registrarCienciaBo()}
                    className="mt-0.5 h-4 w-4 shrink-0 accent-[#7A1F2B]"
                  />
                  <span className="text-[12px] leading-relaxed text-zinc-700">
                    {TERMO_BO_TEXTO}
                  </span>
                </label>

                {salvandoCiencia && (
                  <p className="flex items-center gap-2 text-[11px] text-zinc-500">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Registrando a sua ciência…
                  </p>
                )}
                {cienciaBoAceita && cienciaBoEm && (
                  <p className="flex items-center gap-2 text-[11px] text-emerald-700">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    Ciência registrada em {new Date(cienciaBoEm).toLocaleString("pt-BR")} com o
                    carimbo da sua conexão.
                  </p>
                )}
              </div>
            )}

            {/* ── As frentes de risco: a IA propõe, o cliente confirma ─────
              * Regra do usuário (17/08/2026): o que ele vive na família e o que
              * ele vive no trabalho são coisas separadas — e viram boletins
              * separados. Aqui ele lê cada frente, corrige o nome se quiser e
              * confirma. Nada vai para a delegacia sem esse aceite.        */}
            {passo?.tipo === "teses" && (
              <div className="space-y-3">
                <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-[#7A1F2B]">
                    Por que separamos
                  </p>
                  <p className="mt-1 text-[12px] leading-relaxed text-zinc-600">
                    Pelo que você contou, existe mais de uma situação em curso — e elas não têm
                    relação uma com a outra. Na delegacia, cada uma é um boletim: misturar tudo num
                    registro só enfraquece os dois lados e não cabe no campo do sistema da Polícia
                    Civil. Confira o nome de cada frente abaixo, corrija se quiser, e confirme.
                  </p>
                </div>

                {teses.length === 0 && (
                  <div className="rounded-lg border border-amber-300 bg-amber-50 p-4">
                    <p className="text-[12px] leading-relaxed text-amber-900">
                      Ainda não separamos as suas frentes de risco. Volte ao passo anterior e gere
                      o seu relato — as frentes saem dele.
                    </p>
                  </div>
                )}

                {teses.map((t, i) => {
                  const id = String(t.id ?? "");
                  const confirmada = !!String(t.confirmada_em ?? "").trim();
                  const titulo = tituloEditado[id] ?? String(t.titulo ?? "");
                  const texto = textoTeseEditado[id] ?? String(t.texto_bo ?? "");
                  const editando = teseEmEdicao === id;
                  return (
                    <div
                      key={id}
                      className={`rounded-lg border p-4 ${
                        confirmada ? "border-emerald-300 bg-emerald-50/40" : "border-zinc-200 bg-white"
                      }`}
                    >
                      <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-400">
                        Frente {i + 1} de {teses.length}
                        {t.prova_id ? " · boletim já anexado" : ""}
                      </p>
                      <input
                        value={titulo}
                        onChange={(e) =>
                          setTituloEditado((m) => ({ ...m, [id]: e.target.value.slice(0, 90) }))
                        }
                        placeholder="Dê um nome para esta situação"
                        className="mt-2 w-full rounded-lg border border-zinc-200 px-3 py-2 text-[13px] font-semibold text-zinc-900 focus:border-[#7A1F2B] focus:outline-none"
                      />
                      {t.resumo && (
                        <p className="mt-2 text-[12px] leading-relaxed text-zinc-600">{t.resumo}</p>
                      )}

                      <p className="mt-3 text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-400">
                        Texto que você vai levar à delegacia nesta frente
                      </p>
                      {editando ? (
                        <textarea
                          value={texto}
                          onChange={(e) =>
                            setTextoTeseEditado((m) => ({
                              ...m,
                              [id]: e.target.value.slice(0, LIMITE_BO),
                            }))
                          }
                          rows={7}
                          className="mt-1 w-full rounded-lg border border-[#7A1F2B]/40 px-3 py-2 text-[13px] leading-relaxed text-zinc-800 focus:border-[#7A1F2B] focus:outline-none"
                        />
                      ) : (
                        <p className="mt-1 rounded-lg border border-zinc-200 bg-white p-3 text-[13px] leading-relaxed text-zinc-800">
                          {texto || "—"}
                        </p>
                      )}

                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <span className="text-[11px] text-zinc-400">
                          {texto.length}/{LIMITE_BO} caracteres
                        </span>
                        <button
                          type="button"
                          onClick={() => setTeseEmEdicao(editando ? null : id)}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 px-3 py-1.5 text-[11px] font-semibold text-zinc-700 hover:bg-zinc-50"
                        >
                          <Pencil className="h-3.5 w-3.5" /> {editando ? "Concluir edição" : "Ajustar"}
                        </button>
                        <button
                          type="button"
                          disabled={salvandoTese === id}
                          onClick={() => void confirmarTese(t)}
                          className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-semibold disabled:opacity-40 ${
                            confirmada
                              ? "border border-emerald-300 bg-white text-emerald-800 hover:bg-emerald-50"
                              : "bg-[#7A1F2B] text-white hover:bg-[#63161f]"
                          }`}
                        >
                          {salvandoTese === id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Check className="h-3 w-3" />
                          )}
                          {confirmada ? "Salvar alteração" : "Confirmar esta frente"}
                        </button>
                        {confirmada && (
                          <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700">
                            <ShieldCheck className="h-3.5 w-3.5" /> Confirmada
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}

                {teses.length > 0 && !todasTesesConfirmadas && (
                  <p className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-[12px] leading-relaxed text-amber-900">
                    Confirme todas as frentes para seguir. Se alguma não faz sentido, corrija o nome
                    e o texto antes de confirmar — é você quem assina o boletim.
                  </p>
                )}
              </div>
            )}

            {passo?.tipo === "enviar_bo" && (
              <div className="rounded-lg border border-zinc-200 p-4">
                <p className="text-[14px] font-semibold text-zinc-900">
                  Envie o boletim de ocorrência registrado
                </p>
                <p className="mt-1 text-[12px] leading-relaxed text-zinc-500">
                  Assim que a delegacia liberar o documento, anexe aqui o PDF original. Nós lemos o
                  número, a data e a natureza do fato e juntamos tudo à sua defesa.
                  {teseAtual ? (
                    <> Agora estamos esperando o boletim da frente <strong>{teseAtual.titulo}</strong>.</>
                  ) : null}
                </p>
                <button
                  type="button"
                  onClick={() => abrirSeletor("boletim_ocorrencia")}
                  disabled={enviandoTipo !== null}
                  className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-[#7A1F2B]/30 bg-[#7A1F2B]/5 px-3 py-1.5 text-[11px] font-semibold text-[#7A1F2B] hover:bg-[#7A1F2B]/10 disabled:opacity-50"
                >
                  {enviandoTipo === "boletim_ocorrencia"
                    ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    : <Upload className="h-3.5 w-3.5" />}
                  Anexar boletim de ocorrência
                </button>
                {!boEntregue && (
                  <p className="mt-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-[12px] leading-relaxed text-amber-900">
                    Este passo fica aberto até o boletim chegar. Você pode fechar e voltar quando
                    tiver o documento em mãos — nada do que você já escreveu se perde.
                  </p>
                )}

                {/* ── O encaixe: o sistema propõe, o cliente lê e confirma ── */}
                {casamento && (
                  <div className="mt-4 rounded-lg border border-[#7A1F2B]/40 bg-[#7A1F2B]/[0.04] p-4">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-[#7A1F2B]">
                      Confirme a que situação este boletim se refere
                    </p>
                    <p className="mt-1.5 text-[13px] leading-relaxed text-zinc-800">
                      {descreverCasamento(casamento.prova, casamento.sugestao)}
                    </p>
                    <p className="mt-2 text-[12px] leading-relaxed text-zinc-600">
                      <strong>Leia antes de confirmar.</strong> É esse encaixe que mantém as suas
                      situações separadas na defesa — e o que evita você registrar duas vezes o
                      mesmo fato.
                    </p>
                    <div className="mt-3 space-y-2">
                      {tesesEmAberto.map((t) => {
                        const id = String(t.id ?? "");
                        const sugerida = String(casamento.sugestao.tese.id ?? "") === id;
                        return (
                          <button
                            key={id}
                            type="button"
                            disabled={confirmandoVinculo}
                            onClick={() => void confirmarVinculo(id)}
                            className={`flex w-full items-start gap-2 rounded-lg border px-3 py-2 text-left text-[12px] leading-relaxed transition-colors disabled:opacity-50 ${
                              sugerida
                                ? "border-[#7A1F2B] bg-white text-zinc-900 hover:bg-[#7A1F2B]/5"
                                : "border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50"
                            }`}
                          >
                            {confirmandoVinculo
                              ? <Loader2 className="mt-0.5 h-3.5 w-3.5 shrink-0 animate-spin" />
                              : <Check className="mt-0.5 h-3.5 w-3.5 shrink-0" />}
                            <span>
                              <strong>{t.titulo}</strong>
                              {sugerida ? " · sugerido pelo que lemos no documento" : ""}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* ── O laço: quer abrir outro boletim? ────────────────────── */}
                {!casamento && provasBo.length > 0 && boQuerOutro === null && (
                  <div className="mt-4 rounded-lg border border-[#7A1F2B]/40 bg-[#7A1F2B]/[0.04] p-4">
                    <p className="text-[13px] font-semibold leading-relaxed text-zinc-900">
                      Você quer abrir outro boletim de ocorrência?
                    </p>
                    <p className="mt-1 text-[12px] leading-relaxed text-zinc-600">
                      Se ainda há outra situação — no trabalho, com vizinho, com outra pessoa — ela
                      merece o boletim dela. Você pode abrir quantos precisar; cada um fortalece um
                      ponto diferente da sua defesa.
                      {tesesEmAberto.length > 0 && (
                        <> Ainda temos texto pronto para: <strong>{tesesEmAberto.map((t) => t.titulo).join(", ")}</strong>.</>
                      )}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={respondendoQuerOutro}
                        onClick={() => void responderQuerOutro(true)}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-[#7A1F2B] px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-[#63161f] disabled:opacity-50"
                      >
                        {respondendoQuerOutro ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
                        Sim, vou abrir outro
                      </button>
                      <button
                        type="button"
                        disabled={respondendoQuerOutro}
                        onClick={() => void responderQuerOutro(false)}
                        className="rounded-lg border border-zinc-300 px-3 py-1.5 text-[11px] font-semibold text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
                      >
                        Não, pode seguir
                      </button>
                    </div>
                  </div>
                )}

                {/* ── Travado esperando o próximo boletim ──────────────────── */}
                {esperandoOutroBo && (
                  <div className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-4">
                    <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-amber-900">
                      <ShieldAlert className="h-3.5 w-3.5" /> Aguardando o seu próximo boletim
                    </p>
                    <p className="mt-2 text-[12px] leading-relaxed text-amber-900">
                      Você disse que vai abrir outro boletim, então o seu processo espera por ele
                      aqui. {teseAtual ? (<>Volte ao passo anterior para copiar o texto da frente <strong>{teseAtual.titulo}</strong>, </>) : ""}
                      registre na delegacia e anexe o PDF acima. Pode fechar a tela: nada se perde.
                    </p>
                    <p className="mt-2 text-[12px] leading-relaxed text-amber-900">
                      <strong>Mudou de ideia e não vai abrir?</strong> Fale com a nossa equipe pelo
                      chat: abrimos um chamado e liberamos a sua continuação sem esse boletim.
                    </p>
                  </div>
                )}

                {boQuerOutro === false && boEntregue && (
                  <p className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-[12px] leading-relaxed text-emerald-900">
                    Ciclo dos boletins encerrado. Refizemos a sua defesa com o que foi lido dos
                    documentos — leia no próximo passo e aprove.
                  </p>
                )}
              </div>
            )}

            {passo?.tipo === "pergunta" && perguntaAtual && (
              <div className="rounded-lg border border-zinc-200 p-4">
                <p className="text-[12px] leading-relaxed text-zinc-500">{perguntaAtual.ajuda}</p>

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
                    className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-[#7A1F2B]/30 bg-[#7A1F2B]/5 px-3 py-1.5 text-[11px] font-semibold text-[#7A1F2B] hover:bg-[#7A1F2B]/10 disabled:opacity-50"
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
              <div className="mt-2 rounded-lg border border-zinc-200 focus-within:border-[#7A1F2B]">
                <textarea
                  value={relato}
                  onChange={(e) => setRelato(e.target.value)}
                  onBlur={() => void salvarTexto("relato_cliente", relato)}
                  rows={10}
                  placeholder="Descreva os fatos em ordem: datas, locais, pessoas envolvidas, o que foi dito ou feito."
                  className="w-full resize-y rounded-t-lg border-0 bg-transparent px-3 py-2 text-[13px] leading-relaxed focus:outline-none"
                />
                <p className="px-3 pb-1.5 text-left text-[10px] leading-tight text-zinc-400">
                  {salvandoCampo === "salvando" ? "Salvando…" : "Tudo é salvo enquanto você digita."}
                </p>
              </div>
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
              <p className="text-[11px] leading-relaxed text-zinc-500">
                Descreva o dia a dia que te expõe: trajetos, horários, local de trabalho,
                valores transportados e com quem você mora.
              </p>
              <div className="mt-2 rounded-lg border border-zinc-200 focus-within:border-[#7A1F2B]">
                <textarea
                  value={contexto}
                  onChange={(e) => setContexto(e.target.value)}
                  onBlur={() => void salvarTexto("contexto_risco", contexto)}
                  rows={7}
                  placeholder="Ex.: moro em zona rural isolada, transporto valores, trabalho à noite, resido sozinho com idosos."
                  className="w-full resize-y rounded-t-lg border-0 bg-transparent px-3 py-2 text-[13px] leading-relaxed focus:outline-none"
                />
                <p className="px-3 pb-1.5 text-left text-[10px] leading-tight text-zinc-400">
                  {salvandoCampo === "salvando" ? "Salvando…" : "Tudo é salvo enquanto você digita."}
                </p>
              </div>
            </div>
            )}

            {passo?.tipo === "revisao" && (
              <div className="space-y-4">
                <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-[#7A1F2B]">
                    Confira antes de gerar
                  </p>
                  <p className="mt-1.5 text-[12px] leading-snug text-zinc-700">
                    {[
                      ...PERGUNTAS.map((q) => ({
                        rotulo: TRILHA_ROTULO[q.campo],
                        valor:
                          respostas[q.campo] === true
                            ? "sim"
                            : respostas[q.campo] === false
                              ? "não"
                              : "sem resposta",
                      })),
                      { rotulo: "Provas anexadas", valor: String(provas.length) },
                      { rotulo: "Relato", valor: `${relato.trim().length} caracteres` },
                    ].map((item, i, arr) => (
                      <span key={item.rotulo}>
                        <strong>{item.rotulo}:</strong> {item.valor}
                        {i < arr.length - 1 ? ", " : "."}
                      </span>
                    ))}
                  </p>
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

        {/* ── Barra de ação ────────────────────────────────────────────────
         * Ela é grudada no rodapé e precisa encostar nas bordas da área em
         * que vive. Antes usava `-mx-6` fixo, chutando que o pai tinha 24px
         * de padding: dentro do pop-up era verdade, mas no modo página o pai
         * tem padding ZERO, então a barra saía 24px para fora dos dois lados,
         * empurrava a largura da tela e aparecia cortada — a faixa branca
         * solta que não alcançava as laterais.
         *
         * Agora quem tem o padding é quem informa o quanto recuar, pela
         * variável --qa-bleed. Sem variável, recuo zero: a barra ocupa
         * exatamente a largura do pai e nunca estoura o eixo horizontal. */}
        <div
          className={embedded
            ? "sticky bottom-0 z-30 mt-5 flex items-stretch gap-2 border-t border-zinc-200/80 bg-white/95 pt-3 backdrop-blur-sm supports-[backdrop-filter]:bg-white/85"
            : "shrink-0 flex items-stretch gap-2 border-t border-zinc-200 px-6 py-4"}
          style={embedded ? {
            marginInline: "calc(var(--qa-bleed, 0px) * -1)",
            paddingInline: "var(--qa-bleed, 0px)",
            // Respira acima da barra de gestos do iPhone.
            paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))",
            boxShadow: "0 -12px 18px -14px rgba(0,0,0,0.22)",
          } : undefined}
        >
          <button
            type="button"
            disabled={passoIndex === 0}
            onClick={() => irPara(passoIndex - 1)}
            className={`inline-flex shrink-0 items-center justify-center gap-1 whitespace-nowrap rounded-lg border border-zinc-300 bg-white font-bold uppercase tracking-[0.1em] text-zinc-600 transition-colors hover:bg-zinc-50 disabled:opacity-30 ${
              embedded ? "h-9 px-3 text-[9.5px]" : "px-3 py-2 text-[10px]"
            }`}
          >
            <ChevronLeft className="h-3 w-3" /> Anterior
          </button>
          {/* O botão principal ocupa o resto da linha: em tela estreita o
              rótulo cabia em uma linha só quando havia espaço, e antes
              quebrava em duas ("CONCORDO E / APROVO"). */}
          {passoFinal && narrativa ? (
            <button
              type="button"
              disabled={aprovando || narrativa.trim().length < 200}
              onClick={() => void aprovarNarrativa()}
              className={acaoPrincipalClasse}
            >
              {aprovando ? <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5 shrink-0" />}
              Concordo e aprovo
            </button>
          ) : passo?.tipo === "revisao" && !narrativa ? (
            <button
              type="button"
              disabled={!podeConcluir || salvando || gerando}
              onClick={() => void gerarNarrativa()}
              className={acaoPrincipalClasse}
            >
              {gerando || salvando ? <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
                : podeConcluir ? <Check className="h-3.5 w-3.5 shrink-0" />
                : <ArrowRight className="h-3.5 w-3.5 shrink-0" />}
              {gerando ? "Montando seu relato…" : "Gerar meu relato"}
            </button>
          ) : (
            <button
              type="button"
              disabled={!podeAvancar}
              onClick={avancar}
              className={acaoPrincipalClasse}
            >
              Próximo <ChevronRight className="h-3.5 w-3.5 shrink-0" />
            </button>
          )}
        </div>

        {/* Aviso de salvamento agora vive dentro das próprias caixas de texto. */}

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
  );

  if (embedded) return conteudo;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-3 sm:p-4 overflow-y-auto">
      {conteudo}
    </div>,
    document.body,
  );
}
