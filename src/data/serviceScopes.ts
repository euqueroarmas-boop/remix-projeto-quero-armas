/**
 * WMTi Scope Engine — Source of Truth
 * 
 * Estrutura centralizada de escopos de serviço.
 * Todos os serviços DEVEM ser registrados aqui.
 * 
 * Usado por:
 * - Páginas de serviço (ServiceScopeDisplay)
 * - Checkout (selectedServiceScope)
 * - Geração de contrato (generateObjectClause)
 */

export interface ServiceScope {
  id: string;
  slug: string;
  service_name: string;
  description: string;
  included: string[];
  not_included: string[];
  sla: string;
  frequency: string;
  client_dependencies: string[];
}

/**
 * Factory obrigatória para criação de novos escopos.
 * Valida campos obrigatórios antes de retornar.
 */
export function createServiceScope(scope: ServiceScope): ServiceScope {
  const required: (keyof ServiceScope)[] = ["id", "slug", "service_name", "description", "included", "not_included", "sla", "frequency", "client_dependencies"];
  for (const key of required) {
    const val = scope[key];
    if (val === undefined || val === null || (typeof val === "string" && !val.trim()) || (Array.isArray(val) && val.length === 0)) {
      throw new Error(`[WMTi Scope Engine] Campo obrigatório ausente ou vazio: "${key}" no serviço "${scope.slug}"`);
    }
  }
  console.log(`[WMTi Scope Engine] Service loaded: ${scope.slug}`);
  return scope;
}

/* ═══════════════════════════════════════════════════
   REGISTRO GLOBAL DE ESCOPOS
   ═══════════════════════════════════════════════════ */

export const serviceScopes: ServiceScope[] = [
  createServiceScope({
    id: "srv-admin-servidores",
    slug: "administracao-de-servidores",
    service_name: "Administração de Servidores",
    description: "Gestão, monitoramento, manutenção preventiva e corretiva de servidores físicos e/ou virtuais da CONTRATANTE.",
    included: [
      "Administração de sistemas operacionais Windows Server e/ou Linux",
      "Gerenciamento de usuários, permissões e políticas de acesso",
      "Monitoramento de desempenho e disponibilidade",
      "Manutenção preventiva e atualizações de segurança",
      "Backup de configurações do servidor",
      "Suporte remoto para incidentes relacionados aos servidores",
    ],
    not_included: [
      "Aquisição de hardware ou licenças de software",
      "Migração de servidores não prevista em escopo",
      "Suporte a estações de trabalho ou periféricos",
      "Projetos de implantação de novos servidores",
      "Cabeamento estruturado ou infraestrutura física",
    ],
    sla: "Atendimento em até 4 horas úteis para incidentes críticos; 8 horas úteis para demais chamados",
    frequency: "Contínua, com monitoramento 24/7 e intervenções conforme demanda",
    client_dependencies: [
      "Fornecer acesso remoto seguro aos servidores",
      "Manter infraestrutura elétrica e de rede operacional",
      "Informar alterações no ambiente que impactem os servidores",
    ],
  }),

  createServiceScope({
    id: "srv-monitoramento-rede",
    slug: "monitoramento-de-rede",
    service_name: "Monitoramento de Rede",
    description: "Acompanhamento proativo da infraestrutura de rede, incluindo switches, roteadores, firewalls, links de internet e demais ativos.",
    included: [
      "Monitoramento contínuo de disponibilidade e performance",
      "Alertas automáticos de indisponibilidade",
      "Análise de desempenho e latência",
      "Relatórios periódicos de saúde da rede",
      "Suporte remoto para incidentes de rede",
      "Gestão de configurações de ativos monitorados",
    ],
    not_included: [
      "Aquisição ou substituição de equipamentos de rede",
      "Instalação física de novos ativos",
      "Cabeamento estruturado",
      "Serviços em servidores ou estações de trabalho",
      "Gestão de contratos com operadoras de internet",
    ],
    sla: "Alerta em até 5 minutos para indisponibilidade; resposta em até 2 horas úteis",
    frequency: "Contínua, 24/7",
    client_dependencies: [
      "Fornecer acesso remoto à infraestrutura de rede",
      "Manter topologia de rede documentada e atualizada",
      "Comunicar previamente manutenções programadas",
    ],
  }),

  createServiceScope({
    id: "srv-backup",
    slug: "backup-corporativo",
    service_name: "Backup Corporativo",
    description: "Configuração, monitoramento e verificação periódica das rotinas de backup dos dados da CONTRATANTE.",
    included: [
      "Configuração de rotinas de backup local e/ou em nuvem",
      "Monitoramento diário da execução dos backups",
      "Testes periódicos de restauração",
      "Relatórios de integridade dos dados",
      "Alertas de falha nas rotinas de backup",
      "Ajustes nas políticas de retenção conforme demanda",
    ],
    not_included: [
      "Armazenamento em nuvem (custo do provedor)",
      "Aquisição de mídias de backup físicas",
      "Recuperação de desastres fora do escopo contratado",
      "Backup de dados pessoais de colaboradores",
      "Suporte a estações de trabalho",
    ],
    sla: "Verificação diária; restauração de teste mensal; resposta a falhas em até 4 horas úteis",
    frequency: "Diária (monitoramento), mensal (testes de restauração)",
    client_dependencies: [
      "Fornecer infraestrutura de armazenamento adequada",
      "Manter acesso remoto seguro ao ambiente",
      "Definir prioridades e políticas de retenção dos dados",
    ],
  }),

  createServiceScope({
    id: "srv-infra-ti",
    slug: "infraestrutura-ti-corporativa-jacarei",
    service_name: "Infraestrutura de TI",
    description: "Gestão completa da infraestrutura de tecnologia da informação, incluindo manutenção preventiva e corretiva de ativos.",
    included: [
      "Manutenção preventiva de estações de trabalho e servidores",
      "Manutenção corretiva de hardware e software",
      "Gestão de ativos de rede (switches, roteadores, access points)",
      "Verificação de cabeamento estruturado existente",
      "Suporte técnico remoto e presencial",
      "Inventário e controle de ativos de TI",
    ],
    not_included: [
      "Aquisição de hardware, software ou licenças",
      "Projetos de implantação de novos ambientes",
      "Desenvolvimento de software ou sistemas",
      "Serviços de telefonia",
      "Suporte a equipamentos pessoais dos colaboradores",
    ],
    sla: "Atendimento presencial em até 8 horas úteis; remoto em até 4 horas úteis",
    frequency: "Contínua, com visitas presenciais conforme plano contratado",
    client_dependencies: [
      "Fornecer acesso físico e remoto ao ambiente",
      "Manter infraestrutura elétrica e climatização adequadas",
      "Designar ponto focal para comunicação",
    ],
  }),

  createServiceScope({
    id: "srv-suporte-ti",
    slug: "suporte-ti-jacarei",
    service_name: "Suporte Técnico de TI",
    description: "Atendimento remoto e/ou presencial para resolução de incidentes e dúvidas técnicas dos colaboradores.",
    included: [
      "Suporte a estações de trabalho (Windows, macOS, Linux)",
      "Suporte a impressoras e periféricos corporativos",
      "Suporte a e-mail corporativo e ferramentas de produtividade",
      "Instalação e atualização de softwares homologados",
      "Resolução de incidentes de conectividade",
      "Orientação técnica aos colaboradores",
    ],
    not_included: [
      "Suporte a equipamentos pessoais dos colaboradores",
      "Desenvolvimento ou customização de software",
      "Projetos de migração ou implantação",
      "Manutenção de servidores (escopo separado)",
      "Suporte a softwares não homologados pela empresa",
    ],
    sla: "Atendimento remoto em até 2 horas úteis; presencial em até 8 horas úteis",
    frequency: "Sob demanda ou contínua conforme plano contratado",
    client_dependencies: [
      "Fornecer lista de softwares homologados",
      "Manter inventário de equipamentos atualizado",
      "Designar responsável para aprovação de chamados",
    ],
  }),

  createServiceScope({
    id: "srv-seguranca-rede",
    slug: "seguranca-de-rede",
    service_name: "Segurança de Rede",
    description: "Configuração, monitoramento e manutenção de firewalls, políticas de segurança e proteção contra ameaças cibernéticas.",
    included: [
      "Gestão de firewall (pfSense, FortiGate ou similar)",
      "Configuração e manutenção de VPN",
      "Gestão de antivírus corporativo",
      "Políticas de acesso e segmentação de rede",
      "Análise de vulnerabilidades periódica",
      "Resposta a incidentes de segurança",
    ],
    not_included: [
      "Aquisição de licenças de software de segurança",
      "Auditoria de segurança com certificação",
      "Pentest realizado por terceiros",
      "Segurança de aplicações web ou sistemas proprietários",
      "Serviços de SOC (Security Operations Center) dedicado",
    ],
    sla: "Resposta a incidentes críticos em até 2 horas; análise de vulnerabilidades trimestral",
    frequency: "Contínua, com revisões mensais de políticas",
    client_dependencies: [
      "Fornecer acesso administrativo aos equipamentos de segurança",
      "Comunicar alterações na infraestrutura que impactem a segurança",
      "Implementar políticas de segurança recomendadas pela CONTRATADA",
    ],
  }),

  createServiceScope({
    id: "srv-terceirizacao",
    slug: "terceirizacao-de-mao-de-obra-ti",
    service_name: "Terceirização de TI",
    description: "Gestão completa do ambiente tecnológico, assumindo todas as funções de TI da CONTRATANTE conforme pacote contratado.",
    included: [
      "Suporte técnico completo (remoto e presencial)",
      "Gestão de infraestrutura de servidores e rede",
      "Monitoramento proativo de todo o ambiente",
      "Backup e segurança de dados",
      "Gestão de fornecedores de TI",
      "Relatórios gerenciais mensais",
    ],
    not_included: [
      "Aquisição de hardware, software ou licenças",
      "Desenvolvimento de sistemas ou aplicações",
      "Serviços de design gráfico ou marketing digital",
      "Serviços de telefonia",
      "Projetos de implantação não previstos no contrato",
    ],
    sla: "Conforme plano contratado — Essential (8h), Professional (4h) ou Enterprise (2h)",
    frequency: "Contínua, com presença conforme plano (semanal, bissemanal ou diária)",
    client_dependencies: [
      "Designar gestor responsável pela comunicação com a CONTRATADA",
      "Fornecer acesso completo ao ambiente de TI",
      "Respeitar recomendações técnicas para manter o ambiente saudável",
    ],
  }),

  createServiceScope({
    id: "srv-locacao",
    slug: "locacao-de-computadores-para-empresas-jacarei",
    service_name: "Locação de Computadores",
    description: "Fornecimento de estações de trabalho corporativas em regime de locação, com manutenção e suporte inclusos.",
    included: [
      "Fornecimento de desktops Dell OptiPlex configurados",
      "Monitor, teclado e mouse inclusos",
      "Manutenção preventiva e corretiva dos equipamentos",
      "Substituição de equipamentos com defeito",
      "Suporte técnico para os equipamentos locados",
      "Seguro contra danos acidentais",
    ],
    not_included: [
      "Softwares e licenças (Microsoft 365, antivírus etc.)",
      "Cabeamento e infraestrutura de rede",
      "Suporte a softwares de terceiros",
      "Periféricos adicionais não previstos",
      "Serviços de TI além do escopo da locação",
    ],
    sla: "Substituição de equipamento defeituoso em até 48 horas úteis",
    frequency: "Contínua durante a vigência do contrato",
    client_dependencies: [
      "Manter infraestrutura elétrica e de rede adequadas",
      "Utilizar os equipamentos conforme boas práticas",
      "Reportar defeitos imediatamente à CONTRATADA",
    ],
  }),

  createServiceScope({
    id: "srv-firewall",
    slug: "firewall-pfsense-jacarei",
    service_name: "Firewall pfSense",
    description: "Implantação, configuração e gestão contínua de firewall pfSense para proteção do perímetro de rede.",
    included: [
      "Instalação e configuração do pfSense",
      "Regras de firewall personalizadas",
      "Configuração de VPN (site-to-site e client-to-site)",
      "Monitoramento de tráfego e logs",
      "Atualizações de segurança do pfSense",
      "Suporte remoto para incidentes",
    ],
    not_included: [
      "Hardware do appliance (pode ser locado separadamente)",
      "Links de internet ou serviços de provedor",
      "Segurança de endpoints (antivírus)",
      "Cabeamento estruturado",
      "Suporte a firewalls de outros fabricantes",
    ],
    sla: "Resposta a incidentes críticos em até 2 horas úteis",
    frequency: "Contínua, com revisões mensais de regras",
    client_dependencies: [
      "Fornecer hardware compatível ou contratar locação",
      "Manter acesso remoto à rede para gestão",
      "Comunicar alterações na topologia de rede",
    ],
  }),

  createServiceScope({
    id: "srv-microsoft365",
    slug: "microsoft-365-para-empresas-jacarei",
    service_name: "Microsoft 365",
    description: "Implantação, gestão e suporte contínuo do ambiente Microsoft 365 (Exchange, Teams, SharePoint, OneDrive).",
    included: [
      "Configuração de contas e licenças M365",
      "Gestão de Exchange Online (e-mail corporativo)",
      "Configuração de Teams e SharePoint",
      "Migração de e-mail (POP/IMAP/Exchange on-premises)",
      "Políticas de segurança e conformidade",
      "Suporte técnico para ferramentas M365",
    ],
    not_included: [
      "Custo das licenças Microsoft 365",
      "Desenvolvimento de soluções Power Platform",
      "Treinamento de usuários (disponível como serviço adicional)",
      "Suporte a softwares de terceiros integrados ao M365",
      "Consultoria de governança de dados",
    ],
    sla: "Atendimento remoto em até 4 horas úteis",
    frequency: "Contínua, com gestão mensal de licenças e revisão trimestral de políticas",
    client_dependencies: [
      "Fornecer credenciais de administrador do tenant M365",
      "Comunicar admissões e desligamentos para gestão de licenças",
      "Aprovar políticas de segurança recomendadas",
    ],
  }),

  createServiceScope({
    id: "srv-suporte-linux",
    slug: "suporte-linux",
    service_name: "Suporte Linux",
    description: "Suporte técnico especializado para ambientes Linux corporativos, incluindo servidores e estações de trabalho.",
    included: [
      "Administração de servidores Linux (Ubuntu, CentOS, Debian etc.)",
      "Configuração de serviços (Apache, Nginx, Samba, DNS, DHCP)",
      "Gestão de permissões e usuários",
      "Atualizações e patches de segurança",
      "Monitoramento de desempenho e logs",
      "Suporte remoto para incidentes",
    ],
    not_included: [
      "Desenvolvimento de scripts ou automações sob medida",
      "Migração de Windows para Linux",
      "Suporte a distribuições não empresariais",
      "Suporte a ambientes de desenvolvimento (Docker, Kubernetes)",
      "Consultoria de arquitetura de soluções",
    ],
    sla: "Atendimento remoto em até 4 horas úteis",
    frequency: "Contínua ou sob demanda conforme plano",
    client_dependencies: [
      "Fornecer acesso SSH seguro aos servidores",
      "Manter documentação do ambiente atualizada",
      "Aprovar janelas de manutenção para atualizações",
    ],
  }),

  createServiceScope({
    id: "srv-windows-server",
    slug: "suporte-windows-server",
    service_name: "Suporte Windows Server",
    description: "Suporte técnico especializado para ambientes Windows Server, incluindo Active Directory, GPO, DHCP, DNS e File Server.",
    included: [
      "Administração de Windows Server (2016, 2019, 2022)",
      "Gestão de Active Directory e Group Policy",
      "Configuração de DHCP, DNS e File Server",
      "Atualizações de segurança e patches",
      "Monitoramento de desempenho e eventos",
      "Suporte remoto para incidentes",
    ],
    not_included: [
      "Licenciamento do Windows Server e CALs",
      "Migração entre versões (projeto separado)",
      "Suporte a aplicações de terceiros hospedadas no servidor",
      "Implementação de clusters ou alta disponibilidade",
      "Consultoria de arquitetura",
    ],
    sla: "Atendimento remoto em até 4 horas úteis; incidentes críticos em até 2 horas",
    frequency: "Contínua, com manutenção preventiva mensal",
    client_dependencies: [
      "Fornecer acesso remoto seguro (RDP/VPN)",
      "Manter licenciamento em dia",
      "Comunicar alterações no ambiente que impactem os servidores",
    ],
  }),

  createServiceScope({
    id: "srv-montagem-redes",
    slug: "montagem-de-redes",
    service_name: "Montagem de Redes",
    description: "Projeto e execução de cabeamento estruturado e montagem de infraestrutura de rede corporativa.",
    included: [
      "Projeto de rede conforme normas ABNT",
      "Instalação de cabeamento estruturado (Cat5e/Cat6)",
      "Instalação de racks, patch panels e organizadores",
      "Configuração de switches e roteadores",
      "Identificação e certificação de pontos de rede",
      "Documentação técnica da rede instalada",
    ],
    not_included: [
      "Obras civis (quebrar paredes, passar eletrodutos)",
      "Fornecimento de mobiliário (mesas, cadeiras)",
      "Serviços de elétrica e climatização",
      "Gestão contínua da rede após entrega (serviço separado)",
      "Instalação de CFTV ou telefonia",
    ],
    sla: "Execução conforme cronograma aprovado; garantia de 12 meses sobre a instalação",
    frequency: "Projeto pontual com prazo definido",
    client_dependencies: [
      "Fornecer acesso ao local durante a execução",
      "Aprovar projeto técnico antes da instalação",
      "Garantir infraestrutura elétrica pronta para os equipamentos",
    ],
  }),

  createServiceScope({
    id: "srv-reestruturacao-rede",
    slug: "reestruturacao-de-rede",
    service_name: "Reestruturação de Rede",
    description: "Análise, diagnóstico e reestruturação da infraestrutura de rede existente para melhorar performance e segurança.",
    included: [
      "Diagnóstico completo da infraestrutura de rede atual",
      "Análise de gargalos e pontos de falha",
      "Projeto de reestruturação com recomendações",
      "Execução da reestruturação aprovada",
      "Reconfiguração de switches, VLANs e roteamento",
      "Documentação técnica atualizada",
    ],
    not_included: [
      "Aquisição de novos equipamentos de rede",
      "Obras civis ou adaptações físicas",
      "Migração de servidores ou aplicações",
      "Serviços de provedor de internet",
      "Gestão contínua pós-reestruturação (serviço separado)",
    ],
    sla: "Diagnóstico em até 5 dias úteis; execução conforme cronograma aprovado",
    frequency: "Projeto pontual",
    client_dependencies: [
      "Fornecer acesso a todos os pontos de rede e equipamentos",
      "Disponibilizar janela de manutenção para a reestruturação",
      "Aprovar projeto e cronograma antes da execução",
    ],
  }),

  createServiceScope({
    id: "srv-monitoramento-servidores",
    slug: "monitoramento-de-servidores",
    service_name: "Monitoramento de Servidores",
    description: "Monitoramento proativo de servidores físicos e virtuais, com alertas em tempo real e relatórios de disponibilidade.",
    included: [
      "Monitoramento 24/7 de CPU, memória, disco e rede",
      "Alertas automáticos por e-mail e/ou WhatsApp",
      "Dashboard de status em tempo real",
      "Relatórios mensais de disponibilidade",
      "Análise de tendências e previsão de capacidade",
      "Resposta a alertas críticos",
    ],
    not_included: [
      "Administração dos servidores (serviço separado)",
      "Manutenção corretiva de hardware",
      "Backup dos dados dos servidores",
      "Suporte a aplicações rodando nos servidores",
      "Monitoramento de estações de trabalho",
    ],
    sla: "Alerta em até 5 minutos; resposta a incidentes críticos em até 1 hora",
    frequency: "Contínua, 24/7",
    client_dependencies: [
      "Fornecer acesso SNMP/agente de monitoramento nos servidores",
      "Manter rede estável para comunicação com o sistema de monitoramento",
      "Informar manutenções programadas para evitar alertas falsos",
    ],
  }),

  createServiceScope({
    id: "srv-suporte-redes-corp",
    slug: "suporte-redes-corporativas",
    service_name: "Suporte a Redes Corporativas",
    description: "Suporte técnico especializado para redes corporativas, incluindo diagnóstico, manutenção e otimização de infraestrutura de rede.",
    included: [
      "Diagnóstico e resolução de problemas de rede",
      "Manutenção de switches, roteadores e access points",
      "Otimização de VLANs e segmentação de rede",
      "Suporte a Wi-Fi corporativo",
      "Gestão de endereçamento IP",
      "Suporte remoto e presencial",
    ],
    not_included: [
      "Aquisição de equipamentos de rede",
      "Cabeamento estruturado (projeto separado)",
      "Gestão de firewalls (serviço separado)",
      "Serviços de provedor de internet",
      "Suporte a equipamentos pessoais",
    ],
    sla: "Atendimento remoto em até 4 horas úteis; presencial em até 8 horas úteis",
    frequency: "Contínua ou sob demanda conforme plano",
    client_dependencies: [
      "Fornecer acesso aos equipamentos de rede",
      "Manter documentação de topologia atualizada",
      "Designar responsável para acompanhar intervenções presenciais",
    ],
  }),

  createServiceScope({
    id: "srv-dev-web",
    slug: "desenvolvimento-web",
    service_name: "Desenvolvimento Web",
    description: "Criação e manutenção de sites, sistemas web e landing pages corporativas sob medida.",
    included: [
      "Desenvolvimento de sites institucionais responsivos",
      "Criação de landing pages otimizadas para conversão",
      "Desenvolvimento de sistemas web sob medida",
      "SEO técnico on-page",
      "Hospedagem e publicação",
      "Manutenção corretiva por 90 dias após entrega",
    ],
    not_included: [
      "Criação de conteúdo textual (copywriting)",
      "Produção fotográfica ou de vídeo",
      "Gestão de redes sociais ou marketing digital",
      "Integrações com ERPs complexos (orçamento separado)",
      "Suporte contínuo após o período de garantia",
    ],
    sla: "Entrega conforme cronograma aprovado; resposta a bugs críticos em até 24 horas",
    frequency: "Projeto pontual com prazo definido",
    client_dependencies: [
      "Fornecer conteúdo textual e imagens para o site",
      "Aprovar wireframes e layouts antes do desenvolvimento",
      "Definir responsável para validações e homologação",
    ],
  }),

  createServiceScope({
    id: "srv-automacao-ia",
    slug: "automacao-ia",
    service_name: "Automação com IA",
    description: "Consultoria e implementação de soluções de automação utilizando inteligência artificial para processos corporativos.",
    included: [
      "Diagnóstico de processos automatizáveis",
      "Implementação de chatbots e assistentes virtuais",
      "Automação de fluxos de trabalho com IA",
      "Integração com ferramentas existentes",
      "Treinamento básico da equipe",
      "Suporte por 30 dias após implantação",
    ],
    not_included: [
      "Desenvolvimento de modelos de IA personalizados",
      "Custos de APIs e plataformas de IA (OpenAI, Google etc.)",
      "Consultoria de dados e data science",
      "Implantação de RPA em larga escala",
      "Suporte contínuo após o período de garantia",
    ],
    sla: "Entrega conforme cronograma aprovado",
    frequency: "Projeto pontual",
    client_dependencies: [
      "Definir processos prioritários para automação",
      "Fornecer acesso aos sistemas a serem integrados",
      "Designar responsável para validação dos resultados",
    ],
  }),

  createServiceScope({
    id: "srv-automacao-alexa",
    slug: "automacao-alexa",
    service_name: "Automação com Alexa",
    description: "Implantação de automação residencial e corporativa utilizando dispositivos Amazon Alexa e ecossistema smart home.",
    included: [
      "Configuração de dispositivos Alexa",
      "Integração com dispositivos smart home (lâmpadas, tomadas etc.)",
      "Criação de rotinas e automações personalizadas",
      "Configuração de controle por voz",
      "Treinamento de uso",
      "Suporte por 15 dias após implantação",
    ],
    not_included: [
      "Aquisição de dispositivos Alexa e smart home",
      "Instalação elétrica ou cabeamento",
      "Desenvolvimento de skills personalizadas",
      "Integração com sistemas de automação industrial",
      "Suporte contínuo após o período de garantia",
    ],
    sla: "Implantação conforme agendamento; suporte remoto em até 24 horas",
    frequency: "Projeto pontual",
    client_dependencies: [
      "Fornecer rede Wi-Fi estável e com boa cobertura",
      "Adquirir dispositivos compatíveis previamente",
      "Definir cenários de automação desejados",
    ],
  }),

  createServiceScope({
    id: "srv-suporte-emergencial",
    slug: "suporte-emergencial",
    service_name: "Suporte Emergencial",
    description: "Atendimento técnico de urgência para incidentes críticos que paralisam a operação da empresa.",
    included: [
      "Atendimento remoto imediato",
      "Diagnóstico e resolução de incidentes críticos",
      "Recuperação de servidores e serviços",
      "Restauração de backups de emergência",
      "Comunicação em tempo real sobre o andamento",
      "Relatório pós-incidente",
    ],
    not_included: [
      "Projetos de prevenção ou reestruturação",
      "Aquisição de hardware ou peças de reposição",
      "Suporte a softwares de terceiros",
      "Atendimentos recorrentes (contratar plano de suporte)",
      "Garantia de restauração de dados sem backup prévio",
    ],
    sla: "Primeiro contato em até 30 minutos; resolução conforme complexidade do incidente",
    frequency: "Sob demanda (avulso)",
    client_dependencies: [
      "Fornecer acesso remoto imediato ao ambiente",
      "Disponibilizar responsável para acompanhamento",
      "Autorizar intervenções emergenciais necessárias",
    ],
  }),

  createServiceScope({
    id: "srv-servidores-dell",
    slug: "servidores-dell",
    service_name: "Servidores Dell",
    description: "Consultoria, implantação e suporte para servidores Dell PowerEdge em ambiente corporativo.",
    included: [
      "Consultoria para dimensionamento de servidor",
      "Instalação e configuração de servidores Dell PowerEdge",
      "Configuração de RAID, iDRAC e gerenciamento remoto",
      "Instalação de sistema operacional (Windows Server ou Linux)",
      "Migração de dados do servidor anterior",
      "Suporte por 30 dias após implantação",
    ],
    not_included: [
      "Aquisição do servidor e componentes (orçamento separado)",
      "Licenciamento de software (Windows Server CALs etc.)",
      "Cabeamento e infraestrutura de rede",
      "Climatização e infraestrutura do datacenter",
      "Suporte contínuo após o período de garantia",
    ],
    sla: "Implantação conforme cronograma; suporte pós-implantação em até 4 horas úteis",
    frequency: "Projeto pontual + suporte de 30 dias",
    client_dependencies: [
      "Fornecer local adequado para instalação do servidor (rack, energia, refrigeração)",
      "Aprovar configuração de hardware antes da aquisição",
      "Definir políticas de acesso e segurança",
    ],
  }),

  createServiceScope({
    id: "srv-manutencao-infra",
    slug: "manutencao-infraestrutura",
    service_name: "Manutenção de Infraestrutura",
    description: "Serviço contínuo de manutenção preventiva e corretiva da infraestrutura de TI da CONTRATANTE.",
    included: [
      "Visitas técnicas periódicas conforme plano",
      "Limpeza e manutenção preventiva de equipamentos",
      "Verificação de cabeamento e conexões",
      "Atualização de firmwares e drivers",
      "Relatório de cada visita técnica",
      "Suporte remoto entre visitas",
    ],
    not_included: [
      "Peças de reposição e componentes",
      "Aquisição de novos equipamentos",
      "Projetos de reestruturação ou implantação",
      "Suporte a softwares de terceiros",
      "Serviços de cabeamento estruturado",
    ],
    sla: "Visitas conforme plano (semanal, quinzenal ou mensal); suporte remoto em até 4 horas úteis",
    frequency: "Periódica conforme plano contratado",
    client_dependencies: [
      "Garantir acesso ao ambiente durante as visitas",
      "Manter inventário de equipamentos atualizado",
      "Comunicar previamente alterações no ambiente",
    ],
  }),
];

/* ═══════════════════════════════════════════════════
   LOOKUP FUNCTIONS
   ═══════════════════════════════════════════════════ */

/**
 * Busca um escopo por slug. Retorna undefined se não encontrado.
 */
export function getServiceScopeBySlug(slug: string): ServiceScope | undefined {
  return serviceScopes.find(s => s.slug === slug);
}

/**
 * Busca um escopo por ID. Retorna undefined se não encontrado.
 */
export function getServiceScopeById(id: string): ServiceScope | undefined {
  return serviceScopes.find(s => s.id === id);
}

/**
 * Valida se um slug possui escopo completo.
 * Retorna true/false e loga erro se incompleto.
 */
export function validateServiceScope(slug: string): boolean {
  const scope = getServiceScopeBySlug(slug);
  if (!scope) {
    console.error(`[WMTi Scope Engine] Service scope incomplete — publishing blocked: "${slug}"`);
    return false;
  }
  console.log(`[WMTi Scope Engine] Scope validated: ${slug}`);
  return true;
}

/**
 * Gera a cláusula do objeto do contrato a partir do escopo do serviço.
 */
export function generateObjectClause(scope: ServiceScope): string {
  const includedList = scope.included.map(i => `• ${i}`).join("\n");
  const notIncludedList = scope.not_included.map(i => `• ${i}`).join("\n");
  const depsList = scope.client_dependencies.map(d => `• ${d}`).join("\n");

  const clause = `O presente contrato tem por objeto a prestação do serviço de ${scope.service_name}, consistente em:

${scope.description}

Inclui-se no escopo:
${includedList}

Não estão inclusos:
${notIncludedList}

O serviço será prestado na modalidade ${scope.frequency}, com SLA de:
${scope.sla}

São responsabilidades da CONTRATANTE:
${depsList}`;

  console.log(`[WMTi Scope Engine] Contract generated: ${scope.slug}`);
  return clause;
}
