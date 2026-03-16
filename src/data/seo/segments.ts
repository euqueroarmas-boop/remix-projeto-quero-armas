export interface SeoSegment {
  slug: string;
  name: string;
  /** Use {city} and {service} as placeholders */
  titleSuffix: string;
  descriptionExtra: string;
  painPoints: string[];
  faqExtra: { question: string; answer: string };
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
  },
  {
    slug: "industrias",
    name: "Indústrias",
    titleSuffix: "para Indústrias",
    descriptionExtra:
      "Soluções de TI industrial com redes segmentadas, servidores de alta performance, monitoramento 24/7 e integração com sistemas ERP.",
    painPoints: [
      "Rede industrial instável afetando produção",
      "Falta de integração entre TI e sistemas de produção",
      "Ausência de monitoramento proativo da infraestrutura",
    ],
    faqExtra: {
      question: "A WMTi atende indústrias?",
      answer:
        "Sim. Atendemos indústrias com infraestrutura de TI robusta, redes segmentadas, servidores de alta performance e suporte técnico especializado.",
    },
  },
];
