import { supabase } from "@/integrations/supabase/client";
import { extrairPrazoDoItem } from "@/lib/quero-armas/prazosProcessuais";
import {
  loadQADashboardSnapshot,
  type DashboardClienteSnapshotRow,
  type DashboardItemSnapshotRow,
  type DashboardServicoSnapshotRow,
  type DashboardVendaSnapshotRow,
} from "@/components/quero-armas/dashboard/dashboardSnapshot";

export interface QAPrazoEquipeRow {
  itemId: number;
  vendaIdLegado: number;
  clienteIdLegado: number | null;
  clienteId: number | null;
  clienteNome: string;
  cpf: string | null;
  celular: string | null;
  cadastroCrId: number | null;
  protocolo: string | null;
  tipo: string;
  servicoId: number | null;
  servicoNome: string;
  evento: "NOTIFICAÇÃO" | "INDEFERIMENTO" | "RESTITUIÇÃO" | "MANDADO DE SEGURANÇA";
  status: string | null;
  dataEvento: string;
  dataLimite: string;
  diasRestantes: number;
  prazoTotalDias: number;
}

const TIPO_CURTO: Record<number, string> = {
  2: "Posse",
  3: "Porte",
  26: "CRAF",
};

function resolveProtocolo(item: DashboardItemSnapshotRow): string | null {
  return (
    (item.servico_id === 2
      ? item.numero_posse
      : item.servico_id === 3
        ? item.numero_requerimento
        : item.servico_id === 26
          ? item.numero_craf
          : item.numero_processo) ??
    item.numero_processo ??
    item.numero_requerimento ??
    item.numero_posse ??
    item.numero_porte ??
    item.numero_craf ??
    null
  );
}

export async function loadQAPrazosEquipeRows(signal?: AbortSignal): Promise<QAPrazoEquipeRow[]> {
  const snapshot = await loadQADashboardSnapshot(signal);
  const itensList = snapshot.itens.filter(
    (item) =>
      item.data_indeferimento ||
      item.data_notificacao ||
      item.data_restituicao ||
      item.data_indeferimento_recurso,
  );

  if (!itensList.length) return [];

  const vendas = snapshot.vendas as DashboardVendaSnapshotRow[];
  const clientes = snapshot.clientes as DashboardClienteSnapshotRow[];
  const servicos = snapshot.servicos as DashboardServicoSnapshotRow[];

  const vMap = new Map(vendas.map((v) => [v.id_legado, v]));
  const cMap = new Map(clientes.map((c) => [c.id_legado, c]));
  const sMap = new Map(servicos.map((s) => [s.id, s]));

  const clienteInternalIds = clientes.map((c) => c.id).filter((id): id is number => typeof id === "number");
  const cadastroMap = new Map<number, number>();
  if (clienteInternalIds.length) {
    const { data: crRows, error } = await supabase
      .from("qa_cadastro_cr" as any)
      .select("id, cliente_id")
      .in("cliente_id", clienteInternalIds as any);
    if (error) throw error;
    for (const row of (crRows as any[] | null) || []) {
      if (row?.cliente_id && row?.id && !cadastroMap.has(row.cliente_id)) {
        cadastroMap.set(Number(row.cliente_id), Number(row.id));
      }
    }
  }

  const built: QAPrazoEquipeRow[] = [];
  for (const item of itensList) {
    const venda = vMap.get(item.venda_id);
    const cliente = venda?.cliente_id != null ? cMap.get(venda.cliente_id) : null;
    if (!venda || !cliente) continue;

    const prazo = extrairPrazoDoItem({
      id: item.id,
      servico_id: item.servico_id,
      servico_nome: item.servico_id ? sMap.get(item.servico_id)?.nome_servico ?? null : null,
      status: item.status,
      numero_processo: item.numero_processo,
      data_notificacao: item.data_notificacao,
      data_indeferimento: item.data_indeferimento,
      data_restituicao: item.data_restituicao,
      data_recurso_administrativo: item.data_recurso_administrativo,
      data_indeferimento_recurso: item.data_indeferimento_recurso,
    });
    if (!prazo) continue;

    const servicoNome = item.servico_id
      ? sMap.get(item.servico_id)?.nome_servico || `Serviço #${item.servico_id}`
      : "Processo administrativo";

    built.push({
      itemId: item.id,
      vendaIdLegado: item.venda_id,
      clienteIdLegado: cliente.id_legado ?? null,
      clienteId: cliente.id ?? null,
      clienteNome: cliente.nome_completo || `Cliente #${cliente.id}`,
      cpf: cliente.cpf ?? null,
      celular: cliente.celular ?? null,
      cadastroCrId: cliente.id != null ? cadastroMap.get(cliente.id) ?? null : null,
      protocolo: resolveProtocolo(item),
      tipo: item.servico_id ? TIPO_CURTO[item.servico_id] ?? "ADM" : "ADM",
      servicoId: item.servico_id ?? null,
      servicoNome,
      evento: prazo.evento,
      status: item.status ?? null,
      dataEvento: prazo.dataEvento,
      dataLimite: prazo.dataLimite,
      diasRestantes: prazo.diasRestantes,
      prazoTotalDias: prazo.prazoTotalDias,
    });
  }

  built.sort((a, b) => a.diasRestantes - b.diasRestantes);
  return built;
}
