import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { FileText, Download, Clock, ShieldCheck, Upload, CheckCircle2, XCircle, Loader2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

type Contract = {
  id: string;
  venda_id: number;
  cliente_id: number;
  contract_number: string | null;
  status: string;
  original_pdf_path: string | null;
  original_sha256: string | null;
  validation_status: string | null;
  validation_details: any;
  issued_at: string | null;
  created_at: string;
};

type ContractItem = {
  id: string;
  contract_id: string;
  venda_id: number;
  service_name_snapshot: string | null;
  service_description_snapshot: string | null;
  quantity: number | null;
  total_price_cents: number | null;
};

const brl = (cents: number | null | undefined) =>
  `R$ ${((cents ?? 0) / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

const formatDate = (d: string | null) => {
  if (!d) return "—";
  try {
    const p = new Date(d);
    return isNaN(p.getTime()) ? d : p.toLocaleDateString("pt-BR");
  } catch {
    return d;
  }
};

type Tone = "warn" | "ok" | "info" | "danger";
const STATUS_LABELS: Record<string, { label: string; tone: Tone }> = {
  generated_pending_company_signature: { label: "DISPONÍVEL PARA SUA ASSINATURA", tone: "info" },
  pending_customer_signature: { label: "AGUARDANDO SUA ASSINATURA", tone: "info" },
  customer_signature_uploaded: { label: "CONTRATO ENVIADO — EM VALIDAÇÃO", tone: "info" },
  validating: { label: "VALIDANDO ASSINATURA", tone: "info" },
  validated: { label: "ASSINADO E VALIDADO", tone: "ok" },
  rejected: { label: "CONTRATO INVÁLIDO — REENVIE", tone: "danger" },
  pending_manual_review: { label: "EM REVISÃO MANUAL", tone: "info" },
};

const TONE_CLASS: Record<Tone, string> = {
  warn: "bg-amber-100 text-amber-800",
  ok: "bg-emerald-100 text-emerald-800",
  info: "bg-sky-100 text-sky-800",
  danger: "bg-rose-100 text-rose-800",
};

const ITEM_LABEL: Record<string, { label: string; tone: Tone; icon: any }> = {
  validated: { label: "CONTRATO VALIDADO — APTO PARA LIBERAÇÃO", tone: "ok", icon: CheckCircle2 },
  customer_signature_uploaded: { label: "AGUARDANDO VALIDAÇÃO", tone: "info", icon: Loader2 },
  validating: { label: "VALIDANDO", tone: "info", icon: Loader2 },
  rejected: { label: "CONTRATO INVÁLIDO", tone: "danger", icon: XCircle },
  pending_manual_review: { label: "REVISÃO MANUAL", tone: "info", icon: AlertTriangle },
};

function isUploadable(status: string): boolean {
  return [
    "generated_pending_company_signature",
    "pending_customer_signature",
    "rejected",
    "pending_manual_review",
    "customer_signature_uploaded",
  ].includes(status);
}

interface Props {
  /** id_legado do cliente (FK usada por qa_contracts.cliente_id e qa_vendas.cliente_id) */
  clienteIdLegado: number | null | undefined;
}

/**
 * FASE 2C-4 — Card "Contratos pós-pagamento" no portal do cliente Quero Armas.
 *
 * Regras invioláveis:
 * - Não bloqueia Arsenal Inteligente em hipótese alguma.
 * - Mostra apenas contratos da própria venda paga.
 * - Cada item do contrato fica com badge "Aguardando contrato assinado"
 *   até a assinatura ser validada — bloqueio APENAS do serviço, nunca do Arsenal.
 * - Não cria processo, checklist nem libera execução operacional.
 * - Não usa payments/contracts/quotes/customers (WMTi).
 */
export default function ContratosPosPagamentoCard({ clienteIdLegado }: Props) {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [items, setItems] = useState<ContractItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const fileInputs = useRef<Record<string, HTMLInputElement | null>>({});

  async function reload() {
    if (!clienteIdLegado) return;
    const { data: cs } = await supabase
      .from("qa_contracts" as any)
      .select(
        "id, venda_id, cliente_id, contract_number, status, original_pdf_path, original_sha256, validation_status, validation_details, issued_at, created_at",
      )
      .eq("cliente_id", clienteIdLegado)
      .order("created_at", { ascending: false });
    setContracts(((cs as any[]) || []) as Contract[]);
  }

  useEffect(() => {
    let alive = true;
    if (!clienteIdLegado) {
      setLoading(false);
      return;
    }
    (async () => {
      try {
        const { data: cs } = await supabase
          .from("qa_contracts" as any)
          .select(
            "id, venda_id, cliente_id, contract_number, status, original_pdf_path, original_sha256, validation_status, validation_details, issued_at, created_at",
          )
          .eq("cliente_id", clienteIdLegado)
          .order("created_at", { ascending: false });
        if (!alive) return;
        const list = ((cs as any[]) || []) as Contract[];
        setContracts(list);

        if (list.length) {
          const { data: its } = await supabase
            .from("qa_contract_items" as any)
            .select(
              "id, contract_id, venda_id, service_name_snapshot, service_description_snapshot, quantity, total_price_cents",
            )
            .in(
              "contract_id",
              list.map((c) => c.id),
            );
          if (alive) setItems(((its as any[]) || []) as ContractItem[]);

          // Auditoria: contrato_disponibilizado_portal (idempotente — only first time per session)
          const sessionKey = `qa-contract-portal-shown-${clienteIdLegado}`;
          if (!sessionStorage.getItem(sessionKey)) {
            sessionStorage.setItem(sessionKey, "1");
            for (const c of list) {
              await supabase.from("qa_contract_events" as any).insert({
                contract_id: c.id,
                event_type: "contrato_disponibilizado_portal",
                event_payload: { venda_id: c.venda_id, viewed_at: new Date().toISOString() },
              });
            }
          }
        }
      } catch (e) {
        console.warn("[ContratosPosPagamentoCard] load error", e);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [clienteIdLegado]);

  async function downloadContract(c: Contract) {
    setDownloadingId(c.id);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/qa-serve-contract-pdf`;
      const resp = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token ?? ""}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({ contract_id: c.id, variant: "company_signed" }),
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({} as any));
        throw new Error(err.error || `HTTP ${resp.status}`);
      }
      const blob = await resp.blob();
      const isHtml = (resp.headers.get("Content-Type") || "").includes("text/html");
      const ext = isHtml ? "html" : "pdf";
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = `contrato-${c.contract_number ?? c.id.slice(0, 8)}.${ext}`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(blobUrl), 5000);
    } catch (e: any) {
      toast.error(`Falha ao baixar contrato: ${e?.message ?? "erro"}`);
    } finally {
      setDownloadingId(null);
    }
  }

  async function handleUpload(c: Contract, file: File) {
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      toast.error("Apenas PDF assinado é aceito.");
      return;
    }
    const MAX = 25 * 1024 * 1024;
    if (file.size > MAX) {
      toast.error("Arquivo maior que 25MB.");
      return;
    }
    setUploadingId(c.id);
    try {
      const fd = new FormData();
      fd.append("contract_id", c.id);
      fd.append("file", file);
      const { data, error } = await supabase.functions.invoke("qa-upload-signed-contract", {
        body: fd,
      });
      if (error) throw error;
      toast.success("Contrato assinado enviado. Validando assinatura…");
      // valida automaticamente no backend; recarrega após pequeno delay
      setTimeout(reload, 1500);
      setTimeout(reload, 5000);
      void data;
    } catch (e: any) {
      toast.error(`Falha no upload: ${e?.message ?? "erro"}`);
    } finally {
      setUploadingId(null);
    }
  }

  if (loading) {
    return <div className="text-[11px] text-slate-500">Carregando contratos…</div>;
  }
  if (!contracts.length) {
    return (
      <div className="text-[11px] text-slate-500">
        Nenhum contrato pós-pagamento gerado ainda. Quando uma venda for paga, o contrato aparecerá
        aqui automaticamente.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-2 p-3 rounded-lg border border-amber-200 bg-amber-50/60">
        <ShieldCheck className="h-4 w-4 text-amber-700 shrink-0 mt-0.5" />
        <div className="text-[11px] text-amber-900 leading-relaxed">
          <strong className="uppercase tracking-wide">Como assinar:</strong> baixe o contrato,
          assine digitalmente pelo <strong>GOV.BR</strong> ou certificado <strong>ICP-Brasil</strong>{" "}
          e envie o PDF assinado pelo botão de upload do contrato. O Arsenal Inteligente continua
          gratuito e acessível independentemente desta etapa.
        </div>
      </div>

      {contracts.map((c) => {
        const its = items.filter((i) => i.contract_id === c.id);
        const total = its.reduce((s, i) => s + (i.total_price_cents ?? 0), 0);
        const st = STATUS_LABELS[c.status] ?? { label: c.status.toUpperCase(), tone: "warn" as const };
        const itemMeta = ITEM_LABEL[c.status] ?? { label: "AGUARDANDO CONTRATO ASSINADO", tone: "warn" as const, icon: Clock };
        const ItemIcon = itemMeta.icon;
        const canUpload = isUploadable(c.status);
        const rejectionReason = c.status === "rejected"
          ? (c.validation_details?.motivo_falha || c.validation_details?.motivo || "Assinatura digital não pôde ser validada.")
          : null;
        return (
          <div
            key={c.id}
            className="rounded-xl border border-slate-200/70 bg-white p-3 space-y-2"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <FileText className="h-3.5 w-3.5 text-[#7A1F2B]" />
                  <div className="text-[12px] font-bold text-slate-800">
                    {c.contract_number ?? `Contrato ${c.id.slice(0, 8)}`}
                  </div>
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5">
                  Venda #{c.venda_id} • emitido em {formatDate(c.issued_at ?? c.created_at)}
                </div>
              </div>
              <span
                className={`text-[9px] font-bold px-2 py-1 rounded uppercase tracking-wider whitespace-nowrap ${TONE_CLASS[st.tone]}`}
              >
                {st.label}
              </span>
            </div>

            {rejectionReason && (
              <div className="rounded-md border border-rose-200 bg-rose-50 px-2 py-1.5 text-[10px] text-rose-800">
                <strong className="uppercase tracking-wide">Motivo: </strong>{rejectionReason}
              </div>
            )}

            {its.length > 0 && (
              <div className="space-y-1.5 pt-1 border-t border-slate-100">
                {its.map((i) => (
                  <div
                    key={i.id}
                    className="flex items-center justify-between gap-2 py-1"
                  >
                    <div className="min-w-0">
                      <div className="text-[11px] font-semibold text-slate-700 truncate">
                        {i.service_name_snapshot ?? "Serviço"}
                      </div>
                      <div className="text-[9px] text-slate-500 mt-0.5">
                        {brl(i.total_price_cents)}
                      </div>
                    </div>
                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded uppercase tracking-wider whitespace-nowrap inline-flex items-center gap-1 ${TONE_CLASS[itemMeta.tone]}`}>
                      <ItemIcon className="h-2.5 w-2.5" />
                      {itemMeta.label}
                    </span>
                  </div>
                ))}
                <div className="flex justify-between items-center pt-1 border-t border-slate-100">
                  <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500">
                    TOTAL
                  </span>
                  <span className="text-[12px] font-bold font-mono text-slate-800">
                    {brl(total)}
                  </span>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 flex-wrap">
              <input
                ref={(el) => (fileInputs.current[c.id] = el)}
                type="file"
                accept="application/pdf,.pdf"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void handleUpload(c, f);
                  e.target.value = "";
                }}
              />
              <Button
                size="sm"
                variant="outline"
                onClick={() => downloadContract(c)}
                disabled={downloadingId === c.id}
                className="h-8 text-[11px]"
              >
                <Download className="h-3 w-3 mr-1.5" />
                {downloadingId === c.id ? "Baixando…" : "BAIXAR CONTRATO"}
              </Button>
              {canUpload && (
                <Button
                  size="sm"
                  onClick={() => fileInputs.current[c.id]?.click()}
                  disabled={uploadingId === c.id}
                  className="h-8 text-[11px] bg-[#7A1F2B] hover:bg-[#5e1721] text-white"
                >
                  {uploadingId === c.id ? (
                    <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />
                  ) : (
                    <Upload className="h-3 w-3 mr-1.5" />
                  )}
                  {uploadingId === c.id ? "ENVIANDO…" : "ENVIAR CONTRATO ASSINADO"}
                </Button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
