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