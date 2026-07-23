import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Loader2, DollarSign, X } from "lucide-react";
import { toast } from "sonner";

/**
 * Confirma pagamento MANUAL da venda com forma real (PIX/Boleto/Débito/Crédito Nx).
 *
 * Complementa o AprovarValorButton — aquele valida O VALOR NEGOCIADO
 * (status_validacao_valor='aprovado'); ESTE marca o PAGAMENTO EFETIVO
 * (pagamento_status='confirmado'), o que dispara qa_confirmar_pagamento_processo
 * → qa_explodir_checklist_processo automaticamente. Sem chamar isso, o
 * checklist não aparece no portal do cliente.
 */

type FormaPagamento = "pix" | "boleto" | "cartao_debito" | "cartao_credito";

interface VendaLite {
  id: number;
  pagamento_status?: string | null;
  valor_aprovado?: number | string | null;
  valor_a_pagar?: number | string | null;
}

interface Props {
  venda: VendaLite;
  onConfirmed?: () => void;
}

export function ConfirmarPagamentoButton({ venda, onConfirmed }: Props) {
  const [aberto, setAberto] = useState(false);
  const [loading, setLoading] = useState(false);
  const [forma, setForma] = useState<FormaPagamento>("pix");
  const [parcelas, setParcelas] = useState(1);

  const jaConfirmado = String(venda.pagamento_status || "").toLowerCase() === "confirmado";

  if (jaConfirmado) {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200">
        <DollarSign className="w-3 h-3" /> Pagamento confirmado
      </span>
    );
  }

  async function confirmar() {
    setLoading(true);
    try {
      const nparcelas = forma === "cartao_credito" ? Math.max(1, parcelas) : 1;
      const { data, error } = await supabase.functions.invoke("qa-venda-confirmar-pagamento-manual", {
        body: {
          venda_id: venda.id,
          forma_pagamento: forma,
          parcelas: nparcelas,
          observacao: `Pagamento manual confirmado pela equipe: ${forma}${nparcelas > 1 ? ` em ${nparcelas}x` : ""}.`,
          notificacao_policy: {
            notificar_cliente: true,
            canais: { email: true, whatsapp: false, push: false },
            motivo_nao_notificar: "",
          },
        },
      });
      if (error || !(data as any)?.ok) {
        throw new Error((data as any)?.error || error?.message || "Falha ao confirmar pagamento");
      }
      toast.success("Pagamento confirmado. O checklist do cliente será populado automaticamente.");
      setAberto(false);
      onConfirmed?.();
    } catch (e: any) {
      toast.error(e?.message || "Erro ao confirmar pagamento");
    } finally {
      setLoading(false);
    }
  }

  if (!aberto) {
    return (
      <Button
        size="sm"
        variant="outline"
        onClick={() => setAberto(true)}
        className="h-7 text-xs gap-1 border-emerald-300 text-emerald-700 hover:bg-emerald-50"
      >
        <DollarSign className="w-3 h-3" /> Confirmar Pagamento
      </Button>
    );
  }

  return (
    <div className="inline-flex items-center gap-1.5 border border-emerald-300 rounded-md px-2 py-1 bg-emerald-50/40">
      <span className="text-[10px] font-semibold uppercase text-emerald-700">Forma:</span>
      <select
        value={forma}
        onChange={(e) => setForma(e.target.value as FormaPagamento)}
        disabled={loading}
        className="h-6 text-[11px] border border-emerald-200 rounded px-1 bg-white"
      >
        <option value="pix">PIX</option>
        <option value="boleto">Boleto</option>
        <option value="cartao_debito">Cartão de Débito</option>
        <option value="cartao_credito">Cartão de Crédito</option>
      </select>
      {forma === "cartao_credito" && (
        <select
          value={parcelas}
          onChange={(e) => setParcelas(Number(e.target.value))}
          disabled={loading}
          className="h-6 text-[11px] border border-emerald-200 rounded px-1 bg-white"
        >
          {[1,2,3,4,5,6,7,8,9,10,11,12].map((n) => (
            <option key={n} value={n}>{n}x</option>
          ))}
        </select>
      )}
      <Button
        size="sm"
        onClick={confirmar}
        disabled={loading}
        className="h-6 text-[11px] gap-1 bg-emerald-600 hover:bg-emerald-700 text-white px-2"
      >
        {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <DollarSign className="w-3 h-3" />}
        Confirmar
      </Button>
      <Button
        size="sm"
        variant="ghost"
        onClick={() => setAberto(false)}
        disabled={loading}
        className="h-6 w-6 p-0 hover:bg-white"
      >
        <X className="w-3 h-3" />
      </Button>
    </div>
  );
}
