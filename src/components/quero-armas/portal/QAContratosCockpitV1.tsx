/**
 * QAContratosCockpitV1 — Layout V1 · Stepper Detalhado.
 * Espelha o Cockpit Z6 do Processo 1 aplicado à seção Contratos.
 * Visual aprovado em /mnt/documents/contratos_v1_final_proposta_v3.png.
 *
 * Carrega TODOS os contratos do cliente, computa KPIs e renderiza:
 * 1) Header cliente-centric (H1 + meta CPF/membro/contagem)
 * 2) FOCO DO DIA bloqueante quando há contrato aguardando assinatura
 * 3) 6 KPIs (Aguarda você / Em assinatura / Assinados / Em vigência / Valor / Expira em)
 * 4) Contrato em destaque com PROGRESSO + Stepper 5 etapas + Linha do tempo + Checklist + Próximo passo
 * 5) Outros contratos em variante compacta (5 segmentos)
 *
 * Não toca em ContratoBlock / fluxos críticos — é apenas a apresentação visual da seção.
 */
import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ArrowRight, CheckCircle2, Download, Upload, Loader2, Clock } from "lucide-react";
import { openMinutaContratoQueroArmas, prepareMinutaContratoQueroArmas, type PreparedMinutaDownload } from "@/lib/quero-armas/minutaContratoDownload";
import { toast } from "sonner";

type Tone = "amber" | "blue" | "green" | "bordo" | "gray" | "red";

interface Contract {
  id: string;
  cliente_id: number | null;
  venda_id: number | null;
  contract_number: string | null;
  status: string | null;
  validation_status: string | null;
  issued_at: string | null;
  company_signed_at: string | null;
  customer_uploaded_at: string | null;
  customer_signature_validated_at: string | null;
  total_amount?: number | null;
  service_label?: string | null;
  created_at?: string | null;
  validation_details?: any;
}

const STEP_LABELS = ["Gerado", "Revisado", "Assinatura", "Validação", "Vigente"] as const;

function statusToStep(status: string | null): number {
  switch (status) {
    case "generated_pending_company_signature": return 1; // gerado, aguarda revisão
    case "pending_customer_signature":          return 2; // assinatura cliente em andamento
    case "customer_signature_uploaded":         return 3; // validação inicial
    case "validating":                          return 3;
    case "pending_manual_review":               return 3;
    case "validated":                           return 4; // vigente
    case "rejected":                            return 2; // volta p/ assinatura
    default:                                    return 0;
  }
}

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  generated_pending_company_signature: { label: "AGUARDA REVISÃO", cls: "bg-[#E0EAF7] text-[#1F4D8A]" },
  pending_customer_signature:          { label: "AGUARDA SUA ASSINATURA", cls: "bg-[#FCEFCE] text-[#7A5A14]" },
  customer_signature_uploaded:         { label: "EM ASSINATURA", cls: "bg-[#E0EAF7] text-[#1F4D8A]" },
  validating:                          { label: "EM VALIDAÇÃO", cls: "bg-[#E0EAF7] text-[#1F4D8A]" },
  pending_manual_review:               { label: "EM REVISÃO MANUAL", cls: "bg-[#FCEFCE] text-[#7A5A14]" },
  validated:                           { label: "VIGENTE", cls: "bg-[#E3F2E8] text-[#1F6638]" },
  rejected:                            { label: "REJEITADO — REENVIAR", cls: "bg-[#FCE3E1] text-[#8A1410]" },
};

function fmtDateShort(d: string | null | undefined): string {
  if (!d) return "—";
  try {
    const p = new Date(d);
    if (isNaN(p.getTime())) return "—";
    return p.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
  } catch { return "—"; }
}
function fmtDateLong(d: string | null | undefined): string {
  if (!d) return "—";
  try {
    const p = new Date(d);
    if (isNaN(p.getTime())) return "—";
    return p.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" }).toUpperCase().replace(/\./g, "");
  } catch { return "—"; }
}
function daysSince(d: string | null | undefined): number | null {
  if (!d) return null;
  try {
    const p = new Date(d);
    if (isNaN(p.getTime())) return null;
    return Math.floor((Date.now() - p.getTime()) / 86400000);
  } catch { return null; }
}
function fmtMemberSince(d: string | null | undefined): string {
  if (!d) return "—";
  try {
    const p = new Date(d);
    if (isNaN(p.getTime())) return "—";
    return p.toLocaleDateString("pt-BR", { month: "short", year: "numeric" }).toUpperCase().replace(/\./g, "");
  } catch { return "—"; }
}
function maskCpf(cpf: string | null | undefined): string {
  const d = String(cpf || "").replace(/\D/g, "");
  if (d.length !== 11) return cpf || "—";
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}
function formatBRLKpi(v: number): string {
  if (!v || v <= 0) return "R$ 0";
  if (v >= 1000) return `R$ ${(v / 1000).toFixed(v >= 10000 ? 0 : 1)}K`;
  return `R$ ${Math.round(v)}`;
}

interface Props {
  cliente: any;
}

export default function QAContratosCockpitV1({ cliente }: Props) {
  const [loading, setLoading] = useState(true);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [valorPago, setValorPago] = useState<number>(0);
  const [reloadKey, setReloadKey] = useState(0);
  const [preparedFeaturedDownload, setPreparedFeaturedDownload] = useState<PreparedMinutaDownload | null>(null);
  const [preparingFeaturedDownload, setPreparingFeaturedDownload] = useState(false);

  useEffect(() => {
    if (!cliente?.id) { setLoading(false); return; }
    let cancel = false;
    (async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from("qa_contracts" as any)
          .select("id, cliente_id, venda_id, contract_number, status, validation_status, issued_at, company_signed_at, customer_uploaded_at, customer_signature_validated_at, valor, servico_slug, created_at, validation_details")
          .eq("cliente_id", cliente.id)
          .order("created_at", { ascending: false });
        if (error) console.warn("[QAContratosCockpitV1] qa_contracts:", error.message);
        if (!cancel) {
          const mapped = ((data as any) || []).map((r: any) => ({
            ...r,
            total_amount: r.valor ?? null,
            service_label: r.servico_slug ?? null,
          })) as Contract[];
          setContracts(mapped);
        }
      } catch (e) {
        console.warn("[QAContratosCockpitV1] erro:", e);
        if (!cancel) setContracts([]);
      } finally {
        if (!cancel) setLoading(false);
      }
    })();
    return () => { cancel = true; };
  }, [cliente?.id, reloadKey]);

  // Valor total = soma do PREÇO DO CATÁLOGO dos itens de vendas PAGAS
  // (status = 'PAGO' e cobranca_status != 'cancelada'). Cancelamentos removem
  // automaticamente do total via realtime abaixo.
  useEffect(() => {
    if (!cliente?.id) { setValorPago(0); return; }
    let cancel = false;
    (async () => {
      try {
        const { data, error } = await supabase
          .from("qa_vendas" as any)
          .select("id, status, cobranca_status, qa_itens_venda(servico_id, qa_servicos_catalogo(preco))")
          .eq("cliente_id", cliente.id)
          .eq("status", "PAGO");
        if (error) { console.warn("[QAContratosCockpitV1] vendas pagas:", error.message); return; }
        if (cancel) return;
        const total = ((data as any) || [])
          .filter((v: any) => v.cobranca_status !== "cancelada")
          .reduce((sum: number, v: any) => {
            const itens = Array.isArray(v.qa_itens_venda) ? v.qa_itens_venda : [];
            return sum + itens.reduce((s: number, it: any) => {
              const preco = Number(it?.qa_servicos_catalogo?.preco) || 0;
              return s + preco;
            }, 0);
          }, 0);
        setValorPago(total);
      } catch (e) {
        console.warn("[QAContratosCockpitV1] valor pago:", e);
        if (!cancel) setValorPago(0);
      }
    })();
    return () => { cancel = true; };
  }, [cliente?.id, reloadKey]);

  // Realtime: refresh on any update for this cliente's contracts
  useEffect(() => {
    if (!cliente?.id) return;
    const ch = supabase
      .channel(`qa_contratos_v1_${cliente.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "qa_contracts", filter: `cliente_id=eq.${cliente.id}` },
        () => setReloadKey((k) => k + 1))
      .on("postgres_changes", { event: "*", schema: "public", table: "qa_vendas", filter: `cliente_id=eq.${cliente.id}` },
        () => setReloadKey((k) => k + 1))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [cliente?.id]);

  // KPIs derivados
  const kpis = useMemo(() => {
    const aguarda = contracts.filter((c) => c.status === "pending_customer_signature").length;
    const emAssin = contracts.filter((c) => ["customer_signature_uploaded", "validating", "pending_manual_review"].includes(String(c.status))).length;
    const assinados = contracts.filter((c) => c.status === "validated").length;
    const vigentes = assinados; // simplificação: validados = vigentes
    const valor = valorPago;
    return { aguarda, emAssin, assinados, vigentes, valor };
  }, [contracts, valorPago]);

  // Featured: primeiro aguardando cliente, senão primeiro em assinatura, senão mais recente
  const featured = useMemo<Contract | null>(() => {
    if (!contracts.length) return null;
    return (
      contracts.find((c) => c.status === "pending_customer_signature") ||
      contracts.find((c) => ["customer_signature_uploaded", "validating", "pending_manual_review"].includes(String(c.status))) ||
      contracts[0]
    );
  }, [contracts]);

  const others = useMemo(() => contracts.filter((c) => c.id !== featured?.id), [contracts, featured]);

  const nomeCliente = String(cliente?.nome_completo || cliente?.nome || "Cliente").trim();
  const primeiroNome = (nomeCliente.split(/\s+/)[0] || "Cliente").toUpperCase();
  const cpf = maskCpf(cliente?.cpf);
  const membro = fmtMemberSince(cliente?.created_at);

  const focoBloqueante =
    featured &&
    (featured.status === "pending_customer_signature" || featured.status === "rejected");

  useEffect(() => {
    if (!featured?.id) {
      setPreparedFeaturedDownload((prev) => {
        prev?.revoke();
        return null;
      });
      return;
    }

    let alive = true;
    setPreparingFeaturedDownload(true);
    setPreparedFeaturedDownload((prev) => {
      prev?.revoke();
      return null;
    });

    prepareMinutaContratoQueroArmas({
      contractId: featured.id,
      contractNumber: featured.contract_number,
      vendaId: featured.venda_id,
    })
      .then((prepared) => {
        if (!alive) {
          prepared.revoke();
          return;
        }
        setPreparedFeaturedDownload(prepared);
      })
      .catch((e) => console.warn("[QAContratosCockpitV1] preparar contrato:", e))
      .finally(() => {
        if (alive) setPreparingFeaturedDownload(false);
      });

    return () => {
      alive = false;
    };
  }, [featured?.id]);

  useEffect(() => {
    return () => preparedFeaturedDownload?.revoke();
  }, [preparedFeaturedDownload]);

  const handleAssinar = async () => {
    if (!featured) return;
    if (preparedFeaturedDownload) {
      const a = document.createElement("a");
      a.href = preparedFeaturedDownload.href;
      a.download = preparedFeaturedDownload.filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      toast.success("Download iniciado.");
      return;
    }
    const toastId = toast.loading("Preparando contrato correto…");
    try {
      await openMinutaContratoQueroArmas({
        contractId: featured.id,
        contractNumber: featured.contract_number,
        vendaId: featured.venda_id,
      });
      toast.success("Contrato pronto para baixar.", { id: toastId });
    } catch (e) {
      console.warn("[QAContratosCockpitV1] abrir contrato:", e);
      toast.error(e instanceof Error ? e.message : "Não foi possível baixar o contrato.", { id: toastId });
    }
  };

  if (loading) {
    return (
      <div className="rounded-sm border border-[#E5E5E5] bg-white p-8 text-center text-[12px] text-[#6A6A6A]">
        Carregando contratos…
      </div>
    );
  }

  if (!contracts.length) {
    return (
      <div className="rounded-sm border border-[#E5E5E5] bg-white p-10 text-center text-[13px] text-[#6A6A6A]">
        Você ainda não possui contratos.
      </div>
    );
  }

  return (
    <div className="text-[#0A0A0A]" style={{ fontFamily: "'Inter', sans-serif" }}>
      {/* ── Cabeçalho cliente-centric ── */}
      <header className="mb-5">
        <h1 className="font-['Oswald'] text-[24px] font-bold tracking-[0.04em] uppercase leading-[1.05] text-[#0A0A0A] m-0">
          {primeiroNome}, ESSES SÃO SEUS CONTRATOS
        </h1>
        <div className="mt-[11px] font-['Arial_Narrow'] font-black text-[10px] tracking-[0.22em] text-[#6A6A6A] uppercase">
          CPF · <b className="text-[#0A0A0A] font-semibold">{cpf}</b> · MEMBRO DESDE <b className="text-[#0A0A0A] font-semibold">{membro}</b>
          {kpis.aguarda > 0 && <> · <b className="text-[#0A0A0A] font-semibold">{kpis.aguarda} CONTRATO{kpis.aguarda > 1 ? "S" : ""}</b> AGUARDANDO ASSINATURA</>}
        </div>
      </header>

      {/* ── FOCO DO DIA bloqueante ── */}
      {focoBloqueante && (
        <div className="mb-5 bg-white border border-[#E5E5E5] border-l-4 border-l-[#C32E26] rounded-sm px-5 py-4 flex items-center gap-4">
          <div className="flex-1">
            <div className="font-['Oswald'] text-[9.5px] tracking-[0.18em] text-[#C32E26] font-bold mb-1 uppercase">
              FOCO DO DIA · <span className="text-[#0A0A0A]">
                {featured?.status === "rejected" ? "ASSINATURA REJEITADA" : "AÇÃO BLOQUEANTE"}
              </span>
            </div>
            <div className="text-[13px] text-[#0A0A0A] font-medium">
              {featured?.status === "rejected"
                ? <>O PDF enviado não é o contrato {featured?.contract_number}. Baixe o contrato deste sistema, assine no GOV.BR sem editar e reenvie.</>
                : <>Contrato {featured?.contract_number || ""} aguarda sua assinatura via GOV.BR</>}
            </div>
          </div>
          {preparedFeaturedDownload ? (
            <a
              href={preparedFeaturedDownload.href}
              download={preparedFeaturedDownload.filename}
              onClick={() => toast.success("Download iniciado.")}
              className="bg-[#0A0A0A] text-white px-4 py-2 rounded-sm font-['Oswald'] text-[10px] tracking-[0.18em] font-semibold uppercase inline-flex items-center gap-2 hover:bg-black"
            >
              {featured?.status === "rejected" ? "BAIXAR CONTRATO CERTO" : "ASSINAR AGORA"} <ArrowRight className="h-3 w-3" />
            </a>
          ) : (
            <button
              type="button"
              onClick={handleAssinar}
              disabled={preparingFeaturedDownload}
              className="bg-[#0A0A0A] text-white px-4 py-2 rounded-sm font-['Oswald'] text-[10px] tracking-[0.18em] font-semibold uppercase inline-flex items-center gap-2 hover:bg-black disabled:opacity-60 disabled:cursor-wait"
            >
              {preparingFeaturedDownload ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
              {preparingFeaturedDownload ? "PREPARANDO PDF" : (featured?.status === "rejected" ? "BAIXAR CONTRATO CERTO" : "ASSINAR AGORA")} <ArrowRight className="h-3 w-3" />
            </button>
          )}
        </div>
      )}

      {/* ── 6 KPIs ── */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2.5 mb-6">
        <KpiCard tone="amber" label="AGUARDA VOCÊ" value={kpis.aguarda} sub="contratos para assinar" />
        <KpiCard tone="blue"  label="EM ASSINATURA" value={kpis.emAssin} sub="aguardando contraparte" />
        <KpiCard tone="green" label="ASSINADOS" value={kpis.assinados} sub="no histórico" />
        <KpiCard tone="bordo" label="EM VIGÊNCIA" value={kpis.vigentes} sub="contratos ativos" />
        <KpiCard tone="gray"  label="VALOR TOTAL" value={formatBRLKpi(kpis.valor)} sub="pedidos pagos" />
        <KpiCard tone="red"   label="EXPIRA EM" value={contracts.length ? "—" : "0"} sub="renovação contratual" />
      </div>

      {/* ── Contrato em destaque ── */}
      {featured && (
        <>
          <div className="font-['Oswald'] text-[10px] tracking-[0.22em] text-[#7A7A7A] mb-2.5 font-semibold uppercase">
            CONTRATO PRINCIPAL · EM DESTAQUE
          </div>
          <FeaturedContractCard contract={featured} onAssinar={handleAssinar} preparedDownload={preparedFeaturedDownload} preparingDownload={preparingFeaturedDownload} />
        </>
      )}

      {/* ── Outros contratos ── */}
      {others.length > 0 && (
        <>
          <div className="font-['Oswald'] text-[10px] tracking-[0.22em] text-[#7A7A7A] mt-6 mb-2.5 font-semibold uppercase">
            OUTROS CONTRATOS
          </div>
          <div className="space-y-3">
            {others.map((c) => <CompactContractCard key={c.id} contract={c} />)}
          </div>
        </>
      )}
    </div>
  );
}

/* ─────────────────────── KPI ─────────────────────── */
function KpiCard({ tone, label, value, sub }: { tone: Tone; label: string; value: React.ReactNode; sub: string }) {
  const dot = ({ amber:"bg-[#D6A64B]", blue:"bg-[#3A6FB3]", green:"bg-[#2F8F4A]", bordo:"bg-[#7A1F2B]", gray:"bg-[#8A8A8A]", red:"bg-[#C32E26]" } as Record<Tone,string>)[tone];
  return (
    <div className="bg-white border border-[#E5E5E5] rounded-sm px-3.5 py-3.5">
      <div className="font-['Oswald'] text-[9px] tracking-[0.18em] text-[#0A0A0A] font-semibold uppercase flex items-center gap-1.5">
        <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
        {label}
      </div>
      <div className="font-['Oswald'] text-[28px] font-semibold mt-1.5 leading-none">{value}</div>
      <div className="text-[10.5px] text-[#7A7A7A] mt-1.5">{sub}</div>
    </div>
  );
}

/* ─────────────────── FEATURED ─────────────────── */
function FeaturedContractCard({
  contract,
  onAssinar,
  preparedDownload,
  preparingDownload,
}: {
  contract: Contract;
  onAssinar: () => void;
  preparedDownload: PreparedMinutaDownload | null;
  preparingDownload: boolean;
}) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = React.useState(false);
  const [showDone, setShowDone] = React.useState(false);
  const prevStatusRef = React.useRef<string | null>(null);

  // Abre o modal de conclusão quando o contrato transita para "validated"
  // (ou já entra validado sem que o cliente tenha visto a comemoração).
  React.useEffect(() => {
    const status = String(contract.status || "");
    const seenKey = `qa_contract_completed_seen_${contract.id}`;
    const already = typeof window !== "undefined" && window.localStorage.getItem(seenKey);
    if (status === "validated" && !already) {
      // pequena espera para não competir com toast/realtime
      const t = setTimeout(() => setShowDone(true), 350);
      return () => clearTimeout(t);
    }
    prevStatusRef.current = status;
  }, [contract.status, contract.id]);

  function closeDone() {
    try { window.localStorage.setItem(`qa_contract_completed_seen_${contract.id}`, "1"); } catch {}
    setShowDone(false);
  }

  const canUpload = !!contract.issued_at && [
    "generated_pending_company_signature",
    "pending_customer_signature",
    "rejected",
    "pending_manual_review",
    "customer_signature_uploaded",
  ].includes(String(contract.status));

  async function handleUpload(file: File) {
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      toast.error("Envie apenas arquivo PDF");
      return;
    }
    if (file.size > 25 * 1024 * 1024) {
      toast.error("Arquivo maior que 25 MB");
      return;
    }
    setUploading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const fd = new FormData();
      fd.append("contract_id", contract.id);
      fd.append("file", file);
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/qa-upload-signed-contract`;
      const resp = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session?.access_token ?? ""}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: fd,
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(data.error || `HTTP ${resp.status}`);
      toast.success("Contrato enviado. Validação em andamento.");
    } catch (e: any) {
      toast.error(e?.message || "Falha ao enviar contrato");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  const step = statusToStep(contract.status);                          // 0..4
  const stepIndex1Based = step + 1;
  const progress = Math.round(((step + 1) / 5) * 100);
  const badge = STATUS_BADGE[String(contract.status)] || { label: String(contract.status || "—").toUpperCase(), cls: "bg-[#EDEDED] text-[#444]" };
  const openedDays = daysSince(contract.issued_at);

  const timelineEvents = useMemo(() => {
    const evs: Array<{ date: string | null; t: string; ok: boolean }> = [];
    if (contract.issued_at) evs.push({ date: contract.issued_at, t: "Contrato gerado pela equipe", ok: true });
    if (contract.company_signed_at) evs.push({ date: contract.company_signed_at, t: "Revisão jurídica aprovada", ok: true });
    if (contract.status === "pending_customer_signature")
      evs.push({ date: contract.company_signed_at || contract.issued_at, t: "Aguardando assinatura via GOV.BR", ok: false });
    if (contract.customer_uploaded_at)
      evs.push({ date: contract.customer_uploaded_at, t: "Assinatura recebida", ok: true });
    if (contract.customer_signature_validated_at)
      evs.push({ date: contract.customer_signature_validated_at, t: "Assinatura validada ICP-Brasil", ok: true });
    else if (["customer_signature_uploaded","validating","pending_manual_review"].includes(String(contract.status)))
      evs.push({ date: null, t: "Validação ICP-Brasil", ok: false });
    return evs;
  }, [contract]);

  const checklist = useMemo(() => buildChecklist(contract), [contract]);
  const nextAuto = useMemo(() => buildNextAuto(contract), [contract]);

  return (
    <div className="bg-white border border-[#E5E5E5] rounded-sm p-5">
      {/* topo */}
      <div className="flex items-center justify-between gap-3 pb-4 mb-5 border-b border-[#EFEFEF]">
        <div className="flex items-center gap-3 min-w-0">
          <span className={`font-['Oswald'] text-[9.5px] px-2 py-1 tracking-[0.16em] rounded-sm font-bold uppercase ${badge.cls}`}>
            {badge.label}
          </span>
          <h2 className="font-['Oswald'] text-[13px] tracking-[0.06em] font-semibold uppercase truncate">
            {contract.contract_number || "—"}{contract.service_label ? ` · ${contract.service_label}` : ""}
          </h2>
        </div>
        <div className="flex items-center gap-3 whitespace-nowrap">
          <div className="font-['Oswald'] text-[10px] text-[#7A7A7A] tracking-[0.16em] uppercase">
            PROTOCOLO · CONTRATO {(contract.contract_number || "—").replace(/\s+/g, "")}
          </div>
          {contract.issued_at && preparedDownload ? (
            <a
              href={preparedDownload.href}
              download={preparedDownload.filename}
              onClick={() => toast.success("Download iniciado.")}
              className="border border-[#E5E5E5] bg-white text-[#0A0A0A] px-3 py-1.5 rounded-sm font-['Oswald'] text-[10px] tracking-[0.18em] font-semibold uppercase inline-flex items-center gap-1.5 hover:border-[#0A0A0A] hover:bg-[#0A0A0A] hover:text-white transition-all duration-200"
            >
              <Download className="h-3 w-3" /> BAIXAR CONTRATO
            </a>
          ) : contract.issued_at ? (
            <button
              type="button"
              onClick={onAssinar}
              disabled={preparingDownload}
              className="border border-[#E5E5E5] bg-white text-[#0A0A0A] px-3 py-1.5 rounded-sm font-['Oswald'] text-[10px] tracking-[0.18em] font-semibold uppercase inline-flex items-center gap-1.5 hover:border-[#0A0A0A] hover:bg-[#0A0A0A] hover:text-white disabled:opacity-60 disabled:cursor-wait transition-all duration-200"
            >
              {preparingDownload ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />} {preparingDownload ? "PREPARANDO PDF" : "BAIXAR CONTRATO"}
            </button>
          ) : null}
          {canUpload && (
            <>
              <input
                ref={inputRef}
                type="file"
                accept="application/pdf,.pdf"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleUpload(f);
                }}
              />
              <button
                type="button"
                disabled={uploading}
                onClick={() => inputRef.current?.click()}
                className="border border-[#0A0A0A] bg-[#0A0A0A] text-white px-3 py-1.5 rounded-sm font-['Oswald'] text-[10px] tracking-[0.18em] font-semibold uppercase inline-flex items-center gap-1.5 hover:bg-black disabled:opacity-60 disabled:cursor-not-allowed transition-all duration-200"
                title="Enviar PDF assinado (GOV.BR ou ICP-Brasil)"
              >
                {uploading
                  ? <Loader2 className="h-3 w-3 animate-spin" />
                  : <Upload className="h-3 w-3" />}
                ENVIAR ASSINADO
              </button>
            </>
          )}
        </div>
      </div>

      {/* painel SLA — acompanhamento pós-envio */}
      <ValidationSLAPanel contract={contract} />

      {/* aviso de rejeição — passo a passo claro */}
      {contract.status === "rejected" && (
        <div className="mb-5 border border-[#F4C6C2] bg-[#FDECEA] rounded-sm px-4 py-3.5">
          <div className="font-['Oswald'] text-[10px] tracking-[0.18em] text-[#8A1410] font-bold uppercase mb-1.5">
            ASSINATURA REJEITADA · PRÓXIMOS PASSOS
          </div>
          <div className="text-[12px] text-[#5a1410] leading-relaxed mb-2.5">
            {contract.validation_details?.motivo_falha
              || "O PDF enviado não confere byte-a-byte com o contrato original deste sistema."}
          </div>
          <ol className="text-[12px] text-[#0A0A0A] space-y-1 pl-4 list-decimal mb-3">
            <li>Clique em <b>BAIXAR CONTRATO</b> aqui em cima e salve o PDF.</li>
            <li>Abra <b>assinador.iti.br</b> (GOV.BR), envie esse PDF e assine — <b>não edite, não imprima e não digitalize</b>.</li>
            <li>Baixe o PDF assinado e clique em <b>ENVIAR ASSINADO</b>.</li>
          </ol>
          <div className="flex gap-2 flex-wrap">
            {preparedDownload ? (
              <a
                href={preparedDownload.href}
                download={preparedDownload.filename}
                onClick={() => toast.success("Download iniciado.")}
                className="bg-[#0A0A0A] text-white px-3 py-1.5 rounded-sm font-['Oswald'] text-[10px] tracking-[0.18em] font-semibold uppercase inline-flex items-center gap-1.5 hover:bg-black"
              >
                <Download className="h-3 w-3" /> BAIXAR CONTRATO CERTO
              </a>
            ) : (
              <button
                type="button"
                onClick={onAssinar}
                disabled={preparingDownload}
                className="bg-[#0A0A0A] text-white px-3 py-1.5 rounded-sm font-['Oswald'] text-[10px] tracking-[0.18em] font-semibold uppercase inline-flex items-center gap-1.5 hover:bg-black disabled:opacity-60 disabled:cursor-wait"
              >
                {preparingDownload ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />} {preparingDownload ? "PREPARANDO PDF" : "BAIXAR CONTRATO CERTO"}
              </button>
            )}
            <a
              href="https://assinador.iti.br/"
              target="_blank"
              rel="noopener noreferrer"
              className="border border-[#0A0A0A] text-[#0A0A0A] px-3 py-1.5 rounded-sm font-['Oswald'] text-[10px] tracking-[0.18em] font-semibold uppercase inline-flex items-center gap-1.5 hover:bg-[#0A0A0A] hover:text-white"
            >
              ABRIR ASSINADOR GOV.BR
            </a>
          </div>
        </div>
      )}

      {/* stepper */}
      <div className="flex gap-0 mb-5 py-1.5">
        {STEP_LABELS.map((lbl, i) => {
          const isValidated =
            contract.status === "validated" ||
            contract.validation_status === "valid" ||
            !!contract.customer_signature_validated_at;
          const done = isValidated ? true : i < step;
          const curr = !isValidated && i === step;
          const circBg = done ? "bg-[#2F8F4A] border-[#2F8F4A] text-white" : curr ? "bg-[#D6A64B] border-[#D6A64B] text-white" : "bg-[#F2F2F2] border-[#DADADA] text-[#9a9a9a]";
          const dt = i === 0 ? fmtDateShort(contract.issued_at)
                   : i === 1 ? fmtDateShort(contract.company_signed_at)
                   : i === 2 ? (curr ? "EM ANDAMENTO" : fmtDateShort(contract.customer_uploaded_at))
                   : i === 3 ? (curr ? "EM VALIDAÇÃO" : fmtDateShort(contract.customer_signature_validated_at))
                             : (isValidated ? fmtDateShort(contract.customer_signature_validated_at) : done ? "VIGENTE" : "—");
          return (
            <div key={lbl} className="flex-1 text-center">
              <div className={`w-7 h-7 rounded-full border flex items-center justify-center mx-auto font-['Oswald'] font-semibold text-[11.5px] ${circBg}`}>
                {done ? <CheckCircle2 className="h-3.5 w-3.5" /> : (i + 1)}
              </div>
              <div className="mt-2 text-[11px] text-[#0A0A0A] font-medium">{lbl}</div>
              <div className={`mt-0.5 font-['Oswald'] text-[9.5px] tracking-[0.1em] ${curr ? "text-[#7A5A14] font-bold" : "text-[#9a9a9a]"}`}>{dt}</div>
            </div>
          );
        })}
      </div>

      {/* grid: progresso + linha do tempo + checklist */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.4fr_1.1fr] gap-7">
        {/* coluna progresso */}
        <div>
          <div className="font-['Oswald'] text-[9px] tracking-[0.2em] text-[#7A7A7A] font-semibold uppercase">PROGRESSO</div>
          <div className="font-['Oswald'] text-[42px] font-semibold leading-none mt-1.5">
            {progress}<span className="text-[18px] text-[#555]">%</span>
          </div>
          <div className="mt-2.5 h-[5px] bg-[#EEE] rounded-full overflow-hidden">
            <div className="h-full bg-[#7A1F2B]" style={{ width: `${progress}%` }} />
          </div>
          <div className="mt-4">
            <div className="font-['Oswald'] text-[9px] tracking-[0.2em] text-[#7A7A7A] font-semibold uppercase">ETAPA ATUAL</div>
            <div className="font-['Oswald'] text-[14px] font-semibold mt-1 tracking-[0.04em] uppercase">
              {STEP_LABELS[step] || "—"} {step === 2 ? "GOV.BR" : ""}
            </div>
          </div>
          <div className="mt-3.5 text-[11.5px]">
            <b className="block text-[#0A0A0A] font-semibold">Prev. assinatura:</b>
            <span className="text-[#7A7A7A]">até {fmtDateLong(contract.company_signed_at || contract.issued_at)}</span>
          </div>
          <div className="mt-2.5 text-[11.5px]">
            <b className="block text-[#0A0A0A] font-semibold">Aberto há:</b>
            <span className="text-[#7A7A7A]">{openedDays !== null ? `${openedDays} DIA${openedDays === 1 ? "" : "S"}` : "—"}</span>
          </div>
        </div>

        {/* coluna linha do tempo */}
        <div>
          <div className="font-['Oswald'] text-[10px] tracking-[0.2em] text-[#7A7A7A] font-bold uppercase mb-3.5">
            LINHA DO <span className="text-[#0A0A0A]">TEMPO</span>
          </div>
          <div className="relative pl-4.5" style={{ paddingLeft: 18 }}>
            <div className="absolute left-[4.5px] top-1.5 bottom-1.5 w-px bg-[#E5E5E5]" />
            {timelineEvents.map((ev, i) => (
              <div key={i} className="relative pb-3.5">
                <span className={`absolute -left-[17px] top-[3px] h-2.5 w-2.5 rounded-full border ${ev.ok ? "bg-[#2F8F4A] border-[#2F8F4A]" : "bg-white border-[#C0C0C0]"}`} />
                <div className="font-['Oswald'] text-[10px] text-[#7A7A7A] tracking-[0.08em]">{ev.date ? fmtDateShort(ev.date) + (ev.ok ? "" : " · agora") : "—"}</div>
                <div className="text-[12px] text-[#0A0A0A] font-medium mt-0.5">{ev.t}</div>
              </div>
            ))}
          </div>
        </div>

        {/* coluna checklist */}
        <div>
          <div className="font-['Oswald'] text-[10px] tracking-[0.2em] text-[#7A7A7A] font-bold uppercase mb-3.5">
            CHECKLIST · <span className="text-[#0A0A0A]">ETAPA ATUAL</span>
          </div>
          <div>
            {checklist.map((it, i) => (
              <div key={i} className={`flex justify-between items-center py-2.5 text-[12px] ${i === checklist.length - 1 ? "" : "border-b border-dashed border-[#EFEFEF]"}`}>
                <span className="text-[#0A0A0A]">{it.label}</span>
                <span className={`font-['Oswald'] text-[9px] tracking-[0.14em] px-1.5 py-0.5 rounded-sm font-bold uppercase ${TAG_CLS[it.tag]}`}>{it.tag.toUpperCase()}</span>
              </div>
            ))}
          </div>
          {nextAuto && (
            <div className="mt-3.5 bg-[#FFF5DD] border border-[#F0DDA0] px-3.5 py-3 rounded-sm text-[11.5px] text-[#5a4410]">
              <b className="font-semibold">Próximo passo automático:</b> {nextAuto}
            </div>
          )}
        </div>
      </div>

      {/* ─────────── Modal de conclusão ─────────── */}
      {showDone && (
        <ContractCompletedDialog
          contract={contract}
          onClose={closeDone}
        />
      )}
    </div>
  );
}

const TAG_CLS: Record<string, string> = {
  ok:        "bg-[#E3F2E8] text-[#1F6638]",
  pendente:  "bg-[#FCEFCE] text-[#7A5A14]",
  confirmar: "bg-[#FFF5DD] text-[#7A5A14]",
  aguarda:   "bg-[#EDEDED] text-[#444]",
};

/* ─────────── Modal: contrato concluído / próximos passos ─────────── */
function ContractCompletedDialog({ contract, onClose }: { contract: Contract; onClose: () => void }) {
  function goToProcessos() {
    try { window.localStorage.setItem(`qa_contract_completed_seen_${contract.id}`, "1"); } catch {}
    window.location.href = "/area-do-cliente/processos";
  }
  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center px-4 py-8 bg-black/55 backdrop-blur-[2px] animate-in fade-in duration-200"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="w-full max-w-[520px] bg-white border border-[#E5E5E5] rounded-sm shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* header verde */}
        <div className="bg-[#EAF7EE] border-b border-[#B7E0C2] px-6 py-5 flex items-start gap-3">
          <div className="h-9 w-9 rounded-full bg-[#2F8F4A] text-white flex items-center justify-center shrink-0">
            <CheckCircle2 className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="font-['Oswald'] text-[10px] tracking-[0.22em] text-[#1F6638] font-bold uppercase">
              CONTRATO VIGENTE
            </div>
            <h3 className="font-['Oswald'] text-[18px] tracking-[0.02em] font-semibold uppercase text-[#0A0A0A] mt-0.5 leading-tight">
              Assinatura confirmada!
            </h3>
            <div className="text-[11.5px] text-[#4a6a54] mt-1">
              {contract.contract_number} · liberado em <b>{fmtDateLong(contract.customer_signature_validated_at || contract.customer_uploaded_at)}</b>
            </div>
          </div>
        </div>

        {/* corpo — próximos passos */}
        <div className="px-6 py-5">
          <div className="font-['Oswald'] text-[10px] tracking-[0.2em] text-[#7A7A7A] font-bold uppercase mb-3">
            PRÓXIMOS PASSOS
          </div>
          <ol className="space-y-3 text-[12.5px] text-[#0A0A0A] leading-relaxed">
            <li className="flex gap-3">
              <span className="h-5 w-5 rounded-full bg-[#0A0A0A] text-white text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">1</span>
              <span>
                <b>Abra seu processo em "Meus Processos"</b> — sua pasta já foi criada e recebeu o número de protocolo interno.
              </span>
            </li>
            <li className="flex gap-3">
              <span className="h-5 w-5 rounded-full bg-[#0A0A0A] text-white text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">2</span>
              <span>
                <b>Envie a documentação exigida</b> pelo checklist do serviço. Cada documento sobe pelo próprio processo, com validação automática.
              </span>
            </li>
            <li className="flex gap-3">
              <span className="h-5 w-5 rounded-full bg-[#0A0A0A] text-white text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">3</span>
              <span>
                <b>Nossa equipe monta e protocola</b> junto ao órgão competente. Você recebe atualização por e-mail e WhatsApp a cada etapa.
              </span>
            </li>
          </ol>

          <div className="mt-5 bg-[#F8F8F6] border border-[#E5E5E5] rounded-sm px-3.5 py-3 text-[11.5px] text-[#5a5a5a] leading-relaxed">
            Guarde o contrato assinado (você pode rebaixar por <b>BAIXAR CONTRATO</b>). Ele ficará permanentemente disponível na área <b>Contratos</b>.
          </div>
        </div>

        {/* rodapé — CTAs */}
        <div className="px-6 py-4 bg-[#FAFAFA] border-t border-[#EEE] flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="border border-[#E5E5E5] bg-white text-[#0A0A0A] px-3.5 py-2 rounded-sm font-['Oswald'] text-[10px] tracking-[0.18em] font-semibold uppercase hover:border-[#0A0A0A] transition-colors"
          >
            FECHAR
          </button>
          <button
            type="button"
            onClick={goToProcessos}
            className="bg-[#0A0A0A] text-white px-4 py-2 rounded-sm font-['Oswald'] text-[10px] tracking-[0.18em] font-semibold uppercase inline-flex items-center gap-1.5 hover:bg-black"
          >
            IR PARA MEUS PROCESSOS <ArrowRight className="h-3 w-3" />
          </button>
        </div>
      </div>
    </div>
  );
}

function buildChecklist(contract: Contract): Array<{ label: string; tag: "ok"|"pendente"|"confirmar"|"aguarda" }> {
  const isPendingCustomer = contract.status === "pending_customer_signature";
  const isUploaded = contract.status === "customer_signature_uploaded";
  const isValidated = contract.status === "validated";
  return [
    { label: "Identidade GOV.BR verificada",  tag: isPendingCustomer || isUploaded || isValidated ? "ok" : "aguarda" },
    { label: "Aceite da minuta integral",     tag: isPendingCustomer ? "pendente" : (isUploaded || isValidated ? "ok" : "aguarda") },
    { label: "Selo nível PRATA ou OURO",      tag: isPendingCustomer ? "confirmar" : (isUploaded || isValidated ? "ok" : "aguarda") },
    { label: "Assinatura PAdES aplicada",     tag: isValidated ? "ok" : (isUploaded ? "pendente" : "aguarda") },
  ];
}

function buildNextAuto(contract: Contract): string | null {
  switch (contract.status) {
    case "pending_customer_signature":
      return "ao concluir GOV.BR, o sistema valida ICP-Brasil em até 2 min e libera o processo.";
    case "customer_signature_uploaded":
    case "validating":
      return "validação ICP-Brasil em andamento — liberação automática em até 2 min.";
    case "pending_manual_review":
      return "aguarde — nossa equipe revisará e liberará o contrato manualmente.";
    case "validated":
      return null;
    case "rejected":
      return "reenvie o contrato assinado corretamente para retomar a validação.";
    default:
      return null;
  }
}

/* ─────────────────── COMPACT ─────────────────── */

/**
 * Painel de acompanhamento da análise/validação após o cliente enviar o PDF assinado.
 * - customer_signature_uploaded / validating: contagem regressiva do SLA automático (2 min).
 * - pending_manual_review: aviso de revisão manual (até 1 dia útil).
 * - validated: confirmação com data.
 */
function ValidationSLAPanel({ contract }: { contract: Contract }) {
  const [now, setNow] = useState(() => Date.now());

  const status = String(contract.status || "");
  const isAuto = status === "customer_signature_uploaded" || status === "validating";
  const isManual = status === "pending_manual_review";
  const isValidated = status === "validated";
  const isRelevant = isAuto || isManual || isValidated;

  useEffect(() => {
    if (!isAuto) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [isAuto]);

  if (!isRelevant) return null;

  const sentAt = contract.customer_uploaded_at ? new Date(contract.customer_uploaded_at).getTime() : null;
  const SLA_MS = 2 * 60 * 1000; // 2 min
  const deadline = sentAt ? sentAt + SLA_MS : null;
  const remainingMs = deadline ? deadline - now : null;
  const elapsedSec = sentAt ? Math.max(0, Math.floor((now - sentAt) / 1000)) : null;

  function fmtClock(ms: number) {
    const s = Math.max(0, Math.ceil(ms / 1000));
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
  }

  if (isValidated) {
    return (
      <div className="mb-5 border border-[#B7E0C2] bg-[#EAF7EE] rounded-sm px-4 py-3.5 flex items-start gap-3">
        <CheckCircle2 className="h-4 w-4 text-[#1F6638] mt-0.5" />
        <div className="text-[12px] text-[#1F4A2A] leading-relaxed">
          <div className="font-['Oswald'] text-[10px] tracking-[0.18em] text-[#1F6638] font-bold uppercase mb-0.5">
            ASSINATURA VALIDADA
          </div>
          Contrato liberado em <b>{fmtDateLong(contract.customer_signature_validated_at)}</b>. Seu processo já está ativo.
        </div>
      </div>
    );
  }

  if (isManual) {
    return (
      <div className="mb-5 border border-[#F0DDA0] bg-[#FFF5DD] rounded-sm px-4 py-3.5 flex items-start gap-3">
        <Clock className="h-4 w-4 text-[#7A5A14] mt-0.5" />
        <div className="text-[12px] text-[#5a4410] leading-relaxed">
          <div className="font-['Oswald'] text-[10px] tracking-[0.18em] text-[#7A5A14] font-bold uppercase mb-0.5">
            EM REVISÃO MANUAL · ATÉ 1 DIA ÚTIL
          </div>
          A validação automática não conseguiu concluir. Nossa equipe está revisando manualmente
          {contract.customer_uploaded_at ? <> desde <b>{fmtDateLong(contract.customer_uploaded_at)}</b></> : null}.
          Você receberá um e-mail/WhatsApp assim que aprovarmos.
        </div>
      </div>
    );
  }

  // isAuto — contagem regressiva
  const stillWithinSla = remainingMs !== null && remainingMs > 0;
  const overdue = remainingMs !== null && remainingMs <= 0;
  const pct = deadline && sentAt
    ? Math.min(100, Math.max(0, Math.round(((now - sentAt) / SLA_MS) * 100)))
    : 0;

  return (
    <div className="mb-5 border border-[#C9D9F0] bg-[#EEF4FC] rounded-sm px-4 py-3.5">
      <div className="flex items-start gap-3">
        <Loader2 className="h-4 w-4 text-[#1F4D8A] mt-0.5 animate-spin" />
        <div className="flex-1 min-w-0">
          <div className="font-['Oswald'] text-[10px] tracking-[0.18em] text-[#1F4D8A] font-bold uppercase mb-0.5">
            ANÁLISE DA ASSINATURA EM ANDAMENTO
          </div>
          <div className="text-[12px] text-[#0A0A0A] leading-relaxed">
            Recebemos seu PDF{contract.customer_uploaded_at ? <> em <b>{fmtDateLong(contract.customer_uploaded_at)}</b></> : null}
            {elapsedSec !== null ? <> · há <b>{elapsedSec < 60 ? `${elapsedSec}s` : `${Math.floor(elapsedSec / 60)}m ${elapsedSec % 60}s`}</b></> : null}.
            Validação automática ICP-Brasil conclui em até <b>2 minutos</b>.
          </div>
          <div className="mt-2.5 flex items-center gap-3">
            <div className="flex-1 h-[5px] bg-white border border-[#D6E0F0] rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-500 ${overdue ? "bg-[#7A5A14]" : "bg-[#1F4D8A]"}`}
                style={{ width: `${pct}%` }}
              />
            </div>
            <div className="font-['Oswald'] text-[11px] tracking-[0.1em] font-bold tabular-nums whitespace-nowrap">
              {stillWithinSla ? (
                <span className="text-[#1F4D8A]">TEMPO RESTANTE {fmtClock(remainingMs!)}</span>
              ) : (
                <span className="text-[#7A5A14]">FINALIZANDO…</span>
              )}
            </div>
          </div>
          {overdue && (
            <div className="mt-2 text-[11.5px] text-[#5a4410]">
              Passou do tempo previsto — se em alguns minutos o status não mudar, cairá em
              <b> revisão manual</b> automaticamente. Você não precisa fazer nada.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function CompactContractCard({ contract }: { contract: Contract }) {
  const step = statusToStep(contract.status);
  const badge = STATUS_BADGE[String(contract.status)] || { label: String(contract.status || "—").toUpperCase(), cls: "bg-[#EDEDED] text-[#444]" };
  return (
    <div className="bg-white border border-[#E5E5E5] rounded-sm p-5">
      <div className="flex items-center justify-between pb-3.5 mb-3.5 border-b border-[#EFEFEF]">
        <div className="flex items-center gap-3 min-w-0">
          <span className={`font-['Oswald'] text-[9.5px] px-2 py-1 tracking-[0.16em] rounded-sm font-bold uppercase ${badge.cls}`}>{badge.label}</span>
          <h3 className="font-['Oswald'] text-[13px] font-semibold tracking-[0.06em] uppercase truncate">
            {contract.contract_number || "—"}{contract.service_label ? ` · ${contract.service_label}` : ""}
          </h3>
        </div>
        <div className="font-['Oswald'] text-[10px] text-[#7A7A7A] tracking-[0.16em] uppercase">CONTRATO {(contract.contract_number || "—").replace(/\s+/g,"")}</div>
      </div>
      <div className="grid grid-cols-5 gap-2.5 mb-3.5">
        {STEP_LABELS.map((_, i) => (
          <div key={i} className={`h-1 rounded-full ${i < step ? "bg-[#2F8F4A]" : i === step ? "bg-[#D6A64B]" : "bg-[#E5E5E5]"}`} />
        ))}
      </div>
      <div className="grid grid-cols-5 gap-2.5 font-['Oswald'] text-[9.5px] tracking-[0.16em] text-[#7A7A7A] text-center font-semibold mb-3.5">
        {STEP_LABELS.map((l) => <div key={l}>{l.toUpperCase()}</div>)}
      </div>
      <div className="text-[11.5px] text-[#7A7A7A] flex flex-wrap gap-x-6 gap-y-1">
        <span><b className="text-[#0A0A0A] font-semibold">Cliente:</b> {contract.customer_uploaded_at ? `assinou em ${fmtDateShort(contract.customer_uploaded_at)}` : "—"}</span>
        <span><b className="text-[#0A0A0A] font-semibold">Contraparte:</b> {contract.company_signed_at ? "aprovado" : "em análise"}</span>
        <span><b className="text-[#0A0A0A] font-semibold">Prev.:</b> {fmtDateLong(contract.company_signed_at || contract.issued_at)}</span>
      </div>
    </div>
  );
}
