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
  CONDICAO_OPCOES_GUIA,
  GuiaDoc,
  ProcessoElegivel,
  aguardarValidacaoIAGuia,
  carregarProcessoGuia,
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

const MARROM = "#7A1F2B";

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

  // ----- carregar processos elegíveis ao abrir -----
  const iniciar = useCallback(async () => {
    setFase("carregando");
    setErroAcao(null);
    try {
      const lista = await listarProcessosElegiveisGuia(clienteId);
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
      setFase("concluido");
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

  const prog = useMemo(() => (carga ? progressoGuia(carga) : { total: 0, cumpridos: 0, emRevisao: 0 }), [carga]);
  const pct = prog.total > 0 ? Math.round((prog.cumpridos / prog.total) * 100) : 0;
  // "Pendências restantes" no topo deve usar EXATAMENTE o mesmo universo dos
  // cards de seleção (= construirFilaGuia.length). Caso contrário, itens em
  // análise / em revisão humana inflam o número e ficamos com discrepância
  // ("18 pendentes" no topo vs "10 pendentes" no card).
  const pendentesAcao = filaAtual.length;
  const emAnalise = Math.max(0, prog.total - prog.cumpridos - pendentesAcao);
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

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !carga || !docAtivo) return;
    setErroAcao(null);
    const enviar = await enviarDocumentoGuia(carga.processo, docAtivo, file);
    if (!enviar.ok) {
      setErroAcao(enviar.error ?? "Erro no envio.");
      return;
    }
    onUpdated?.();
    setFase("validando");
    const final = await aguardarValidacaoIAGuia(docAtivo.id);
    setResultadoDoc(final);
    await recarregarCarga(carga.processo.id);
    onUpdated?.();
    const st = final?.status;
    if (st === "aprovado" || st === "dispensado_grupo") setFase("resultado_ok");
    else if (st === "em_revisao_humana") setFase("resultado_revisao");
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
          nomeDoc: docAtivo?.nome_documento ?? null,
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
  const altNomeJaComprovada = !!(
    carga?.processo?.respostas_questionario_json as any
  )?.alteracao_nome?.aprovada;
  const [iniciandoAltNome, setIniciandoAltNome] = useState(false);
  const handleSimAlteracaoNome = async () => {
    if (!carga) return;
    setIniciandoAltNome(true);
    setErroAcao(null);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess?.session?.access_token;
      const base = import.meta.env.VITE_SUPABASE_URL as string;
      if (!token) throw new Error("Sessão expirada. Entre novamente.");
      const resp = await fetch(
        `${base}/functions/v1/qa-processo-alteracao-nome-iniciar`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ processo_id: carga.processo.id }),
        },
      );
      const out = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(out?.error || "Falha ao iniciar pendência.");
      if (out?.reaproveitado) {
        toast.success("Encontramos sua certidão averbada já aprovada e a reaproveitamos neste processo.");
      } else {
        toast.success("Pendência criada. Anexe a certidão averbada para comprovar a alteração de nome.");
      }
      onUpdated?.();
      const c = await recarregarCarga(carga.processo.id);
      // Foca no doc da certidão recém-criado (ou no próximo acionável).
      avancarPara(c, pularIds, out?.document_id ?? null, "certidao_alteracao_nome");
    } catch (e: any) {
      setErroAcao(e?.message ?? "Erro ao iniciar comprovação.");
    } finally {
      setIniciandoAltNome(false);
    }
  };

  // ----- Abrir SugestaoCadastroFromDocModal escopado a um grupo de campos -----
  const abrirSugestaoCadastroPorGrupo = (grupo: GrupoDivergencia) => {
    const extraidos = (resultadoDoc as any)?.dados_extraidos_json;
    if (!extraidos || typeof extraidos !== "object") {
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
      rg: "Revise antes de atualizar seu RG",
      contato: "Revise antes de atualizar seu contato",
      cpf: "Revise antes de atualizar",
      data_nascimento: "Revise antes de atualizar",
      outros: "Revise antes de atualizar seu cadastro",
    };
    setSugestao({
      open: true,
      dados: extraidos as Record<string, any>,
      nomeDoc: docAtivo?.nome_documento ?? null,
      filtroCampos: colunas,
      titulo: titulos[grupo],
    });
  };

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
  const [clienteDados, setClienteDados] = useState<any | null>(null);
  const [editarCadastroAberto, setEditarCadastroAberto] = useState(false);

  // ----- Sugestão de atualização de cadastro (Fase 5) -----
  const [sugestao, setSugestao] = useState<
    | {
        open: boolean;
        dados: Record<string, any> | null;
        nomeDoc: string | null;
        filtroCampos: string[] | null;
        titulo: string | null;
      }
  >({ open: false, dados: null, nomeDoc: null, filtroCampos: null, titulo: null });

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
    setBaixandoTemplate(true);
    setWizard({ open: true, doc, templateKey });
  };

  const fecharWizard = () => {
    setWizard({ open: false, doc: null, templateKey: null });
    setBaixandoTemplate(false);
  };

  const handleWizardGenerated = (blob: Blob, _filename: string) => {
    const doc = wizard.doc;
    const templateKey = wizard.templateKey;
    if (!doc || !templateKey || !carga) return;
    const baseNome = slugifyParaArquivo(doc.nome_documento || templateKey);
    const sufixoCliente = slugifyParaArquivo(carga.clienteNome || "cliente");
    const fileName = `${baseNome || "declaracao"}-${sufixoCliente || "cliente"}.docx`;
    const a = document.createElement("a");
    const objUrl = URL.createObjectURL(blob);
    a.href = objUrl;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(objUrl);
    toast.success("Documento gerado. Confira o arquivo baixado.");
  };

  return (
    <>
      <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
        <DialogContent
          className="qa-scope w-[calc(100vw-1rem)] max-w-2xl sm:max-w-3xl rounded-[24px] border border-slate-200 bg-white p-0 text-slate-900 shadow-2xl max-h-[94dvh] overflow-hidden gap-0 flex flex-col [&>button.absolute]:hidden"
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
                  <span className="truncate pr-2 text-[11px] font-bold text-slate-800">Sua pasta está {pct}% pronta</span>
                  <span className="shrink-0 text-[11px] text-slate-500">
                    {prog.cumpridos} de {prog.total} itens resolvidos · {pendentesAcao} pendência{pendentesAcao === 1 ? "" : "s"} restante{pendentesAcao === 1 ? "" : "s"}
                    {emAnalise > 0 ? ` · ${emAnalise} em análise` : ""}
                  </span>
                </div>
                <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: MARROM }} />
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
                      <div className="mt-1 text-[11px] font-bold uppercase tracking-wider" style={{ color: p.pendentes > 0 ? MARROM : "#64748B" }}>
                        {p.pendentes > 0 ? `${p.pendentes} item(ns) pendente(s)` : "Tudo em dia"}
                      </div>
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
                      iniciandoAltNome={iniciandoAltNome}
                      podeAtualizarCadastro={!!clienteDados}
                      onIniciarAlteracaoNome={handleSimAlteracaoNome}
                      onAtualizarCadastroComGrupo={(grupo) =>
                        abrirSugestaoCadastroPorGrupo(grupo)
                      }
                      onMarcarComprovanteAntigo={handleComprovanteAntigo}
                      onReenviarDocumento={handleEscolherArquivo}
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
                <p className="max-w-sm text-sm text-slate-500">Sua parte está feita. Este documento passará por uma conferência da Equipe Quero Armas. Você pode seguir para o próximo item.</p>
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
                {resultadoDoc?.motivo_rejeicao && (
                  <div className="w-full rounded-lg border border-amber-200 bg-amber-50 p-3 text-left text-[12px] text-amber-900">
                    <span className="font-bold uppercase tracking-wider">Motivo: </span>
                    {resultadoDoc.motivo_rejeicao}
                  </div>
                )}
                {orientacoesIA(resultadoDoc) && (
                  <div className="w-full rounded-lg border border-amber-200 bg-amber-50/70 p-3 text-left text-[12px] text-amber-900">
                    <div className="mb-1 inline-flex items-center gap-1.5 font-bold uppercase tracking-wider">
                      <Info className="h-3.5 w-3.5" /> O que corrigir
                    </div>
                    <p className="whitespace-pre-line leading-relaxed">{orientacoesIA(resultadoDoc)}</p>
                  </div>
                )}
                <DivergenciasResolverPanel
                  divergencias={(resultadoDoc as any)?.divergencias_json as any}
                  motivoRejeicao={(resultadoDoc as any)?.motivo_rejeicao ?? null}
                  altNomeJaComprovada={!!altNomeJaComprovada}
                  iniciandoAltNome={iniciandoAltNome}
                  podeAtualizarCadastro={
                    !!((resultadoDoc as any)?.dados_extraidos_json) && !!clienteDados
                  }
                  onIniciarAlteracaoNome={handleSimAlteracaoNome}
                  onAtualizarCadastroComGrupo={(grupo) => abrirSugestaoCadastroPorGrupo(grupo)}
                  onMarcarComprovanteAntigo={handleComprovanteAntigo}
                  onReenviarDocumento={reenviarAtual}
                />
                {altNomeJaComprovada && (
                  <div className="w-full rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-left text-[12px] text-emerald-900">
                    <span className="font-bold uppercase tracking-wider">Alteração de nome comprovada. </span>
                    Este processo aceita o nome atual e o nome anterior.
                  </div>
                )}
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
          </div>

          {/* Rodapé fixo */}
          <div className="shrink-0 border-t border-slate-200 bg-slate-50/60 px-5 py-2.5 text-center">
            <p className="text-[10px] uppercase tracking-wider text-slate-400">Validação automática por IA · Acesso seguro e auditado</p>
          </div>
        </DialogContent>
      </Dialog>

      <input ref={fileRef} type="file" className="hidden" onChange={handleUpload} />

      <DocumentoViewerModal open={viewer.open} onClose={viewer.fechar} source={viewer.source} title={viewer.title} />

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
          setSugestao({ open: false, dados: null, nomeDoc: null, filtroCampos: null, titulo: null })
        }
        cliente={clienteDados}
        dadosExtraidos={sugestao.dados}
        nomeDoc={sugestao.nomeDoc}
        filtroCampos={sugestao.filtroCampos}
        tituloCustomizado={sugestao.titulo}
        onApplied={async () => {
          await recarregarClienteDados();
          onUpdated?.();
          // Se a sugestão foi aberta a partir do painel de divergências
          // (filtroCampos definido), reprocessa o documento para que a IA
          // reavalie com o cadastro atualizado.
          if (sugestao.filtroCampos && resultadoDoc?.id && carga) {
            try {
              await supabase
                .from("qa_processo_documentos")
                .update({
                  status: "em_analise",
                  validacao_ia_status: "fila",
                  validacao_ia_erro: null,
                  motivo_rejeicao: null,
                })
                .eq("id", resultadoDoc.id);
              toast.success(
                "Cadastro atualizado. Vamos conferir o documento novamente.",
              );
              const c = await recarregarCarga(carga.processo.id);
              avancarPara(c, pularIds);
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
      {doc.instrucoes && <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{doc.instrucoes}</p>}
      {doc.observacoes_cliente && <p className="mt-1 text-[13px] leading-relaxed text-slate-500">{doc.observacoes_cliente}</p>}

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

      {/* botões auxiliares: emitir online / links externos / modelo / exemplo */}
      {(doc.link_emissao || doc.modelo_url || doc.exemplo_url || externalLinks.length > 0) && (
        <div className="mt-3 flex flex-wrap gap-2">
          {doc.link_emissao && (
            <a href={doc.link_emissao} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border border-[#E5C2C6] bg-[#FBF3F4] px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-[#7A1F2B] hover:brightness-95">
              <ExternalLink className="h-3.5 w-3.5" /> Emitir online
            </a>
          )}
          {externalLinks
            .filter(l => l.url && l.url !== doc.link_emissao)
            .map(l => (
              <a key={l.id} href={l.url} target="_blank" rel="noopener noreferrer"
                 title={l.descricao ?? undefined}
                 className="inline-flex items-center gap-1.5 rounded-lg border border-[#E5C2C6] bg-[#FBF3F4] px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-[#7A1F2B] hover:brightness-95">
                <ExternalLink className="h-3.5 w-3.5" /> {l.nome_botao}
              </a>
            ))}
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
      {jaEnviado && doc.motivo_rejeicao && (
        <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-[12px] text-amber-900">
          <span className="font-bold uppercase tracking-wider">Ajuste necessário: </span>{doc.motivo_rejeicao}
        </div>
      )}
      {jaEnviado && orientacoesIA && (
        <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50/70 p-2.5 text-[12px] text-amber-900">
          <div className="mb-1 inline-flex items-center gap-1.5 font-bold uppercase tracking-wider"><Info className="h-3.5 w-3.5" /> O que corrigir</div>
          <p className="whitespace-pre-line leading-relaxed">{orientacoesIA}</p>
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
        <span className="text-sm font-bold text-slate-800">{jaEnviado ? "Reenviar documento" : "Anexar documento"}</span>
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
