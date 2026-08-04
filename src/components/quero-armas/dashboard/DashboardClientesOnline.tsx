import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Users, RefreshCw } from "lucide-react";

/**
 * Card "Clientes na Área do Cliente".
 * Considera logado quem teve evento de login nos últimos 30 minutos
 * (janela de sessão ativa). Também mostra o total de acessos do dia.
 */

interface Acesso {
  qa_cliente_id: string | null;
  user_id: string | null;
  email: string | null;
  dispositivo: string | null;
  created_at: string;
}

const JANELA_MIN = 30;

export default function DashboardClientesOnline() {
  const [online, setOnline] = useState<Acesso[]>([]);
  const [hoje, setHoje] = useState(0);
  const [loading, setLoading] = useState(true);
  const [atualizadoEm, setAtualizadoEm] = useState<Date | null>(null);

  const carregar = useCallback(async () => {
    const desde = new Date(Date.now() - JANELA_MIN * 60 * 1000).toISOString();
    const inicioDia = new Date();
    inicioDia.setHours(0, 0, 0, 0);

    const [recentes, doDia] = await Promise.allSettled([
      supabase
        .from("qa_cliente_login_eventos" as any)
        .select("qa_cliente_id,user_id,email,dispositivo,created_at")
        .gte("created_at", desde)
        .order("created_at", { ascending: false })
        .limit(500),
      supabase
        .from("qa_cliente_login_eventos" as any)
        .select("id", { count: "exact", head: true })
        .gte("created_at", inicioDia.toISOString()),
    ]);

    if (recentes.status === "fulfilled") {
      const linhas = ((recentes.value as any)?.data ?? []) as Acesso[];
      const vistos = new Set<string>();
      const unicos: Acesso[] = [];
      for (const l of linhas) {
        const chave = l.qa_cliente_id || l.user_id || l.email || "";
        if (!chave || vistos.has(chave)) continue;
        vistos.add(chave);
        unicos.push(l);
      }
      setOnline(unicos);
    }
    if (doDia.status === "fulfilled") setHoje((doDia.value as any)?.count ?? 0);

    setAtualizadoEm(new Date());
    setLoading(false);
  }, []);

  useEffect(() => {
    carregar();
    const t = setInterval(carregar, 60_000);
    return () => clearInterval(t);
  }, [carregar]);

  const total = online.length;

  return (
    <div className="qa-card p-4 md:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span
            className="flex items-center justify-center h-9 w-9 rounded-lg"
            style={{ background: "hsl(352 60% 96%)", color: "hsl(352 60% 30%)" }}
          >
            <Users className="h-4.5 w-4.5" />
          </span>
          <div>
            <h2 className="qa-h2">CLIENTES NA ÁREA DO CLIENTE</h2>
            <p className="text-[11px]" style={{ color: "hsl(220 10% 62%)" }}>
              Sessões ativas nos últimos {JANELA_MIN} minutos
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => { setLoading(true); carregar(); }}
          className="flex items-center gap-1 h-7 px-2 rounded-md border text-[10px] font-semibold hover:opacity-80"
          style={{ borderColor: "hsl(220 14% 88%)", color: "hsl(220 10% 45%)" }}
          title="Atualizar agora"
        >
          <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} /> ATUALIZAR
        </button>
      </div>

      <div className="mt-4 flex items-end gap-6">
        <div>
          <div className="flex items-center gap-2">
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{ background: total > 0 ? "hsl(152 60% 40%)" : "hsl(220 10% 75%)" }}
            />
            <span className="text-3xl font-bold tabular-nums" style={{ color: "hsl(220 20% 18%)" }}>
              {total}
            </span>
          </div>
          <p className="text-[11px] mt-0.5" style={{ color: "hsl(220 10% 62%)" }}>
            {total === 1 ? "cliente logado agora" : "clientes logados agora"}
          </p>
        </div>
        <div className="pb-1">
          <span className="text-lg font-semibold tabular-nums" style={{ color: "hsl(220 20% 30%)" }}>
            {hoje}
          </span>
          <p className="text-[11px]" style={{ color: "hsl(220 10% 62%)" }}>acessos hoje</p>
        </div>
      </div>

      {total > 0 && (
        <ul className="mt-3 border-t pt-2 space-y-1" style={{ borderColor: "hsl(220 14% 92%)" }}>
          {online.slice(0, 6).map((a, i) => (
            <li key={`${a.qa_cliente_id ?? a.user_id ?? a.email ?? i}`} className="flex items-center justify-between text-[11px]">
              <span className="truncate mr-2" style={{ color: "hsl(220 20% 30%)" }}>
                {a.email ?? "cliente"}
              </span>
              <span style={{ color: "hsl(220 10% 62%)" }}>
                {new Date(a.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                {a.dispositivo ? ` · ${a.dispositivo}` : ""}
              </span>
            </li>
          ))}
          {total > 6 && (
            <li className="text-[11px]" style={{ color: "hsl(220 10% 62%)" }}>+{total - 6} outros</li>
          )}
        </ul>
      )}

      {atualizadoEm && (
        <p className="mt-3 text-[10px]" style={{ color: "hsl(220 10% 70%)" }}>
          Atualizado às {atualizadoEm.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
        </p>
      )}
    </div>
  );
}