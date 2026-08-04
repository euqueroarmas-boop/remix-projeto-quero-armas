import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Users, RefreshCw, ChevronDown, ChevronUp } from "lucide-react";

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

interface AcessoHoje extends Acesso {
  nome?: string | null;
  processos?: { nome: string; status: string | null }[];
  entradas_hoje?: number;
  entradas_total?: number;
}

interface ResumoCliente {
  chave: string;
  rotulo: string;
  total: number;
  primeiro: string;
  ultimo: string;
}

export default function DashboardClientesOnline() {
  const [online, setOnline] = useState<Acesso[]>([]);
  const [hoje, setHoje] = useState(0);
  const [acessosHoje, setAcessosHoje] = useState<AcessoHoje[]>([]);
  const [resumo, setResumo] = useState<ResumoCliente[]>([]);
  const [verHistorico, setVerHistorico] = useState(false);
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

    // Clientes que acessaram hoje (sessão do dia) + processo de cada um
    try {
      const { data: eventosHoje } = await supabase
        .from("qa_cliente_login_eventos" as any)
        .select("qa_cliente_id,user_id,email,dispositivo,created_at")
        .gte("created_at", inicioDia.toISOString())
        .order("created_at", { ascending: false })
        .limit(300);

      const linhas = ((eventosHoje ?? []) as any[]) as Acesso[];
      const vistos = new Set<string>();
      const unicos: AcessoHoje[] = [];
      const contagemHoje = new Map<string, number>();
      for (const l of linhas) {
        const chave = String(l.qa_cliente_id || l.user_id || l.email || "");
        if (!chave) continue;
        contagemHoje.set(chave, (contagemHoje.get(chave) ?? 0) + 1);
      }
      for (const l of linhas) {
        const chave = String(l.qa_cliente_id || l.user_id || l.email || "");
        if (!chave || vistos.has(chave)) continue;
        vistos.add(chave);
        unicos.push({ ...l, entradas_hoje: contagemHoje.get(chave) ?? 1 });
      }

      const ids = unicos.map((u) => u.qa_cliente_id).filter(Boolean) as any[];
      if (ids.length) {
        const [clientesRes, processosRes] = await Promise.allSettled([
          supabase.from("qa_clientes" as any).select("id,nome_completo").in("id", ids),
          supabase
            .from("qa_processos" as any)
            .select("cliente_id,servico_nome,status,created_at")
            .in("cliente_id", ids)
            .order("created_at", { ascending: false }),
        ]);
        const nomes = new Map<string, string>();
        if (clientesRes.status === "fulfilled") {
          for (const c of (((clientesRes.value as any)?.data ?? []) as any[])) {
            nomes.set(String(c.id), c.nome_completo);
          }
        }
        const procs = new Map<string, { nome: string; status: string | null }[]>();
        if (processosRes.status === "fulfilled") {
          for (const p of (((processosRes.value as any)?.data ?? []) as any[])) {
            const k = String(p.cliente_id);
            const arr = procs.get(k) ?? [];
            arr.push({ nome: p.servico_nome || "Serviço", status: p.status ?? null });
            procs.set(k, arr);
          }
        }
        for (const u of unicos) {
          const k = String(u.qa_cliente_id ?? "");
          u.nome = nomes.get(k) ?? null;
          u.processos = procs.get(k) ?? [];
        }
      }
      setAcessosHoje(unicos);
    } catch {
      /* silencioso */
    }

    // Resumo histórico (todas as entradas por cliente)
    try {
      const { data: todos } = await supabase
        .from("qa_cliente_login_eventos" as any)
        .select("qa_cliente_id,user_id,email,created_at")
        .order("created_at", { ascending: false })
        .limit(2000);

      const mapa = new Map<string, ResumoCliente>();
      for (const l of (((todos ?? []) as any[]) as Acesso[])) {
        const chave = String(l.qa_cliente_id || l.user_id || l.email || "");
        if (!chave) continue;
        const atual = mapa.get(chave);
        if (!atual) {
          mapa.set(chave, {
            chave,
            rotulo: l.email ?? "cliente",
            total: 1,
            primeiro: l.created_at,
            ultimo: l.created_at,
          });
        } else {
          atual.total += 1;
          if (l.created_at < atual.primeiro) atual.primeiro = l.created_at;
          if (l.created_at > atual.ultimo) atual.ultimo = l.created_at;
          if (!atual.rotulo || atual.rotulo === "cliente") atual.rotulo = l.email ?? atual.rotulo;
        }
      }
      setResumo([...mapa.values()].sort((a, b) => b.total - a.total));
    } catch {
      /* silencioso */
    }

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
        acessosHoje.length > 0 && (
          <div className="mt-4 border-t pt-3" style={{ borderColor: "hsl(220 14% 92%)" }}>
            <p className="qa-h2 text-[11px]">CLIENTES QUE ACESSARAM HOJE</p>
            <ul className="mt-2 space-y-2">
              {acessosHoje.slice(0, 10).map((a, i) => (
                <li key={`h-${a.qa_cliente_id ?? a.user_id ?? a.email ?? i}`} className="text-[11px]">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate font-semibold uppercase" style={{ color: "hsl(220 20% 25%)" }}>
                      {a.nome || a.email || "CLIENTE"}
                    </span>
                    <span style={{ color: "hsl(220 10% 62%)" }}>
                      {new Date(a.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                  <div className="mt-0.5" style={{ color: "hsl(220 10% 55%)" }}>
                    {a.processos && a.processos.length > 0
                      ? a.processos
                          .slice(0, 3)
                          .map((p) => `${p.nome}${p.status ? ` · ${p.status}` : ""}`)
                          .join(" | ")
                      : "sem processo ativo"}
                  </div>
                </li>
              ))}
              {acessosHoje.length > 10 && (
                <li className="text-[11px]" style={{ color: "hsl(220 10% 62%)" }}>
                  +{acessosHoje.length - 10} outros
                </li>
              )}
            </ul>
          </div>
        )
      )}

      {atualizadoEm && (
        <p className="mt-3 text-[10px]" style={{ color: "hsl(220 10% 70%)" }}>
          Atualizado às {atualizadoEm.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
        </p>
      )}
    </div>
  );
}