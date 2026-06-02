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

/** Overrides por slug de /servicos/:slug. Quem não estiver listado herda do nome do serviço. */
export const serviceMetaBySlug: Record<string, PageMeta> = {
  cr: {
    title: 'CR — Certificado de Registro | Quero Armas',
    description:
      'Assessoria completa para emissão, renovação e regularização de CR para CACs, atiradores, colecionadores e caçadores.',
    image: og('home.jpg'),
  },
  'autorizacao-de-compra': {
    title: 'Autorização de Compra de Arma de Fogo | Quero Armas',
    description:
      'Cuidamos do processo de autorização de compra de arma de fogo, com orientação documental e acompanhamento do pedido.',
    image: og('home.jpg'),
  },
  'posse-arma-fogo': {
    title: 'Posse de Arma de Fogo | Quero Armas',
    description:
      'Assessoria para aquisição legal, registro e posse de arma de fogo, com acompanhamento completo do processo.',
    image: og('home.jpg'),
  },
  posse: {
    title: 'Posse de Arma de Fogo | Quero Armas',
    description:
      'Assessoria para aquisição legal, registro e posse de arma de fogo, com acompanhamento completo do processo.',
    image: og('home.jpg'),
  },
  'porte-arma-fogo': {
    title: 'Porte de Arma de Fogo | Quero Armas',
    description:
      'Assessoria especializada para pedido de porte de arma de fogo, com análise documental, fundamentação e acompanhamento.',
    image: og('home.jpg'),
  },
  porte: {
    title: 'Porte de Arma de Fogo | Quero Armas',
    description:
      'Assessoria especializada para pedido de porte de arma de fogo, com análise documental, fundamentação e acompanhamento.',
    image: og('home.jpg'),
  },
  craf: {
    title: 'CRAF — Registro de Arma de Fogo | Quero Armas',
    description:
      'Regularização, emissão e acompanhamento de CRAF com suporte especializado para proprietários de armas.',
    image: og('home.jpg'),
  },
  'guia-de-trafego': {
    title: 'Guia de Tráfego para CAC | Quero Armas',
    description:
      'Assessoria para emissão e regularização de Guia de Tráfego para transporte legal de armas e munições.',
    image: og('home.jpg'),
  },
  treinamentos: {
    title: 'Treinamentos com Armas de Fogo | Quero Armas',
    description:
      'Cursos e treinamentos para operadores, CACs e interessados em capacitação técnica com segurança e responsabilidade.',
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