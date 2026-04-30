import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { resolveServicoFromInteresse } from "@/lib/quero-armas/servicoSlugMap";

export type PendenciaTipo =
  | "sem_cliente_vinculado"
  | "servico_solicitado_nao_gerado"
  | "servico_pendente_classificacao";

export type PendenciaItem = {
  cadastro_publico_id: string;
  cliente_id_vinculado: number | null;
  nome: string;
  cpf: string | null;
  servico_interesse: string | null;
  servico_slug: string;
  servico_nome: string;
  pendencias: PendenciaTipo[];
  status_formulario: string | null;
  created_at: string;
};

const FECHADAS_KEY = "qa_pendencias_fechadas_v1";
const SESSION_DISMISS_KEY = "qa_pendencias_dismissed_session";

function readFechadas(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(FECHADAS_KEY) || "[]"));
  } catch {
    return new Set();
  }
}

function writeFechadas(set: Set<string>) {
  try {
    localStorage.setItem(FECHADAS_KEY, JSON.stringify(Array.from(set)));
  } catch {
    /* noop */
  }
}

/**
 * Fonte central de pendências críticas relacionadas a cadastros públicos
 * que precisam de ação operacional antes de seguir o fluxo.
 * Usa apenas leitura (RLS-safe). Não altera dados.
 */
export function useCadastroPendenciasCriticas() {
  const [pendencias, setPendencias] = useState<PendenciaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [resolvidasLocal, setResolvidasLocal] = useState<Set<string>>(readFechadas());

  const recompute = useCallback(async () => {
    setLoading(true);
    try {
      // 1) cadastros públicos com serviço informado
      const { data: cads } = await supabase
        .from("qa_cadastro_publico" as any)
        .select("id, nome_completo, cpf, servico_interesse, cliente_id_vinculado, status, created_at")
        .not("servico_interesse", "is", null)
        .order("created_at", { ascending: false });

      const rows = (cads as any[]) ?? [];
      if (rows.length === 0) {
        setPendencias([]);
        return;
      }

      // 2) Para cada cadastro com cliente vinculado, descobre serviços já presentes
      const clienteIds = Array.from(
        new Set(rows.map((r) => r.cliente_id_vinculado).filter((n) => Number.isFinite(n))),
      ) as number[];

      // Mapa cliente_id_real -> Set(servico_id)
      const servicosPorCliente = new Map<number, Set<number>>();
      if (clienteIds.length > 0) {
        // qa_clientes -> id_legado para resolver join legacy de qa_vendas/qa_itens_venda
        const { data: clis } = await supabase
          .from("qa_clientes" as any)
          .select("id, id_legado")
          .in("id", clienteIds);
        const idLegPorId = new Map<number, number | null>();
        ((clis as any[]) ?? []).forEach((c) => idLegPorId.set(c.id, c.id_legado ?? null));

        const allKeys = Array.from(
          new Set(
            clienteIds.flatMap((id) => [id, idLegPorId.get(id)].filter((n) => Number.isFinite(n))),
          ),
        ) as number[];

        if (allKeys.length > 0) {
          const { data: vendas } = await supabase
            .from("qa_vendas" as any)
            .select("id, id_legado, cliente_id")
            .in("cliente_id", allKeys);
          const vendasArr = (vendas as any[]) ?? [];
          const vendaIds = vendasArr.map((v) => v.id_legado ?? v.id).filter((n) => Number.isFinite(n));
          const vendaIdToCliFK = new Map<number, number>();
          vendasArr.forEach((v) => vendaIdToCliFK.set(v.id_legado ?? v.id, v.cliente_id));

          if (vendaIds.length > 0) {
            const { data: itens } = await supabase
              .from("qa_itens_venda" as any)
              .select("venda_id, servico_id")
              .in("venda_id", vendaIds);
            ((itens as any[]) ?? []).forEach((it) => {
              const cliFK = vendaIdToCliFK.get(it.venda_id);
              if (cliFK == null || it.servico_id == null) return;
              // Resolve cliente real (id) a partir do FK (que pode ser id_legado)
              const clienteReal =
                clienteIds.find((id) => id === cliFK) ??
                clienteIds.find((id) => idLegPorId.get(id) === cliFK);
              if (clienteReal == null) return;
              if (!servicosPorCliente.has(clienteReal)) servicosPorCliente.set(clienteReal, new Set());
              servicosPorCliente.get(clienteReal)!.add(Number(it.servico_id));
            });
          }
        }
      }

      const list: PendenciaItem[] = [];
      for (const r of rows) {
        const servico = resolveServicoFromInteresse(r.servico_interesse);
        const tipos: PendenciaTipo[] = [];

        if (!r.cliente_id_vinculado) {
          tipos.push("sem_cliente_vinculado");
        } else {
          const set = servicosPorCliente.get(r.cliente_id_vinculado);
          const haContratado = servico.servico_id != null && set?.has(servico.servico_id);
          if (!haContratado) tipos.push("servico_solicitado_nao_gerado");
        }

        if (servico.pendente_classificacao) tipos.push("servico_pendente_classificacao");

        if (tipos.length === 0) continue;
        if (resolvidasLocal.has(String(r.id))) continue;

        list.push({
          cadastro_publico_id: String(r.id),
          cliente_id_vinculado: r.cliente_id_vinculado ?? null,
          nome: r.nome_completo ?? "(Sem nome)",
          cpf: r.cpf ?? null,
          servico_interesse: r.servico_interesse ?? null,
          servico_slug: servico.slug,
          servico_nome: servico.nome,
          pendencias: tipos,
          status_formulario: r.status ?? null,
          created_at: r.created_at,
        });
      }

      setPendencias(list);
    } finally {
      setLoading(false);
    }
  }, [resolvidasLocal]);

  useEffect(() => {
    void recompute();
  }, [recompute]);

  const marcarResolvida = useCallback((cadastroId: string) => {
    setResolvidasLocal((prev) => {
      const next = new Set(prev);
      next.add(cadastroId);
      writeFechadas(next);
      return next;
    });
  }, []);

  return { pendencias, loading, reload: recompute, marcarResolvida };
}

export function shouldShowPendenciasModalThisSession(): boolean {
  try {
    return sessionStorage.getItem(SESSION_DISMISS_KEY) !== "1";
  } catch {
    return true;
  }
}

export function dismissPendenciasModalForSession() {
  try {
    sessionStorage.setItem(SESSION_DISMISS_KEY, "1");
  } catch {
    /* noop */
  }
}