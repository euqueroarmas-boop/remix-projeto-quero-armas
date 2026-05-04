/**
 * F1B-1 — Ordem manual dos grupos da aba Arsenal.
 *
 * Fonte de verdade: tabela `qa_arsenal_grupos_layout` (compartilhada entre
 * Equipe Quero Armas e cliente, mesmo padrão de qa_cliente_kpi_layouts).
 *
 * IDs canônicos dos grupos (ARSENAL_GROUP_IDS) — qualquer grupo NÃO listado
 * na ordem salva é apendado ao final em ordem padrão (forward-compat para
 * grupos novos).
 */
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type ArsenalGroupId =
  | "proximos_vencimentos"
  | "circunscricao_pf"
  | "bancada"
  | "craf"
  | "autorizacoes"
  | "gte"
  | "municoes";

export const DEFAULT_ARSENAL_ORDER: ArsenalGroupId[] = [
  "proximos_vencimentos",
  "circunscricao_pf",
  "bancada",
  "craf",
  "autorizacoes",
  "gte",
  "municoes",
];

export const ARSENAL_GROUP_LABELS: Record<ArsenalGroupId, string> = {
  proximos_vencimentos: "Próximos Vencimentos",
  circunscricao_pf: "Circunscrição PF",
  bancada: "Bancada Tática",
  craf: "Controle de CRAF",
  autorizacoes: "Controle de Autorizações",
  gte: "Controle de GTE",
  municoes: "Estoque de Munições",
};

function sanitize(raw: unknown): ArsenalGroupId[] {
  const all = new Set<ArsenalGroupId>(DEFAULT_ARSENAL_ORDER);
  const out: ArsenalGroupId[] = [];
  if (Array.isArray(raw)) {
    for (const v of raw) {
      if (typeof v === "string" && all.has(v as ArsenalGroupId) && !out.includes(v as ArsenalGroupId)) {
        out.push(v as ArsenalGroupId);
      }
    }
  }
  // Apenda quaisquer grupos faltantes (forward-compat).
  for (const id of DEFAULT_ARSENAL_ORDER) {
    if (!out.includes(id)) out.push(id);
  }
  return out;
}

export function useArsenalGruposLayout(clienteId: number | null | undefined) {
  const [order, setOrder] = useState<ArsenalGroupId[]>(DEFAULT_ARSENAL_ORDER);
  const [hasSaved, setHasSaved] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);

  // Carga inicial
  useEffect(() => {
    let cancelled = false;
    if (!clienteId) {
      setOrder(DEFAULT_ARSENAL_ORDER);
      setHasSaved(false);
      setLoaded(true);
      return;
    }
    (async () => {
      const { data } = await supabase
        .from("qa_arsenal_grupos_layout" as any)
        .select("ordem_grupos")
        .eq("cliente_id", clienteId)
        .eq("contexto", "arsenal")
        .maybeSingle();
      if (cancelled) return;
      if (data && (data as any).ordem_grupos) {
        setOrder(sanitize((data as any).ordem_grupos));
        setHasSaved(true);
      } else {
        setOrder(DEFAULT_ARSENAL_ORDER);
        setHasSaved(false);
      }
      setLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [clienteId]);

  // Realtime (cliente↔equipe)
  useEffect(() => {
    if (!clienteId) return;
    const ch = supabase
      .channel(`arsenal_grupos_layout_${clienteId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "qa_arsenal_grupos_layout",
          filter: `cliente_id=eq.${clienteId}`,
        },
        (payload: any) => {
          const next = (payload.new?.ordem_grupos ?? payload.old?.ordem_grupos) as unknown;
          if (Array.isArray(next)) {
            setOrder(sanitize(next));
            setHasSaved(true);
          }
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [clienteId]);

  const persist = useCallback(
    async (next: ArsenalGroupId[]) => {
      if (!clienteId) return;
      setSaving(true);
      try {
        const { data: ures } = await supabase.auth.getUser();
        const uid = ures.user?.id ?? null;
        const { error } = await supabase
          .from("qa_arsenal_grupos_layout" as any)
          .upsert(
            {
              cliente_id: clienteId,
              contexto: "arsenal",
              ordem_grupos: next as unknown as any,
              updated_by: uid,
            },
            { onConflict: "cliente_id,contexto" },
          );
        if (error) {
          console.error("[useArsenalGruposLayout] persist error", error);
          toast.error(`Não foi possível salvar a ordem dos grupos: ${error.message}`);
          return;
        }
        setHasSaved(true);
      } finally {
        setSaving(false);
      }
    },
    [clienteId],
  );

  const move = useCallback(
    (id: ArsenalGroupId, dir: -1 | 1) => {
      setOrder((prev) => {
        const idx = prev.indexOf(id);
        if (idx < 0) return prev;
        const target = idx + dir;
        if (target < 0 || target >= prev.length) return prev;
        const copy = prev.slice();
        const [item] = copy.splice(idx, 1);
        copy.splice(target, 0, item);
        void persist(copy);
        return copy;
      });
    },
    [persist],
  );

  const reorder = useCallback(
    (fromId: string, toId: string) => {
      setOrder((prev) => {
        const from = prev.indexOf(fromId as ArsenalGroupId);
        const to = prev.indexOf(toId as ArsenalGroupId);
        if (from < 0 || to < 0 || from === to) return prev;
        const copy = prev.slice();
        const [item] = copy.splice(from, 1);
        copy.splice(to, 0, item);
        void persist(copy);
        return copy;
      });
    },
    [persist],
  );

  const restoreDefault = useCallback(async () => {
    setOrder(DEFAULT_ARSENAL_ORDER);
    await persist(DEFAULT_ARSENAL_ORDER);
  }, [persist]);

  return { order, hasSaved, loaded, saving, move, reorder, restoreDefault };
}