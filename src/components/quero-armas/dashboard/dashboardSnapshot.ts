import { supabase } from "@/integrations/supabase/client";

export interface DashboardItemSnapshotRow {
  id: number;
  venda_id: number;
  servico_id: number | null;
  status: string | null;
  data_indeferimento: string | null;
  data_recurso_administrativo: string | null;
  data_protocolo: string | null;
  data_ultima_atualizacao: string | null;
  data_deferimento: string | null;
  numero_processo: string | null;
}

export interface DashboardVendaSnapshotRow {
  id: number;
  id_legado: number | null;
  cliente_id: number | null;
  data_cadastro: string | null;
  created_at: string | null;
}

export interface DashboardClienteSnapshotRow {
  id: number;
  id_legado: number | null;
  nome_completo: string | null;
  celular: string | null;
  cpf: string | null;
}

export interface DashboardServicoSnapshotRow {
  id: number;
  nome_servico: string | null;
  is_combo: boolean | null;
}

export interface DashboardExameSnapshotRow {
  id: string;
  cliente_id: number;
  tipo: string;
  data_realizacao: string;
  data_vencimento: string;
  observacoes: string | null;
}

export interface DashboardServicoComExameSnapshotRow {
  servico_id: number;
  ativo: boolean;
}

export interface QADashboardSnapshot {
  itens: DashboardItemSnapshotRow[];
  vendas: DashboardVendaSnapshotRow[];
  clientes: DashboardClienteSnapshotRow[];
  servicos: DashboardServicoSnapshotRow[];
  exames: DashboardExameSnapshotRow[];
  servicosComExame: DashboardServicoComExameSnapshotRow[];
}

const SNAPSHOT_TTL_MS = 30_000;

let snapshotCache: { data: QADashboardSnapshot; expiresAt: number } | null = null;
let snapshotPromise: Promise<QADashboardSnapshot> | null = null;

function throwIfAborted(signal?: AbortSignal) {
  if (signal?.aborted) {
    throw new DOMException("Aborted", "AbortError");
  }
}

async function fetchDashboardSnapshot(): Promise<QADashboardSnapshot> {
  const [itensRes, examesRes, servicosExameRes] = await Promise.all([
    supabase
      .from("qa_itens_venda" as any)
      .select(
        "id, venda_id, servico_id, status, data_indeferimento, data_recurso_administrativo, data_protocolo, data_ultima_atualizacao, data_deferimento, numero_processo"
      ),
    supabase
      .from("qa_exames_cliente" as any)
      .select("id, cliente_id, tipo, data_realizacao, data_vencimento, observacoes")
      .limit(5000),
    supabase
      .from("qa_servicos_com_exame" as any)
      .select("servico_id, ativo")
      .limit(1000),
  ]);

  if (itensRes.error) throw itensRes.error;
  if (examesRes.error) throw examesRes.error;
  if (servicosExameRes.error) throw servicosExameRes.error;

  const itens = ((itensRes.data || []) as any[]) as DashboardItemSnapshotRow[];
  const exames = ((examesRes.data || []) as any[]) as DashboardExameSnapshotRow[];
  const servicosComExame = ((servicosExameRes.data || []) as any[]) as DashboardServicoComExameSnapshotRow[];

  const vendaIds = Array.from(new Set(itens.map((item) => item.venda_id).filter(Boolean)));
  const servicoIds = Array.from(new Set(itens.map((item) => item.servico_id).filter(Boolean) as number[]));

  const [vendasRes, servicosRes] = await Promise.all([
    vendaIds.length
      ? supabase
          .from("qa_vendas" as any)
          .select("id, id_legado, cliente_id, data_cadastro, created_at")
          .in("id_legado", vendaIds as any)
      : Promise.resolve({ data: [] as any[], error: null }),
    servicoIds.length
      ? supabase
          .from("qa_servicos" as any)
          .select("id, nome_servico, is_combo")
          .in("id", servicoIds as any)
      : Promise.resolve({ data: [] as any[], error: null }),
  ]);

  if (vendasRes.error) throw vendasRes.error;
  if (servicosRes.error) throw servicosRes.error;

  const vendas = ((vendasRes.data || []) as any[]) as DashboardVendaSnapshotRow[];
  const servicos = ((servicosRes.data || []) as any[]) as DashboardServicoSnapshotRow[];

  const clienteIds = Array.from(new Set(exames.map((exame) => exame.cliente_id).filter(Boolean)));
  const clienteIdsLegado = Array.from(new Set(vendas.map((venda) => venda.cliente_id).filter(Boolean) as number[]));
  const clienteFilters = [
    clienteIds.length ? `id.in.(${clienteIds.join(",")})` : null,
    clienteIdsLegado.length ? `id_legado.in.(${clienteIdsLegado.join(",")})` : null,
  ].filter(Boolean) as string[];

  const clientesRes = clienteFilters.length
    ? await supabase
        .from("qa_clientes" as any)
        .select("id, id_legado, nome_completo, celular, cpf")
        .or(clienteFilters.join(","))
    : { data: [] as any[], error: null };

  if (clientesRes.error) throw clientesRes.error;

  const clientes = ((clientesRes.data || []) as any[]) as DashboardClienteSnapshotRow[];

  return {
    itens,
    vendas,
    clientes,
    servicos,
    exames,
    servicosComExame,
  };
}

export function invalidateQADashboardSnapshot() {
  snapshotCache = null;
  snapshotPromise = null;
}

export async function loadQADashboardSnapshot(signal?: AbortSignal): Promise<QADashboardSnapshot> {
  throwIfAborted(signal);

  if (snapshotCache && snapshotCache.expiresAt > Date.now()) {
    return snapshotCache.data;
  }

  if (!snapshotPromise) {
    snapshotPromise = fetchDashboardSnapshot()
      .then((data) => {
        snapshotCache = {
          data,
          expiresAt: Date.now() + SNAPSHOT_TTL_MS,
        };
        return data;
      })
      .catch((error) => {
        snapshotCache = null;
        throw error;
      })
      .finally(() => {
        snapshotPromise = null;
      });
  }

  const data = await snapshotPromise;
  throwIfAborted(signal);
  return data;
}