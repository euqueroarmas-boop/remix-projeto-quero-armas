import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Loader2, Settings2, Save } from "lucide-react";
import { toast } from "sonner";
import { STATUS_SERVICO_QA, STATUS_LABELS } from "@/lib/quero-armas/statusServico";
// Notificações e timeline são geradas por triggers no banco.

/**
 * Status canônicos da solicitação — qa_solicitacoes_servico é a ÚNICA fonte
 * de verdade do sistema. Lista vinda de @/lib/quero-armas/statusServico
 * (espelho do CHECK constraint no banco).
 */
const STATUS_SERVICO = STATUS_SERVICO_QA;

const STATUS_FINANCEIRO = [
  "sem_cobranca_vinculada",
  "vinculado",
  "aguardando_pagamento",
  "pago",
  "vencido",
  "cancelado",
  "estornado",
] as const;

const STATUS_PROCESSO = [
  "processo_nao_aberto",
  "aberto",
  "aguardando_documentos",
  "documentos_recebidos",
  "documentos_em_analise",
  "pendencia_documental",
  "processo_em_montagem",
  "protocolado",
  "em_analise_orgao",
  "exigencia_notificacao",
  "deferido",
  "indeferido",
  "finalizado",
] as const;

const labelize = (s: string) =>
  (STATUS_LABELS as Record<string, string>)[s] ?? s.replace(/_/g, " ").toUpperCase();

type Props = {
  solicitacaoId: string;
  onUpdated?: () => void;
};

/**
 * Popover compacto para o operador atualizar manualmente os 3 status canônicos
 * da solicitação vinculada a uma venda. Usa apenas qa_solicitacoes_servico —
 * nada de tabela de auditoria nova; updated_at do trigger registra a mudança.
 */
export function SolicitacaoStatusPopover({ solicitacaoId, onUpdated }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [statusServico, setStatusServico] = useState<string>("");
  const [statusFinanceiro, setStatusFinanceiro] = useState<string>("");
  const [statusProcesso, setStatusProcesso] = useState<string>("");
  const [observacoes, setObservacoes] = useState<string>("");

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    supabase
      .from("qa_solicitacoes_servico" as any)
      .select("status_servico, status_financeiro, status_processo, observacoes")
      .eq("id", solicitacaoId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) {
          toast.error("Não foi possível carregar status: " + error.message);
          return;
        }
        const r = data as any;
        setStatusServico(r?.status_servico ?? "");
        setStatusFinanceiro(r?.status_financeiro ?? "");
        setStatusProcesso(r?.status_processo ?? "");
        setObservacoes(r?.observacoes ?? "");
      })
      .then(() => setLoading(false));
  }, [open, solicitacaoId]);

  const save = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("qa_solicitacoes_servico" as any)
        .update({
          status_servico: statusServico,
          status_financeiro: statusFinanceiro,
          status_processo: statusProcesso,
          observacoes: observacoes || null,
        })
        .eq("id", solicitacaoId);
      if (error) throw error;

      // Trigger qa_log_status_change registra o evento na timeline e
      // qa_dispatch_notify_event chama qa-notify-event automaticamente.

      toast.success("Status da solicitação atualizado");
      setOpen(false);
      onUpdated?.();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-[10px] text-slate-500 hover:text-indigo-600"
          title="Atualizar status da solicitação"
        >
          <Settings2 className="h-3.5 w-3.5 mr-1" />
          Status
        </Button>
      </PopoverTrigger>
      <PopoverContent
        side="bottom"
        align="end"
        className="w-[300px] p-3 bg-white border border-slate-200 shadow-xl z-[80]"
      >
        {loading ? (
          <div className="flex items-center justify-center py-6 text-slate-400">
            <Loader2 className="h-4 w-4 animate-spin" />
          </div>
        ) : (
          <div className="space-y-3">
            <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">
              Atualizar Status
            </div>
            <SelectField
              label="Status do serviço"
              value={statusServico}
              onChange={setStatusServico}
              options={STATUS_SERVICO as readonly string[]}
            />
            <SelectField
              label="Status financeiro"
              value={statusFinanceiro}
              onChange={setStatusFinanceiro}
              options={STATUS_FINANCEIRO as readonly string[]}
            />
            <SelectField
              label="Status do processo"
              value={statusProcesso}
              onChange={setStatusProcesso}
              options={STATUS_PROCESSO as readonly string[]}
            />
            <div>
              <label className="text-[9px] font-semibold text-slate-500 uppercase tracking-[0.1em] mb-1 block">
                Observação interna
              </label>
              <textarea
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                rows={2}
                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-md px-2 py-1.5 text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-400/30 focus:border-indigo-400"
                placeholder="Opcional"
              />
            </div>
            <div className="flex justify-end gap-2 pt-1 border-t border-slate-100">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setOpen(false)}
                className="h-8 text-[10px] text-slate-500"
              >
                Cancelar
              </Button>
              <Button
                size="sm"
                onClick={save}
                disabled={saving}
                className="h-8 text-[10px] bg-blue-600 hover:bg-blue-700 text-white"
              >
                {saving ? (
                  <Loader2 className="h-3 w-3 animate-spin mr-1" />
                ) : (
                  <Save className="h-3 w-3 mr-1" />
                )}
                Salvar
              </Button>
            </div>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: readonly string[];
}) {
  return (
    <div>
      <label className="text-[9px] font-semibold text-slate-500 uppercase tracking-[0.1em] mb-1 block">
        {label}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full h-8 text-xs bg-slate-50 border border-slate-200 rounded-md px-2 text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-400/30 focus:border-indigo-400"
      >
        {options.map((o) => (
          <option key={o} value={o}>
            {labelize(o)}
          </option>
        ))}
      </select>
    </div>
  );
}