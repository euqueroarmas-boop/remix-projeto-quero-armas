import {
  Server, Shield, Cloud, Network, Monitor, Wrench, Headphones,
  Lock, Activity, Eye, Cpu, HardDrive,
  Building2, Scale, Heart, Stethoscope, Landmark, Briefcase,
  AlertTriangle, Clock,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { SeoPageData } from "@/data/seoPages";
import { services } from "./services";
import { cities } from "./cities";
import { segments } from "./segments";
import { intents } from "./intents";
import { problems } from "./problems";
import { blogPosts } from "@/data/blogPosts";

/** Icon map per service slug */
const serviceIcons: Record<string, { icon: LucideIcon; title: string; text: string }[]> = {
  "infraestrutura-ti": [
    { icon: Server, title: "Servidores corporativos", text: "Servidores Dell PowerEdge com redundância, RAID e virtualização." },
    { icon: Network, title: "Redes estruturadas", text: "Cabeamento, switches gerenciáveis e Wi-Fi empresarial." },
    { icon: Shield, title: "Segurança digital", text: "Firewall pfSense, antivírus corporativo e monitoramento." },
    { icon: Cloud, title: "Nuvem corporativa", text: "Microsoft 365, backup em nuvem e armazenamento seguro." },
    { icon: Monitor, title: "Estações de trabalho", text: "Computadores Dell OptiPlex com suporte e manutenção." },
    { icon: Headphones, title: "Suporte especializado", text: "Atendimento remoto e presencial com SLA garantido." },
  ],
  "suporte-ti": [
    { icon: Headphones, title: "Suporte remoto e presencial", text: "Atendimento rápido com SLA garantido por contrato." },
    { icon: Activity, title: "Monitoramento proativo", text: "Identificação e resolução de problemas antes que afetem a operação." },
    { icon: Wrench, title: "Manutenção preventiva", text: "Atualizações, limpeza e otimização periódica de sistemas." },
    { icon: Server, title: "Gestão de servidores", text: "Administração completa de servidores e ambientes virtualizados." },
    { icon: Shield, title: "Segurança contínua", text: "Antivírus, firewall e políticas de segurança sempre atualizados." },
    { icon: Monitor, title: "Gestão de estações", text: "Controle de parque tecnológico e inventário de equipamentos." },
  ],
  "monitoramento-rede": [
    { icon: Eye, title: "Monitoramento 24/7", text: "NOC próprio monitorando a rede da sua empresa em tempo real." },
    { icon: Activity, title: "Alertas em tempo real", text: "Notificações instantâneas sobre falhas e degradação de serviços." },
    { icon: Network, title: "Análise de tráfego", text: "Relatórios de uso, gargalos e planejamento de capacidade." },
    { icon: Shield, title: "Detecção de ameaças", text: "Identificação de acessos suspeitos e tentativas de invasão." },
    { icon: Server, title: "Disponibilidade garantida", text: "Uptime monitorado com metas de SLA documentadas." },
    { icon: Headphones, title: "Suporte técnico", text: "Equipe especializada para resolução rápida de incidentes." },
  ],
  "servidores-dell": [
    { icon: Server, title: "Dell PowerEdge", text: "Servidores corporativos dimensionados para cada necessidade." },
    { icon: HardDrive, title: "RAID e redundância", text: "Configuração de discos com tolerância a falhas e alta disponibilidade." },
    { icon: Cpu, title: "Virtualização", text: "Hyper-V e VMware para consolidação de servidores e eficiência." },
    { icon: Shield, title: "Backup corporativo", text: "Políticas de backup automatizado com recuperação garantida." },
    { icon: Activity, title: "Monitoramento de hardware", text: "Alertas proativos sobre temperatura, discos e memória." },
    { icon: Wrench, title: "Manutenção preventiva", text: "Atualizações de firmware, drivers e sistema operacional." },
  ],
  "microsoft-365": [
    { icon: Cloud, title: "Exchange Online", text: "E-mail corporativo profissional com domínio próprio." },
    { icon: Monitor, title: "Microsoft Teams", text: "Comunicação e colaboração integrada para equipes." },
    { icon: HardDrive, title: "OneDrive e SharePoint", text: "Armazenamento em nuvem seguro e compartilhamento de arquivos." },
    { icon: Shield, title: "Segurança Microsoft", text: "Autenticação multifator, políticas de acesso e compliance." },
    { icon: Wrench, title: "Migração completa", text: "Migração de e-mails e dados sem interrupção dos serviços." },
    { icon: Headphones, title: "Gestão contínua", text: "Administração de licenças, usuários e políticas de segurança." },
  ],
  "seguranca-rede": [
    { icon: Shield, title: "Firewall pfSense", text: "Proteção perimetral avançada com regras personalizadas." },
    { icon: Lock, title: "VPN corporativa", text: "Acesso remoto seguro para colaboradores e filiais." },
    { icon: Eye, title: "Monitoramento de ameaças", text: "Detecção e resposta a tentativas de invasão em tempo real." },
    { icon: Server, title: "Antivírus corporativo", text: "ESET Endpoint Security com console de gerenciamento." },
    { icon: Network, title: "Controle de acesso", text: "Políticas de rede segmentadas por perfil de usuário." },
    { icon: Activity, title: "Auditoria de segurança", text: "Análise periódica de vulnerabilidades e relatórios de compliance." },
  ],
  "locacao-computadores": [
    { icon: Monitor, title: "Dell OptiPlex", text: "Estações de trabalho profissionais de alto desempenho." },
    { icon: Wrench, title: "Manutenção inclusa", text: "Suporte técnico e manutenção preventiva sem custo adicional." },
    { icon: Activity, title: "Substituição rápida", text: "Troca de equipamento em caso de falha com SLA garantido." },
    { icon: Shield, title: "Segurança padronizada", text: "Configuração padrão com antivírus e políticas de segurança." },
    { icon: Cloud, title: "Microsoft 365 integrado", text: "Estações pré-configuradas com ambiente Microsoft completo." },
    { icon: Headphones, title: "Suporte dedicado", text: "Atendimento prioritário para equipamentos em locação." },
  ],
};

/** Segment-specific icons */
const segmentIcons: Record<string, { icon: LucideIcon; title: string; text: string }[]> = {
  cartorios: [
    { icon: Landmark, title: "Conformidade CNJ", text: "Infraestrutura em conformidade com o Provimento 213 do CNJ." },
    { icon: Shield, title: "Segurança de dados", text: "Proteção de dados cartorários com backup criptografado." },
    { icon: Server, title: "Servidores dedicados", text: "Servidores dimensionados para sistemas cartorários." },
  ],
  hospitais: [
    { icon: Heart, title: "Alta disponibilidade", text: "Infraestrutura 24/7 para ambientes críticos de saúde." },
    { icon: Stethoscope, title: "Sistemas HIS/PACS", text: "Integração e suporte para sistemas médicos." },
    { icon: Lock, title: "LGPD Saúde", text: "Conformidade com LGPD para dados de pacientes." },
  ],
  "escritorios-advocacia": [
    { icon: Scale, title: "Sigilo profissional", text: "Infraestrutura segura para proteção de dados de clientes." },
    { icon: Lock, title: "VPN e criptografia", text: "Acesso remoto seguro para advogados." },
    { icon: Shield, title: "Backup jurídico", text: "Backup criptografado de processos e documentos." },
  ],
  contabilidade: [
    { icon: Briefcase, title: "Dados fiscais seguros", text: "Proteção e backup automatizado de dados contábeis." },
    { icon: Server, title: "Performance", text: "Servidores otimizados para sistemas de contabilidade." },
    { icon: Shield, title: "Conformidade fiscal", text: "Infraestrutura alinhada com exigências fiscais." },
  ],
  industrias: [
    { icon: Building2, title: "TI industrial", text: "Redes segmentadas e servidores de alta performance para fábricas." },
    { icon: Activity, title: "Monitoramento 24/7", text: "NOC dedicado para monitoramento da infraestrutura industrial." },
    { icon: Network, title: "Integração ERP", text: "Rede otimizada para sistemas de gestão industrial." },
  ],
};

/* ─── Service-specific pain points ─── */
const servicePainPoints: Record<string, string[]> = {
  "infraestrutura-ti": [
    "Rede corporativa instável prejudicando a produtividade diária",
    "Servidores antigos sem redundância ou virtualização",
    "Falta de cabeamento estruturado e equipamentos gerenciáveis",
    "Sem monitoramento proativo da infraestrutura de TI",
    "Ausência de política de backup e recuperação de desastres",
    "Equipamentos de rede domésticos sendo usados no ambiente empresarial",
  ],
  "suporte-ti": [
    "Demora excessiva no atendimento de chamados de TI",
    "Equipe interna sobrecarregada com problemas técnicos recorrentes",
    "Falta de manutenção preventiva gerando paradas constantes",
    "Sistemas desatualizados e vulneráveis a falhas de segurança",
    "Ausência de SLA definido para resolução de incidentes",
    "Custos altos com técnicos avulsos e sem previsibilidade",
  ],
  "monitoramento-rede": [
    "Problemas de rede descobertos apenas quando já afetam a operação",
    "Sem visibilidade sobre o consumo de banda e gargalos de tráfego",
    "Quedas de internet não detectadas em tempo hábil",
    "Falta de relatórios de disponibilidade e performance da rede",
    "Equipamentos de rede sem gerenciamento centralizado",
    "Incapacidade de prever falhas antes que causem interrupções",
  ],
  "servidores-dell": [
    "Servidor com mais de 5 anos sem manutenção preventiva",
    "Hardware de servidor sem garantia ou suporte do fabricante",
    "Falta de RAID e redundância de discos no servidor atual",
    "Servidor subdimensionado para a carga de trabalho da empresa",
    "Ausência de virtualização desperdiçando recursos de hardware",
    "Sistema operacional do servidor sem atualizações de segurança",
  ],
  "microsoft-365": [
    "E-mail corporativo ainda baseado em POP3 ou IMAP local",
    "Arquivos importantes armazenados apenas nos computadores locais",
    "Sem ferramenta de colaboração em tempo real para equipes",
    "Licenças de software desatualizadas ou piratas na empresa",
    "Falta de autenticação multifator nos e-mails corporativos",
    "Dificuldade de gerenciar acessos quando colaboradores saem da empresa",
  ],
  "seguranca-rede": [
    "Roteador doméstico sendo usado como firewall da empresa",
    "Ausência de antivírus corporativo com gerenciamento centralizado",
    "Rede sem segmentação expondo dados sensíveis a todos os usuários",
    "Sem VPN para acesso remoto seguro de colaboradores",
    "Vulnerabilidade a ataques ransomware por falta de proteção perimetral",
    "Funcionários acessando sites maliciosos sem filtragem de conteúdo",
  ],
  "locacao-computadores": [
    "Computadores antigos e lentos reduzindo a produtividade da equipe",
    "Alto custo com manutenção de máquinas desatualizadas",
    "Falta de padronização nos equipamentos da empresa",
    "Investimento alto em compra de computadores sem garantia de troca",
    "Dificuldade em escalar o parque de máquinas conforme a demanda",
    "Equipamentos quebrados aguardando semanas para reparo",
  ],
};

/* ─── Service-specific solutions ─── */
const serviceSolutions: Record<string, string[]> = {
  "infraestrutura-ti": [
    "Projeto completo de infraestrutura de TI corporativa sob medida",
    "Servidores Dell PowerEdge com RAID, virtualização e alta disponibilidade",
    "Cabeamento estruturado com switches gerenciáveis e Wi-Fi corporativo",
    "Firewall pfSense com proteção perimetral e controle de acesso",
    "Backup automatizado local e em nuvem com testes de restauração",
    "Monitoramento 24/7 com NOC especializado e alertas em tempo real",
  ],
  "suporte-ti": [
    "Suporte técnico remoto e presencial com SLA definido por contrato",
    "Monitoramento proativo de servidores, rede e estações de trabalho",
    "Manutenção preventiva periódica de todo o parque tecnológico",
    "Gestão de atualizações de sistema operacional e softwares",
    "Relatórios mensais de chamados, tempos de resposta e disponibilidade",
    "Equipe técnica dedicada com conhecimento do ambiente do cliente",
  ],
  "monitoramento-rede": [
    "NOC próprio com monitoramento contínuo 24/7 de toda a infraestrutura",
    "Alertas automáticos por e-mail e WhatsApp sobre falhas e degradação",
    "Dashboards de performance com métricas de latência, uptime e tráfego",
    "Análise preditiva para antecipar problemas antes que afetem a operação",
    "Monitoramento de links de internet, switches, servidores e firewalls",
    "Relatórios periódicos de disponibilidade e planejamento de capacidade",
  ],
  "servidores-dell": [
    "Dimensionamento técnico de servidores conforme a demanda da empresa",
    "Implantação de Dell PowerEdge com RAID, ECC e fontes redundantes",
    "Virtualização com Hyper-V ou VMware para consolidação de servidores",
    "Migração de dados e sistemas com planejamento e zero downtime",
    "Manutenção preventiva com atualização de firmware e monitoramento de hardware",
    "Suporte especializado Dell com peças e atendimento prioritário",
  ],
  "microsoft-365": [
    "Migração completa para Microsoft 365 sem perda de dados ou downtime",
    "Configuração de Exchange Online com domínio próprio e políticas de segurança",
    "Implantação de Microsoft Teams, SharePoint e OneDrive for Business",
    "Configuração de autenticação multifator e acesso condicional",
    "Gestão contínua de licenças, usuários e políticas de compliance",
    "Treinamento da equipe para uso produtivo das ferramentas Microsoft",
  ],
  "seguranca-rede": [
    "Implantação de firewall pfSense com IDS/IPS Suricata e regras personalizadas",
    "Antivírus corporativo ESET com console de gerenciamento centralizado",
    "VPN site-to-site e para acesso remoto seguro de colaboradores",
    "Segmentação de rede por VLANs com políticas de acesso por perfil",
    "Monitoramento contínuo de ameaças e tentativas de invasão",
    "Auditoria periódica de vulnerabilidades com relatórios de compliance",
  ],
  "locacao-computadores": [
    "Locação de Dell OptiPlex com monitor, teclado e mouse inclusos",
    "Manutenção preventiva e corretiva sem custo adicional durante o contrato",
    "Substituição de equipamento em caso de falha com SLA garantido",
    "Configuração padronizada com antivírus, sistema operacional e políticas de segurança",
    "Escalabilidade: aumente ou reduza o parque conforme a necessidade",
    "Suporte técnico dedicado para equipamentos em locação",
  ],
};

/* ─── Blog links per service ─── */
const blogLinksForService: Record<string, { label: string; href: string }[]> = {
  "infraestrutura-ti": [
    { label: "Guia completo de infraestrutura de TI", href: "/blog/guia-completo-infraestrutura-ti-empresas" },
    { label: "Servidor local ou nuvem?", href: "/blog/servidor-dedicado-vs-nuvem-para-empresas" },
  ],
  "suporte-ti": [
    { label: "Quanto custa infraestrutura de TI", href: "/blog/quanto-custa-infraestrutura-ti-empresas" },
    { label: "Recuperação de desastres de TI", href: "/blog/recuperacao-desastres-ti-plano-pratico" },
  ],
  "monitoramento-rede": [
    { label: "Monitoramento de rede contra ataques", href: "/blog/monitoramento-rede-prevencao-ataques" },
    { label: "Ataques DDoS: como proteger sua empresa", href: "/blog/ataques-ddos-como-proteger-empresa" },
  ],
  "servidores-dell": [
    { label: "Quando trocar o servidor da empresa", href: "/blog/quando-trocar-servidor-da-empresa" },
    { label: "Virtualização de servidores", href: "/blog/virtualizacao-servidores-seguranca-performance" },
  ],
  "microsoft-365": [
    { label: "Vantagens do Microsoft 365", href: "/blog/vantagens-microsoft-365-para-empresas" },
    { label: "Segurança de e-mail corporativo", href: "/blog/seguranca-email-corporativo-ameacas-comuns" },
  ],
  "seguranca-rede": [
    { label: "Firewall pfSense para empresas", href: "/blog/firewall-pfsense-para-empresas-protecao-completa" },
    { label: "Política de segurança da informação", href: "/blog/politica-seguranca-informacao-empresas" },
  ],
  "locacao-computadores": [
    { label: "Compra ou locação de computadores?", href: "/blog/compra-ou-locacao-de-computadores" },
    { label: "Cibersegurança para pequenas empresas", href: "/blog/ciberseguranca-para-pequenas-empresas" },
  ],
};

/* ─── City context for richer local content (all 50 cities) ─── */
const cityContext: Record<string, string> = {
  // Vale do Paraíba
  "jacarei": "cidade estratégica do Vale do Paraíba, sede da WMTi, com atendimento presencial imediato",
  "sao-jose-dos-campos": "sede de grandes indústrias aeroespaciais e de tecnologia no Vale do Paraíba",
  "taubate": "importante polo industrial do Vale do Paraíba com grande demanda por TI empresarial",
  "cacapava": "cidade em crescimento no Vale do Paraíba com empresas buscando modernização tecnológica",
  "pindamonhangaba": "polo industrial e comercial do Vale do Paraíba com crescente demanda por soluções de TI",
  "guaratingueta": "centro educacional e comercial do Vale do Paraíba com empresas em expansão tecnológica",
  "lorena": "cidade universitária do Vale do Paraíba com crescente setor empresarial",
  "cruzeiro": "município industrial do Vale do Paraíba com necessidade de infraestrutura de TI moderna",
  // Grande São Paulo
  "sao-paulo": "polo econômico do Brasil, com milhares de empresas que dependem de TI estável",
  "guarulhos": "segunda maior cidade de São Paulo, com grande concentração de empresas e indústrias",
  "osasco": "importante centro comercial e financeiro da Grande São Paulo",
  "santo-andre": "polo industrial do ABC Paulista com forte presença de empresas de médio e grande porte",
  "sao-bernardo-do-campo": "centro industrial do ABC Paulista, sede de grandes montadoras e indústrias",
  "sao-caetano-do-sul": "cidade com alto IDH e forte atividade empresarial no ABC Paulista",
  "diadema": "polo industrial do ABC com empresas que demandam infraestrutura de TI confiável",
  "maua": "cidade industrial do ABC Paulista com crescente modernização tecnológica",
  "mogi-das-cruzes": "cidade em expansão no Alto Tietê com forte presença de PMEs",
  "suzano": "polo industrial e comercial do Alto Tietê com empresas em crescimento",
  "taboao-da-serra": "centro comercial da Grande São Paulo com forte atividade empresarial",
  "barueri": "polo corporativo e de tecnologia da Grande São Paulo, sede de grandes empresas",
  "cotia": "cidade em expansão na Grande São Paulo com polo industrial e empresarial diversificado",
  "itaquaquecetuba": "município em crescimento no Alto Tietê com empresas buscando soluções de TI",
  // Região de Campinas
  "campinas": "um dos maiores polos tecnológicos do interior paulista",
  "jundiai": "polo industrial estratégico entre São Paulo e Campinas",
  "piracicaba": "centro agroindustrial e universitário do interior paulista",
  "americana": "polo têxtil e industrial da região metropolitana de Campinas",
  "limeira": "polo de joias e metalurgia com empresas em modernização tecnológica",
  "indaiatuba": "cidade com forte crescimento industrial e empresarial na região de Campinas",
  "sumare": "polo industrial da região metropolitana de Campinas com empresas diversificadas",
  "hortolandia": "centro tecnológico na região de Campinas com presença de grandes empresas de TI",
  "valinhos": "cidade com forte atividade empresarial e qualidade de vida na região de Campinas",
  "vinhedo": "polo de tecnologia e vinicultura na região de Campinas",
  // Litoral
  "santos": "principal cidade portuária do país, com demanda crescente por segurança digital e conectividade",
  "sao-vicente": "cidade litorânea com empresas que demandam infraestrutura de TI confiável",
  "praia-grande": "município em crescimento no litoral paulista com setor empresarial em expansão",
  // Sorocaba
  "sorocaba": "polo industrial em expansão com forte presença de empresas de médio e grande porte",
  "itu": "cidade industrial e turística na região de Sorocaba com empresas em modernização",
  "salto": "município industrial na região de Sorocaba com crescente demanda por TI corporativa",
  // Interior Noroeste
  "ribeirao-preto": "centro agroindustrial do interior de São Paulo com crescente demanda por TI corporativa",
  "sao-jose-do-rio-preto": "polo regional do noroeste paulista com forte setor de serviços e comércio",
  "barretos": "polo agroindustrial do norte paulista com empresas em crescimento tecnológico",
  "araraquara": "centro regional do interior paulista com empresas em modernização tecnológica",
  "franca": "polo calçadista e industrial do interior paulista com empresas em modernização",
  "sertaozinho": "polo sucroalcooleiro e industrial do interior de São Paulo",
  // Interior Centro
  "bauru": "entroncamento rodoferroviário com forte atividade comercial e de serviços",
  "marilia": "centro comercial e industrial do centro-oeste paulista",
  "botucatu": "cidade universitária com crescente modernização empresarial",
  "jau": "polo cerâmico e calçadista do interior paulista",
  // Interior Oeste
  "presidente-prudente": "centro regional do oeste paulista com forte setor de serviços",
  "aracatuba": "polo agroindustrial e comercial do noroeste paulista",
};

/* ─── Nearby cities for interlinking ─── */
const nearbyCities: Record<string, string[]> = {
  // Vale do Paraíba
  "jacarei": ["sao-jose-dos-campos", "taubate", "cacapava"],
  "sao-jose-dos-campos": ["jacarei", "taubate", "cacapava"],
  "taubate": ["sao-jose-dos-campos", "pindamonhangaba", "cacapava"],
  "cacapava": ["jacarei", "taubate", "sao-jose-dos-campos"],
  "pindamonhangaba": ["taubate", "guaratingueta", "cacapava"],
  "guaratingueta": ["pindamonhangaba", "lorena", "taubate"],
  "lorena": ["guaratingueta", "cruzeiro", "pindamonhangaba"],
  "cruzeiro": ["lorena", "guaratingueta"],
  // Grande São Paulo
  "sao-paulo": ["guarulhos", "osasco", "barueri"],
  "guarulhos": ["sao-paulo", "mogi-das-cruzes", "itaquaquecetuba"],
  "osasco": ["sao-paulo", "barueri", "cotia"],
  "santo-andre": ["sao-bernardo-do-campo", "maua", "diadema"],
  "sao-bernardo-do-campo": ["santo-andre", "diadema", "sao-caetano-do-sul"],
  "sao-caetano-do-sul": ["santo-andre", "sao-bernardo-do-campo", "sao-paulo"],
  "diadema": ["sao-bernardo-do-campo", "santo-andre", "sao-paulo"],
  "maua": ["santo-andre", "ribeirao-preto", "suzano"],
  "mogi-das-cruzes": ["suzano", "itaquaquecetuba", "guarulhos"],
  "suzano": ["mogi-das-cruzes", "itaquaquecetuba", "guarulhos"],
  "taboao-da-serra": ["osasco", "cotia", "sao-paulo"],
  "barueri": ["osasco", "cotia", "jundiai"],
  "cotia": ["taboao-da-serra", "osasco", "barueri"],
  "itaquaquecetuba": ["mogi-das-cruzes", "suzano", "guarulhos"],
  // Campinas
  "campinas": ["americana", "sumare", "indaiatuba"],
  "jundiai": ["campinas", "indaiatuba", "barueri"],
  "piracicaba": ["campinas", "limeira", "americana"],
  "americana": ["campinas", "sumare", "limeira"],
  "limeira": ["piracicaba", "americana", "campinas"],
  "indaiatuba": ["campinas", "jundiai", "salto"],
  "sumare": ["campinas", "americana", "hortolandia"],
  "hortolandia": ["sumare", "campinas", "americana"],
  "valinhos": ["campinas", "vinhedo", "jundiai"],
  "vinhedo": ["valinhos", "campinas", "jundiai"],
  // Litoral
  "santos": ["sao-vicente", "praia-grande", "sao-paulo"],
  "sao-vicente": ["santos", "praia-grande"],
  "praia-grande": ["santos", "sao-vicente"],
  // Sorocaba
  "sorocaba": ["itu", "salto", "jundiai"],
  "itu": ["sorocaba", "salto", "indaiatuba"],
  "salto": ["itu", "indaiatuba", "sorocaba"],
  // Interior Noroeste
  "ribeirao-preto": ["sertaozinho", "franca", "araraquara"],
  "sao-jose-do-rio-preto": ["barretos", "araraquara", "aracatuba"],
  "barretos": ["ribeirao-preto", "sao-jose-do-rio-preto", "franca"],
  "araraquara": ["ribeirao-preto", "sao-jose-do-rio-preto", "bauru"],
  "franca": ["ribeirao-preto", "barretos", "sertaozinho"],
  "sertaozinho": ["ribeirao-preto", "franca", "araraquara"],
  // Interior Centro
  "bauru": ["marilia", "botucatu", "jau"],
  "marilia": ["bauru", "botucatu", "presidente-prudente"],
  "botucatu": ["bauru", "sorocaba", "piracicaba"],
  "jau": ["bauru", "botucatu", "araraquara"],
  // Interior Oeste
  "presidente-prudente": ["marilia", "aracatuba"],
  "aracatuba": ["sao-jose-do-rio-preto", "presidente-prudente"],
};

const defaultPainPoints = [
  "Rede lenta ou instável prejudicando a operação",
  "Servidor antigo ou mal configurado",
  "Sistemas travando constantemente",
  "Falta de segurança contra ataques cibernéticos",
  "Falta de suporte técnico confiável",
  "Equipamentos inadequados para a demanda",
];

const defaultSolutions = [
  "Infraestrutura de TI corporativa planejada e gerenciada",
  "Servidores Dell PowerEdge com alta disponibilidade",
  "Redes empresariais estruturadas e seguras",
  "Firewall pfSense com proteção avançada",
  "Microsoft 365 com gestão completa",
  "Suporte técnico especializado com SLA",
];

function fill(template: string, replacements: Record<string, string>): string {
  let result = template;
  for (const [key, value] of Object.entries(replacements)) {
    result = result.replace(new RegExp(`\\{${key}\\}`, "g"), value);
  }
  return result;
}

function getCityName(slug: string): string {
  return cities.find((c) => c.slug === slug)?.name ?? slug;
}

/** Segment name-to-slug mapping for URL generation */
const segmentPagePrefix: Record<string, string> = {
  cartorios: "ti-para-cartorios",
  hospitais: "ti-para-hospitais",
  "escritorios-advocacia": "ti-para-escritorios-de-advocacia",
  contabilidade: "ti-para-contabilidades",
  industrias: "ti-para-industrias",
};

export function generateProgrammaticPages(): SeoPageData[] {
  const pages: SeoPageData[] = [];
  const usedSlugs = new Set<string>();

  function addPage(page: SeoPageData) {
    if (!usedSlugs.has(page.slug)) {
      usedSlugs.add(page.slug);
      pages.push(page);
    }
  }

  // ─── 1. Service × City ───
  for (const service of services) {
    for (const city of cities) {
      const slug = `${service.slug}-${city.slug}`;
      const r = { city: city.name, service: service.name };
      const ctx = cityContext[city.slug] || "região com forte atividade empresarial";

      const relatedLinks = service.relatedSlugs.map((rs) => {
        const rel = services.find((s) => s.slug === rs);
        return { label: rel?.name ?? rs, href: `/${rs}-${city.slug}` };
      });
      relatedLinks.push({ label: `Empresa de TI em ${city.name}`, href: `/empresa-ti-${city.slug}` });

      // Add nearby city links
      const nearby = nearbyCities[city.slug] ?? [];
      for (const nc of nearby.slice(0, 2)) {
        relatedLinks.push({ label: `${service.name} em ${getCityName(nc)}`, href: `/${service.slug}-${nc}` });
      }

      // Add blog links
      const blogLinks = blogLinksForService[service.slug] ?? [];
      relatedLinks.push(...blogLinks);

      // Add segment links for this city
      for (const seg of segments.slice(0, 2)) {
        const prefix = segmentPagePrefix[seg.slug] || `ti-para-${seg.slug}`;
        relatedLinks.push({ label: `${seg.name} em ${city.name}`, href: `/${prefix}-${city.slug}` });
      }

      addPage({
        slug,
        metaTitle: fill(service.titleTemplate, r),
        metaDescription: fill(service.descriptionTemplate, r),
        tag: `${service.name} em ${city.name}`,
        headline: `${service.h1Prefix}`,
        headlineHighlight: city.name,
        description: fill(service.contentTemplate, r),
        whatsappMessage: `Olá! Gostaria de saber mais sobre ${service.name} para minha empresa em ${city.name}.`,
        category: "local-service",
        painPoints: servicePainPoints[service.slug] ?? defaultPainPoints,
        solutions: serviceSolutions[service.slug] ?? defaultSolutions,
        benefits: serviceIcons[service.slug] ?? serviceIcons["infraestrutura-ti"],
        faq: [
          { question: `A WMTi oferece ${service.name.toLowerCase()} em ${city.name}?`, answer: `Sim. A WMTi atende empresas em ${city.name} e região com soluções profissionais de ${service.name.toLowerCase()}, suporte técnico especializado e infraestrutura corporativa dimensionada para cada necessidade.` },
          { question: `Quanto custa ${service.name.toLowerCase()} para empresas em ${city.name}?`, answer: `O investimento depende do porte da empresa, da quantidade de equipamentos e das necessidades específicas. Entre em contato para um diagnóstico gratuito e receba uma proposta personalizada para sua empresa em ${city.name}.` },
          { question: `A WMTi atende pequenas e médias empresas em ${city.name}?`, answer: `Sim. Atendemos empresas de todos os portes em ${city.name}, desde escritórios com 5 computadores até operações com centenas de estações. Nossos planos são escaláveis e personalizados.` },
          { question: "Como solicitar um orçamento de TI?", answer: "Entre em contato pelo WhatsApp ou formulário do site para agendar um diagnóstico gratuito. Nossa equipe técnica avalia sua infraestrutura atual e apresenta uma proposta detalhada sem compromisso." },
        ],
        relatedLinks,
        localContent: `A WMTi Tecnologia da Informação atende empresas em ${city.name} (${city.state}), ${ctx}, com soluções especializadas de ${service.name.toLowerCase()}. Com sede em Jacareí/SP e mais de 15 anos de experiência no mercado corporativo, oferecemos atendimento presencial e remoto com SLA garantido, garantindo que sua empresa em ${city.name} opere com segurança, desempenho e confiabilidade. Nossos clientes na região de ${city.region} contam com suporte técnico dedicado, monitoramento contínuo e projetos de infraestrutura dimensionados para cada necessidade.`,
        shouldIndex: true,
        priority: city.priority * 0.7,
      });
    }
  }

  // Phase 1: Sections 2 (Service×City×Segment) and 3 (Service×City×Intent) removed
  // Only clean service-city, problem-city, segment-city combinations


  // ─── 4. Problem × City ───
  for (const problem of problems) {
    for (const city of cities) {
      const slug = `${problem.slug}-${city.slug}`;
      const ctx = cityContext[city.slug] || "região com forte atividade empresarial";

      const relatedLinks = [
        { label: `Empresa de TI em ${city.name}`, href: `/empresa-ti-${city.slug}` },
        { label: "Infraestrutura de TI", href: `/infraestrutura-ti-${city.slug}` },
        { label: "Suporte de TI", href: `/suporte-ti-${city.slug}` },
        { label: "Segurança de Rede", href: `/seguranca-rede-${city.slug}` },
      ];

      // Cross-problem links (other problems in same city)
      for (const otherProblem of problems) {
        if (otherProblem.slug !== problem.slug) {
          relatedLinks.push({ label: `${otherProblem.name} em ${city.name}`, href: `/${otherProblem.slug}-${city.slug}` });
        }
      }

      // Add nearby city problem links
      const nearby = nearbyCities[city.slug] ?? [];
      for (const nc of nearby.slice(0, 1)) {
        relatedLinks.push({ label: `${problem.name} em ${getCityName(nc)}`, href: `/${problem.slug}-${nc}` });
      }

      // Add relevant blog link
      if (problem.slug === "rede-lenta") {
        relatedLinks.push({ label: "Monitoramento de rede contra ataques", href: "/blog/monitoramento-rede-prevencao-ataques" });
      } else if (problem.slug === "servidor-travando") {
        relatedLinks.push({ label: "Quando trocar o servidor", href: "/blog/quando-trocar-servidor-da-empresa" });
      } else if (problem.slug === "sem-backup") {
        relatedLinks.push({ label: "Estratégia de backup 3-2-1", href: "/blog/backup-3-2-1-estrategia-para-empresas" });
      } else if (problem.slug === "ataque-ransomware") {
        relatedLinks.push({ label: "Como proteger contra ransomware", href: "/blog/como-proteger-a-empresa-contra-ransomware" });
      } else if (problem.slug === "computadores-lentos") {
        relatedLinks.push({ label: "Compra ou locação de computadores", href: "/blog/compra-ou-locacao-de-computadores" });
      }

      addPage({
        slug,
        metaTitle: `${problem.name} — Soluções de TI em ${city.name} | WMTi`,
        metaDescription: `${problem.description.slice(0, 130)}. Soluções profissionais de TI para empresas em ${city.name}. WMTi Tecnologia.`,
        tag: problem.name,
        headline: fill(problem.h1Template, { city: city.name }),
        headlineHighlight: "",
        description: `${problem.description}\n\n${problem.solutionIntro}`,
        whatsappMessage: `Olá! Minha empresa em ${city.name} está com problema de ${problem.name.toLowerCase()}. Podem ajudar?`,
        category: "problem-page",
        painPoints: problem.painPoints,
        solutions: (serviceSolutions["infraestrutura-ti"] ?? defaultSolutions).slice(0, 4),
        benefits: serviceIcons["infraestrutura-ti"].slice(0, 4),
        faq: [
          { question: `Como resolver ${problem.name.toLowerCase()} na minha empresa em ${city.name}?`, answer: `${problem.solutionIntro} A WMTi atende empresas em ${city.name}, ${ctx}, com diagnóstico gratuito e soluções profissionais de infraestrutura de TI.` },
          { question: "A WMTi faz diagnóstico gratuito?", answer: "Sim. Nossa equipe técnica realiza um diagnóstico completo da sua infraestrutura de TI sem custo e sem compromisso. Após a análise, apresentamos um relatório detalhado e uma proposta de solução personalizada." },
          { question: `Qual o prazo para resolver ${problem.name.toLowerCase()}?`, answer: `O prazo depende da causa do problema. Após o diagnóstico, apresentamos um cronograma de ação. Muitos problemas são resolvidos em poucas horas. Atendemos ${city.name} com equipe técnica dedicada.` },
        ],
        relatedLinks,
        localContent: `Se sua empresa em ${city.name}, ${ctx}, enfrenta ${problem.name.toLowerCase()}, a WMTi pode ajudar. Com sede em Jacareí/SP e mais de 15 anos de experiência, atendemos a região de ${city.region} com soluções profissionais de infraestrutura de TI, diagnóstico técnico especializado e suporte com SLA garantido.`,
        shouldIndex: true,
        priority: city.priority * 0.5,
      });
    }
  }

  // ─── 5. Segment × City (standalone segment pages) ───
  for (const segment of segments) {
    for (const city of cities) {
      const prefix = segmentPagePrefix[segment.slug] || `ti-para-${segment.slug}`;
      const slug = `${prefix}-${city.slug}`;
      const ctx = cityContext[city.slug] || "região com forte atividade empresarial";

      const relatedLinks = [
        { label: `Empresa de TI em ${city.name}`, href: `/empresa-ti-${city.slug}` },
        { label: `Infraestrutura de TI em ${city.name}`, href: `/infraestrutura-ti-${city.slug}` },
        { label: `Suporte de TI em ${city.name}`, href: `/suporte-ti-${city.slug}` },
      ];

      // Add nearby city segment links
      const nearby = nearbyCities[city.slug] ?? [];
      for (const nc of nearby.slice(0, 2)) {
        relatedLinks.push({ label: `${segment.name} em ${getCityName(nc)}`, href: `/${prefix}-${nc}` });
      }

      // Add service links for this city
      for (const svc of services.slice(0, 3)) {
        relatedLinks.push({ label: `${svc.name} em ${city.name}`, href: `/${svc.slug}-${city.slug}` });
      }

      const segBenefits = segmentIcons[segment.slug] ?? [];
      const baseBenefits = serviceIcons["infraestrutura-ti"];
      const benefits = [...segBenefits, ...baseBenefits.slice(0, 3)];

      addPage({
        slug,
        metaTitle: `TI ${segment.titleSuffix} em ${city.name} | WMTi Tecnologia`,
        metaDescription: `Soluções de TI ${segment.titleSuffix.toLowerCase()} em ${city.name}. ${segment.descriptionExtra.slice(0, 120)}. WMTi.`,
        tag: `TI ${segment.titleSuffix}`,
        headline: `TI ${segment.titleSuffix} em `,
        headlineHighlight: city.name,
        description: `A WMTi oferece soluções completas de TI ${segment.titleSuffix.toLowerCase()} em ${city.name}, ${ctx}. ${segment.descriptionExtra} Com mais de 15 anos de experiência, atendemos ${segment.name.toLowerCase()} com infraestrutura dimensionada, suporte especializado e conformidade com as regulamentações do setor.`,
        whatsappMessage: `Olá! Preciso de TI ${segment.titleSuffix.toLowerCase()} em ${city.name}.`,
        category: "segment",
        painPoints: [...segment.painPoints, ...defaultPainPoints.slice(0, 3)],
        solutions: defaultSolutions,
        benefits,
        faq: [
          segment.faqExtra,
          { question: `A WMTi atende ${segment.name.toLowerCase()} em ${city.name}?`, answer: `Sim. Atendemos ${segment.name.toLowerCase()} em ${city.name} e região de ${city.region} com soluções especializadas de TI, incluindo servidores, redes, segurança e suporte técnico dedicado.` },
          { question: `Qual o custo de TI ${segment.titleSuffix.toLowerCase()} em ${city.name}?`, answer: `O investimento depende do porte e das necessidades específicas. Entre em contato para um diagnóstico gratuito e proposta personalizada.` },
        ],
        relatedLinks,
        localContent: `A WMTi atende ${segment.name.toLowerCase()} em ${city.name} (${city.state}), ${ctx}, com soluções de TI dimensionadas para as necessidades do segmento. Nossa equipe na região de ${city.region} oferece atendimento presencial e remoto com SLA garantido.`,
        shouldIndex: true,
        priority: city.priority * 0.6,
      });
    }
  }

  return pages;
}
