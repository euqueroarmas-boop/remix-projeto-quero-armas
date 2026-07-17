// ============================================================================
// ChecklistGuiadoModal — Assistente passo a passo (camada NOVA, aditiva)
// ----------------------------------------------------------------------------
// Experiência guiada estilo "abertura de conta em banco": um item por vez, o
// cliente anexa, a IA valida, e só então avança para o próximo. Reaproveita
// 100% do fluxo já aprovado (qa-processo-doc-upload → qa-processo-doc-validar-ia,
// qa-processo-set-condicao, perguntas). NÃO substitui a Central de Documentos
// nem o ProcessoDetalheDrawer — é uma camada de leitura/orquestração.
// ============================================================================

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import DocumentoViewerModal, { useDocumentoViewer } from "@/components/quero-armas/DocumentoViewerModal";
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  Building2,
  CalendarClock,
  Camera,
  CheckCircle2,
  ChevronRight,
  Download,
  ExternalLink,
  FileDown,
  FileText,
  Info,
  Loader2,
  PartyPopper,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Upload,
  X,
} from "lucide-react";
import { getValidadeInfo } from "@/lib/quero-armas/validadeDocumento";
import {
  CargaProcesso,
  ContratoPendente,
  CONDICAO_OPCOES_GUIA,
  GuiaDoc,
  ProcessoElegivel,
  aguardarValidacaoIAGuia,
  carregarProcessoGuia,
  calcularResumoProcessoAssistente,
  construirFilaGuia,
  definirCondicaoGuia,
  enviarDocumentoGuia,
  listarProcessosElegiveisGuia,
  pickTemplateGuia,
  progressoGuia,
  responderPerguntaGuia,
  tipoItemGuia,
} from "@/lib/quero-armas/checklistGuiadoEngine";
import { getDocumentStepGroup, slugifyParaArquivo } from "@/lib/quero-armas/documentStepGroup";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { saveOrShareBlob, isMobileUA } from "@/lib/quero-armas/saveOrShareBlob";
import {
  clearDocumentAssistantProgress,
  loadDocumentAssistantProgress,
  resolveResumeDocId,
  saveDocumentAssistantProgress,
} from "@/lib/quero-armas/documentAssistantProgress";
import DocumentDataOnboardingWizard from "@/components/quero-armas/portal/DocumentDataOnboardingWizard";
import ClienteCadastroProgressivoModal from "@/components/quero-armas/portal/ClienteCadastroProgressivoModal";
import SugestaoCadastroFromDocModal, {
  temSugestoesDeCadastro,
} from "@/components/quero-armas/portal/SugestaoCadastroFromDocModal";
import DivergenciasResolverPanel, {
  GRUPO_PARA_COLUNAS_CADASTRO,
  type GrupoDivergencia,
} from "@/components/quero-armas/portal/DivergenciasResolverPanel";
import DocsTresCaixasPanel from "@/components/quero-armas/portal/DocsTresCaixasPanel";
import { isDocDeArma } from "@/lib/quero-armas/documentosDeArma";
import ArmaManualForm from "@/components/quero-armas/arsenal/ArmaManualForm";
import ClubeFiliacaoStep from "@/components/quero-armas/portal/clube-wizard/ClubeFiliacaoStep";
import {
  WizardPreDocumentoConfig,
  getWizardDescricaoCliente,
  getWizardLabel,
  wizardPendentePara,
} from "@/lib/quero-armas/checklistWizardGate";
import {
  buscarCandidatosReaproveitamento,
  aplicarReaproveitamento,
  type BuscaReaproveitamentoResultado,
  type CandidatoReaproveitamento,
} from "@/lib/quero-armas/reaproveitamentoCandidatos";
import ClienteDocsHubModal from "@/components/quero-armas/clientes/ClienteDocsHubModal";
import { classificarCaixa } from "@/lib/quero-armas/documentosCaixaClassifier";

// Mapa processo_tipo → hub_tipo (espelho da tabela qa_tipo_documento_aliases).
// Usado para pré-selecionar o tipo correto no Hub ao abrir o modal.
const PROCESSO_TO_HUB_TIPO: Record<string, string> = {
  rg_com_cpf: "cin",
  comprovante_endereco_ano_2022: "comprovante_residencia",
  comprovante_endereco_ano_2023: "comprovante_residencia",
  comprovante_endereco_ano_2024: "comprovante_residencia",
  comprovante_endereco_ano_2025: "comprovante_residencia",
  comprovante_endereco_ano_2026: "comprovante_residencia",
  comprovante_endereco_ano_2027: "comprovante_residencia",
  certidao_antecedentes_policia_civil_sp: "antecedentes_criminais",
  certidao_crimes_eleitorais_tse: "antecedentes_eleitoral",
  certidao_crimes_militares_stm: "antecedentes_militar",
  certidao_criminal_tjmsp: "antecedentes_estadual",
  certidao_federal_trf3_regional: "antecedentes_federal",
  certidao_federal_trf3_sjsp_jef: "antecedentes_federal",
  certidao_tjsp_distribuicao_criminal: "antecedentes_estadual",
  certidao_tjsp_execucoes_criminais: "antecedentes_estadual",
  comprovante_filiacao_entidade_tiro: "comprovante_clube_tiro",
  declaracao_habitualidade_clube: "comprovante_habitualidade",
  declaracao_compromisso_habitualidade: "comprovante_habitualidade",
  declaracao_compromisso_treino: "declaracao_correlata",
  renda_nf_empresa: "renda_nf_recente",
  renda_qsa: "renda_cartao_cnpj",
};

function toHubTipo(processoTipo: string): string {
  return PROCESSO_TO_HUB_TIPO[processoTipo] ?? processoTipo;
}

const MARROM = "#7A1F2B";
const TIPO_CERTIDAO_ALTERACAO_NOME = "certidao_alteracao_nome";

function getLabelResumoProcessoAssistente(p: ProcessoElegivel): string {
  if (p.label_resumo && p.label_resumo.trim()) return p.label_resumo;
  const parts: string[] = [];
  if ((p.documentos_pendentes_cliente ?? 0) > 0) {
    const n = p.documentos_pendentes_cliente;
    parts.push(`${n} documento${n === 1 ? "" : "s"} pendente${n === 1 ? "" : "s"}`);
  }
  if ((p.wizards_pendentes ?? 0) > 0) {
    const n = p.wizards_pendentes;
    parts.push(`${n} pergunta${n === 1 ? "" : "s"} pendente${n === 1 ? "" : "s"}`);
  }
  if ((p.documentos_em_analise ?? p.em_analise ?? 0) > 0) {
    parts.push(`${p.documentos_em_analise ?? p.em_analise} em análise`);
  }
  if (parts.length === 0) parts.push("Tudo em dia");
  parts.push(`${p.percentual ?? p.pct ?? 0}% pronto`);
  return parts.join(" · ");
}

function ehCertidaoAlteracaoNome(doc: Pick<GuiaDoc, "tipo_documento"> | null | undefined): boolean {
  return String(doc?.tipo_documento || "").toLowerCase() === TIPO_CERTIDAO_ALTERACAO_NOME;
}

function arquivoPareceCertidaoAlteracaoNome(file: File): boolean {
  const nome = String(file?.name || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  return /(certidao|casamento|nascimento|averbac|averbad|alteracao.*nome|nome.*alteracao)/.test(nome);
}

type Fase =
  | "carregando"
  | "escolher_processo"
  | "item"
  | "validando"
  | "resultado_ok"
  | "resultado_revisao"
  | "resultado_erro"
  | "resultado_demorando"
  | "concluido"
  | "contrato_pendente"
  | "vazio";

interface Props {
  clienteId: number;
  open: boolean;
  onClose: () => void;
  /** opcional: já abre direto neste processo (pula a tela de seleção) */
  processoIdInicial?: string | null;
  /** opcional: já abre direto neste documento (pendência clicada) */
  focusDocIdInicial?: string | null;
  /** chamado quando algo muda, para o portal recarregar contadores */
  onUpdated?: () => void;
}

export default function ChecklistGuiadoModal({
  clienteId,
  open,
  onClose,
  processoIdInicial,
  focusDocIdInicial,
  onUpdated,
}: Props) {
  const viewer = useDocumentoViewer();
  const fileRef = useRef<HTMLInputElement>(null);

  const [fase, setFase] = useState<Fase>("carregando");
  const [processos, setProcessos] = useState<ProcessoElegivel[]>([]);
  const [processoId, setProcessoId] = useState<string | null>(null);
  const [carga, setCarga] = useState<CargaProcesso | null>(null);
  const [pularIds, setPularIds] = useState<Set<string>>(new Set());
  const [docAtivoId, setDocAtivoId] = useState<string | null>(null);
  const [resultadoDoc, setResultadoDoc] = useState<GuiaDoc | null>(null);
  const [erroAcao, setErroAcao] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  // Mostra aviso discreto quando o assistente pulou automaticamente um
  // documento salvo no progresso (porque ele já está aprovado, em análise, etc).
  const [avisoRetomada, setAvisoRetomada] = useState<string | null>(null);
  // Quando criamos/encontramos a pendência de certidão averbada mas não
  // conseguimos navegar automaticamente (ex.: fila ainda não inclui o item),
  // guardamos o id para oferecer um botão de fallback "Ir para pendência".
  const [avisoIrParaCertidao, setAvisoIrParaCertidao] = useState<string | null>(null);
  const [certidaoUploadForcadoId, setCertidaoUploadForcadoId] = useState<string | null>(null);

  // ----- Hub de Documentos (caminho único de upload para docs permanentes) -----
  const [hubModalTipo, setHubModalTipo] = useState<string | null>(null);
  const [customerId, setCustomerId] = useState<string | null>(null);

  useEffect(() => {
    supabase
      .from("qa_clientes")
      .select("customer_id")
      .eq("id", clienteId)
      .maybeSingle()
      .then(({ data }) => setCustomerId((data as any)?.customer_id ?? null));
  }, [clienteId]);

  // ----- Vínculo documento ↔ arma do acervo (Bloco 10) -----
  interface ArmaCli {
    arma_uid: string;
    marca: string | null;
    modelo: string | null;
    calibre: string | null;
    numero_serie: string | null;
    numero_craf: string | null;
    numero_sigma?: string | null;
    numero_sinarm?: string | null;
  }
  const [armaSelecionada, setArmaSelecionada] = useState<string | null>(null);
  const [armasCliente, setArmasCliente] = useState<ArmaCli[]>([]);
  const [cadastroArmaAberto, setCadastroArmaAberto] = useState(false);

  // ----- Bloco 12 — sugestões de reaproveitamento p/ o doc ativo -----
  const [candidatosReuso, setCandidatosReuso] = useState<CandidatoReaproveitamento[]>([]);
  const [contextoReuso, setContextoReuso] = useState<BuscaReaproveitamentoResultado | null>(null);
  const [reusoCarregando, setReusoCarregando] = useState(false);
  const [reusoAplicando, setReusoAplicando] = useState<string | null>(null);

  // ----- carregar processos elegíveis ao abrir -----
  const iniciar = useCallback(async () => {
    setFase("carregando");
    setErroAcao(null);
    try {
      const lista = await listarProcessosElegiveisGuia(clienteId);
      if (import.meta.env.DEV) {
        lista.forEach((p) => {
          console.debug("[assistente-card-resumo]", {
            processo: p.servico_nome,
            pendentesAntigo: p.pendentes,
            documentos_pendentes_cliente: p.documentos_pendentes_cliente,
            wizards_pendentes: p.wizards_pendentes,
            label_resumo: p.label_resumo,
          });
        });
      }
      setProcessos(lista);
      const alvo = processoIdInicial && lista.some((p) => p.id === processoIdInicial)
        ? processoIdInicial
        : lista.length === 1
          ? lista[0].id
          : lista.find((p) => p.pendentes > 0)?.id ?? null;
      if (lista.length === 0) {
        setFase("vazio");
      } else if (alvo && (lista.length === 1 || processoIdInicial)) {
        await abrirProcesso(alvo);
      } else {
        setFase("escolher_processo");
      }
    } catch (e: any) {
      setErroAcao(e?.message ?? "Erro ao carregar.");
      setFase("vazio");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clienteId, processoIdInicial]);

  useEffect(() => {
    if (open) {
      setPularIds(new Set());
      iniciar();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const recarregarCarga = useCallback(async (pid: string): Promise<CargaProcesso> => {
    const c = await carregarProcessoGuia(pid);
    // Auto-liberação idempotente da próxima etapa. A edge function valida tudo
    // server-side (perguntas respondidas, docs cumpridos, nada em análise) e
    // só altera o estado quando seguro. Se liberar, recarrega para refletir.
    try {
      const { data: sess } = await supabase.auth.getSession();
      if (!sess?.session) { setCarga(c); return c; }
      const { data } = await supabase.functions.invoke("qa-processo-etapa-auto-liberar", {
        body: { processo_id: pid, origem: "assistente_cliente" },
      });
      if ((data as any)?.liberada) {
        const c2 = await carregarProcessoGuia(pid);
        setCarga(c2);
        return c2;
      }
    } catch (e) {
      console.warn("[assistente] auto-liberar etapa falhou", e);
    }
    setCarga(c);
    return c;
  }, []);

  const abrirProcesso = useCallback(
    async (pid: string) => {
      setProcessoId(pid);
      setFase("carregando");
      setAvisoRetomada(null);
      const c = await recarregarCarga(pid);
      // Foco explícito (ex.: pendência clicada) tem prioridade sobre o
      // progresso salvo. Se o doc focado não existir mais na fila, o
      // resolveResumeDocId cai naturalmente no primeiro acionável.
      if (focusDocIdInicial) {
        avancarPara(c, pularIds, focusDocIdInicial, null);
      } else {
        // Retomada: tenta abrir no último documento onde o cliente parou.
        const saved = loadDocumentAssistantProgress({ clienteId, processoId: pid });
        avancarPara(c, pularIds, saved?.currentDocumentId ?? null, saved?.currentDocumentKey ?? null);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [recarregarCarga, pularIds, focusDocIdInicial],
  );

  // decide a próxima tela a partir da carga atual
  const avancarPara = (
    c: CargaProcesso,
    pular: Set<string>,
    preferDocId: string | null = null,
    preferDocKey: string | null = null,
  ) => {
    const fila = construirFilaGuia(c).filter((d) => !pular.has(d.id));
    if (fila.length === 0) {
      // tudo concluído neste processo — limpa marcador de retomada
      clearDocumentAssistantProgress({ clienteId, processoId: c.processo.id });
      // Se há contrato pendente de assinatura, mostra tela específica em vez de "concluído"
      setFase(c.contratoPendente ? "contrato_pendente" : "concluido");
      setDocAtivoId(null);
    } else {
      const resumeId = resolveResumeDocId(
        fila,
        preferDocId || preferDocKey
          ? {
              clienteId,
              clienteIdLegado: null,
              processoId: c.processo.id,
              vendaId: null,
              serviceSlug: null,
              currentDocumentId: preferDocId,
              currentDocumentKey: preferDocKey,
              currentIndex: null,
              updatedAt: "",
            }
          : null,
      );
      // Se o cliente tinha progresso salvo mas o documento salvo não é mais
      // acionável (já aprovado / em análise / dispensado), avisamos de forma
      // discreta que pulamos para o próximo item realmente acionável.
      if (preferDocId || preferDocKey) {
        const aindaNaFila =
          (preferDocId && fila.some((d) => d.id === preferDocId)) ||
          (preferDocKey &&
            fila.some(
              (d) => (d.tipo_documento ?? "").toLowerCase() === preferDocKey.toLowerCase(),
            ));
        if (!aindaNaFila) {
          setAvisoRetomada("Continuamos do próximo item que precisa da sua atenção.");
        } else {
          setAvisoRetomada(null);
        }
      } else {
        setAvisoRetomada(null);
      }
      setDocAtivoId(resumeId ?? fila[0].id);
      setResultadoDoc(null);
      setErroAcao(null);
      setAvisoIrParaCertidao(null);
      const primeiroDoc = fila.find((d) => d.id === (resumeId ?? fila[0].id)) ?? fila[0];
      const cfg = wizardPendentePara(primeiroDoc, clienteDados, c.processo);
      if (cfg && tipoItemGuia(primeiroDoc) === "documento") {
        setWizardPre({ open: true, doc: primeiroDoc, cfg, acaoPendente: { tipo: "continuar" } });
      }
      setFase("item");
    }
  };

  const filaAtual = useMemo(() => {
    if (!carga) return [] as GuiaDoc[];
    return construirFilaGuia(carga).filter((d) => !pularIds.has(d.id));
  }, [carga, pularIds]);

  const docAtivo = useMemo(
    () => (carga?.docs ?? []).find((d) => d.id === docAtivoId) ?? filaAtual[0] ?? null,
    [carga, docAtivoId, filaAtual],
  );

  // Persistência do ponto de retomada — sempre que o cliente avança/recua para
  // um documento concreto dentro de um processo, gravamos o marcador.
  useEffect(() => {
    if (!open) return;
    if (!processoId || !docAtivo || fase !== "item") return;
    const idx = filaAtual.findIndex((d) => d.id === docAtivo.id);
    saveDocumentAssistantProgress(
      { clienteId, processoId },
      {
        currentDocumentId: docAtivo.id,
        currentDocumentKey: docAtivo.tipo_documento ?? null,
        currentIndex: idx >= 0 ? idx : null,
      },
    );
  }, [open, clienteId, processoId, docAtivo, fase, filaAtual]);

  // Carrega as armas do cliente sempre que o item ativo for um doc "de arma".
  // Para os demais itens, zera a lista/seleção — comportamento legado preservado.
  const loadArmasCliente = useCallback(async () => {
    const { data } = await supabase
      .from("qa_cliente_armas" as any)
      .select("arma_uid, marca, modelo, calibre, numero_serie, numero_craf, numero_sigma, numero_sinarm")
      .eq("qa_cliente_id", clienteId);
    return ((data ?? []) as unknown) as ArmaCli[];
  }, [clienteId]);

  useEffect(() => {
    if (!isDocDeArma(docAtivo?.tipo_documento)) {
      setArmasCliente([]);
      setArmaSelecionada(null);
      return;
    }
    let cancel = false;
    (async () => {
      const lista = await loadArmasCliente();
      if (cancel) return;
      setArmasCliente(lista);
      // se só há uma arma cadastrada, pré-seleciona para acelerar o fluxo
      setArmaSelecionada((prev) => prev ?? (lista.length === 1 ? lista[0].arma_uid : null));
    })();
    return () => {
      cancel = true;
    };
  }, [docAtivo?.id, docAtivo?.tipo_documento, loadArmasCliente]);

  // Bloco 12 — busca candidatos a reaproveitamento toda vez que o doc ativo
  // (de tipo "documento") mudar. Falha silenciosa: a UI segue funcionando.
  useEffect(() => {
    if (!docAtivo || tipoItemGuia(docAtivo) !== "documento") {
      setCandidatosReuso([]);
      setContextoReuso(null);
      return;
    }
    // Não reaproveita por cima de docs em análise/aprovados/etc.
    const st = String(docAtivo.status ?? "").toLowerCase();
    const acionavel = !["aprovado", "validado", "dispensado_grupo",
      "dispensado_por_reaproveitamento", "em_revisao_humana", "revisao_humana",
      "em_analise", "enviado", "fila", "processando"].includes(st);
    if (!acionavel) {
      setCandidatosReuso([]);
      setContextoReuso(null);
      return;
    }
    // Para docs de arma, só busca depois que a arma estiver selecionada
    // (senão `arma_id` do destino é nulo e nada bate).
    if (isDocDeArma(docAtivo.tipo_documento) && !armaSelecionada) {
      setCandidatosReuso([]);
      setContextoReuso(null);
      return;
    }
    let cancel = false;
    setReusoCarregando(true);
    (async () => {
      try {
        const destino = {
          id: docAtivo.id,
          tipo_documento: docAtivo.tipo_documento,
          etapa: docAtivo.etapa,
          arma_id: isDocDeArma(docAtivo.tipo_documento) ? armaSelecionada ?? (docAtivo as any).arma_id ?? null : (docAtivo as any).arma_id ?? null,
          processo_id: carga?.processo.id,
        };
        const armaAtual =
          isDocDeArma(docAtivo.tipo_documento) && armaSelecionada
            ? armasCliente.find((item) => item.arma_uid === armaSelecionada) ?? null
            : null;
        const resultado = await buscarCandidatosReaproveitamento(destino, {
          clienteId,
          servicoId: carga?.processo.servico_id ?? null,
          armaSelecionada: armaAtual,
        });
        if (!cancel) {
          setCandidatosReuso(resultado.candidatos);
          setContextoReuso(resultado);
        }
      } catch (e) {
        console.warn("[ChecklistGuiado] reaproveitamento falhou (silencioso):", e);
        if (!cancel) {
          setCandidatosReuso([]);
          setContextoReuso(null);
        }
      } finally {
        if (!cancel) setReusoCarregando(false);
      }
    })();
    return () => { cancel = true; };
  }, [docAtivo?.id, docAtivo?.tipo_documento, docAtivo?.status, armaSelecionada, armasCliente, clienteId, carga?.processo.id]);

  const handleReaproveitar = async (candidato: CandidatoReaproveitamento) => {
    if (!docAtivo || !carga) return;
    if (gateWizardPre(docAtivo, { tipo: "reaproveitar", payload: candidato.id })) return;
    setReusoAplicando(candidato.id);
    setErroAcao(null);
    const r = await aplicarReaproveitamento({
      destinoDocumentoId: docAtivo.id,
      origemDocumentoId: candidato.id,
      origem: candidato.origem,
    });
    setReusoAplicando(null);
    if (!r.ok) {
      setErroAcao(r.error ?? "Não foi possível reaproveitar este documento.");
      return;
    }
    toast.success("Documento reutilizado do Hub de Documentos. Próximo item.");
    onUpdated?.();
    const c = await recarregarCarga(carga.processo.id);
    avancarPara(c, pularIds);
  };

  const prog = useMemo(() => (carga ? progressoGuia(carga) : { total: 0, cumpridos: 0, emRevisao: 0 }), [carga]);
  const resumoAtual = useMemo(() => (carga ? calcularResumoProcessoAssistente(carga, null) : null), [carga]);
  const pct = resumoAtual?.percentual ?? (prog.total > 0 ? Math.round((prog.cumpridos / prog.total) * 100) : 0);
  const pendentesAcao = resumoAtual
    ? resumoAtual.documentosPendentesCliente + resumoAtual.wizardsPendentes
    : filaAtual.length;
  const emAnalise = resumoAtual?.documentosEmAnalise ?? Math.max(0, prog.total - prog.cumpridos - pendentesAcao);
  const processoAtual = useMemo(
    () => processos.find((p) => p.id === processoId) ?? null,
    [processos, processoId],
  );

  // ----- ações -----
  const handleResponderPergunta = async (valor: string) => {
    if (!carga || !docAtivo) return;
    setSalvando(true);
    setErroAcao(null);
    const r = await responderPerguntaGuia(carga.processo, docAtivo, valor);
    setSalvando(false);
    if (!r.ok) {
      setErroAcao(r.error ?? "Erro ao responder.");
      return;
    }
    onUpdated?.();
    const c = await recarregarCarga(carga.processo.id);
    avancarPara(c, pularIds);
  };

  const handleDefinirCondicao = async (cond: (typeof CONDICAO_OPCOES_GUIA)[number]["id"]) => {
    if (!carga) return;
    setSalvando(true);
    setErroAcao(null);
    const r = await definirCondicaoGuia(carga.processo, cond);
    setSalvando(false);
    if (!r.ok) {
      setErroAcao(r.error ?? "Erro ao salvar condição.");
      return;
    }
    onUpdated?.();
    const c = await recarregarCarga(carga.processo.id);
    avancarPara(c, pularIds);
  };

  const handleEscolherArquivo = () => {
    const doc = docAtivo;
    if (isDocDeArma(doc?.tipo_documento) && !armaSelecionada) {
      setErroAcao("Selecione a arma antes de enviar o documento.");
      return;
    }
    if (gateWizardPre(doc, { tipo: "anexar" })) return;

    // Todos os docs permanentes sobem pelo Hub de Documentos.
    // Exceção: certidao_alteracao_nome tem reconciliação especial de nome
    // que só funciona via validar-ia (processo path) — nunca via Hub.
    if (
      doc &&
      doc.tipo_documento !== TIPO_CERTIDAO_ALTERACAO_NOME &&
      classificarCaixa(doc) === "permanente"
    ) {
      setHubModalTipo(toHubTipo(doc.tipo_documento));
      return;
    }

    const fmts: string[] = Array.isArray(doc?.formato_aceito)
      ? (doc!.formato_aceito as string[]).map((f) => String(f).toLowerCase())
      : [];
    const accept = fmts.length
      ? fmts.map((f) => (f === "pdf" ? "application/pdf" : `.${f}`)).join(",")
      : "image/*,application/pdf";
    if (fileRef.current) {
      fileRef.current.accept = accept;
      fileRef.current.value = "";
      fileRef.current.click();
    }
  };

  const onHubDocSaved = async () => {
    setHubModalTipo(null);
    if (!carga || !docAtivo) return;
    // Aguarda trigger propagar (BEFORE INSERT é síncrono, mas há latência de rede)
    await new Promise((r) => setTimeout(r, 800));
    const c = await recarregarCarga(carga.processo.id);
    onUpdated?.();
    // Hub já confirmou o envio — avança direto para o próximo item pendente
    // sem mostrar tela intermédia ("Documento recebido"), pois o Hub modal
    // já exibiu a confirmação ao cliente.
    avancarPara(c, pularIds);
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !carga || !docAtivo) return;
    setErroAcao(null);
    let cargaUpload = carga;
    let docUpload = docAtivo;
    const deveProtegerCertidao =
      certidaoUploadForcadoId ||
      (!ehCertidaoAlteracaoNome(docAtivo) &&
        (divergeApenasPorNome(docAtivo) || divergeMotivoMencionaNome(docAtivo)) &&
        arquivoPareceCertidaoAlteracaoNome(file));

    if (deveProtegerCertidao) {
      const alvoId = certidaoUploadForcadoId || (await iniciarOuLocalizarPendenciaAlteracaoNome(carga.processo.id)).documentoId;
      const c = await recarregarCarga(carga.processo.id);
      const alvo = (c.docs || []).find((d) => d.id === alvoId) || (c.docs || []).find(ehCertidaoAlteracaoNome);
      if (!alvo) {
        setErroAcao("Não localizamos o item da certidão averbada. Tente novamente.");
        return;
      }
      cargaUpload = c;
      docUpload = alvo;
      setDocAtivoId(alvo.id);
      setCertidaoUploadForcadoId(alvo.id);
      setAvisoIrParaCertidao(null);
      toast.message("Vamos anexar este arquivo no item correto: certidão averbada de alteração de nome.");
    }

    const armaParaEnvio = isDocDeArma(docUpload?.tipo_documento) ? armaSelecionada : undefined;
    const enviar = await enviarDocumentoGuia(
      cargaUpload.processo,
      docUpload,
      file,
      armaParaEnvio,
    );
    if (!enviar.ok) {
      setErroAcao(enviar.error ?? "Erro no envio.");
      return;
    }
    const documentoIdValidacao = enviar.documentoId || docUpload.id;
    if (enviar.redirecionado && documentoIdValidacao !== docUpload.id) {
      const c = await recarregarCarga(cargaUpload.processo.id);
      const alvo = (c.docs || []).find((d) => d.id === documentoIdValidacao) || (c.docs || []).find(ehCertidaoAlteracaoNome);
      if (alvo) {
        docUpload = alvo;
        cargaUpload = c;
        setDocAtivoId(alvo.id);
        setCertidaoUploadForcadoId(alvo.id);
      }
      toast.message("Este arquivo foi associado ao item correto de certidão averbada.");
    }
    onUpdated?.();
    setFase("validando");
    const final = await aguardarValidacaoIAGuia(documentoIdValidacao);
    setResultadoDoc(final);
    await recarregarCarga(cargaUpload.processo.id);
    onUpdated?.();
    const st = final?.status;
    if (ehCertidaoAlteracaoNome(docUpload) && (st === "aprovado" || st === "validado" || st === "em_revisao_humana")) {
      setCertidaoUploadForcadoId(null);
    }
    // Upload concluído: limpa a arma selecionada para o próximo item.
    setArmaSelecionada(null);
    if (st === "aprovado" || st === "dispensado_grupo") setFase("resultado_ok");
    else if (st === "em_revisao_humana" || st === "revisao_humana") setFase("resultado_revisao");
    else if (st === "invalido" || st === "divergente") setFase("resultado_erro");
    else setFase("resultado_demorando"); // ainda em análise (timeout)

    // ---- Fase 5: sugerir atualização do cadastro com dados extraídos ----
    const dadosExtraidos = (final as any)?.dados_extraidos_json ?? null;
    const stOk = st === "aprovado" || st === "em_revisao_humana" || st === "divergente";
    if (stOk && dadosExtraidos && typeof dadosExtraidos === "object") {
      const cli = await recarregarClienteDados();
      if (cli && temSugestoesDeCadastro(cli, dadosExtraidos)) {
        setSugestao({
          open: true,
          dados: dadosExtraidos as Record<string, any>,
          nomeDoc: docUpload?.nome_documento ?? null,
          filtroCampos: null,
          titulo: null,
        });
      }
    }
  };

  const continuarAposResultado = async (opts?: { pularAtual?: boolean }) => {
    if (!carga) return;
    let pular = pularIds;
    if (opts?.pularAtual && docAtivo) {
      pular = new Set(pularIds);
      pular.add(docAtivo.id);
      setPularIds(pular);
    }
    const c = await recarregarCarga(carga.processo.id);
    avancarPara(c, pular);
  };

  const reenviarAtual = () => {
    setResultadoDoc(null);
    setErroAcao(null);
    setFase("item");
  };

  // ----- Alteração de nome em cartório (regra especial) -----
  const NOME_CAMPOS = ["nome", "nome_titular", "titular", "nome_completo"];
  const [clienteDados, setClienteDados] = useState<any | null>(null);
  const divergeApenasPorNome = (d: GuiaDoc | null): boolean => {
    if (!d) return false;
    const divs = Array.isArray((d as any).divergencias_json)
      ? ((d as any).divergencias_json as any[])
      : [];
    if (divs.length === 0) return false;
    return divs.some((x) => NOME_CAMPOS.includes(String(x?.campo || "").toLowerCase()));
  };
  const divergeMotivoMencionaNome = (d: GuiaDoc | null): boolean => {
    if (!d) return false;
    const motivo = String((d as any).motivo_rejeicao || "").toLowerCase();
    if (!motivo) return false;
    return /\bnome\b|\btitular\b/i.test(motivo);
  };
  // Fonte de verdade da comprovação de alteração de nome:
  //  (a) `respostas_questionario_json.alteracao_nome.aprovada === true`, OU
  //  (b) existe documento `certidao_alteracao_nome` neste processo já em
  //      estado aprovado/validado (aceito como comprovação efetiva).
  const altNomeBlock =
    ((carga?.processo?.respostas_questionario_json as any)?.alteracao_nome ?? null) as
      | { aprovada?: boolean; nome_anterior?: string | null; nome_atual?: string | null }
      | null;
  const certidaoAprovadaDoc = (carga?.docs || []).find((d: any) => {
    if (String(d?.tipo_documento || "").toLowerCase() !== "certidao_alteracao_nome") return false;
    const st = String(d?.status || "").toLowerCase();
    return ["aprovado", "validado"].includes(st);
  });
  const altNomeJaComprovada = !!altNomeBlock?.aprovada || !!certidaoAprovadaDoc;
  // Certidão averbada já recebida mas ainda em conferência (não aprovada).
  // Enquanto está nesse estado, não cobramos o cliente para enviar novamente
  // a certidão e escondemos o botão "Meu nome foi alterado em cartório".
  const altNomeEmComprovacao = (carga?.docs || []).some((d: any) => {
    const tipo = String(d?.tipo_documento || "").toLowerCase();
    const status = String(d?.status || "").toLowerCase();
    return (
      tipo === "certidao_alteracao_nome" &&
      [
        "em_analise",
        "fila",
        "processando",
        "revisao_humana",
        "em_revisao_humana",
        "pendente_aprovacao",
        "aguardando_equipe",
      ].includes(status)
    );
  });
  // Nomes aceitos: cadastro + nomes da averbação aprovada. Usado para
  // dispensar divergências de nome cujo valor do documento bate (normalizado)
  // com qualquer desses nomes.
  const nomesAceitosAlteracao = useMemo(() => {
    if (!altNomeJaComprovada) return [] as string[];
    const out: string[] = [];
    if (clienteDados?.nome_completo) out.push(String(clienteDados.nome_completo));
    if (altNomeBlock?.nome_anterior) out.push(String(altNomeBlock.nome_anterior));
    if (altNomeBlock?.nome_atual) out.push(String(altNomeBlock.nome_atual));
    const cx = (certidaoAprovadaDoc as any)?.campos_complementares_json ?? null;
    if (cx && typeof cx === "object") {
      if (cx.nome_anterior) out.push(String(cx.nome_anterior));
      if (cx.nome_atual) out.push(String(cx.nome_atual));
    }
    return Array.from(new Set(out.filter(Boolean)));
  }, [altNomeJaComprovada, clienteDados?.nome_completo, altNomeBlock?.nome_anterior, altNomeBlock?.nome_atual, certidaoAprovadaDoc]);
  const [iniciandoAltNome, setIniciandoAltNome] = useState(false);

  // Diagnóstico temporário (DEV) — confirma se o doc ativo carrega a
  // configuração de wizard_pre_documento (hidratada do catálogo) e se o gate
  // está enxergando essa pendência.
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    if (!docAtivo) return;
    try {
      const rv = (docAtivo as any).regra_validacao ?? null;
      const wp = rv && typeof rv === "object" ? (rv as any).wizard_pre_documento : null;
      const pendente = wizardPendentePara(docAtivo as any, clienteDados, carga?.processo as any);
      console.debug("[wizard-pre-doc]", {
        doc: (docAtivo as any).nome_documento,
        tipo: (docAtivo as any).tipo_documento,
        regra_validacao: rv,
        wizard: wp,
        wizardPendente: pendente,
      });
    } catch (e) {
      console.debug("[wizard-pre-doc] erro de diagnóstico", e);
    }
  }, [docAtivo, carga?.processo, clienteDados]);

  const iniciarOuLocalizarPendenciaAlteracaoNome = async (pid: string) => {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess?.session?.access_token;
      const base = import.meta.env.VITE_SUPABASE_URL as string;
      if (!token) throw new Error("Sessão expirada. Entre novamente.");
      const resp = await fetch(
        `${base}/functions/v1/qa-processo-alteracao-nome-iniciar`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ processo_id: pid }),
        },
      );
      const out = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(out?.error || "Falha ao iniciar pendência.");
      const statusRet = String(out?.status ?? "").toLowerCase();
      const certidaoJaAprovada =
        statusRet === "aprovado" || statusRet === "validado";
      return {
        documentoId: (out?.document_id as string | null | undefined) ?? null,
        status: statusRet,
        certidaoJaAprovada,
        reaproveitado: !!out?.reaproveitado,
        jaExistia: !!out?.ja_existia,
      };
  };

  const navegarParaCertidaoAlteracaoNome = (c: CargaProcesso, documentoId: string | null) => {
    const alvo =
      (documentoId ? (c.docs || []).find((d) => d.id === documentoId) : null) ||
      (c.docs || []).find(ehCertidaoAlteracaoNome);
    if (!alvo) {
      setAvisoIrParaCertidao(documentoId);
      return false;
    }
    setDocAtivoId(alvo.id);
    setResultadoDoc(null);
    setErroAcao(null);
    setAvisoIrParaCertidao(null);
    setCertidaoUploadForcadoId(alvo.id);
    setFase("item");
    return true;
  };

  const handleSimAlteracaoNome = async () => {
    if (!carga) return;
    setIniciandoAltNome(true);
    setErroAcao(null);
    try {
      const out = await iniciarOuLocalizarPendenciaAlteracaoNome(carga.processo.id);
      if (out?.reaproveitado) {
        toast.success(
          "Alteração de nome já comprovada por certidão averbada. Reaproveitamos neste processo.",
        );
      } else if (out.certidaoJaAprovada) {
        toast.success("Alteração de nome já comprovada por certidão averbada.");
      } else if (out.jaExistia) {
        toast.success("Abrimos o item correto para anexar a certidão averbada.");
      } else {
        toast.success(
          "Pendência criada. Anexe a certidão averbada no item correto que abrimos agora.",
        );
      }
      onUpdated?.();
      const c = await recarregarCarga(carga.processo.id);
      // Se a certidão já está aprovada/reaproveitada, NÃO navegamos: o painel
      // de divergência no doc atual passa a mostrar o banner verde "nome já
      // justificado" e o cliente segue resolvendo as outras divergências.
      // Apenas limpamos o resultado anterior para refletir a carga recarregada.
      if (out.certidaoJaAprovada) {
        setResultadoDoc(null);
        setCertidaoUploadForcadoId(null);
        return;
      }
      // Caso normal: pendência criada/existente. Navegar FORÇADAMENTE para o
      // item da certidão para que o upload/IA use `certidao_alteracao_nome`,
      // nunca o comprovante de endereço que originou a divergência.
      navegarParaCertidaoAlteracaoNome(c, out.documentoId);
    } catch (e: any) {
      setErroAcao(e?.message ?? "Erro ao iniciar comprovação.");
    } finally {
      setIniciandoAltNome(false);
    }
  };

  // ----- Abrir SugestaoCadastroFromDocModal escopado a um grupo de campos -----
  const abrirSugestaoCadastroPorGrupo = (
    grupo: GrupoDivergencia,
    opts?: { iniciarComCadastroAtual?: boolean },
  ) => {
    const docBase = (resultadoDoc as any) ?? (docAtivo as any) ?? null;
    const extraidos = docBase?.dados_extraidos_json;
    // No modo "editar manualmente" para endereço, dispensamos `extraidos`
    // (o cliente vai preencher do zero, partindo do cadastro atual).
    const editandoManualmenteEndereco =
      !!opts?.iniciarComCadastroAtual && grupo === "endereco";
    if (!editandoManualmenteEndereco && (!extraidos || typeof extraidos !== "object")) {
      toast.error("Não há dados extraídos do documento para atualizar o cadastro.");
      return;
    }
    const colunas = GRUPO_PARA_COLUNAS_CADASTRO[grupo] || [];
    if (colunas.length === 0) {
      toast.message("Este tipo de divergência não pode ser corrigido automaticamente.");
      return;
    }
    const titulos: Record<GrupoDivergencia, string> = {
      nome: "Revise antes de atualizar seu nome",
      endereco: "Revise antes de atualizar seu endereço",
      estado_civil: "Revise antes de atualizar seu estado civil",
      rg: "Revise antes de atualizar seu RG",
      contato: "Revise antes de atualizar seu contato",
      cpf: "Revise antes de atualizar",
      data_nascimento: "Revise antes de atualizar",
      outros: "Revise antes de atualizar seu cadastro",
    };
    setSugestao({
      open: true,
      dados: (extraidos ?? {}) as Record<string, any>,
      nomeDoc: docBase?.nome_documento ?? docAtivo?.nome_documento ?? null,
      filtroCampos: colunas,
      titulo: titulos[grupo],
      iniciarComCadastroAtual: !!opts?.iniciarComCadastroAtual,
    });
  };

  // ----- Atalho 1-clique: "Usar nome do documento" -----
  // Grava `nome_completo` no cadastro com o valor extraído do documento e
  // re-enfileira a IA para reavaliar o doc atual, avançando o assistente.
  const usarNomeDoDocumento = async (novoNome: string) => {
    const nome = String(novoNome || "").trim();
    if (!nome) return;
    if (!carga || !resultadoDoc?.id) {
      toast.error("Não consegui localizar o documento atual.");
      return;
    }
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess?.session?.access_token;
      if (!token) throw new Error("Sessão expirada. Entre novamente.");
      const base = import.meta.env.VITE_SUPABASE_URL as string;
      const resp = await fetch(`${base}/functions/v1/qa-cliente-atualizar-cadastro`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ fields: { nome_completo: nome }, cliente_id: carga.processo.cliente_id }),
      });
      if (!resp.ok) throw new Error((await resp.text()) || "Falha ao salvar");
      await recarregarClienteDados();
      onUpdated?.();
      toast.success("Nome atualizado no seu cadastro. Vamos conferir o documento novamente.");
      await reprocessarDocumentoCliente(resultadoDoc.id, "nome_do_documento");
    } catch (e: any) {
      toast.error(e?.message || "Erro ao atualizar nome do cadastro.");
    }
  };

  const reprocessarDocumentoCliente = useCallback(
    async (documentoId: string, motivo = "decisao_cadastral") => {
      if (!carga?.processo?.id) throw new Error("Processo não localizado.");
      const { data: sess } = await supabase.auth.getSession();
      const token = sess?.session?.access_token;
      if (!token) throw new Error("Sessão expirada. Entre novamente.");
      const base = import.meta.env.VITE_SUPABASE_URL as string;
      const resp = await fetch(`${base}/functions/v1/qa-processo-doc-reprocessar-cliente`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          processo_id: carga.processo.id,
          documento_id: documentoId,
          motivo,
        }),
      });
      const out = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(out?.error || "Falha ao enviar documento para validação.");

      setFase("validando");
      const final = await aguardarValidacaoIAGuia(documentoId);
      setResultadoDoc(final);
      await recarregarCarga(carga.processo.id);
      onUpdated?.();
      const st = final?.status;
      if (st === "aprovado" || st === "dispensado_grupo") setFase("resultado_ok");
      else if (st === "em_revisao_humana" || st === "revisao_humana") setFase("resultado_revisao");
      else if (st === "invalido" || st === "divergente") setFase("resultado_erro");
      else setFase("resultado_demorando");
    },
    [carga?.processo?.id, recarregarCarga, onUpdated],
  );

  // ----- "Meu cadastro está correto — aceitar este comprovante" -----
  // Dispensa a divergência de um grupo (ex.: endereço) para o documento ativo,
  // chamando a edge qa-processo-doc-aceitar-divergencia. Se não sobrar
  // divergência, a edge já move o documento para revisao_humana.
  const handleAceitarDivergencia = useCallback(
    async (grupo: GrupoDivergencia) => {
      const docId = resultadoDoc?.id ?? docAtivo?.id ?? null;
      if (!carga || !docId) {
        toast.error("Não consegui localizar o documento atual.");
        return;
      }
      try {
        const { data: sess } = await supabase.auth.getSession();
        const token = sess?.session?.access_token;
        if (!token) throw new Error("Sessão expirada. Entre novamente.");
        const base = import.meta.env.VITE_SUPABASE_URL as string;
        const resp = await fetch(
          `${base}/functions/v1/qa-processo-doc-aceitar-divergencia`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              documento_id: docId,
              processo_id: carga.processo.id,
              grupo,
              fonte_aceita: "cadastro",
            }),
          },
        );
        const out = await resp.json().catch(() => ({}));
        if (!resp.ok) {
          throw new Error(out?.error || "Falha ao aceitar divergência.");
        }
        toast.success(
          grupo === "endereco"
            ? "Endereço confirmado. Vamos enviar este comprovante para conferência."
            : "Divergência dispensada. Vamos enviar para conferência.",
        );
        const c = await recarregarCarga(carga.processo.id);
        onUpdated?.();
        avancarPara(c, pularIds);
      } catch (e: any) {
        toast.error(e?.message || "Erro ao aceitar divergência.");
      }
    },
    [carga, resultadoDoc, docAtivo, pularIds, recarregarCarga, onUpdated],
  );

  // ----- "Este comprovante é antigo" -----
  const handleComprovanteAntigo = async () => {
    if (!carga || !docAtivo) return;
    try {
      await supabase.from("qa_processo_eventos").insert({
        processo_id: carga.processo.id,
        documento_id: docAtivo.id,
        tipo_evento: "comprovante_endereco_antigo_confirmado",
        descricao:
          "Cliente confirmou que o comprovante anexado é de endereço antigo.",
        ator: "cliente",
      });
    } catch (e) {
      // não é crítico — segue o fluxo
      console.warn("[ChecklistGuiado] falha ao registrar evento antigo:", e);
    }
    toast.message(
      "Marcamos como endereço antigo. Anexe um comprovante recente para seguir.",
    );
    // Mantém o documento como divergente e volta para o upload do comprovante atual.
    reenviarAtual();
  };

  // ----- helpers de render -----
  const orientacoesIA = (doc: GuiaDoc | null): string | null => {
    const compl = doc?.campos_complementares_json && typeof doc.campos_complementares_json === "object"
      ? (doc.campos_complementares_json as any)
      : null;
    const orient = compl?.orientacoes_cliente;
    return orient && typeof orient === "string" && orient.trim().length > 0 ? orient : null;
  };

  const grupoAtivo = docAtivo ? getDocumentStepGroup(docAtivo) : null;

  const [baixandoTemplate, setBaixandoTemplate] = useState(false);

  // ----- Assistente de Cadastro Documental (Wizard KYC) -----
  const [wizard, setWizard] = useState<
    | { open: boolean; doc: GuiaDoc | null; templateKey: string | null }
  >({ open: false, doc: null, templateKey: null });
  const [editarCadastroAberto, setEditarCadastroAberto] = useState(false);

  // ----- Documento gerado (declaração/template) — fluxo robusto mobile -----
  const [documentoGerado, setDocumentoGerado] = useState<{
    open: boolean;
    blob: Blob | null;
    fileName: string;
    doc: GuiaDoc | null;
  }>({ open: false, blob: null, fileName: "", doc: null });
  const [documentoGeradoAcao, setDocumentoGeradoAcao] = useState<null | "baixar" | "compartilhar">(null);

  // ----- Wizard de Perguntas vinculado a uma exigência (regra_validacao.wizard_pre_documento) -----
  type WizardPreAction = "continuar" | "anexar" | "baixar_template" | "reaproveitar";
  const [wizardPre, setWizardPre] = useState<{
    open: boolean;
    doc: GuiaDoc | null;
    cfg: WizardPreDocumentoConfig | null;
    acaoPendente: { tipo: WizardPreAction; payload?: any } | null;
  }>({ open: false, doc: null, cfg: null, acaoPendente: null });

  // ----- Sugestão de atualização de cadastro (Fase 5) -----
  const [sugestao, setSugestao] = useState<
    | {
        open: boolean;
        dados: Record<string, any> | null;
        nomeDoc: string | null;
        filtroCampos: string[] | null;
        titulo: string | null;
        iniciarComCadastroAtual?: boolean;
      }
  >({ open: false, dados: null, nomeDoc: null, filtroCampos: null, titulo: null, iniciarComCadastroAtual: false });

  const recarregarClienteDados = useCallback(async () => {
    if (!carga) return null;
    try {
      const { data, error } = await supabase
        .from("qa_clientes")
        .select("*")
        .eq("id", carga.processo.cliente_id)
        .maybeSingle();
      if (error) throw error;
      setClienteDados(data ?? null);
      return data ?? null;
    } catch {
      return null;
    }
  }, [carga]);

  const abrirConfirmacaoTemplate = async (doc: GuiaDoc, templateKey: string) => {
    if (!carga) return;
    setErroAcao(null);
    if (gateWizardPre(doc, { tipo: "baixar_template", payload: templateKey })) return;
    setBaixandoTemplate(true);
    setWizard({ open: true, doc, templateKey });
  };

  const fecharWizard = () => {
    setWizard({ open: false, doc: null, templateKey: null });
    setBaixandoTemplate(false);
  };

  /**
   * Verifica se a exigência exige um Wizard de Perguntas antes de qualquer
   * ação. Se exigir e ainda não estiver completo, abre o modal e devolve
   * `true` (= ação bloqueada). A ação é guardada para ser retomada após o
   * cliente concluir o wizard.
   */
  const gateWizardPre = (
    doc: GuiaDoc | null | undefined,
    acao: { tipo: "anexar" | "baixar_template" | "reaproveitar"; payload?: any },
  ): boolean => {
    if (!doc) return false;
    const cfg = wizardPendentePara(doc, clienteDados, carga?.processo);
    if (!cfg) return false;
    setWizardPre({ open: true, doc, cfg, acaoPendente: acao });
    return true;
  };

  const fecharWizardPre = () => {
    setWizardPre({ open: false, doc: null, cfg: null, acaoPendente: null });
  };

  const retomarAcaoPosWizardPre = async () => {
    const { doc, acaoPendente } = wizardPre;
    fecharWizardPre();
    await recarregarClienteDados();
    if (!doc || !acaoPendente) return;
    if (carga?.processo.id) {
      const c = await recarregarCarga(carga.processo.id);
      if (acaoPendente.tipo === "continuar") {
        avancarPara(c, pularIds, doc.id, null);
        return;
      }
    }
    // Reabre a ação que estava bloqueada.
    if (acaoPendente.tipo === "baixar_template" && typeof acaoPendente.payload === "string") {
      setBaixandoTemplate(true);
      setWizard({ open: true, doc, templateKey: acaoPendente.payload });
      return;
    }
    if (acaoPendente.tipo === "anexar") {
      // Reentrega no fluxo de upload — passa pelos checks normais.
      handleEscolherArquivo();
      return;
    }
    if (acaoPendente.tipo === "reaproveitar" && typeof acaoPendente.payload === "string") {
      void handleReaproveitar(acaoPendente.payload as any);
      return;
    }
  };

  const handleWizardGenerated = (blob: Blob, _filename: string) => {
    const doc = wizard.doc;
    const templateKey = wizard.templateKey;
    if (!doc || !templateKey || !carga) return;
    const baseNome = slugifyParaArquivo(doc.nome_documento || templateKey);
    const sufixoCliente = slugifyParaArquivo(carga.clienteNome || "cliente");
    const fileName = `${baseNome || "declaracao"}-${sufixoCliente || "cliente"}.docx`;
    // Abre o modal com opções explícitas de Baixar / Compartilhar / Já assinei.
    // NÃO dispara download automático — em iOS/in-app o a.click() é silencioso.
    setDocumentoGerado({ open: true, blob, fileName, doc });
  };

  const executarSalvarDocumento = async (
    modo: "baixar" | "compartilhar",
  ) => {
    if (!documentoGerado.blob) return;
    setDocumentoGeradoAcao(modo);
    try {
      const r = await saveOrShareBlob(documentoGerado.blob, documentoGerado.fileName, {
        preferShare: modo === "compartilhar",
      });
      if (r.method === "share") toast.success("Escolha onde salvar no compartilhamento do sistema.");
      else if (r.method === "open") toast.success("Documento aberto em nova aba. Toque em Compartilhar/Salvar em Arquivos.");
      else if (r.method === "download") toast.success("Download iniciado.");
      else if (r.method === "cancelled") { /* usuário fechou */ }
      else toast.error("Não foi possível abrir o arquivo. Tente 'Compartilhar / salvar no celular'.");
    } catch (err: any) {
      toast.error(err?.message || "Falha ao acessar o arquivo. Tente outro modo.");
    } finally {
      setDocumentoGeradoAcao(null);
    }
  };

  const jaAssineiAnexarPdfAssinado = () => {
    const doc = documentoGerado.doc;
    setDocumentoGerado({ open: false, blob: null, fileName: "", doc: null });
    // Reabre o seletor de arquivo com foco em PDF.
    if (fileRef.current) {
      fileRef.current.accept = "application/pdf,.pdf";
      fileRef.current.value = "";
      fileRef.current.click();
    }
    void doc;
  };

  return (
    <>
      <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
        <DialogContent
          className="qa-scope w-[calc(100vw-1rem)] max-w-2xl sm:max-w-3xl md:max-w-4xl lg:max-w-5xl xl:max-w-6xl rounded-[24px] border border-slate-200 bg-white p-0 text-slate-900 shadow-2xl max-h-[96dvh] overflow-hidden gap-0 flex flex-col [&>button.absolute]:hidden"
        >
          {/* Cabeçalho */}
          <div className="shrink-0 border-b border-slate-200 px-5 py-4" style={{ background: "linear-gradient(180deg,#FBF3F4,#ffffff)" }}>
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-white shadow-sm" style={{ background: MARROM }}>
                <ShieldCheck className="h-5 w-5" strokeWidth={2.3} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-500">Assistente de documentação</div>
                <h2 className="text-[19px] font-extrabold leading-tight text-slate-900">Vamos montar sua pasta, passo a passo</h2>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Fechar"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Barra de progresso (somente quando há um processo carregado) */}
            {carga && fase !== "escolher_processo" && fase !== "vazio" && (
              <div className="mt-3">
                {(processoAtual?.servico_nome || carga.processo.servico_nome) && (
                  <div className="mb-1 truncate text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">
                    Processo: <span className="text-slate-800">{processoAtual?.servico_nome || carga.processo.servico_nome}</span>
                  </div>
                )}
                <div className="flex flex-col gap-0.5 sm:flex-row sm:items-center sm:justify-between">
                  <TooltipProvider delayDuration={200}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="truncate pr-2 text-[11px] font-bold text-slate-800 cursor-help underline decoration-dotted underline-offset-2">
                          {processoAtual?.servico_nome || carga.processo.servico_nome
                            ? `${processoAtual?.servico_nome || carga.processo.servico_nome} está ${pct}% pronta`
                            : `Sua pasta está ${pct}% pronta`}
                        </span>
                      </TooltipTrigger>
                      <TooltipContent side="bottom" className="max-w-[260px] text-xs">
                        <p>Este progresso considera apenas os documentos deste processo.</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  <span className="shrink-0 text-[11px] text-slate-500">
                    {prog.cumpridos} de {prog.total} itens resolvidos · {pendentesAcao} pendência{pendentesAcao === 1 ? "" : "s"} restante{pendentesAcao === 1 ? "" : "s"}
                    {emAnalise > 0 ? ` · ${emAnalise} em análise` : ""}
                  </span>
                </div>
                <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: MARROM }} />
                </div>
                {/* Bloco 11 — Resumo das 3 caixas (aditivo, não altera o fluxo guiado) */}
                <div className="mt-3">
                  <DocsTresCaixasPanel docs={carga.docs} respostas={carga.respostas} />
                </div>
              </div>
            )}
          </div>

          {/* Corpo */}
          <div className="min-h-[280px] flex-1 overflow-y-auto px-5 py-5">
            {fase === "carregando" && (
              <div className="flex flex-col items-center justify-center gap-3 py-16 text-slate-500">
                <Loader2 className="h-7 w-7 animate-spin" style={{ color: MARROM }} />
                <p className="text-sm">Carregando sua documentação...</p>
              </div>
            )}

            {fase === "vazio" && (
              <div className="flex flex-col items-center justify-center gap-3 py-14 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
                  <CheckCircle2 className="h-7 w-7" />
                </div>
                <h3 className="text-base font-bold text-slate-900">Nenhum documento pendente</h3>
                <p className="max-w-sm text-sm text-slate-500">
                  {erroAcao
                    ? erroAcao
                    : "Você não tem documentação aguardando envio no momento. Assim que um novo serviço for liberado, o assistente abrirá automaticamente."}
                </p>
                <button onClick={onClose} className="mt-2 rounded-xl px-5 py-2.5 text-sm font-bold text-white" style={{ background: MARROM }}>
                  Entendi
                </button>
              </div>
            )}

            {fase === "escolher_processo" && (
              <div className="space-y-3">
                <p className="text-sm text-slate-600">Você tem mais de um serviço com documentação em aberto. Escolha por qual deseja começar:</p>
                {processos.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => abrirProcesso(p.id)}
                    className="flex w-full items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 text-left hover:border-[#E5C2C6] hover:shadow-sm"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        <FileText className="h-3.5 w-3.5" /> Processo
                      </div>
                      <div className="mt-0.5 truncate text-sm font-bold uppercase text-slate-800">{p.servico_nome}</div>
                      <div className="mt-1 text-[11px] font-bold uppercase tracking-wider" style={{ color: (p.documentos_pendentes_cliente ?? 0) > 0 || (p.wizards_pendentes ?? 0) > 0 ? MARROM : "#64748B" }}>
                        {getLabelResumoProcessoAssistente(p)}
                      </div>
                      {p.total > 0 && (
                        <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                          <div className="h-full rounded-full transition-all duration-500" style={{ width: `${p.percentual ?? p.pct}%`, background: MARROM }} />
                        </div>
                      )}
                    </div>
                    <ChevronRight className="h-5 w-5 shrink-0 text-slate-400" />
                  </button>
                ))}
              </div>
            )}

            {/* ITEM ATUAL */}
            {fase === "item" && docAtivo && carga && (
              <div className="space-y-4">
                {avisoRetomada && (
                  <div className="flex items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[12px] text-slate-600">
                    <Info className="mt-[2px] h-3.5 w-3.5 shrink-0 text-slate-400" />
                    <span>{avisoRetomada}</span>
                  </div>
                )}
                {avisoIrParaCertidao && (
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-900">
                    <span>
                      Pendência da certidão averbada criada. Anexe a certidão no item correto para
                      não enviar no documento errado.
                    </span>
                    <button
                      type="button"
                      onClick={async () => {
                        if (!carga) return;
                        const c = await recarregarCarga(carga.processo.id);
                        avancarPara(
                          c,
                          pularIds,
                          avisoIrParaCertidao,
                          "certidao_alteracao_nome",
                        );
                      }}
                      className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-bold text-white"
                      style={{ background: MARROM }}
                    >
                      Ir para pendência da certidão
                    </button>
                  </div>
                )}
                <div className="flex flex-col gap-1">
                  <div className="text-[11px] font-semibold text-slate-700">
                    Tarefa atual: <span className="font-bold text-slate-900">{docAtivo?.nome_documento ?? "Documento"}</span>
                    {docAtivo?.status === "invalido" || docAtivo?.status === "divergente" ? (
                      <span className="ml-2 inline-flex items-center rounded-md bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-700">Precisa de ajuste</span>
                    ) : docAtivo?.status === "aprovado" ? (
                      <span className="ml-2 inline-flex items-center rounded-md bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-700">Aprovado</span>
                    ) : docAtivo?.status === "em_analise" ? (
                      <span className="ml-2 inline-flex items-center rounded-md bg-sky-50 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-sky-700">Em análise</span>
                    ) : null}
                  </div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Categoria: {grupoAtivo?.stepLabel ?? "Documentação"}</div>
                  <p className="text-[12px] text-slate-500">Resolva esta tarefa para avançarmos para o próximo item.</p>
                </div>

                {/* PERGUNTA */}
                {tipoItemGuia(docAtivo) === "pergunta" && (
                  <PerguntaView
                    doc={docAtivo}
                    salvando={salvando}
                    onResponder={handleResponderPergunta}
                  />
                )}

                {/* CONDIÇÃO PROFISSIONAL */}
                {tipoItemGuia(docAtivo) === "condicao" && (
                  <div>
                    <h3 className="text-base font-bold text-slate-900">Qual é a sua condição profissional?</h3>
                    <p className="mt-1 text-sm text-slate-500">Isso define exatamente quais comprovantes de renda você precisará enviar. Você só anexa o que realmente se aplica a você.</p>
                    <div className="mt-3 grid grid-cols-1 gap-2">
                      {CONDICAO_OPCOES_GUIA.map((op) => (
                        <button
                          key={op.id}
                          disabled={salvando}
                          onClick={() => handleDefinirCondicao(op.id)}
                          className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-left hover:border-[#E5C2C6] disabled:opacity-50"
                        >
                          <div>
                            <div className="text-sm font-bold text-slate-800">{op.label}</div>
                            <div className="text-[11px] text-slate-500">{op.hint}</div>
                          </div>
                          {salvando ? <Loader2 className="h-4 w-4 animate-spin text-slate-400" /> : <ChevronRight className="h-4 w-4 text-slate-400" />}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* DOCUMENTO */}
                {tipoItemGuia(docAtivo) === "documento" && (
                  <>
                  {isDocDeArma(docAtivo.tipo_documento) && (
                    <div className="rounded-xl border border-[#E5C2C6] bg-[#FAF6F1] p-3">
                      <div className="text-[11px] font-bold uppercase tracking-wider" style={{ color: MARROM }}>
                        A qual arma este documento se refere?
                      </div>
                      <p className="mt-1 text-[11px] text-slate-600">
                        Cada arma do seu acervo tem o próprio CRAF/documento. Isso mantém sua pasta organizada por arma.
                      </p>
                      <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
                        <select
                          value={armaSelecionada ?? ""}
                          onChange={(e) => setArmaSelecionada(e.target.value || null)}
                          className="h-9 min-w-0 flex-1 rounded-md border border-slate-300 bg-white px-2 text-[12px] uppercase text-slate-800"
                        >
                          <option value="">SELECIONE A ARMA…</option>
                          {armasCliente.map((a) => {
                            const label = `${(a.marca ?? "").toUpperCase()} ${(a.modelo ?? "").toUpperCase()} — ${(a.calibre ?? "?").toUpperCase()} — SÉRIE ${(a.numero_serie ?? "S/ SÉRIE").toUpperCase()}`.replace(/\s+/g, " ").trim();
                            return (
                              <option key={a.arma_uid} value={a.arma_uid}>{label}</option>
                            );
                          })}
                        </select>
                        <button
                          type="button"
                          onClick={() => setCadastroArmaAberto(true)}
                          className="h-9 whitespace-nowrap rounded-md border px-3 text-[11px] font-bold uppercase tracking-wider"
                          style={{ borderColor: MARROM, color: MARROM }}
                        >
                          + CADASTRAR NOVA ARMA
                        </button>
                      </div>
                      {!armaSelecionada && (
                        <div className="mt-2 text-[11px] font-semibold uppercase tracking-wider text-amber-700">
                          Selecione a arma antes de enviar o documento.
                        </div>
                      )}
                    </div>
                  )}
                  <DocumentoView
                    doc={docAtivo}
                    orientacoesIA={orientacoesIA(docAtivo)}
                    template={pickTemplateGuia(docAtivo, carga.respostas)}
                    baixandoTemplate={baixandoTemplate}
                    onBaixarTemplate={(key) => abrirConfirmacaoTemplate(docAtivo, key)}
                    onEnviar={handleEscolherArquivo}
                    onVer={() =>
                      docAtivo.arquivo_storage_key &&
                      viewer.abrirStorage("qa-processo-docs", docAtivo.arquivo_storage_key, {
                        fileName: docAtivo.nome_documento,
                        title: docAtivo.nome_documento,
                      })
                    }
                  />
                  </>
                )}

                {/* Bloco 12 — sugestão de reaproveitamento */}
                {tipoItemGuia(docAtivo) === "documento" && candidatosReuso.length > 0 && (
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-3">
                    <div className="flex items-start gap-2">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" />
                      <div className="min-w-0 flex-1">
                        <div className="text-[12px] font-bold text-emerald-900">
                          Encontramos um documento já aprovado que pode ser usado aqui
                        </div>
                        <p className="mt-0.5 text-[11px] text-emerald-800/90">
                          {candidatosReuso.length === 1
                            ? "Você pode reaproveitar este documento agora, sem reenviar."
                            : `${candidatosReuso.length} documentos compatíveis encontrados. Escolha qual reaproveitar.`}
                        </p>
                        <ul className="mt-2 space-y-1.5">
                          {candidatosReuso.slice(0, 3).map((c) => (
                            <li
                              key={c.id}
                              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-emerald-200 bg-white px-2.5 py-2"
                            >
                              <div className="min-w-0">
                                <div className="truncate text-[12px] font-semibold text-slate-800">
                                  {c.nome_documento ?? c.tipo_documento}
                                </div>
                                <div className="text-[10px] uppercase tracking-wider text-slate-500">
                                  {c.escopo === "cliente"
                                    ? "Documento pessoal"
                                    : c.escopo === "arma"
                                      ? "Documento de arma"
                                      : c.escopo === "cac_atividade"
                                        ? "Documento de atividade CAC"
                                        : "Documento"}
                                  {c.origem === "hub_cliente" ? " · Hub de Documentos" : " · processo anterior"}
                                  {c.data_envio
                                    ? ` · enviado em ${new Date(c.data_envio).toLocaleDateString("pt-BR")}`
                                    : ""}
                                  {c.data_validade_efetiva || c.data_validade
                                    ? ` · validade ${new Date((c.data_validade_efetiva ?? c.data_validade) as string).toLocaleDateString("pt-BR")}`
                                    : ""}
                                </div>
                              </div>
                              <div className="flex items-center gap-1.5">
                                {c.arquivo_storage_key && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      viewer.abrirStorage(c.arquivo_bucket, c.arquivo_storage_key!, {
                                        fileName: c.nome_documento ?? c.tipo_documento,
                                        title: c.nome_documento ?? c.tipo_documento,
                                      })
                                    }
                                    className="rounded-md border border-slate-300 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-600 hover:bg-slate-50"
                                  >
                                    Ver
                                  </button>
                                )}
                                <button
                                  type="button"
                                  disabled={reusoAplicando === c.id}
                                  onClick={() => handleReaproveitar(c)}
                                  className="inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white disabled:opacity-60"
                                  style={{ background: MARROM }}
                                >
                                  {reusoAplicando === c.id ? (
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                  ) : null}
                                  Usar este
                                </button>
                              </div>
                            </li>
                          ))}
                        </ul>
                        <div className="mt-2 text-[10px] text-emerald-800/80">
                          Prefere enviar um novo? É só usar o botão de envio abaixo.
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                {tipoItemGuia(docAtivo) === "documento" &&
                  candidatosReuso.length === 0 &&
                  contextoReuso?.modoReaproveitamento === "assistido" &&
                  contextoReuso.mensagem && (
                    <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3">
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
                        <div className="min-w-0 flex-1">
                          <div className="text-[12px] font-bold text-amber-900">
                            Reaproveitamento assistido
                          </div>
                          <p className="mt-0.5 text-[11px] text-amber-900/85">
                            {contextoReuso.mensagem}
                          </p>
                          <div className="mt-2 text-[10px] text-amber-800/80">
                            Se quiser, envie novamente por aqui e a equipe decide o melhor aproveitamento no processo.
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                {tipoItemGuia(docAtivo) === "documento" && reusoCarregando && candidatosReuso.length === 0 && (
                  <div className="text-[10px] text-slate-400">Verificando se há documento reaproveitável…</div>
                )}

                {/* Painel de divergências — também disponível ao reabrir um
                    item já enviado e marcado como divergente/inválido. Sem
                    isto, documentos validados em versões anteriores da IA
                    (sem `divergencias_json`) ficam sem botões de ação. */}
                {tipoItemGuia(docAtivo) === "documento" &&
                  !!docAtivo.arquivo_storage_key &&
                  (docAtivo.status === "divergente" ||
                    docAtivo.status === "invalido" ||
                    /diverg/i.test(String((docAtivo as any).motivo_rejeicao || ""))) && (
                    <DivergenciasResolverPanel
                      divergencias={(docAtivo as any)?.divergencias_json as any}
                      motivoRejeicao={(docAtivo as any)?.motivo_rejeicao ?? null}
                      altNomeJaComprovada={!!altNomeJaComprovada}
                      nomesAceitosAlteracao={nomesAceitosAlteracao}
                      iniciandoAltNome={iniciandoAltNome}
                      podeAtualizarCadastro={!!clienteDados}
                      onIniciarAlteracaoNome={handleSimAlteracaoNome}
                      onAtualizarCadastroComGrupo={(grupo) =>
                        abrirSugestaoCadastroPorGrupo(grupo)
                      }
                      onMarcarComprovanteAntigo={handleComprovanteAntigo}
                      onReenviarDocumento={handleEscolherArquivo}
                      onEditarCadastroManual={(grupo) =>
                        abrirSugestaoCadastroPorGrupo(grupo, { iniciarComCadastroAtual: true })
                      }
                      onUsarNomeDoDocumento={usarNomeDoDocumento}
                      onAceitarDivergenciaCadastro={handleAceitarDivergencia}
                      altNomeEmComprovacao={!!altNomeEmComprovacao}
                    />
                  )}

                {erroAcao && (
                  <div className="rounded-lg border border-red-200 bg-red-50 p-2.5 text-[12px] text-red-800">{erroAcao}</div>
                )}

                {/* pular por agora (apenas documentos) */}
                {tipoItemGuia(docAtivo) === "documento" && filaAtual.length > 1 && (
                  <button
                    onClick={() => continuarAposResultado({ pularAtual: true })}
                    className="mx-auto block text-[11px] font-semibold uppercase tracking-wider text-slate-400 hover:text-slate-600"
                  >
                    Pular este item por agora →
                  </button>
                )}
              </div>
            )}

            {/* VALIDANDO IA */}
            {fase === "validando" && (
              <div className="flex flex-col items-center justify-center gap-4 py-14 text-center">
                <div className="relative">
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl" style={{ background: "#FBF3F4" }}>
                    <Sparkles className="h-7 w-7 animate-pulse" style={{ color: MARROM }} />
                  </div>
                  <Loader2 className="absolute -right-2 -top-2 h-6 w-6 animate-spin" style={{ color: MARROM }} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Validando seu documento com a IA</h3>
                  <p className="mt-1 max-w-sm text-sm text-slate-500">Estamos conferindo legibilidade, validade e se os dados batem com o seu cadastro. Leva alguns segundos — não feche esta janela.</p>
                </div>
              </div>
            )}

            {/* RESULTADO: APROVADO */}
            {fase === "resultado_ok" && (
              <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
                  <CheckCircle2 className="h-8 w-8" />
                </div>
                <h3 className="text-lg font-extrabold text-slate-900">Documento aprovado!</h3>
                <p className="max-w-sm text-sm text-slate-500">
                  {resultadoDoc?.validacao_ia_confianca != null
                    ? `Validado pela IA com ${Math.round(Number(resultadoDoc.validacao_ia_confianca) * 100)}% de confiança. `
                    : ""}
                  Vamos para o próximo item.
                </p>
                <button onClick={() => continuarAposResultado()} className="mt-2 inline-flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-bold text-white" style={{ background: MARROM }}>
                  Continuar <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            )}

            {/* RESULTADO: EM REVISÃO HUMANA */}
            {fase === "resultado_revisao" && (
              <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-sky-50 text-sky-600">
                  <ShieldCheck className="h-8 w-8" />
                </div>
                <h3 className="text-lg font-extrabold text-slate-900">Documento recebido</h3>
                <p className="max-w-sm text-sm text-slate-500">Sua parte está feita. O documento está sendo analisado e será processado em breve. Você pode seguir para o próximo item.</p>
                <button onClick={() => continuarAposResultado()} className="mt-2 inline-flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-bold text-white" style={{ background: MARROM }}>
                  Continuar <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            )}

            {/* RESULTADO: INVÁLIDO / DIVERGENTE */}
            {fase === "resultado_erro" && (
              <div className="flex flex-col items-center justify-center gap-3 py-8 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
                  <AlertTriangle className="h-8 w-8" />
                </div>
                <h3 className="text-lg font-extrabold text-slate-900">Precisamos de um ajuste</h3>
                {(resultadoDoc?.motivo_rejeicao || orientacoesIA(resultadoDoc)) && (
                  <div className="w-full rounded-lg border border-amber-200 bg-amber-50 p-3 text-left text-[12px] text-amber-900">
                    <div className="mb-1 inline-flex items-center gap-1.5 font-bold uppercase tracking-wider">
                      <Info className="h-3.5 w-3.5" /> O que corrigir
                    </div>
                    <p className="whitespace-pre-line leading-relaxed">
                      {(() => {
                        const divs = Array.isArray((resultadoDoc as any)?.divergencias_json)
                          ? (resultadoDoc as any).divergencias_json
                          : [];
                        if (divs.length > 0) {
                          return "Encontramos diferenças entre o documento e seu cadastro. Resolva cada uma abaixo.";
                        }
                        const motivo = String(resultadoDoc?.motivo_rejeicao || "");
                        if (motivo) return motivo;
                        return (
                          orientacoesIA(resultadoDoc) ||
                          "O documento enviado não atende a todos os critérios. Resolva as diferenças abaixo ou envie um novo documento."
                        );
                      })()}
                    </p>
                  </div>
                )}
                <DivergenciasResolverPanel
                  divergencias={(resultadoDoc as any)?.divergencias_json as any}
                  motivoRejeicao={(resultadoDoc as any)?.motivo_rejeicao ?? null}
                  altNomeJaComprovada={!!altNomeJaComprovada}
                  nomesAceitosAlteracao={nomesAceitosAlteracao}
                  iniciandoAltNome={iniciandoAltNome}
                  podeAtualizarCadastro={
                    !!((resultadoDoc as any)?.dados_extraidos_json) && !!clienteDados
                  }
                  onIniciarAlteracaoNome={handleSimAlteracaoNome}
                  onAtualizarCadastroComGrupo={(grupo) => abrirSugestaoCadastroPorGrupo(grupo)}
                  onMarcarComprovanteAntigo={handleComprovanteAntigo}
                  onReenviarDocumento={reenviarAtual}
                  onEditarCadastroManual={(grupo) =>
                    abrirSugestaoCadastroPorGrupo(grupo, { iniciarComCadastroAtual: true })
                  }
                  onUsarNomeDoDocumento={usarNomeDoDocumento}
                  onAceitarDivergenciaCadastro={handleAceitarDivergencia}
                  altNomeEmComprovacao={!!altNomeEmComprovacao}
                />
                <div className="mt-1 flex flex-wrap items-center justify-center gap-2">
                  <button onClick={reenviarAtual} className="inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold text-white" style={{ background: MARROM }}>
                    <RotateCcw className="h-4 w-4" /> Reenviar documento
                  </button>
                  {filaAtual.length > 1 && (
                    <button onClick={() => continuarAposResultado({ pularAtual: true })} className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-50">
                      Deixar para depois
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* RESULTADO: AINDA EM ANÁLISE (timeout) */}
            {fase === "resultado_demorando" && (
              <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl" style={{ background: "#FBF3F4" }}>
                  <Sparkles className="h-7 w-7" style={{ color: MARROM }} />
                </div>
                <h3 className="text-lg font-extrabold text-slate-900">Validação em andamento</h3>
                <p className="max-w-sm text-sm text-slate-500">A análise deste documento está demorando um pouco mais que o normal. Deixamos ele em análise — você pode continuar e acompanhar o resultado na Central de Documentos.</p>
                <button onClick={() => continuarAposResultado({ pularAtual: true })} className="mt-2 inline-flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-bold text-white" style={{ background: MARROM }}>
                  Continuar <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            )}

            {/* CONCLUÍDO */}
            {fase === "concluido" && (
              <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
                  <PartyPopper className="h-8 w-8" />
                </div>
                <h3 className="text-lg font-extrabold text-slate-900">Tudo enviado por enquanto</h3>
                <p className="max-w-sm text-sm text-slate-500">
                  A Equipe Quero Armas está analisando seus documentos.
                  {prog.emRevisao > 0
                    ? ` ${prog.emRevisao} documento(s) em conferência.`
                    : " Assim que houver um próximo item para você, o assistente avisa."}
                </p>
                <button onClick={onClose} className="mt-2 inline-flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-bold text-white" style={{ background: MARROM }}>
                  Concluir
                </button>
              </div>
            )}

            {/* CONTRATO PENDENTE DE ASSINATURA */}
            {fase === "contrato_pendente" && carga?.contratoPendente && (
              <div className="flex flex-col gap-5 py-6 px-1">
                {/* Cabeçalho de status */}
                <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
                    <FileText className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-amber-700">Aguardando assinatura</div>
                    <div className="mt-0.5 text-[13px] font-extrabold leading-snug text-slate-900">
                      Contrato {carga.contratoPendente.contract_number}
                    </div>
                    <div className="mt-1 text-[12px] leading-relaxed text-slate-600">
                      O serviço será iniciado somente após você assinar e enviar o contrato.
                    </div>
                  </div>
                </div>

                {/* Instruções */}
                <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">Como assinar</div>
                  <ol className="space-y-2.5">
                    {[
                      { n: "1", text: "Acesse a seção Contratos no seu painel e baixe o PDF do contrato." },
                      { n: "2", text: "Assine digitalmente pelo Gov.br (assinatura eletrônica com certificado ICP-Brasil) ou outro certificado ICP-Brasil válido." },
                      { n: "3", text: "Volte ao painel, abra o contrato e anexe o PDF assinado." },
                    ].map(({ n, text }) => (
                      <li key={n} className="flex items-start gap-2.5">
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-extrabold text-white" style={{ background: MARROM }}>{n}</span>
                        <span className="text-[12px] leading-relaxed text-slate-700">{text}</span>
                      </li>
                    ))}
                  </ol>
                </div>

                {/* Aviso */}
                <p className="text-center text-[11px] leading-relaxed text-slate-400">
                  A Equipe Quero Armas está aguardando o envio do contrato assinado para dar início ao processo.
                </p>

                {/* Ação */}
                <button
                  onClick={() => {
                    onClose();
                    window.location.href = "/area-do-cliente?secao=contratos";
                  }}
                  className="mx-auto inline-flex items-center gap-2 rounded-xl px-6 py-3 text-[13px] font-bold text-white shadow-sm"
                  style={{ background: MARROM }}
                >
                  <ArrowRight className="h-4 w-4" />
                  Ir para Contratos
                </button>
              </div>
            )}
          </div>

          {/* Rodapé fixo */}
          <div className="shrink-0 border-t border-slate-200 bg-slate-50/60 px-5 py-2.5 text-center">
            <p className="text-[10px] uppercase tracking-wider text-slate-400">Validação automática por IA · Acesso seguro e auditado</p>
          </div>
        </DialogContent>
      </Dialog>

      <input ref={fileRef} type="file" className="hidden" onChange={handleUpload} />

      <DocumentoViewerModal open={viewer.open} onClose={viewer.fechar} source={viewer.source} title={viewer.title} />

      <ArmaManualForm
        open={cadastroArmaAberto}
        onOpenChange={setCadastroArmaAberto}
        qaClienteId={clienteId}
        onSaved={async () => {
          const lista = await loadArmasCliente();
          setArmasCliente(lista);
          // seleciona a arma recém-criada (a que não estava antes)
          const previa = new Set(armasCliente.map((a) => a.arma_uid));
          const nova = lista.find((a) => !previa.has(a.arma_uid));
          if (nova) setArmaSelecionada(nova.arma_uid);
          else if (lista.length === 1) setArmaSelecionada(lista[0].arma_uid);
        }}
      />

      {/* Hub de Documentos — caminho único para docs permanentes */}
      {(customerId || clienteId) && (
        <ClienteDocsHubModal
          open={!!hubModalTipo}
          onClose={() => setHubModalTipo(null)}
          customerId={customerId}
          qaClienteId={clienteId}
          mode="portal"
          defaultTipo={hubModalTipo ?? undefined}
          clienteCpf={null}
          clienteNome={null}
          clienteDataNascimento={null}
          clienteNomeMae={null}
          docsAprovados={[]}
          onSaved={onHubDocSaved}
        />
      )}

      <DocumentDataOnboardingWizard
        open={wizard.open}
        onClose={fecharWizard}
        processoId={carga?.processo.id ?? null}
        clienteId={carga?.processo.cliente_id ?? null}
        templateKey={wizard.templateKey}
        documentoNome={wizard.doc?.nome_documento ?? null}
        onGenerated={handleWizardGenerated}
        onUpdated={async () => {
          await recarregarClienteDados();
          onUpdated?.();
        }}
      />

      {/* Modal do Documento Gerado — opções explícitas Baixar / Compartilhar / Já assinei */}
      <Dialog
        open={documentoGerado.open}
        onOpenChange={(n) => !n && setDocumentoGerado({ open: false, blob: null, fileName: "", doc: null })}
      >
        <DialogContent className="qa-scope w-[calc(100vw-1rem)] max-w-lg sm:max-w-xl rounded-[24px] border border-slate-200 bg-white p-0 text-slate-900 shadow-2xl overflow-hidden gap-0 flex flex-col [&>button.absolute]:hidden">
          <div className="shrink-0 border-b border-slate-200 px-5 py-4" style={{ background: "linear-gradient(180deg,#FBF3F4,#ffffff)" }}>
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-white shadow-sm" style={{ background: MARROM }}>
                <FileDown className="h-5 w-5" strokeWidth={2.3} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-500">Declaração pronta</div>
                <h2 className="text-[17px] font-extrabold leading-tight text-slate-900">
                  Salve o arquivo no seu dispositivo
                </h2>
                <p className="mt-1 text-[12px] leading-relaxed text-slate-600">
                  {documentoGerado.doc?.nome_documento || documentoGerado.fileName}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDocumentoGerado({ open: false, blob: null, fileName: "", doc: null })}
                aria-label="Fechar"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
          <div className="px-5 py-4 space-y-3">
            <p className="text-[12px] leading-relaxed text-slate-600">
              Baixe ou compartilhe o arquivo, assine no <span className="font-semibold">gov.br</span> e depois volte
              aqui para anexar o PDF assinado.
            </p>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                disabled={!!documentoGeradoAcao}
                onClick={() => void executarSalvarDocumento("baixar")}
                className="inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-[13px] font-bold uppercase tracking-wide text-white shadow-sm disabled:opacity-60"
                style={{ background: MARROM }}
              >
                {documentoGeradoAcao === "baixar" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
                Baixar declaração preenchida
              </button>
              <button
                type="button"
                disabled={!!documentoGeradoAcao}
                onClick={() => void executarSalvarDocumento("compartilhar")}
                className="inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-[13px] font-bold uppercase tracking-wide border border-slate-300 bg-white text-slate-800 hover:bg-slate-50 disabled:opacity-60"
              >
                {documentoGeradoAcao === "compartilhar" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ExternalLink className="h-4 w-4" />
                )}
                {isMobileUA() ? "Compartilhar / salvar no celular" : "Abrir em nova aba"}
              </button>
              <div className="my-1 h-px bg-slate-200" />
              <button
                type="button"
                onClick={jaAssineiAnexarPdfAssinado}
                className="inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-[13px] font-bold uppercase tracking-wide border border-slate-300 bg-white text-slate-800 hover:bg-slate-50"
              >
                <Upload className="h-4 w-4" />
                Já assinei, anexar PDF assinado
              </button>
            </div>
            <p className="text-[11px] leading-relaxed text-slate-500">
              Base legal: Lei 10.826/2003, Decreto 11.615/2023, Decreto 12.345/2024, IN DG/PF 201 e 311.
            </p>
          </div>
        </DialogContent>
      </Dialog>

      {/* Wizard de Perguntas vinculado à exigência — abre antes de qualquer ação */}
      <Dialog open={wizardPre.open} onOpenChange={(n) => !n && fecharWizardPre()}>
        <DialogContent className="qa-scope w-[calc(100vw-1rem)] max-w-lg rounded-[24px] border border-slate-200 bg-white p-0 text-slate-900 shadow-2xl max-h-[94dvh] overflow-hidden gap-0 flex flex-col [&>button.absolute]:hidden">
          <div className="shrink-0 border-b border-slate-200 px-5 py-4" style={{ background: "linear-gradient(180deg,#FBF3F4,#ffffff)" }}>
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-white shadow-sm" style={{ background: MARROM }}>
                <ShieldCheck className="h-5 w-5" strokeWidth={2.3} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-500">
                  Antes de continuar
                </div>
                <h2 className="text-[17px] font-extrabold leading-tight text-slate-900">
                  {wizardPre.cfg ? getWizardLabel(wizardPre.cfg.wizard_key) : ""}
                </h2>
                {wizardPre.doc?.nome_documento && (
                  <p className="mt-1 text-[11px] text-slate-500">
                    Documento: <span className="font-semibold text-slate-700">{wizardPre.doc.nome_documento}</span>
                  </p>
                )}
                {wizardPre.cfg && (
                  <p className="mt-1.5 text-[12px] leading-relaxed text-slate-600">
                    {getWizardDescricaoCliente(wizardPre.cfg.wizard_key)}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={fecharWizardPre}
                aria-label="Fechar"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
          <div className="min-h-[260px] flex-1 overflow-y-auto px-5 py-5">
            {wizardPre.open && wizardPre.cfg?.wizard_key === "clube_filiacao" && carga && (
              <ClubeFiliacaoStep
                processoId={carga.processo.id}
                clienteId={carga.processo.cliente_id}
                documentoId={wizardPre.doc?.id ?? null}
                onConfirmed={() => {
                  toast.success("Clube e filiação confirmados.");
                  onUpdated?.();
                  void retomarAcaoPosWizardPre();
                }}
                onBack={fecharWizardPre}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>

      {clienteDados && (
        <ClienteCadastroProgressivoModal
          open={editarCadastroAberto}
          onClose={() => setEditarCadastroAberto(false)}
          cliente={clienteDados}
          onUpdated={async () => {
            await recarregarClienteDados();
          }}
        />
      )}

      <SugestaoCadastroFromDocModal
        open={sugestao.open}
        onOpenChange={(n) =>
          !n &&
          setSugestao({ open: false, dados: null, nomeDoc: null, filtroCampos: null, titulo: null, iniciarComCadastroAtual: false })
        }
        cliente={clienteDados}
        dadosExtraidos={sugestao.dados}
        nomeDoc={sugestao.nomeDoc}
        filtroCampos={sugestao.filtroCampos}
        tituloCustomizado={sugestao.titulo}
        iniciarComCadastroAtual={!!sugestao.iniciarComCadastroAtual}
        onApplied={async () => {
          await recarregarClienteDados();
          onUpdated?.();
          // Se a sugestão foi aberta a partir do painel de divergências
          // (filtroCampos definido), reprocessa o documento para que a IA
          // reavalie com o cadastro atualizado.
          const documentoParaReprocessar = resultadoDoc?.id ?? docAtivo?.id ?? null;
          if (sugestao.filtroCampos && documentoParaReprocessar && carga) {
            try {
              toast.success(
                "Cadastro atualizado. Vamos conferir o documento novamente.",
              );
              await reprocessarDocumentoCliente(documentoParaReprocessar, "cadastro_atualizado");
            } catch (e) {
              console.warn("[ChecklistGuiado] falha ao reenfileirar IA:", e);
            }
          }
        }}
      />
    </>
  );
}

// ---------------------------------------------------------------------------
// Subcomponente: PERGUNTA
// ---------------------------------------------------------------------------
function PerguntaView({
  doc,
  salvando,
  onResponder,
}: {
  doc: GuiaDoc;
  salvando: boolean;
  onResponder: (valor: string) => void;
}) {
  const pergunta = (doc.regra_validacao as any) ?? {};
  const enunciado = pergunta.pergunta || pergunta.label || doc.nome_documento;
  const opcoes: any[] = Array.isArray(pergunta.opcoes) ? pergunta.opcoes : [];
  return (
    <div>
      <h3 className="text-base font-bold text-slate-900">{enunciado}</h3>
      {doc.instrucoes && <p className="mt-1 text-sm text-slate-500">{doc.instrucoes}</p>}
      <div className="mt-3 grid grid-cols-1 gap-2">
        {opcoes.map((op) => (
          <button
            key={op.valor}
            disabled={salvando}
            onClick={() => onResponder(op.valor)}
            className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-left text-sm font-bold text-slate-800 hover:border-[#E5C2C6] disabled:opacity-50"
          >
            {String(op.label || op.valor)}
            {salvando ? <Loader2 className="h-4 w-4 animate-spin text-slate-400" /> : <ChevronRight className="h-4 w-4 text-slate-400" />}
          </button>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Subcomponente: DOCUMENTO
// ---------------------------------------------------------------------------
function DocumentoView({
  doc,
  orientacoesIA,
  template,
  baixandoTemplate,
  onBaixarTemplate,
  onEnviar,
  onVer,
}: {
  doc: GuiaDoc;
  orientacoesIA: string | null;
  template: { key: string; label: string } | null;
  baixandoTemplate: boolean;
  onBaixarTemplate: (templateKey: string) => void;
  onEnviar: () => void;
  onVer: () => void;
}) {
  const fmts: string[] = Array.isArray(doc.formato_aceito)
    ? (doc.formato_aceito as string[])
        .map((f) => {
          const s = String(f).toLowerCase().trim();
          if (!s) return "";
          const sub = s.includes("/") ? (s.split("/").pop() || s) : s;
          return (sub === "jpeg" ? "jpg" : sub).toUpperCase();
        })
        .filter(Boolean)
    : [];
  const jaEnviado = !!doc.arquivo_storage_key && (doc.status === "invalido" || doc.status === "divergente" || doc.status === "em_analise");
  // Comprovante de endereço de anos anteriores é histórico (imutável) — não
  // possui prazo de validade. Só o comprovante do ano corrente tem os 90 dias.
  const matchEnderecoAno = /^comprovante_endereco_ano_(\d{4})$/.exec(doc.tipo_documento || "");
  const ehEnderecoHistorico = !!matchEnderecoAno && Number(matchEnderecoAno[1]) < new Date().getFullYear();
  const validade = getValidadeInfo({
    tipo_documento: doc.tipo_documento,
    data_emissao: (doc as any).data_emissao ?? null,
    data_validade_efetiva: (doc as any).data_validade_efetiva ?? null,
    data_validade: (doc as any).data_validade ?? null,
    ano_competencia: (doc as any).ano_competencia ?? null,
    regra_validacao: (doc as any).regra_validacao ?? null,
  });
  const isCertidaoAltNome = ehCertidaoAlteracaoNome(doc);

  const [externalLinks, setExternalLinks] = useState<Array<{
    id: string; nome_botao: string; url: string; descricao: string | null;
  }>>([]);
  useEffect(() => {
    if (!doc?.tipo_documento) { setExternalLinks([]); return; }
    let cancelled = false;
    const rv = (doc.regra_validacao && typeof doc.regra_validacao === "object")
      ? (doc.regra_validacao as any) : {};
    const tipoBase: string | null = rv?.tipo_base ?? null;
    const tipos = Array.from(new Set(
      [doc.tipo_documento, tipoBase].filter(Boolean) as string[]
    ));
    (async () => {
      const { data, error } = await supabase
        .from("qa_document_external_links" as any)
        .select("id, nome_botao, url, descricao")
        .in("tipo_documento", tipos)
        .eq("ativo", true)
        .order("ordem", { ascending: true });
      if (!cancelled && !error) setExternalLinks((data ?? []) as any);
    })();
    return () => { cancelled = true; };
  }, [doc?.tipo_documento, doc?.regra_validacao]);

  const validadeTone =
    validade.semVencimento
      ? "border-slate-200 bg-slate-50 text-slate-600"
      : validade.status === "vencido"
      ? "border-red-200 bg-red-50 text-red-800"
      : validade.status === "vence_em_breve"
        ? "border-amber-200 bg-amber-50 text-amber-800"
        : "border-emerald-200 bg-emerald-50 text-emerald-800";
  return (
    <div>
      <h3 className="text-base font-bold text-slate-900">{doc.nome_documento}</h3>
      {/* Reutilizado do Hub de Documentos — item cumprido sem novo upload */}
      {doc.status === "dispensado_por_reaproveitamento" && (
        <div className="mt-2 inline-flex items-center gap-1.5 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-[11px] font-bold uppercase tracking-wider text-emerald-800">
          <CheckCircle2 className="h-3.5 w-3.5" />
          REUTILIZADO DO HUB DE DOCUMENTOS
        </div>
      )}
      {isCertidaoAltNome && (
        <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
          Envie sua certidão de casamento ou nascimento averbada para comprovar a alteração do seu nome.
        </p>
      )}

      {/* validade efetiva (apenas para envios já feitos) */}
      {!ehEnderecoHistorico && !!doc.arquivo_storage_key && validade.label && (
        <div className={`mt-3 inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] font-bold uppercase tracking-wider ${validadeTone}`}>
          <CalendarClock className="h-3.5 w-3.5" />
          {validade.semVencimento
            ? validade.label
            : validade.status === "vencido"
            ? `Vencido em ${validade.label}`
            : validade.status === "vence_em_breve"
              ? `Vence em ${validade.label} (${validade.dias} dia${validade.dias === 1 ? "" : "s"})`
              : `Válido até ${validade.label}`}
        </div>
      )}

      {/* metadados úteis */}
      {(doc.orgao_emissor || doc.prazo_recomendado_dias != null || (doc.validade_dias != null && !ehEnderecoHistorico)) && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {doc.orgao_emissor && (
            <span className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-600">
              <Building2 className="h-3 w-3" /> {doc.orgao_emissor}
            </span>
          )}
          {doc.prazo_recomendado_dias != null && (
            <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-600">
              Prazo: {doc.prazo_recomendado_dias} dias
            </span>
          )}
          {doc.validade_dias != null && !ehEnderecoHistorico && (
            <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-600">
              Validade: {doc.validade_dias} dias
            </span>
          )}
        </div>
      )}

      {/* Como obter / onde emitir */}
      {(doc.instrucoes || doc.observacoes_cliente || doc.link_emissao || externalLinks.length > 0) && !isCertidaoAltNome && (
        <div className="mt-3 rounded-xl border border-[#E5C2C6] bg-[#FBF3F4]/60 p-3.5">
          <div className="mb-2.5 flex items-center gap-1.5">
            <Info className="h-3.5 w-3.5 shrink-0 text-[#7A1F2B]" />
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#7A1F2B]">
              Como obter este documento
            </span>
          </div>
          {doc.instrucoes && (
            <p className="mb-3 whitespace-pre-line text-[12px] leading-relaxed text-slate-700">
              {doc.instrucoes}
            </p>
          )}
          {doc.observacoes_cliente && (
            <p className="mb-3 whitespace-pre-line text-[12px] leading-relaxed text-slate-600">
              {doc.observacoes_cliente}
            </p>
          )}
          {(doc.link_emissao || externalLinks.length > 0) && (
            <div className="flex flex-col gap-1.5">
              {doc.link_emissao && (
                <a
                  href={doc.link_emissao}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-[12px] font-bold uppercase tracking-wide text-white shadow-sm"
                  style={{ background: MARROM }}
                >
                  <ExternalLink className="h-4 w-4" /> Acessar no site oficial
                </a>
              )}
              {externalLinks
                .filter(l => l.url && l.url !== doc.link_emissao)
                .map(l => (
                  <a
                    key={l.id}
                    href={l.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 rounded-xl border border-[#E5C2C6] bg-white px-4 py-2 text-[12px] font-bold text-[#7A1F2B] hover:bg-[#FBF3F4]"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    <span className="uppercase tracking-wide">{l.nome_botao}</span>
                    {l.descricao && (
                      <span className="ml-1 text-[10px] font-normal normal-case text-slate-500">{l.descricao}</span>
                    )}
                  </a>
                ))}
            </div>
          )}
        </div>
      )}
      {(doc.modelo_url || doc.exemplo_url) && (
        <div className="mt-2 flex flex-wrap gap-2">
          {doc.modelo_url && (
            <a href={doc.modelo_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-emerald-800 hover:brightness-95">
              <FileDown className="h-3.5 w-3.5" /> Baixar modelo
            </a>
          )}
          {doc.exemplo_url && (
            <a href={doc.exemplo_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-600 hover:bg-slate-50">
              <BookOpen className="h-3.5 w-3.5" /> Ver exemplo
            </a>
          )}
        </div>
      )}

      {/* motivo/orientação anterior, quando reenviando */}
      {jaEnviado && (doc.motivo_rejeicao || orientacoesIA) && (
        <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-[12px] text-amber-900">
          <div className="mb-1 inline-flex items-center gap-1.5 font-bold uppercase tracking-wider">
            <Info className="h-3.5 w-3.5" /> O que corrigir
          </div>
          <p className="whitespace-pre-line leading-relaxed">
            {(() => {
              const divs = Array.isArray((doc as any)?.divergencias_json) ? (doc as any).divergencias_json : [];
              if (divs.length > 0) {
                return "Encontramos diferenças entre o documento e seu cadastro. Resolva cada uma abaixo.";
              }
              const motivo = String(doc.motivo_rejeicao || "");
              if (motivo) return motivo;
              return (
                orientacoesIA ||
                "O documento enviado não atende a todos os critérios. Resolva as diferenças abaixo ou envie um novo documento."
              );
            })()}
          </p>
        </div>
      )}

      {/* Modelo preenchível — declaração gerada com os dados do cliente */}
      {template && (
        <div className="mt-4 rounded-2xl border border-[#E5C2C6] bg-[#FBF3F4]/70 p-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white" style={{ background: MARROM }}>
              <FileText className="h-4.5 w-4.5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[10px] font-bold uppercase tracking-[0.2em]" style={{ color: MARROM }}>
                Modelo preenchido
              </div>
              <p className="mt-0.5 text-[13px] leading-relaxed text-slate-700">
                Baixe a declaração já preenchida com seus dados, assine no Gov.br e anexe o PDF assinado aqui.
              </p>
              <button
                type="button"
                onClick={() => onBaixarTemplate(template.key)}
                disabled={baixandoTemplate}
                className="mt-3 inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-[12px] font-bold uppercase tracking-wider text-white shadow-sm transition disabled:opacity-60"
                style={{ background: MARROM }}
              >
                {baixandoTemplate ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Gerando declaração...
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4" /> Baixar declaração preenchida
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* área de upload */}
      <button
        onClick={onEnviar}
        className="mt-4 flex w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-[#E5C2C6] bg-[#FBF3F4]/50 px-4 py-7 text-center transition hover:bg-[#FBF3F4]"
      >
        <div className="flex h-11 w-11 items-center justify-center rounded-full text-white" style={{ background: MARROM }}>
          <Upload className="h-5 w-5" />
        </div>
        <span className="text-sm font-bold text-slate-800">
          {isCertidaoAltNome ? "Anexar certidão averbada" : jaEnviado ? "Reenviar documento" : "Anexar documento"}
        </span>
        <span className="inline-flex items-center gap-1 text-[11px] text-slate-500">
          <Camera className="h-3.5 w-3.5" /> Tire uma foto ou selecione um arquivo
        </span>
        {fmts.length > 0 && <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Formatos: {fmts.join(", ")}</span>}
      </button>

      {!!doc.arquivo_storage_key && (
        <button onClick={onVer} className="mx-auto mt-2 block text-[11px] font-semibold uppercase tracking-wider text-slate-400 hover:text-slate-600">
          Ver último arquivo enviado
        </button>
      )}
    </div>
  );
}
