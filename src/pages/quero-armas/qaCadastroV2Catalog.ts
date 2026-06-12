/**
 * Catálogo aditivo do fluxo /cadastro-v2 (Etapa 1).
 * NÃO substitui qaServiceCatalog.ts. É exclusivo da nova rota guiada raiz.
 */

export type QAV2PerfilId =
  | "defesa_pessoal"
  | "cac"
  | "profissional_ativo"
  | "aposentado_inativo"
  | "orientacao_necessaria";

export interface QAV2Perfil {
  id: QAV2PerfilId;
  titulo: string;
  descricao: string;
  orgao?: string;
  acao?: "redirecionar_quiz";
}

export const QA_V2_PERFIS: QAV2Perfil[] = [
  {
    id: "defesa_pessoal",
    titulo: "Defesa pessoal",
    descricao: "Proteger eu e minha família em casa ou no trabalho",
    orgao: "sinarm_pf",
  },
  {
    id: "cac",
    titulo: "Esporte, caça ou colecionamento",
    descricao: "Sou atirador esportivo, caçador ou colecionador (CAC)",
    orgao: "sigma_exercito",
  },
  {
    id: "profissional_ativo",
    titulo: "Por causa da minha profissão",
    descricao:
      "Trabalho na segurança pública, magistratura, Ministério Público, Forças Armadas ou como vigilante",
    orgao: "orgao_proprio_pf",
  },
  {
    id: "aposentado_inativo",
    titulo: "Sou aposentado das FFAA ou da segurança pública",
    descricao: "Tenho direito a porte como inativo (art. 6º §1º da Lei 10.826)",
    orgao: "inativo_pf",
  },
  {
    id: "orientacao_necessaria",
    titulo: "Ainda não sei, preciso de orientação",
    descricao: "Quero entender qual é o melhor caminho para o meu caso",
  },
];

export interface QAV2Curso {
  slug: string;
  titulo: string;
  descricao: string;
}

export const QA_V2_CURSOS: QAV2Curso[] = [
  {
    slug: "operador-de-pistola-nivel-i",
    titulo: "Operador de Pistola — Nível I",
    descricao: "Curso prático de tiro com pistola para iniciantes e intermediários",
  },
  {
    slug: "vip-operador-de-pistola-nivel-i",
    titulo: "VIP Operador de Pistola — Nível I",
    descricao: "Versão exclusiva, individual, com instrução personalizada",
  },
];

export const QA_V2_SESSION_KEY = "qa_cadastro_v2_etapa1";

/* =========================================================================
 * Etapa 2 — Árvores guiadas por caminho (aditivo, isolado)
 * Cada nó é uma "tela" com cards. Folhas são serviços do qa_servicos_catalogo.
 * ========================================================================= */

export const QA_V2_PATH_SESSION_KEY = "qa_cadastro_v2_path";

export type QAV2NodeOption =
  | {
      kind: "step";
      key: string;
      titulo: string;
      descricao: string;
    }
  | {
      kind: "service";
      titulo: string;
      descricao: string;
      servicoSlug: string;
      subperfilV2: string;
    }
  | {
      kind: "bundle";
      titulo: string;
      descricao: string;
      servicoSlugs: string[];
      subperfilV2: string;
    };

export interface QAV2Node {
  pergunta: string;
  subtitulo?: string;
  opcoes: QAV2NodeOption[];
}

export interface QAV2PathDefinition {
  perfil: string;
  rota: string;
  tituloBreadcrumb: string;
  raiz: QAV2Node;
  steps: Record<string, QAV2Node>;
}

/* ----------------------- A — Defesa Pessoal ----------------------- */

export const QA_V2_PATH_DEFESA_PESSOAL: QAV2PathDefinition = {
  perfil: "defesa_pessoal",
  rota: "/cadastro-v2/defesa-pessoal",
  tituloBreadcrumb: "Defesa pessoal",
  raiz: {
    pergunta: "Qual é a sua situação hoje?",
    subtitulo: "Vamos identificar o documento que você precisa",
    opcoes: [
      {
        kind: "service",
        titulo: "Quero minha primeira arma",
        descricao: "Aquisição + posse + registro SINARM. GT de brinde para retirar da loja",
        servicoSlug: "aquisicao-registro-posse-de-arma-de-fogo",
        subperfilV2: "primeira_aquisicao",
      },
      {
        kind: "service",
        titulo: "Quero minha segunda arma",
        descricao: "Defesa pessoal permite até 2 armas. GT de brinde para retirar da loja",
        servicoSlug: "aquisicao-registro-posse-de-arma-de-fogo",
        subperfilV2: "segunda_aquisicao",
      },
      {
        kind: "service",
        titulo: "Já tenho autorização — quero registrar e retirar",
        descricao: "Registro SINARM + GT para sair da loja com a arma",
        servicoSlug: "registro-de-arma-de-fogo",
        subperfilV2: "registro_pos_autorizacao",
      },
      {
        kind: "service",
        titulo: "Já tenho arma e quero porte",
        descricao: "Sair de casa com a arma legalmente",
        servicoSlug: "porte-arma-fogo",
        subperfilV2: "porte_civil",
      },
      {
        kind: "step",
        key: "renovar",
        titulo: "Preciso renovar",
        descricao: "Meu CRAF ou porte está vencendo",
      },
      {
        kind: "step",
        key: "negado",
        titulo: "Tive pedido negado pela PF",
        descricao: "A PF indeferiu meu requerimento",
      },
    ],
  },
  steps: {
    renovar: {
      pergunta: "O que você quer renovar?",
      subtitulo: "Selecione o documento que está vencendo",
      opcoes: [
        {
          kind: "service",
          titulo: "Renovar posse / CRAF",
          descricao: "Renovação do registro da arma (CRAF/SINARM)",
          servicoSlug: "renovacao-posse-de-arma-de-fogo",
          subperfilV2: "renovacao_posse",
        },
        {
          kind: "service",
          titulo: "Renovar porte",
          descricao: "Renovação do porte de arma de fogo",
          servicoSlug: "renovacao-de-porte-de-arma-de-fogo",
          subperfilV2: "renovacao_porte",
        },
      ],
    },
    negado: {
      pergunta: "Como você quer reagir à negativa?",
      subtitulo: "Escolha a estratégia jurídica adequada",
      opcoes: [
        {
          kind: "service",
          titulo: "Recurso administrativo",
          descricao: "Recurso interno na própria PF",
          servicoSlug: "recurso-administrativo",
          subperfilV2: "recurso",
        },
        {
          kind: "service",
          titulo: "Mandado de segurança",
          descricao: "Ação judicial contra ato ilegal da PF",
          servicoSlug: "mandado-de-seguranca",
          subperfilV2: "mandado_seguranca",
        },
      ],
    },
  },
};

/* ----------------------- B — CAC ----------------------- */

export const QA_V2_PATH_CAC: QAV2PathDefinition = {
  perfil: "cac",
  rota: "/cadastro-v2/cac",
  tituloBreadcrumb: "CAC (esporte / caça / coleção)",
  raiz: {
    pergunta: "Você já tem o CR (Certificado de Registro)?",
    subtitulo: "O CR é o documento base de todo CAC",
    opcoes: [
      {
        kind: "service",
        titulo: "Ainda não tenho CR",
        descricao: "Quero começar como atirador, caçador ou colecionador",
        servicoSlug: "concessao-cr",
        subperfilV2: "concessao_cr",
      },
      {
        kind: "step",
        key: "cr_ativo",
        titulo: "Tenho CR ativo",
        descricao: "Preciso comprar arma, registrar, transportar ou atualizar",
      },
      {
        kind: "service",
        titulo: "CR vencendo / vencido",
        descricao: "Renovar antes do prazo (3 anos)",
        servicoSlug: "renovacao-cr",
        subperfilV2: "renovacao_cr",
      },
    ],
  },
  steps: {
    cr_ativo: {
      pergunta: "O que você precisa agora?",
      subtitulo: "Escolha a operação que vai fazer com seu CR ativo",
      opcoes: [
        {
          kind: "step",
          key: "comprar_arma",
          titulo: "Comprar arma",
          descricao: "Autorização de compra para atirador ou caçador",
        },
        {
          kind: "service",
          titulo: "Registrar arma no acervo",
          descricao: "Registro e apostilamento de arma de fogo CAC",
          servicoSlug: "registro-e-apostilamento-de-arma-de-fogo-cac",
          subperfilV2: "registro_arma",
        },
        {
          kind: "service",
          titulo: "Atualizar acervo",
          descricao: "Apostilamento / atualização cadastral",
          servicoSlug: "apostilamento-atualizacao",
          subperfilV2: "apostilamento",
        },
        {
          kind: "service",
          titulo: "Transportar (Guia de Tráfego)",
          descricao: "Guia de Tráfego Especial CAC",
          servicoSlug: "guia-de-trafego-especial-cac",
          subperfilV2: "gte",
        },
      ],
    },
    comprar_arma: {
      pergunta: "Em qual condição você vai comprar?",
      subtitulo: "A modalidade muda os documentos exigidos. Comprar arma como CAC envolve autorização, registro e GT — você pode ajustar na próxima etapa.",
      opcoes: [
        {
          kind: "bundle",
          titulo: "Como atirador esportivo",
          descricao: "Autorização de compra + registro no acervo + Guia de Tráfego. Você pode remover algum na próxima etapa.",
          servicoSlugs: [
            "autorizacao-de-compra-de-arma-de-fogo-atirador-esportivo-cac",
            "registro-e-apostilamento-de-arma-de-fogo-cac",
            "guia-de-trafego-especial-cac",
          ],
          subperfilV2: "compra_atirador",
        },
        {
          kind: "bundle",
          titulo: "Como caçador",
          descricao: "Autorização de compra + registro no acervo + Guia de Tráfego. Você pode remover algum na próxima etapa.",
          servicoSlugs: [
            "autorizacao-de-compra-de-arma-de-fogo-para-cacador-cac",
            "registro-e-apostilamento-de-arma-de-fogo-cac",
            "guia-de-trafego-especial-cac",
          ],
          subperfilV2: "compra_cacador",
        },
      ],
    },
  },
};

/* ----------------------- C — Profissão Ativa ----------------------- */

type CategoriaC = "seguranca_publica" | "magistratura_mp" | "ffaa_gsi" | "vigilante";

const buildSubServicoC = (cat: CategoriaC): QAV2Node => ({
  pergunta: "O que você precisa hoje?",
  subtitulo: "Selecione a operação para esta categoria",
  opcoes: [
    {
      kind: "service",
      titulo: "Porte funcional",
      descricao: "Concessão / regularização do porte da categoria",
      servicoSlug: "porte-arma-fogo",
      subperfilV2: `${cat}_porte`,
    },
    {
      kind: "service",
      titulo: "Aquisição com benefício da categoria",
      descricao: "Compra com isenções / condições da categoria",
      servicoSlug: "posse-de-arma-de-fogo",
      subperfilV2: `${cat}_aquisicao`,
    },
    {
      kind: "service",
      titulo: "Recurso administrativo",
      descricao: "Defesa em processo disciplinar ou negativa",
      servicoSlug: "recurso-administrativo",
      subperfilV2: `${cat}_recurso`,
    },
  ],
});

export const QA_V2_PATH_PROFISSAO: QAV2PathDefinition = {
  perfil: "profissional_ativo",
  rota: "/cadastro-v2/profissao-ativa",
  tituloBreadcrumb: "Profissão ativa",
  raiz: {
    pergunta: "Qual é a sua categoria profissional?",
    subtitulo: "Cada categoria tem direitos e documentos específicos",
    opcoes: [
      {
        kind: "step",
        key: "seguranca_publica",
        titulo: "Segurança Pública",
        descricao: "PM, PC, PF, PRF, Polícia Penal, Guarda Municipal (Art. 6º I-IV, VI)",
      },
      {
        kind: "step",
        key: "magistratura_mp",
        titulo: "Magistratura e Ministério Público",
        descricao: "Juízes, Promotores, Procuradores (Art. 6º VII, VIII)",
      },
      {
        kind: "step",
        key: "ffaa_gsi",
        titulo: "Forças Armadas / GSI",
        descricao: "Exército, Marinha, Aeronáutica, GSI, Forças Auxiliares (Art. 6º V, IX)",
      },
      {
        kind: "step",
        key: "vigilante",
        titulo: "Vigilante em serviço",
        descricao: "Vigilantes de empresa privada com registro ativo (Lei 7.102/83)",
      },
    ],
  },
  steps: {
    seguranca_publica: buildSubServicoC("seguranca_publica"),
    magistratura_mp: buildSubServicoC("magistratura_mp"),
    ffaa_gsi: buildSubServicoC("ffaa_gsi"),
    vigilante: buildSubServicoC("vigilante"),
  },
};

/* ----------------------- D — Aposentado / Inativo ----------------------- */

type CorpD = "ffaa" | "seguranca_publica" | "magistratura_mp";

const buildSubServicoD = (corp: CorpD): QAV2Node => ({
  pergunta: "O que você precisa fazer?",
  subtitulo: "Operações garantidas ao inativo (Art. 6º §1º)",
  opcoes: [
    {
      kind: "service",
      titulo: "Manter porte vitalício",
      descricao: "Confirmar / regularizar porte como inativo",
      servicoSlug: "porte-arma-fogo",
      subperfilV2: `${corp}_porte_vitalicio`,
    },
    {
      kind: "service",
      titulo: "Transferir acervo",
      descricao: "Regularizar armas que eram da corporação",
      servicoSlug: "apostilamento-atualizacao",
      subperfilV2: `${corp}_transferencia`,
    },
    {
      kind: "service",
      titulo: "Recurso administrativo",
      descricao: "Tive porte negado / cassado após aposentar",
      servicoSlug: "recurso-administrativo",
      subperfilV2: `${corp}_recurso`,
    },
  ],
});

export const QA_V2_PATH_APOSENTADO: QAV2PathDefinition = {
  perfil: "aposentado_inativo",
  rota: "/cadastro-v2/aposentado",
  tituloBreadcrumb: "Aposentado / Inativo",
  raiz: {
    pergunta: "De qual corporação você é aposentado/reformado?",
    subtitulo: "Art. 6º §1º da Lei 10.826 garante porte ao inativo",
    opcoes: [
      {
        kind: "step",
        key: "ffaa",
        titulo: "Forças Armadas",
        descricao: "Exército, Marinha, Aeronáutica (reformados, reserva remunerada, inativos)",
      },
      {
        kind: "step",
        key: "seguranca_publica",
        titulo: "Segurança Pública",
        descricao: "PM, PC, PF, PRF, Penal, Guarda Municipal aposentados",
      },
      {
        kind: "step",
        key: "magistratura_mp",
        titulo: "Magistratura/MP aposentado",
        descricao: "Juiz, promotor, procurador aposentado com direito a porte",
      },
    ],
  },
  steps: {
    ffaa: buildSubServicoD("ffaa"),
    seguranca_publica: buildSubServicoD("seguranca_publica"),
    magistratura_mp: buildSubServicoD("magistratura_mp"),
  },
};

/* ----------------------- E — Orientação necessária (absorve /descobrir-meu-caminho) -----------------------
 * Converte o quiz legado de 3 perguntas (objetivo → documentação → frequência)
 * para o formato de árvore guiada do /cadastro. Preserva a lógica de recomendação
 * final, os slugs de serviço e os parâmetros `perfil_v2`/`subperfil_v2` que o
 * checkout já consome.
 * ----------------------------------------------------------------------------- */

export const QA_V2_PATH_ORIENTACAO: QAV2PathDefinition = {
  perfil: "orientacao_necessaria",
  rota: "/cadastro/orientacao",
  tituloBreadcrumb: "Orientação necessária",
  raiz: {
    pergunta: "Qual é a sua motivação real?",
    subtitulo: "Sem rodeio. Por que você está aqui?",
    opcoes: [
      {
        kind: "step",
        key: "defesa_casa",
        titulo: "Defesa pessoal: defender minha família em casa",
        descricao: "Quero arma legalizada em casa. Dormir tranquilo. Proteger quem amo.",
      },
      {
        kind: "step",
        key: "cac_objetivo",
        titulo: "CAC: colecionar, atirar e caçar",
        descricao: "Quero CR na Polícia Federal/SINARM-CAC. Construir acervo. Treinar habitualidade.",
      },
      {
        kind: "service",
        titulo: "Só quero atirar de vez em quando",
        descricao: "Curiosidade, lazer, experiência no estande. Sem compromisso.",
        servicoSlug: "operador-de-pistola-nivel-i",
        subperfilV2: "curso_operador",
      },
      {
        kind: "service",
        titulo: "Profissão exige (segurança, escolta, VIP)",
        descricao: "Trabalho na área. Preciso de capacitação técnica e enquadramento de porte.",
        servicoSlug: "porte-arma-fogo",
        subperfilV2: "porte_funcional_atividade_risco",
      },
    ],
  },
  steps: {
    defesa_casa: {
      pergunta: "Onde você está hoje na documentação?",
      subtitulo: "Selecione o seu ponto de partida para defesa residencial",
      opcoes: [
        {
          kind: "service",
          titulo: "Começando do zero (não tenho nada)",
          descricao: "Aquisição + registro + posse SINARM pela PF",
          servicoSlug: "aquisicao-registro-posse-de-arma-de-fogo",
          subperfilV2: "primeira_aquisicao",
        },
        {
          kind: "service",
          titulo: "Já tenho posse na PF",
          descricao: "Renovação / regularização do registro existente",
          servicoSlug: "renovacao-posse-de-arma-de-fogo",
          subperfilV2: "renovacao_posse",
        },
        {
          kind: "service",
          titulo: "Só quero experimentar antes de decidir",
          descricao: "Curso prático de tiro como porta de entrada",
          servicoSlug: "operador-de-pistola-nivel-i",
          subperfilV2: "curso_operador",
        },
      ],
    },
    cac_objetivo: {
      pergunta: "Onde você está hoje na documentação?",
      subtitulo: "Selecione o seu ponto de partida como CAC",
      opcoes: [
        {
          kind: "step",
          key: "cac_zero",
          titulo: "Começando do zero (não tenho nada)",
          descricao: "Nunca dei entrada em nada. Vamos definir o ritmo de treino.",
        },
        {
          kind: "bundle",
          titulo: "Já sou CAC com CR ativo",
          descricao: "Autorização de compra + registro/apostilamento + Guia de Tráfego (CAC)",
          servicoSlugs: [
            "autorizacao-de-compra-de-arma-de-fogo-atirador-esportivo-cac",
            "registro-e-apostilamento-de-arma-de-fogo-cac",
            "guia-de-trafego-especial-cac",
          ],
          subperfilV2: "cr_ativo_compra_registro_gte",
        },
        {
          kind: "service",
          titulo: "Só quero experimentar antes de decidir",
          descricao: "Curso prático de tiro como porta de entrada",
          servicoSlug: "operador-de-pistola-nivel-i",
          subperfilV2: "curso_operador",
        },
      ],
    },
    cac_zero: {
      pergunta: "Com que frequência você pretende atirar?",
      subtitulo: "O ritmo de treino define o perfil de concessão de CR",
      opcoes: [
        {
          kind: "service",
          titulo: "Toda semana. Quero virar operador.",
          descricao: "Concessão de CR com perfil de treino semanal / operador",
          servicoSlug: "concessao-cr",
          subperfilV2: "concessao_cr_operador",
        },
        {
          kind: "service",
          titulo: "Mensal — continuar mantendo a técnica",
          descricao: "Concessão de CR com manutenção mensal da habitualidade",
          servicoSlug: "concessao-cr",
          subperfilV2: "concessao_cr",
        },
        {
          kind: "service",
          titulo: "Esporádico. Quando der vontade.",
          descricao: "Curso prático de tiro — sem necessidade de CR neste momento",
          servicoSlug: "operador-de-pistola-nivel-i",
          subperfilV2: "curso_operador",
        },
      ],
    },
  },
};
