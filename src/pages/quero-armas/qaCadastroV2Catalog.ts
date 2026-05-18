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
    acao: "redirecionar_quiz",
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
    pergunta: "Você já tem o CR (Certificado de Registro do Exército)?",
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
      subtitulo: "A modalidade muda os documentos exigidos",
      opcoes: [
        {
          kind: "service",
          titulo: "Como atirador esportivo",
          descricao: "Compra com habitualidade comprovada (atirador)",
          servicoSlug: "autorizacao-de-compra-de-arma-de-fogo-atirador-esportivo-cac",
          subperfilV2: "compra_atirador",
        },
        {
          kind: "service",
          titulo: "Como caçador",
          descricao: "Compra de arma para atividade venatória",
          servicoSlug: "autorizacao-de-compra-de-arma-de-fogo-para-cacador-cac",
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