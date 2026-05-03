import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Loader2, Rocket, ExternalLink, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { ProcessoDetalheDrawer } from "./ProcessoDetalheDrawer";

/**
 * FASE 16-C — Botão "Gerar processo" para venda aprovada.
 *
 * Regras de exibição:
 *   - venda.status_validacao_valor = 'aprovado'
 *   - venda.valor_aprovado != null
 *   - sem processo existente para venda.id
 *
 * Se já existir processo, mostra badge + botão "Abrir processo".
 * Não mexe em pagamento, checklist, documentos, arsenal nem qa_crafs.
 */

interface VendaLite {
  id: number;
  id_legado?: number | null;
  status_validacao_valor?: string | null;
  valor_aprovado?: number | string | null;
  cliente_id: number | null;
}

interface ItemVendaLite {
  venda_id: number;
  servico_id: number;
}

interface ProcessoLite {
  id: string;
  venda_id: number | null;
  servico_id: number | null;
  servico_nome: string | null;
}

interface ServicoLite {
  id: number;
  nome_servico: string;
}

interface Props {
  venda: VendaLite;
  itens: ItemVendaLite[];
  clienteNome?: string | null;
  processoExistente?: ProcessoLite | null;
  onCreated?: () => void;
}

export function GerarProcessoButton({ venda, itens, clienteNome, processoExistente, onCreated }: Props) {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [openProcessoId, setOpenProcessoId] = useState<string | null>(null);
  const [servicos, setServicos] = useState<ServicoLite[]>([]);
  const [servicoId, setServicoId] = useState<string>("");
  const [observacoes, setObservacoes] = useState("");

  const vendaFkLegado = venda.id_legado ?? venda.id;
  const isApproved = String(venda.status_validacao_valor || "") === "aprovado"
    && venda.valor_aprovado !== null && venda.valor_aprovado !== undefined;

  // Serviço sugerido a partir de qa_itens_venda (primeiro item).
  const servicoSugeridoId = useMemo(() => {
    const first = itens.find((i) => i.venda_id === vendaFkLegado);
    return first?.servico_id ?? null;
  }, [itens, vendaFkLegado]);

  useEffect(() => {
    if (!open) return;
    let cancel = false;
    (async () => {
      // Limita à lista do catálogo ATIVO (qa_servicos_catalogo.ativo = true).
      // Garante que apenas serviços oferecidos hoje apareçam aqui.
      const { data: catalogo } = await supabase
        .from("qa_servicos_catalogo" as any)
        .select("servico_id, nome, display_order")
        .eq("ativo", true)
        .not("servico_id", "is", null)
        .order("display_order", { ascending: true })
        .order("nome", { ascending: true });
      if (cancel) return;
      const rows = ((catalogo as any[]) ?? [])
        .filter((r) => Number.isFinite(Number(r.servico_id)))
        // dedup por servico_id (catálogo pode ter múltiplos slugs do mesmo serviço)
        .reduce<Map<number, ServicoLite>>((acc, r) => {
          const id = Number(r.servico_id);
          if (!acc.has(id)) acc.set(id, { id, nome_servico: String(r.nome || "").trim() || `Serviço #${id}` });
          return acc;
        }, new Map());
      const list = Array.from(rows.values());
      setServicos(list);
      if (servicoSugeridoId && list.some((s) => s.id === servicoSugeridoId)) {
        setServicoId(String(servicoSugeridoId));
      } else {
        setServicoId("");
      }
      setObservacoes("");
    })();
    return () => { cancel = true; };
  }, [open, servicoSugeridoId]);

  // ─── Caso já exista processo: badge + abrir ───
  if (processoExistente) {
    return (
      <>
        <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 border border-emerald-200">
          <CheckCircle2 className="h-2.5 w-2.5" />
          Processo gerado
        </span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setOpenProcessoId(processoExistente.id)}
          className="h-7 px-2 text-[10px] text-[#7A1F2B] hover:text-[#7A1F2B]"
          title="Abrir processo"
        >
          <ExternalLink className="h-3.5 w-3.5 mr-1" /> Abrir
        </Button>
        {openProcessoId && (
          <ProcessoDetalheDrawer
            processoId={openProcessoId}
            equipeMode
            onClose={() => setOpenProcessoId(null)}
            onUpdated={() => onCreated?.()}
          />
        )}
      </>
    );
  }

  // Não exibe nada se a venda ainda não está aprovada.
  if (!isApproved) return null;
  if (!venda.cliente_id) return null;

  // Quick-create: dispara direto se há apenas 1 serviço na venda (sem ambiguidade).
  // Se houver múltiplos serviços, abre o modal para o operador escolher.
  const handleQuickGenerate = async () => {
    if (submitting) return;
    if (!servicoSugeridoId) {
      // Sem item de serviço identificável → abre o modal manual.
      setOpen(true);
      return;
    }
    await runGenerate(servicoSugeridoId, null);
  };

  const handleGenerate = async () => {
    if (submitting) return;
    if (!servicoId) {
      toast.error("Selecione o serviço operacional antes de gerar o processo.");
      return;
    }
    const sid = Number(servicoId);
    if (!Number.isFinite(sid) || sid <= 0) {
      toast.error("Serviço inválido.");
      return;
    }
    await runGenerate(sid, observacoes.trim() || null);
  };

  const runGenerate = async (sid: number, obs: string | null) => {
    setSubmitting(true);
    try {
      const { data, error } = await supabase.rpc("qa_venda_to_processo" as any, {
        p_venda_id: venda.id,
        p_servico_id: sid,
        p_observacoes: obs,
      });
      if (error) throw error;
      const res = (data || {}) as any;
      const processoId = res.processo_id as string | undefined;
      if (res.ja_existia) {
        toast.message("Processo já existia para essa venda", {
          description: processoId ? `Abrindo processo ${processoId.slice(0, 8)}…` : undefined,
        });
      } else {
        toast.success("Checklist gerado a partir da venda");
      }
      setOpen(false);
      onCreated?.();
      if (processoId) setOpenProcessoId(processoId);
    } catch (e: any) {
      console.error("[GerarProcessoButton] rpc error:", e);
      toast.error(e?.message || "Falha ao gerar checklist");
    } finally {
      setSubmitting(false);
    }
  };

  const valorAprovadoNum = Number(venda.valor_aprovado || 0);
  const servicoSelecionado = servicos.find((s) => String(s.id) === servicoId);

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={handleQuickGenerate}
        disabled={submitting}
        className="h-7 px-2 text-[10px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 hover:text-emerald-800 rounded"
        title="Gerar checklist desta venda em 1 clique"
      >
        {submitting
          ? <Loader2 className="h-3 w-3 animate-spin mr-1" />
          : <Rocket className="h-3 w-3 mr-1" />}
        Gerar checklist
      </Button>

      <Dialog open={open} onOpenChange={(o) => !submitting && setOpen(o)}>
        <DialogContent className="max-w-md bg-white max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-slate-800 text-sm font-bold uppercase tracking-wider flex items-center gap-2">
              <Rocket className="h-4 w-4 text-emerald-600" />
              Gerar processo
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 mt-2">
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div>
                <div className="text-[9px] uppercase tracking-wider text-slate-500 font-semibold">Venda</div>
                <div className="text-slate-800 font-mono">#{vendaFkLegado}</div>
              </div>
              <div>
                <div className="text-[9px] uppercase tracking-wider text-slate-500 font-semibold">Valor aprovado</div>
                <div className="text-emerald-700 font-mono font-bold">R$ {valorAprovadoNum.toLocaleString("pt-BR")}</div>
              </div>
              <div className="col-span-2">
                <div className="text-[9px] uppercase tracking-wider text-slate-500 font-semibold">Cliente</div>
                <div className="text-slate-800">{clienteNome || "—"}</div>
              </div>
            </div>

            <div>
              <label className="text-[9px] uppercase tracking-wider text-slate-500 font-semibold mb-1 block">
                Serviço operacional <span className="text-red-500">*</span>
              </label>
              <Select value={servicoId} onValueChange={setServicoId} disabled={submitting}>
                <SelectTrigger className="h-9 text-sm bg-slate-50 border-slate-200 text-slate-800 rounded-md">
                  <SelectValue placeholder="Selecionar serviço" />
                </SelectTrigger>
                <SelectContent className="bg-white border border-slate-200 z-[110] max-h-72 shadow-lg">
                  {servicos.length === 0 ? (
                    <div className="px-3 py-4 text-[12px] text-slate-500">
                      Nenhum serviço ativo no catálogo.
                    </div>
                  ) : servicos.map((s) => (
                    <SelectItem
                      key={s.id}
                      value={String(s.id)}
                      className="text-sm text-slate-900 font-medium data-[highlighted]:bg-amber-100 data-[highlighted]:text-slate-900 focus:bg-amber-100 focus:text-slate-900"
                    >
                      <span className="text-slate-400 font-mono mr-1.5">#{s.id}</span>
                      <span className="text-slate-900">{s.nome_servico}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {servicoSugeridoId && servicoSelecionado && Number(servicoId) === servicoSugeridoId && (
                <p className="text-[9px] text-slate-400 mt-1">Sugerido a partir do item da venda.</p>
              )}
            </div>

            <div>
              <label className="text-[9px] uppercase tracking-wider text-slate-500 font-semibold mb-1 block">
                Observações (opcional)
              </label>
              <Input
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                placeholder="Notas internas para o processo"
                className="h-9 text-sm bg-slate-50 border-slate-200 text-slate-800 rounded-md"
                disabled={submitting}
              />
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setOpen(false)}
                disabled={submitting}
                className="h-10 text-xs rounded-md text-slate-600 hover:text-slate-800"
              >
                Cancelar
              </Button>
              <Button
                type="button"
                onClick={handleGenerate}
                disabled={submitting || !servicoId}
                className="h-10 text-xs rounded-md bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm disabled:opacity-60"
              >
                {submitting
                  ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                  : <Rocket className="h-3.5 w-3.5 mr-1.5" />}
                Gerar processo
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {openProcessoId && (
        <ProcessoDetalheDrawer
          processoId={openProcessoId}
          equipeMode
          onClose={() => setOpenProcessoId(null)}
          onUpdated={() => onCreated?.()}
        />
      )}
    </>
  );
}