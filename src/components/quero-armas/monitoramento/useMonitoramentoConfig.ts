import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { BLOCOS_MONITORAMENTO, type MonitoramentoBlocoKey } from "./blocosCatalogo";

export interface MonitoramentoConfigState {
  /** true = bloco ativado (renderizado). Default: true para todas as keys. */
  enabled: Record<MonitoramentoBlocoKey, boolean>;
  loading: boolean;
  error: string | null;
  /** Recarrega do banco. */
  reload: () => Promise<void>;
  /** Atualiza UMA chave (otimista + persiste). */
  setEnabled: (key: MonitoramentoBlocoKey, value: boolean) => Promise<void>;
}

function defaultMap(): Record<MonitoramentoBlocoKey, boolean> {
  const out = {} as Record<MonitoramentoBlocoKey, boolean>;
  for (const b of BLOCOS_MONITORAMENTO) out[b.key] = true;
  return out;
}

/**
 * Hook usado pela página /operacao/monitoramento e pela seção
 * "Configurações de Monitoramento" para ler/escrever a tabela
 * qa_monitoramento_configuracoes (configuração global do sistema).
 */
export function useMonitoramentoConfig(): MonitoramentoConfigState {
  const [enabled, setEnabledState] = useState<Record<MonitoramentoBlocoKey, boolean>>(defaultMap);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase
        .from("qa_monitoramento_configuracoes" as any)
        .select("config_key, enabled");
      if (error) throw error;
      const next = defaultMap();
      for (const row of (data as any[]) ?? []) {
        const k = row.config_key as MonitoramentoBlocoKey;
        if (k in next) next[k] = !!row.enabled;
      }
      setEnabledState(next);
    } catch (e: any) {
      // Falha silenciosa: mantém defaults (tudo ativado).
      setError(e?.message || "Falha ao carregar configurações de monitoramento");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void reload(); }, [reload]);

  const setEnabled = useCallback(async (key: MonitoramentoBlocoKey, value: boolean) => {
    // Otimista
    setEnabledState((prev) => ({ ...prev, [key]: value }));
    try {
      const { data: u } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("qa_monitoramento_configuracoes" as any)
        .upsert(
          {
            config_key: key,
            enabled: value,
            updated_by: u?.user?.id ?? null,
          },
          { onConflict: "config_key" },
        );
      if (error) throw error;
    } catch (e: any) {
      // Reverte e propaga
      setEnabledState((prev) => ({ ...prev, [key]: !value }));
      throw e;
    }
  }, []);

  return { enabled, loading, error, reload, setEnabled };
}