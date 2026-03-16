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
  /** Dedicated page URL (if exists) — used to build canonical */
  dedicatedPage?: string;
}

export const services: SeoService[] = [
  {
    slug: "infraestrutura-ti",
    name: "Infraestrutura De TI Para Empresas",
    titleTemplate: "Infraestrutura de TI em {city} | WMTi Tecnologia da Informação",
    descriptionTemplate:
      "Soluções de infraestrutura de TI corporativa para empresas em {city}. Servidores, redes, segurança e suporte técnico especializado. Conheça a WMTi.",
    h1Prefix: "Infraestrutura de TI em ",
    contentTemplate:
      "A WMTi Tecnologia da Informação oferece soluções profissionais de infraestrutura de TI para empresas em {city}. Com mais de 15 anos de experiência, projetamos e implementamos ambientes corporativos com servidores Dell PowerEdge, redes estruturadas, firewall pfSense, backup automatizado e monitoramento 24/7. Nossa equipe garante estabilidade, segurança e desempenho para a operação da sua empresa em {city}.",
    relatedSlugs: ["servidores-dell", "seguranca-rede", "monitoramento-rede"],
    dedicatedPage: "/infraestrutura-ti-corporativa-jacarei",
  },
  {
    slug: "suporte-ti",
    name: "Suporte Técnico Empresarial",
    titleTemplate: "Suporte Técnico Empresarial em {city} | WMTi Tecnologia da Informação",
    descriptionTemplate:
      "Suporte técnico de TI especializado para empresas em {city}. Atendimento remoto e presencial com SLA garantido. Conheça a WMTi.",
    h1Prefix: "Suporte Técnico Empresarial em ",
    contentTemplate:
      "A WMTi oferece suporte técnico de TI especializado para empresas em {city}. Nosso time atua de forma remota e presencial, com SLA garantido por contrato, monitoramento proativo e gestão completa do parque tecnológico. Mais de 15 anos ajudando empresas em {city} a manter seus sistemas funcionando com segurança e eficiência.",
    relatedSlugs: ["infraestrutura-ti", "monitoramento-rede", "microsoft-365"],
    dedicatedPage: "/suporte-ti-jacarei",
  },
  {
    slug: "monitoramento-rede",
    name: "Monitoramento De Rede",
    titleTemplate: "Monitoramento de Rede em {city} | WMTi Tecnologia da Informação",
    descriptionTemplate:
      "Monitoramento de rede corporativa 24/7 para empresas em {city}. Prevenção de falhas, alertas em tempo real e suporte especializado. WMTi.",
    h1Prefix: "Monitoramento de Rede em ",
    contentTemplate:
      "A WMTi realiza monitoramento contínuo de redes corporativas para empresas em {city}. Nosso NOC identifica falhas antes que impactem a operação, com alertas em tempo real, relatórios de desempenho e suporte técnico especializado. Garantimos estabilidade e disponibilidade para a infraestrutura da sua empresa em {city}.",
    relatedSlugs: ["infraestrutura-ti", "seguranca-rede", "suporte-ti"],
    dedicatedPage: "/monitoramento-de-rede",
  },
  {
    slug: "servidores-dell",
    name: "Implantação De Servidores Dell PowerEdge",
    titleTemplate: "Servidores Dell PowerEdge em {city} | WMTi Tecnologia da Informação",
    descriptionTemplate:
      "Implantação e suporte de servidores Dell PowerEdge para empresas em {city}. Virtualização, RAID, backup e alta disponibilidade. WMTi.",
    h1Prefix: "Servidores Dell PowerEdge em ",
    contentTemplate:
      "A WMTi é especialista em servidores Dell PowerEdge para empresas em {city}. Realizamos dimensionamento, implantação, configuração de RAID, virtualização com Hyper-V ou VMware, e manutenção preventiva. Servidores corporativos com alta disponibilidade e suporte técnico dedicado para sua empresa em {city}.",
    relatedSlugs: ["infraestrutura-ti", "monitoramento-servidores", "administracao-servidores"],
    dedicatedPage: "/servidor-dell-poweredge-jacarei",
  },
  {
    slug: "microsoft-365",
    name: "Administração Microsoft 365",
    titleTemplate: "Microsoft 365 para Empresas em {city} | WMTi Tecnologia da Informação",
    descriptionTemplate:
      "Implantação e gestão de Microsoft 365 para empresas em {city}. E-mail corporativo, Teams, SharePoint e armazenamento em nuvem. WMTi.",
    h1Prefix: "Microsoft 365 para Empresas em ",
    contentTemplate:
      "A WMTi oferece implantação e gestão completa de Microsoft 365 para empresas em {city}. Configuramos e-mail corporativo com Exchange Online, Microsoft Teams, SharePoint, OneDrive e políticas de segurança. Mais de 15 anos de experiência ajudando empresas em {city} a migrar para a nuvem com segurança.",
    relatedSlugs: ["suporte-ti", "seguranca-rede", "infraestrutura-ti"],
    dedicatedPage: "/microsoft-365-para-empresas-jacarei",
  },
  {
    slug: "seguranca-rede",
    name: "Segurança De Rede",
    titleTemplate: "Segurança de Rede em {city} | WMTi Tecnologia da Informação",
    descriptionTemplate:
      "Segurança de rede empresarial em {city}. Firewall pfSense, antivírus corporativo, VPN e proteção contra ataques. WMTi.",
    h1Prefix: "Segurança de Rede em ",
    contentTemplate:
      "A WMTi implementa soluções de segurança de rede para empresas em {city}. Firewall pfSense, antivírus corporativo ESET, VPN segura, controle de acesso e monitoramento contra ameaças. Proteja a infraestrutura da sua empresa em {city} com quem tem mais de 15 anos de experiência em segurança digital.",
    relatedSlugs: ["firewall-corporativo", "monitoramento-rede", "servidores-dell"],
    dedicatedPage: "/seguranca-de-rede",
  },
  {
    slug: "locacao-computadores",
    name: "Locação De Computadores",
    titleTemplate: "Locação de Computadores em {city} | WMTi Tecnologia da Informação",
    descriptionTemplate:
      "Locação de computadores Dell para empresas em {city}. Estações profissionais com manutenção e suporte inclusos. WMTi.",
    h1Prefix: "Locação de Computadores em ",
    contentTemplate:
      "A WMTi oferece locação de computadores Dell OptiPlex para empresas em {city}. Estações de trabalho profissionais com manutenção preventiva, suporte técnico e substituição em caso de falha. Reduza custos operacionais e mantenha sua empresa em {city} equipada com tecnologia atualizada.",
    relatedSlugs: ["suporte-ti", "infraestrutura-ti", "microsoft-365"],
    dedicatedPage: "/locacao-de-computadores-para-empresas-jacarei",
  },
  // ─── New services ───
  {
    slug: "administracao-servidores",
    name: "Administração De Servidores",
    titleTemplate: "Administração de Servidores em {city} | WMTi",
    descriptionTemplate:
      "Administração profissional de servidores Windows Server e Linux para empresas em {city}. Active Directory, GPOs, virtualização e monitoramento.",
    h1Prefix: "Administração de Servidores em ",
    contentTemplate:
      "A WMTi oferece administração profissional de servidores corporativos para empresas em {city}. Gerenciamento completo de Windows Server, Linux, Active Directory, GPOs, virtualização Hyper-V e monitoramento contínuo de performance. Garantimos segurança e disponibilidade para sua infraestrutura em {city}.",
    relatedSlugs: ["servidores-dell", "monitoramento-servidores", "suporte-ti"],
    dedicatedPage: "/administracao-de-servidores",
  },
  {
    slug: "monitoramento-servidores",
    name: "Monitoramento De Servidores",
    titleTemplate: "Monitoramento de Servidores 24/7 em {city} | WMTi",
    descriptionTemplate:
      "Monitoramento contínuo de servidores corporativos em {city}. Alertas em tempo real, dashboards de performance e prevenção de falhas.",
    h1Prefix: "Monitoramento de Servidores em ",
    contentTemplate:
      "A WMTi realiza monitoramento 24/7 de servidores corporativos para empresas em {city}. Identificamos falhas antes que impactem a operação, com alertas em tempo real, dashboards de performance e suporte proativo. Garantimos máxima disponibilidade para seus servidores em {city}.",
    relatedSlugs: ["administracao-servidores", "servidores-dell", "suporte-ti"],
    dedicatedPage: "/monitoramento-de-servidores",
  },
  {
    slug: "backup-corporativo",
    name: "Backup Corporativo",
    titleTemplate: "Backup Corporativo em {city} | Veeam e Nuvem | WMTi",
    descriptionTemplate:
      "Backup corporativo com Veeam para empresas em {city}. Replicação local e em nuvem, estratégia 3-2-1 e recuperação garantida.",
    h1Prefix: "Backup Corporativo em ",
    contentTemplate:
      "A WMTi implementa soluções de backup corporativo com Veeam para empresas em {city}. Estratégia 3-2-1 com replicação local e em nuvem Azure, testes de restauração mensais e criptografia AES-256. Proteja os dados da sua empresa em {city} contra perdas e ransomware.",
    relatedSlugs: ["servidores-dell", "seguranca-rede", "infraestrutura-ti"],
    dedicatedPage: "/backup-corporativo",
  },
  {
    slug: "firewall-corporativo",
    name: "Firewall Corporativo",
    titleTemplate: "Firewall Corporativo em {city} | pfSense | WMTi",
    descriptionTemplate:
      "Implantação de firewall pfSense para empresas em {city}. VPN, IDS/IPS Suricata, segmentação de rede e proteção contra ataques.",
    h1Prefix: "Firewall Corporativo em ",
    contentTemplate:
      "A WMTi implanta firewalls pfSense com IDS/IPS Suricata para empresas em {city}. VPN corporativa, segmentação por VLANs, controle de acesso e proteção contra ataques cibernéticos. Segurança profissional para a infraestrutura da sua empresa em {city}.",
    relatedSlugs: ["seguranca-rede", "monitoramento-rede", "infraestrutura-ti"],
    dedicatedPage: "/firewall-pfsense-jacarei",
  },
  {
    slug: "infraestrutura-rede",
    name: "Infraestrutura De Rede Corporativa",
    titleTemplate: "Infraestrutura de Rede Corporativa em {city} | WMTi",
    descriptionTemplate:
      "Projeto e implantação de redes corporativas em {city}. Cabeamento estruturado, switches gerenciáveis, VLANs e Wi-Fi empresarial.",
    h1Prefix: "Infraestrutura de Rede em ",
    contentTemplate:
      "A WMTi realiza projeto e implantação de redes corporativas para empresas em {city}. Cabeamento estruturado Cat6A, switches Dell gerenciáveis, segmentação por VLANs e Wi-Fi empresarial com cobertura otimizada. Redes profissionais para garantir performance e segurança em {city}.",
    relatedSlugs: ["monitoramento-rede", "seguranca-rede", "firewall-corporativo"],
    dedicatedPage: "/montagem-e-monitoramento-de-redes-jacarei",
  },
  {
    slug: "suporte-emergencial",
    name: "Suporte Técnico Emergencial",
    titleTemplate: "Suporte Técnico Emergencial em {city} | WMTi",
    descriptionTemplate:
      "Suporte técnico emergencial para empresas em {city}. Atendimento imediato para servidores, redes e sistemas. Pagamento por hora.",
    h1Prefix: "Suporte Emergencial em ",
    contentTemplate:
      "Problema urgente na sua empresa em {city}? A WMTi oferece suporte técnico emergencial com atendimento imediato para restaurar servidores, rede e sistemas que pararam de funcionar. Pagamento por hora, sem necessidade de contrato mensal. Atendemos empresas em {city} com prioridade máxima.",
    relatedSlugs: ["suporte-ti", "administracao-servidores", "infraestrutura-ti"],
    dedicatedPage: "/suporte-tecnico-emergencial",
  },
  {
    slug: "suporte-windows-server",
    name: "Suporte Windows Server",
    titleTemplate: "Suporte Windows Server em {city} | WMTi",
    descriptionTemplate:
      "Suporte técnico especializado em Windows Server para empresas em {city}. Active Directory, GPOs, Hyper-V, DNS e DHCP.",
    h1Prefix: "Suporte Windows Server em ",
    contentTemplate:
      "A WMTi oferece suporte especializado em Windows Server para empresas em {city}. Gerenciamento de Active Directory, Group Policies, Hyper-V, DNS, DHCP e File Server. Manutenção preventiva e aplicação de patches de segurança para seus servidores em {city}.",
    relatedSlugs: ["suporte-linux", "administracao-servidores", "servidores-dell"],
    dedicatedPage: "/suporte-windows-server",
  },
  {
    slug: "suporte-linux",
    name: "Suporte Linux",
    titleTemplate: "Suporte Linux Corporativo em {city} | WMTi",
    descriptionTemplate:
      "Suporte técnico especializado em servidores Linux para empresas em {city}. Ubuntu Server, CentOS, Debian, Docker e firewalls.",
    h1Prefix: "Suporte Linux em ",
    contentTemplate:
      "A WMTi oferece suporte técnico em servidores Linux para empresas em {city}. Ubuntu Server, CentOS, Debian, firewalls iptables/nftables, containers Docker e hardening de segurança. Administração profissional de ambientes Linux para sua empresa em {city}.",
    relatedSlugs: ["suporte-windows-server", "administracao-servidores", "firewall-corporativo"],
    dedicatedPage: "/suporte-linux",
  },
  {
    slug: "manutencao-ti",
    name: "Manutenção De Infraestrutura De TI",
    titleTemplate: "Manutenção de Infraestrutura de TI em {city} | WMTi",
    descriptionTemplate:
      "Manutenção preventiva e corretiva de infraestrutura de TI para empresas em {city}. Servidores, redes, firewalls e equipamentos.",
    h1Prefix: "Manutenção de TI em ",
    contentTemplate:
      "A WMTi realiza manutenção preventiva e corretiva de infraestrutura de TI para empresas em {city}. Servidores, redes, firewalls, backup e equipamentos corporativos com atualização de firmware, patches de segurança e otimização de performance. Garantimos estabilidade operacional em {city}.",
    relatedSlugs: ["suporte-ti", "monitoramento-servidores", "infraestrutura-ti"],
    dedicatedPage: "/manutencao-de-infraestrutura-de-ti",
  },
  {
    slug: "suporte-redes-corporativas",
    name: "Suporte Técnico Para Redes Corporativas",
    titleTemplate: "Suporte Para Redes Corporativas em {city} | WMTi",
    descriptionTemplate:
      "Suporte técnico para redes corporativas em {city}. Diagnóstico, manutenção, otimização e monitoramento de switches e access points.",
    h1Prefix: "Suporte Para Redes em ",
    contentTemplate:
      "A WMTi oferece suporte técnico especializado para redes corporativas em {city}. Diagnóstico de falhas, gerenciamento de switches e access points, certificação de cabeamento estruturado e monitoramento contínuo. Suporte profissional para manter a rede da sua empresa em {city} funcionando.",
    relatedSlugs: ["infraestrutura-rede", "monitoramento-rede", "suporte-ti"],
    dedicatedPage: "/suporte-tecnico-para-redes-corporativas",
  },
];
