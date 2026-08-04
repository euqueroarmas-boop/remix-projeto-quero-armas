import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, MonitorCheck, MonitorOff, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface Processo {
  id: string;
  servico_nome: string;
  status: string;
  suporte_ativo: boolean;
  suporte_ativado_em: string | null;
  suporte_ativado_por: string | null;
}

interface Props {
  clienteId: number;
}

const fmtDT = (iso?: string | null) => {
  if (!iso) return null;
  try { return new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }); } catch { return iso; }
};

export default function ClienteModoSuporte({ clienteId }: Props) {
  const [processos, setProcessos] = useState<Processo[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("qa_processos")
      .select("id, servico_nome, status, suporte_ativo, suporte_ativado_em, suporte_ativado_por")
      .eq("cliente_id", clienteId)
      .not("status", "in", '("cancelado","arquivado","indeferido")')
      .order("created_at", { ascending: false });
    if (error) toast.error("Erro ao carregar processos: " + error.message);
    else setProcessos((data ?? []) as any);
    setLoading(false);
  }, [clienteId]);

  useEffect(() => { void carregar(); }, [carregar]);

  const toggleSuporte = async (proc: Processo) => {
    const novoEstado = !proc.suporte_ativo;
    setBusy(proc.id);
    const { data: userData } = await supabase.auth.getUser();
    const email = userData?.user?.email ?? "equipe";

    const { error } = await supabase
      .from("qa_processos")
      .update({
        suporte_ativo: novoEstado,
        suporte_ativado_em: novoEstado ? new Date().toISOString() : null,
        suporte_ativado_por: novoEstado ? email : null,
      })
      .eq("id", proc.id);

    if (error) {
      toast.error("Falha ao alterar modo suporte: " + error.message);
    } else {
      toast.success(novoEstado
        ? `Modo suporte ATIVADO para "${proc.servico_nome}".`
        : `Modo suporte DESATIVADO para "${proc.servico_nome}".`
      );
      await carregar();
    }
    setBusy(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-8 text-slate-500">
        <Loader2 className="h-4 w-4 animate-spin" /> Carregando processos…
      </div>
    );
  }

  if (processos.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-slate-500">
        Nenhum processo ativo para este cliente.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-[11px] text-slate-500 max-w-sm">
          Quando ativado, o cliente navega o checklist sem bloqueio de etapas.
          Um banner de suporte aparece na tela dele. Desative ao terminar.
        </p>
        <Button size="sm" variant="ghost" onClick={carregar} className="h-7">
          <RefreshCw className="h-3.5 w-3.5" />
        </Button>
      </div>

      {processos.map((proc) => (
        <div
          key={proc.id}
          className={`flex items-center gap-3 rounded-xl border p-3 transition-colors ${
            proc.suporte_ativo
              ? "border-amber-300 bg-amber-50"
              : "border-slate-200 bg-white"
          }`}
        >
          <div className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg ${
            proc.suporte_ativo ? "bg-amber-100 text-amber-600" : "bg-slate-100 text-slate-400"
          }`}>
            {proc.suporte_ativo
              ? <MonitorCheck className="h-4 w-4" />
              : <MonitorOff className="h-4 w-4" />}
          </div>

          <div className="flex-1 min-w-0">
            <div className="truncate text-[12px] font-bold text-slate-900">
              {proc.servico_nome}
            </div>
            {proc.suporte_ativo && proc.suporte_ativado_em ? (
              <div className="text-[10px] text-amber-700">
                Ativo desde {fmtDT(proc.suporte_ativado_em)}
                {proc.suporte_ativado_por ? ` por ${proc.suporte_ativado_por}` : ""}
              </div>
            ) : (
              <div className="text-[10px] text-slate-400">Modo suporte inativo</div>
            )}
          </div>

          <Button
            size="sm"
            variant={proc.suporte_ativo ? "destructive" : "outline"}
            disabled={busy === proc.id}
            onClick={() => toggleSuporte(proc)}
            className={`h-7 text-[11px] flex-shrink-0 ${
              proc.suporte_ativo
                ? "bg-amber-600 hover:bg-amber-700 text-white border-0"
                : ""
            }`}
          >
            {busy === proc.id
              ? <Loader2 className="h-3 w-3 animate-spin" />
              : proc.suporte_ativo ? "Desativar" : "Ativar"}
          </Button>
        </div>
      ))}
    </div>
  );
}
