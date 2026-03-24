// Test data fixtures for QA tests

export const FIXTURE_PJ = {
  cnpj: "33814058000128",
  razaoSocial: "SPACE COMERCIO DE LUBRIFICANTES E FLUIDOS LTDA",
  nomeFantasia: "CASA DO OLEO JACAREI",
  responsavel: "QA Tester",
  email: "qa-test@wmti.com.br",
  telefone: "(12) 3965-9900",
  cep: "12327682",
  cidade: "Jacareí",
  endereco: "Avenida Nove de Julho, 431",
};

export const FIXTURE_MACHINES = [1, 2, 5, 6, 10, 20, 30];

export const WHATSAPP_NUMBER = "5512981436343";
export const WHATSAPP_BASE = "https://wa.me/" + WHATSAPP_NUMBER;

export const ALL_PUBLIC_ROUTES = [
  "/", "/servicos", "/locacao", "/infraestrutura", "/cartorios",
  "/institucional", "/blog", "/orcamento-ti", "/area-do-cliente",
  "/firewall-pfsense-jacarei", "/servidor-dell-poweredge-jacarei",
  "/microsoft-365-para-empresas-jacarei", "/montagem-e-monitoramento-de-redes-jacarei",
  "/locacao-de-computadores-para-empresas-jacarei", "/suporte-ti-jacarei",
  "/infraestrutura-ti-corporativa-jacarei",
  "/administracao-de-servidores", "/monitoramento-de-servidores",
  "/backup-corporativo", "/seguranca-de-rede", "/monitoramento-de-rede",
  "/suporte-tecnico-emergencial", "/suporte-windows-server", "/suporte-linux",
  "/manutencao-de-infraestrutura-de-ti", "/suporte-tecnico-para-redes-corporativas",
  "/reestruturacao-completa-de-rede-corporativa", "/desenvolvimento-de-sites-e-sistemas-web",
  "/ti-para-cartorios", "/ti-para-serventias-cartoriais",
  "/ti-para-industrias-alimenticias", "/ti-para-industrias-petroliferas",
  "/ti-para-escritorios-de-advocacia", "/ti-para-contabilidades",
  "/ti-para-escritorios-corporativos", "/ti-para-hospitais-e-clinicas",
  "/terceirizacao-de-mao-de-obra-ti", "/cartorios/provimento-213",
  "/redefinir-senha", "/contrato",
];

export const SERVICE_ROUTES = [
  "/firewall-pfsense-jacarei", "/servidor-dell-poweredge-jacarei",
  "/microsoft-365-para-empresas-jacarei", "/montagem-e-monitoramento-de-redes-jacarei",
  "/locacao-de-computadores-para-empresas-jacarei", "/suporte-ti-jacarei",
  "/infraestrutura-ti-corporativa-jacarei",
  "/administracao-de-servidores", "/monitoramento-de-servidores",
  "/backup-corporativo", "/seguranca-de-rede", "/monitoramento-de-rede",
  "/suporte-tecnico-emergencial", "/suporte-windows-server", "/suporte-linux",
  "/manutencao-de-infraestrutura-de-ti", "/suporte-tecnico-para-redes-corporativas",
  "/reestruturacao-completa-de-rede-corporativa", "/desenvolvimento-de-sites-e-sistemas-web",
];

export const SEGMENT_ROUTES = [
  "/ti-para-cartorios", "/ti-para-serventias-cartoriais",
  "/ti-para-industrias-alimenticias", "/ti-para-industrias-petroliferas",
  "/ti-para-escritorios-de-advocacia", "/ti-para-contabilidades",
  "/ti-para-escritorios-corporativos", "/ti-para-hospitais-e-clinicas",
  "/terceirizacao-de-mao-de-obra-ti",
];

export const CONTRATAR_SLUGS = [
  "administracao-de-servidores", "monitoramento-de-servidores",
  "backup-corporativo", "seguranca-de-rede", "monitoramento-de-rede",
  "suporte-tecnico-emergencial", "suporte-windows-server", "suporte-linux",
  "manutencao-de-infraestrutura-de-ti", "suporte-tecnico-para-redes-corporativas",
];

export const DEFAULT_CHECKLIST_ITEMS = [
  { module: "home" as const, description: "Home carrega sem erros visuais" },
  { module: "home" as const, description: "Menu de navegação funciona" },
  { module: "home" as const, description: "CTAs direcionam corretamente" },
  { module: "home" as const, description: "Responsivo no mobile" },
  { module: "servicos" as const, description: "Todas as páginas de serviço carregam" },
  { module: "servicos" as const, description: "Botões de orçamento funcionam" },
  { module: "servicos" as const, description: "Textos legíveis em fundo escuro" },
  { module: "segmentos" as const, description: "Páginas de segmento carregam" },
  { module: "segmentos" as const, description: "Links internos funcionam" },
  { module: "blog" as const, description: "Listagem do blog carrega" },
  { module: "blog" as const, description: "Posts individuais abrem" },
  { module: "contato" as const, description: "Formulário de contato funciona" },
  { module: "whatsapp" as const, description: "WhatsApp abre com número correto" },
  { module: "whatsapp" as const, description: "Mensagem pré-preenchida correta" },
  { module: "orcamento" as const, description: "Fluxo de orçamento completo funciona" },
  { module: "orcamento" as const, description: "Dados persistem entre etapas" },
  { module: "calculadora" as const, description: "Cálculos corretos para todos cenários" },
  { module: "calculadora" as const, description: "Desconto progressivo aplicado" },
  { module: "contratacao" as const, description: "Fluxo de contratação end-to-end" },
  { module: "checkout" as const, description: "Checkout carrega automaticamente" },
  { module: "checkout" as const, description: "Não requer segundo clique" },
  { module: "compra-concluida" as const, description: "Página pós-compra carrega" },
  { module: "contrato-pdf" as const, description: "PDF gera e abre corretamente" },
  { module: "contrato-pdf" as const, description: "Download funciona no mobile" },
  { module: "portal-cliente" as const, description: "Login funciona" },
  { module: "portal-cliente" as const, description: "Dados do cliente aparecem" },
  { module: "admin" as const, description: "Painel admin carrega" },
  { module: "admin" as const, description: "Todas as abas funcionam" },
  { module: "logs" as const, description: "Logs aparecem e filtram" },
  { module: "rotas" as const, description: "Nenhuma rota retorna 404 indevido" },
  { module: "seo" as const, description: "Todas as páginas têm título e meta" },
  { module: "responsividade" as const, description: "Site funcional em 375px" },
  { module: "integracoes" as const, description: "Brasil API (CNPJ/CEP) funciona" },
  { module: "webhooks" as const, description: "Webhooks Asaas processados" },
  { module: "edge-functions" as const, description: "Funções edge respondem" },
  { module: "storage" as const, description: "Storage de PDFs acessível" },
];
