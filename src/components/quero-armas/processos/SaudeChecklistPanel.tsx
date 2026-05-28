/* =============================================================================
 * Bloco 16 — Painel "Saúde do checklist" com correções assistidas.
 *
 * Renderiza alertas de auditarChecklistProcesso() e oferece ações rápidas
 * para a Equipe Quero Armas corrigir problemas comuns sem sair do drawer.
 * Todas as ações vão para a edge function qa-processo-doc-corrigir-saude,
 * que registra evento em qa_processo_eventos.
 * ============================================================================= */

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ShieldAlert, ShieldCheck, AlertTriangle, ChevronDown, ChevronUp } from "lucide-react";
import {
  auditarChecklistProcesso,
  type AuditableDoc,
  type ChecklistAuditIssue,
} from "@/lib/quero-armas/checklistAudit";

interface ArmaOption {
  arma_uid: string;
  modelo: string | null;
  numero_serie: string | null;
  numero_craf: string | null;
  numero_sigma: string | null;
}

const ETAPAS_OPCOES: { value: string; label: string }[] = [
  { value: "identificacao", label: "1 IDENTIFICAÇÃO" },
  { value: "endereco", label: "2 COMPROVAÇÃO DE ENDEREÇO" },
  { value: "antecedentes", label: "3 CERTIDÕES / ANTECEDENTES" },
  { value: "declaracoes_gerais", label: "4 DECLARAÇÕES" },
  { value: "final", label: "5 ASSINATURAS E DOCUMENTOS FINAIS" },
];

const STATUS_OPCOES = [
  "pendente",
  "em_analise",
  "aprovado",
  "rejeitado",
  "divergente",
  "dispensado",
];

function sevStyle(s: ChecklistAuditIssue["severity"]) {
  if (s === "critical") return { box: "border-rose-300 bg-rose-50", chip: "bg-rose-600 text-white", text: "text-rose-900", icon: "text-rose-700" };
  if (s === "warning") return { box: "border-amber-300 bg-amber-50/70", chip: "bg-amber-600 text-white", text: "text-amber-900", icon: "text-amber-700" };
  return { box: "border-slate-300 bg-slate-50", chip: "bg-slate-600 text-white", text: "text-slate-800", icon: "text-slate-600" };
}

export interface SaudeChecklistPanelProps {
  processoId: string;
  clienteId: number | null | undefined;
  docs: AuditableDoc[];
  onChanged: () => void | Promise<void>;
}

export default function SaudeChecklistPanel({ processoId, clienteId, docs, onChanged }: SaudeChecklistPanelProps) {
  const issues = useMemo(() => auditarChecklistProcesso(docs), [docs]);
  const [expandido, setExpandido] = useState<string | null>(null);
  const [armas, setArmas] = useState<ArmaOption[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  const docsById = useMemo(() => {
    const m = new Map<string, AuditableDoc>();
    docs.forEach((d) => m.set(d.id, d));
    return m;
  }, [docs]);

  // Lista de armas do cliente (sob demanda, ao expandir alerta de arma).
  useEffect(() => {
    if (!clienteId) return;
    if (!issues.some((i) => i.code === "doc_arma_sem_arma_id" || i.code === "arma_id_em_tipo_nao_arma")) return;
    let abort = false;
    (async () => {
      const { data } = await supabase
        .from("qa_cliente_armas" as any)
        .select("arma_uid, modelo, numero_serie, numero_craf, numero_sigma")
        .eq("qa_cliente_id", clienteId);
      if (!abort) setArmas(((data ?? []) as any) as ArmaOption[]);
    })();
    return () => { abort = true; };
  }, [clienteId, issues]);

  if (issues.length === 0) {
    return (
      <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 px-3 py-1.5 text-[10px] uppercase tracking-wider font-bold text-emerald-800 inline-flex items-center gap-1.5">
        <ShieldCheck className="h-3 w-3" /> CHECKLIST CONSISTENTE
      </div>
    );
  }

  const chamarCorrecao = async (
    documentoId: string,
    acao: string,
    payload: Record<string, unknown> = {},
    sucessoMsg = "CORREÇÃO APLICADA",
  ) => {
    setBusy(`${acao}::${documentoId}`);
    try {
      const { data, error } = await supabase.functions.invoke("qa-processo-doc-corrigir-saude", {
        body: { processo_id: processoId, documento_id: documentoId, acao, payload },
      });
      if (error) throw new Error(error.message || "Falha na correção");
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success(sucessoMsg);
      await onChanged();
    } catch (e: any) {
      toast.error("Não foi possível corrigir: " + (e?.message ?? "erro"));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="rounded-lg border border-slate-300 bg-white p-3 space-y-2">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-bold text-slate-700">
        <ShieldAlert className="h-3 w-3" /> SAÚDE DO CHECKLIST · {issues.length} ALERTA{issues.length > 1 ? "S" : ""}
      </div>
      <ul className="space-y-1.5">
        {issues.map((iss, idx) => {
          const s = sevStyle(iss.severity);
          const key = `${iss.code}::${idx}`;
          const aberto = expandido === key;
          const podeAgir =
            !!iss.actionLabel &&
            ["sem_etapa", "sem_ordem", "doc_arma_sem_arma_id", "arma_id_em_tipo_nao_arma", "duplicado", "status_desconhecido"].includes(iss.code);
          return (
            <li key={key} className={`rounded-md border ${s.box} px-2.5 py-2`}>
              <div className="flex items-start gap-2">
                <AlertTriangle className={`h-3.5 w-3.5 mt-0.5 shrink-0 ${s.icon}`} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className={`px-1.5 py-0.5 rounded text-[9px] uppercase tracking-wider font-bold ${s.chip}`}>
                      {iss.severity === "critical" ? "CRÍTICO" : iss.severity === "warning" ? "ATENÇÃO" : "INFO"}
                    </span>
                    <span className={`text-[11px] font-semibold leading-snug ${s.text}`}>{iss.message}</span>
                  </div>
                  {iss.docIds && iss.docIds.length > 0 && (
                    <div className="mt-1 text-[10px] uppercase tracking-wider text-slate-500">
                      {iss.docIds.length} REGISTRO{iss.docIds.length > 1 ? "S" : ""} AFETADO{iss.docIds.length > 1 ? "S" : ""}
                    </div>
                  )}
                </div>
                {podeAgir && (
                  <button
                    type="button"
                    onClick={() => setExpandido(aberto ? null : key)}
                    className="shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded border border-slate-300 bg-white text-[10px] uppercase tracking-wider font-bold text-slate-700 hover:bg-slate-50"
                  >
                    {iss.actionLabel?.toUpperCase()}
                    {aberto ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                  </button>
                )}
              </div>

              {aberto && podeAgir && (
                <div className="mt-2 pt-2 border-t border-slate-200 space-y-2">
                  {(iss.docIds ?? []).map((docId) => {
                    const d = docsById.get(docId);
                    if (!d) return null;
                    const nome = (d.nome_documento ?? d.tipo_documento ?? docId).toString().toUpperCase();
                    const busyKey = (acao: string) => busy === `${acao}::${docId}`;
                    return (
                      <div key={docId} className="rounded border border-slate-200 bg-white px-2 py-1.5">
                        <div className="text-[10px] uppercase tracking-wider font-bold text-slate-700 truncate">{nome}</div>
                        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                          {iss.code === "sem_etapa" && (
                            <EtapaAction
                              disabled={!!busy}
                              onSubmit={(etapa) => chamarCorrecao(docId, "definir_etapa", { etapa }, "ETAPA DEFINIDA")}
                            />
                          )}
                          {iss.code === "sem_ordem" && (
                            <button
                              disabled={busyKey("aplicar_ordem")}
                              onClick={() => chamarCorrecao(docId, "aplicar_ordem", {}, "ORDEM APLICADA")}
                              className="px-2 py-1 rounded bg-slate-800 text-white text-[10px] uppercase tracking-wider font-bold disabled:opacity-60"
                            >
                              APLICAR PRÓXIMA ORDEM
                            </button>
                          )}
                          {iss.code === "doc_arma_sem_arma_id" && (
                            <ArmaAction
                              armas={armas}
                              disabled={!!busy}
                              onSubmit={(armaId) => chamarCorrecao(docId, "vincular_arma", { arma_id: armaId }, "ARMA VINCULADA")}
                            />
                          )}
                          {iss.code === "arma_id_em_tipo_nao_arma" && (
                            <button
                              disabled={busyKey("remover_arma")}
                              onClick={() => {
                                if (!window.confirm("REMOVER O VÍNCULO COM A ARMA DESTE DOCUMENTO?")) return;
                                chamarCorrecao(docId, "remover_arma", {}, "VÍNCULO REMOVIDO");
                              }}
                              className="px-2 py-1 rounded border border-rose-300 bg-white text-rose-700 text-[10px] uppercase tracking-wider font-bold disabled:opacity-60"
                            >
                              REMOVER VÍNCULO COM ARMA
                            </button>
                          )}
                          {iss.code === "duplicado" && (
                            <button
                              disabled={busyKey("arquivar_duplicado")}
                              onClick={() => {
                                if (!window.confirm(`ARQUIVAR "${nome}" COMO DUPLICADO? ESTA AÇÃO PODE SER REVERTIDA PELA EQUIPE.`)) return;
                                chamarCorrecao(docId, "arquivar_duplicado", { confirmado: true }, "DUPLICADO ARQUIVADO");
                              }}
                              className="px-2 py-1 rounded border border-rose-300 bg-white text-rose-700 text-[10px] uppercase tracking-wider font-bold disabled:opacity-60"
                            >
                              ARQUIVAR COMO DUPLICADO
                            </button>
                          )}
                          {iss.code === "status_desconhecido" && (
                            <StatusAction
                              statusAtual={d.status ?? ""}
                              disabled={!!busy}
                              onSubmit={(status) => chamarCorrecao(docId, "normalizar_status", { status }, "STATUS NORMALIZADO")}
                            />
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// --- Mini-controles ---------------------------------------------------------

function EtapaAction({ disabled, onSubmit }: { disabled: boolean; onSubmit: (etapa: string) => void }) {
  const [v, setV] = useState("identificacao");
  return (
    <div className="inline-flex items-center gap-1.5">
      <select
        value={v}
        onChange={(e) => setV(e.target.value)}
        className="h-7 rounded border border-slate-300 bg-white text-[10px] uppercase tracking-wider font-bold px-1.5"
      >
        {ETAPAS_OPCOES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <button
        disabled={disabled}
        onClick={() => onSubmit(v)}
        className="px-2 py-1 rounded bg-slate-800 text-white text-[10px] uppercase tracking-wider font-bold disabled:opacity-60"
      >
        SALVAR
      </button>
    </div>
  );
}

function StatusAction({ statusAtual, disabled, onSubmit }: { statusAtual: string; disabled: boolean; onSubmit: (status: string) => void }) {
  const [v, setV] = useState("pendente");
  return (
    <div className="inline-flex items-center gap-1.5">
      <span className="text-[10px] uppercase tracking-wider text-slate-500">ATUAL: <strong className="text-slate-800">{(statusAtual || "—").toUpperCase()}</strong></span>
      <select
        value={v}
        onChange={(e) => setV(e.target.value)}
        className="h-7 rounded border border-slate-300 bg-white text-[10px] uppercase tracking-wider font-bold px-1.5"
      >
        {STATUS_OPCOES.map((o) => <option key={o} value={o}>{o.toUpperCase()}</option>)}
      </select>
      <button
        disabled={disabled}
        onClick={() => {
          if (!window.confirm(`NORMALIZAR STATUS PARA "${v.toUpperCase()}"?`)) return;
          onSubmit(v);
        }}
        className="px-2 py-1 rounded bg-slate-800 text-white text-[10px] uppercase tracking-wider font-bold disabled:opacity-60"
      >
        SALVAR
      </button>
    </div>
  );
}

function ArmaAction({ armas, disabled, onSubmit }: { armas: ArmaOption[]; disabled: boolean; onSubmit: (armaId: string) => void }) {
  const [v, setV] = useState<string>("");
  if (armas.length === 0) {
    return (
      <div className="text-[10px] uppercase tracking-wider font-bold text-amber-800 bg-amber-50 border border-amber-200 px-2 py-1 rounded">
        CLIENTE AINDA NÃO POSSUI ARMA CADASTRADA.
      </div>
    );
  }
  const label = (a: ArmaOption) => {
    const partes = [a.modelo, a.numero_serie ? `S/N ${a.numero_serie}` : null, a.numero_craf ? `CRAF ${a.numero_craf}` : null, a.numero_sigma ? `SIGMA ${a.numero_sigma}` : null]
      .filter(Boolean)
      .join(" · ");
    return (partes || a.arma_uid).toUpperCase();
  };
  return (
    <div className="inline-flex items-center gap-1.5 flex-wrap">
      <select
        value={v}
        onChange={(e) => setV(e.target.value)}
        className="h-7 rounded border border-slate-300 bg-white text-[10px] uppercase tracking-wider font-bold px-1.5 max-w-[260px]"
      >
        <option value="">SELECIONE A ARMA…</option>
        {armas.map((a) => <option key={a.arma_uid} value={a.arma_uid}>{label(a)}</option>)}
      </select>
      <button
        disabled={disabled || !v}
        onClick={() => onSubmit(v)}
        className="px-2 py-1 rounded bg-slate-800 text-white text-[10px] uppercase tracking-wider font-bold disabled:opacity-60"
      >
        VINCULAR
      </button>
    </div>
  );
}
