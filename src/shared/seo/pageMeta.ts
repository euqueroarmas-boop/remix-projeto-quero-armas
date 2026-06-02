import { SITE_URL } from '@/shared/components/SEO';

export interface PageMeta {
  title: string;
  description: string;
  image: string;
}

const FALLBACK_IMAGE = `${SITE_URL}/og/home.jpg`;

function og(file: string): string {
  return `${SITE_URL}/og/${file}`;
}

/**
 * Metadados Open Graph por rota canônica.
 * Para rotas dinâmicas como /servicos/:slug, use `serviceMetaBySlug` abaixo
 * ou resolva via `getPageMeta(pathname)` que faz a correspondência.
 */
export const pageMeta: Record<string, PageMeta> = {
  '/': {
    title: 'Eu Quero Armas — Despachante de Armas, CAC, CR e Treinamentos',
    description:
      'Assessoria especializada para posse, porte, CAC, CR, CRAF, autorização de compra, guia de tráfego e treinamentos com armas de fogo.',
    image: og('home.jpg'),
  },
  '/servicos': {
    title: 'Catálogo de Serviços | Quero Armas',
    description:
      'Catálogo completo de assessoria em armas: posse, porte, CR, CRAF, autorização de compra, guia de tráfego e treinamentos.',
    image: og('home.jpg'),
  },
  '/carrinho': {
    title: 'Carrinho de Contratação | Quero Armas',
    description: 'Revise os serviços selecionados e finalize sua contratação com a Quero Armas.',
    image: og('home.jpg'),
  },
  '/cadastro': {
    title: 'Começar Meu Cadastro | Quero Armas',
    description:
      'Cadastro guiado para identificar o caminho legal correto para sua posse, porte, CR ou CAC com a Quero Armas.',
    image: og('home.jpg'),
  },
};

/** Overrides por slug REAL de qa_servicos_catalogo. Mantenha sincronizado
 *  com scripts/prerender-og.mjs (que materializa essas mesmas metas em HTML
 *  estático para crawlers de WhatsApp/Facebook/Telegram). */
export const serviceMetaBySlug: Record<string, PageMeta> = {
  'posse-de-arma-de-fogo': {
    title: 'Posse de Arma de Fogo (PF) | Quero Armas',
    description:
      'Assessoria completa para aquisição e posse de arma de fogo junto à Polícia Federal: documentação, exames, fundamentação e acompanhamento até a entrega do CRAF.',
    image: og('home.jpg'),
  },
  'aquisicao-registro-posse-de-arma-de-fogo': {
    title: 'Aquisição, Registro e Posse de Arma de Fogo | Quero Armas',
    description:
      'Processo completo de aquisição, registro e posse de arma de fogo na Polícia Federal com acompanhamento jurídico-administrativo do início ao fim.',
    image: og('home.jpg'),
  },
  'renovacao-posse-de-arma-de-fogo': {
    title: 'Renovação de Posse de Arma de Fogo | Quero Armas',
    description:
      'Renovação de posse de arma de fogo na Polícia Federal: análise documental, agendamento, exames e protocolo sem retrabalho.',
    image: og('home.jpg'),
  },
  'renovacao-de-porte-de-arma-de-fogo': {
    title: 'Renovação de Porte de Arma de Fogo | Quero Armas',
    description:
      'Renovação de porte de arma de fogo com fundamentação técnica e jurídica completa, evitando indeferimento e exigências.',
    image: og('home.jpg'),
  },
  'porte-de-arma-de-fogo-por-ameaca-grave-ameaca': {
    title: 'Porte de Arma por Ameaça / Grave Ameaça | Quero Armas',
    description:
      'Pedido de porte de arma de fogo por ameaça ou grave ameaça: BO, provas, fundamentação jurídica e acompanhamento na Polícia Federal.',
    image: og('home.jpg'),
  },
  'porte-funcional-magistrado-ministerio-publico': {
    title: 'Porte Funcional — Magistrado e Ministério Público | Quero Armas',
    description:
      'Porte funcional de arma de fogo para magistrados e membros do Ministério Público com documentação e protocolo conforme a Lei Complementar.',
    image: og('home.jpg'),
  },
  'concessao-cr': {
    title: 'Concessão de CR (Atirador, Colecionador, Caçador) | Quero Armas',
    description:
      'Assessoria completa para concessão do CR no Exército Brasileiro: documentação, capacitação, vinculação a clube e acompanhamento até a emissão.',
    image: og('home.jpg'),
  },
  'renovacao-cr': {
    title: 'Renovação de CR (Exército) | Quero Armas',
    description:
      'Renovação do Certificado de Registro de CAC no Exército com gestão do prazo, documentos e protocolo regularizado.',
    image: og('home.jpg'),
  },
  'autorizacao-de-compra-de-arma-de-fogo-atirador-esportivo-cac': {
    title: 'Autorização de Compra — Atirador Esportivo (CAC) | Quero Armas',
    description:
      'Autorização de compra de arma de fogo para atirador esportivo CAC: análise de acervo, documentação e protocolo no Exército.',
    image: og('home.jpg'),
  },
  'autorizacao-de-compra-de-arma-de-fogo-para-cacador-cac': {
    title: 'Autorização de Compra — Caçador (CAC) | Quero Armas',
    description:
      'Autorização de compra de arma de fogo para caçador CAC com revisão de acervo, documentos exigidos e protocolo correto no Exército.',
    image: og('home.jpg'),
  },
  'guia-de-trafego-especial-cac': {
    title: 'Guia de Tráfego Especial (CAC) | Quero Armas',
    description:
      'Emissão da Guia de Tráfego Especial para CAC transportar armas e munições com cobertura nacional e validade ampliada.',
    image: og('home.jpg'),
  },
  'guia-de-transito-gt': {
    title: 'Guia de Trânsito (GT) | Quero Armas',
    description:
      'Guia de Trânsito de arma de fogo para deslocamento legal entre clube, residência e estandes, com emissão rápida e regular.',
    image: og('home.jpg'),
  },
  'registro-arma-fogo': {
    title: 'Registro de Arma de Fogo (Defesa Pessoal) | Quero Armas',
    description:
      'Registro de arma de fogo para defesa pessoal junto à Polícia Federal, com emissão e renovação do CRAF acompanhada por especialistas.',
    image: og('home.jpg'),
  },
  'registro-e-apostilamento-de-arma-de-fogo-cac': {
    title: 'Registro e Apostilamento de Arma (CAC) | Quero Armas',
    description:
      'Registro e apostilamento de arma de fogo de CAC no Exército, mantendo o acervo regular e atualizado para portar e transitar.',
    image: og('home.jpg'),
  },
  'segunda-via-de-craf-digital': {
    title: 'Segunda Via de CRAF Digital | Quero Armas',
    description:
      'Emissão de segunda via do CRAF digital com agilidade, mantendo a regularidade da arma de fogo perante a Polícia Federal.',
    image: og('home.jpg'),
  },
  'operador-de-pistola-nivel-i': {
    title: 'Curso Operador de Pistola — Nível I | Quero Armas',
    description:
      'Treinamento Operador de Pistola Nível I: fundamentos, segurança, manuseio e tiro real com instrutores credenciados.',
    image: og('home.jpg'),
  },
  'vip-operador-de-pistola-nivel-i': {
    title: 'VIP — Operador de Pistola Nível I | Quero Armas',
    description:
      'Versão VIP do Operador de Pistola Nível I: turma reduzida, atendimento personalizado e tempo dedicado de instrução.',
    image: og('home.jpg'),
  },
  'apostilamento-atualizacao': {
    title: 'Apostilamento — Atualização de Acervo (CAC) | Quero Armas',
    description:
      'Atualização e apostilamento do acervo CAC no Exército mantendo o cadastro 100% regular após cada nova aquisição.',
    image: og('home.jpg'),
  },
  'mandado-de-seguranca': {
    title: 'Mandado de Segurança em Matéria de Armas | Quero Armas',
    description:
      'Impetração de Mandado de Segurança contra atos ilegais ou abusivos da PF/EB em processos relacionados a armas de fogo.',
    image: og('home.jpg'),
  },
  'recurso-administrativo': {
    title: 'Recurso Administrativo (PF / EB) | Quero Armas',
    description:
      'Recurso administrativo contra indeferimentos da Polícia Federal ou do Exército com fundamentação técnica e jurídica.',
    image: og('home.jpg'),
  },
  'transferencia-de-propriedade-de-arma-de-fogo': {
    title: 'Transferência de Propriedade de Arma de Fogo | Quero Armas',
    description:
      'Transferência regular da propriedade de arma de fogo entre titulares, com toda a documentação e protocolo correto.',
    image: og('home.jpg'),
  },
  'mudanca-servico': {
    title: 'Mudança de Serviço (Posse → CR) | Quero Armas',
    description:
      'Migração estratégica de Posse para CR, ampliando seu acervo e direitos como atirador, colecionador ou caçador.',
    image: og('home.jpg'),
  },
};

/** Resolve metadados para um pathname conhecido. Retorna null se não houver match. */
export function getPageMeta(pathname: string): PageMeta | null {
  const path = pathname.replace(/\/+$/, '') || '/';
  if (pageMeta[path]) return pageMeta[path];
  const serviceMatch = path.match(/^\/servicos\/([^/]+)$/);
  if (serviceMatch && serviceMetaBySlug[serviceMatch[1]]) {
    return serviceMetaBySlug[serviceMatch[1]];
  }
  return null;
}

export function buildServiceMeta(
  slug: string,
  fallback: { name: string; short_description?: string | null },
): PageMeta {
  const override = serviceMetaBySlug[slug];
  if (override) return override;
  return {
    title: `${fallback.name} | Quero Armas`,
    description:
      fallback.short_description?.trim() ||
      `Assessoria especializada Quero Armas para ${fallback.name}.`,
    image: FALLBACK_IMAGE,
  };
}

export { FALLBACK_IMAGE as DEFAULT_OG_IMAGE };