import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

type Params = {
  /** id do cliente logado (qa_clientes.id) */
  clienteId: string | number | null | undefined;
  /** ids dos processos ativos do cliente */
  processoIds: string[];
  /** só varre quando o cliente REALMENTE tem pendência aberta */
  ativo: boolean;
  /** dispara o refresh silencioso dos dados do portal */
  onMudanca: () => void;
  /** intervalo entre varreduras (ms) */
  intervaloMs?: number;
};

/**
 * Varredura silenciosa por baixo do portal do cliente.
 *
 * Regra dura: só roda quando `ativo === true` (cliente logado COM pendência
 * aberta). Cliente sem pendência nunca tem a página atualizada — o hook não
 * consulta nada, não agenda nada e não dispara `onMudanca` em hipótese alguma.
 *
 * Quando roda, ela compara uma assinatura leve do estado das exigências e dos
 * documentos no banco. Se o servidor mudou (admin aprovou, exigência caiu,
 * documento venceu/foi reclassificado), o portal se atualiza sozinho, sem
 * reload de página e sem toast.
 */
export function useVarreduraSilenciosaPendencias({
  clienteId,
  processoIds,
  ativo,
  onMudanca,
  intervaloMs = 45_000,
}: Params) {
  const assinaturaRef = useRef<string | null>(null);
  const rodandoRef = useRef(false);
  const onMudancaRef = useRef(onMudanca);
  onMudancaRef.current = onMudanca;

  const chaveProcessos = processoIds.slice().sort().join("|");

  useEffect(() => {
    // Sem pendência => varredura desligada. Nada de refresh.
    if (!ativo) {
      assinaturaRef.current = null;
      return;
    }
    const idCliente = clienteId != null ? String(clienteId) : null;
    const ids = chaveProcessos ? chaveProcessos.split("|") : [];
    if (!idCliente && ids.length === 0) return;

    let cancelado = false;

    const varrer = async () => {
      if (cancelado || rodandoRef.current) return;
      if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
      rodandoRef.current = true;
      try {
        const partes: string[] = [];

        if (ids.length > 0) {
          const { data } = await supabase
            .from("qa_processo_documentos" as any)
            .select("id, status, updated_at")
            .in("processo_id", ids);
          for (const r of ((data as any[]) ?? []).sort((a, b) => String(a.id).localeCompare(String(b.id)))) {
            partes.push(`pd:${r.id}:${r.status ?? ""}:${r.updated_at ?? ""}`);
          }
        }

        if (idCliente) {
          const { data } = await supabase
            .from("qa_documentos_cliente" as any)
            .select("id, status, updated_at")
            .eq("qa_cliente_id", idCliente);
          for (const r of ((data as any[]) ?? []).sort((a, b) => String(a.id).localeCompare(String(b.id)))) {
            partes.push(`dc:${r.id}:${r.status ?? ""}:${r.updated_at ?? ""}`);
          }
        }

        const assinatura = partes.join("~");
        if (cancelado) return;
        if (assinaturaRef.current === null) {
          assinaturaRef.current = assinatura;
          return;
        }
        if (assinatura !== assinaturaRef.current) {
          assinaturaRef.current = assinatura;
          onMudancaRef.current();
        }
      } catch {
        // varredura é silenciosa: falha de rede não incomoda o cliente
      } finally {
        rodandoRef.current = false;
      }
    };

    void varrer();
    const timer = window.setInterval(() => void varrer(), intervaloMs);
    const aoVoltar = () => {
      if (document.visibilityState === "visible") void varrer();
    };
    document.addEventListener("visibilitychange", aoVoltar);
    window.addEventListener("focus", aoVoltar);

    return () => {
      cancelado = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", aoVoltar);
      window.removeEventListener("focus", aoVoltar);
    };
  }, [ativo, clienteId, chaveProcessos, intervaloMs]);
}
