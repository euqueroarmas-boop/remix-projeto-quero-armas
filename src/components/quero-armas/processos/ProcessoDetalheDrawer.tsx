import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { X, Upload, RefreshCw, CheckCircle, XCircle, AlertTriangle, Clock, Eye, Sparkles, FileText, Download, ExternalLink, ShieldCheck, ShieldAlert, History, Send, Info, BookOpen, FileDown, Building2, CalendarClock, Layers, Home, Database, GitCompareArrows } from "lucide-react";
import { getStatusProcesso, getStatusDocumento, formatDateTime, formatDate, STATUS_PROCESSO } from "./processoConstants";
import DocumentoViewerModal, { useDocumentoViewer } from "@/components/quero-armas/DocumentoViewerModal";

interface DocRow {
  id: string;
  nome_documento: string;
  tipo_documento: string;
  etapa: string;
  status: string;
  obrigatorio: boolean;
  motivo_rejeicao: string | null;
  observacoes: string | null;
  arquivo_url: string | null;
  arquivo_storage_key: string | null;
  dados_extraidos_json: any;
  divergencias_json: any;
  validacao_ia_status: string | null;
  validacao_ia_confianca: number | null;
  validacao_ia_modelo: string | null;
  validacao_ia_erro: string | null;
  data_envio: string | null;
  data_validacao: string | null;
  updated_at: string;
  link_emissao?: string | null;
  validade_dias?: number | null;
  data_validade?: string | null;
  formato_aceito?: string[] | string | null;
  regra_validacao?: any;
  // Fase 12 — orientação ao cliente (todos opcionais)
  instrucoes?: string | null;
  observacoes_cliente?: string | null;
  modelo_url?: string | null;
  exemplo_url?: string | null;
  orgao_emissor?: string | null;
  prazo_recomendado_dias?: number | null;
  // Fase 1/2 — extração ampliada
  metadados_documento_json?: any;
  campos_complementares_json?: any;
  titular_comprovante_nome?: string | null;
  titular_comprovante_documento?: string | null;
  endereco_em_nome_de_terceiro?: boolean | null;
  // APRENDIZADO SUPERVISIONADO
  texto_ocr_extraido?: string | null;
  score_modelo_aprovado?: number | null;
  modelo_aprovado_id?: string | null;
  usado_como_modelo?: boolean | null;
}

interface ProcessoFull {
  id: string;
  cliente_id: number;
  servico_nome: string;
  status: string;
  pagamento_status: string;
  data_criacao: string;
  observacoes_admin: string | null;
  condicao_profissional?: string | null;
  cliente?: { nome_completo: string; cpf: string | null; email: string | null };
}

interface Evento {
  id: string;
  tipo_evento: string;
  descricao: string | null;
  ator: string | null;
  created_at: string;
}

interface Props {
  processoId: string;
  equipeMode?: boolean;
  onClose: () => void;
  onUpdated?: () => void;
}

export function ProcessoDetalheDrawer({ processoId, equipeMode = false, onClose, onUpdated }: Props) {
  const [loading, setLoading] = useState(true);
  const [processo, setProcesso] = useState<ProcessoFull | null>(null);
  const [docs, setDocs] = useState<DocRow[]>([]);
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [tab, setTab] = useState<"checklist" | "historico" | "equipe">("checklist");
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingDocId, setPendingDocId] = useState<string | null>(null);
  // Fase 13 — fluxo operacional de análise documental
  const [rejeicao, setRejeicao] = useState<{ docId: string; nome: string } | null>(null);
  const [motivoRejeicao, setMotivoRejeicao] = useState("");
  const [aprovacao, setAprovacao] = useState<{ docId: string; nome: string; divergente: boolean } | null>(null);
  const [salvandoAcao, setSalvandoAcao] = useState(false);
  const [reprocessandoId, setReprocessandoId] = useState<string | null>(null);
  const viewer = useDocumentoViewer();

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const { data: p, error: pErr } = await supabase
        .from("qa_processos")
        .select("id, cliente_id, servico_nome, status, pagamento_status, data_criacao, observacoes_admin, condicao_profissional")
        .eq("id", processoId)
        .maybeSingle();
      if (pErr) throw pErr;
      if (!p) throw new Error("Processo não encontrado");

      const [{ data: cli }, { data: dList, error: dErr }, { data: evs }] = await Promise.all([
        supabase.from("qa_clientes").select("nome_completo, cpf, email").eq("id", p.cliente_id).maybeSingle(),
        supabase.from("qa_processo_documentos").select("*").eq("processo_id", processoId).order("created_at"),
        supabase.from("qa_processo_eventos").select("id, tipo_evento, descricao, ator, created_at").eq("processo_id", processoId).order("created_at", { ascending: false }).limit(100),
      ]);
      if (dErr) throw dErr;

      setProcesso({ ...p, cliente: cli ?? undefined });
      setDocs((dList ?? []) as DocRow[]);
      setEventos((evs ?? []) as Evento[]);
    } catch (e: any) {
      toast.error("Erro ao carregar processo: " + (e?.message ?? "desconhecido"));
    } finally {
      setLoading(false);
    }
  }, [processoId]);

  useEffect(() => { carregar(); }, [carregar]);

  const handleFileSelect = (docId: string) => {
    setPendingDocId(docId);
    // ajusta accept conforme formato_aceito do item
    const doc = docs.find((d) => d.id === docId);
    const fmts: string[] = Array.isArray(doc?.formato_aceito)
      ? (doc!.formato_aceito as string[]).map((f) => String(f).toLowerCase())
      : [];
    let accept = "image/*,application/pdf";
    if (fmts.length > 0) {
      const parts: string[] = [];
      if (fmts.includes("pdf")) parts.push("application/pdf");
      if (fmts.some((f) => ["jpg", "jpeg"].includes(f))) parts.push("image/jpeg");
      if (fmts.includes("png")) parts.push("image/png");
      if (parts.length > 0) accept = parts.join(",");
    }
    if (fileInputRef.current) fileInputRef.current.accept = accept;
    fileInputRef.current?.click();
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const docId = pendingDocId;
    if (!file || !docId || !processo) return;
    e.target.value = "";
    setUploadingId(docId);
    // valida extensão no front antes de subir (UX rápida)
    const docMeta = docs.find((d) => d.id === docId);
    const fmts: string[] = Array.isArray(docMeta?.formato_aceito)
      ? (docMeta!.formato_aceito as string[]).map((f) => String(f).toLowerCase())
      : [];
    const extLocal = (file.name.split(".").pop() || "").toLowerCase();
    if (fmts.length > 0 && !fmts.includes(extLocal)) {
      const msg = fmts.length === 1 && fmts[0] === "pdf"
        ? "Este documento deve ser enviado exclusivamente em PDF."
        : `Formato não aceito. Envie: ${fmts.join(", ").toUpperCase()}.`;
      toast.error(msg);
      setUploadingId(null);
      setPendingDocId(null);
      return;
    }
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "bin";
      const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80);
      const key = `${processo.cliente_id}/${processo.id}/${docId}-${Date.now()}-${safe}`;
      const { error: upErr } = await supabase.storage.from("qa-processo-docs").upload(key, file, {
        contentType: file.type || "application/octet-stream",
        upsert: true,
      });
      if (upErr) throw upErr;

      const { data: sess } = await supabase.auth.getSession();
      const token = sess?.session?.access_token;
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/qa-processo-doc-upload`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          processo_id: processo.id,
          documento_id: docId,
          storage_path: key,
          mime_type: file.type,
          tamanho_bytes: file.size,
          nome_arquivo_original: file.name,
        }),
      });
      if (!resp.ok) {
        const txt = await resp.text();
        throw new Error(txt || "Falha ao registrar upload");
      }
      toast.success("Documento enviado. Validação automática iniciada.");
      await carregar();
      onUpdated?.();
    } catch (err: any) {
      toast.error("Erro no upload: " + (err?.message ?? "desconhecido"));
    } finally {
      setUploadingId(null);
      setPendingDocId(null);
    }
  };

  const equipeSetStatus = async (docId: string, novoStatus: string, motivo?: string) => {
    try {
      const docAtual = docs.find((d) => d.id === docId);
      // ============================================================
      // FASE 14 — IDEMPOTÊNCIA
      // Buscar estado atual no banco (evita usar cache local desatualizado)
      // ============================================================
      const { data: docDb, error: errFetch } = await supabase
        .from("qa_processo_documentos")
        .select("status, motivo_rejeicao, nome_documento, tipo_documento")
        .eq("id", docId)
        .maybeSingle();
      if (errFetch) throw errFetch;
      if (!docDb) throw new Error("Documento não encontrado.");

      const norm = (s?: string | null) => (s ?? "").trim().toUpperCase();
      const motivoNovo = novoStatus === "aprovado" ? null : (motivo ?? null);
      const statusIgual = docDb.status === novoStatus;
      const motivoIgual = norm(docDb.motivo_rejeicao) === norm(motivoNovo);

      // Caso 1: nada mudou — bloquear update e evento
      if (statusIgual && motivoIgual) {
        if (novoStatus === "aprovado") {
          toast.info("Documento já está aprovado.");
        } else if (novoStatus === "invalido") {
          toast.info("Documento já está recusado com este motivo.");
        } else {
          toast.info("Nenhuma alteração detectada.");
        }
        return;
      }

      // Monta payload conforme o que mudou
      const updatePayload: Record<string, any> = {
        data_validacao: new Date().toISOString(),
      };
      if (!statusIgual) updatePayload.status = novoStatus;
      if (!motivoIgual) updatePayload.motivo_rejeicao = motivoNovo;

      const { error } = await supabase
        .from("qa_processo_documentos")
        .update(updatePayload)
        .eq("id", docId);
      if (error) throw error;

      // Evento operacional só se houve mudança real (status ou motivo)
      const tipoOperacional =
        novoStatus === "aprovado" ? "documento_aprovado" :
        novoStatus === "invalido" ? "documento_recusado" :
        novoStatus === "divergente" ? "documento_divergente_marcado" :
        null;
      if (tipoOperacional && (docAtual || docDb)) {
        const nome = docAtual?.nome_documento ?? docDb.nome_documento;
        const tipo = docAtual?.tipo_documento ?? docDb.tipo_documento;
        const descBase = `${nome} (${tipo})`;
        const sufixoMotivo = !statusIgual && motivo
          ? ` — MOTIVO: ${motivo}`
          : statusIgual && !motivoIgual && motivo
          ? ` — MOTIVO ATUALIZADO: ${motivo}`
          : "";
        await supabase.from("qa_processo_eventos").insert({
          processo_id: processoId,
          documento_id: docId,
          tipo_evento: tipoOperacional,
          descricao: descBase + sufixoMotivo,
          ator: "equipe_operacional",
          dados_json: {
            status: novoStatus,
            motivo: motivo ?? null,
            motivo_anterior: docDb.motivo_rejeicao,
            mudou_status: !statusIgual,
            mudou_motivo: !motivoIgual,
          },
        });
      }

      const eventoEmail =
        novoStatus === "aprovado" ? "documento_aprovado" :
        novoStatus === "invalido" ? "documento_invalido" :
        novoStatus === "divergente" ? "documento_divergente" :
        novoStatus === "revisao_humana" ? "revisao_humana" : null;
      // Notifica apenas em mudança real de status (evita reenviar e-mail)
      if (eventoEmail && !statusIgual) {
        supabase.functions.invoke("qa-processo-notificar", {
          body: { processo_id: processoId, documento_id: docId, evento: eventoEmail, motivo },
        }).catch((e) => console.warn("notificação:", e));
      }
      toast.success("Status do documento atualizado.");
      await carregar();
      onUpdated?.();
    } catch (e: any) {
      toast.error("Erro: " + (e?.message ?? "desconhecido"));
    }
  };

  const abrirAprovacao = (doc: DocRow) => {
    setAprovacao({
      docId: doc.id,
      nome: doc.nome_documento,
      divergente: doc.status === "divergente" || (Array.isArray(doc.divergencias_json) && doc.divergencias_json.length > 0),
    });
  };
  const confirmarAprovacao = async () => {
    if (!aprovacao || salvandoAcao) return;
    setSalvandoAcao(true);
    try {
      await equipeSetStatus(aprovacao.docId, "aprovado");
    } finally {
      setSalvandoAcao(false);
      setAprovacao(null);
    }
  };

  const abrirRejeicao = (doc: DocRow) => {
    setMotivoRejeicao("");
    setRejeicao({ docId: doc.id, nome: doc.nome_documento });
  };
  const confirmarRejeicao = async () => {
    if (!rejeicao || salvandoAcao) return;
    const motivo = motivoRejeicao.trim();
    if (!motivo) {
      toast.error("Informe o motivo da recusa.");
      return;
    }
    setSalvandoAcao(true);
    try {
      await equipeSetStatus(rejeicao.docId, "invalido", motivo.toUpperCase());
    } finally {
      setSalvandoAcao(false);
      setRejeicao(null);
      setMotivoRejeicao("");
    }
  };

  const equipeSetProcessoStatus = async (novoStatus: string) => {
    try {
      const { error } = await supabase.from("qa_processos").update({ status: novoStatus }).eq("id", processoId);
      if (error) throw error;
      const eventoEmail =
        novoStatus === "aprovado" ? "documentacao_aprovada" :
        novoStatus === "concluido" ? "processo_concluido" :
        novoStatus === "bloqueado" ? "processo_bloqueado" :
        novoStatus === "em_revisao_humana" ? "revisao_humana" : null;
      if (eventoEmail) {
        supabase.functions.invoke("qa-processo-notificar", {
          body: { processo_id: processoId, evento: eventoEmail },
        }).catch((e) => console.warn("notificação:", e));
      }
      toast.success("Processo atualizado.");
      await carregar();
      onUpdated?.();
    } catch (e: any) {
      toast.error("Erro: " + (e?.message ?? "desconhecido"));
    }
  };

  const baixarArquivo = async (key: string | null, modo: "visualizar" | "baixar" = "visualizar") => {
    if (!key) return;
    const fileName = key.split("/").pop() || "documento";
    if (modo === "visualizar") {
      // Abre dentro do app — sem expor URL do Supabase ao usuário
      viewer.abrirStorage("qa-processo-docs", key, { fileName, title: fileName });
      return;
    }
    try {
      const { data, error } = await supabase.storage
        .from("qa-processo-docs")
        .download(key);
      if (error) throw error;
      const blobUrl = URL.createObjectURL(data);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 4000);
    } catch (e: any) {
      toast.error("Erro ao baixar: " + (e?.message ?? "desconhecido"));
    }
  };

  // ============================================================
  // REPROCESSAR IA — Equipe Quero Armas dispara nova validação para o documento
  // ============================================================
  const reprocessarIA = async (doc: DocRow) => {
    if (!processo) return;
    if (!doc.arquivo_storage_key) {
      toast.error("Documento sem arquivo enviado.");
      return;
    }
    setReprocessandoId(doc.id);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess?.session?.access_token;
      // Reseta estado da IA antes de re-disparar (não apaga arquivo)
      await supabase.from("qa_processo_documentos").update({
        status: "em_analise",
        validacao_ia_status: "fila",
        validacao_ia_erro: null,
        motivo_rejeicao: null,
      }).eq("id", doc.id);

      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/qa-processo-doc-validar-ia`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            processo_id: processo.id,
            documento_id: doc.id,
            storage_path: doc.arquivo_storage_key,
          }),
        },
      );
      const txt = await resp.text();
      if (!resp.ok) throw new Error(txt || "Falha ao reprocessar");
      await supabase.from("qa_processo_eventos").insert({
        processo_id: processo.id,
        documento_id: doc.id,
        tipo_evento: "documento_reprocessado",
        descricao: `Equipe Quero Armas reprocessou validação de ${doc.nome_documento}.`,
        ator: "equipe_operacional",
      });
      toast.success("Documento reprocessado.");
      await carregar();
      onUpdated?.();
    } catch (e: any) {
      toast.error("Erro ao reprocessar: " + (e?.message ?? "desconhecido"));
    } finally {
      setReprocessandoId(null);
    }
  };

  // ============================================================
  // FASE 4 — Aplicar manualmente um valor sugerido pela IA
  // (quando há conflito com dado já cadastrado do cliente).
  // Por padrão mantemos o valor do cliente; este handler é opcional
  // e exige clique humano. Faz update direto em qa_clientes e remove
  // o conflito do campos_complementares_json do documento.
  // ============================================================
  const aplicarConflitoIA = async (doc: DocRow, conflito: any) => {
    if (!processo || !conflito?.campo) return;
    const campo = String(conflito.campo);
    const valorIA = conflito.valor_ia ?? conflito.valor_extraido ?? null;
    const valorAtual = conflito.valor_cliente ?? "";
    const ok = window.confirm(
      `ATENÇÃO: SOBRESCREVER MANUALMENTE\n\nCampo: ${campo}\nValor atual no cadastro: ${valorAtual || "—"}\nValor extraído pela IA: ${valorIA || "—"}\n\nDeseja substituir o valor do cadastro pelo valor extraído pela IA?`
    );
    if (!ok) return;
    try {
      const { error: upErr } = await supabase
        .from("qa_clientes")
        .update({ [campo]: valorIA } as any)
        .eq("id", processo.cliente_id);
      if (upErr) throw upErr;

      // Remove o conflito da lista no documento
      const compl = (doc.campos_complementares_json && typeof doc.campos_complementares_json === "object")
        ? { ...(doc.campos_complementares_json as any) }
        : {};
      const lista: any[] = Array.isArray(compl.conflitos_reconciliacao) ? compl.conflitos_reconciliacao : [];
      compl.conflitos_reconciliacao = lista.filter((c: any) => c?.campo !== campo);
      compl.conflitos_resolvidos = [
        ...(Array.isArray(compl.conflitos_resolvidos) ? compl.conflitos_resolvidos : []),
        { campo, valor_anterior: valorAtual, valor_novo: valorIA, resolvido_em: new Date().toISOString(), acao: "aplicado_manualmente_operador" },
      ];
      await supabase.from("qa_processo_documentos")
        .update({ campos_complementares_json: compl })
        .eq("id", doc.id);

      await supabase.from("qa_processo_eventos").insert({
        processo_id: processoId,
        documento_id: doc.id,
        tipo_evento: "reconciliacao_conflito_resolvido",
        descricao: `Operador aplicou valor da IA no campo "${campo}" do cliente.`,
        ator: "equipe_operacional",
        dados_json: { campo, valor_anterior: valorAtual, valor_novo: valorIA, origem: "operador_manual" },
      });
      toast.success("Valor atualizado no cadastro do cliente.");
      await carregar();
      onUpdated?.();
    } catch (e: any) {
      toast.error("Erro ao aplicar valor: " + (e?.message ?? "desconhecido"));
    }
  };

  const [savingCond, setSavingCond] = useState<string | null>(null);
  const [confirmandoPagto, setConfirmandoPagto] = useState(false);

  const confirmarPagamentoManual = async () => {
    if (!processo) return;
    const ok = window.confirm(
      "Confirmar manualmente o pagamento deste processo? Após confirmar, o checklist documental será liberado ao cliente."
    );
    if (!ok) return;
    setConfirmandoPagto(true);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess?.session?.access_token;
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/qa-processo-confirmar-pagamento`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ processo_id: processo.id }),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(data?.error || "Falha ao confirmar pagamento");
      if (data?.ja_estava_confirmado) {
        toast.message("Pagamento já estava confirmado.");
      } else {
        toast.success("Pagamento confirmado manualmente. Checklist documental liberado.");
      }
      await carregar();
      onUpdated?.();
    } catch (e: any) {
      toast.error("Erro ao confirmar pagamento: " + (e?.message ?? "desconhecido"));
    } finally {
      setConfirmandoPagto(false);
    }
  };

  const setCondicao = async (cond: "clt" | "autonomo" | "empresario" | "aposentado" | "funcionario_publico") => {
    if (!processo) return;
    setSavingCond(cond);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess?.session?.access_token;
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/qa-processo-set-condicao`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ processo_id: processo.id, condicao_profissional: cond }),
      });
      if (!resp.ok) {
        const txt = await resp.text();
        throw new Error(txt || "Falha ao salvar condição");
      }
      toast.success("Condição profissional registrada. Checklist de renda atualizado.");
      await carregar();
      onUpdated?.();
    } catch (e: any) {
      toast.error("Erro: " + (e?.message ?? "desconhecido"));
    } finally {
      setSavingCond(null);
    }
  };

  const st = processo ? getStatusProcesso(processo.status) : null;
  const aguardandoPagto = processo?.pagamento_status === "aguardando";

  // ============================================================================
  // PROGRESSO DOCUMENTAL — fonte única de verdade
  // Considera TODOS os documentos exigidos no checklist (obrigatórios e
  // complementares), não apenas a condição profissional. O item técnico
  // "renda_definir_condicao" é apenas seletor e fica fora do cálculo.
  // Cumprido = aprovado OU dispensado_grupo (grupo alternativo satisfeito,
  // o que cobre também o caso de documento substituto formal aceito).
  // Em análise / pendente / inválido / divergente / revisão NÃO contam.
  // ============================================================================
  const docsChecklist = docs.filter((d) => d.tipo_documento !== "renda_definir_condicao");
  const totalExigencias = docsChecklist.length;
  const isCumprido = (d: DocRow) => d.status === "aprovado" || d.status === "dispensado_grupo";
  const isEmAnalise = (d: DocRow) =>
    d.status === "em_analise" || d.status === "revisao_humana" || d.status === "enviado";
  const isPendenciaCliente = (d: DocRow) =>
    d.status === "pendente" || d.status === "invalido" || d.status === "divergente";
  const cumpridos = docsChecklist.filter(isCumprido).length;
  const progresso = totalExigencias > 0 ? Math.round((cumpridos / totalExigencias) * 100) : 0;

  const docsPendencias = docsChecklist.filter(isPendenciaCliente);
  const docsAnalise = docsChecklist.filter(isEmAnalise);
  const docsCumpridos = docsChecklist.filter(isCumprido);
  const docsOutros = docsChecklist.filter(
    (d) => !isCumprido(d) && !isEmAnalise(d) && !isPendenciaCliente(d)
  ); // fallback defensivo (status novos/desconhecidos)

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative ml-auto w-full max-w-3xl h-full bg-slate-50 shadow-2xl flex flex-col overflow-hidden">
        <input ref={fileInputRef} type="file" className="hidden" onChange={handleUpload} accept="image/*,application/pdf" />

        {/* Header */}
        <div className="px-5 py-4 bg-white border-b border-slate-200 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-[0.14em] font-bold text-slate-500">PROCESSO</div>
            <h2 className="text-lg md:text-xl font-bold text-slate-900 uppercase truncate">{processo?.servico_nome ?? "—"}</h2>
            <div className="text-xs text-slate-500 mt-0.5 uppercase">
              {processo?.cliente?.nome_completo} · {processo?.cliente?.cpf}
            </div>
          </div>
          <button onClick={onClose} className="h-9 w-9 rounded-lg border border-slate-200 hover:bg-slate-50 flex items-center justify-center">
            <X className="h-4 w-4 text-slate-600" />
          </button>
        </div>

        {/* Status bar */}
        {st && (
          <div className={`px-5 py-3 border-b border-slate-200 ${st.bg}`}>
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4" style={{ color: st.color }} />
                <span className={`text-xs font-bold uppercase tracking-wider ${st.text}`}>{st.label}</span>
              </div>
              {!aguardandoPagto && (
                <div className="flex items-center gap-3">
                  <span className="text-[10px] uppercase tracking-wider font-bold text-slate-600">PROGRESSO {progresso}%</span>
                  <div className="w-32 h-1.5 bg-white/60 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{ width: `${progresso}%`, background: st.color }} />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex border-b border-slate-200 bg-white">
          <TabBtn active={tab === "checklist"} onClick={() => setTab("checklist")} icon={<FileText className="h-3.5 w-3.5" />} label="CHECKLIST" />
          <TabBtn active={tab === "historico"} onClick={() => setTab("historico")} icon={<History className="h-3.5 w-3.5" />} label="HISTÓRICO" />
          {equipeMode && <TabBtn active={tab === "equipe"} onClick={() => setTab("equipe")} icon={<ShieldAlert className="h-3.5 w-3.5" />} label="EQUIPE" />}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5">
          {loading ? (
            <div className="text-center py-12 text-xs uppercase tracking-wider text-slate-400">CARREGANDO...</div>
          ) : tab === "checklist" ? (
            aguardandoPagto ? (
              <div className="rounded-xl border border-blue-200 bg-blue-50 p-5">
                <div className="text-[11px] uppercase tracking-wider font-bold text-blue-800">
                  AGUARDANDO CONFIRMAÇÃO DE PAGAMENTO
                </div>
                <p className="mt-2 text-sm text-blue-900/90 leading-relaxed">
                  Cadastro recebido. Nossa Equipe Operacional validará os dados e confirmará o pagamento manualmente.
                  Após a confirmação, o checklist documental será liberado.
                </p>
                {equipeMode && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      onClick={confirmarPagamentoManual}
                      disabled={confirmandoPagto}
                      className="inline-flex items-center gap-2 rounded-lg bg-blue-700 hover:bg-blue-800 disabled:opacity-60 text-white text-xs font-bold uppercase tracking-wider px-4 py-2"
                    >
                      <CheckCircle className="h-4 w-4" />
                      {confirmandoPagto ? "Confirmando..." : "Confirmar pagamento manualmente"}
                    </button>
                    <span className="text-[10px] uppercase tracking-wider text-blue-700/70 self-center">
                      Ação restrita à Equipe Operacional
                    </span>
                  </div>
                )}
              </div>
            ) : (
            <div className="space-y-3">
              <CondicaoProfissionalCard
                condicao={processo?.condicao_profissional ?? null}
                indefinida={
                  !processo?.condicao_profissional ||
                  processo.condicao_profissional === "indefinido" ||
                  docs.some((d) => d.tipo_documento === "renda_definir_condicao")
                }
                saving={savingCond}
                onSelect={setCondicao}
              />
              {docs.length === 0 && <div className="text-xs uppercase text-slate-400 text-center py-8">NENHUM DOCUMENTO NESTE CHECKLIST</div>}
              {docs
                .filter((doc) => doc.tipo_documento !== "renda_definir_condicao")
                .map((doc) => {
                const ds = getStatusDocumento(doc.status, doc.validacao_ia_status);
                const labelBotao: string | null = (doc.regra_validacao && typeof doc.regra_validacao === "object" && typeof doc.regra_validacao.label_botao === "string")
                  ? doc.regra_validacao.label_botao : null;
                const checklistOperador: string[] = (doc.regra_validacao && typeof doc.regra_validacao === "object" && Array.isArray((doc.regra_validacao as any).checklist_operador))
                  ? (doc.regra_validacao as any).checklist_operador as string[] : [];
                const div = Array.isArray(doc.divergencias_json) ? doc.divergencias_json : [];
                const ext = doc.dados_extraidos_json && typeof doc.dados_extraidos_json === "object" ? doc.dados_extraidos_json : null;
                return (
                  <div key={doc.id} className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                    <div className="px-4 py-3 flex items-start justify-between gap-3 border-b border-slate-100">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[10px] uppercase tracking-wider font-bold text-slate-400">{doc.etapa}</span>
                          {doc.obrigatorio && <span className="text-[9px] uppercase font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">OBRIGATÓRIO</span>}
                        </div>
                        <div className="font-bold text-sm text-slate-800 uppercase mt-0.5">{doc.nome_documento}</div>
                      </div>
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider whitespace-nowrap" style={{ background: `${ds.color}15`, color: ds.color, border: `1px solid ${ds.color}40` }}>
                        {ds.label}
                      </span>
                    </div>

                    {/* Detalhes */}
                    <div className="px-4 py-3 space-y-2">
                      {/* Fase 12 — Orientação ao cliente (apenas campos preenchidos) */}
                      {(doc.instrucoes || doc.observacoes_cliente) && (
                        <div className="rounded-md border border-blue-200 bg-blue-50/60 p-2.5">
                          <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-bold text-blue-800">
                            <Info className="h-3 w-3" /> COMO OBTER ESTE DOCUMENTO
                          </div>
                          {doc.instrucoes && (
                            <p className="mt-1 text-[12px] leading-relaxed text-blue-900/90 whitespace-pre-line">
                              {doc.instrucoes}
                            </p>
                          )}
                          {doc.observacoes_cliente && (
                            <p className="mt-1.5 text-[11px] leading-relaxed text-blue-900/80 italic">
                              {doc.observacoes_cliente}
                            </p>
                          )}
                        </div>
                      )}

                      {/* Checklist do Operador — exclusivo Equipe Quero Armas */}
                      {equipeMode && checklistOperador.length > 0 && (
                        <div className="rounded-md border border-slate-300 bg-slate-50 p-2.5">
                          <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-bold text-slate-700">
                            <ShieldAlert className="h-3 w-3" /> CHECKLIST DO OPERADOR
                          </div>
                          <ul className="mt-1.5 space-y-1">
                            {checklistOperador.map((item, i) => (
                              <li key={i} className="text-[11px] text-slate-800 leading-snug flex items-start gap-1.5">
                                <span className="text-slate-400 mt-0.5">▢</span>
                                <span>{item}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Grupo alternativo — orientação clara quando aplicável */}
                      {doc.regra_validacao && typeof doc.regra_validacao === "object" && doc.regra_validacao.grupo_documental && doc.status !== "aprovado" && doc.status !== "dispensado_grupo" && (
                        <div className="rounded-md border border-slate-200 bg-slate-50 p-2 text-[11px] text-slate-700 inline-flex items-start gap-1.5">
                          <Layers className="h-3 w-3 mt-0.5 text-slate-500 shrink-0" />
                          <span>
                            <strong className="uppercase tracking-wider text-[10px] text-slate-600">ALTERNATIVA:</strong>{" "}
                            envie 1 dos documentos aceitos deste grupo. Após aprovação de qualquer um, os demais ficam dispensados.
                          </span>
                        </div>
                      )}

                      {/* Metadados leves — órgão, prazo recomendado, modelo, exemplo */}
                      {(doc.orgao_emissor || doc.prazo_recomendado_dias || doc.modelo_url || doc.exemplo_url) && (
                        <div className="flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-wider">
                          {doc.orgao_emissor && (
                            <span className="px-2 py-0.5 rounded bg-slate-100 border border-slate-200 text-slate-700 font-bold inline-flex items-center gap-1">
                              <Building2 className="h-3 w-3" /> ÓRGÃO: {doc.orgao_emissor}
                            </span>
                          )}
                          {doc.prazo_recomendado_dias != null && (
                            <span className="px-2 py-0.5 rounded bg-slate-100 border border-slate-200 text-slate-700 font-bold inline-flex items-center gap-1">
                              <CalendarClock className="h-3 w-3" /> PRAZO RECOMENDADO: {doc.prazo_recomendado_dias} DIAS
                            </span>
                          )}
                          {doc.modelo_url && (
                            <a
                              href={doc.modelo_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-2 py-0.5 rounded bg-emerald-50 border border-emerald-200 text-emerald-800 font-bold inline-flex items-center gap-1 hover:bg-emerald-100"
                            >
                              <FileDown className="h-3 w-3" /> BAIXAR MODELO
                            </a>
                          )}
                          {doc.exemplo_url && (
                            <a
                              href={doc.exemplo_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-2 py-0.5 rounded bg-violet-50 border border-violet-200 text-violet-800 font-bold inline-flex items-center gap-1 hover:bg-violet-100"
                            >
                              <BookOpen className="h-3 w-3" /> VER EXEMPLO
                            </a>
                          )}
                        </div>
                      )}

                      {/* Validade e link de emissão */}
                      {(doc.validade_dias || doc.data_validade || doc.link_emissao) && (
                        <div className="flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-wider">
                          {doc.validade_dias != null && (
                            <span className="px-2 py-0.5 rounded bg-slate-100 border border-slate-200 text-slate-600 font-bold">
                              VALIDADE: {doc.validade_dias} DIAS
                            </span>
                          )}
                          {doc.data_validade && (
                            <span className="px-2 py-0.5 rounded bg-amber-50 border border-amber-200 text-amber-800 font-bold">
                              VENCE EM {formatDate(doc.data_validade)}
                            </span>
                          )}
                          {doc.link_emissao && doc.status !== "aprovado" && (
                            <a
                              href={doc.link_emissao}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-2 py-0.5 rounded bg-blue-50 border border-blue-200 text-blue-700 font-bold inline-flex items-center gap-1 hover:bg-blue-100"
                            >
                              <ExternalLink className="h-3 w-3" /> {labelBotao ? labelBotao.toUpperCase() : "EMITIR ONLINE"}
                            </a>
                          )}
                        </div>
                      )}
                      {doc.motivo_rejeicao && (
                        <div className="text-[11px] bg-red-50 border border-red-200 rounded-md p-2 text-red-800">
                          <strong className="uppercase tracking-wider">MOTIVO:</strong> {doc.motivo_rejeicao}
                        </div>
                      )}
                      {/* FASE 4 — Orientações ao cliente (vindas da IA) */}
                      {(() => {
                        const compl = (doc.campos_complementares_json && typeof doc.campos_complementares_json === "object")
                          ? doc.campos_complementares_json as any : null;
                        const orient = compl?.orientacoes_cliente;
                        if (!orient || typeof orient !== "string" || orient.trim().length === 0) return null;
                        return (
                          <div className="text-[11px] bg-amber-50 border border-amber-200 rounded-md p-2 text-amber-900">
                            <div className="inline-flex items-center gap-1.5 font-bold uppercase tracking-wider text-amber-800">
                              <Info className="h-3 w-3" /> O QUE PRECISA CORRIGIR
                            </div>
                            <p className="mt-1 leading-relaxed whitespace-pre-line">{orient}</p>
                          </div>
                        );
                      })()}
                      {div.length > 0 && (
                        <div className={`text-[11px] rounded-md p-2 ${doc.status === "divergente" ? "bg-amber-100 border-2 border-amber-400" : "bg-amber-50 border border-amber-200"}`}>
                          <div className="font-bold uppercase tracking-wider text-amber-800 mb-1 inline-flex items-center gap-1">
                            <AlertTriangle className="h-3 w-3" /> DIVERGÊNCIAS DETECTADAS
                          </div>
                          <ul className="space-y-0.5 text-amber-900">
                            {div.slice(0, 5).map((d: any, i: number) => (
                              <li key={i}>• <strong>{d.campo}:</strong> esperado "{d.esperado}", encontrado "{d.encontrado}"</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {ext && Object.keys(ext).length > 0 && (
                        <details className="text-[11px] text-slate-700 rounded-md border border-slate-200 bg-white">
                          <summary className="cursor-pointer px-2.5 py-1.5 uppercase tracking-wider font-bold text-slate-600 inline-flex items-center gap-1.5">
                            <Sparkles className="h-3 w-3 text-amber-500" /> DADOS EXTRAÍDOS AUTOMATICAMENTE
                          </summary>
                          <div className="border-t border-slate-100 p-2.5 space-y-1">
                            {Object.entries(ext).filter(([k, v]) => v !== null && v !== "" && k !== "_meta").map(([k, v]) => (
                              <div key={k} className="grid grid-cols-[140px_1fr] gap-2 items-start">
                                <div className="text-[10px] uppercase tracking-wider font-bold text-slate-500 truncate">{k}</div>
                                <div className="text-[11px] text-slate-800 break-words">{typeof v === "object" ? JSON.stringify(v) : String(v)}</div>
                              </div>
                            ))}
                          </div>
                        </details>
                      )}

                      {/* FASE 4 — Endereço em nome de terceiro */}
                      {doc.endereco_em_nome_de_terceiro && (
                        <div className="rounded-md border border-violet-200 bg-violet-50/70 p-2.5">
                          <div className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-bold text-violet-800">
                            <Home className="h-3 w-3" /> ENDEREÇO EM NOME DE TERCEIRO
                          </div>
                          <div className="mt-1.5 text-[11px] text-violet-900/90 leading-relaxed">
                            {doc.titular_comprovante_nome && (
                              <div><strong className="uppercase">TITULAR:</strong> {doc.titular_comprovante_nome}</div>
                            )}
                            {doc.titular_comprovante_documento && (
                              <div><strong className="uppercase">DOCUMENTO:</strong> {doc.titular_comprovante_documento}</div>
                            )}
                            <div className="mt-1 italic text-violet-800/80">
                              Será necessária declaração do responsável pelo imóvel em etapa futura.
                            </div>
                          </div>
                        </div>
                      )}

                      {/* FASE 4 — Metadados do documento */}
                      {doc.metadados_documento_json && typeof doc.metadados_documento_json === "object" && Object.keys(doc.metadados_documento_json).length > 0 && (
                        <details className="text-[11px] text-slate-600 rounded-md border border-slate-200 bg-white">
                          <summary className="cursor-pointer px-2.5 py-1.5 uppercase tracking-wider font-bold text-slate-500 inline-flex items-center gap-1.5">
                            <Database className="h-3 w-3 text-slate-500" /> METADADOS DO DOCUMENTO
                          </summary>
                          <pre className="mt-0 border-t border-slate-100 p-2 text-[10px] bg-slate-50 overflow-x-auto">{JSON.stringify(doc.metadados_documento_json, null, 2)}</pre>
                        </details>
                      )}

                      {/* FASE 4 — Campos complementares (sem coluna fixa) */}
                      {doc.campos_complementares_json && typeof doc.campos_complementares_json === "object" && (() => {
                        const compl = doc.campos_complementares_json as any;
                        const extras = Object.entries(compl).filter(([k]) => k !== "conflitos_reconciliacao" && k !== "conflitos_resolvidos");
                        if (extras.length === 0) return null;
                        return (
                          <details className="text-[11px] text-slate-600 rounded-md border border-slate-200 bg-white">
                            <summary className="cursor-pointer px-2.5 py-1.5 uppercase tracking-wider font-bold text-slate-500 inline-flex items-center gap-1.5">
                              <Layers className="h-3 w-3 text-slate-500" /> CAMPOS COMPLEMENTARES
                            </summary>
                            <div className="border-t border-slate-100 p-2.5 space-y-1">
                              {extras.map(([k, v]) => (
                                <div key={k} className="grid grid-cols-[160px_1fr] gap-2 items-start">
                                  <div className="text-[10px] uppercase tracking-wider font-bold text-slate-500 truncate">{k}</div>
                                  <div className="text-[11px] text-slate-800 break-words">{typeof v === "object" ? JSON.stringify(v) : String(v ?? "—")}</div>
                                </div>
                              ))}
                            </div>
                          </details>
                        );
                      })()}

                      {/* FASE 4 — Conflitos de reconciliação (cliente vs IA) */}
                      {(() => {
                        const compl = (doc.campos_complementares_json && typeof doc.campos_complementares_json === "object")
                          ? doc.campos_complementares_json as any : null;
                        const conflitos: any[] = compl && Array.isArray(compl.conflitos_reconciliacao) ? compl.conflitos_reconciliacao : [];
                        if (conflitos.length === 0) return null;
                        return (
                          <div className="rounded-md border border-orange-300 bg-orange-50/70 p-2.5">
                            <div className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-bold text-orange-800">
                              <GitCompareArrows className="h-3 w-3" /> CONFLITOS DETECTADOS — CADASTRO PRESERVADO
                            </div>
                            <ul className="mt-1.5 space-y-2">
                              {conflitos.map((c: any, i: number) => (
                                <li key={i} className="text-[11px] bg-white border border-orange-200 rounded p-2">
                                  <div className="font-bold uppercase tracking-wider text-slate-700">{c.campo ?? "—"}</div>
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5 mt-1">
                                    <div className="rounded bg-emerald-50 border border-emerald-200 p-1.5">
                                      <div className="text-[9px] uppercase tracking-wider font-bold text-emerald-700">VALOR DO CLIENTE (MANTIDO)</div>
                                      <div className="text-emerald-900 break-words">{String(c.valor_cliente ?? "—")}</div>
                                    </div>
                                    <div className="rounded bg-amber-50 border border-amber-200 p-1.5">
                                      <div className="text-[9px] uppercase tracking-wider font-bold text-amber-700">VALOR EXTRAÍDO PELA IA</div>
                                      <div className="text-amber-900 break-words">{String(c.valor_ia ?? c.valor_extraido ?? "—")}</div>
                                    </div>
                                  </div>
                                  {equipeMode && (
                                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                                      <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">PADRÃO: MANTER VALOR ATUAL</span>
                                      <button
                                        onClick={() => aplicarConflitoIA(doc, c)}
                                        className="h-7 px-2.5 inline-flex items-center gap-1 rounded border border-amber-400 bg-white text-[10px] uppercase tracking-wider font-bold text-amber-800 hover:bg-amber-50"
                                      >
                                        ATUALIZAR MANUALMENTE COM VALOR DA IA
                                      </button>
                                    </div>
                                  )}
                                </li>
                              ))}
                            </ul>
                          </div>
                        );
                      })()}
                      {doc.validacao_ia_confianca !== null && (
                        <div className="text-[10px] uppercase tracking-wider text-slate-400">
                          IA: {doc.validacao_ia_modelo ?? "—"} · CONFIANÇA {Math.round((doc.validacao_ia_confianca ?? 0) * 100)}%
                        </div>
                      )}
                    </div>

                    {/* Ações por status do documento */}
                    {doc.status === "dispensado_grupo" ? (
                      <div className="px-4 py-3 bg-slate-50 border-t border-slate-100">
                        <div className="text-[11px] text-slate-600 leading-relaxed">
                          <span className="font-bold uppercase tracking-wider text-slate-700">DISPENSADO PELA EQUIPE QUERO ARMAS.</span>{" "}
                          Outro documento do mesmo grupo já satisfaz esta exigência. Nenhuma ação necessária.
                        </div>
                      </div>
                    ) : (
                      <div className="px-4 py-3 bg-slate-50 border-t border-slate-100 flex flex-wrap items-center gap-2">
                        {/* Visualizar/Baixar — só se houver arquivo enviado */}
                        {doc.arquivo_storage_key && (
                          <>
                            <button
                              onClick={() => baixarArquivo(doc.arquivo_storage_key, "visualizar")}
                              className="h-8 px-3 inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white text-[11px] uppercase tracking-wider font-bold text-slate-700 hover:bg-slate-100"
                            >
                              <Eye className="h-3 w-3" /> VISUALIZAR
                            </button>
                            <button
                              onClick={() => baixarArquivo(doc.arquivo_storage_key, "baixar")}
                              className="h-8 px-3 inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white text-[11px] uppercase tracking-wider font-bold text-slate-700 hover:bg-slate-100"
                            >
                              <Download className="h-3 w-3" /> BAIXAR
                            </button>
                          </>
                        )}

                        {/* Cliente/equipe: enviar / substituir conforme estado */}
                        {doc.status !== "aprovado" && (
                          <button
                            disabled={uploadingId === doc.id}
                            onClick={() => handleFileSelect(doc.id)}
                            className="h-8 px-3 inline-flex items-center gap-1.5 rounded-md text-[11px] uppercase tracking-wider font-bold text-white disabled:opacity-50"
                            style={{
                              background:
                                doc.status === "invalido" || doc.status === "divergente"
                                  ? "#EF4444"
                                  : doc.arquivo_storage_key
                                  ? "#0EA5E9"
                                  : "#10B981",
                            }}
                          >
                            <Upload className="h-3 w-3" />
                            {uploadingId === doc.id
                              ? "ENVIANDO..."
                              : doc.status === "invalido" || doc.status === "divergente"
                              ? "SUBSTITUIR DOCUMENTO"
                              : doc.arquivo_storage_key
                              ? "SUBSTITUIR DOCUMENTO"
                              : "ENVIAR DOCUMENTO"}
                          </button>
                        )}

                        {/* Equipe Quero Armas: aprovar/rejeitar */}
                        {equipeMode && doc.status !== "aprovado" && (
                          <button onClick={() => abrirAprovacao(doc)} className="h-8 px-3 inline-flex items-center gap-1.5 rounded-md text-[11px] uppercase tracking-wider font-bold text-white bg-emerald-500 hover:bg-emerald-600">
                            <CheckCircle className="h-3 w-3" /> APROVAR
                          </button>
                        )}
                        {equipeMode && doc.status !== "invalido" && (
                          <button onClick={() => abrirRejeicao(doc)} className="h-8 px-3 inline-flex items-center gap-1.5 rounded-md text-[11px] uppercase tracking-wider font-bold text-white bg-red-500 hover:bg-red-600">
                            <XCircle className="h-3 w-3" /> REJEITAR
                          </button>
                        )}
                        {equipeMode && doc.arquivo_storage_key && (
                          <button
                            onClick={() => reprocessarIA(doc)}
                            disabled={reprocessandoId === doc.id}
                            className="h-8 px-3 inline-flex items-center gap-1.5 rounded-md text-[11px] uppercase tracking-wider font-bold text-white bg-slate-700 hover:bg-slate-800 disabled:opacity-50"
                          >
                            <RefreshCw className={`h-3 w-3 ${reprocessandoId === doc.id ? "animate-spin" : ""}`} />
                            {reprocessandoId === doc.id ? "REPROCESSANDO..." : "REPROCESSAR IA"}
                          </button>
                        )}
                        {equipeMode && doc.status === "aprovado" && doc.arquivo_storage_key && !doc.usado_como_modelo && (
                          <button
                            onClick={async () => {
                              try {
                                const { data, error } = await supabase.functions.invoke("qa-modelo-aprovado-criar", {
                                  body: { documento_id: doc.id },
                                });
                                if (error) throw error;
                                if ((data as any)?.error) throw new Error((data as any).error);
                                toast.success("Documento promovido a modelo aprovado.");
                                await carregar();
                              } catch (e: any) {
                                toast.error("Erro ao promover modelo: " + (e?.message ?? "desconhecido"));
                              }
                            }}
                            className="h-8 px-3 inline-flex items-center gap-1.5 rounded-md text-[11px] uppercase tracking-wider font-bold text-white bg-amber-600 hover:bg-amber-700"
                            title="Usar este documento como exemplo aprovado para a IA aprender"
                          >
                            <BookOpen className="h-3 w-3" /> APROVAR COMO MODELO
                          </button>
                        )}
                        {equipeMode && doc.usado_como_modelo && (
                          <span className="h-8 px-3 inline-flex items-center gap-1.5 rounded-md text-[11px] uppercase tracking-wider font-bold text-amber-700 bg-amber-100 border border-amber-300">
                            <BookOpen className="h-3 w-3" /> MODELO APROVADO
                          </span>
                        )}
                        {equipeMode && doc.score_modelo_aprovado != null && (
                          <span className="h-8 px-2 inline-flex items-center gap-1 rounded-md text-[10px] uppercase tracking-wider font-mono text-slate-700 bg-slate-100 border border-slate-300">
                            SIM. MODELO {(Number(doc.score_modelo_aprovado) * 100).toFixed(0)}%
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            )
          ) : tab === "historico" ? (
            <div className="space-y-2">
              {eventos.length === 0 && <div className="text-xs uppercase text-slate-400 text-center py-8">SEM EVENTOS REGISTRADOS</div>}
              {eventos.map((ev) => (
                <div key={ev.id} className="bg-white border border-slate-200 rounded-lg px-4 py-2.5">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[10px] uppercase tracking-wider font-bold text-slate-500">{ev.tipo_evento.replace(/_/g, " ")}</span>
                    <span className="text-[10px] text-slate-400">{formatDateTime(ev.created_at)}</span>
                  </div>
                  {ev.descricao && <div className="text-xs text-slate-700 mt-1 uppercase">{ev.descricao}</div>}
                  {ev.ator && <div className="text-[10px] text-slate-400 mt-0.5 uppercase">POR: {ev.ator}</div>}
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              <div className="bg-white border border-slate-200 rounded-xl p-4">
                <h4 className="text-[11px] uppercase tracking-[0.14em] font-bold text-slate-500 mb-3">ALTERAR STATUS DO PROCESSO</h4>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {Object.entries(STATUS_PROCESSO).map(([k, v]) => (
                    <button
                      key={k}
                      onClick={() => equipeSetProcessoStatus(k)}
                      disabled={processo?.status === k}
                      className={`h-9 px-3 rounded-md text-[10px] uppercase tracking-wider font-bold border ${processo?.status === k ? `${v.bg} ${v.text} ${v.border}` : "border-slate-200 text-slate-700 hover:bg-slate-50 bg-white"} disabled:cursor-not-allowed`}
                    >
                      {v.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Documentos do processo — gestão direta pela Equipe Quero Armas */}
              <div className="bg-white border border-slate-200 rounded-xl p-4">
                <h4 className="text-[11px] uppercase tracking-[0.14em] font-bold text-slate-500 mb-3">
                  DOCUMENTOS DO PROCESSO ({docs.length})
                </h4>
                {docs.length === 0 ? (
                  <div className="text-[11px] uppercase text-slate-400">NENHUM DOCUMENTO REGISTRADO.</div>
                ) : (
                  <ul className="divide-y divide-slate-100">
                    {docs.map((doc) => {
                      const ds = getStatusDocumento(doc.status, doc.validacao_ia_status);
                      return (
                        <li key={doc.id} className="py-2.5 flex flex-wrap items-center gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="text-[11px] font-bold uppercase text-slate-800 truncate">
                              {doc.nome_documento}
                            </div>
                            <div className="text-[10px] uppercase tracking-wider text-slate-400 truncate">
                              {doc.tipo_documento} · {doc.etapa}
                            </div>
                            {doc.motivo_rejeicao && (
                              <div className="text-[10px] text-red-700 mt-0.5 leading-snug">
                                MOTIVO: {doc.motivo_rejeicao}
                              </div>
                            )}
                          </div>
                          <span
                            className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider whitespace-nowrap"
                            style={{ background: `${ds.color}15`, color: ds.color, border: `1px solid ${ds.color}40` }}
                          >
                            {ds.label}
                          </span>
                          {doc.arquivo_storage_key && (
                            <>
                              <button
                                onClick={() => baixarArquivo(doc.arquivo_storage_key, "visualizar")}
                                className="h-7 px-2 inline-flex items-center gap-1 rounded border border-slate-200 bg-white text-[10px] uppercase tracking-wider font-bold text-slate-700 hover:bg-slate-100"
                              >
                                <Eye className="h-3 w-3" /> VER
                              </button>
                              <button
                                onClick={() => baixarArquivo(doc.arquivo_storage_key, "baixar")}
                                className="h-7 px-2 inline-flex items-center gap-1 rounded border border-slate-200 bg-white text-[10px] uppercase tracking-wider font-bold text-slate-700 hover:bg-slate-100"
                              >
                                <Download className="h-3 w-3" /> BAIXAR
                              </button>
                              <button
                                onClick={() => reprocessarIA(doc)}
                                disabled={reprocessandoId === doc.id}
                                className="h-7 px-2 inline-flex items-center gap-1 rounded text-[10px] uppercase tracking-wider font-bold text-white bg-slate-700 hover:bg-slate-800 disabled:opacity-50"
                              >
                                <RefreshCw className={`h-3 w-3 ${reprocessandoId === doc.id ? "animate-spin" : ""}`} />
                                {reprocessandoId === doc.id ? "..." : "REPROCESSAR"}
                              </button>
                            </>
                          )}
                          {doc.status !== "aprovado" && (
                            <button
                              onClick={() => abrirAprovacao(doc)}
                              className="h-7 px-2 inline-flex items-center gap-1 rounded text-[10px] uppercase tracking-wider font-bold text-white bg-emerald-500 hover:bg-emerald-600"
                            >
                              <CheckCircle className="h-3 w-3" /> APROVAR
                            </button>
                          )}
                          {doc.status !== "invalido" && (
                            <button
                              onClick={() => abrirRejeicao(doc)}
                              className="h-7 px-2 inline-flex items-center gap-1 rounded text-[10px] uppercase tracking-wider font-bold text-white bg-red-500 hover:bg-red-600"
                            >
                              <XCircle className="h-3 w-3" /> REJEITAR
                            </button>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>

              <div className="text-[10px] uppercase tracking-wider text-slate-400">
                ID: {processo?.id} · CRIADO: {formatDateTime(processo?.data_criacao)}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal — Confirmar APROVAÇÃO */}
      {aprovacao && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60">
          <div className="w-full max-w-md bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-emerald-600" />
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-800">CONFIRMAR APROVAÇÃO</h3>
            </div>
            <div className="px-5 py-4 space-y-3">
              <p className="text-xs text-slate-700 uppercase tracking-wide">
                Documento: <strong>{aprovacao.nome}</strong>
              </p>
              {aprovacao.divergente ? (
                <div className="text-[11px] bg-amber-50 border border-amber-300 rounded-md p-2.5 text-amber-900">
                  <strong className="uppercase tracking-wider">ATENÇÃO:</strong> este documento possui divergências detectadas. Deseja aprovar mesmo assim?
                </div>
              ) : (
                <p className="text-xs text-slate-500">
                  O documento passará a status APROVADO e o motivo de rejeição anterior, se houver, será limpo.
                </p>
              )}
            </div>
            <div className="px-5 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2">
              <button
                onClick={() => setAprovacao(null)}
                disabled={salvandoAcao}
                className="h-8 px-3 rounded-md text-[11px] uppercase tracking-wider font-bold border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                CANCELAR
              </button>
              <button
                onClick={confirmarAprovacao}
                disabled={salvandoAcao}
                className="h-8 px-3 rounded-md text-[11px] uppercase tracking-wider font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 inline-flex items-center gap-1.5"
              >
                <CheckCircle className="h-3 w-3" /> {salvandoAcao ? "APROVANDO..." : "CONFIRMAR APROVAÇÃO"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal — Recusar com MOTIVO obrigatório */}
      {rejeicao && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60">
          <div className="w-full max-w-md bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
              <XCircle className="h-4 w-4 text-red-600" />
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-800">RECUSAR DOCUMENTO</h3>
            </div>
            <div className="px-5 py-4 space-y-3">
              <p className="text-xs text-slate-700 uppercase tracking-wide">
                Documento: <strong>{rejeicao.nome}</strong>
              </p>
              <label className="block text-[10px] uppercase tracking-wider font-bold text-slate-600">
                MOTIVO DA RECUSA (OBRIGATÓRIO)
              </label>
              <textarea
                value={motivoRejeicao}
                onChange={(e) => setMotivoRejeicao(e.target.value.toUpperCase())}
                placeholder="EX.: ARQUIVO ILEGÍVEL, FOTO CORTADA, DOCUMENTO VENCIDO..."
                rows={4}
                maxLength={500}
                className="w-full text-xs uppercase tracking-wide rounded-md border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-300"
              />
              <div className="text-[10px] text-slate-400 text-right">
                {motivoRejeicao.length}/500
              </div>
              <p className="text-[11px] text-slate-500">
                O cliente verá este motivo e o botão para SUBSTITUIR DOCUMENTO no portal.
              </p>
            </div>
            <div className="px-5 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2">
              <button
                onClick={() => { setRejeicao(null); setMotivoRejeicao(""); }}
                disabled={salvandoAcao}
                className="h-8 px-3 rounded-md text-[11px] uppercase tracking-wider font-bold border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                CANCELAR
              </button>
              <button
                onClick={confirmarRejeicao}
                disabled={salvandoAcao || !motivoRejeicao.trim()}
                className="h-8 px-3 rounded-md text-[11px] uppercase tracking-wider font-bold text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 inline-flex items-center gap-1.5"
              >
                <XCircle className="h-3 w-3" /> {salvandoAcao ? "REGISTRANDO..." : "CONFIRMAR RECUSA"}
              </button>
            </div>
          </div>
        </div>
      )}
      <DocumentoViewerModal
        open={viewer.open}
        onClose={viewer.fechar}
        source={viewer.source}
        title={viewer.title}
      />
    </div>
  );
}

function TabBtn({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 h-11 inline-flex items-center justify-center gap-2 text-[11px] uppercase tracking-wider font-bold border-b-2 transition-colors ${active ? "border-blue-500 text-blue-600 bg-blue-50/40" : "border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50"}`}
    >
      {icon} {label}
    </button>
  );
}

const CONDICAO_OPCOES: { id: "clt" | "autonomo" | "empresario" | "aposentado" | "funcionario_publico"; label: string; hint: string }[] = [
  { id: "clt", label: "CLT", hint: "Holerite + CTPS Digital + Extrato INSS" },
  { id: "autonomo", label: "AUTÔNOMO", hint: "Cartão CNPJ/MEI + NF recente" },
  { id: "empresario", label: "EMPRESÁRIO/SÓCIO", hint: "Cartão CNPJ + QSA + Contrato Social + Nota Fiscal" },
  { id: "aposentado", label: "APOSENTADO", hint: "Comprovante de benefício INSS" },
  { id: "funcionario_publico", label: "FUNCIONÁRIO PÚBLICO", hint: "Carteira Funcional + Holerite" },
];

function CondicaoProfissionalCard({
  condicao,
  indefinida,
  saving,
  onSelect,
}: {
  condicao: string | null;
  indefinida: boolean;
  saving: string | null;
  onSelect: (c: "clt" | "autonomo" | "empresario" | "aposentado" | "funcionario_publico") => void;
}) {
  const atual = (condicao || "").toLowerCase();
  return (
    <div className={`rounded-xl border p-4 shadow-sm ${indefinida ? "bg-white border-blue-200 ring-1 ring-blue-100" : "bg-white border-slate-200"}`}>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <div className="text-[10px] uppercase tracking-[0.14em] font-bold text-slate-500">CONDIÇÃO PROFISSIONAL</div>
          <div className="text-sm font-bold text-slate-800 uppercase mt-0.5">
            {indefinida
              ? "DEFINA SUA CONDIÇÃO PARA LIBERAR OS COMPROVANTES DE RENDA CORRETOS"
              : `ATUAL: ${atual.toUpperCase()}`}
          </div>
          <div className="text-[11px] text-slate-600 mt-1">
            Os documentos de renda são gerados automaticamente conforme sua escolha. Itens já aprovados são preservados.
          </div>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 md:grid-cols-5 gap-2">
        {CONDICAO_OPCOES.map((op) => {
          const ativo = atual === op.id;
          const carregando = saving === op.id;
          return (
            <button
              key={op.id}
              disabled={!!saving}
              onClick={() => onSelect(op.id)}
              className={`text-center rounded-lg border px-3 py-2 transition flex flex-col items-center justify-center ${
                ativo
                  ? "bg-emerald-50 border-emerald-300 ring-1 ring-emerald-200"
                  : "bg-white border-slate-200 hover:bg-slate-50"
              } disabled:opacity-50`}
            >
              <div className="text-[11px] uppercase tracking-wider font-bold text-slate-800 text-center">{op.label}</div>
              <div className="text-[10px] text-slate-500 mt-0.5 leading-tight text-center">{op.hint}</div>
              {ativo && <div className="text-[10px] uppercase font-bold text-emerald-700 mt-1 text-center">SELECIONADO</div>}
              {carregando && <div className="text-[10px] uppercase font-bold text-slate-500 mt-1 text-center">SALVANDO...</div>}
            </button>
          );
        })}
      </div>
    </div>
  );
}