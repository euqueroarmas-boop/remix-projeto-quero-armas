/**
 * Dashboard — Prazos Recursais (PF: Posse, Porte e CRAF)
 *
 * Trigger: QUALQUER item com data_notificacao, data_indeferimento ou
 * data_restituicao preenchida (independente do serviço — todos abrem prazo
 * administrativo de 10 dias para manifestação/recurso).
 * Janela: D = data mais recente entre notificação/indeferimento; prazo = D+10
 * (Lei 9.784/99 art. 59 + Decreto 9.847/19 art. 10).
 * Vencidos NÃO aparecem no card principal; são deslocados para a tela
 * operacional "Prazos Expirados", onde a equipe trabalha a fila vencida.
 * Cores por dias restantes: 🟢 8–10 · 🟡 5–7 · 🔴 0–4.
 *
 * FKs em produção:
 *   - qa_itens_venda.venda_id  → qa_vendas.id_legado
 *   - qa_vendas.cliente_id     → qa_clientes.id_legado
 *
 * Layout: grid de até 9 cards pequenos (mais antigo → mais novo). 10º card "+N".
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Loader2, Plus, Copy } from "lucide-react";
import { useWidgetLoader } from "@/hooks/useWidgetLoader";
import WidgetStateView from "./WidgetStateView";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { getSenhaGov } from "@/components/quero-armas/clientes/senhaGovApi";
import { loadQAPrazosEquipeRows, type QAPrazoEquipeRow } from "@/lib/quero-armas/prazosEquipe";

/**
 * Copia texto compatível com Safari iOS, que bloqueia navigator.clipboard
 * fora de gestos síncronos. Faz fallback via textarea + execCommand('copy').
 */
function copyTextFallback(text: string): boolean {
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.top = "0";
    ta.style.left = "0";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    ta.setSelectionRange(0, text.length);
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

async function copyTextSafe(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fallback abaixo */
  }
  return copyTextFallback(text);
}

const MAX_CARDS = 9; // 9 cards individuais + 1 card "+N"

function toneFor(dias: number) {
  if (dias < 0)  return { dot: "bg-rose-700",    text: "text-rose-800",    border: "border-rose-300",    bg: "bg-rose-100",   label: "VENCIDO" };
  if (dias <= 4) return { dot: "bg-rose-600",    text: "text-rose-700",    border: "border-rose-200",    bg: "bg-rose-50",    label: "CRÍTICO" };
  if (dias <= 7) return { dot: "bg-amber-500",   text: "text-amber-700",   border: "border-amber-200",   bg: "bg-amber-50",   label: "ATENÇÃO" };
  return            { dot: "bg-emerald-500", text: "text-emerald-700", border: "border-emerald-200", bg: "bg-white",     label: "EM PRAZO" };
}

export default function DashboardPrazosRecursais() {
  const [govSenhas, setGovSenhas] = useState<Record<number, string>>({});
  const [govLoading, setGovLoading] = useState<Record<number, boolean>>({});
  const prefetchedRef = useRef<Set<number>>(new Set());

  const { state, data, reload } = useWidgetLoader<QAPrazoEquipeRow[]>(
    async (signal) => (await loadQAPrazosEquipeRows(signal)).filter((row) => row.diasRestantes >= 0),
    [],
    { timeoutMs: 6000 },
  );

  const rows = data ?? [];
  const visible = useMemo(() => rows.slice(0, MAX_CARDS), [rows]);
  const overflow = useMemo(() => rows.slice(MAX_CARDS), [rows]);

  /**
   * Pré-carrega as Senhas Gov dos cards visíveis assim que o usuário está
   * autenticado e o widget renderizou os dados. Isso garante que, ao clicar
   * para copiar, a cópia aconteça de forma SÍNCRONA dentro do gesto do usuário
   * — requisito do Safari iOS. As senhas ficam apenas em memória (state),
   * são purgadas no refresh/logout e cada acesso é auditado pela edge
   * function (qa_senha_gov_acessos).
   */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      // só pré-carrega se houver sessão ativa
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData?.session) return;

      const targets = visible
        .filter((r) => !!r.cadastroCrId && !!r.clienteId && !prefetchedRef.current.has(r.cadastroCrId as number))
        .map((r) => ({ id: r.cadastroCrId as number, clienteId: r.clienteId as number }));
      if (!targets.length) return;

      await Promise.all(
        targets.map(async ({ id, clienteId }) => {
          prefetchedRef.current.add(id);
          try {
            const senha = await getSenhaGov(id, "Prazos Recursais (prefetch)", clienteId);
            if (cancelled || !senha) return;
            setGovSenhas((prev) => (prev[id] ? prev : { ...prev, [id]: senha }));
          } catch {
            // falha silenciosa — usuário ainda pode tentar manualmente
            prefetchedRef.current.delete(id);
          }
        }),
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [visible]);

  if (state === "loading") {
    return (
      <div className="space-y-4">
        <div>
          <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide">Prazos Processuais — 10 Dias · Lei 9.784/99 (PF)</h3>
          <p className="text-[11px] text-slate-500 mt-0.5">Carregando…</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-6 flex items-center justify-center shadow-sm">
          <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
        </div>
      </div>
    );
  }

  if (state === "error" || state === "timeout") {
    return (
      <WidgetStateView
        title="Prazos Processuais — 10 Dias · Lei 9.784/99 (PF)"
        state={state}
        onRetry={reload}
      />
    );
  }

  if (!rows.length) return null;

  return (
    <div className="space-y-4">
      {/* Header — mesmo padrão do Monitoramento de Exames */}
      <div>
        <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
          Prazos Processuais — 10 Dias · Lei 9.784/99 (PF)
        </h3>
        <p className="text-[11px] text-slate-500 mt-0.5">
          {rows.length} cliente(s) com prazo ainda ativo de manifestação · ordenado do mais urgente ao menos urgente
        </p>
      </div>

      {/* Grid de cards pequenos — 2/3/5 colunas */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 divide-x divide-y sm:divide-y-0 divide-slate-100">
          {visible.map(r => {
            const tone = toneFor(r.diasRestantes);
            const link = r.clienteIdLegado
              ? `/clientes?cliente=${r.clienteIdLegado}`
              : `/clientes`;
            const [ly, lm, ld] = r.dataLimite.split("-");
            const dataLimiteBr = `${ld}/${lm}/${ly}`;
            const cpfFmt = r.cpf ? r.cpf.replace(/\D/g, "").replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4") : null;
            const handleCopy = (e: React.MouseEvent, label: string, value: string | null | undefined) => {
              e.preventDefault();
              e.stopPropagation();
              if (!value) {
                toast.error(`${label} indisponível`);
                return;
              }
              navigator.clipboard.writeText(value).then(
                () => toast.success(`${label} copiado`),
                () => toast.error(`Falha ao copiar ${label}`)
              );
            };
            return (
              <Link
                key={r.itemId}
                to={link}
                title={`${r.clienteNome} — ${r.tipo} PF · ${r.evento} · prazo fatal ${dataLimiteBr}`}
                className={`group flex flex-col gap-1.5 px-3 py-3 ${tone.bg} hover:bg-slate-50 transition-colors min-h-[88px]`}
              >
                <div className="flex items-center gap-1.5">
                  <span className={`h-2 w-2 rounded-full ${tone.dot} shrink-0`} />
                  <span className={`text-[10px] font-bold uppercase tracking-wider ${tone.text}`}>
                    {tone.label}
                  </span>
                </div>
                <div className="text-[11px] font-semibold text-slate-900 leading-tight line-clamp-2 group-hover:text-[#7A1F2B] group-hover:underline uppercase">
                  {r.clienteNome}
                </div>
                <div className="text-[8.5px] font-bold uppercase tracking-wider text-slate-500 leading-none">
                  {r.tipo} PF · {r.evento}
                </div>
                {r.status && (
                  <div className="text-[8.5px] font-bold uppercase tracking-wider text-[#7A1F2B] leading-none truncate">
                    Status: {r.status}
                  </div>
                )}
                <div className="flex flex-col gap-0.5 -mx-1">
                  <button
                    type="button"
                    onClick={(e) => handleCopy(e, "Protocolo", r.protocolo)}
                    className="flex items-center gap-1 px-1 py-0.5 rounded hover:bg-slate-200/60 text-[9px] font-mono text-slate-700 truncate"
                    title={r.protocolo ? `Copiar protocolo: ${r.protocolo}` : "Sem protocolo"}
                  >
                    <Copy className="h-2.5 w-2.5 shrink-0 text-slate-400" />
                    <span className="truncate">PROT: {r.protocolo || "—"}</span>
                  </button>
                  <button
                    type="button"
                    onClick={(e) => handleCopy(e, "CPF", cpfFmt)}
                    className="flex items-center gap-1 px-1 py-0.5 rounded hover:bg-slate-200/60 text-[9px] font-mono text-slate-700 truncate"
                    title={cpfFmt ? `Copiar CPF: ${cpfFmt}` : "Sem CPF"}
                  >
                    <Copy className="h-2.5 w-2.5 shrink-0 text-slate-400" />
                    <span className="truncate">CPF: {cpfFmt || "—"}</span>
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      if (!r.cadastroCrId) {
                        toast.error("Sem CR cadastrado");
                        return;
                      }
                      const cached = govSenhas[r.cadastroCrId];
                      // Caminho SÍNCRONO (compatível com Safari iOS): se a
                      // senha já foi pré-carregada após o login, copia agora.
                      if (cached) {
                        // copyTextFallback é síncrono; só cai para clipboard
                        // async como tentativa adicional não-bloqueante.
                        const ok = copyTextFallback(cached);
                        if (ok) {
                          toast.success("Senha Gov copiada");
                        } else {
                          // tentativa async como último recurso
                          copyTextSafe(cached).then((ok2) => {
                            if (ok2) toast.success("Senha Gov copiada");
                            else toast.error("Não foi possível copiar");
                          });
                        }
                        return;
                      }
                      // Sem cache → autentica/decripta agora (1 toque) e
                      // já tenta copiar em seguida.
                      const id = r.cadastroCrId;
                      setGovLoading((prev) => ({ ...prev, [id]: true }));
                      getSenhaGov(id, "Prazos Recursais", r.clienteId)
                        .then(async (senha) => {
                          if (!senha) {
                            toast.info("Sem Senha Gov cadastrada");
                            return;
                          }
                          setGovSenhas((prev) => ({ ...prev, [id]: senha }));
                          const ok = await copyTextSafe(senha);
                          if (ok) toast.success("Senha Gov copiada");
                          else toast.success("Senha Gov liberada — toque novamente para copiar");
                        })
                        .catch((err: any) => {
                          toast.error("Senha Gov: " + (err?.message || "erro"));
                        })
                        .finally(() => {
                          setGovLoading((prev) => ({ ...prev, [id]: false }));
                        });
                    }}
                    className="flex items-center gap-1 px-1 py-0.5 rounded hover:bg-slate-200/60 text-[9px] font-mono text-slate-700 truncate"
                    title={r.cadastroCrId ? (govSenhas[r.cadastroCrId] ? "Copiar Senha Gov" : "Autenticar e copiar Senha Gov") : "Sem CR"}
                  >
                    {r.cadastroCrId && govLoading[r.cadastroCrId] ? (
                      <Loader2 className="h-2.5 w-2.5 shrink-0 animate-spin text-slate-400" />
                    ) : (
                      <Copy className="h-2.5 w-2.5 shrink-0 text-slate-400" />
                    )}
                    <span className="truncate select-text">
                      GOV: {r.cadastroCrId ? govSenhas[r.cadastroCrId] || "•••• autenticar" : "—"}
                    </span>
                  </button>
                </div>
                <div className="mt-auto flex items-baseline gap-1">
                  <span className={`text-xl font-black leading-none ${tone.text}`}>{r.diasRestantes}</span>
                  <span className={`text-[9px] font-bold uppercase ${tone.text}`}>d. restantes</span>
                </div>
                <div className="text-[9px] font-semibold uppercase tracking-wider text-rose-600 leading-none">
                  Fatal: {dataLimiteBr}
                </div>
              </Link>
            );
          })}

          {/* 10º card = agregador "+N" */}
          {overflow.length > 0 && (
            <div
              className="flex flex-col items-center justify-center gap-1 px-3 py-3 bg-slate-50 min-h-[88px]"
              title={overflow.map(o => `${o.clienteNome} (${o.diasRestantes}d)`).join(" · ")}
            >
              <Plus className="h-4 w-4 text-slate-500" />
              <span className="text-2xl font-black text-slate-700 leading-none">+{overflow.length}</span>
              <span className="text-[9px] font-bold uppercase text-slate-500 text-center">
                outros em prazo
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
