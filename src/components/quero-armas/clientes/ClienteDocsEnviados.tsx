import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import DocumentoViewerModal, { useDocumentoViewer } from "@/components/quero-armas/DocumentoViewerModal";
import {
  Loader2, FileText, CheckCircle2, AlertCircle, ExternalLink,
  Trash2, ShieldCheck, Clock, XCircle, MessageSquareWarning,
  ChevronDown, ChevronRight, Layers, ShieldAlert, Tags, Download, Eye, Archive,
} from "lucide-react";
import { toast } from "sonner";
import {
  aprovarDocumento, reprovarDocumento, excluirDocumentoLogico, statusBadge,
} from "./docsAprovacao";
import {
  agruparDocumentosPorFamilia,
  auditoriaGrupo,
  type GrupoDocumental,
} from "@/lib/quero-armas/documentosAgrupamento";
import { logSistema } from "@/lib/logSistema";
import { HUB_CATEGORIAS, listTiposByCategoria } from "@/lib/quero-armas/documentosHubCatalogo";
import {
  montarLinhaEntrega, contarAnotacoes, DOCS_CONTRATUAIS, type EntregaItem,
} from "@/lib/quero-armas/hubEntregaAuditoria";
import {
  posicaoProtocolo, compararProtocolo, nomeArquivoDossie, GRUPOS_PROTOCOLO,
} from "@/lib/quero-armas/ordemProtocolo";

interface Props {
  cliente: any;
}

const TIPO_LABEL: Record<string, string> = {
  cr: "CR — Certificado de Registro de Colecionador, Atirador Desportivo e Caçador (Exército)",
  craf: "CRAF — Certificado de Registro de Arma de Fogo",
  sinarm: "SINARM — Certificado de Registro de Arma de Fogo (Polícia Federal)",
  gt: "GT — Guia de Tráfego",
  gte: "GTE — Guia de Tráfego Eventual",
  autorizacao_compra: "AC — Autorização de Compra",
  outro: "Outro Documento",
};

// O <input type="date"> do Safari não aceita o ano pelo teclado numérico —
// o campo é segmentado e ignora a digitação. Usamos texto com máscara
// DD/MM/AAAA, que é o padrão do resto do sistema.
const mascaraData = (raw: string) => {
  const d = raw.replace(/\D/g, "").slice(0, 8);
  if (d.length <= 2) return d;
  if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`;
  return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
};
const brParaIso = (br: string): string | null => {
  const m = br.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  const iso = `${m[3]}-${m[2]}-${m[1]}`;
  const d = new Date(`${iso}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? null : iso;
};
const isoParaBr = (iso: string | null | undefined) => {
  const m = String(iso || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : "";
};

const formatDate = (d: string | null) => {
  if (!d) return "—";
  try {
    return new Date(d + "T00:00:00").toLocaleDateString("pt-BR");
  } catch { return d; }
};

// Auditoria: registra no máximo 1x por (cliente, grupo) a cada 24h para
// evitar poluir `logs_sistema`. A supressão só é reportada quando o grupo
// tem principal vigente E histórico vencido silenciado (útil de fato).
function auditarGrupoSeUtil(clienteId: number | null, grupo: GrupoDocumental<any>) {
  if (!clienteId) return;
  try {
    const dedupeKey = `qa:audit:grupo:${clienteId}:${grupo.chave}`;
    const last = Number(localStorage.getItem(dedupeKey) || 0);
    if (last && Date.now() - last < 24 * 60 * 60 * 1000) return;
    const base = auditoriaGrupo(grupo);
    const eventos: string[] = ["documento_principal_definido"];
    if (grupo.alertaSuprimido) eventos.push("alerta_suprimido_por_documento_valido");
    if (grupo.versoesAnteriores > 0) eventos.push("documento_empilhado_historico");
    // Só loga quando há efetivo empilhamento ou supressão.
    if (grupo.versoesAnteriores === 0 && !grupo.alertaSuprimido) return;
    localStorage.setItem(dedupeKey, String(Date.now()));
    void logSistema({
      tipo: "admin",
      status: "info",
      mensagem: `Grupo documental consolidado: ${grupo.familia}`,
      payload: {
        cliente_id: clienteId,
        eventos,
        motivo: grupo.alertaSuprimido
          ? "principal_vigente_silencia_versoes_vencidas"
          : "empilhamento_historico",
        timestamp: new Date().toISOString(),
        ...base,
      },
    });
  } catch {/* noop */}
}

export default function ClienteDocsEnviados({ cliente }: Props) {
  const clienteId = Number(cliente?.id) || null;
  const queryClient = useQueryClient();
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [reprovandoId, setReprovandoId] = useState<string | null>(null);
  const [aprovandoId, setAprovandoId] = useState<string | null>(null);
  const [motivoTmp, setMotivoTmp] = useState("");
  const [reclassificandoId, setReclassificandoId] = useState<string | null>(null);
  const [novoTipoTmp, setNovoTipoTmp] = useState("");
  const [novaEmissaoTmp, setNovaEmissaoTmp] = useState("");
  const [salvandoTipo, setSalvandoTipo] = useState(false);
  const viewer = useDocumentoViewer();

  // Resolve customerId (UUID) via email/CPF — uma única vez por cliente
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const cpfDigits = (cliente.cpf || "").replace(/\D/g, "");
      const email = (cliente.email || "").toLowerCase().trim();
      let custId: string | null = null;
      if (email) {
        const { data: byEmail } = await supabase
          .from("customers").select("id").ilike("email", email).maybeSingle();
        if (byEmail?.id) custId = byEmail.id;
      }
      if (!custId && cpfDigits) {
        const { data: byCpf } = await supabase
          .from("customers").select("id, cnpj_ou_cpf").limit(50);
        const match = (byCpf || []).find(
          (c: any) => (c.cnpj_ou_cpf || "").replace(/\D/g, "") === cpfDigits,
        );
        if (match) custId = match.id;
      }
      if (!cancelled) setCustomerId(custId);
    })();
    return () => { cancelled = true; };
  }, [cliente.email, cliente.cpf]);

  // React Query: chave SEMPRE inclui clienteId (evita cache cruzado entre clientes)
  const queryKey = useMemo(
    () => ["cliente-documentos", clienteId, customerId] as const,
    [clienteId, customerId],
  );

  const { data: docs = [], isLoading: loading, refetch } = useQuery({
    queryKey,
    enabled: Boolean(clienteId || customerId),
    queryFn: async () => {
      let query = supabase
        .from("qa_documentos_cliente" as any)
        .select("*")
        .order("created_at", { ascending: false });
      if (customerId && clienteId) {
        query = query.or(`customer_id.eq.${customerId},qa_cliente_id.eq.${clienteId}`);
      } else if (customerId) {
        query = query.eq("customer_id", customerId);
      } else if (clienteId) {
        query = query.eq("qa_cliente_id", clienteId);
      }
      const { data, error } = await query;
      if (error) throw error;
      return ((data as any[]) || []).filter((d) => d.status !== "excluido");
    },
  });

  const pendentes = docs.filter((d: any) => d.status === "pendente_aprovacao").length;

  /**
   * Histórico de rejeições: cada evento de mudança para "reprovado" com o
   * motivo alegado. Serve de trilha de auditoria na linha do tempo — não só o
   * último motivo gravado no documento.
   */
  const docIds = useMemo(() => (docs as any[]).map((d) => d.id), [docs]);
  const { data: historicoReprovas = {} } = useQuery({
    queryKey: ["cliente-docs-reprovas", clienteId, docIds.length],
    enabled: docIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from("qa_status_eventos" as any)
        .select("documento_id, motivo, created_at, status_novo")
        .in("documento_id", docIds)
        .eq("status_novo", "reprovado")
        .order("created_at", { ascending: true });
      const mapa: Record<string, { motivo: string | null; quando: string }[]> = {};
      for (const ev of ((data as any[]) || [])) {
        if (!ev.documento_id) continue;
        (mapa[ev.documento_id] ||= []).push({ motivo: ev.motivo ?? null, quando: ev.created_at });
      }
      return mapa;
    },
  });

  // Exigências reais do cliente — base para auditar a ordem de entrega e, desde
  // a separação por serviço, também para descobrir QUAL processo consumiu cada
  // documento do Hub (processo_id + metadados do reaproveitamento).
  const { data: exigencias = [] } = useQuery({
    queryKey: ["cliente-exigencias-entrega", clienteId],
    enabled: Boolean(clienteId),
    queryFn: async () => {
      const { data } = await supabase
        .from("qa_processo_documentos" as any)
        .select("tipo_documento, nome_documento, status, etapa, ordem, obrigatorio, created_at, processo_id, metadados_documento_json")
        .eq("cliente_id", clienteId);
      return ((data as any[]) || []);
    },
  });

  /**
   * Serviços contratados — as abas do Hub. Um cliente pode ter mais de um
   * serviço rodando ao mesmo tempo, e misturar os dossiês numa lista só faz a
   * equipe conferir documento de um processo achando que é de outro.
   *
   * A aba nasce do PROCESSO (é o processo_id que os documentos referenciam).
   * Serviço contratado que ainda não virou processo entra como aba vazia, para
   * a equipe enxergar que ele existe e ainda não tem dossiê.
   */
  const { data: servicos = [] } = useQuery({
    queryKey: ["cliente-hub-servicos", clienteId],
    enabled: Boolean(clienteId),
    queryFn: async () => {
      const [{ data: procs }, { data: sols }] = await Promise.all([
        supabase
          .from("qa_processos" as any)
          .select("id, servico_nome, status, venda_id, created_at")
          .eq("cliente_id", clienteId)
          .order("created_at", { ascending: true }),
        supabase
          .from("qa_solicitacoes_servico" as any)
          .select("id, service_name, processo_id, venda_id, status_servico, arquivado, created_at")
          .eq("cliente_id", clienteId)
          .order("created_at", { ascending: true }),
      ]);

      const solicitacoes = ((sols as any[]) || []).filter((s) => !s.arquivado);
      const abas = ((procs as any[]) || []).map((p) => {
        const sol = solicitacoes.find((s) => s.processo_id === p.id);
        return {
          chave: String(p.id),
          processoId: String(p.id),
          nome: p.servico_nome || sol?.service_name || "Serviço sem nome",
          status: p.status || sol?.status_servico || null,
          vendaId: p.venda_id ?? sol?.venda_id ?? null,
          semProcesso: false,
        };
      });

      // Contratou, mas o processo ainda não foi gerado.
      for (const s of solicitacoes) {
        if (s.processo_id) continue;
        abas.push({
          chave: `solicitacao-${s.id}`,
          processoId: "",
          nome: s.service_name || "Serviço sem nome",
          status: s.status_servico || null,
          vendaId: s.venda_id ?? null,
          semProcesso: true,
        });
      }
      return abas;
    },
  });

  /**
   * Contratos assinados — card virtual da aba Contratual.
   *
   * Lidos direto de qa_contracts, sem virar linha em qa_documentos_cliente: o
   * contrato é artefato da venda, não documento monitorado do checklist, e
   * gravá-lo no Hub o exporia no portal do cliente. Como este componente só
   * roda no painel, o contrato fica restrito à visão do admin.
   */
  const { data: contratos = [] } = useQuery({
    queryKey: ["cliente-hub-contratos", clienteId],
    enabled: Boolean(clienteId),
    queryFn: async () => {
      const { data } = await supabase
        .from("qa_contracts" as any)
        .select("id, contract_number, status, validation_status, venda_id, customer_signed_pdf_path, customer_uploaded_at, customer_signature_validated_at, created_at")
        .eq("cliente_id", clienteId)
        .order("created_at", { ascending: false });
      return ((data as any[]) || []).filter((c) => c.customer_signed_pdf_path);
    },
  });

  /**
   * Documento do Hub → processos que o consumiram.
   *
   * O vínculo não existe em qa_documentos_cliente (a tabela não tem
   * processo_id); ele só aparece do lado do checklist, quando a exigência é
   * satisfeita por um documento do Hub. Derivamos daí em vez de criar coluna
   * nova — nada é gravado, e a conta se refaz sozinha a cada carregamento.
   */
  const consumoPorDoc = useMemo(() => {
    const mapa = new Map<string, Set<string>>();
    for (const ex of (exigencias as any[])) {
      const meta = (ex?.metadados_documento_json && typeof ex.metadados_documento_json === "object")
        ? ex.metadados_documento_json as Record<string, any>
        : {};
      const hubId = meta?.reaproveitamento?.documento_reaproveitado_id
        ?? meta?.hub_documento_id
        ?? meta?.documento_id
        ?? null;
      if (!hubId || !ex.processo_id) continue;
      const chave = String(hubId);
      if (!mapa.has(chave)) mapa.set(chave, new Set());
      mapa.get(chave)!.add(String(ex.processo_id));
    }
    return mapa;
  }, [exigencias]);

  /**
   * Aba de cada documento. Regras acordadas com a operação:
   *   - peça contratual (contrato, procuração, comprovante de pagamento) →
   *     "Contratual", porque pertence à venda e uma venda pode cobrir vários
   *     serviços;
   *   - reaproveitável/global, ou consumido por mais de um processo, ou ainda
   *     não consumido por nenhum → "Gerais", aparecendo uma vez só;
   *   - consumido por exatamente um processo → aba daquele serviço.
   */
  const abaDoDoc = useMemo(() => {
    const mapa = new Map<string, string>();
    for (const d of (docs as any[])) {
      const tipo = String(d.tipo_documento || "").toLowerCase();
      if (DOCS_CONTRATUAIS.has(tipo)) { mapa.set(d.id, "contratual"); continue; }
      const ehGlobal = d.reaproveitavel_global === true
        || String(d.escopo_documental || "").toLowerCase() === "global";
      const processos = consumoPorDoc.get(String(d.id));
      if (ehGlobal || !processos || processos.size !== 1) { mapa.set(d.id, "gerais"); continue; }
      mapa.set(d.id, [...processos][0]);
    }
    return mapa;
  }, [docs, consumoPorDoc]);

  const [abaAtiva, setAbaAtiva] = useState<string>("todos");
  const [modo, setModo] = useState<"familia" | "entrega">("entrega");

  const docsVisiveis = useMemo(() => {
    if (abaAtiva === "todos") return docs as any[];
    return (docs as any[]).filter((d) => abaDoDoc.get(d.id) === abaAtiva);
  }, [docs, abaDoDoc, abaAtiva]);

  const contarAba = (chave: string) =>
    (docs as any[]).filter((d) => abaDoDoc.get(d.id) === chave).length;

  /**
   * Provas da EFETIVA NECESSIDADE (BO, inquérito, denúncia, medida protetiva,
   * documentos complementares do caso). Vivem em tabela própria, mas fazem
   * parte do dossiê de protocolo — entram anexas à petição (grupo 1).
   */
  const { data: provasCaso = [] } = useQuery({
    queryKey: ["cliente-provas-efetiva", clienteId],
    enabled: Boolean(clienteId),
    queryFn: async () => {
      const { data: regs } = await supabase
        .from("qa_efetiva_necessidade" as any)
        .select("id")
        .eq("cliente_id", clienteId);
      const ids = ((regs as any[]) || []).map((r) => r.id);
      if (ids.length === 0) return [];
      const { data } = await supabase
        .from("qa_efetiva_necessidade_provas" as any)
        .select("id, tipo, arquivo_storage_path, arquivo_nome, numero, orgao, data_fato, created_at")
        .in("efetiva_necessidade_id", ids)
        .order("created_at", { ascending: true });
      return ((data as any[]) || []).filter((p) => p.arquivo_storage_path);
    },
  });

  /** Provas normalizadas para o mesmo formato de documento (ZIP e ações). */
  const provasComoDocs = useMemo(
    () => (provasCaso as any[]).map((p) => ({
      id: `prova-${p.id}`,
      tipo_documento: p.tipo || "documento_complementar_caso",
      nome_documento: p.arquivo_nome || p.tipo,
      arquivo_nome: p.arquivo_nome,
      arquivo_storage_path: p.arquivo_storage_path,
      origem_prova: true,
      numero: p.numero,
      orgao: p.orgao,
      data_fato: p.data_fato,
      created_at: p.created_at,
    })),
    [provasCaso],
  );
  // Linha do tempo e famílias respeitam a aba escolhida — conferir o dossiê de
  // um serviço não pode trazer junto o documento de outro.
  const linhaEntrega = useMemo(
    () => montarLinhaEntrega(docsVisiveis, exigencias as any[]),
    [docsVisiveis, exigencias],
  );
  const totalAnotacoes = useMemo(() => contarAnotacoes(linhaEntrega), [linhaEntrega]);

  // Agrupa por família documental (Bloco: empilhamento visual).
  const grupos = useMemo(
    () => agruparDocumentosPorFamilia(docsVisiveis),
    [docsVisiveis],
  );

  // Realtime: invalida cache quando documentos deste cliente mudam
  useEffect(() => {
    if (!clienteId && !customerId) return;
    const channel = supabase
      .channel(`docs-cliente-${clienteId ?? customerId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "qa_documentos_cliente" },
        (payload: any) => {
          const row = payload.new || payload.old;
          if (!row) return;
          if (row.qa_cliente_id === clienteId || row.customer_id === customerId) {
            queryClient.invalidateQueries({ queryKey });
          }
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [clienteId, customerId, queryClient, queryKey]);

  const handleAprovar = async (docId: string) => {
    setAprovandoId(docId);
    try {
      await aprovarDocumento(docId);
      toast.success("Documento aprovado — conferido pela equipe. Cliente foi notificado no portal.");
      queryClient.invalidateQueries({ queryKey });
      // Aprovar no Hub fecha o slot correspondente do checklist (trigger
      // qa_doc_hub_satisfaz_exigencias_processo). A linha do tempo lê as
      // exigências por uma query própria — sem invalidá-la, a anotação
      // "sem exigência correspondente" continua na tela depois da aprovação.
      queryClient.invalidateQueries({ queryKey: ["cliente-exigencias-entrega", clienteId] });
    } catch (err: any) { toast.error(err?.message || "Falha ao aprovar."); }
    finally { setAprovandoId(null); }
  };

  const handleReprovar = async (docId: string) => {
    try {
      await reprovarDocumento(docId, motivoTmp);
      toast.success("Documento reprovado. Cliente foi notificado no portal.");
      setReprovandoId(null);
      setMotivoTmp("");
      queryClient.invalidateQueries({ queryKey });
    } catch (err: any) { toast.error(err?.message || "Falha ao reprovar."); }
  };

  // Corrige o tipo de um documento já salvo. A exigência do processo casa por
  // tipo_documento — um documento gravado com o tipo errado (ou como "outro")
  // faz o sistema pedir ao cliente algo que ele já enviou.
  const handleReclassificar = async (docId: string, docTipoAtual: string) => {
    if (!novoTipoTmp && !novaEmissaoTmp) {
      toast.error("Escolha o novo tipo, informe a data, ou ambos.");
      return;
    }
    let dataIso: string | null = null;
    if (novaEmissaoTmp) {
      dataIso = brParaIso(novaEmissaoTmp);
      if (!dataIso) { toast.error("Data inválida. Use o formato DD/MM/AAAA."); return; }
    }
    // Comprovante de residência: a data digitada é a PRÓXIMA LEITURA da conta,
    // que é a própria validade — não um prazo contado da emissão.
    const tipoAlvo = novoTipoTmp || docTipoAtual;
    const ehComprovante = tipoAlvo === "comprovante_residencia";
    if (!clienteId) { toast.error("Cliente sem ID interno — não é possível reclassificar."); return; }
    setSalvandoTipo(true);
    try {
      const { data, error } = await supabase.functions.invoke("qa-admin-destravar-cadastro", {
        body: {
          action: "reclassificar_documento",
          cliente_id: clienteId,
          documento_id: docId,
          novo_tipo: novoTipoTmp || undefined,
          data_emissao: ehComprovante ? undefined : (dataIso || undefined),
          data_validade: ehComprovante ? (dataIso || undefined) : undefined,
        },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).message || (data as any).error);

      const r = data as any;
      const partes: string[] = [];
      if (novoTipoTmp && r.tipo_anterior !== r.tipo_documento) {
        partes.push(`tipo: ${TIPO_LABEL[r.tipo_anterior] || r.tipo_anterior} → ${TIPO_LABEL[novoTipoTmp] || novoTipoTmp}`);
      }
      if (dataIso) {
        partes.push(ehComprovante
          ? `válido até a próxima leitura em ${isoParaBr(dataIso)}`
          : `emissão ${isoParaBr(dataIso)}${r.data_validade ? ` · vence em ${isoParaBr(r.data_validade)}` : " · sem prazo de validade"}`);
      }
      if (r.qsa_propagados > 0) {
        partes.push(`${r.qsa_propagados} QSA receberam a mesma data`);
      }
      toast.success(`Documento corrigido — ${partes.join(" · ")}.`);
      setReclassificandoId(null);
      setNovoTipoTmp("");
      setNovaEmissaoTmp("");
      // Invalidação ampla de propósito: mudar o tipo altera quais exigências o
      // processo considera cumpridas, e isso é lido por checklist, kanban e
      // pendências — telas com queryKeys próprias. Reclassificar é ação rara,
      // então o custo de refetch geral compensa a garantia de consistência.
      queryClient.invalidateQueries();
    } catch (err: any) {
      toast.error(err?.message || "Falha ao reclassificar o documento.");
    } finally {
      setSalvandoTipo(false);
    }
  };

  /**
   * Toda leitura/baixa da equipe vira rastro em qa_documento_acessos e aviso
   * ao cliente (janela de 6h por documento, para não virar spam).
   */
  const registrarAcesso = (
    acao: "visualizado" | "baixado" | "baixado_lote",
    doc?: any,
    extra?: Record<string, unknown>,
  ) => {
    if (!clienteId) return;
    // Provas do caso usam id sintético ("prova-<uuid>") — a auditoria só
    // aceita uuid puro, então mandamos o uuid real e marcamos a origem.
    const rawId = String(doc?.id ?? "");
    const uuid = rawId.startsWith("prova-") ? rawId.slice(6) : rawId;
    const ehUuid = /^[0-9a-f-]{36}$/i.test(uuid);
    void supabase.functions.invoke("qa-doc-acesso-registrar", {
      body: {
        cliente_id: clienteId,
        acao,
        documento_id: ehUuid ? uuid : null,
        documento_tipo: doc?.tipo_documento ?? null,
        documento_nome: doc?.nome_documento ?? doc?.arquivo_nome ?? null,
        detalhes: doc?.origem_prova ? { origem: "efetiva_necessidade_prova" } : undefined,
        ...extra,
      },
    });
  };

  const handleViewFile = (path: string, doc?: any) => {
    const fileName = path.split("/").pop() || "documento";
    viewer.abrirStorage("qa-documentos", path, { fileName, title: fileName });
    registrarAcesso("visualizado", doc);
  };

  /** Download individual — via Blob, para nunca expor a URL do storage. */
  const handleBaixarDoc = async (doc: any) => {
    const path = doc?.arquivo_storage_path;
    if (!path) { toast.error("Documento sem arquivo."); return; }
    try {
      const { data, error } = await supabase.storage.from("qa-documentos").download(path);
      if (error || !data) throw error || new Error("Falha ao baixar");
      const url = URL.createObjectURL(data);
      const a = document.createElement("a");
      a.href = url;
      a.download = nomeArquivoDossie(doc);
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      registrarAcesso("baixado", doc);
    } catch (err: any) {
      toast.error(err?.message || "Falha ao baixar o documento.");
    }
  };

  /**
   * Contrato assinado mora em `paid-contracts`, não em `qa-documentos` — o Hub
   * inteiro assume o segundo bucket, então estas duas ações são separadas de
   * propósito em vez de parametrizar as do documento comum.
   */
  const handleViewContrato = (ct: any) => {
    const path = String(ct.customer_signed_pdf_path || "");
    const fileName = `Contrato ${ct.contract_number || ""} - assinado.pdf`.replace(/\s+/g, " ").trim();
    viewer.abrirStorage("paid-contracts", path, { fileName, title: fileName });
    registrarAcesso("visualizado", {
      id: ct.id,
      tipo_documento: "contrato_assinado",
      nome_documento: fileName,
    });
  };

  const handleBaixarContrato = async (ct: any) => {
    const path = String(ct.customer_signed_pdf_path || "");
    if (!path) { toast.error("Contrato sem PDF assinado."); return; }
    try {
      const { data, error } = await supabase.storage.from("paid-contracts").download(path);
      if (error || !data) throw error || new Error("Falha ao baixar");
      const url = URL.createObjectURL(data);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Contrato ${ct.contract_number || ct.id} - assinado.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      registrarAcesso("baixado", {
        id: ct.id,
        tipo_documento: "contrato_assinado",
        nome_documento: `Contrato ${ct.contract_number || ct.id}`,
      });
    } catch (err: any) {
      toast.error(err?.message || "Falha ao baixar o contrato.");
    }
  };

  /** Dossiê completo em ZIP, numerado e separado por grupo do protocolo. */
  const [baixandoZip, setBaixandoZip] = useState(false);
  const handleBaixarTudo = async () => {
    // Documentos rejeitados foram tirados do processo — nunca entram no dossiê.
    const comArquivo = [...(docs as any[]), ...provasComoDocs]
      .filter((d) => d.arquivo_storage_path)
      .filter((d) => d.status !== "reprovado" && d.status !== "excluido");
    if (comArquivo.length === 0) {
      toast.error("Nenhum documento válido para o dossiê — os enviados estão rejeitados ou sem arquivo.");
      return;
    }
    setBaixandoZip(true);
    try {
      const JSZip = (await import("jszip")).default;
      const zip = new JSZip();
      const usados = new Map<string, number>();
      const ordenados = [...comArquivo].sort(compararProtocolo);
      let ok = 0;
      for (const doc of ordenados) {
        const { data, error } = await supabase.storage
          .from("qa-documentos").download(doc.arquivo_storage_path);
        if (error || !data) continue;
        const pos = posicaoProtocolo(doc.tipo_documento, doc.nome_documento);
        const pasta = `${pos.grupo}. ${pos.grupoNome}`;
        let nome = nomeArquivoDossie(doc);
        const chave = `${pasta}/${nome}`;
        const n = usados.get(chave) ?? 0;
        usados.set(chave, n + 1);
        if (n > 0) nome = nomeArquivoDossie(doc, n + 1);
        zip.folder(pasta)!.file(nome, data);
        ok += 1;
      }
      if (ok === 0) throw new Error("Não foi possível baixar os arquivos.");
      const blob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);
      const nomeCliente = String(cliente?.nome_completo || cliente?.nome || "cliente")
        .replace(/[\\/:*?"<>|]/g, "-").trim();
      const a = document.createElement("a");
      a.href = url;
      a.download = `Dossie - ${nomeCliente}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 6000);
      registrarAcesso("baixado_lote", undefined, { quantidade: ok });
      toast.success(`Dossiê com ${ok} documento(s) baixado na ordem do protocolo.`);
    } catch (err: any) {
      toast.error(err?.message || "Falha ao gerar o dossiê.");
    } finally {
      setBaixandoZip(false);
    }
  };

  /**
   * Motivos prontos para a exclusão.
   *
   * Existem para o aviso ao cliente sair específico sem custar tempo da equipe.
   * "Documento removido" não diz nada a quem enviou; "era um print da tela de
   * instruções" faz ele entender o erro e não repetir.
   */
  const MOTIVOS_EXCLUSAO = [
    "O arquivo era um print da tela de instruções, não o documento em si.",
    "O arquivo estava ilegível ou incompleto.",
    "O documento é de outra pessoa.",
    "O documento não corresponde ao que foi pedido neste item.",
    "Documento duplicado — já existe uma versão válida no acervo.",
  ];

  const handleDelete = async (docId: string) => {
    const doc = (docs ?? []).find((d: any) => d.id === docId) as any;

    const lista = MOTIVOS_EXCLUSAO.map((m, i) => `${i + 1}. ${m}`).join("\n");
    const escolha = prompt(
      `Remover este documento?\n\nPor que está sendo excluído? O cliente será avisado com esta explicação.\n\n${lista}\n\nDigite o número, ou escreva o motivo com suas palavras.\nDeixe em branco para cancelar.`,
    );
    if (!escolha || !escolha.trim()) return;

    const n = Number(escolha.trim());
    const motivo = Number.isInteger(n) && n >= 1 && n <= MOTIVOS_EXCLUSAO.length
      ? MOTIVOS_EXCLUSAO[n - 1]
      : escolha.trim();

    try {
      await excluirDocumentoLogico(docId);
      toast.success("Documento removido");
      queryClient.invalidateQueries({ queryKey });

      // Avisa o cliente. Best-effort: falha no e-mail não desfaz a exclusão,
      // que já aconteceu e é a operação que importa.
      if (clienteId) {
        void supabase.functions.invoke("qa-notify-event", {
          body: {
            evento: "documento_excluido",
            cliente_id: clienteId,
            documento: doc?.nome_documento || doc?.tipo_documento || "",
            arquivo: doc?.arquivo_nome || "",
            motivo,
            referencia_tabela: "qa_documentos_cliente",
            referencia_id: docId,
          },
        });
      }
    } catch (err: any) {
      toast.error(err?.message || "Falha ao remover");
    }
  };

  // Auditoria de supressão / empilhamento (dedupe por 24h no localStorage).
  useEffect(() => {
    if (!clienteId || grupos.length === 0) return;
    grupos.forEach((g) => auditarGrupoSeUtil(clienteId, g));
  }, [clienteId, grupos]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10 gap-2 text-slate-400">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-[10px] uppercase tracking-wider">Carregando…</span>
      </div>
    );
  }

  // Cliente sem documento no Hub mas com contrato assinado não pode cair no
  // estado vazio — é justamente o caso em que a aba Contratual tem conteúdo.
  if (docs.length === 0 && contratos.length === 0) {
    if (!customerId) {
      return (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-800 text-sm">
          <div className="flex items-center gap-2 font-semibold mb-1">
            <AlertCircle className="h-4 w-4" /> Cliente sem acesso ao portal
          </div>
          <p className="text-xs">
            Este cliente ainda não possui credenciais ativas no portal — provisione o acesso na aba <strong>Portal</strong> para liberar o envio pelo cliente.
          </p>
        </div>
      );
    }
    return (
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-center">
        <FileText className="h-8 w-8 text-slate-300 mx-auto mb-2" />
        <div className="text-xs uppercase tracking-wider text-slate-500 font-semibold">
          Cliente ainda não enviou documentos
        </div>
        <p className="text-[11px] text-slate-400 mt-1">
          Quando o cliente enviar CR, CRAF, GT/GTE ou AC pelo portal, eles aparecerão aqui para validação.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2">
        <div className="flex items-center gap-2 text-xs">
          <ShieldCheck className="h-4 w-4 text-[#7A1F2B]" />
          <span className="font-semibold text-slate-700">Hub do Cliente</span>
          <span className="text-slate-400">·</span>
          <span className="text-slate-500">
            {grupos.length} família(s) ·{" "}
            {abaAtiva === "todos"
              ? `${docs.length} documento(s)`
              : `${docsVisiveis.length} de ${docs.length} documento(s)`}
            {provasComoDocs.length > 0 && ` · ${provasComoDocs.length} prova(s) do caso`}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleBaixarTudo}
            disabled={baixandoZip}
            className="inline-flex items-center gap-1 rounded-md border border-[#7A1F2B] bg-[#7A1F2B] px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-white disabled:opacity-60"
          >
            {baixandoZip ? <Loader2 className="h-3 w-3 animate-spin" /> : <Archive className="h-3 w-3" />}
            Baixar tudo (ZIP)
          </button>
          <div className="inline-flex rounded-md border border-slate-200 overflow-hidden">
            <button
              type="button"
              onClick={() => setModo("entrega")}
              className={`px-2 py-1 text-[9px] font-bold uppercase tracking-wider ${modo === "entrega" ? "bg-[#7A1F2B] text-white" : "bg-white text-slate-600"}`}
            >
              Ordem de entrega
            </button>
            <button
              type="button"
              onClick={() => setModo("familia")}
              className={`px-2 py-1 text-[9px] font-bold uppercase tracking-wider ${modo === "familia" ? "bg-[#7A1F2B] text-white" : "bg-white text-slate-600"}`}
            >
              Por família
            </button>
          </div>
          {totalAnotacoes > 0 && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-red-50 border border-red-200 text-[10px] font-bold uppercase tracking-wider text-red-700">
              <ShieldAlert className="h-3 w-3" /> {totalAnotacoes} anotação(ões)
            </span>
          )}
          {pendentes > 0 && (
          <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-amber-50 border border-amber-200">
            <Clock className="h-3 w-3 text-amber-600" />
            <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wider">
              {pendentes} pendente(s)
            </span>
          </div>
          )}
        </div>
      </div>

      {/* Abas por serviço contratado. Um cliente pode ter dois processos
          rodando ao mesmo tempo; sem isso os dois dossiês viram uma lista só. */}
      <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2 py-1.5">
        <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 pr-1">
          Serviço
        </span>
        {[
          { chave: "todos", nome: "Todos", contagem: docs.length, extra: contratos.length },
          { chave: "contratual", nome: "Contratual", contagem: contarAba("contratual"), extra: contratos.length },
          ...(servicos as any[]).map((s) => ({
            chave: s.chave,
            nome: s.nome,
            contagem: s.semProcesso ? 0 : contarAba(s.chave),
            extra: 0,
            semProcesso: s.semProcesso,
          })),
          { chave: "gerais", nome: "Gerais", contagem: contarAba("gerais"), extra: 0 },
        ].map((aba: any) => {
          const ativa = abaAtiva === aba.chave;
          const total = aba.contagem + (aba.extra || 0);
          return (
            <button
              key={aba.chave}
              type="button"
              onClick={() => setAbaAtiva(aba.chave)}
              title={aba.semProcesso ? "Serviço contratado — processo ainda não gerado" : undefined}
              className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[9px] font-bold uppercase tracking-wider ${
                ativa
                  ? "border-[#7A1F2B] bg-[#7A1F2B] text-white"
                  : "border-slate-200 bg-white text-slate-600 hover:border-[#7A1F2B] hover:text-[#7A1F2B]"
              }`}
            >
              {aba.nome}
              <span className={ativa ? "text-white/80" : "text-slate-400"}>({total})</span>
            </button>
          );
        })}
      </div>

      {(abaAtiva === "todos" || abaAtiva === "contratual") && contratos.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-3 space-y-2">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-600">
            Peças contratuais · contrato assinado ({contratos.length}) — visível apenas para a equipe
          </div>
          <ul className="space-y-1.5">
            {(contratos as any[]).map((ct) => {
              const validado = ct.status === "validated" || ct.validation_status === "valid";
              const rejeitado = ct.status === "rejected" || ct.validation_status === "invalid";
              const rotulo = validado ? "Validado" : rejeitado ? "Rejeitado" : "Em análise";
              const cor = validado
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : rejeitado
                  ? "border-[#7A1F2B]/30 bg-[#7A1F2B]/[0.06] text-[#7A1F2B]"
                  : "border-amber-200 bg-amber-50 text-amber-700";
              const quando = ct.customer_signature_validated_at || ct.customer_uploaded_at;
              return (
                <li key={ct.id} className="rounded-lg border border-slate-200 p-2.5">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[11px] font-bold uppercase tracking-wide text-slate-800">
                      Contrato assinado (Gov.br/ICP-Brasil)
                    </span>
                    <span className={`px-1.5 py-0.5 rounded border text-[9px] font-bold uppercase ${cor}`}>
                      {rotulo}
                    </span>
                    {ct.contract_number && (
                      <span className="text-[10px] text-slate-500">Nº {ct.contract_number}</span>
                    )}
                    {ct.venda_id && (
                      <span className="text-[10px] text-slate-500">Venda {ct.venda_id}</span>
                    )}
                    {quando && (
                      <span className="text-[10px] text-slate-500">
                        {new Date(quando).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}
                      </span>
                    )}
                  </div>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleViewContrato(ct)}
                      className="inline-flex items-center gap-1 rounded border border-slate-200 bg-white px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-slate-700 hover:border-[#7A1F2B] hover:text-[#7A1F2B]"
                    >
                      <Eye className="h-3 w-3" /> Visualizar
                    </button>
                    <button
                      type="button"
                      onClick={() => handleBaixarContrato(ct)}
                      className="inline-flex items-center gap-1 rounded border border-slate-200 bg-white px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-slate-700 hover:border-[#7A1F2B] hover:text-[#7A1F2B]"
                    >
                      <Download className="h-3 w-3" /> Baixar
                    </button>
                  </div>
                  <p className="mt-1.5 rounded bg-slate-50 px-2 py-1 text-[10px] text-slate-500">
                    <strong className="uppercase tracking-wider text-slate-600">Documento contratual</strong> — pertence à venda, não ao checklist do processo. Não aparece no portal do cliente.
                  </p>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {abaAtiva !== "todos" && docsVisiveis.length === 0 && (
        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center">
          <FileText className="h-6 w-6 text-slate-300 mx-auto mb-1.5" />
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
            Nenhum documento nesta aba
          </div>
          <p className="mt-1 text-[10px] text-slate-400">
            Documentos reaproveitáveis e ainda não consumidos por um processo ficam em <strong>Gerais</strong>.
          </p>
        </div>
      )}

      {modo === "entrega" && (
        <LinhaEntrega
          itens={linhaEntrega}
          historicoReprovas={historicoReprovas as any}
          onViewFile={handleViewFile}
          onBaixar={handleBaixarDoc}
          onAprovar={handleAprovar}
          aprovandoId={aprovandoId}
          onReprovar={(id) => { setReprovandoId(id); setMotivoTmp(""); }}
          onDelete={handleDelete}
          reprovandoId={reprovandoId}
          motivoTmp={motivoTmp}
          setMotivoTmp={setMotivoTmp}
          confirmarReprovar={handleReprovar}
          cancelarReprovar={() => setReprovandoId(null)}
        />
      )}

      {modo === "familia" && (
      <div className="grid gap-2">
        {grupos.map((grupo) => (
          <GrupoCard
            key={grupo.chave}
            grupo={grupo}
            reprovandoId={reprovandoId}
            motivoTmp={motivoTmp}
            setReprovandoId={setReprovandoId}
            setMotivoTmp={setMotivoTmp}
            onAprovar={handleAprovar}
            onReprovar={handleReprovar}
            onDelete={handleDelete}
            onViewFile={handleViewFile}
            reclassificandoId={reclassificandoId}
            novoTipoTmp={novoTipoTmp}
            novaEmissaoTmp={novaEmissaoTmp}
            salvandoTipo={salvandoTipo}
            setReclassificandoId={setReclassificandoId}
            setNovoTipoTmp={setNovoTipoTmp}
            setNovaEmissaoTmp={setNovaEmissaoTmp}
            onReclassificar={handleReclassificar}
          />
        ))}
      </div>
      )}

      {provasComoDocs.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-3 space-y-2">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-600">
            Efetiva necessidade · provas do caso ({provasComoDocs.length}) — grupo 1, anexas à petição
          </div>
          <ul className="space-y-1.5">
            {provasComoDocs.map((p: any) => {
              const pos = posicaoProtocolo(p.tipo_documento, p.nome_documento);
              return (
                <li key={p.id} className="rounded-lg border border-slate-200 p-2.5">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[11px] font-bold uppercase tracking-wide text-slate-800">
                      {String(p.tipo_documento).replace(/_/g, " ")}
                    </span>
                    <span className="px-1.5 py-0.5 rounded border border-slate-200 bg-slate-50 text-[9px] font-bold uppercase text-slate-600">
                      {pos.numero} · {pos.grupoNome}
                    </span>
                    {p.numero && (
                      <span className="text-[10px] text-slate-500">Nº {p.numero}</span>
                    )}
                    {p.orgao && <span className="text-[10px] text-slate-500">{p.orgao}</span>}
                    {p.data_fato && (
                      <span className="text-[10px] text-slate-500">{formatDate(p.data_fato)}</span>
                    )}
                  </div>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleViewFile(p.arquivo_storage_path, p)}
                      className="inline-flex items-center gap-1 rounded border border-slate-200 bg-white px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-slate-700 hover:border-[#7A1F2B] hover:text-[#7A1F2B]"
                    >
                      <Eye className="h-3 w-3" /> Visualizar
                    </button>
                    <button
                      type="button"
                      onClick={() => handleBaixarDoc(p)}
                      className="inline-flex items-center gap-1 rounded border border-slate-200 bg-white px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-slate-700 hover:border-[#7A1F2B] hover:text-[#7A1F2B]"
                    >
                      <Download className="h-3 w-3" /> Baixar
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
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

// ============================================================================
// GrupoCard — renderiza principal + histórico recolhido
// ============================================================================
interface LinhaEntregaProps {
  itens: EntregaItem[];
  historicoReprovas?: Record<string, { motivo: string | null; quando: string }[]>;
  onViewFile: (path: string, doc?: any) => void;
  onBaixar: (doc: any) => void;
  onAprovar: (id: string) => void;
  aprovandoId: string | null;
  onReprovar: (id: string) => void;
  onDelete: (id: string) => void;
  reprovandoId: string | null;
  motivoTmp: string;
  setMotivoTmp: (v: string) => void;
  confirmarReprovar: (id: string) => void;
  cancelarReprovar: () => void;
}

function LinhaEntrega({
  itens, historicoReprovas = {}, onViewFile, onBaixar, onAprovar, aprovandoId,
  onReprovar, onDelete,
  reprovandoId, motivoTmp, setMotivoTmp, confirmarReprovar, cancelarReprovar,
}: LinhaEntregaProps) {
  if (itens.length === 0) return null;
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 space-y-2">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600">
          Linha do tempo de entrega · {itens.length} documento(s)
        </span>
        <span className="inline-flex items-center gap-2 text-[9px] font-bold uppercase tracking-wider text-slate-500">
          <span className="inline-flex items-center gap-1"><i className="h-2.5 w-2.5 rounded-full bg-emerald-600" /> Aprovado</span>
          <span className="inline-flex items-center gap-1"><i className="h-2.5 w-2.5 rounded-full bg-amber-500" /> Em análise</span>
          <span className="inline-flex items-center gap-1"><i className="h-2.5 w-2.5 rounded-full bg-[#7A1F2B]" /> Rejeitado</span>
        </span>
      </div>
      <ol className="space-y-2">
        {itens.map((it) => {
          const d: any = it.doc;
          const pos = posicaoProtocolo(d.tipo_documento, d.nome_documento);
          const isReprovado = d.status === "reprovado";
          const isAprovado = d.status === "aprovado";
          const isAnalise = d.status === "pendente_aprovacao" || d.status === "em_analise";
          const bolinha = isReprovado
            ? "bg-[#7A1F2B]"
            : isAprovado
              ? "bg-emerald-600"
              : isAnalise
                ? "bg-amber-500"
                : "bg-slate-400";
          const bolinhaTitulo = isReprovado
            ? "Documento rejeitado"
            : isAprovado
              ? "Documento aprovado"
              : isAnalise
                ? "Em análise"
                : "Sem status definido";
          const reprovas = historicoReprovas[d.id] || [];
          const critico = it.anotacoes.some((a) => a.severidade === "critico");
          const atencao = it.anotacoes.some((a) => a.severidade === "atencao");
          const cls = isReprovado
            ? "border-[#7A1F2B]/30 bg-[#7A1F2B]/[0.04]"
            : critico
              ? "border-red-200 bg-red-50/40"
              : atencao
                ? "border-amber-200 bg-amber-50/40"
                : "border-slate-200 bg-white";
          return (
            <li key={d.id} className={`rounded-lg border p-2.5 ${cls}`}>
              <div className="flex items-start gap-2">
                <span
                  title={bolinhaTitulo}
                  className={`shrink-0 h-5 w-5 rounded-full ${bolinha} text-white text-[9px] font-bold flex items-center justify-center`}
                >
                  {it.sequencia}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[11px] font-bold uppercase tracking-wide text-slate-800 truncate">
                      {String(d.tipo_documento || d.nome_documento || "—").replace(/_/g, " ")}
                    </span>
                    <span className="px-1.5 py-0.5 rounded border border-slate-200 bg-slate-50 text-[9px] font-bold uppercase text-slate-600">
                      {pos.numero} · Grupo {pos.grupo} — {pos.grupoNome}
                    </span>
                    <span className={`px-1.5 py-0.5 rounded border text-[9px] font-bold uppercase ${it.origemLabel === "VIA PORTAL" ? "bg-blue-50 border-blue-200 text-blue-700" : "bg-slate-100 border-slate-200 text-slate-600"}`}>
                      {it.origemLabel}
                    </span>
                    <span className="text-[10px] text-slate-500">
                      {it.quando ? it.quando.toLocaleString("pt-BR") : "—"}
                    </span>
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    {d.arquivo_storage_path ? (
                      <>
                        <button
                          type="button"
                          onClick={() => onViewFile(d.arquivo_storage_path, d)}
                          className="inline-flex items-center gap-1 rounded border border-slate-200 bg-white px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-slate-700 hover:border-[#7A1F2B] hover:text-[#7A1F2B]"
                        >
                          <Eye className="h-3 w-3" /> Visualizar
                        </button>
                        <button
                          type="button"
                          onClick={() => onBaixar(d)}
                          className="inline-flex items-center gap-1 rounded border border-slate-200 bg-white px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-slate-700 hover:border-[#7A1F2B] hover:text-[#7A1F2B]"
                        >
                          <Download className="h-3 w-3" /> Baixar
                        </button>
                      </>
                    ) : (
                      <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                        Sem arquivo anexado
                      </span>
                    )}
                    <button
                      type="button"
                      disabled={isAprovado || !d.arquivo_storage_path || aprovandoId === d.id}
                      onClick={() => { if (!isAprovado && d.arquivo_storage_path) onAprovar(d.id); }}
                      title={
                        isAprovado
                          ? "Este documento já está aprovado."
                          : !d.arquivo_storage_path
                            ? "Sem arquivo anexado — não é possível aprovar."
                            : "Aprovar manualmente — conferido pela equipe"
                      }
                      className={`inline-flex items-center gap-1 rounded border px-2 py-1 text-[9px] font-bold uppercase tracking-wider ${
                        isAprovado || !d.arquivo_storage_path
                          ? "border-slate-200 bg-slate-50 text-slate-400 opacity-60 cursor-not-allowed"
                          : "border-emerald-200 bg-emerald-50 text-emerald-700 hover:border-emerald-400"
                      }`}
                    >
                      {aprovandoId === d.id
                        ? <Loader2 className="h-3 w-3 animate-spin" />
                        : <CheckCircle2 className="h-3 w-3" />}
                      {isAprovado ? "Aprovado" : "Aprovar"}
                    </button>
                    <button
                      type="button"
                      disabled={isReprovado}
                      onClick={() => { if (!isReprovado) onReprovar(d.id); }}
                      title={isReprovado ? "Este documento já foi rejeitado." : "Rejeitar com motivo"}
                      className={`inline-flex items-center gap-1 rounded border px-2 py-1 text-[9px] font-bold uppercase tracking-wider ${
                        isReprovado
                          ? "border-slate-200 bg-slate-50 text-slate-400 opacity-60 cursor-not-allowed"
                          : "border-amber-200 bg-amber-50 text-amber-700"
                      }`}
                    >
                      <XCircle className="h-3 w-3" /> {isReprovado ? "Rejeitado" : "Rejeitar"}
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete(d.id)}
                      className="inline-flex items-center gap-1 rounded border border-red-200 bg-red-50 px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-red-700"
                    >
                      <Trash2 className="h-3 w-3" /> Excluir
                    </button>
                  </div>
                  {isReprovado && (reprovas.length > 0 || d.motivo_reprovacao) && (
                    <div className="mt-1.5 rounded border border-[#7A1F2B]/30 bg-[#7A1F2B]/[0.06] px-2 py-1.5">
                      <div className="text-[9px] font-bold uppercase tracking-wider text-[#7A1F2B]">
                        Motivo da rejeição
                      </div>
                      <ul className="mt-1 space-y-0.5">
                        {(reprovas.length > 0
                          ? reprovas
                          : [{ motivo: d.motivo_reprovacao, quando: d.reprovado_em }]
                        ).map((r, i) => (
                          <li key={i} className="text-[10px] leading-snug text-[#7A1F2B]">
                            {r.quando && (
                              <span className="font-bold">
                                {new Date(r.quando).toLocaleString("pt-BR")} ·{" "}
                              </span>
                            )}
                            {r.motivo || "Motivo não informado."}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {reprovandoId === d.id && !isReprovado && (
                    <div className="mt-2 rounded border border-amber-200 bg-amber-50 p-2">
                      <textarea
                        value={motivoTmp}
                        onChange={(e) => setMotivoTmp(e.target.value)}
                        rows={2}
                        placeholder="POR QUE ESTÁ SENDO REJEITADO? O CLIENTE RECEBE ESTA EXPLICAÇÃO."
                        className="w-full rounded border border-amber-200 bg-white p-2 text-[11px] text-slate-800"
                      />
                      <div className="mt-1.5 flex gap-1.5">
                        <button
                          type="button"
                          onClick={() => confirmarReprovar(d.id)}
                          disabled={motivoTmp.trim().length < 5}
                          className="rounded bg-[#7A1F2B] px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-white disabled:opacity-50"
                        >
                          Confirmar rejeição
                        </button>
                        <button
                          type="button"
                          onClick={cancelarReprovar}
                          className="rounded border border-slate-200 bg-white px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-slate-600"
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  )}
                  {it.anotacoes.length > 0 && (
                    <ul className="mt-1.5 space-y-1">
                      {it.anotacoes.map((a, i) => (
                        <li
                          key={i}
                          className={`rounded border px-2 py-1 text-[10px] leading-snug ${
                            a.severidade === "critico"
                              ? "border-red-200 bg-red-50 text-red-800"
                              : a.severidade === "atencao"
                                ? "border-amber-200 bg-amber-50 text-amber-800"
                                : "border-slate-200 bg-slate-50 text-slate-600"
                          }`}
                        >
                          <strong className="uppercase tracking-wider">{a.titulo}</strong> — {a.detalhe}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

interface GrupoCardProps {
  grupo: GrupoDocumental<any>;
  reprovandoId: string | null;
  motivoTmp: string;
  setReprovandoId: (v: string | null) => void;
  setMotivoTmp: (v: string) => void;
  onAprovar: (id: string) => void;
  onReprovar: (id: string) => void;
  onDelete: (id: string) => void;
  onViewFile: (path: string) => void;
  reclassificandoId: string | null;
  novoTipoTmp: string;
  novaEmissaoTmp: string;
  salvandoTipo: boolean;
  setReclassificandoId: (v: string | null) => void;
  setNovoTipoTmp: (v: string) => void;
  setNovaEmissaoTmp: (v: string) => void;
  onReclassificar: (id: string, tipoAtual: string) => void;
}

function GrupoCard(props: GrupoCardProps) {
  const { grupo } = props;
  const [expandido, setExpandido] = useState(false);
  const validade = grupo.validadePrincipal;

  const consolidadoLabel: Record<GrupoDocumental["statusConsolidado"], { label: string; cls: string }> = {
    vigente: { label: "Vigente", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
    vence_em_breve: { label: "Vence em breve", cls: "bg-amber-50 text-amber-700 border-amber-200" },
    vencido: { label: "Vencido", cls: "bg-red-50 text-red-700 border-red-200" },
    historico: { label: "Histórico", cls: "bg-slate-50 text-slate-600 border-slate-200" },
    indefinido: { label: "Sem validade", cls: "bg-slate-50 text-slate-500 border-slate-200" },
  };
  const chip = consolidadoLabel[grupo.statusConsolidado];

  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
      <div className="px-3 py-2 border-b border-slate-100 bg-slate-50/60 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Layers className="h-3.5 w-3.5 text-slate-500 shrink-0" />
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-700 truncate">
            {grupo.familia.replace(/_/g, " ")}
          </span>
          <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[9px] font-bold uppercase ${chip.cls}`}>
            {chip.label}
            {validade.dias != null && grupo.statusConsolidado !== "historico" && (
              <span className="opacity-75 normal-case font-medium">
                · {validade.dias >= 0 ? `${validade.dias}d` : `${Math.abs(validade.dias)}d atrás`}
              </span>
            )}
          </span>
          {grupo.alertaSuprimido && (
            <span
              title="Alertas de versões vencidas silenciados pelo documento vigente"
              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded border bg-blue-50 text-blue-700 border-blue-200 text-[9px] font-bold uppercase"
            >
              <ShieldAlert className="h-2.5 w-2.5" /> alerta suprimido
            </span>
          )}
        </div>
        {grupo.versoesAnteriores > 0 && (
          <button
            type="button"
            onClick={() => setExpandido((v) => !v)}
            className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider text-slate-600 hover:text-slate-900 font-semibold"
          >
            {expandido ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            + {grupo.versoesAnteriores} versão(ões) anterior(es)
          </button>
        )}
      </div>

      <div className="p-2">
        <DocRow d={grupo.principal} isPrincipal {...props} />
        {expandido && grupo.historico.length > 0 && (
          <div className="mt-2 pt-2 border-t border-dashed border-slate-200 space-y-2">
            <div className="text-[9px] uppercase tracking-wider text-slate-400 font-bold px-1">
              Histórico ({grupo.historico.length})
            </div>
            {grupo.historico.map((h) => (
              <DocRow key={h.id} d={h} isPrincipal={false} {...props} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// DocRow — mesma UI de card por documento, reduzida (sem borda dupla)
// ============================================================================
interface DocRowProps extends GrupoCardProps {
  d: any;
  isPrincipal: boolean;
}

function DocRow({
  d, isPrincipal, reprovandoId, motivoTmp, setReprovandoId, setMotivoTmp,
  onAprovar, onReprovar, onDelete, onViewFile,
  reclassificandoId, novoTipoTmp, novaEmissaoTmp, salvandoTipo,
  setReclassificandoId, setNovoTipoTmp, setNovaEmissaoTmp, onReclassificar,
}: DocRowProps) {
          const isPending = d.status === "pendente_aprovacao";
          const isReprovado = d.status === "reprovado";
          const isAprovado = d.status === "aprovado";
          const badge = statusBadge(d.status);
          const borderCls = isAprovado
            ? "border-emerald-200 bg-emerald-50/40"
            : isReprovado
              ? "border-red-200 bg-red-50/40"
              : "border-amber-200 bg-amber-50/40";
          return (
            <div
              className={`rounded-lg border p-3 transition ${borderCls} ${isPrincipal ? "" : "opacity-80"}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5">
                    {isPrincipal && (
                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded border bg-[#7A1F2B]/10 border-[#7A1F2B]/30 text-[9px] font-bold uppercase text-[#7A1F2B]">
                        Principal
                      </span>
                    )}
                    <span className="text-[11px] font-bold text-slate-800 uppercase tracking-wide">
                      {TIPO_LABEL[d.tipo_documento] || d.tipo_documento}
                    </span>
                    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border ${badge.cls}`}>
                      {isAprovado && <CheckCircle2 className="h-2.5 w-2.5" />}
                      {isPending && <Clock className="h-2.5 w-2.5" />}
                      {isReprovado && <XCircle className="h-2.5 w-2.5" />}
                      <span className="text-[9px] font-bold uppercase">{badge.label}</span>
                    </span>
                    {d.origem === "cliente" && (
                      <span className="text-[9px] uppercase font-semibold text-[#7A1F2B]">via portal</span>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[10px]">
                    {d.numero_documento && (
                      <div><span className="text-slate-400">Nº:</span> <span className="text-slate-700 font-medium">{d.numero_documento}</span></div>
                    )}
                    {d.orgao_emissor && (
                      <div><span className="text-slate-400">Órgão:</span> <span className="text-slate-700">{d.orgao_emissor}</span></div>
                    )}
                    {d.data_emissao && (
                      <div><span className="text-slate-400">Emissão:</span> <span className="text-slate-700">{formatDate(d.data_emissao)}</span></div>
                    )}
                    {d.data_validade && (
                      <div><span className="text-slate-400">Validade:</span> <span className="text-slate-700 font-semibold">{formatDate(d.data_validade)}</span></div>
                    )}
                    {d.arma_marca && (
                      <div className="col-span-2 mt-1 pt-1 border-t border-slate-200/60">
                        <span className="text-slate-400">Arma:</span>{" "}
                        <span className="text-slate-700">
                          {[d.arma_especie, d.arma_marca, d.arma_modelo, d.arma_calibre].filter(Boolean).join(" · ")}
                          {d.arma_numero_serie && <span className="text-slate-500"> — Sr. {d.arma_numero_serie}</span>}
                        </span>
                      </div>
                    )}
                    {d.observacoes && (
                      <div className="col-span-2 text-slate-500 italic mt-1">{d.observacoes}</div>
                    )}
                  </div>

                  <div className="text-[9px] text-slate-400 mt-1.5">
                    Enviado em {new Date(d.created_at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}
                    {d.ia_status === "sucesso" && <span className="ml-2 text-[#7A1F2B]">✦ Preenchido com IA</span>}
                  </div>
                  {isReprovado && d.motivo_reprovacao && (
                    <div className="mt-2 rounded-md border border-red-200 bg-red-50 p-2 text-[10px] text-red-700">
                      <span className="font-bold uppercase">Motivo da reprovação:</span> {d.motivo_reprovacao}
                    </div>
                  )}
                  {reclassificandoId === d.id && (
                    <div className="mt-2 rounded-md border border-[#7A1F2B]/30 bg-white p-2 space-y-1.5">
                      <div className="text-[10px] text-slate-500">
                        Tipo atual: <span className="font-semibold text-slate-700">{TIPO_LABEL[d.tipo_documento] || d.tipo_documento}</span>
                      </div>
                      <select
                        value={novoTipoTmp}
                        onChange={(e) => setNovoTipoTmp(e.target.value)}
                        className="w-full text-[11px] border border-slate-200 rounded p-1.5 bg-white"
                      >
                        <option value="">— escolha o tipo correto —</option>
                        {HUB_CATEGORIAS.map((cat) => {
                          const tipos = listTiposByCategoria(cat.value);
                          if (tipos.length === 0) return null;
                          return (
                            <optgroup key={cat.value} label={cat.label}>
                              {tipos.map((t) => (
                                <option key={t.value} value={t.value}>{t.label}</option>
                              ))}
                            </optgroup>
                          );
                        })}
                      </select>
                      <div>
                        <label className="text-[10px] text-slate-500 block mb-0.5">
                          {(novoTipoTmp || d.tipo_documento) === "comprovante_residencia"
                            ? "Data da PRÓXIMA LEITURA (impressa na conta)"
                            : "Data de emissão"}
                        </label>
                        <input
                          type="text"
                          inputMode="numeric"
                          placeholder="DD/MM/AAAA"
                          maxLength={10}
                          value={novaEmissaoTmp}
                          onChange={(e) => setNovaEmissaoTmp(mascaraData(e.target.value))}
                          className="w-full text-[11px] border border-slate-200 rounded p-1.5 bg-white"
                        />
                        <p className="text-[9px] text-slate-500 leading-snug mt-0.5">
                          {(novoTipoTmp || d.tipo_documento) === "comprovante_residencia"
                            ? "O comprovante vale ATÉ o dia da próxima leitura — esse dia ainda conta; no seguinte está vencido."
                            : "A validade é calculada pela regra do tipo. No cartão CNPJ, a data também é aplicada aos QSA do cliente que estiverem sem data."}
                        </p>
                      </div>
                      <p className="text-[9px] text-slate-500 leading-snug">
                        O status do documento é preservado — corrigir tipo ou data não revalida
                        o arquivo. A alteração fica registrada em auditoria.
                      </p>
                      <div className="flex justify-end gap-1.5">
                        <Button size="sm" variant="ghost" className="h-6 text-[10px]"
                          disabled={salvandoTipo}
                          onClick={() => { setReclassificandoId(null); setNovoTipoTmp(""); setNovaEmissaoTmp(""); }}>
                          Cancelar
                        </Button>
                        <Button size="sm" className="h-6 text-[10px] bg-[#7A1F2B] hover:bg-[#63161f]"
                          disabled={salvandoTipo || (!novoTipoTmp && !novaEmissaoTmp)}
                          onClick={() => onReclassificar(d.id, d.tipo_documento)}>
                          {salvandoTipo ? <Loader2 className="h-3 w-3 animate-spin" /> : "Salvar correção"}
                        </Button>
                      </div>
                    </div>
                  )}
                  {reprovandoId === d.id && (
                    <div className="mt-2 rounded-md border border-red-300 bg-white p-2 space-y-1.5">
                      <textarea
                        value={motivoTmp}
                        onChange={(e) => setMotivoTmp(e.target.value.toUpperCase())}
                        placeholder="MOTIVO DA REPROVAÇÃO (OBRIGATÓRIO)"
                        className="w-full text-[11px] border border-slate-200 rounded p-1.5 h-16 uppercase"
                      />
                      <div className="flex justify-end gap-1.5">
                        <Button size="sm" variant="ghost" className="h-6 text-[10px]"
                          onClick={() => { setReprovandoId(null); setMotivoTmp(""); }}>
                          Cancelar
                        </Button>
                        <Button size="sm" variant="destructive" className="h-6 text-[10px]"
                          onClick={() => onReprovar(d.id)}>
                          Confirmar reprovação
                        </Button>
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-1.5">
                  {d.arquivo_storage_path && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onViewFile(d.arquivo_storage_path)}
                      className="h-7 px-2 text-[10px]"
                      title="Ver arquivo"
                    >
                      <ExternalLink className="h-3 w-3" />
                    </Button>
                  )}
                  {!isAprovado && (
                    <Button
                      size="sm"
                      variant="default"
                      onClick={() => onAprovar(d.id)}
                      className="h-7 px-2 text-[10px] bg-emerald-600 hover:bg-emerald-700"
                      title="Aprovar documento"
                    >
                      <CheckCircle2 className="h-3 w-3" />
                    </Button>
                  )}
                  {!isReprovado && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => { setReprovandoId(d.id); setMotivoTmp(""); }}
                      className="h-7 px-2 text-[10px] text-red-600 border-red-200 hover:bg-red-50"
                      title="Reprovar com motivo"
                    >
                      <MessageSquareWarning className="h-3 w-3" />
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setReclassificandoId(reclassificandoId === d.id ? null : d.id);
                      setNovoTipoTmp("");
                      setNovaEmissaoTmp(isoParaBr(d.tipo_documento === "comprovante_residencia" ? d.data_validade : d.data_emissao));
                    }}
                    className="h-7 px-2 text-[10px] text-[#7A1F2B] border-[#7A1F2B]/30 hover:bg-[#7A1F2B]/5"
                    title="Alterar tipo do documento (corrige a exigência do processo)"
                  >
                    <Tags className="h-3 w-3" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onDelete(d.id)}
                    className="h-7 px-2 text-[10px] text-red-600 hover:bg-red-50"
                    title="Remover"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            </div>
          );
}
