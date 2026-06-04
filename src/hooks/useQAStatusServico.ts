import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface QAStatusServico {
  id: string;
  nome: string;
  ordem: number;
  ativo: boolean;
}

export function useQAStatusServico() {
  const [statuses, setStatuses] = useState<QAStatusServico[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    const { data } = await supabase
      .from("qa_status_servico" as any)
      .select("*")
      .eq("ativo", true)
      .order("ordem", { ascending: true });
    setStatuses(((data as any[]) ?? []) as QAStatusServico[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  return { statuses, loading, reload };
}
