import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Activity, ArrowRight, ShieldCheck, FileText, PenTool, Users, FolderOpen } from "lucide-react";
import { Link } from "react-router-dom";
import { LoadingState, ErrorRetryState } from "@/components/quero-armas/LoadStates";

interface AuditRow {
  id: string;
  usuario_id: string | null;
  entidade: string;
  entidade_id: string | null;
  acao: string;
  detalhes_json: Record<string, any> | null;
  created_at: string;
}

const ENTITY_META: Record<string, { label: string; icon: any; color: string; bg: string }> = {
  qa_clientes: { label: "Cliente", icon: Users, color: "text-blue-600", bg: "bg-blue-50" },
  qa_casos: { label: "Caso", icon: FolderOpen, color: "text-amber-600", bg: "bg-amber-50" },
  qa_geracoes_pecas: { label: "Peça", icon: PenTool, color: "text-violet-600", bg: "bg-violet-50" },
  qa_documentos_conhecimento: { label: "Documento", icon: FileText, color: "text-emerald-600", bg: "bg-emerald-50" },
  qa_armamentos: { label: "Armamento", icon: ShieldCheck, color: "text-slate-700", bg: "bg-slate-100" },
};

function formatAction(acao: string): string {
  // Substitui underscores e capitaliza primeira palavra.
  const txt = acao.replace(/_/g, " ").trim();
  return txt.charAt(0).toUpperCase() + txt.slice(1);
}

function timeAgo(iso: string): string {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h}h`;
  const dys = Math.floor(h / 24);
  if (dys < 7) return `há ${dys}d`;
  return d.toLocaleDateString("pt-BR");
}

export default function DashboardAtividadesRecentes() {
  const [data, setData] = useState<AuditRow[] | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const safety = setTimeout(() => {
      if (!cancelled) {
        setError(new Error("Tempo limite excedido."));
        setLoading(false);
      }
    }, 8000);
    (async () => {
      try {
        const { data: rows, error: err } = await supabase
          .from("qa_logs_auditoria" as any)
          .select("id, usuario_id, entidade, entidade_id, acao, detalhes_json, created_at")
          .order("created_at", { ascending: false })
          .limit(8);
        if (cancelled) return;
        if (err) throw err;
        setData((rows as any[]) ?? []);
        setError(null);
      } catch (e: any) {
        if (cancelled) return;
        setError(e instanceof Error ? e : new Error(String(e?.message || e)));
      } finally {
        clearTimeout(safety);
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      clearTimeout(safety);
    };
  }, [reloadKey]);

  const items = useMemo(() => data ?? [], [data]);

  return (
    <div className="qa-card p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "hsl(230 80% 96%)" }}>
            <Activity className="h-3.5 w-3.5" style={{ color: "hsl(230 80% 56%)" }} />
          </div>
          <div>
            <h3 className="text-sm font-semibold" style={{ color: "hsl(220 20% 18%)" }}>Atividades Recentes</h3>
            <p className="text-[11px] mt-0.5" style={{ color: "hsl(220 10% 62%)" }}>
              Últimas ações registradas no sistema
            </p>
          </div>
        </div>
        <Link
          to="/auditoria"
          className="flex items-center gap-1 text-xs font-medium hover:underline"
          style={{ color: "hsl(230 80% 56%)" }}
        >
          Ver tudo <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      {loading ? (
        <LoadingState label="Carregando atividades…" variant="inline" />
      ) : error ? (
        <ErrorRetryState
          variant="inline"
          error={error}
          onRetry={() => setReloadKey((k) => k + 1)}
          title="Não foi possível carregar atividades"
        />
      ) : items.length === 0 ? (
        <div className="text-center py-6 text-xs" style={{ color: "hsl(220 10% 62%)" }}>
          Nenhuma atividade registrada ainda.
        </div>
      ) : (
        <div className="space-y-1.5">
          {items.map((row) => {
            const meta = ENTITY_META[row.entidade] ?? {
              label: row.entidade,
              icon: FileText,
              color: "text-slate-600",
              bg: "bg-slate-100",
            };
            const Icon = meta.icon;
            return (
              <div
                key={row.id}
                className="flex items-center gap-3 px-3 py-2 rounded-lg border transition-all"
                style={{ borderColor: "hsl(220 13% 93%)" }}
              >
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${meta.bg}`}>
                  <Icon className={`h-3.5 w-3.5 ${meta.color}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[12px] font-medium truncate" style={{ color: "hsl(220 20% 18%)" }}>
                    {meta.label} · {formatAction(row.acao)}
                  </div>
                  {row.entidade_id && (
                    <div className="text-[10px] truncate" style={{ color: "hsl(220 10% 55%)" }}>
                      ID {row.entidade_id.slice(0, 8)}
                    </div>
                  )}
                </div>
                <span className="text-[10px] shrink-0" style={{ color: "hsl(220 10% 55%)" }}>
                  {timeAgo(row.created_at)}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}