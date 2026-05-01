import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

/**
 * Aprovação de valor da venda em 1 clique.
 *
 * Regra de negócio simplificada:
 *   "Todo serviço pago tem checklist."
 *
 * Ao clicar, define automaticamente:
 *   - status_validacao_valor = 'aprovado'
 *   - valor_aprovado = valor_a_pagar (da própria venda)
 *   - validado_em / validado_por (auditoria)
 *
 * Aparece SOMENTE quando a venda ainda não foi aprovada.
 * Após aprovar, o GerarProcessoButton aparece automaticamente.
 */

interface VendaLite {
  id: number;
  id_legado?: number | null;
  valor_a_pagar?: number | string | null;
  status_validacao_valor?: string | null;
  valor_aprovado?: number | string | null;
  status?: string | null;
}

interface Props {
  venda: VendaLite;
  onApproved?: () => void;
}

export function AprovarValorButton({ venda, onApproved }: Props) {
  const [loading, setLoading] = useState(false);

  const isApproved =
    String(venda.status_validacao_valor || "") === "aprovado" &&
    venda.valor_aprovado !== null &&
    venda.valor_aprovado !== undefined;

  // Já aprovado: nada a fazer.
  if (isApproved) return null;

  // Só aprovamos vendas que já foram pagas (regra de negócio).
  const isPago = String(venda.status || "").toUpperCase() === "PAGO";
  if (!isPago) return null;

  const handleApprove = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const valor = Number(venda.valor_a_pagar || 0);
      if (!Number.isFinite(valor) || valor <= 0) {
        toast.error("Venda sem valor definido — não é possível aprovar.");
        return;
      }
      const { error } = await supabase
        .from("qa_vendas" as any)
        .update({
          status_validacao_valor: "aprovado",
          valor_aprovado: valor,
        } as any)
        .eq("id", venda.id);
      if (error) throw error;
      toast.success("Valor aprovado — checklist liberado");
      onApproved?.();
    } catch (e: any) {
      console.error("[AprovarValorButton] error:", e);
      toast.error(e?.message || "Falha ao aprovar valor");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={handleApprove}
      disabled={loading}
      className="h-7 px-2 text-[10px] font-bold uppercase tracking-wider text-amber-700 bg-amber-50 border border-amber-200 hover:bg-amber-100 hover:text-amber-800 rounded"
      title="Aprovar valor desta venda em 1 clique (libera o checklist)"
    >
      {loading
        ? <Loader2 className="h-3 w-3 animate-spin mr-1" />
        : <ShieldCheck className="h-3 w-3 mr-1" />}
      Aprovar valor
    </Button>
  );
}