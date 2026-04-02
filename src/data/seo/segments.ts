export interface SeoSegment {
  slug: string;
  name: string;
  /** Use {city} and {service} as placeholders */
  titleSuffix: string;
  descriptionExtra: string;
  painPoints: string[];
  faqExtra: { question: string; answer: string };
  /** Dedicated page URL (if exists) */
  dedicatedPage?: string;
}

export const segments: SeoSegment[] = [
  {
    slug: "serventias-notariais",
    name: "Serventias Notariais",
    titleSuffix: "para Serventias Notariais",
    descriptionExtra:
      "Atendemos serventias notariais com foco em conformidade com o Provimento 213 do CNJ, garantindo segurança de dados, backup automatizado e infraestrutura homologada.",
    painPoints: [
      "Dificuldade em se adequar ao Provimento 213 do CNJ",
      "Falta de backup automatizado e seguro",
      "Sistemas lentos prejudicando o atendimento ao público",
    ],
    faqExtra: {
      question: "A WMTi atende serventias notariais com adequação ao Provimento 213?",
      answer:
        "Sim. Somos especialistas em infraestrutura de TI para cartórios, com soluções homologadas e em conformidade com o Provimento 213 do CNJ.",
    },
    dedicatedPage: "/ti-para-serventias-cartoriais",
  },
  {
    slug: "tabelionatos-notas",
    name: "Tabelionatos de Notas",
    titleSuffix: "para Tabelionatos de Notas",
    descriptionExtra:
      "Infraestrutura de TI especializada para tabelionatos de notas com conformidade ao Provimento 213 do CNJ, backup automatizado, firewall, monitoramento e continuidade operacional.",
    painPoints: [
      "Parada operacional por falha tecnológica sem plano de continuidade",
      "Backup que nunca foi testado — risco real de perda de acervo",
      "Ausência de conformidade com o Provimento 213 do CNJ",
    ],
    faqExtra: {
      question: "A WMTi atende tabelionatos de notas?",
      answer:
        "Sim. Somos especialistas em infraestrutura de TI para tabelionatos de notas, com soluções em conformidade com o Provimento 213 do CNJ e foco em continuidade operacional e segurança do acervo digital.",
    },
    dedicatedPage: "/ti-para-tabelionatos-de-notas",
  },
  {
    slug: "hospitais",
    name: "Hospitais e Clínicas",
    titleSuffix: "para Hospitais e Clínicas",
    descriptionExtra:
      "Soluções de TI para o setor de saúde com foco em alta disponibilidade, LGPD, sistemas HIS/PACS e continuidade operacional 24/7.",
    painPoints: [
      "Sistemas médicos instáveis comprometendo atendimento",
      "Falta de conformidade com a LGPD",
      "Ausência de redundância e plano de contingência",
    ],
    faqExtra: {
      question: "A WMTi atende hospitais e clínicas?",
      answer:
        "Sim. Oferecemos infraestrutura de TI dimensionada para ambientes de saúde com alta disponibilidade, integração com sistemas HIS/PACS e conformidade com a LGPD.",
    },
    dedicatedPage: "/ti-para-hospitais-e-clinicas",
  },
  {
    slug: "escritorios-advocacia",
    name: "Escritórios de Advocacia",
    titleSuffix: "para Escritórios de Advocacia",
    descriptionExtra:
      "Infraestrutura segura para escritórios de advocacia com proteção de dados sensíveis, VPN, backup criptografado e suporte especializado.",
    painPoints: [
      "Risco de vazamento de dados confidenciais de clientes",
      "Falta de VPN segura para acesso remoto",
      "Sistemas jurídicos lentos ou incompatíveis",
    ],
    faqExtra: {
      question: "A WMTi atende escritórios de advocacia?",
      answer:
        "Sim. Oferecemos soluções de TI sob medida para escritórios de advocacia, com foco em sigilo, segurança de dados e suporte técnico dedicado.",
    },
    dedicatedPage: "/ti-para-escritorios-de-advocacia",
  },
  {
    slug: "contabilidade",
    name: "Escritórios de Contabilidade",
    titleSuffix: "para Escritórios de Contabilidade",
    descriptionExtra:
      "TI corporativa para escritórios de contabilidade com servidores seguros, backup fiscal automatizado e integração com sistemas contábeis.",
    painPoints: [
      "Perda de dados fiscais por falta de backup",
      "Lentidão em sistemas contábeis durante fechamento",
      "Falta de segurança para dados financeiros de clientes",
    ],
    faqExtra: {
      question: "A WMTi atende escritórios de contabilidade?",
      answer:
        "Sim. Oferecemos infraestrutura de TI otimizada para escritórios contábeis, com backup automatizado, segurança de dados fiscais e suporte técnico.",
    },
    dedicatedPage: "/ti-para-contabilidades",
  },
  {
    slug: "industrias-alimenticias",
    name: "Indústrias Alimentícias",
    titleSuffix: "para Indústrias Alimentícias",
    descriptionExtra:
      "Soluções de TI para indústrias alimentícias com redes segmentadas, servidores de alta performance, monitoramento 24/7, conformidade com normas sanitárias e integração com sistemas ERP.",
    painPoints: [
      "Rede industrial instável afetando linhas de produção",
      "Falta de integração entre TI e sistemas de rastreabilidade",
      "Ausência de monitoramento proativo da infraestrutura",
    ],
    faqExtra: {
      question: "A WMTi atende indústrias alimentícias?",
      answer:
        "Sim. Atendemos indústrias alimentícias com infraestrutura de TI robusta, redes segmentadas, servidores de alta performance e suporte técnico especializado para ambientes de produção.",
    },
    dedicatedPage: "/ti-para-industrias-alimenticias",
  },
  {
    slug: "industrias-petroliferas",
    name: "Indústrias Petrolíferas",
    titleSuffix: "para Indústrias Petrolíferas",
    descriptionExtra:
      "Soluções de TI para indústrias petrolíferas e de energia com infraestrutura resiliente, segurança de dados, redes industriais segmentadas e conformidade regulatória.",
    painPoints: [
      "Infraestrutura de TI vulnerável em ambientes industriais críticos",
      "Falta de redundância e plano de contingência para operações 24/7",
      "Ausência de segmentação entre rede corporativa e rede operacional",
    ],
    faqExtra: {
      question: "A WMTi atende indústrias petrolíferas?",
      answer:
        "Sim. Oferecemos soluções de TI dimensionadas para indústrias petrolíferas, com infraestrutura resiliente, segurança avançada e suporte técnico especializado para operações contínuas.",
    },
    dedicatedPage: "/ti-para-industrias-petroliferas",
  },
  {
    slug: "empresas-corporativas",
    name: "Empresas Corporativas",
    titleSuffix: "para Empresas Corporativas",
    descriptionExtra:
      "Soluções completas de TI corporativa com servidores Dell PowerEdge, redes segmentadas, backup automatizado, firewall e monitoramento 24/7.",
    painPoints: [
      "Servidores instáveis comprometendo a operação",
      "Rede corporativa sem segmentação adequada",
      "Falta de backup e monitoramento proativo",
    ],
    faqExtra: {
      question: "A WMTi atende empresas corporativas?",
      answer:
        "Sim. Oferecemos soluções completas de infraestrutura de TI para empresas de médio e grande porte em todo o Brasil.",
    },
    dedicatedPage: "/ti-para-escritorios-corporativos",
  },
];
