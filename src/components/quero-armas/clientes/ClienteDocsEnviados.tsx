import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Loader2, FileText, CheckCircle2, AlertCircle, ExternalLink, Trash2, ShieldCheck, Clock } from "lucide-react";
import { toast } from "sonner";

interface Props {
  cliente: any;
}

const TIPO_LABEL: Record<string, string> = {
  cr: "CR — Certificado de Registro",
  craf: "CRAF (SIGMA)",
  sinarm: "SINARM (PF)",
  gt: "GT — Guia de Tráfego",
  gte: "GTE — Guia de Tráfego Eventual",
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
  const [docs, setDocs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [customerId, setCustomerId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // Resolve o customer_id (uuid) via email ou CPF do cliente QA
      const cpfDigits = (cliente.cpf || "").replace(/\D/g, "");
      const email = (cliente.email || "").toLowerCase().trim();

      let custId: string | null = null;
      if (email) {
        const { data: byEmail } = await supabase
          .from("customers")
          .select("id")
          .ilike("email", email)
          .maybeSingle();
        if (byEmail?.id) custId = byEmail.id;
      }
      if (!custId && cpfDigits) {
        const { data: byCpf } = await supabase
          .from("customers")
          .select("id, cnpj_ou_cpf")
          .limit(50);
        const match = (byCpf || []).find((c: any) => (c.cnpj_ou_cpf || "").replace(/\D/g, "") === cpfDigits);
        if (match) custId = match.id;
      }
      setCustomerId(custId);

      // Busca documentos por customer_id (portal) OU qa_cliente_id (cadastro QA legado)
      const qaId = cliente.id ? Number(cliente.id) : null;
      let query = supabase
        .from("qa_documentos_cliente" as any)
        .select("*")
        .order("created_at", { ascending: false });

      if (custId && qaId) {
        query = query.or(`customer_id.eq.${custId},qa_cliente_id.eq.${qaId}`);
      } else if (custId) {
        query = query.eq("customer_id", custId);
      } else if (qaId) {
        query = query.eq("qa_cliente_id", qaId);
      } else {
        setDocs([]);
        return;
      }

      const { data, error } = await query;
      if (error) throw error;
      setDocs((data as any[]) || []);
    } catch (err: any) {
      console.error("[ClienteDocsEnviados]", err);
      toast.error("Falha ao carregar documentos enviados");
    } finally {
      setLoading(false);
    }
  }, [cliente.id, cliente.email, cliente.cpf]);

  useEffect(() => { void load(); }, [load]);

  const handleValidate = async (docId: string, currentValue: boolean) => {
    try {
      const { error } = await supabase
        .from("qa_documentos_cliente" as any)
        .update({
          validado_admin: !currentValue,
          validado_em: !currentValue ? new Date().toISOString() : null,
        })
        .eq("id", docId);
      if (error) throw error;
      toast.success(!currentValue ? "Documento validado" : "Validação removida");
      await load();
    } catch (err: any) {
      toast.error(err?.message || "Falha ao atualizar");
    }
  };

  const handleViewFile = async (path: string) => {
    try {
      const { data, error } = await supabase.storage
        .from("qa-documentos")
        .createSignedUrl(path, 3600);
      if (error) throw error;
      if (data?.signedUrl) window.open(data.signedUrl, "_blank");
    } catch (err: any) {
      toast.error("Falha ao abrir arquivo");
    }
  };

  const handleDelete = async (docId: string) => {
    if (!confirm("Remover este documento enviado pelo cliente?")) return;
    try {
      const { error } = await supabase
        .from("qa_documentos_cliente" as any)
        .delete()
        .eq("id", docId);
      if (error) throw error;
      toast.success("Documento removido");
      await load();
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

  if (!customerId) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-800 text-sm">
        <div className="flex items-center gap-2 font-semibold mb-1">
          <AlertCircle className="h-4 w-4" /> Cliente sem acesso ao portal
        </div>
        <p className="text-xs">
          Este cliente ainda não possui credenciais ativas no portal — não há documentos enviados.
          Provisione o acesso na aba <strong>Portal</strong> para liberar o hub do cliente.
        </p>
      </div>
    );
  }

  if (docs.length === 0) {
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

  const pendentes = docs.filter(d => !d.validado_admin).length;

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
        {docs.map(d => {
          const isPending = !d.validado_admin;
          return (
            <div
              key={d.id}
              className={`rounded-xl border p-3 transition ${isPending ? "border-amber-200 bg-amber-50/40" : "border-emerald-200 bg-emerald-50/40"}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-[11px] font-bold text-slate-800 uppercase tracking-wide">
                      {TIPO_LABEL[d.tipo_documento] || d.tipo_documento}
                    </span>
                    {isPending ? (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-100 border border-amber-300">
                        <Clock className="h-2.5 w-2.5 text-amber-700" />
                        <span className="text-[9px] font-bold text-amber-700 uppercase">Pendente validação</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-100 border border-emerald-300">
                        <CheckCircle2 className="h-2.5 w-2.5 text-emerald-700" />
                        <span className="text-[9px] font-bold text-emerald-700 uppercase">Validado</span>
                      </span>
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
                  <Button
                    size="sm"
                    variant={isPending ? "default" : "outline"}
                    onClick={() => handleValidate(d.id, d.validado_admin)}
                    className="h-7 px-2 text-[10px]"
                    title={isPending ? "Marcar como validado" : "Remover validação"}
                  >
                    <CheckCircle2 className="h-3 w-3" />
                  </Button>
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
    </div>
  );
}
