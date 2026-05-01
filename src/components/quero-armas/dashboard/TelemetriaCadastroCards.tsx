import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  AlertTriangle,
  ShieldAlert,
  MapPinOff,
  Activity,
  Users,
} from "lucide-react";

/**
 * Telemetria de Qualidade do Cadastro Público (Quero Armas).
 * Mostra 4 KPIs sobre os últimos 7 ou 30 dias:
 *  • Total de eventos
 *  • % com ambiguidade CPF×RG detectada pela IA
 *  • % com divergência form×documento confirmada pelo usuário
 *  • % com circunscrição PF não encontrada
 *
 * Lê direto da tabela `qa_cadastro_telemetria`. RLS já restringe à Equipe Quero Armas.
 */

type Period = 7 | 30;

interface RowAgg {
  event_type: string;
  categoria_titular: string | null;
  created_at: string;
}

const EVENT_LABELS: Record<string, string> = {
  cpf_rg_ambiguity_detected: "Ambiguidade CPF×RG",
  divergencia_confirmada: "Divergências confirmadas",
  circunscricao_nao_encontrada: "Circunscrição não encontrada",
};

const CATEGORIA_LABELS: Record<string, string> = {
  pessoa_fisica: "Pessoa Física",
  pessoa_juridica: "Pessoa Jurídica",
  seguranca_publica: "Segurança Pública",
  magistrado_mp: "Magistrado/MP",
  militar: "Militar",
};

function pct(part: number, total: number): string {
  if (!total) return "0%";
  return `${Math.round((part / total) * 100)}%`;
}

export default function TelemetriaCadastroCards() {
  const [period, setPeriod] = useState<Period>(7);
  const [rows, setRows] = useState<RowAgg[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const since = new Date();
    since.setDate(since.getDate() - period);
    setLoading(true);
    setErr(null);
    (async () => {
      try {
        const { data, error } = await supabase
          .from("qa_cadastro_telemetria" as any)
          .select("event_type, categoria_titular, created_at")
          .gte("created_at", since.toISOString())
          .order("created_at", { ascending: false })
          .limit(2000);
        if (cancelled) return;
        if (error) {
          setErr(error.message);
          setRows([]);
        } else {
          setRows((data as any[]) || []);
        }
      } catch (e: any) {
        if (!cancelled) setErr(e?.message || "Falha ao carregar telemetria");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [period]);

  const total = rows.length;
  const byEvent: Record<string, number> = {};
  const byCategoria: Record<string, number> = {};
  for (const r of rows) {
    byEvent[r.event_type] = (byEvent[r.event_type] || 0) + 1;
    const c = r.categoria_titular || "nao_informada";
    byCategoria[c] = (byCategoria[c] || 0) + 1;
  }
  const ambig = byEvent["cpf_rg_ambiguity_detected"] || 0;
  const diverg = byEvent["divergencia_confirmada"] || 0;
  const semCirc = byEvent["circunscricao_nao_encontrada"] || 0;

  return (
    <div
      className="rounded-2xl border bg-white p-4 md:p-5"
      style={{ borderColor: "hsl(220 18% 92%)" }}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center"
            style={{ background: "hsl(38 92% 96%)" }}
          >
            <Activity className="w-4 h-4" style={{ color: "hsl(38 92% 45%)" }} />
          </div>
          <div>
            <h2
              className="text-[14px] font-semibold tracking-tight"
              style={{ color: "hsl(220 20% 18%)" }}
            >
              QUALIDADE DO CADASTRO
            </h2>
            <p className="text-[11px]" style={{ color: "hsl(220 10% 55%)" }}>
              Telemetria dos últimos {period} dias
            </p>
          </div>
        </div>
        <div className="flex gap-1 rounded-lg border p-0.5" style={{ borderColor: "hsl(220 18% 90%)" }}>
          {([7, 30] as Period[]).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPeriod(p)}
              className="px-2.5 h-6 text-[11px] font-semibold rounded-md transition-all"
              style={
                period === p
                  ? { background: "hsl(220 25% 18%)", color: "white" }
                  : { color: "hsl(220 12% 50%)", background: "transparent" }
              }
            >
              {p}d
            </button>
          ))}
        </div>
      </div>

      {err && (
        <div
          className="mb-3 text-[11px] px-3 py-2 rounded-md"
          style={{ background: "hsl(0 80% 96%)", color: "hsl(0 70% 38%)" }}
        >
          Não foi possível carregar telemetria: {err}
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card
          icon={<Users className="w-4 h-4" />}
          label="EVENTOS"
          value={loading ? "—" : String(total)}
          hint="Total no período"
          tone="neutral"
        />
        <Card
          icon={<ShieldAlert className="w-4 h-4" />}
          label="AMBIGUIDADE CPF×RG"
          value={loading ? "—" : pct(ambig, total)}
          hint={`${ambig} ocorrência${ambig === 1 ? "" : "s"}`}
          tone="amber"
        />
        <Card
          icon={<AlertTriangle className="w-4 h-4" />}
          label="DIVERGÊNCIAS CONFIRMADAS"
          value={loading ? "—" : pct(diverg, total)}
          hint={`${diverg} confirmação${diverg === 1 ? "" : "ões"}`}
          tone="blue"
        />
        <Card
          icon={<MapPinOff className="w-4 h-4" />}
          label="CIRCUNSCRIÇÃO N/A"
          value={loading ? "—" : pct(semCirc, total)}
          hint={`${semCirc} caso${semCirc === 1 ? "" : "s"}`}
          tone="rose"
        />
      </div>

      {/* Breakdown por categoria — só renderiza se houver dado */}
      {!loading && total > 0 && (
        <div className="mt-4 pt-4 border-t" style={{ borderColor: "hsl(220 18% 94%)" }}>
          <h3
            className="text-[10px] font-semibold uppercase tracking-wider mb-2"
            style={{ color: "hsl(220 10% 55%)" }}
          >
            POR CATEGORIA DO TITULAR
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {Object.entries(byCategoria)
              .sort((a, b) => b[1] - a[1])
              .map(([cat, count]) => (
                <div
                  key={cat}
                  className="flex items-center justify-between px-3 h-8 rounded-md"
                  style={{ background: "hsl(220 20% 98%)" }}
                >
                  <span className="text-[11px] font-medium" style={{ color: "hsl(220 18% 28%)" }}>
                    {CATEGORIA_LABELS[cat] || (cat === "nao_informada" ? "Não informada" : cat)}
                  </span>
                  <span className="text-[11px] font-semibold tabular-nums" style={{ color: "hsl(220 25% 18%)" }}>
                    {count} ({pct(count, total)})
                  </span>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Card({
  icon,
  label,
  value,
  hint,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint: string;
  tone: "neutral" | "amber" | "blue" | "rose";
}) {
  const palette = {
    neutral: { bg: "hsl(220 20% 98%)", icon: "hsl(220 15% 40%)", border: "hsl(220 18% 92%)" },
    amber: { bg: "hsl(38 92% 96%)", icon: "hsl(38 92% 45%)", border: "hsl(38 80% 88%)" },
    blue: { bg: "hsl(220 90% 97%)", icon: "hsl(220 80% 50%)", border: "hsl(220 80% 90%)" },
    rose: { bg: "hsl(0 80% 97%)", icon: "hsl(0 70% 50%)", border: "hsl(0 70% 90%)" },
  }[tone];

  return (
    <div
      className="rounded-xl border p-3"
      style={{ background: palette.bg, borderColor: palette.border }}
    >
      <div className="flex items-center gap-1.5 mb-1.5" style={{ color: palette.icon }}>
        {icon}
        <span className="text-[10px] font-semibold uppercase tracking-wider">{label}</span>
      </div>
      <div
        className="text-xl font-bold tabular-nums leading-none"
        style={{ color: "hsl(220 25% 18%)" }}
      >
        {value}
      </div>
      <div className="text-[10px] mt-1" style={{ color: "hsl(220 10% 55%)" }}>
        {hint}
      </div>
    </div>
  );
}