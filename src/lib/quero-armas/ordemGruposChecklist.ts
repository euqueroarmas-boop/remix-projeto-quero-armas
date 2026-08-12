// ============================================================================
// ordemGruposChecklist.ts
// ----------------------------------------------------------------------------
// TRAVA DE ORDEM POR GRUPO (área do cliente).
//
// Regra de negócio (aprovada em 12/08/2026): o cliente só entrega documentos do
// GRUPO CORRENTE — o primeiro grupo da fila que ainda tem pendência acionável.
// Grupos posteriores ficam bloqueados até o grupo corrente ser cumprido.
//
// A fila (`pendencias`) já chega ordenada pela sequência canônica do serviço
// (qa_servicos_documentos.ordem), então o grupo corrente é simplesmente o grupo
// do PRIMEIRO item da fila. Consequências desejadas:
//   - assinatura pendente (grupo "Contratos") trava todo o resto;
//   - pergunta-pivot sem resposta trava os grupos seguintes (é ela que define
//     quais documentos vão existir depois);
//   - documento REJEITADO ou VENCIDO de grupo anterior volta para a fila e,
//     por estar antes na ordem, reabre aquele grupo como corrente.
//
// A trava vale SOMENTE para o cliente. A equipe continua lançando qualquer
// documento pelo admin.
// ============================================================================

import { grupoDaPendencia, type PendenciaGrupoId } from "./pendenciasGrupos";

export interface PendenciaMinima {
  id?: string;
  rawTipo?: string | null;
  tipo?: string | null;
  grupoId?: PendenciaGrupoId | string | null;
  grupoLabel?: string | null;
}

export interface TravaGrupos {
  /** Grupo liberado agora. `null` quando não há pendência alguma. */
  grupoCorrente: PendenciaGrupoId | null;
  grupoCorrenteLabel: string | null;
  /** Grupos presentes na fila que estão bloqueados. */
  gruposBloqueados: PendenciaGrupoId[];
  /** true quando o grupo pode receber entregas do cliente. */
  liberado: (grupoId: PendenciaGrupoId | string | null | undefined) => boolean;
  /** Mensagem canônica de bloqueio (ou null quando liberado). */
  motivo: (grupoId: PendenciaGrupoId | string | null | undefined) => string | null;
  /** Atalho para quem só tem o tipo de documento em mãos. */
  liberadoParaTipo: (rawTipo?: string | null, hubTipo?: string | null) => boolean;
  motivoParaTipo: (rawTipo?: string | null, hubTipo?: string | null) => string | null;
}

function grupoDe(p: PendenciaMinima): { id: PendenciaGrupoId; label: string } {
  if (p.grupoId) {
    return {
      id: p.grupoId as PendenciaGrupoId,
      label: p.grupoLabel || grupoDaPendencia(p.rawTipo, p.tipo).label,
    };
  }
  const g = grupoDaPendencia(p.rawTipo, p.tipo);
  return { id: g.id, label: g.label };
}

export function calcularTravaGrupos(pendencias: PendenciaMinima[]): TravaGrupos {
  const fila = Array.isArray(pendencias) ? pendencias : [];
  const primeiro = fila.length > 0 ? grupoDe(fila[0]) : null;
  const corrente = primeiro?.id ?? null;
  const label = primeiro?.label ?? null;

  const bloqueados: PendenciaGrupoId[] = [];
  for (const p of fila) {
    const g = grupoDe(p).id;
    if (g !== corrente && !bloqueados.includes(g)) bloqueados.push(g);
  }

  const liberado = (grupoId: PendenciaGrupoId | string | null | undefined) => {
    // Sem fila = nada a travar. Grupo desconhecido também não é travado: a
    // trava nunca pode impedir uma entrega legítima por falta de classificação.
    if (!corrente || !grupoId) return true;
    if (grupoId === corrente) return true;
    // Grupo que não está na fila = já cumprido (reenvio liberado) ou não
    // aplicável. Só bloqueamos o que ainda está pendente à frente.
    return !bloqueados.includes(grupoId as PendenciaGrupoId);
  };

  const motivo = (grupoId: PendenciaGrupoId | string | null | undefined) =>
    liberado(grupoId) ? null : `Conclua ${label} para liberar esta etapa.`;

  return {
    grupoCorrente: corrente,
    grupoCorrenteLabel: label,
    gruposBloqueados: bloqueados,
    liberado,
    motivo,
    liberadoParaTipo: (rawTipo, hubTipo) => liberado(grupoDaPendencia(rawTipo, hubTipo).id),
    motivoParaTipo: (rawTipo, hubTipo) => motivo(grupoDaPendencia(rawTipo, hubTipo).id),
  };
}