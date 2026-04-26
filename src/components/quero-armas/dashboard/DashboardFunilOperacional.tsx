import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import { Users, FolderOpen, PenTool, CheckCircle, ArrowRight, TrendingUp } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface FunnelStage {
  key: string;
  label: string;
  value: number;
  icon: any;
  color: string;
  bg: string;
  to: string;
  hint: string;
}

/**
 * Visão executiva: conversão Cadastros → Clientes → Casos → Peças aprovadas.
 * Widget próprio, independente das ondas críticas do dashboard. Falhas são silenciosas
 * (mostra "—") para não comprometer a tela quando RLS/timeout interferir.
 */
export default function DashboardFunilOperacional() {
  const [stats, setStats] = useState<{
    cadastros: number;
    clientes: number;
    casos: number;
    aprovadas: number;
    loading: boolean;
  }>({
    cadastros: 0,
    clientes: 0,
    casos: 0,
    aprovadas: 0,
    loading: true,
  });

  useEffect(() => {
    let cancelled = false;
    const safety = setTimeout(() => {
      if (!cancelled) setStats((s) => ({ ...s, loading: false }));
    }, 8000);
    (async () => {
      try {
        const results = await Promise.allSettled([
          supabase.from("qa_cadastro_publico" as any).select("id", { count: "exact", head: true }),
          supabase.from("qa_clientes" as any).select("id", { count: "exact", head: true }),
          supabase.from("qa_casos" as any).select("id", { count: "exact", head: true }),
          supabase
            .from("qa_geracoes_pecas" as any)
            .select("id", { count: "exact", head: true })
            .eq("status_revisao", "aprovado"),
        ]);
        if (cancelled) return;
        const pick = (i: number) => {
          const r = results[i];
          return r.status === "fulfilled" ? ((r.value as any).count as number) ?? 0 : 0;
        };
        setStats({
          cadastros: pick(0),
          clientes: pick(1),
          casos: pick(2),
          aprovadas: pick(3),
          loading: false,
        });
      } catch {
        if (!cancelled) setStats((s) => ({ ...s, loading: false }));
      } finally {
        clearTimeout(safety);
      }
    })();
    return () => {
      cancelled = true;
      clearTimeout(safety);
    };
  }, []);

  const stages: FunnelStage[] = [
    {
      key: "cadastros",
      label: "Cadastros",
      value: stats.cadastros,
      icon: Users,
      color: "text-blue-600",
      bg: "bg-blue-50",
      to: "/clientes",
      hint: "Formulário público",
    },
    {
      key: "clientes",
      label: "Clientes",
      value: stats.clientes,
      icon: Users,
      color: "text-violet-600",
      bg: "bg-violet-50",
      to: "/clientes",
      hint: "Carteira ativa",
    },
    {
      key: "casos",
      label: "Casos",
      value: stats.casos,
      icon: FolderOpen,
      color: "text-amber-600",
      bg: "bg-amber-50",
      to: "/casos",
      hint: "Em andamento",
    },
    {
      key: "aprovadas",
      label: "Aprovadas",
      value: stats.aprovadas,
      icon: CheckCircle,
      color: "text-emerald-600",
      bg: "bg-emerald-50",
      to: "/historico",
      hint: "Peças deferidas",
    },
  ];

  // Conversão: aprovadas / cadastros (defensivo).
  const conversao =
    stats.cadastros > 0 ? Math.round((stats.aprovadas / stats.cadastros) * 100) : 0;

  return (
    <div className="qa-card p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center"
            style={{ background: "hsl(160 70% 95%)" }}
          >
            <TrendingUp className="h-3.5 w-3.5" style={{ color: "hsl(160 70% 36%)" }} />
          </div>
          <div>
            <h3 className="text-sm font-semibold" style={{ color: "hsl(220 20% 18%)" }}>
              Funil Operacional
            </h3>
            <p className="text-[11px] mt-0.5" style={{ color: "hsl(220 10% 62%)" }}>
              Conversão do cadastro à peça aprovada
            </p>
          </div>
        </div>
        <div className="text-right">
          <div className="text-[10px] uppercase tracking-wider" style={{ color: "hsl(220 10% 62%)" }}>
            Conversão total
          </div>
          <div className="text-lg font-bold" style={{ color: "hsl(160 70% 36%)" }}>
            {stats.loading ? <Skeleton className="h-5 w-12 inline-block align-middle" /> : `${conversao}%`}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3">
        {stages.map((s, i) => {
          const Icon = s.icon;
          return (
            <Link
              key={s.key}
              to={s.to}
              className="relative flex flex-col gap-1.5 px-3 py-3 rounded-xl border transition-all hover:shadow-sm group"
              style={{ borderColor: "hsl(220 13% 93%)" }}
            >
              <div className="flex items-center gap-2">
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${s.bg}`}>
                  <Icon className={`h-3.5 w-3.5 ${s.color}`} />
                </div>
                <span className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: "hsl(220 10% 55%)" }}>
                  {s.label}
                </span>
              </div>
              <div className="text-xl font-bold" style={{ color: "hsl(220 20% 18%)" }}>
                {stats.loading ? <Skeleton className="h-6 w-14" /> : s.value.toLocaleString("pt-BR")}
              </div>
              <div className="text-[10px]" style={{ color: "hsl(220 10% 62%)" }}>
                {s.hint}
              </div>
              {i < stages.length - 1 && (
                <ArrowRight
                  className="hidden md:block absolute -right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5"
                  style={{ color: "hsl(220 13% 80%)" }}
                />
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}