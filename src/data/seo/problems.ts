export interface SeoProblem {
  slug: string;
  name: string;
  /** H1 template — use {city} */
  h1Template: string;
  description: string;
  painPoints: string[];
  solutionIntro: string;
}

export const problems: SeoProblem[] = [
  {
    slug: "rede-lenta",
    name: "Rede Lenta",
    h1Template: "Rede lenta na sua empresa em {city}?",
    description:
      "Se a rede da sua empresa está lenta, travando ou instável, o problema pode estar na infraestrutura de cabeamento, nos switches, no roteador ou na configuração do firewall. A WMTi diagnostica e resolve problemas de performance de rede com soluções corporativas.",
    painPoints: [
      "Internet lenta mesmo com link de alta velocidade",
      "Quedas constantes de conexão",
      "Demora para acessar sistemas e arquivos na rede",
      "Wi-Fi corporativo instável",
    ],
    solutionIntro:
      "A WMTi realiza um diagnóstico completo da rede e implementa soluções como cabeamento estruturado, switches gerenciáveis, QoS e firewall pfSense para garantir performance e estabilidade.",
  },
  {
    slug: "servidor-travando",
    name: "Servidor Travando",
    h1Template: "Servidor travando na sua empresa em {city}?",
    description:
      "Servidores que travam, reiniciam ou apresentam lentidão comprometem toda a operação da empresa. A WMTi identifica a causa raiz e implementa soluções definitivas.",
    painPoints: [
      "Servidor reiniciando sozinho",
      "Lentidão extrema ao acessar arquivos compartilhados",
      "Erros frequentes em sistemas hospedados no servidor",
      "Servidor sem manutenção preventiva há anos",
    ],
    solutionIntro:
      "Realizamos diagnóstico de hardware e software, atualização de firmware, configuração de RAID, virtualização e, quando necessário, migração para servidores Dell PowerEdge com alta disponibilidade.",
  },
  {
    slug: "sem-backup",
    name: "Sem Backup",
    h1Template: "Sua empresa em {city} não tem backup profissional?",
    description:
      "A ausência de backup profissional coloca em risco todos os dados da empresa. Um incidente como ransomware, falha de disco ou erro humano pode causar perda irreversível de informações.",
    painPoints: [
      "Nenhuma política de backup implementada",
      "Backup manual em HD externo ou pendrive",
      "Sem teste de restauração de backup",
      "Dados críticos sem cópia de segurança em nuvem",
    ],
    solutionIntro:
      "A WMTi implementa políticas de backup automatizado com cópias locais e em nuvem, testes periódicos de restauração e monitoramento contínuo para garantir a integridade dos dados.",
  },
  {
    slug: "ataque-ransomware",
    name: "Ataque Ransomware",
    h1Template: "Proteção contra ransomware para empresas em {city}",
    description:
      "Ataques de ransomware sequestram dados e paralisam empresas inteiras. A WMTi implementa camadas de proteção para prevenir, detectar e responder a esse tipo de ameaça.",
    painPoints: [
      "Funcionários clicando em links maliciosos",
      "Ausência de firewall e antivírus corporativo",
      "Falta de segmentação de rede",
      "Backup inexistente ou desatualizado",
    ],
    solutionIntro:
      "Implementamos firewall pfSense, antivírus corporativo ESET, políticas de acesso, segmentação de rede, backup com cópia offline e treinamento de conscientização para colaboradores.",
  },
  {
    slug: "computadores-lentos",
    name: "Computadores Lentos",
    h1Template: "Computadores lentos na sua empresa em {city}?",
    description:
      "Computadores lentos reduzem a produtividade e geram frustração na equipe. O problema pode estar no hardware desatualizado, no sistema operacional ou na falta de manutenção.",
    painPoints: [
      "Demora para ligar e abrir programas",
      "Travamentos frequentes durante o trabalho",
      "Computadores com mais de 5 anos de uso",
      "Falta de manutenção preventiva",
    ],
    solutionIntro:
      "A WMTi oferece locação de computadores Dell OptiPlex com manutenção inclusa, ou manutenção preventiva do parque existente, garantindo desempenho e produtividade.",
  },
  // ─── New problems ───
  {
    slug: "servidor-lento-empresa",
    name: "Servidor Lento na Empresa",
    h1Template: "Servidor lento na sua empresa em {city}?",
    description:
      "Servidor lento compromete a produtividade de toda a equipe. A WMTi diagnostica gargalos de CPU, memória, disco e rede e implementa soluções definitivas para restaurar a performance.",
    painPoints: [
      "Sistemas hospedados no servidor extremamente lentos",
      "Servidor com CPU ou memória no limite",
      "Discos antigos sem RAID degradando a performance",
      "Falta de monitoramento de recursos do servidor",
    ],
    solutionIntro:
      "A WMTi realiza diagnóstico completo de performance do servidor, otimização de recursos, upgrade de hardware quando necessário e migração para servidores Dell PowerEdge dimensionados.",
  },
  {
    slug: "rede-corporativa-instavel",
    name: "Rede Corporativa Instável",
    h1Template: "Rede corporativa instável na sua empresa em {city}?",
    description:
      "Uma rede corporativa instável causa quedas de conexão, lentidão e interrupções constantes. A WMTi projeta e implementa redes estruturadas com equipamentos gerenciáveis.",
    painPoints: [
      "Quedas frequentes de conexão na rede interna",
      "Switches e roteadores domésticos no ambiente corporativo",
      "Cabeamento sem certificação e sem padrão",
      "Wi-Fi corporativo com cobertura deficiente",
    ],
    solutionIntro:
      "Projetamos redes corporativas com cabeamento estruturado Cat6A, switches Dell gerenciáveis, segmentação por VLANs e Wi-Fi empresarial com cobertura otimizada.",
  },
  {
    slug: "empresa-sem-backup",
    name: "Empresa Sem Backup",
    h1Template: "Sua empresa em {city} está sem backup?",
    description:
      "Operar sem backup profissional é um risco crítico. Uma falha de disco, ataque ransomware ou erro humano pode causar a perda total dos dados da empresa.",
    painPoints: [
      "Nenhuma rotina de backup automatizado",
      "Dados críticos apenas no servidor local sem cópia",
      "Backup em pendrive ou HD externo sem verificação",
      "Sem plano de recuperação de desastres",
    ],
    solutionIntro:
      "Implementamos backup automatizado com Veeam, estratégia 3-2-1, replicação em nuvem Azure e testes periódicos de restauração para garantir a segurança dos dados.",
  },
  {
    slug: "empresa-sem-firewall",
    name: "Empresa Sem Firewall",
    h1Template: "Sua empresa em {city} não tem firewall profissional?",
    description:
      "Sem firewall profissional, a rede da empresa fica exposta a ataques, invasões e acessos não autorizados. A WMTi implanta firewalls pfSense com proteção completa.",
    painPoints: [
      "Rede exposta a ataques externos sem proteção perimetral",
      "Roteador doméstico sendo usado como firewall",
      "Sem controle de acesso à internet por colaboradores",
      "Impossibilidade de criar VPN segura para acesso remoto",
    ],
    solutionIntro:
      "Implantamos firewall pfSense com IDS/IPS Suricata, VPN corporativa, segmentação de rede e controle de acesso para proteger a infraestrutura da empresa.",
  },
  {
    slug: "empresa-com-virus",
    name: "Empresa Com Vírus",
    h1Template: "Computadores da sua empresa em {city} estão com vírus?",
    description:
      "Vírus e malwares comprometem a segurança, a produtividade e podem causar vazamento de dados. A WMTi remove ameaças e implementa proteção corporativa permanente.",
    painPoints: [
      "Computadores infectados com vírus ou malware",
      "Pop-ups e redirecionamentos suspeitos",
      "Lentidão causada por mineradores de criptomoedas",
      "Antivírus gratuito sem proteção efetiva",
    ],
    solutionIntro:
      "Removemos todas as ameaças, implementamos antivírus corporativo ESET com console centralizado e configuramos políticas de segurança para prevenir novas infecções.",
  },
  {
    slug: "empresa-sem-monitoramento-ti",
    name: "Empresa Sem Monitoramento de TI",
    h1Template: "Sua empresa em {city} não monitora a infraestrutura de TI?",
    description:
      "Sem monitoramento, problemas de TI só são descobertos quando já paralisaram a operação. A WMTi implementa monitoramento 24/7 com alertas em tempo real.",
    painPoints: [
      "Problemas descobertos apenas quando já afetam a operação",
      "Sem visibilidade sobre o estado dos servidores e rede",
      "Falta de métricas de performance e disponibilidade",
      "Incapacidade de prever falhas antes que aconteçam",
    ],
    solutionIntro:
      "Implementamos monitoramento contínuo com Zabbix e Grafana, alertas automáticos por e-mail e WhatsApp, e dashboards de performance para prevenção proativa de falhas.",
  },
  {
    slug: "empresa-com-servidor-antigo",
    name: "Empresa Com Servidor Antigo",
    h1Template: "Servidor antigo na sua empresa em {city}?",
    description:
      "Servidores com mais de 5 anos sem atualização representam risco de falha, perda de dados e incompatibilidade com softwares modernos. A WMTi moderniza sua infraestrutura.",
    painPoints: [
      "Servidor com mais de 5 anos de uso sem manutenção",
      "Hardware sem garantia do fabricante",
      "Sistema operacional desatualizado e vulnerável",
      "Performance insuficiente para a demanda atual",
    ],
    solutionIntro:
      "Realizamos a migração segura para servidores Dell PowerEdge modernos com RAID, virtualização Hyper-V, redundância de fontes e suporte técnico dedicado.",
  },
  {
    slug: "empresa-com-problemas-ti",
    name: "Empresa Com Problemas de TI",
    h1Template: "Sua empresa em {city} tem problemas constantes de TI?",
    description:
      "Problemas recorrentes de TI indicam falta de gestão profissional da infraestrutura. A WMTi assume a gestão completa da TI da sua empresa com suporte proativo.",
    painPoints: [
      "Chamados de TI constantes sem resolução definitiva",
      "Falta de profissional de TI dedicado",
      "Infraestrutura montada sem planejamento técnico",
      "Custos altos com técnicos avulsos sem previsibilidade",
    ],
    solutionIntro:
      "Oferecemos gestão completa de TI com equipe dedicada, monitoramento proativo, manutenção preventiva e suporte técnico com SLA definido por contrato.",
  },
  {
    slug: "suporte-ti-urgente",
    name: "Suporte de TI Urgente",
    h1Template: "Precisa de suporte de TI urgente em {city}?",
    description:
      "Quando a TI para, a empresa para. A WMTi oferece suporte técnico emergencial com atendimento imediato para restaurar servidores, rede e sistemas críticos.",
    painPoints: [
      "Servidor parou e a empresa está sem sistema",
      "Rede caiu e ninguém consegue trabalhar",
      "Ataque cibernético em andamento",
      "Falha crítica sem suporte disponível",
    ],
    solutionIntro:
      "Oferecemos suporte emergencial com atendimento imediato, diagnóstico rápido e resolução prioritária de incidentes críticos para restaurar a operação da empresa.",
  },
  {
    slug: "empresa-precisa-suporte-ti",
    name: "Empresa Precisa de Suporte de TI",
    h1Template: "Sua empresa em {city} precisa de suporte de TI profissional?",
    description:
      "Suporte de TI profissional elimina problemas recorrentes, reduz custos e garante estabilidade operacional. A WMTi oferece planos de suporte com SLA garantido.",
    painPoints: [
      "Sem equipe de TI interna para resolver problemas",
      "Técnicos avulsos sem comprometimento com o ambiente",
      "Problemas de TI resolvidos de forma paliativa",
      "Falta de manutenção preventiva no parque tecnológico",
    ],
    solutionIntro:
      "A WMTi oferece planos de suporte técnico corporativo com SLA garantido, monitoramento proativo, manutenção preventiva e equipe dedicada ao ambiente do cliente.",
  },
  {
    slug: "empresa-com-problema-rede",
    name: "Empresa Com Problema na Rede",
    h1Template: "Problema na rede da sua empresa em {city}?",
    description:
      "Problemas de rede afetam diretamente a produtividade e o faturamento da empresa. A WMTi diagnostica e resolve falhas de rede com soluções corporativas.",
    painPoints: [
      "Lentidão ao acessar arquivos e sistemas na rede",
      "Quedas intermitentes de conexão",
      "Impressoras e dispositivos perdendo conexão",
      "Rede Wi-Fi com baixa cobertura ou instável",
    ],
    solutionIntro:
      "Realizamos diagnóstico completo da rede, identificamos gargalos e implementamos soluções como switches gerenciáveis, cabeamento estruturado e firewall pfSense.",
  },
  {
    slug: "empresa-com-servidor-caindo",
    name: "Servidor da Empresa Caindo",
    h1Template: "Servidor da sua empresa em {city} está caindo?",
    description:
      "Servidor que cai constantemente paralisa a operação e pode causar perda de dados. A WMTi diagnostica a causa raiz e implementa soluções de alta disponibilidade.",
    painPoints: [
      "Servidor reiniciando sem motivo aparente",
      "Perda de conexão com o servidor intermitente",
      "Tela azul (BSOD) frequente no servidor",
      "Discos com erros comprometendo a integridade dos dados",
    ],
    solutionIntro:
      "Diagnosticamos falhas de hardware e software, configuramos RAID para redundância de discos, implementamos monitoramento contínuo e, quando necessário, migramos para servidores Dell PowerEdge.",
  },
  {
    slug: "empresa-com-sistema-lento",
    name: "Sistema Lento na Empresa",
    h1Template: "Sistemas lentos na sua empresa em {city}?",
    description:
      "Sistemas corporativos lentos indicam problemas na infraestrutura de TI: servidor subdimensionado, rede congestionada ou falta de otimização. A WMTi resolve a causa raiz.",
    painPoints: [
      "ERP ou sistema de gestão extremamente lento",
      "Banco de dados demorando para responder consultas",
      "Servidor com recursos insuficientes para a demanda",
      "Rede sem QoS priorizando tráfego crítico",
    ],
    solutionIntro:
      "Otimizamos a infraestrutura com servidores dimensionados, discos SSD, redes com QoS e monitoramento de performance para garantir velocidade dos sistemas corporativos.",
  },
  {
    slug: "empresa-sem-infraestrutura-ti",
    name: "Empresa Sem Infraestrutura de TI",
    h1Template: "Sua empresa em {city} precisa de infraestrutura de TI?",
    description:
      "Empresas sem infraestrutura de TI profissional enfrentam instabilidade, riscos de segurança e baixa produtividade. A WMTi projeta e implementa infraestrutura completa.",
    painPoints: [
      "Nenhum servidor corporativo na empresa",
      "Rede montada sem planejamento técnico",
      "Sem firewall, backup ou antivírus corporativo",
      "Equipamentos domésticos em uso no ambiente empresarial",
    ],
    solutionIntro:
      "Projetamos e implementamos infraestrutura de TI completa: servidores Dell PowerEdge, rede estruturada, firewall pfSense, backup automatizado e monitoramento 24/7.",
  },
];
