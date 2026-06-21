import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Download, Clock, ShieldCheck, Upload, CheckCircle2, XCircle, Loader2, AlertTriangle, FileText } from "lucide-react";
import { toast } from "sonner";
import { openMinutaContratoQueroArmas } from "@/lib/quero-armas/minutaContratoDownload";

type Contract = {
  id: string;
  venda_id: number;
  cliente_id: number;
  contract_number: string | null;
  status: string;
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
  service_slug_snapshot: string | null;
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

/* ── Design tokens — mesma linguagem visual do checkout (CheckoutShell /
 * QACheckoutFinalizarPage), traduzida para o modo claro do portal. ──────── */
const D = {
  paper: "#ffffff",
  paper2: "#fafafa",
  border: "rgba(15,23,42,0.10)",
  borderSoft: "rgba(15,23,42,0.06)",
  ink: "#1c1c1c",
  inkSoft: "#52525b",
  inkFaint: "#94a3b8",
  red: "#c4253b",
  redDeep: "#7A1F2B",
  redAlpha: "rgba(196,37,59,0.08)",
  redAlphaStrong: "rgba(196,37,59,0.22)",
  redGlow: "rgba(196,37,59,0.20)",
  success: "#1e8a4c",
  successAlpha: "rgba(30,138,76,0.08)",
  successBorder: "rgba(30,138,76,0.25)",
  warning: "#b8770f",
  warningAlpha: "rgba(184,119,15,0.08)",
  warningBorder: "rgba(184,119,15,0.25)",
  danger: "#b3203a",
  dangerAlpha: "rgba(179,32,58,0.08)",
  dangerBorder: "rgba(179,32,58,0.25)",
};

type Tone = "warning" | "success" | "neutral" | "danger";
const STATUS_LABELS: Record<string, { label: string; tone: Tone }> = {
  generated_pending_company_signature: { label: "Disponível para sua assinatura", tone: "neutral" },
  pending_customer_signature: { label: "Aguardando sua assinatura", tone: "warning" },
  customer_signature_uploaded: { label: "Contrato enviado — em validação", tone: "neutral" },
  validating: { label: "Validando assinatura", tone: "neutral" },
  validated: { label: "Assinado e validado", tone: "success" },
  rejected: { label: "Contrato inválido — reenvie", tone: "danger" },
  pending_manual_review: { label: "Em revisão manual", tone: "warning" },
};

const ITEM_LABEL: Record<string, { label: string; tone: Tone; icon: any }> = {
  validated: { label: "Apto para liberação", tone: "success", icon: CheckCircle2 },
  customer_signature_uploaded: { label: "Aguardando validação", tone: "neutral", icon: Loader2 },
  validating: { label: "Validando", tone: "neutral", icon: Loader2 },
  rejected: { label: "Contrato inválido", tone: "danger", icon: XCircle },
  pending_manual_review: { label: "Revisão manual", tone: "warning", icon: AlertTriangle },
};

function toneColors(tone: Tone) {
  switch (tone) {
    case "success": return { color: D.success, bg: D.successAlpha, border: D.successBorder };
    case "warning": return { color: D.warning, bg: D.warningAlpha, border: D.warningBorder };
    case "danger": return { color: D.danger, bg: D.dangerAlpha, border: D.dangerBorder };
    default: return { color: D.inkFaint, bg: D.paper2, border: D.border };
  }
}

function StatusPill({ tone, label }: { tone: Tone; label: string }) {
  const c = toneColors(tone);
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", whiteSpace: "nowrap",
      fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em",
      color: c.color, background: c.bg, border: `1px solid ${c.border}`,
      borderRadius: 99, padding: "4px 10px",
    }}>
      {label}
    </span>
  );
}

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
  const [revalidatingId, setRevalidatingId] = useState<string | null>(null);
  const fileInputs = useRef<Record<string, HTMLInputElement | null>>({});

  async function reload() {
    if (!clienteIdLegado) return;
    const { data: cs } = await supabase
      .from("qa_contracts" as any)
      .select(
        "id, venda_id, cliente_id, contract_number, status, validation_status, validation_details, issued_at, created_at",
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
            "id, venda_id, cliente_id, contract_number, status, validation_status, validation_details, issued_at, created_at",
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
              "id, contract_id, venda_id, service_name_snapshot, service_description_snapshot, service_slug_snapshot, quantity, total_price_cents",
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
      const slugs = items
        .filter((item) => item.contract_id === c.id)
        .map((item) => item.service_slug_snapshot || "")
        .filter(Boolean);
      await openMinutaContratoQueroArmas({
        contractId: c.id,
        contractNumber: c.contract_number,
        vendaId: c.venda_id,
        slugs,
      });
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

  async function revalidate(c: Contract) {
    setRevalidatingId(c.id);
    try {
      const { error } = await supabase.functions.invoke("qa-validate-customer-signature", {
        body: { contract_id: c.id },
      });
      if (error) throw error;
      toast.success("Revalidando assinatura…");
      setTimeout(reload, 1500);
      setTimeout(reload, 5000);
    } catch (e: any) {
      toast.error(`Falha ao revalidar: ${e?.message ?? "erro"}`);
    } finally {
      setRevalidatingId(null);
    }
  }

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11, color: D.inkFaint }}>
        <Loader2 size={14} className="animate-spin" /> Carregando contratos…
      </div>
    );
  }
  if (!contracts.length) {
    return (
      <div style={{ fontSize: 11, color: D.inkFaint }}>
        Nenhum contrato pós-pagamento gerado ainda. Quando uma venda for paga, o contrato aparecerá
        aqui automaticamente.
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{
        display: "flex", alignItems: "flex-start", gap: 10,
        padding: "10px 14px", borderRadius: 10,
        background: D.warningAlpha, border: `1px solid ${D.warningBorder}`,
      }}>
        <ShieldCheck size={15} color={D.warning} style={{ flexShrink: 0, marginTop: 1 }} />
        <div style={{ fontSize: 11, color: D.inkSoft, lineHeight: 1.6 }}>
          <strong style={{ textTransform: "uppercase", letterSpacing: "0.06em", color: D.warning }}>Como assinar:</strong>{" "}
          baixe o contrato, assine digitalmente pelo <strong>GOV.BR</strong> ou certificado{" "}
          <strong>ICP-Brasil</strong> e envie o PDF assinado pelo botão de upload do contrato. O
          Arsenal Inteligente continua gratuito e acessível independentemente desta etapa.
        </div>
      </div>

      {contracts.map((c) => {
        const its = items.filter((i) => i.contract_id === c.id);
        const total = its.reduce((s, i) => s + (i.total_price_cents ?? 0), 0);
        const st = STATUS_LABELS[c.status] ?? { label: c.status.toUpperCase(), tone: "neutral" as const };
        const itemMeta = ITEM_LABEL[c.status] ?? { label: "Aguardando contrato assinado", tone: "warning" as const, icon: Clock };
        const ItemIcon = itemMeta.icon;
        const canUpload = isUploadable(c.status);
        const rejectionReason = c.status === "rejected"
          ? (c.validation_details?.motivo_falha || c.validation_details?.motivo || "Assinatura digital não pôde ser validada.")
          : null;
        const itemTone = toneColors(itemMeta.tone);

        return (
          <div key={c.id} style={{
            background: D.paper, border: `1px solid ${D.border}`, borderRadius: 14,
            overflow: "hidden",
          }}>
            <div style={{ height: 2, background: `linear-gradient(to right, ${D.red}, ${D.redDeep})` }} />
            <div style={{ padding: "14px 16px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 9, minWidth: 0 }}>
                  <div style={{
                    width: 26, height: 26, borderRadius: 8, background: D.redAlpha,
                    display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                  }}>
                    <FileText size={13} color={D.red} />
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: D.ink, lineHeight: 1.3 }}>
                      {c.contract_number ?? `Contrato ${c.id.slice(0, 8)}`}
                    </div>
                    <div style={{ fontSize: 10, color: D.inkFaint, marginTop: 1 }}>
                      Venda #{c.venda_id} · emitido em {formatDate(c.issued_at ?? c.created_at)}
                    </div>
                  </div>
                </div>
                <StatusPill tone={st.tone} label={st.label} />
              </div>

              {rejectionReason && (
                <div style={{
                  marginTop: 10, padding: "8px 10px", borderRadius: 8,
                  background: D.dangerAlpha, border: `1px solid ${D.dangerBorder}`,
                  fontSize: 10.5, color: D.danger,
                }}>
                  <strong style={{ textTransform: "uppercase", letterSpacing: "0.05em" }}>Motivo: </strong>
                  {rejectionReason}
                </div>
              )}

              {its.length > 0 && (
                <div style={{ marginTop: 12, paddingTop: 10, borderTop: `1px solid ${D.borderSoft}`, display: "flex", flexDirection: "column", gap: 8 }}>
                  {its.map((i) => (
                    <div key={i.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 11, fontWeight: 600, color: D.inkSoft, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {i.service_name_snapshot ?? "Serviço"}
                        </div>
                        <div style={{ fontSize: 9.5, color: D.inkFaint, marginTop: 1 }}>{brl(i.total_price_cents)}</div>
                      </div>
                      <span style={{
                        display: "inline-flex", alignItems: "center", gap: 4, whiteSpace: "nowrap",
                        fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em",
                        color: itemTone.color, background: itemTone.bg, border: `1px solid ${itemTone.border}`,
                        borderRadius: 99, padding: "3px 8px",
                      }}>
                        <ItemIcon size={10} /> {itemMeta.label}
                      </span>
                    </div>
                  ))}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 8, borderTop: `1px solid ${D.borderSoft}` }}>
                    <span style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: D.inkFaint }}>Total</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: D.ink }}>{brl(total)}</span>
                  </div>
                </div>
              )}

              <input
                ref={(el) => (fileInputs.current[c.id] = el)}
                type="file"
                accept="application/pdf,.pdf"
                style={{ display: "none" }}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void handleUpload(c, f);
                  e.target.value = "";
                }}
              />

              <div style={{ marginTop: 14, display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "flex-end" }}>
                <button
                  type="button"
                  onClick={() => downloadContract(c)}
                  disabled={downloadingId === c.id}
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 6,
                    padding: "8px 14px", borderRadius: 8, border: `1px solid ${D.redAlphaStrong}`,
                    background: D.paper, color: D.redDeep,
                    fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em",
                    cursor: downloadingId === c.id ? "default" : "pointer",
                    opacity: downloadingId === c.id ? 0.6 : 1,
                  }}
                >
                  {downloadingId === c.id ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
                  {downloadingId === c.id ? "Baixando…" : "Baixar contrato"}
                </button>

                {c.status === "rejected" && (
                  <button
                    type="button"
                    onClick={() => revalidate(c)}
                    disabled={revalidatingId === c.id}
                    style={{
                      display: "inline-flex", alignItems: "center", gap: 6,
                      padding: "8px 14px", borderRadius: 8, border: `1px solid ${D.dangerBorder}`,
                      background: D.dangerAlpha, color: D.danger,
                      fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em",
                      cursor: revalidatingId === c.id ? "default" : "pointer",
                      opacity: revalidatingId === c.id ? 0.6 : 1,
                    }}
                  >
                    {revalidatingId === c.id ? <Loader2 size={13} className="animate-spin" /> : <ShieldCheck size={13} />}
                    {revalidatingId === c.id ? "Revalidando…" : "Revalidar assinatura"}
                  </button>
                )}

                {canUpload && (
                  <button
                    type="button"
                    onClick={() => fileInputs.current[c.id]?.click()}
                    disabled={uploadingId === c.id}
                    style={{
                      display: "inline-flex", alignItems: "center", gap: 6,
                      padding: "8px 16px", borderRadius: 8, border: "none",
                      background: `linear-gradient(135deg, ${D.red} 0%, ${D.redDeep} 100%)`, color: "#fff",
                      fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em",
                      cursor: uploadingId === c.id ? "default" : "pointer",
                      opacity: uploadingId === c.id ? 0.7 : 1,
                      boxShadow: `0 4px 14px ${D.redGlow}`,
                    }}
                  >
                    {uploadingId === c.id ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
                    {uploadingId === c.id ? "Enviando…" : "Enviar contrato assinado"}
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
