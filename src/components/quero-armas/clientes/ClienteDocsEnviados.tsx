import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import DocumentoViewerModal, { useDocumentoViewer } from "@/components/quero-armas/DocumentoViewerModal";
import {
  Loader2, FileText, CheckCircle2, AlertCircle, ExternalLink,
  Trash2, ShieldCheck, Clock, XCircle, MessageSquareWarning,
} from "lucide-react";
import { toast } from "sonner";
import {
  aprovarDocumento, reprovarDocumento, excluirDocumentoLogico, statusBadge,
} from "./docsAprovacao";

interface Props {
  cliente: any;
}

const TIPO_LABEL: Record<string, string> = {
  cr: "CR — Certificado de Registro",
  craf: "CRAF (SIGMA)",
  sinarm: "SINARM (PF)",
  gt: "GT — Guia de Tráfego",
  gte: "GTE — Guia de Tráfego Especial",
  autorizacao_compra: "AC — Autorização de Compra",
  outro: "Outro Documento",
};

const formatDate = (d: string | null) => {
  if (!d) return "—";
  try {
    return new Date(d + "T00:00:00").toLocaleDateString("pt-BR");
  } catch { return d; }
};

export default function ClienteDocsEnviados({ cliente }: Props) {
  const clienteId = Number(cliente?.id) || null;
  const queryClient = useQueryClient();
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [reprovandoId, setReprovandoId] = useState<string | null>(null);
  const [motivoTmp, setMotivoTmp] = useState("");
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
    try {
      await aprovarDocumento(docId);
      toast.success("Documento aprovado.");
      queryClient.invalidateQueries({ queryKey });
    } catch (err: any) { toast.error(err?.message || "Falha ao aprovar."); }
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

  const handleViewFile = (path: string) => {
    const fileName = path.split("/").pop() || "documento";
    viewer.abrirStorage("qa-documentos", path, { fileName, title: fileName });
  };

  const handleDelete = async (docId: string) => {
    if (!confirm("Remover este documento? Será marcado como excluído (soft delete) e somirá do portal.")) return;
    try {
      await excluirDocumentoLogico(docId);
      toast.success("Documento removido");
      queryClient.invalidateQueries({ queryKey });
    } catch (err: any) {
      toast.error(err?.message || "Falha ao remover");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10 gap-2 text-slate-400">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-[10px] uppercase tracking-wider">Carregando…</span>
      </div>
    );
  }

  if (docs.length === 0) {
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

  const pendentes = docs.filter((d: any) => d.status === "pendente_aprovacao").length;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2">
        <div className="flex items-center gap-2 text-xs">
          <ShieldCheck className="h-4 w-4 text-blue-600" />
          <span className="font-semibold text-slate-700">Hub do Cliente</span>
          <span className="text-slate-400">·</span>
          <span className="text-slate-500">{docs.length} documento(s)</span>
        </div>
        {pendentes > 0 && (
          <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-amber-50 border border-amber-200">
            <Clock className="h-3 w-3 text-amber-600" />
            <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wider">
              {pendentes} pendente(s)
            </span>
          </div>
        )}
      </div>

      <div className="grid gap-2">
        {docs.map((d: any) => {
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
              key={d.id}
              className={`rounded-xl border p-3 transition ${borderCls}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5">
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
                      <span className="text-[9px] uppercase font-semibold text-blue-600">via portal</span>
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
                    Enviado em {new Date(d.created_at).toLocaleString("pt-BR")}
                    {d.ia_status === "sucesso" && <span className="ml-2 text-blue-500">✦ Preenchido com IA</span>}
                  </div>
                  {isReprovado && d.motivo_reprovacao && (
                    <div className="mt-2 rounded-md border border-red-200 bg-red-50 p-2 text-[10px] text-red-700">
                      <span className="font-bold uppercase">Motivo da reprovação:</span> {d.motivo_reprovacao}
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
                          onClick={() => handleReprovar(d.id)}>
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
                      onClick={() => handleViewFile(d.arquivo_storage_path)}
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
                      onClick={() => handleAprovar(d.id)}
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
                    onClick={() => handleDelete(d.id)}
                    className="h-7 px-2 text-[10px] text-red-600 hover:bg-red-50"
                    title="Remover"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <DocumentoViewerModal
        open={viewer.open}
        onClose={viewer.fechar}
        source={viewer.source}
        title={viewer.title}
      />
    </div>
  );
}
