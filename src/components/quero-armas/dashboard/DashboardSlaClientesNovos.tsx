import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Clock, AlertTriangle, Pause, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { calcularSla, SLA_PRIORIDADE, type SlaResult } from "@/lib/qaSlaCadastro";

interface Row {
  id: string;
  nome_completo: string;
  end1_cidade: string | null;
  end1_estado: string | null;
  servico_interesse: string | null;
  pago_em: string | null;
  aguardando_cliente_desde: string | null;
  dias_pausados: number | null;
  sla_concluido_em: string | null;
}

export default function DashboardSlaClientesNovos() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data } = await supabase
        .from("qa_cadastro_publico")
        .select("id,nome_completo,end1_cidade,end1_estado,servico_interesse,pago_em,aguardando_cliente_desde,dias_pausados,sla_concluido_em")
        .eq("pago", true)
        .is("sla_concluido_em", null)
        .not("pago_em", "is", null)
        .order("pago_em", { ascending: true })
        .limit(50);
      if (!alive) return;
      setRows(((data as any[]) ?? []) as Row[]);
      setLoading(false);
    })();
    return () => { alive = false; };
  }, []);

  const items = useMemo(() => {
    const list = rows
      .map(r => ({ row: r, sla: calcularSla(r) }))
      .filter((x): x is { row: Row; sla: SlaResult } => x.sla !== null)
      .sort((a, b) => SLA_PRIORIDADE[a.sla.status] - SLA_PRIORIDADE[b.sla.status]);
    return list;
  }, [rows]);

  const counts = useMemo(() => {
    const acc = { no_prazo: 0, alerta: 0, quase_atrasado: 0, atrasado: 0, pausado: 0 };
    for (const it of items) {
      if (it.sla.status in acc) (acc as any)[it.sla.status]++;
    }
    return acc;
  }, [items]);

  return (
    <div className="qa-card p-4 md:p-6" style={{ background: "#ffffff" }}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Clock className="w-5 h-5" style={{ color: "hsl(220 30% 30%)" }} />
          <div>
            <h3 className="text-sm font-semibold" style={{ color: "hsl(220 20% 18%)" }}>
              SLA · Clientes Novos
            </h3>
            <p className="text-xs text-slate-500">Prazo 1–25 dias desde o pagamento. Pausa quando aguardando documentos do cliente.</p>
          </div>
        </div>
        <Link to="/clientes" className="text-xs font-medium text-blue-600 flex items-center gap-1 hover:underline">
          Ver todos <ArrowRight className="w-3 h-3" />
        </Link>
      </div>

      {/* Resumo por faixa */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-4">
        <FaixaCard label="No prazo" value={counts.no_prazo} cor="#16a34a" bg="#f0fdf4" />
        <FaixaCard label="Alerta" value={counts.alerta} cor="#ca8a04" bg="#fefce8" />
        <FaixaCard label="Quase atrasado" value={counts.quase_atrasado} cor="#ea580c" bg="#fff7ed" />
        <FaixaCard label="Atrasado" value={counts.atrasado} cor="#dc2626" bg="#fef2f2" icon={<AlertTriangle className="w-3 h-3" />} />
        <FaixaCard label="Pausado" value={counts.pausado} cor="#6366f1" bg="#eef2ff" icon={<Pause className="w-3 h-3" />} />
      </div>

      {loading ? (
        <div className="text-xs text-slate-500 py-4 text-center">Carregando…</div>
      ) : items.length === 0 ? (
        <div className="text-xs text-slate-500 py-6 text-center">
          Nenhum cliente novo em andamento. Marque um cadastro como <strong>PAGO</strong> para iniciar o contador.
        </div>
      ) : (
        <ul className="space-y-2 max-h-[420px] overflow-y-auto">
          {items.slice(0, 12).map(({ row, sla }) => (
            <li
              key={row.id}
              className="flex items-center justify-between gap-3 p-3 rounded-lg border"
              style={{ borderColor: "#e2e8f0", background: "#fafbfc", overflowWrap: "anywhere", wordBreak: "break-word" }}
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold truncate" style={{ color: "hsl(220 20% 18%)" }}>
                  {(row.nome_completo || "").toUpperCase()}
                </p>
                <p className="text-xs text-slate-500 truncate">
                  {[row.end1_cidade, row.end1_estado].filter(Boolean).join("/")} · {row.servico_interesse || "—"}
                </p>
                {sla.estaPausado && (
                  <p className="text-[11px] mt-1" style={{ color: "#6366f1" }}>
                    ⏸ Aguardando cliente há {sla.pausaEmAndamento + 1}d
                  </p>
                )}
              </div>
              <span
                className="text-[11px] font-bold px-2.5 py-1 rounded-full whitespace-nowrap"
                style={{ color: sla.cor, background: sla.bg, border: `1px solid ${sla.cor}33` }}
              >
                {sla.label}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function FaixaCard({ label, value, cor, bg, icon }: { label: string; value: number; cor: string; bg: string; icon?: React.ReactNode }) {
  return (
    <div className="rounded-lg p-2.5 border text-center" style={{ background: bg, borderColor: `${cor}33` }}>
      <div className="flex items-center justify-center gap-1 text-[10px] font-bold uppercase" style={{ color: cor }}>
        {icon}{label}
      </div>
      <div className="text-xl font-bold mt-0.5" style={{ color: cor }}>{value}</div>
    </div>
  );
}