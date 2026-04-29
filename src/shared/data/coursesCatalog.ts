/**
 * Catálogo central de cursos da Quero Armas.
 * Estrutura preparada para múltiplos cursos e níveis.
 * IMPORTANTE: nunca incluir conteúdo operacional sensível (técnica de saque,
 * mira, recarga, combate). O conteúdo é institucional/comercial.
 */

export type CourseStatus = 'ativo' | 'em_breve';
export type CourseCategory = 'operador-de-pistola';

export interface CourseModule {
  title: string;
  description: string;
}

export interface CourseTimelineStep {
  step: string;
  title: string;
  description: string;
}

export interface CourseFaqItem {
  question: string;
  answer: string;
}

export interface CourseLocation {
  name: string;
  address: string;
  city: string;
  state: string;
  zip: string;
}

export interface Course {
  id: string;
  title: string;
  slug: string;
  level: 'I' | 'II' | 'III';
  status: CourseStatus;
  category: CourseCategory;
  categoryLabel: string;
  shortDescription: string;
  heroTitle: string;
  heroSubtitle: string;
  heroImpact: string;
  targetAudience: string[];
  includedItems: string[];
  modules: CourseModule[];
  benefits: string[];
  requirements: string[];
  location: CourseLocation;
  duration: string;
  schedule: string;
  weekday: string;
  ctaWhatsApp: string;
  whatsappNumber: string;
  whatsappMessage: string;
  price?: string | null;
  faq: CourseFaqItem[];
  timeline: CourseTimelineStep[];
  seoTitle: string;
  seoDescription: string;
}

const WHATSAPP_NUMBER_RAW = '5512978136556';
const WHATSAPP_DISPLAY = '(12) 97813-6556';

const O_RANCHO_LOCATION: CourseLocation = {
  name: 'Clube de Tiro O Rancho',
  address: 'Estr. Rio Comprido, 2360 - Rio Comprido',
  city: 'Jacareí',
  state: 'SP',
  zip: '12302-210',
};

export const coursesCatalog: Course[] = [
  {
    id: 'operador-de-pistola-nivel-i',
    title: 'Operador de Pistola — Nível I',
    slug: 'operador-de-pistola-nivel-i',
    level: 'I',
    status: 'ativo',
    category: 'operador-de-pistola',
    categoryLabel: 'Operador de Pistola',
    shortDescription:
      'Curso de formação inicial responsável com pistola, em ambiente controlado e supervisionado.',
    heroTitle: 'Operador de Pistola — Nível I',
    heroSubtitle:
      'Aprenda os fundamentos essenciais para lidar com uma pistola com segurança, responsabilidade e consciência técnica, em ambiente controlado e supervisionado.',
    heroImpact:
      'Uma pistola não perdoa improviso. Antes de pensar em performance, velocidade ou confiança, o aluno precisa dominar segurança, postura mental, responsabilidade e fundamentos básicos. O Nível I é o primeiro passo para quem quer treinar do jeito certo.',
    targetAudience: [
      'Quem nunca teve treinamento estruturado com pistola',
      'Quem deseja iniciar no tiro esportivo com mais segurança',
      'Quem já possui contato básico, mas quer corrigir vícios',
      'Quem busca conhecimento responsável antes de adquirir arma',
      'Quem quer entender a rotina segura dentro de um clube de tiro',
      'Quem valoriza treinamento sério, controlado e supervisionado',
    ],
    includedItems: [
      '8 horas de treinamento',
      'Almoço incluso',
      'Alvos inclusos',
      'Munições inclusas',
      'Óculos de proteção',
      'Protetor auricular',
      'Ambiente de clube de tiro',
      'Instrutor acompanhando a prática',
      'Estrutura segura e organizada',
    ],
    modules: [],
    benefits: [
      'Consciência de segurança',
      'Disciplina no ambiente de tiro',
      'Responsabilidade no contato com arma de fogo',
      'Fundamentos iniciais supervisionados',
      'Controle emocional e tomada de decisão segura',
      'Conduta adequada antes, durante e depois da prática',
      'Noções legais e limites de uso responsável',
      'Postura profissional diante do equipamento',
    ],
    requirements: [],
    location: O_RANCHO_LOCATION,
    duration: '8 horas, com 1 hora de intervalo para almoço',
    schedule: '9h às 18h',
    weekday: 'Sábado',
    ctaWhatsApp: 'Reservar minha vaga',
    whatsappNumber: WHATSAPP_NUMBER_RAW,
    whatsappMessage:
      'Olá! Tenho interesse no curso Operador de Pistola — Nível I. Gostaria de saber sobre a próxima turma.',
    price: null,
    timeline: [
      {
        step: '01',
        title: 'Reserva da vaga',
        description: 'O interessado entra em contato com a equipe Quero Armas.',
      },
      {
        step: '02',
        title: 'Confirmação da turma',
        description: 'A equipe confirma disponibilidade, data e orientações administrativas.',
      },
      {
        step: '03',
        title: 'Treinamento presencial',
        description: 'O aluno participa do curso no Clube de Tiro O Rancho, em Jacareí/SP.',
      },
      {
        step: '04',
        title: 'Conclusão do Nível I',
        description:
          'Ao final, o aluno sai com base mais consciente, segura e responsável para continuar sua evolução.',
      },
    ],
    faq: [
      {
        question: 'Preciso ter arma para fazer o curso?',
        answer:
          'Não necessariamente. A disponibilidade e as condições devem ser confirmadas com a equipe antes da turma.',
      },
      {
        question: 'O curso serve para tirar porte de arma?',
        answer:
          'Não. O curso não garante porte, posse, CR ou qualquer autorização administrativa. Ele tem foco em treinamento responsável e formação inicial.',
      },
      {
        question: 'O curso é para iniciantes?',
        answer: 'Sim. O Nível I é voltado para quem precisa construir uma base segura e supervisionada.',
      },
      {
        question: 'O que está incluso?',
        answer:
          'Almoço, alvos, munições, óculos de proteção, protetor auricular e estrutura de treinamento, conforme disponibilidade da turma.',
      },
      {
        question: 'Onde será realizado?',
        answer: 'No Clube de Tiro O Rancho, em Jacareí/SP.',
      },
      {
        question: 'Como faço para reservar?',
        answer: 'Pelo WhatsApp da Quero Armas.',
      },
    ],
    seoTitle: 'Operador de Pistola Nível I em Jacareí | Curso Quero Armas',
    seoDescription:
      'Curso Operador de Pistola Nível I em Jacareí/SP. Treinamento responsável com foco em segurança, fundamentos iniciais e prática supervisionada.',
  },
  {
    id: 'operador-de-pistola-nivel-ii',
    title: 'Operador de Pistola — Nível II',
    slug: 'operador-de-pistola-nivel-ii',
    level: 'II',
    status: 'em_breve',
    category: 'operador-de-pistola',
    categoryLabel: 'Operador de Pistola',
    shortDescription: 'Em breve.',
    heroTitle: 'Operador de Pistola — Nível II',
    heroSubtitle: 'Em breve.',
    heroImpact: '',
    targetAudience: [],
    includedItems: [],
    modules: [],
    benefits: [],
    requirements: [],
    location: O_RANCHO_LOCATION,
    duration: '',
    schedule: '',
    weekday: '',
    ctaWhatsApp: 'Falar com a equipe',
    whatsappNumber: WHATSAPP_NUMBER_RAW,
    whatsappMessage: 'Olá! Tenho interesse no curso Operador de Pistola — Nível II.',
    price: null,
    timeline: [],
    faq: [],
    seoTitle: 'Operador de Pistola Nível II — Em breve | Quero Armas',
    seoDescription: 'Curso Operador de Pistola Nível II em breve. Fale com a equipe Quero Armas.',
  },
  {
    id: 'operador-de-pistola-nivel-iii',
    title: 'Operador de Pistola — Nível III',
    slug: 'operador-de-pistola-nivel-iii',
    level: 'III',
    status: 'em_breve',
    category: 'operador-de-pistola',
    categoryLabel: 'Operador de Pistola',
    shortDescription: 'Em breve.',
    heroTitle: 'Operador de Pistola — Nível III',
    heroSubtitle: 'Em breve.',
    heroImpact: '',
    targetAudience: [],
    includedItems: [],
    modules: [],
    benefits: [],
    requirements: [],
    location: O_RANCHO_LOCATION,
    duration: '',
    schedule: '',
    weekday: '',
    ctaWhatsApp: 'Falar com a equipe',
    whatsappNumber: WHATSAPP_NUMBER_RAW,
    whatsappMessage: 'Olá! Tenho interesse no curso Operador de Pistola — Nível III.',
    price: null,
    timeline: [],
    faq: [],
    seoTitle: 'Operador de Pistola Nível III — Em breve | Quero Armas',
    seoDescription: 'Curso Operador de Pistola Nível III em breve. Fale com a equipe Quero Armas.',
  },
];

export const courseCategories: { id: CourseCategory; label: string }[] = [
  { id: 'operador-de-pistola', label: 'Operador de Pistola' },
];

export const findCourseBySlug = (slug: string): Course | undefined =>
  coursesCatalog.find((c) => c.slug === slug);

export const getCoursesByCategory = (category: CourseCategory): Course[] =>
  coursesCatalog.filter((c) => c.category === category);

export const buildWhatsAppLink = (number: string, message: string): string =>
  `https://wa.me/${number}?text=${encodeURIComponent(message)}`;

export const WHATSAPP_DISPLAY_NUMBER = WHATSAPP_DISPLAY;