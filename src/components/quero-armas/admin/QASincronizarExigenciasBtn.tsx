/**
 * BLOCO 6 — Botão "Sincronizar exigências do catálogo" (camada ADITIVA).
 *
 * Chama a RPC já existente `qa_explodir_checklist_processo(p_processo_id)`,
 * que insere SOMENTE as exigências faltantes em `qa_processo_documentos`
 * (deduplicação por tipo_documento). Nunca altera/remove docs já enviados
 * ou aprovados — a RPC retorna contadores (`inseridos`, `ja_existentes`,
 * `pre_validados`, `reaproveitados_cofre`).
 *
 * Não toca em edges congeladas nem no ProcessoDetalheDrawer.
 */
import { useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export interface QASincronizarExigenciasBtnProps {
  processoId: string;
  /** Estilo visual: chip pequeno (row da lista) ou botão grande. */
  variant?: "chip" | "block";
  /** Callback opcional para forçar reload da lista após sucesso. */
  onDone?: (resumo: SincResumo) => void;
  /** Confirmar antes de executar? Default: true. */
  confirm?: boolean;
  className?: string;
}

export interface SincResumo {
  inseridos: number;
  ja_existentes: number;
  pre_validados: number;
  reaproveitados_cofre: number;
}

export default function QASincronizarExigenciasBtn({
  processoId,
  variant = "chip",
  onDone,
  confirm = true,
  className = "",
}: QASincronizarExigenciasBtnProps) {
  const [loading, setLoading] = useState(false);

  const sincronizar = async (e?: React.MouseEvent) => {
    e?.stopPropagation();
    e?.preventDefault();
    if (
      confirm &&
      !window.confirm(
        "Sincronizar este processo com as exigências mais recentes do catálogo?\n\nApenas itens faltantes serão adicionados — nada do que o cliente já enviou será alterado.",
      )
    ) {
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc("qa_explodir_checklist_processo", {
        p_processo_id: processoId,
      });
      if (error) throw error;
      const row = Array.isArray(data) ? (data[0] as SincResumo | undefined) : (data as any);
      const resumo: SincResumo = {
        inseridos: Number(row?.inseridos ?? 0),
        ja_existentes: Number(row?.ja_existentes ?? 0),
        pre_validados: Number(row?.pre_validados ?? 0),
        reaproveitados_cofre: Number(row?.reaproveitados_cofre ?? 0),
      };
      if (resumo.inseridos > 0) {
        toast.success(
          `${resumo.inseridos} nova(s) exigência(s) adicionada(s) ao processo.` +
            (resumo.pre_validados > 0
              ? ` ${resumo.pre_validados} já pré-validada(s) pelos dados do cliente.`
              : ""),
        );
      } else {
        toast.info(
          `Processo já estava em dia com o catálogo (${resumo.ja_existentes} item(ns) existentes).`,
        );
      }
      onDone?.(resumo);
    } catch (err: any) {
      toast.error("Falha ao sincronizar: " + (err?.message ?? "erro"));
    } finally {
      setLoading(false);
    }
  };

  if (variant === "block") {
    return (
      <button
        type="button"
        onClick={sincronizar}
        disabled={loading}
        className={`inline-flex h-9 items-center gap-2 rounded-md border border-[#7A1F2B]/30 bg-white px-3 text-[11px] font-bold uppercase tracking-wider text-[#7A1F2B] hover:bg-[#7A1F2B]/5 disabled:opacity-50 ${className}`}
      >
        {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
        Sincronizar exigências do catálogo
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={sincronizar}
      disabled={loading}
      title="Sincronizar exigências do catálogo (insere apenas itens faltantes)"
      className={`inline-flex h-7 items-center gap-1 rounded-md border border-[#7A1F2B]/30 bg-white px-2 text-[10px] font-bold uppercase tracking-wider text-[#7A1F2B] hover:bg-[#7A1F2B]/5 disabled:opacity-50 ${className}`}
    >
      {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
      Sincronizar
    </button>
  );
}