import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { FileText, Download, Clock, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

type Contract = {
  id: string;
  venda_id: number;
  cliente_id: number;
  contract_number: string | null;
  status: string;
  original_pdf_path: string | null;
  original_sha256: string | null;
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

const STATUS_LABELS: Record<string, { label: string; tone: "warn" | "ok" }> = {
  generated_pending_company_signature: { label: "AGUARDANDO ASSINATURA", tone: "warn" },
  awaiting_customer_signature: { label: "AGUARDANDO SUA ASSINATURA", tone: "warn" },
  validated: { label: "ASSINADO E VALIDADO", tone: "ok" },
};

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
            "id, venda_id, cliente_id, contract_number, status, original_pdf_path, original_sha256, issued_at, created_at",
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
    if (!c.original_pdf_path) {
      toast.error("PDF do contrato indisponível");
      return;
    }
    setDownloadingId(c.id);
    try {
      const { data, error } = await supabase.functions.invoke("qa-serve-contract-pdf", {
        body: { contract_id: c.id, variant: "original" },
      });
      if (error) throw error;
      // qa-serve-contract-pdf retorna { url } assinado
      const url = (data as any)?.url;
      if (!url) throw new Error("URL não retornada");
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (e: any) {
      toast.error(`Falha ao baixar contrato: ${e?.message ?? "erro"}`);
    } finally {
      setDownloadingId(null);
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
                className={`text-[9px] font-bold px-2 py-1 rounded uppercase tracking-wider whitespace-nowrap ${
                  st.tone === "ok"
                    ? "bg-emerald-100 text-emerald-800"
                    : "bg-amber-100 text-amber-800"
                }`}
              >
                {st.label}
              </span>
            </div>

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
                    <span className="text-[9px] font-bold px-2 py-0.5 rounded uppercase tracking-wider bg-slate-100 text-slate-700 whitespace-nowrap inline-flex items-center gap-1">
                      <Clock className="h-2.5 w-2.5" />
                      AGUARDANDO CONTRATO ASSINADO
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

            <div className="flex justify-end">
              <Button
                size="sm"
                variant="outline"
                onClick={() => downloadContract(c)}
                disabled={downloadingId === c.id || !c.original_pdf_path}
                className="h-8 text-[11px]"
              >
                <Download className="h-3 w-3 mr-1.5" />
                {downloadingId === c.id ? "Baixando…" : "BAIXAR CONTRATO"}
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
