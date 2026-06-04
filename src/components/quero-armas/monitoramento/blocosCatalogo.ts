/**
 * Catálogo central dos blocos da página /operacao/monitoramento.
 * É a fonte única usada por:
 *   - QAMonitoramentoPage  (decide o que renderizar)
 *   - QAConfiguracoesPage  (gera os toggles na seção "Configurações de Monitoramento")
 *
 * `key` é a chave persistida em qa_monitoramento_configuracoes.config_key.
 * `default = true` para tudo: quando não houver registro salvo, o bloco aparece.
 */
export type MonitoramentoBlocoKey =
  | "atividades_recentes"
  | "funil_operacional"
  | "qualidade_cadastro"
  | "clientes_novos_dia"
  | "clientes_novos_mes"
  | "comparativo_servicos"
  | "atividade_semanal"
  | "status_pecas"
  | "acervo_juridico"
  | "ultimas_pecas"
  | "ultimos_documentos";

export interface MonitoramentoBlocoMeta {
  key: MonitoramentoBlocoKey;
  label: string;
  descricao: string;
  /** Linha sugerida (1..4) para organização do layout. */
  linha: 1 | 2 | 3 | 4;
  /** Quanto ocupa no grid em desktop: full, half, third. */
  largura: "full" | "half" | "third";
}

export const BLOCOS_MONITORAMENTO: MonitoramentoBlocoMeta[] = [
  // Linha 1 — Visão operacional
  { key: "funil_operacional",    label: "Funil operacional",                descricao: "Etapas do funil e conversão entre fases", linha: 1, largura: "full"  },
  { key: "qualidade_cadastro",   label: "Qualidade de cadastro",            descricao: "Telemetria do formulário público",         linha: 1, largura: "full"  },
  { key: "atividade_semanal",    label: "Atividade semanal",                descricao: "Peças e documentos por dia (7 dias)",      linha: 1, largura: "full"  },

  // Linha 2 — Crescimento de clientes
  { key: "clientes_novos_dia",   label: "Clientes novos por dia",           descricao: "Cadastros últimos 14 dias",                linha: 2, largura: "half"  },
  { key: "clientes_novos_mes",   label: "Clientes novos por mês",           descricao: "Evolução mensal dos cadastros",            linha: 2, largura: "half"  },

  // Linha 3 — Produção jurídica
  { key: "status_pecas",         label: "Status das peças",                 descricao: "Distribuição por status de revisão",       linha: 3, largura: "third" },
  { key: "ultimas_pecas",        label: "Últimas peças",                    descricao: "Peças jurídicas mais recentes",            linha: 3, largura: "third" },
  { key: "acervo_juridico",      label: "Acervo jurídico",                  descricao: "Documentos, normas, jurisprudências",      linha: 3, largura: "third" },

  // Linha 4 — Documentos e interesses
  { key: "ultimos_documentos",   label: "Últimos documentos",               descricao: "Documentos processados recentemente",      linha: 4, largura: "half"  },
  { key: "comparativo_servicos", label: "Comparativo por serviço",          descricao: "Distribuição de cadastros por serviço",    linha: 4, largura: "half"  },
  { key: "atividades_recentes",  label: "Atividades recentes",              descricao: "Eventos e movimentações do sistema",       linha: 4, largura: "full"  },
];

/** Mapa lookup auxiliar. */
export const BLOCOS_BY_KEY: Record<MonitoramentoBlocoKey, MonitoramentoBlocoMeta> =
  BLOCOS_MONITORAMENTO.reduce((acc, b) => {
    acc[b.key] = b;
    return acc;
  }, {} as Record<MonitoramentoBlocoKey, MonitoramentoBlocoMeta>);