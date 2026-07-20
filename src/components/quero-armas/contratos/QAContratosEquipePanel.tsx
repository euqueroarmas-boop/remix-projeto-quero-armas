/**
 * QAContratosEquipePanel
 * Painel premium-light da Equipe Quero Armas para gerenciar contratos
 * pendentes de assinatura da CONTRATADA (e demais estados).
 *
 * - Lista qa_contracts (joined com qa_clientes via cliente_id)
 * - Prioriza status = generated_pending_company_signature
 * - Botão "Assinar pela Quero Armas" → modal de confirmação
 * - Chama edge function `qa-sign-contract-company` com JWT autenticado
 *   (a edge valida role admin em user_roles). Nada de x-admin-token no front.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  FileSignature,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Clock,
  CheckCircle2,
  AlertTriangle,
  FileText,
  RotateCw,
} from "lucide-react";

type ContractStatus =
  | "generated_pending_company_signature"
  | "pending_customer_signature"
  | "validated"
  | "finalizado"
  | "error"
  | string;

interface ContratoRow {
  id: string;
  venda_id: number | null;
  cliente_id: number | null;
  contract_number: string | null;
  status: ContractStatus;
  servico_slug: string | null;
  original_sha256: string | null;
  created_at: string | null;
  company_signed_at: string | null;
  customer_signature_validated_at: string | null;
  cliente?: { nome_completo: string | null; cpf: string | null; email: string | null };
}

function fmt(d: string | null) {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
  } catch {
    return d;
  }
}

function shortHash(h: string | null) {
  if (!h) return "—";
  return `${h.slice(0, 8)}…${h.slice(-6)}`;
}

function statusBadge(s: ContractStatus) {
  const map: Record<string, { label: string; cls: string; Icon: any }> = {
    generated_pending_company_signature: {
      label: "Aguardando assinatura da Quero Armas",
      cls: "bg-amber-50 text-amber-800 border-amber-200",
      Icon: Clock,
    },
    pending_customer_signature: {
      label: "Assinado pela Quero Armas — aguardando cliente",
      cls: "bg-sky-50 text-sky-800 border-sky-200",
      Icon: ShieldCheck,
    },
    validated: {
      label: "Finalizado",
      cls: "bg-emerald-50 text-emerald-800 border-emerald-200",
      Icon: CheckCircle2,
    },
    finalizado: {
      label: "Finalizado",
      cls: "bg-emerald-50 text-emerald-800 border-emerald-200",
      Icon: CheckCircle2,
    },
    error: {
      label: "Erro / revisão necessária",
      cls: "bg-rose-50 text-rose-800 border-rose-200",
      Icon: AlertTriangle,
    },
  };
  const cfg = map[s] ?? {
    label: s,
    cls: "bg-slate-100 text-slate-700 border-slate-200",
    Icon: FileText,
  };
  const Icon = cfg.Icon;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${cfg.cls}`}
    >
      <Icon className="h-3 w-3" />
      {cfg.label}
    </span>
  );
}

const STATUS_PRIORITY: Record<string, number> = {
  generated_pending_company_signature: 0,
  pending_customer_signature: 1,
  error: 2,
  validated: 3,
  finalizado: 3,
};

export default function QAContratosEquipePanel() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<ContratoRow[]>([]);
  const [confirmRow, setConfirmRow] = useState<ContratoRow | null>(null);
  const [signingId, setSigningId] = useState<string | null>(null);
  const [reprocessingId, setReprocessingId] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("qa_contracts")
        .select(
          "id, venda_id, cliente_id, contract_number, status, servico_slug, original_sha256, created_at, company_signed_at, customer_signature_validated_at",
        )
        .is("arquivado_em", null)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;

      const list = (data ?? []) as ContratoRow[];
      const ids = [...new Set(list.map((r) => r.cliente_id).filter(Boolean) as number[])];
      if (ids.length > 0) {
        const { data: clientes } = await supabase
          .from("qa_clientes")
          .select("id, nome_completo, cpf, email")
          .in("id", ids);
        const map = new Map((clientes ?? []).map((c: any) => [c.id, c]));
        list.forEach((r) => {
          if (r.cliente_id) r.cliente = map.get(r.cliente_id);
        });
      }
      setRows(list);
    } catch (e: any) {
      toast.error("Falha ao carregar contratos: " + (e?.message ?? "erro desconhecido"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const sorted = useMemo(() => {
    return [...rows].sort((a, b) => {
      const pa = STATUS_PRIORITY[a.status] ?? 99;
      const pb = STATUS_PRIORITY[b.status] ?? 99;
      if (pa !== pb) return pa - pb;
      return (b.created_at ?? "").localeCompare(a.created_at ?? "");
    });
  }, [rows]);

  const pendentes = useMemo(
    () => rows.filter((r) => r.status === "generated_pending_company_signature").length,
    [rows],
  );

  const reprocessar = async (row: ContratoRow) => {
    if (!row.venda_id) {
      toast.error("Contrato sem venda_id — não é possível reprocessar.");
      return;
    }
    setReprocessingId(row.id);
    try {
      const { data, error } = await supabase.functions.invoke("qa-generate-contract", {
        body: { venda_id: row.venda_id, force: true },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success("Contrato reprocessado com o template vigente atual.");
      await carregar();
    } catch (e: any) {
      toast.error("Falha ao reprocessar: " + (e?.message ?? "erro desconhecido"));
    } finally {
      setReprocessingId(null);
    }
  };

  const assinar = async (row: ContratoRow) => {
    setSigningId(row.id);
    try {
      const { data, error } = await supabase.functions.invoke("qa-sign-contract-company", {
        body: { contract_id: row.id },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success("Contrato assinado pela Quero Armas.");
      setConfirmRow(null);
      await carregar();
    } catch (e: any) {
      toast.error("Falha ao assinar: " + (e?.message ?? "erro desconhecido"));
    } finally {
      setSigningId(null);
    }
  };

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div>
          <h2 className="text-[14px] font-bold uppercase tracking-wider text-slate-900">
            Contratos — Assinatura da Quero Armas
          </h2>
          <p className="mt-0.5 text-[12px] text-slate-500">
            {pendentes > 0
              ? `${pendentes} contrato(s) aguardando assinatura da Quero Armas.`
              : "Nenhum contrato pendente de assinatura da Quero Armas."}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={carregar} disabled={loading}>
          <RefreshCw className={`mr-2 h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-[12px]">
            <thead className="bg-slate-50">
              <tr className="text-left text-[11px] font-bold uppercase tracking-wider text-slate-600">
                <th className="px-3 py-2.5">Contrato</th>
                <th className="px-3 py-2.5">Cliente / Venda</th>
                <th className="px-3 py-2.5">Status</th>
                <th className="px-3 py-2.5">Criado</th>
                <th className="px-3 py-2.5">Assinado QA</th>
                <th className="px-3 py-2.5">Assinado Cliente</th>
                <th className="px-3 py-2.5">Hash original</th>
                <th className="px-3 py-2.5 text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading && (
                <tr>
                  <td colSpan={8} className="px-3 py-10 text-center text-slate-500">
                    <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                  </td>
                </tr>
              )}
              {!loading && sorted.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-3 py-10 text-center text-slate-500">
                    Nenhum contrato encontrado.
                  </td>
                </tr>
              )}
              {!loading &&
                sorted.map((r) => {
                  const canSign = r.status === "generated_pending_company_signature";
                  return (
                    <tr key={r.id} className="hover:bg-slate-50/60">
                      <td className="px-3 py-2.5 align-top">
                        <div className="font-semibold text-slate-900">
                          {r.contract_number ?? r.id.slice(0, 8)}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {r.servico_slug ?? "—"}
                        </div>
                      </td>
                      <td className="px-3 py-2.5 align-top">
                        <div className="font-medium text-slate-800">
                          {r.cliente?.nome_completo ?? `Cliente #${r.cliente_id ?? "—"}`}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          Venda #{r.venda_id ?? "—"}
                        </div>
                      </td>
                      <td className="px-3 py-2.5 align-top">{statusBadge(r.status)}</td>
                      <td className="px-3 py-2.5 align-top text-slate-600">{fmt(r.created_at)}</td>
                      <td className="px-3 py-2.5 align-top text-slate-600">
                        {fmt(r.company_signed_at)}
                      </td>
                      <td className="px-3 py-2.5 align-top text-slate-600">
                        {fmt(r.customer_signature_validated_at)}
                      </td>
                      <td className="px-3 py-2.5 align-top font-mono text-[11px] text-slate-500">
                        {shortHash(r.original_sha256)}
                      </td>
                      <td className="px-3 py-2.5 align-top text-right">
                        <div className="flex items-center justify-end gap-2">
                          {canSign && (
                            <Button
                              size="sm"
                              onClick={() => setConfirmRow(r)}
                              disabled={signingId === r.id}
                              className="bg-slate-900 text-white hover:bg-slate-800"
                            >
                              <FileSignature className="mr-1.5 h-3.5 w-3.5" />
                              Assinar pela Quero Armas
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => reprocessar(r)}
                            disabled={reprocessingId === r.id || !r.venda_id}
                            title="Reconstrói o conteúdo do contrato a partir do template vigente atual, preservando a prova de aceite original"
                          >
                            {reprocessingId === r.id ? (
                              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <RotateCw className="mr-1.5 h-3.5 w-3.5" />
                            )}
                            Reprocessar
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={!!confirmRow} onOpenChange={(o) => !o && setConfirmRow(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-slate-700" />
              Assinar contrato pela Quero Armas
            </DialogTitle>
            <DialogDescription>
              Esta operação aplicará a assinatura digital da CONTRATADA usando o certificado
              A1 ICP-Brasil ativo. Após a assinatura, o contrato seguirá para a assinatura do
              cliente.
            </DialogDescription>
          </DialogHeader>

          {confirmRow && (
            <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-[12px]">
              <div className="flex justify-between gap-3">
                <span className="text-slate-500">Contrato</span>
                <span className="font-semibold text-slate-900">
                  {confirmRow.contract_number ?? confirmRow.id.slice(0, 8)}
                </span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-slate-500">Cliente</span>
                <span className="font-medium text-slate-800">
                  {confirmRow.cliente?.nome_completo ?? `#${confirmRow.cliente_id ?? "—"}`}
                </span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-slate-500">Venda</span>
                <span className="text-slate-800">#{confirmRow.venda_id ?? "—"}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-slate-500">Status atual</span>
                <span>{statusBadge(confirmRow.status)}</span>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setConfirmRow(null)}
              disabled={!!signingId}
            >
              Cancelar
            </Button>
            <Button
              onClick={() => confirmRow && assinar(confirmRow)}
              disabled={!!signingId}
              className="bg-slate-900 text-white hover:bg-slate-800"
            >
              {signingId ? (
                <>
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  Assinando…
                </>
              ) : (
                <>
                  <FileSignature className="mr-1.5 h-3.5 w-3.5" />
                  Confirmar assinatura da Quero Armas
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}