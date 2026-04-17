import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CANONICAL = "https://www.wmti.com.br";

function esc(t: string): string {
  return t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function getSupabase() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
}

// ─── Static routes meta ───
interface PageMeta {
  title: string;
  description: string;
  h1: string;
  content: string;
  links: { label: string; href: string }[];
  ogImage?: string;
  siteName?: string;
}

const staticPages: Record<string, PageMeta> = {
  "/": {
    title: "WMTi Tecnologia da Informação | Infraestrutura de TI Corporativa",
    description: "Soluções de infraestrutura de TI corporativa: servidores Dell, Microsoft 365, firewall pfSense, suporte técnico 24/7 e monitoramento. Jacareí e região.",
    h1: "Infraestrutura de TI Corporativa",
    content: "A WMTi Tecnologia da Informação é referência em soluções de TI corporativa no Vale do Paraíba. Oferecemos servidores Dell PowerEdge, Microsoft 365, firewall pfSense, montagem de redes estruturadas, locação de computadores, backup corporativo e suporte técnico 24/7 com SLA garantido.",
    links: [
      { label: "Infraestrutura de TI", href: "/infraestrutura-ti-corporativa-jacarei" },
      { label: "Suporte Técnico", href: "/suporte-ti-jacarei" },
      { label: "Servidores Dell", href: "/servidor-dell-poweredge-jacarei" },
      { label: "Microsoft 365", href: "/microsoft-365-para-empresas-jacarei" },
      { label: "Segurança de Rede", href: "/seguranca-de-rede" },
      { label: "Locação de Computadores", href: "/locacao-de-computadores-para-empresas-jacarei" },
      { label: "Monitoramento de Rede", href: "/monitoramento-de-rede" },
      { label: "Blog", href: "/blog" },
      { label: "Orçamento", href: "/orcamento-ti" },
      { label: "Institucional", href: "/institucional" },
    ],
  },
  "/institucional": {
    title: "Sobre a WMTi | Empresa de TI em Jacareí",
    description: "Conheça a WMTi: empresa de TI em Jacareí com mais de 15 anos de experiência em infraestrutura corporativa, suporte técnico e segurança digital.",
    h1: "Sobre a WMTi Tecnologia da Informação",
    content: "A WMTi é uma empresa de TI fundada em Jacareí/SP, com mais de 15 anos de experiência em infraestrutura de TI corporativa para empresas de todos os portes. Oferecemos soluções completas de servidores, redes, segurança, backup, monitoramento e suporte técnico.",
    links: [{ label: "Serviços", href: "/servicos" }, { label: "Orçamento", href: "/orcamento-ti" }],
  },
  "/servicos": {
    title: "Serviços de TI Corporativa | WMTi",
    description: "Conheça todos os serviços de TI da WMTi: suporte técnico, infraestrutura, servidores, redes, firewall, backup, monitoramento e Microsoft 365.",
    h1: "Serviços de TI Corporativa",
    content: "A WMTi oferece uma gama completa de serviços de TI para empresas: infraestrutura corporativa, suporte técnico com SLA, servidores Dell PowerEdge, firewall pfSense, backup corporativo, monitoramento 24/7, Microsoft 365 e locação de computadores.",
    links: [
      { label: "Suporte Técnico", href: "/suporte-ti-jacarei" },
      { label: "Infraestrutura", href: "/infraestrutura-ti-corporativa-jacarei" },
      { label: "Servidores Dell", href: "/servidor-dell-poweredge-jacarei" },
      { label: "Segurança de Rede", href: "/seguranca-de-rede" },
    ],
  },
  "/infraestrutura-ti-corporativa-jacarei": {
    title: "Infraestrutura de TI Corporativa em Jacareí | WMTi",
    description: "Soluções de infraestrutura de TI corporativa para empresas em Jacareí. Servidores, redes, segurança e suporte técnico especializado.",
    h1: "Infraestrutura de TI Corporativa em Jacareí",
    content: "A WMTi projeta e implementa infraestrutura de TI corporativa completa para empresas em Jacareí e região do Vale do Paraíba. Servidores Dell PowerEdge, redes estruturadas, firewall pfSense, backup automatizado e monitoramento 24/7.",
    links: [
      { label: "Servidores Dell", href: "/servidor-dell-poweredge-jacarei" },
      { label: "Segurança de Rede", href: "/seguranca-de-rede" },
      { label: "Monitoramento", href: "/monitoramento-de-rede" },
    ],
  },
  "/suporte-ti-jacarei": {
    title: "Suporte Técnico de TI em Jacareí | WMTi",
    description: "Suporte técnico de TI especializado para empresas em Jacareí. Atendimento remoto e presencial com SLA garantido.",
    h1: "Suporte Técnico de TI em Jacareí",
    content: "A WMTi oferece suporte técnico de TI para empresas em Jacareí. Atendimento remoto e presencial com SLA garantido, monitoramento proativo e gestão do parque tecnológico.",
    links: [
      { label: "Infraestrutura de TI", href: "/infraestrutura-ti-corporativa-jacarei" },
      { label: "Monitoramento de Rede", href: "/monitoramento-de-rede" },
    ],
  },
  "/servidor-dell-poweredge-jacarei": {
    title: "Servidores Dell PowerEdge em Jacareí | WMTi",
    description: "Implantação e suporte de servidores Dell PowerEdge para empresas em Jacareí. Virtualização, RAID, backup e alta disponibilidade.",
    h1: "Servidores Dell PowerEdge em Jacareí",
    content: "A WMTi é especialista em servidores Dell PowerEdge em Jacareí. Dimensionamento, implantação, RAID, virtualização Hyper-V e manutenção preventiva.",
    links: [{ label: "Infraestrutura de TI", href: "/infraestrutura-ti-corporativa-jacarei" }],
  },
  "/microsoft-365-para-empresas-jacarei": {
    title: "Microsoft 365 para Empresas em Jacareí | WMTi",
    description: "Implantação e gestão de Microsoft 365 para empresas em Jacareí. E-mail corporativo, Teams, SharePoint e nuvem.",
    h1: "Microsoft 365 para Empresas em Jacareí",
    content: "A WMTi oferece implantação e gestão completa de Microsoft 365 para empresas em Jacareí. Exchange Online, Teams, SharePoint, OneDrive e políticas de segurança.",
    links: [{ label: "Suporte de TI", href: "/suporte-ti-jacarei" }],
  },
  "/seguranca-de-rede": {
    title: "Segurança de Rede Empresarial | WMTi",
    description: "Firewall pfSense, antivírus corporativo, VPN e proteção contra ataques para empresas. WMTi Tecnologia da Informação.",
    h1: "Segurança de Rede Empresarial",
    content: "A WMTi implementa soluções de segurança de rede: firewall pfSense, antivírus ESET, VPN corporativa, controle de acesso e monitoramento contra ameaças.",
    links: [{ label: "Firewall pfSense", href: "/firewall-pfsense-jacarei" }],
  },
  "/monitoramento-de-rede": {
    title: "Monitoramento de Rede 24/7 | WMTi",
    description: "Monitoramento contínuo de redes corporativas. Alertas em tempo real, prevenção de falhas e suporte especializado.",
    h1: "Monitoramento de Rede 24/7",
    content: "NOC da WMTi monitora redes corporativas 24/7 com alertas em tempo real, relatórios de desempenho e suporte técnico especializado.",
    links: [{ label: "Segurança de Rede", href: "/seguranca-de-rede" }],
  },
  "/locacao-de-computadores-para-empresas-jacarei": {
    title: "Locação de Computadores para Empresas em Jacareí | WMTi",
    description: "Locação de computadores Dell para empresas em Jacareí. Manutenção e suporte inclusos.",
    h1: "Locação de Computadores em Jacareí",
    content: "A WMTi oferece locação de computadores Dell OptiPlex para empresas em Jacareí com manutenção preventiva e suporte técnico inclusos.",
    links: [{ label: "Suporte de TI", href: "/suporte-ti-jacarei" }],
  },
  "/firewall-pfsense-jacarei": {
    title: "Firewall pfSense em Jacareí | WMTi",
    description: "Implantação de firewall pfSense para empresas em Jacareí. VPN, IDS/IPS, controle de acesso e proteção contra ataques.",
    h1: "Firewall pfSense em Jacareí",
    content: "A WMTi implanta firewalls pfSense com IDS/IPS Suricata para empresas em Jacareí. VPN, segmentação por VLANs e proteção contra ataques.",
    links: [{ label: "Segurança de Rede", href: "/seguranca-de-rede" }],
  },
  "/montagem-e-monitoramento-de-redes-jacarei": {
    title: "Montagem de Redes Corporativas em Jacareí | WMTi",
    description: "Montagem e monitoramento de redes corporativas em Jacareí. Cabeamento estruturado, switches gerenciáveis e Wi-Fi empresarial.",
    h1: "Montagem de Redes Corporativas em Jacareí",
    content: "A WMTi projeta e implementa redes corporativas em Jacareí com cabeamento Cat6A, switches Dell gerenciáveis e Wi-Fi empresarial.",
    links: [{ label: "Monitoramento de Rede", href: "/monitoramento-de-rede" }],
  },
  "/administracao-de-servidores": {
    title: "Administração de Servidores | WMTi",
    description: "Administração profissional de servidores Windows Server e Linux. Active Directory, GPOs, virtualização e monitoramento.",
    h1: "Administração de Servidores",
    content: "A WMTi oferece administração profissional de servidores corporativos. Windows Server, Linux, Active Directory, GPOs, Hyper-V e monitoramento.",
    links: [{ label: "Servidores Dell", href: "/servidor-dell-poweredge-jacarei" }],
  },
  "/monitoramento-de-servidores": {
    title: "Monitoramento de Servidores 24/7 | WMTi",
    description: "Monitoramento contínuo de servidores corporativos. Alertas em tempo real e prevenção de falhas.",
    h1: "Monitoramento de Servidores 24/7",
    content: "A WMTi monitora servidores 24/7 com alertas em tempo real, dashboards de performance e suporte proativo.",
    links: [{ label: "Administração de Servidores", href: "/administracao-de-servidores" }],
  },
  "/backup-corporativo": {
    title: "Backup Corporativo | Veeam e Nuvem | WMTi",
    description: "Backup corporativo com Veeam. Replicação local e em nuvem, estratégia 3-2-1 e recuperação garantida.",
    h1: "Backup Corporativo",
    content: "A WMTi implementa backup corporativo com Veeam: estratégia 3-2-1, replicação em nuvem Azure, testes de restauração e criptografia AES-256.",
    links: [{ label: "Segurança de Rede", href: "/seguranca-de-rede" }],
  },
  "/suporte-tecnico-emergencial": {
    title: "Suporte Técnico Emergencial | WMTi",
    description: "Suporte técnico emergencial para empresas. Atendimento imediato para servidores, redes e sistemas.",
    h1: "Suporte Técnico Emergencial",
    content: "A WMTi oferece suporte emergencial com atendimento imediato para servidores, rede e sistemas que pararam de funcionar.",
    links: [{ label: "Suporte de TI", href: "/suporte-ti-jacarei" }],
  },
  "/suporte-windows-server": {
    title: "Suporte Windows Server | WMTi",
    description: "Suporte especializado em Windows Server. Active Directory, GPOs, Hyper-V, DNS e DHCP.",
    h1: "Suporte Windows Server",
    content: "A WMTi oferece suporte em Windows Server: Active Directory, Group Policies, Hyper-V, DNS, DHCP e File Server.",
    links: [{ label: "Suporte Linux", href: "/suporte-linux" }],
  },
  "/suporte-linux": {
    title: "Suporte Linux Corporativo | WMTi",
    description: "Suporte técnico em servidores Linux. Ubuntu Server, CentOS, Debian, Docker e firewalls.",
    h1: "Suporte Linux Corporativo",
    content: "A WMTi oferece suporte em servidores Linux: Ubuntu Server, CentOS, Debian, Docker e hardening de segurança.",
    links: [{ label: "Suporte Windows Server", href: "/suporte-windows-server" }],
  },
  "/manutencao-de-infraestrutura-de-ti": {
    title: "Manutenção de Infraestrutura de TI | WMTi",
    description: "Manutenção preventiva e corretiva de infraestrutura de TI. Servidores, redes, firewalls e equipamentos.",
    h1: "Manutenção de Infraestrutura de TI",
    content: "A WMTi realiza manutenção preventiva e corretiva de infraestrutura de TI: servidores, redes, firewalls, backup e equipamentos corporativos.",
    links: [{ label: "Suporte de TI", href: "/suporte-ti-jacarei" }],
  },
  "/suporte-tecnico-para-redes-corporativas": {
    title: "Suporte Para Redes Corporativas | WMTi",
    description: "Suporte técnico para redes corporativas. Diagnóstico, manutenção e monitoramento de switches e access points.",
    h1: "Suporte Para Redes Corporativas",
    content: "A WMTi oferece suporte para redes corporativas: diagnóstico de falhas, switches, access points, cabeamento estruturado e monitoramento contínuo.",
    links: [{ label: "Monitoramento de Rede", href: "/monitoramento-de-rede" }],
  },
  "/terceirizacao-de-mao-de-obra-ti": {
    title: "Terceirização de TI | WMTi",
    description: "Terceirização de mão de obra de TI. Equipe dedicada, gestão de infraestrutura e suporte contínuo.",
    h1: "Terceirização de TI",
    content: "A WMTi oferece terceirização de TI com profissionais especializados para gestão completa da infraestrutura tecnológica.",
    links: [{ label: "Suporte de TI", href: "/suporte-ti-jacarei" }],
  },
  "/reestruturacao-completa-de-rede-corporativa": {
    title: "Reestruturação de Rede Corporativa | WMTi",
    description: "Reestruturação completa de rede corporativa. Cabeamento, switches, VLANs, Wi-Fi empresarial e segurança.",
    h1: "Reestruturação de Rede Corporativa",
    content: "A WMTi realiza reestruturação completa de redes corporativas: cabeamento Cat6A, switches Dell gerenciáveis, VLANs, Wi-Fi empresarial e firewall pfSense.",
    links: [{ label: "Monitoramento de Rede", href: "/monitoramento-de-rede" }],
  },
  "/desenvolvimento-de-sites-e-sistemas-web": {
    title: "Desenvolvimento de Sites e Sistemas Web | WMTi",
    description: "Desenvolvimento de sites e sistemas web. Landing pages, portais corporativos e sistemas integrados.",
    h1: "Desenvolvimento de Sites e Sistemas Web",
    content: "A WMTi desenvolve sites e sistemas web: landing pages, portais corporativos, sistemas integrados e automações.",
    links: [{ label: "Automação com IA", href: "/automacao-de-ti-com-inteligencia-artificial" }],
  },
  "/automacao-de-ti-com-inteligencia-artificial": {
    title: "Automação de TI com Inteligência Artificial | WMTi",
    description: "Automação de TI com IA. Elimine tarefas manuais, reduza retrabalho e ganhe velocidade operacional.",
    h1: "Automação de TI com Inteligência Artificial",
    content: "A WMTi implementa automação de TI com IA: fluxos automáticos, atendimento inteligente, qualificação de leads e integração entre sistemas.",
    links: [{ label: "Desenvolvimento Web", href: "/desenvolvimento-de-sites-e-sistemas-web" }],
  },
  "/automacao-alexa-casa-empresa-inteligente": {
    title: "Automação com Alexa | Casa e Empresa Inteligente | WMTi",
    description: "Automação com Alexa para casas e empresas. Iluminação, câmeras, climatização e rotinas inteligentes.",
    h1: "Automação com Alexa",
    content: "A WMTi implementa automação com Alexa: iluminação, câmeras, fechaduras, climatização, sensores e rotinas inteligentes.",
    links: [{ label: "Segurança de Rede", href: "/seguranca-de-rede" }],
  },
  "/ti-para-cartorios": {
    title: "TI para Cartórios | WMTi",
    description: "Soluções de TI para cartórios com conformidade ao Provimento 213 do CNJ.",
    h1: "TI para Cartórios",
    content: "A WMTi é especialista em TI para cartórios: servidores, backup, firewall, monitoramento e conformidade com o Provimento 213 do CNJ.",
    links: [{ label: "Serventias Cartoriais", href: "/ti-para-serventias-cartoriais" }],
  },
  "/ti-para-serventias-cartoriais": {
    title: "TI para Serventias Cartoriais | WMTi",
    description: "Infraestrutura de TI para serventias extrajudiciais com conformidade ao Provimento 213.",
    h1: "TI para Serventias Cartoriais",
    content: "A WMTi atende todas as serventias extrajudiciais com foco em conformidade com o Provimento 213 do CNJ.",
    links: [{ label: "TI para Tabelionatos", href: "/ti-para-tabelionatos-de-notas" }],
  },
  "/ti-para-tabelionatos-de-notas": {
    title: "TI para Tabelionatos de Notas | WMTi",
    description: "Infraestrutura de TI para tabelionatos de notas com conformidade ao Provimento 213 do CNJ.",
    h1: "TI para Tabelionatos de Notas",
    content: "Infraestrutura de TI para tabelionatos de notas com backup, firewall, monitoramento e conformidade ao Provimento 213.",
    links: [{ label: "Serventias Cartoriais", href: "/ti-para-serventias-cartoriais" }],
  },
  "/ti-para-oficios-de-registro": {
    title: "TI para Ofícios de Registro | WMTi",
    description: "Infraestrutura de TI para ofícios de registro com replicação geográfica e conformidade ao Provimento 213.",
    h1: "TI para Ofícios de Registro",
    content: "A WMTi atende ofícios de registro civil, imóveis e títulos com replicação geográfica do acervo e conformidade ao Provimento 213.",
    links: [{ label: "Serventias Cartoriais", href: "/ti-para-serventias-cartoriais" }],
  },
  "/ti-para-tabelionatos-de-protesto": {
    title: "TI para Tabelionatos de Protesto | WMTi",
    description: "Infraestrutura de TI para tabelionatos de protesto com integração CRA/IEPTB e conformidade ao Provimento 213.",
    h1: "TI para Tabelionatos de Protesto",
    content: "A WMTi oferece TI de alta disponibilidade para tabelionatos de protesto com integração CRA e IEPTB.",
    links: [{ label: "Serventias Cartoriais", href: "/ti-para-serventias-cartoriais" }],
  },
  "/ti-para-hospitais-e-clinicas": {
    title: "TI para Hospitais e Clínicas | WMTi",
    description: "Soluções de TI para hospitais e clínicas com alta disponibilidade, LGPD e sistemas HIS/PACS.",
    h1: "TI para Hospitais e Clínicas",
    content: "A WMTi oferece TI para saúde: alta disponibilidade, integração HIS/PACS, conformidade LGPD e suporte 24/7.",
    links: [{ label: "Infraestrutura de TI", href: "/infraestrutura-ti-corporativa-jacarei" }],
  },
  "/ti-para-escritorios-de-advocacia": {
    title: "TI para Escritórios de Advocacia | WMTi",
    description: "Infraestrutura segura para escritórios de advocacia. VPN, backup criptografado e proteção de dados.",
    h1: "TI para Escritórios de Advocacia",
    content: "A WMTi oferece TI para escritórios de advocacia: VPN segura, backup criptografado e proteção de dados confidenciais.",
    links: [{ label: "Segurança de Rede", href: "/seguranca-de-rede" }],
  },
  "/ti-para-contabilidades": {
    title: "TI para Escritórios de Contabilidade | WMTi",
    description: "TI para contabilidades. Servidores seguros, backup fiscal e integração com sistemas contábeis.",
    h1: "TI para Escritórios de Contabilidade",
    content: "A WMTi oferece TI para escritórios contábeis: backup automatizado, segurança de dados fiscais e suporte técnico.",
    links: [{ label: "Backup Corporativo", href: "/backup-corporativo" }],
  },
  "/ti-para-industrias-alimenticias": {
    title: "TI para Indústrias Alimentícias | WMTi",
    description: "Soluções de TI para indústrias alimentícias. Redes segmentadas, servidores e monitoramento 24/7.",
    h1: "TI para Indústrias Alimentícias",
    content: "A WMTi atende indústrias alimentícias com redes segmentadas, servidores de alta performance e monitoramento 24/7.",
    links: [{ label: "Infraestrutura de TI", href: "/infraestrutura-ti-corporativa-jacarei" }],
  },
  "/ti-para-industrias-petroliferas": {
    title: "TI para Indústrias Petrolíferas | WMTi",
    description: "Soluções de TI para indústrias petrolíferas. Infraestrutura resiliente e segurança avançada.",
    h1: "TI para Indústrias Petrolíferas",
    content: "A WMTi oferece TI para indústrias petrolíferas: infraestrutura resiliente, segurança avançada e suporte 24/7.",
    links: [{ label: "Segurança de Rede", href: "/seguranca-de-rede" }],
  },
  "/ti-para-escritorios-corporativos": {
    title: "TI para Empresas Corporativas | WMTi",
    description: "Soluções completas de TI corporativa. Servidores, redes, backup, firewall e monitoramento 24/7.",
    h1: "TI para Empresas Corporativas",
    content: "A WMTi oferece TI corporativa completa: servidores Dell PowerEdge, redes segmentadas, backup e monitoramento 24/7.",
    links: [{ label: "Infraestrutura de TI", href: "/infraestrutura-ti-corporativa-jacarei" }],
  },
  "/cartorios/provimento-213": {
    title: "Provimento 213 CNJ | Conformidade para Cartórios | WMTi",
    description: "Adequação ao Provimento 213 do CNJ para serventias extrajudiciais. Infraestrutura homologada, backup e segurança.",
    h1: "Provimento 213 do CNJ",
    content: "A WMTi implementa infraestrutura em conformidade com o Provimento 213 do CNJ: backup automatizado, firewall, monitoramento e replicação de dados.",
    links: [{ label: "TI para Cartórios", href: "/ti-para-cartorios" }],
  },
  "/orcamento-ti": {
    title: "Orçamento de TI | WMTi",
    description: "Solicite um orçamento gratuito de TI para sua empresa. Diagnóstico, proposta e contratação simplificada.",
    h1: "Orçamento de TI",
    content: "Solicite um orçamento gratuito de TI para sua empresa. A WMTi oferece diagnóstico sem compromisso e proposta personalizada.",
    links: [{ label: "Serviços", href: "/servicos" }],
  },
  "/blog": {
    title: "Blog WMTi - Artigos sobre TI Corporativa",
    description: "Artigos sobre TI corporativa, segurança, infraestrutura e soluções para empresas.",
    h1: "Blog WMTi",
    content: "Artigos especializados sobre TI corporativa, segurança da informação, infraestrutura de redes, servidores e soluções para empresas.",
    links: [{ label: "Serviços", href: "/servicos" }],
  },
};

// ─── Compact SEO engine data ───
interface SvcData { slug: string; name: string; titleTpl: string; descTpl: string; h1Prefix: string; contentTpl: string; relatedSlugs: string[]; }
interface SegData { slug: string; name: string; titleSuffix: string; descExtra: string; painPoints: string[]; }
interface ProbData { slug: string; name: string; h1Tpl: string; desc: string; painPoints: string[]; solutionIntro: string; }
interface CityData { name: string; slug: string; region: string; population?: number; context?: string; }

// Services (compact)
const services: SvcData[] = [
  { slug: "infraestrutura-ti", name: "Infraestrutura De TI", titleTpl: "Infraestrutura de TI em {city} | WMTi", descTpl: "Soluções de infraestrutura de TI corporativa para empresas em {city}. Servidores, redes, segurança e suporte. WMTi.", h1Prefix: "Infraestrutura de TI em ", contentTpl: "A WMTi oferece soluções profissionais de infraestrutura de TI para empresas em {city}. Servidores Dell PowerEdge, redes estruturadas, firewall pfSense, backup automatizado e monitoramento 24/7.", relatedSlugs: ["servidores-dell", "seguranca-rede", "monitoramento-rede"] },
  { slug: "suporte-ti", name: "Suporte Técnico", titleTpl: "Suporte Técnico em {city} | WMTi", descTpl: "Suporte técnico de TI para empresas em {city}. Atendimento remoto e presencial com SLA garantido. WMTi.", h1Prefix: "Suporte Técnico em ", contentTpl: "A WMTi oferece suporte técnico de TI para empresas em {city}. Atendimento remoto e presencial com SLA garantido, monitoramento proativo e gestão do parque tecnológico.", relatedSlugs: ["infraestrutura-ti", "monitoramento-rede", "microsoft-365"] },
  { slug: "monitoramento-rede", name: "Monitoramento De Rede", titleTpl: "Monitoramento de Rede em {city} | WMTi", descTpl: "Monitoramento de rede 24/7 para empresas em {city}. Prevenção de falhas e alertas em tempo real. WMTi.", h1Prefix: "Monitoramento de Rede em ", contentTpl: "NOC da WMTi monitora redes corporativas em {city} 24/7 com alertas em tempo real e suporte especializado.", relatedSlugs: ["infraestrutura-ti", "seguranca-rede", "suporte-ti"] },
  { slug: "servidores-dell", name: "Servidores Dell PowerEdge", titleTpl: "Servidores Dell PowerEdge em {city} | WMTi", descTpl: "Implantação de servidores Dell PowerEdge em {city}. Virtualização, RAID e alta disponibilidade. WMTi.", h1Prefix: "Servidores Dell PowerEdge em ", contentTpl: "A WMTi implanta servidores Dell PowerEdge para empresas em {city}. RAID, virtualização Hyper-V e manutenção preventiva.", relatedSlugs: ["infraestrutura-ti", "monitoramento-servidores", "administracao-servidores"] },
  { slug: "microsoft-365", name: "Microsoft 365", titleTpl: "Microsoft 365 em {city} | WMTi", descTpl: "Microsoft 365 para empresas em {city}. E-mail corporativo, Teams e SharePoint. WMTi.", h1Prefix: "Microsoft 365 em ", contentTpl: "A WMTi oferece Microsoft 365 para empresas em {city}. Exchange Online, Teams, SharePoint e OneDrive.", relatedSlugs: ["suporte-ti", "seguranca-rede", "infraestrutura-ti"] },
  { slug: "seguranca-rede", name: "Segurança De Rede", titleTpl: "Segurança de Rede em {city} | WMTi", descTpl: "Segurança de rede para empresas em {city}. Firewall pfSense, VPN e proteção contra ataques. WMTi.", h1Prefix: "Segurança de Rede em ", contentTpl: "A WMTi implementa segurança de rede para empresas em {city}. Firewall pfSense, antivírus ESET, VPN e monitoramento contra ameaças.", relatedSlugs: ["firewall-corporativo", "monitoramento-rede", "servidores-dell"] },
  { slug: "locacao-computadores", name: "Locação De Computadores", titleTpl: "Locação de Computadores em {city} | WMTi", descTpl: "Locação de computadores Dell para empresas em {city}. Manutenção e suporte inclusos. WMTi.", h1Prefix: "Locação de Computadores em ", contentTpl: "A WMTi oferece locação de computadores Dell OptiPlex para empresas em {city} com manutenção e suporte inclusos.", relatedSlugs: ["suporte-ti", "infraestrutura-ti", "microsoft-365"] },
  { slug: "administracao-servidores", name: "Administração De Servidores", titleTpl: "Administração de Servidores em {city} | WMTi", descTpl: "Administração de servidores Windows e Linux em {city}. Active Directory, Hyper-V e monitoramento. WMTi.", h1Prefix: "Administração de Servidores em ", contentTpl: "A WMTi oferece administração de servidores corporativos em {city}. Windows Server, Linux, Active Directory e virtualização.", relatedSlugs: ["servidores-dell", "monitoramento-servidores", "suporte-ti"] },
  { slug: "monitoramento-servidores", name: "Monitoramento De Servidores", titleTpl: "Monitoramento de Servidores em {city} | WMTi", descTpl: "Monitoramento 24/7 de servidores em {city}. Alertas e prevenção de falhas. WMTi.", h1Prefix: "Monitoramento de Servidores em ", contentTpl: "A WMTi monitora servidores 24/7 para empresas em {city} com alertas em tempo real e suporte proativo.", relatedSlugs: ["administracao-servidores", "servidores-dell", "suporte-ti"] },
  { slug: "backup-corporativo", name: "Backup Corporativo", titleTpl: "Backup Corporativo em {city} | WMTi", descTpl: "Backup corporativo com Veeam em {city}. Replicação local e nuvem. WMTi.", h1Prefix: "Backup Corporativo em ", contentTpl: "A WMTi implementa backup corporativo com Veeam para empresas em {city}. Estratégia 3-2-1 e criptografia.", relatedSlugs: ["servidores-dell", "seguranca-rede", "infraestrutura-ti"] },
  { slug: "firewall-corporativo", name: "Firewall Corporativo", titleTpl: "Firewall pfSense em {city} | WMTi", descTpl: "Firewall pfSense para empresas em {city}. VPN, IDS/IPS e segmentação. WMTi.", h1Prefix: "Firewall Corporativo em ", contentTpl: "A WMTi implanta firewalls pfSense com IDS/IPS Suricata para empresas em {city}. VPN e segmentação por VLANs.", relatedSlugs: ["seguranca-rede", "monitoramento-rede", "infraestrutura-ti"] },
  { slug: "infraestrutura-rede", name: "Infraestrutura De Rede", titleTpl: "Infraestrutura de Rede em {city} | WMTi", descTpl: "Redes corporativas em {city}. Cabeamento, switches e Wi-Fi empresarial. WMTi.", h1Prefix: "Infraestrutura de Rede em ", contentTpl: "A WMTi projeta redes corporativas em {city}: cabeamento Cat6A, switches Dell gerenciáveis e Wi-Fi empresarial.", relatedSlugs: ["monitoramento-rede", "seguranca-rede", "firewall-corporativo"] },
  { slug: "suporte-emergencial", name: "Suporte Emergencial", titleTpl: "Suporte Emergencial em {city} | WMTi", descTpl: "Suporte emergencial para empresas em {city}. Atendimento imediato. WMTi.", h1Prefix: "Suporte Emergencial em ", contentTpl: "A WMTi oferece suporte emergencial para empresas em {city} com atendimento imediato para servidores e redes.", relatedSlugs: ["suporte-ti", "administracao-servidores", "infraestrutura-ti"] },
  { slug: "suporte-windows-server", name: "Suporte Windows Server", titleTpl: "Suporte Windows Server em {city} | WMTi", descTpl: "Suporte Windows Server em {city}. Active Directory, GPOs e Hyper-V. WMTi.", h1Prefix: "Suporte Windows Server em ", contentTpl: "A WMTi oferece suporte Windows Server em {city}: Active Directory, GPOs, Hyper-V e manutenção preventiva.", relatedSlugs: ["suporte-linux", "administracao-servidores", "servidores-dell"] },
  { slug: "suporte-linux", name: "Suporte Linux", titleTpl: "Suporte Linux em {city} | WMTi", descTpl: "Suporte Linux corporativo em {city}. Ubuntu, CentOS, Docker. WMTi.", h1Prefix: "Suporte Linux em ", contentTpl: "A WMTi oferece suporte Linux em {city}: Ubuntu Server, CentOS, Debian, Docker e hardening.", relatedSlugs: ["suporte-windows-server", "administracao-servidores", "firewall-corporativo"] },
  { slug: "manutencao-ti", name: "Manutenção De TI", titleTpl: "Manutenção de TI em {city} | WMTi", descTpl: "Manutenção de infraestrutura de TI em {city}. Servidores, redes e firewalls. WMTi.", h1Prefix: "Manutenção de TI em ", contentTpl: "A WMTi realiza manutenção preventiva e corretiva de TI em {city}: servidores, redes, firewalls e equipamentos.", relatedSlugs: ["suporte-ti", "monitoramento-servidores", "infraestrutura-ti"] },
  { slug: "suporte-redes-corporativas", name: "Suporte Para Redes", titleTpl: "Suporte Para Redes em {city} | WMTi", descTpl: "Suporte para redes corporativas em {city}. Diagnóstico e manutenção. WMTi.", h1Prefix: "Suporte Para Redes em ", contentTpl: "A WMTi oferece suporte para redes corporativas em {city}: switches, access points, cabeamento e monitoramento.", relatedSlugs: ["infraestrutura-rede", "monitoramento-rede", "suporte-ti"] },
  { slug: "terceirizacao-ti", name: "Terceirização De TI", titleTpl: "Terceirização de TI em {city} | WMTi", descTpl: "Terceirização de TI em {city}. Equipe dedicada e gestão de infraestrutura. WMTi.", h1Prefix: "Terceirização de TI em ", contentTpl: "A WMTi oferece terceirização de TI em {city} com profissionais especializados para gestão completa da infraestrutura.", relatedSlugs: ["suporte-ti", "infraestrutura-ti", "administracao-servidores"] },
  { slug: "automacao-ia", name: "Automação Com IA", titleTpl: "Automação de TI com IA em {city} | WMTi", descTpl: "Automação de TI com IA em {city}. Elimine tarefas manuais e ganhe velocidade. WMTi.", h1Prefix: "Automação de TI com IA em ", contentTpl: "A WMTi implementa automação de TI com IA em {city}: fluxos automáticos, atendimento inteligente e integração de sistemas.", relatedSlugs: ["suporte-ti", "infraestrutura-ti", "desenvolvimento-web"] },
  { slug: "automacao-alexa", name: "Automação Com Alexa", titleTpl: "Automação com Alexa em {city} | WMTi", descTpl: "Automação com Alexa em {city}. Casa e empresa inteligente. WMTi.", h1Prefix: "Automação com Alexa em ", contentTpl: "A WMTi implementa automação com Alexa em {city}: iluminação, câmeras, fechaduras e rotinas inteligentes.", relatedSlugs: ["infraestrutura-rede", "seguranca-rede", "suporte-ti"] },
  { slug: "reestruturacao-rede", name: "Reestruturação De Rede", titleTpl: "Reestruturação de Rede em {city} | WMTi", descTpl: "Reestruturação de rede corporativa em {city}. Cabeamento, VLANs e Wi-Fi. WMTi.", h1Prefix: "Reestruturação de Rede em ", contentTpl: "A WMTi reestrutura redes corporativas em {city}: cabeamento Cat6A, switches Dell, VLANs e Wi-Fi empresarial.", relatedSlugs: ["infraestrutura-rede", "monitoramento-rede", "seguranca-rede"] },
  { slug: "desenvolvimento-web", name: "Desenvolvimento Web", titleTpl: "Desenvolvimento Web em {city} | WMTi", descTpl: "Sites e sistemas web em {city}. Landing pages, portais e automações. WMTi.", h1Prefix: "Desenvolvimento Web em ", contentTpl: "A WMTi desenvolve sites e sistemas web em {city}: landing pages, portais corporativos e integrações.", relatedSlugs: ["automacao-ia", "suporte-ti", "infraestrutura-ti"] },
];

const segmentPrefixMap: Record<string, string> = {
  "serventias-cartoriais": "ti-para-serventias-cartoriais",
  "tabelionatos-notas": "ti-para-tabelionatos-de-notas",
  "oficios-registro": "ti-para-oficios-de-registro",
  "tabelionatos-protesto": "ti-para-tabelionatos-de-protesto",
  "serventias-notariais": "ti-para-serventias-notariais",
  hospitais: "ti-para-hospitais",
  "escritorios-advocacia": "ti-para-escritorios-de-advocacia",
  contabilidade: "ti-para-contabilidades",
  "industrias-alimenticias": "ti-para-industrias-alimenticias",
  "industrias-petroliferas": "ti-para-industrias-petroliferas",
  "empresas-corporativas": "ti-para-empresas-corporativas",
};

const segments: SegData[] = [
  { slug: "serventias-cartoriais", name: "Serventias Cartoriais", titleSuffix: "para Serventias Cartoriais", descExtra: "Conformidade com o Provimento 213 do CNJ, backup automatizado e infraestrutura homologada.", painPoints: ["Dificuldade com Provimento 213", "Falta de backup", "Sistemas lentos"] },
  { slug: "tabelionatos-notas", name: "Tabelionatos de Notas", titleSuffix: "para Tabelionatos de Notas", descExtra: "Conformidade ao Provimento 213, backup automatizado e continuidade operacional.", painPoints: ["Parada operacional", "Backup não testado", "Provimento 213"] },
  { slug: "oficios-registro", name: "Ofícios de Registro", titleSuffix: "para Ofícios de Registro", descExtra: "Replicação geográfica do acervo e integração com centrais eletrônicas.", painPoints: ["Sem replicação", "Integração instável", "Servidor único"] },
  { slug: "tabelionatos-protesto", name: "Tabelionatos de Protesto", titleSuffix: "para Tabelionatos de Protesto", descExtra: "Integração CRA/IEPTB e conformidade ao Provimento 213.", painPoints: ["CRA instável", "Atraso em prazos", "Integração IEPTB"] },
  { slug: "hospitais", name: "Hospitais e Clínicas", titleSuffix: "para Hospitais e Clínicas", descExtra: "Alta disponibilidade, LGPD e sistemas HIS/PACS.", painPoints: ["Sistemas instáveis", "Falta de LGPD", "Sem redundância"] },
  { slug: "escritorios-advocacia", name: "Escritórios de Advocacia", titleSuffix: "para Escritórios de Advocacia", descExtra: "VPN, backup criptografado e proteção de dados.", painPoints: ["Vazamento de dados", "Sem VPN", "Sistemas lentos"] },
  { slug: "contabilidade", name: "Escritórios de Contabilidade", titleSuffix: "para Contabilidades", descExtra: "Backup fiscal, servidores seguros e integração contábil.", painPoints: ["Perda de dados fiscais", "Lentidão em fechamento", "Falta de segurança"] },
  { slug: "industrias-alimenticias", name: "Indústrias Alimentícias", titleSuffix: "para Indústrias Alimentícias", descExtra: "Redes segmentadas, monitoramento 24/7 e integração ERP.", painPoints: ["Rede instável", "Falta de integração", "Sem monitoramento"] },
  { slug: "industrias-petroliferas", name: "Indústrias Petrolíferas", titleSuffix: "para Indústrias Petrolíferas", descExtra: "Infraestrutura resiliente, segurança avançada e operação 24/7.", painPoints: ["TI vulnerável", "Sem redundância", "Sem segmentação"] },
  { slug: "empresas-corporativas", name: "Empresas Corporativas", titleSuffix: "para Empresas Corporativas", descExtra: "Servidores Dell, redes segmentadas, backup e monitoramento 24/7.", painPoints: ["Servidores instáveis", "Rede sem segmentação", "Sem backup"] },
];

const problems: ProbData[] = [
  { slug: "rede-lenta", name: "Rede Lenta", h1Tpl: "Rede lenta na sua empresa em {city}?", desc: "Rede lenta na empresa pode estar na infraestrutura. A WMTi diagnostica e resolve.", painPoints: ["Internet lenta", "Quedas de conexão", "Demora em sistemas", "Wi-Fi instável"], solutionIntro: "Diagnóstico completo com cabeamento estruturado, switches gerenciáveis e firewall pfSense." },
  { slug: "servidor-travando", name: "Servidor Travando", h1Tpl: "Servidor travando na sua empresa em {city}?", desc: "Servidores que travam comprometem a operação. A WMTi identifica e resolve.", painPoints: ["Servidor reiniciando", "Lentidão em arquivos", "Erros frequentes", "Sem manutenção"], solutionIntro: "Diagnóstico de hardware/software, RAID, virtualização e migração para Dell PowerEdge." },
  { slug: "sem-backup", name: "Sem Backup", h1Tpl: "Sua empresa em {city} não tem backup?", desc: "Sem backup profissional, dados estão em risco. A WMTi implementa backup corporativo.", painPoints: ["Nenhuma política de backup", "Backup manual", "Sem teste de restauração", "Sem cópia em nuvem"], solutionIntro: "Backup automatizado com cópias locais e em nuvem, testes periódicos e monitoramento." },
  { slug: "ataque-ransomware", name: "Ataque Ransomware", h1Tpl: "Proteção contra ransomware em {city}", desc: "Ransomware sequestra dados e paralisa empresas. A WMTi protege contra esse tipo de ameaça.", painPoints: ["Links maliciosos", "Sem firewall", "Sem segmentação", "Backup inexistente"], solutionIntro: "Firewall pfSense, ESET, segmentação de rede, backup offline e treinamento." },
  { slug: "computadores-lentos", name: "Computadores Lentos", h1Tpl: "Computadores lentos em {city}?", desc: "Computadores lentos reduzem produtividade. A WMTi resolve.", painPoints: ["Demora para ligar", "Travamentos", "Computadores antigos", "Sem manutenção"], solutionIntro: "Locação Dell OptiPlex ou manutenção preventiva do parque existente." },
  { slug: "servidor-lento-empresa", name: "Servidor Lento", h1Tpl: "Servidor lento em {city}?", desc: "Servidor lento compromete a produtividade. A WMTi diagnostica gargalos.", painPoints: ["Sistemas lentos", "CPU no limite", "Discos antigos", "Sem monitoramento"], solutionIntro: "Diagnóstico, otimização, upgrade e migração para Dell PowerEdge." },
  { slug: "rede-corporativa-instavel", name: "Rede Instável", h1Tpl: "Rede instável em {city}?", desc: "Rede instável causa interrupções constantes. A WMTi projeta redes estruturadas.", painPoints: ["Quedas de conexão", "Switches domésticos", "Cabeamento ruim", "Wi-Fi deficiente"], solutionIntro: "Cabeamento Cat6A, switches Dell gerenciáveis, VLANs e Wi-Fi empresarial." },
  { slug: "empresa-sem-backup", name: "Empresa Sem Backup", h1Tpl: "Empresa sem backup em {city}?", desc: "Operar sem backup é risco crítico. A WMTi implementa backup profissional.", painPoints: ["Sem backup automatizado", "Dados só local", "Backup em pendrive", "Sem plano de recuperação"], solutionIntro: "Veeam, estratégia 3-2-1, nuvem Azure e testes de restauração." },
  { slug: "empresa-sem-firewall", name: "Sem Firewall", h1Tpl: "Empresa sem firewall em {city}?", desc: "Sem firewall, rede exposta a ataques. A WMTi implanta pfSense.", painPoints: ["Rede exposta", "Roteador doméstico", "Sem controle de acesso", "Sem VPN"], solutionIntro: "pfSense com IDS/IPS Suricata, VPN e segmentação de rede." },
  { slug: "empresa-com-virus", name: "Empresa Com Vírus", h1Tpl: "Vírus nos computadores em {city}?", desc: "Vírus comprometem segurança e produtividade. A WMTi remove e protege.", painPoints: ["Computadores infectados", "Pop-ups suspeitos", "Mineradores", "Antivírus gratuito"], solutionIntro: "Remoção, ESET corporativo e políticas de segurança." },
  { slug: "empresa-sem-monitoramento-ti", name: "Sem Monitoramento", h1Tpl: "Empresa sem monitoramento de TI em {city}?", desc: "Sem monitoramento, problemas só aparecem quando paralisam a operação.", painPoints: ["Problemas tardios", "Sem visibilidade", "Sem métricas", "Não prevê falhas"], solutionIntro: "Monitoramento Zabbix/Grafana com alertas automáticos." },
  { slug: "empresa-com-servidor-antigo", name: "Servidor Antigo", h1Tpl: "Servidor antigo em {city}?", desc: "Servidores antigos representam risco de falha e perda de dados.", painPoints: ["Mais de 5 anos", "Sem garantia", "SO desatualizado", "Performance baixa"], solutionIntro: "Migração para Dell PowerEdge com RAID, Hyper-V e redundância." },
  { slug: "empresa-com-problemas-ti", name: "Problemas de TI", h1Tpl: "Problemas de TI em {city}?", desc: "Problemas recorrentes indicam falta de gestão profissional. A WMTi assume.", painPoints: ["Chamados constantes", "Sem TI dedicado", "Sem planejamento", "Custos altos"], solutionIntro: "Gestão completa de TI com equipe dedicada e SLA." },
  { slug: "suporte-ti-urgente", name: "Suporte Urgente", h1Tpl: "Suporte urgente em {city}?", desc: "Quando a TI para, a empresa para. Suporte emergencial imediato.", painPoints: ["Servidor parou", "Rede caiu", "Ataque em andamento", "Sem suporte"], solutionIntro: "Atendimento imediato com diagnóstico rápido e resolução prioritária." },
  { slug: "empresa-precisa-suporte-ti", name: "Precisa de Suporte", h1Tpl: "Precisa de suporte de TI em {city}?", desc: "Suporte profissional elimina problemas recorrentes e reduz custos.", painPoints: ["Sem equipe interna", "Técnicos avulsos", "Soluções paliativas", "Sem manutenção"], solutionIntro: "Planos de suporte corporativo com SLA, monitoramento e equipe dedicada." },
  { slug: "empresa-com-problema-rede", name: "Problema na Rede", h1Tpl: "Problema na rede em {city}?", desc: "Problemas de rede afetam produtividade e faturamento.", painPoints: ["Lentidão na rede", "Quedas intermitentes", "Impressoras desconectando", "Wi-Fi ruim"], solutionIntro: "Diagnóstico completo, switches gerenciáveis, cabeamento e pfSense." },
  { slug: "empresa-com-servidor-caindo", name: "Servidor Caindo", h1Tpl: "Servidor caindo em {city}?", desc: "Servidor que cai paralisa a operação e pode causar perda de dados.", painPoints: ["Reiniciando sozinho", "Conexão intermitente", "Tela azul", "Discos com erro"], solutionIntro: "Diagnóstico, RAID, monitoramento e migração para Dell PowerEdge." },
  { slug: "empresa-com-sistema-lento", name: "Sistema Lento", h1Tpl: "Sistemas lentos em {city}?", desc: "Sistemas lentos indicam problemas na infraestrutura de TI.", painPoints: ["ERP lento", "Banco de dados lento", "Servidor subdimensionado", "Sem QoS"], solutionIntro: "Servidores dimensionados, SSD, QoS e monitoramento de performance." },
  { slug: "empresa-sem-infraestrutura-ti", name: "Sem Infraestrutura", h1Tpl: "Precisa de infraestrutura de TI em {city}?", desc: "Sem TI profissional: instabilidade, riscos e baixa produtividade.", painPoints: ["Sem servidor", "Rede sem planejamento", "Sem firewall/backup", "Equipamentos domésticos"], solutionIntro: "Infraestrutura completa: servidores, rede, firewall, backup e monitoramento 24/7." },
];

// Cities will be loaded from a compact JSON-like structure
// For performance, we embed the top ~100 cities and load more from DB if needed
const topCities: CityData[] = [
  { name: "Jacareí", slug: "jacarei", region: "Vale do Paraíba", population: 240000, context: "polo industrial e tecnológico" },
  { name: "São José dos Campos", slug: "sao-jose-dos-campos", region: "Vale do Paraíba", population: 737000, context: "sede de empresas aeroespaciais" },
  { name: "Taubaté", slug: "taubate", region: "Vale do Paraíba", population: 320000 },
  { name: "Caçapava", slug: "cacapava", region: "Vale do Paraíba", population: 95000 },
  { name: "Pindamonhangaba", slug: "pindamonhangaba", region: "Vale do Paraíba", population: 170000 },
  { name: "Guaratinguetá", slug: "guaratingueta", region: "Vale do Paraíba", population: 125000 },
  { name: "São Paulo", slug: "sao-paulo", region: "Grande São Paulo", population: 12400000 },
  { name: "Campinas", slug: "campinas", region: "Região Metropolitana de Campinas", population: 1220000 },
  { name: "Santos", slug: "santos", region: "Baixada Santista", population: 433000 },
  { name: "Sorocaba", slug: "sorocaba", region: "Região de Sorocaba", population: 695000 },
  { name: "Ribeirão Preto", slug: "ribeirao-preto", region: "Região de Ribeirão Preto", population: 720000 },
  { name: "Osasco", slug: "osasco", region: "Grande São Paulo", population: 699000 },
  { name: "Guarulhos", slug: "guarulhos", region: "Grande São Paulo", population: 1392000 },
  { name: "Barueri", slug: "barueri", region: "Grande São Paulo", population: 275000 },
  { name: "Jundiaí", slug: "jundiai", region: "Região de Jundiaí", population: 423000 },
  { name: "Piracicaba", slug: "piracicaba", region: "Região de Piracicaba", population: 410000 },
  { name: "Mogi das Cruzes", slug: "mogi-das-cruzes", region: "Grande São Paulo", population: 445000 },
  { name: "Bauru", slug: "bauru", region: "Região de Bauru", population: 380000 },
  { name: "Lorena", slug: "lorena", region: "Vale do Paraíba", population: 90000 },
  { name: "Cruzeiro", slug: "cruzeiro", region: "Vale do Paraíba", population: 80000 },
  { name: "Caraguatatuba", slug: "caraguatatuba", region: "Vale do Paraíba", population: 125000 },
  { name: "Campos do Jordão", slug: "campos-do-jordao", region: "Vale do Paraíba", population: 55000 },
];

const cityBySlug = new Map<string, CityData>(topCities.map(c => [c.slug, c]));

// Build entity prefix maps
const svcByPrefix = new Map<string, SvcData>(services.map(s => [s.slug, s]));
// Service aliases
const svcAliases: Record<string, string> = {
  "automacao-alexa-casa-empresa-inteligente": "automacao-alexa",
  "automacao-de-ti-com-inteligencia-artificial": "automacao-ia",
};
for (const [alias, canonical] of Object.entries(svcAliases)) {
  const svc = svcByPrefix.get(canonical);
  if (svc) svcByPrefix.set(alias, svc);
}

const segByPrefix = new Map<string, SegData>();
for (const seg of segments) {
  const prefix = segmentPrefixMap[seg.slug] || `ti-para-${seg.slug}`;
  segByPrefix.set(prefix, seg);
}

const probBySlug = new Map<string, ProbData>(problems.map(p => [p.slug, p]));

function fill(tpl: string, city: string): string {
  return tpl.replace(/\{city\}/g, city);
}

// Parse dynamic slug
function parseDynamicSlug(slug: string): PageMeta | null {
  const emIdx = slug.lastIndexOf("-em-");
  if (emIdx <= 0) return null;

  const entityPart = slug.substring(0, emIdx);
  const citySlug = slug.substring(emIdx + 4);
  const city = cityBySlug.get(citySlug);
  if (!city) return null;

  // Service?
  const svc = svcByPrefix.get(entityPart);
  if (svc) {
    const relLinks = svc.relatedSlugs.map(rs => {
      const rel = svcByPrefix.get(rs);
      return { label: `${rel?.name || rs} em ${city.name}`, href: `/${rs}-em-${citySlug}` };
    });
    return {
      title: fill(svc.titleTpl, city.name),
      description: fill(svc.descTpl, city.name),
      h1: svc.h1Prefix + city.name,
      content: fill(svc.contentTpl, city.name),
      links: relLinks,
    };
  }

  // Segment?
  const seg = segByPrefix.get(entityPart);
  if (seg) {
    return {
      title: `TI ${seg.titleSuffix} em ${city.name} | WMTi`,
      description: `Soluções de TI ${seg.titleSuffix.toLowerCase()} em ${city.name}. ${seg.descExtra} WMTi.`,
      h1: `TI ${seg.titleSuffix} em ${city.name}`,
      content: `A WMTi oferece soluções de TI ${seg.titleSuffix.toLowerCase()} em ${city.name}. ${seg.descExtra}`,
      links: [
        { label: `Infraestrutura de TI em ${city.name}`, href: `/infraestrutura-ti-em-${citySlug}` },
        { label: `Suporte Técnico em ${city.name}`, href: `/suporte-ti-em-${citySlug}` },
      ],
    };
  }

  // Problem?
  const prob = probBySlug.get(entityPart);
  if (prob) {
    return {
      title: `${fill(prob.h1Tpl, city.name)} | WMTi`,
      description: `${prob.desc} Atendemos ${city.name}.`,
      h1: fill(prob.h1Tpl, city.name),
      content: `${fill(prob.desc, city.name)} ${prob.solutionIntro}`,
      links: [
        { label: `Suporte Técnico em ${city.name}`, href: `/suporte-ti-em-${citySlug}` },
        { label: `Infraestrutura de TI em ${city.name}`, href: `/infraestrutura-ti-em-${citySlug}` },
      ],
    };
  }

  return null;
}

// Render full HTML
function renderHtml(page: PageMeta, path: string, extraSections = ""): string {
  const canonical = `${CANONICAL}${path}`;
  const linksHtml = page.links.map(l =>
    `<li><a href="${esc(l.href)}">${esc(l.label)}</a></li>`
  ).join("\n");

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${esc(page.title)}</title>
  <meta name="description" content="${esc(page.description)}" />
  <link rel="canonical" href="${canonical}" />
  <meta name="robots" content="index, follow" />
  <meta property="og:title" content="${esc(page.title)}" />
  <meta property="og:description" content="${esc(page.description)}" />
  <meta property="og:type" content="website" />
  <meta property="og:url" content="${canonical}" />
  <meta property="og:site_name" content="${esc(page.siteName || "WMTi Tecnologia da Informação")}" />
  <meta property="og:locale" content="pt_BR" />
  <meta property="og:image" content="${CANONICAL}${page.ogImage || "/wmti-preview.jpg"}" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${esc(page.title)}" />
  <meta name="twitter:description" content="${esc(page.description)}" />
  <meta name="twitter:image" content="${CANONICAL}${page.ogImage || "/wmti-preview.jpg"}" />
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "name": "${esc(page.title)}",
    "description": "${esc(page.description)}",
    "url": "${canonical}",
    "publisher": {
      "@type": "Organization",
      "name": "WMTi Soluções em TI",
      "url": "${CANONICAL}"
    }
  }
  </script>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:system-ui,-apple-system,sans-serif;background:#0a0a0a;color:#e5e5e5;line-height:1.6}
    .c{max-width:900px;margin:0 auto;padding:2rem 1rem}
    h1{font-size:1.8rem;color:#fff;margin-bottom:1rem}
    p{margin-bottom:1rem;color:#ccc}
    nav.bc{margin-bottom:1rem;font-size:.85rem}
    nav.bc a{color:#60a5fa;text-decoration:none}
    .links{margin-top:2rem}
    .links h2{font-size:1.2rem;color:#fff;margin-bottom:.75rem}
    .links ul{list-style:none;padding:0}
    .links li{margin-bottom:.5rem}
    .links a{color:#60a5fa;text-decoration:none}
    .links a:hover{text-decoration:underline}
    .cta{display:inline-block;margin-top:1.5rem;padding:.75rem 1.5rem;background:#f97316;color:#fff;border-radius:8px;text-decoration:none;font-weight:600}
    .section{margin-top:2rem;padding:1.5rem;background:#1a1a1a;border-radius:12px;border:1px solid #333}
    .section h2{font-size:1.1rem;color:#fff;margin-bottom:.75rem}
    footer{text-align:center;margin-top:3rem;padding:1.5rem;color:#666;font-size:.8rem;border-top:1px solid #222}
  </style>
</head>
<body>
  <div class="c">
    <nav class="bc">
      <a href="/">Home</a> › <span>${esc(page.h1)}</span>
    </nav>
    <h1>${esc(page.h1)}</h1>
    <p>${esc(page.content)}</p>
    <a class="cta" href="https://api.whatsapp.com/send?phone=5512981156000&text=${encodeURIComponent("Olá! Gostaria de saber mais sobre " + page.h1)}">Fale com um especialista</a>
    ${extraSections}
    <div class="links">
      <h2>Veja também</h2>
      <ul>
${linksHtml}
      </ul>
    </div>
  </div>
  <footer>
    <p>© ${new Date().getFullYear()} WMTi Tecnologia da Informação — Jacareí/SP</p>
    <nav>
      <a href="/">Home</a> · <a href="/servicos">Serviços</a> · <a href="/blog">Blog</a> · <a href="/orcamento-ti">Orçamento</a> · <a href="/institucional">Institucional</a>
    </nav>
  </footer>
  <script>
    if(typeof window!=='undefined'&&!navigator.userAgent.match(/bot|crawl|spider|slurp|Googlebot|Bingbot|Yandex|Baidu|DuckDuckBot|Sogou|Exabot|ia_archiver/i)){
      window.location.replace('${CANONICAL}${path}');
    }
  </script>
</body>
</html>`;
}

// Blog post prerender
async function renderBlogPost(slug: string): Promise<PageMeta | null> {
  const supabase = getSupabase();
  const { data } = await supabase
    .from("blog_posts_ai")
    .select("title, meta_title, meta_description, excerpt, content_md, category, tag, published_at, slug")
    .eq("slug", slug)
    .eq("status", "published")
    .single();

  if (!data) return null;

  // Extract first 500 chars of content as text
  const contentText = (data.content_md || "").replace(/[#*_\[\]()]/g, "").substring(0, 600);

  return {
    title: data.meta_title || data.title,
    description: data.meta_description || data.excerpt || "",
    h1: data.title,
    content: contentText,
    links: [
      { label: "Todos os artigos", href: "/blog" },
      { label: "Serviços de TI", href: "/servicos" },
      { label: "Orçamento", href: "/orcamento-ti" },
    ],
  };
}

// ─── Main handler ───
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  let path = url.searchParams.get("path") || "/";

  // Normalize path
  if (!path.startsWith("/")) path = "/" + path;
  path = path.replace(/\/+$/, "") || "/";

  // 1. Check static pages
  const staticPage = staticPages[path];
  if (staticPage) {
    return new Response(renderHtml(staticPage, path), {
      headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8", "Cache-Control": "public, max-age=3600, s-maxage=3600" },
    });
  }

  // 1b. Quero Armas pages (custom OG branding)
  if (path === "/quero-armas" || path.startsWith("/quero-armas/")) {
    const qaPage = renderQuerArmasPage(path);
    return new Response(renderHtml(qaPage, path), {
      headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8", "Cache-Control": "public, max-age=3600" },
    });
  }

  // 2. Blog listing — delegate to existing blog-prerender
  if (path === "/blog") {
    const staticBlog = staticPages["/blog"]!;
    return new Response(renderHtml(staticBlog, path), {
      headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8", "Cache-Control": "public, max-age=3600" },
    });
  }

  // 3. Blog post
  if (path.startsWith("/blog/")) {
    const slug = path.replace("/blog/", "");
    const blogPage = await renderBlogPost(slug);
    if (blogPage) {
      return new Response(renderHtml(blogPage, path), {
        headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8", "Cache-Control": "public, max-age=3600" },
      });
    }
  }

  // 4. Dynamic SEO pages (entity-em-city)
  const slug = path.replace(/^\//, "");
  const dynamicPage = parseDynamicSlug(slug);
  if (dynamicPage) {
    return new Response(renderHtml(dynamicPage, path), {
      headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8", "Cache-Control": "public, max-age=86400, s-maxage=86400" },
    });
  }

  // 5. Try CMS pages
  try {
    const supabase = getSupabase();
    const { data: cmsPage } = await supabase
      .from("cms_pages")
      .select("title, meta_title, meta_description, slug")
      .eq("slug", slug)
      .eq("status", "published")
      .single();

    if (cmsPage) {
      const cms: PageMeta = {
        title: cmsPage.meta_title || cmsPage.title,
        description: cmsPage.meta_description || "",
        h1: cmsPage.title,
        content: cmsPage.meta_description || cmsPage.title,
        links: [{ label: "Serviços", href: "/servicos" }, { label: "Home", href: "/" }],
      };
      return new Response(renderHtml(cms, path), {
        headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8", "Cache-Control": "public, max-age=3600" },
      });
    }
  } catch (_) { /* ignore */ }

  // 6. Try seoPages static registry (findPageBySlug equivalent) — check via CMS redirects
  try {
    const supabase = getSupabase();
    const { data: redirect } = await supabase
      .from("cms_redirects")
      .select("to_slug")
      .eq("from_slug", slug)
      .eq("active", true)
      .single();

    if (redirect) {
      return new Response(null, {
        status: 301,
        headers: { ...corsHeaders, "Location": `/${redirect.to_slug}` },
      });
    }
  } catch (_) { /* ignore */ }

  // 404
  return new Response(renderHtml({
    title: "Página não encontrada | WMTi",
    description: "A página solicitada não foi encontrada.",
    h1: "Página não encontrada",
    content: "A página que você está procurando não existe ou foi movida. Navegue pelos nossos serviços de TI corporativa.",
    links: [
      { label: "Home", href: "/" },
      { label: "Serviços", href: "/servicos" },
      { label: "Blog", href: "/blog" },
      { label: "Orçamento", href: "/orcamento-ti" },
    ],
  }, path).replace('content="index, follow"', 'content="noindex, nofollow"'), {
    status: 404,
    headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-cache" },
  });
});
