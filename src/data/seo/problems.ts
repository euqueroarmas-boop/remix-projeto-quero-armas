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
];
