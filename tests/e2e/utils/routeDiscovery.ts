export interface RouteSpec {
  path: string;
  label: string;
  /** Se true, espera-se que não-autenticados sejam redirecionados/logados. */
  protectedRoute?: boolean;
  /** Texto/role/heading esperado para considerar a tela "renderizada". */
  expectText?: string[];
}

/**
 * Rotas públicas conhecidas — espelham QARoutes.tsx.
 * Mantemos uma lista explícita para que a auditoria seja determinística.
 */
export const PUBLIC_ROUTES: RouteSpec[] = [
  { path: "/", label: "Home" },
  { path: "/servicos", label: "Serviços" },
  { path: "/descobrir-meu-caminho", label: "Quiz Descobrir Caminho" },
  { path: "/lp/defesa-pessoal-posse", label: "LP Defesa Pessoal" },
  { path: "/lp/cac-cr", label: "LP CAC/CR" },
  { path: "/lp/atividades-avulsas", label: "LP Atividades Avulsas" },
  { path: "/arsenal-digital-gratuito", label: "Arsenal Digital Gratuito" },
  { path: "/app-arsenal-gratuito", label: "App Arsenal Gratuito" },
  { path: "/login", label: "Login Equipe" },
  { path: "/redefinir-senha", label: "Redefinir Senha" },
  { path: "/cadastro", label: "Cadastro refinado" },
  { path: "/cadastro-mira", label: "Cadastro Mira (real)" },
  { path: "/cadastro/foto", label: "Enviar foto cadastro" },
  { path: "/enviar-foto", label: "Enviar foto" },
  { path: "/area-do-cliente/login", label: "Login Cliente" },
  { path: "/area-do-cliente/criar-conta", label: "Criar Conta Cliente" },
  { path: "/ativar-acesso", label: "Ativar Acesso" },
  { path: "/portal/acessar", label: "Portal Acessar" },
  { path: "/carrinho", label: "Carrinho" },
  { path: "/checkout/finalizar", label: "Checkout Finalizar" },
];

export const CLIENT_ROUTES: RouteSpec[] = [
  { path: "/area-do-cliente", label: "Área do Cliente", protectedRoute: true },
  {
    path: "/area-do-cliente/contratar",
    label: "Contratar (cliente)",
    protectedRoute: true,
  },
  {
    path: "/area-do-cliente/contratacoes",
    label: "Contratações (cliente)",
    protectedRoute: true,
  },
];

export const TEAM_ROUTES: RouteSpec[] = [
  { path: "/dashboard", label: "Dashboard Equipe", protectedRoute: true },
  { path: "/clientes", label: "Clientes", protectedRoute: true },
  { path: "/processos", label: "Processos", protectedRoute: true },
  { path: "/auditoria", label: "Auditoria", protectedRoute: true },
  { path: "/financeiro", label: "Financeiro", protectedRoute: true },
  { path: "/precos-servicos", label: "Preços Serviços", protectedRoute: true },
];

export const ALL_ROUTES: RouteSpec[] = [
  ...PUBLIC_ROUTES,
  ...CLIENT_ROUTES,
  ...TEAM_ROUTES,
];

/**
 * CPF fictício gerado com dígitos verificadores válidos, marcado claramente
 * como teste. Não corresponde a nenhuma pessoa real (usa o padrão de teste
 * "111.444.777-35" amplamente documentado em fóruns de QA).
 */
export const TEST_CPF = "11144477735";

export function testEmail(): string {
  return `cliente.playwright+${Date.now()}@example.com`;
}

export const TEST_USER = {
  nome: "Cliente Teste Playwright",
  cpf: TEST_CPF,
  telefone: "11999990000",
  cep: "01310100",
  endereco: "Avenida Paulista",
  numero: "1000",
  bairro: "Bela Vista",
  cidade: "São Paulo",
  uf: "SP",
};