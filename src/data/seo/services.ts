export interface SeoService {
  slug: string;
  name: string;
  /** Use {city} as placeholder */
  titleTemplate: string;
  /** Use {city} as placeholder */
  descriptionTemplate: string;
  /** Primary content paragraph — use {city} */
  contentTemplate: string;
  /** H1 prefix before city name */
  h1Prefix: string;
  /** Related internal links (static, city-independent) */
  relatedSlugs: string[];
}

export const services: SeoService[] = [
  {
    slug: "infraestrutura-ti",
    name: "Infraestrutura de TI",
    titleTemplate: "Infraestrutura de TI em {city} | WMTi Tecnologia da Informação",
    descriptionTemplate:
      "Soluções de infraestrutura de TI corporativa para empresas em {city}. Servidores, redes, segurança e suporte técnico especializado. Conheça a WMTi.",
    h1Prefix: "Infraestrutura de TI em ",
    contentTemplate:
      "A WMTi Tecnologia da Informação oferece soluções profissionais de infraestrutura de TI para empresas em {city}. Com mais de 15 anos de experiência, projetamos e implementamos ambientes corporativos com servidores Dell PowerEdge, redes estruturadas, firewall pfSense, backup automatizado e monitoramento 24/7. Nossa equipe garante estabilidade, segurança e desempenho para a operação da sua empresa em {city}.",
    relatedSlugs: ["servidores-dell", "seguranca-rede", "monitoramento-rede"],
  },
  {
    slug: "suporte-ti",
    name: "Suporte de TI",
    titleTemplate: "Suporte de TI em {city} | WMTi Tecnologia da Informação",
    descriptionTemplate:
      "Suporte técnico de TI especializado para empresas em {city}. Atendimento remoto e presencial com SLA garantido. Conheça a WMTi.",
    h1Prefix: "Suporte de TI em ",
    contentTemplate:
      "A WMTi oferece suporte técnico de TI especializado para empresas em {city}. Nosso time atua de forma remota e presencial, com SLA garantido por contrato, monitoramento proativo e gestão completa do parque tecnológico. Mais de 15 anos ajudando empresas em {city} a manter seus sistemas funcionando com segurança e eficiência.",
    relatedSlugs: ["infraestrutura-ti", "monitoramento-rede", "microsoft-365"],
  },
  {
    slug: "monitoramento-rede",
    name: "Monitoramento de Rede",
    titleTemplate: "Monitoramento de Rede em {city} | WMTi Tecnologia da Informação",
    descriptionTemplate:
      "Monitoramento de rede corporativa 24/7 para empresas em {city}. Prevenção de falhas, alertas em tempo real e suporte especializado. WMTi.",
    h1Prefix: "Monitoramento de Rede em ",
    contentTemplate:
      "A WMTi realiza monitoramento contínuo de redes corporativas para empresas em {city}. Nosso NOC identifica falhas antes que impactem a operação, com alertas em tempo real, relatórios de desempenho e suporte técnico especializado. Garantimos estabilidade e disponibilidade para a infraestrutura da sua empresa em {city}.",
    relatedSlugs: ["infraestrutura-ti", "seguranca-rede", "suporte-ti"],
  },
  {
    slug: "servidores-dell",
    name: "Servidores Dell PowerEdge",
    titleTemplate: "Servidores Dell PowerEdge em {city} | WMTi Tecnologia da Informação",
    descriptionTemplate:
      "Implantação e suporte de servidores Dell PowerEdge para empresas em {city}. Virtualização, RAID, backup e alta disponibilidade. WMTi.",
    h1Prefix: "Servidores Dell PowerEdge em ",
    contentTemplate:
      "A WMTi é especialista em servidores Dell PowerEdge para empresas em {city}. Realizamos dimensionamento, implantação, configuração de RAID, virtualização com Hyper-V ou VMware, e manutenção preventiva. Servidores corporativos com alta disponibilidade e suporte técnico dedicado para sua empresa em {city}.",
    relatedSlugs: ["infraestrutura-ti", "monitoramento-rede", "seguranca-rede"],
  },
  {
    slug: "microsoft-365",
    name: "Microsoft 365",
    titleTemplate: "Microsoft 365 para Empresas em {city} | WMTi Tecnologia da Informação",
    descriptionTemplate:
      "Implantação e gestão de Microsoft 365 para empresas em {city}. E-mail corporativo, Teams, SharePoint e armazenamento em nuvem. WMTi.",
    h1Prefix: "Microsoft 365 para Empresas em ",
    contentTemplate:
      "A WMTi oferece implantação e gestão completa de Microsoft 365 para empresas em {city}. Configuramos e-mail corporativo com Exchange Online, Microsoft Teams, SharePoint, OneDrive e políticas de segurança. Mais de 15 anos de experiência ajudando empresas em {city} a migrar para a nuvem com segurança.",
    relatedSlugs: ["suporte-ti", "seguranca-rede", "infraestrutura-ti"],
  },
  {
    slug: "seguranca-rede",
    name: "Segurança de Rede",
    titleTemplate: "Segurança de Rede em {city} | WMTi Tecnologia da Informação",
    descriptionTemplate:
      "Segurança de rede empresarial em {city}. Firewall pfSense, antivírus corporativo, VPN e proteção contra ataques. WMTi.",
    h1Prefix: "Segurança de Rede em ",
    contentTemplate:
      "A WMTi implementa soluções de segurança de rede para empresas em {city}. Firewall pfSense, antivírus corporativo ESET, VPN segura, controle de acesso e monitoramento contra ameaças. Proteja a infraestrutura da sua empresa em {city} com quem tem mais de 15 anos de experiência em segurança digital.",
    relatedSlugs: ["infraestrutura-ti", "monitoramento-rede", "servidores-dell"],
  },
  {
    slug: "locacao-computadores",
    name: "Locação de Computadores",
    titleTemplate: "Locação de Computadores em {city} | WMTi Tecnologia da Informação",
    descriptionTemplate:
      "Locação de computadores Dell para empresas em {city}. Estações profissionais com manutenção e suporte inclusos. WMTi.",
    h1Prefix: "Locação de Computadores em ",
    contentTemplate:
      "A WMTi oferece locação de computadores Dell OptiPlex para empresas em {city}. Estações de trabalho profissionais com manutenção preventiva, suporte técnico e substituição em caso de falha. Reduza custos operacionais e mantenha sua empresa em {city} equipada com tecnologia atualizada.",
    relatedSlugs: ["suporte-ti", "infraestrutura-ti", "microsoft-365"],
  },
];
