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

/** Resolve a URL absoluta da imagem OG por slug.
 *  Cada slug ativo em serviceMetaBySlug tem um arquivo em public/og/<slug>.jpg.
 *  Fallback defensivo para home quando o slug não estiver mapeado. */
function imageForSlug(slug: string): string {
  if (!slug) return FALLBACK_IMAGE;
  return og(`${slug}.jpg`);
}

/**
 * Metadados Open Graph por rota canônica.
 * Para rotas dinâmicas como /servicos/:slug, use `serviceMetaBySlug` abaixo
 * ou resolva via `getPageMeta(pathname)` que faz a correspondência.
 */
export const pageMeta: Record<string, PageMeta> = {
  '/': {
    title: 'Quero Armas — Despachante de Armas, CAC, CR e Treinamentos',
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
  '/quem-somos': {
    title: 'Quem Somos | Quero Armas',
    description:
      'Conheça a estrutura, o método e o posicionamento da Quero Armas na assessoria técnica, documental e administrativa.',
    image: og('home.jpg'),
  },
  '/como-funciona': {
    title: 'Como Funciona | Quero Armas',
    description:
      'Entenda a jornada da Quero Armas, do cadastro ao acompanhamento, com etapas claras e responsabilidade em cada fase.',
    image: og('home.jpg'),
  },
  '/atendimento-nacional': {
    title: 'Atendimento Nacional | Quero Armas',
    description:
      'Saiba como a Quero Armas atende clientes em todo o Brasil com estrutura digital, orientação responsável e etapas presenciais quando aplicável.',
    image: og('home.jpg'),
  },
  '/limites-e-responsabilidades': {
    title: 'Limites e Responsabilidades | Quero Armas',
    description:
      'Entenda com clareza o que a Quero Armas faz, o que depende do cliente e o que depende da autoridade competente.',
    image: og('home.jpg'),
  },
  '/termos': {
    title: 'Termos de Uso | Quero Armas',
    description:
      'Leia os Termos de Uso da Quero Armas para entender as condições de acesso, cadastro, contratação e uso da plataforma.',
    image: og('home.jpg'),
  },
  '/privacidade': {
    title: 'Política de Privacidade | Quero Armas',
    description:
      'Entenda como a Quero Armas coleta, utiliza, armazena e protege dados pessoais no site e na área do cliente.',
    image: og('home.jpg'),
  },
};

/** Overrides por slug REAL de qa_servicos_catalogo. Mantenha sincronizado
 *  com scripts/prerender-og.mjs (que materializa essas mesmas metas em HTML
 *  estático para crawlers de WhatsApp/Facebook/Telegram). */
export const serviceMetaBySlug: Record<string, PageMeta> = {
  'posse-de-arma-de-fogo': {
    title: 'Posse de Arma de Fogo | Quero Armas',
    description:
      'Estratégia documental e assessoria premium para viabilizar sua posse de arma de fogo com segurança jurídica, previsibilidade e condução técnica junto à Polícia Federal.',
    image: imageForSlug('posse-de-arma-de-fogo'),
  },
  'aquisicao-registro-posse-de-arma-de-fogo': {
    title: 'Aquisição, Registro e Posse de Arma de Fogo | Quero Armas',
    description:
      'Regularize sua aquisição, registro e posse de arma de fogo com apoio especializado. Análise documental, orientação estratégica e condução técnica em cada etapa. Mais segurança para protocolar do jeito certo.',
    image: imageForSlug('aquisicao-registro-posse-de-arma-de-fogo'),
  },
  'renovacao-posse-de-arma-de-fogo': {
    title: 'Renovação de Posse de Arma de Fogo | Quero Armas',
    description:
      'Renovação de posse com revisão técnica completa, organização documental e protocolo estratégico para reduzir exigências e preservar a regularidade do seu registro.',
    image: imageForSlug('renovacao-posse-de-arma-de-fogo'),
  },
  'renovacao-de-porte-de-arma-de-fogo': {
    title: 'Renovação de Porte de Arma de Fogo | Quero Armas',
    description:
      'Renovação de porte com fundamentação técnica qualificada, organização probatória e acompanhamento premium para sustentar um processo mais robusto perante a Polícia Federal.',
    image: imageForSlug('renovacao-de-porte-de-arma-de-fogo'),
  },
  'porte-de-arma-de-fogo-por-ameaca-grave-ameaca': {
    title: 'Porte de Arma por Ameaça / Grave Ameaça | Quero Armas',
    description:
      'Construção estratégica do pedido de porte por ameaça ou grave ameaça, com prova documental, narrativa técnica e acompanhamento especializado na Polícia Federal.',
    image: imageForSlug('porte-de-arma-de-fogo-por-ameaca-grave-ameaca'),
  },
  'porte-funcional-magistrado-ministerio-publico': {
    title: 'Porte Funcional — Magistrado e Ministério Público | Quero Armas',
    description:
      'Assessoria executiva para porte funcional de magistrados e membros do Ministério Público, com condução técnica, discrição e conformidade documental.',
    image: imageForSlug('porte-funcional-magistrado-ministerio-publico'),
  },
  'concessao-cr': {
    title: 'Concessão de CR (Atirador, Colecionador, Caçador) | Quero Armas',
    description:
      'Assessoria premium para concessão de CR, com inteligência documental, alinhamento estratégico do processo e acompanhamento técnico até a emissão regular do certificado.',
    image: imageForSlug('concessao-cr'),
  },
  'renovacao-cr': {
    title: 'Renovação de CR (Polícia Federal) | Quero Armas',
    description:
      'Renovação de CR com gestão de prazo, revisão técnica do dossiê e condução estratégica para manter sua regularidade sem improviso e sem retrabalho.',
    image: imageForSlug('renovacao-cr'),
  },
  'autorizacao-de-compra-de-arma-de-fogo-atirador-esportivo-cac': {
    title: 'Autorização de Compra — Atirador Esportivo (CAC) | Quero Armas',
    description:
      'Autorização de compra para atirador esportivo com análise estratégica de acervo, documentação validada e protocolo técnico voltado à aprovação segura.',
    image: imageForSlug('autorizacao-de-compra-de-arma-de-fogo-atirador-esportivo-cac'),
  },
  'autorizacao-de-compra-de-arma-de-fogo-para-cacador-cac': {
    title: 'Autorização de Compra — Caçador (CAC) | Quero Armas',
    description:
      'Autorização de compra para caçador com revisão criteriosa do acervo, documentação consistente e condução técnica para um protocolo mais sólido.',
    image: imageForSlug('autorizacao-de-compra-de-arma-de-fogo-para-cacador-cac'),
  },
  'guia-de-trafego-especial-cac': {
    title: 'Guia de Tráfego Especial (CAC) | Quero Armas',
    description:
      'Emissão estratégica da Guia de Tráfego Especial com organização documental e acompanhamento técnico para ampliar mobilidade e regularidade operacional.',
    image: imageForSlug('guia-de-trafego-especial-cac'),
  },
  'guia-de-transito-gt': {
    title: 'Guia de Trânsito (GT) | Quero Armas',
    description:
      'Guia de Trânsito com condução técnica e protocolo correto para assegurar deslocamento regular, rastreabilidade documental e tranquilidade operacional.',
    image: imageForSlug('guia-de-transito-gt'),
  },
  'registro-arma-fogo': {
    title: 'Registro de Arma de Fogo (Defesa Pessoal) | Quero Armas',
    description:
      'Registro para defesa pessoal com assessoria premium, controle documental e acompanhamento técnico para emissão regular perante a Polícia Federal.',
    image: imageForSlug('registro-arma-fogo'),
  },
  'registro-e-apostilamento-de-arma-de-fogo-cac': {
    title: 'Registro e Apostilamento de Arma (CAC) | Quero Armas',
    description:
      'Registro e apostilamento com revisão estratégica do acervo e condução técnica para manter sua situação regular, atualizada e pronta para fiscalização.',
    image: imageForSlug('registro-e-apostilamento-de-arma-de-fogo-cac'),
  },
  'segunda-via-de-craf-digital': {
    title: 'Segunda Via de CRAF Digital | Quero Armas',
    description:
      'Segunda via de CRAF digital com atuação ágil e precisa para restabelecer sua documentação e preservar a regularidade do registro.',
    image: imageForSlug('segunda-via-de-craf-digital'),
  },
  'operador-de-pistola-nivel-i': {
    title: 'Curso Operador de Pistola — Nível I | Quero Armas',
    description:
      'Treinamento premium de operador de pistola com foco em segurança, técnica, domínio de fundamentos e experiência prática orientada por especialistas.',
    image: imageForSlug('operador-de-pistola-nivel-i'),
  },
  'vip-operador-de-pistola-nivel-i': {
    title: 'VIP — Operador de Pistola Nível I | Quero Armas',
    description:
      'Experiência VIP de operador de pistola com atendimento personalizado, ritmo individualizado e máxima qualidade técnica em cada etapa da instrução.',
    image: imageForSlug('vip-operador-de-pistola-nivel-i'),
  },
  'apostilamento-atualizacao': {
    title: 'Apostilamento — Atualização de Acervo (CAC) | Quero Armas',
    description:
      'Atualização de acervo com apostilamento técnico e controle documental rigoroso para manter sua base cadastral íntegra, regular e pronta para conferência.',
    image: imageForSlug('apostilamento-atualizacao'),
  },
  'mandado-de-seguranca': {
    title: 'Mandado de Segurança em Matéria de Armas | Quero Armas',
    description:
      'Atuação estratégica em mandado de segurança para enfrentar ilegalidades administrativas e recuperar o andamento do seu processo com força técnica.',
    image: imageForSlug('mandado-de-seguranca'),
  },
  'recurso-administrativo': {
    title: 'Recurso Administrativo (Polícia Federal) | Quero Armas',
    description:
      'Recurso administrativo com tese técnica consistente, revisão do processo e argumentação estratégica para enfrentar indeferimentos com maior solidez.',
    image: imageForSlug('recurso-administrativo'),
  },
  'transferencia-de-propriedade-de-arma-de-fogo': {
    title: 'Transferência de Propriedade de Arma de Fogo | Quero Armas',
    description:
      'Transferência de propriedade com segurança documental, condução técnica e protocolo correto para formalizar a operação sem risco de inconsistências.',
    image: imageForSlug('transferencia-de-propriedade-de-arma-de-fogo'),
  },
  'mudanca-servico': {
    title: 'Mudança de Serviço (Posse → CR) | Quero Armas',
    description:
      'Reposicionamento estratégico de posse para CR com planejamento documental e condução técnica para ampliar possibilidades dentro da regularidade.',
    image: imageForSlug('mudanca-servico'),
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
    image: imageForSlug(slug),
  };
}

export { FALLBACK_IMAGE as DEFAULT_OG_IMAGE };
