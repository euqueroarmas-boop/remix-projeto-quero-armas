import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Loader2, Settings2, Save, AlertTriangle, ListChecks } from "lucide-react";
import { toast } from "sonner";
import { STATUS_SERVICO_QA, STATUS_LABELS } from "@/lib/statusServico";
// Notificações e timeline são geradas por triggers no banco.
// Status financeiro é DERIVADO de qa_vendas — exibido apenas em modo leitura.

/**
 * Status canônicos da solicitação — qa_solicitacoes_servico é a ÚNICA fonte
 * de verdade do sistema. Lista vinda de @/lib/statusServico
 * (espelho do CHECK constraint no banco).
 */
const STATUS_SERVICO = STATUS_SERVICO_QA;

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
  const [semChecklist, setSemChecklist] = useState<boolean>(false);
  const [servicoId, setServicoId] = useState<number | null>(null);
  const [serviceName, setServiceName] = useState<string>("");

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    supabase
      .from("qa_solicitacoes_servico" as any)
      .select("status_servico, status_financeiro, status_processo, observacoes, sem_checklist_configurado, servico_id, service_name")
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
        setSemChecklist(!!r?.sem_checklist_configurado);
        setServicoId(r?.servico_id ?? null);
        setServiceName(r?.service_name ?? "");
      })
      .then(() => setLoading(false));
  }, [open, solicitacaoId]);

  const save = async () => {
    setSaving(true);
    try {
      // Roteia toda alteração via edge function: ela aplica a regra de
      // bloqueio (sem checklist) e audita tentativas inválidas em
      // qa_solicitacao_eventos como 'tentativa_status_bloqueada'.
      //
      // status_financeiro NÃO é enviado: é derivado de qa_vendas (fonte única).
      // Para alterar pagamento, use o módulo Financeiro (qa_vendas.status).
      const { data, error } = await supabase.functions.invoke("qa-status-update", {
        body: {
          solicitacao_id: solicitacaoId,
          status_servico: semChecklist ? undefined : statusServico,
          status_processo: statusProcesso,
          observacoes,
        },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);

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
            {semChecklist && (
              <div className="rounded-md border border-amber-300 bg-amber-50 p-2.5 space-y-2">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                  <div className="text-[11px] leading-snug text-amber-900">
                    <div className="font-bold uppercase tracking-wider mb-0.5">
                      CHECKLIST NÃO CONFIGURADO
                    </div>
                    <div>
                      Este serviço{serviceName ? ` (${serviceName})` : ""} ainda
                      não possui documentos obrigatórios cadastrados. Configure
                      para ativar o fluxo automático.
                    </div>
                  </div>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="w-full h-8 text-[10px] border-amber-400 text-amber-900 hover:bg-amber-100"
                  onClick={() => {
                    const target = servicoId
                      ? `/configuracoes#checklist-servico-${servicoId}`
                      : `/configuracoes#checklist`;
                    window.open(target, "_blank", "noopener,noreferrer");
                  }}
                >
                  <ListChecks className="h-3.5 w-3.5 mr-1" />
                  Configurar checklist
                </Button>
              </div>
            )}
            <SelectField
              label="Status do serviço"
              value={statusServico}
              onChange={setStatusServico}
              options={STATUS_SERVICO as readonly string[]}
              disabled={semChecklist}
              hint={
                semChecklist
                  ? "Status bloqueado até configuração do checklist"
                  : undefined
              }
            />
            <div>
              <label className="text-[9px] font-semibold text-slate-500 uppercase tracking-[0.1em] mb-1 block">
                Status financeiro
              </label>
              <div className="w-full h-8 text-xs border rounded-md px-2 flex items-center bg-slate-100 border-slate-200 text-slate-500 uppercase tracking-wider">
                {statusFinanceiro ? labelize(statusFinanceiro) : "—"}
              </div>
              <div className="mt-1 text-[9px] uppercase tracking-wider text-slate-500">
                Status financeiro é controlado pela venda/financeiro.
              </div>
            </div>
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
  disabled,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: readonly string[];
  disabled?: boolean;
  hint?: string;
}) {
  return (
    <div>
      <label className="text-[9px] font-semibold text-slate-500 uppercase tracking-[0.1em] mb-1 block">
        {label}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className={`w-full h-8 text-xs border rounded-md px-2 focus:outline-none focus:ring-2 focus:ring-indigo-400/30 focus:border-indigo-400 ${
          disabled
            ? "bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed"
            : "bg-slate-50 border-slate-200 text-slate-700"
        }`}
      >
        {options.map((o) => (
          <option key={o} value={o}>
            {labelize(o)}
          </option>
        ))}
      </select>
      {hint && (
        <div className="mt-1 text-[9px] uppercase tracking-wider text-amber-700">
          {hint}
        </div>
      )}
    </div>
  );
}