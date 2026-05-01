import { lazy, Suspense } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { lazyRetry } from "@/lib/lazyRetry";
import QATacticalLoader from "@/components/quero-armas/QATacticalLoader";

const QALayout = lazyRetry(() => import("@/components/quero-armas/QALayout"), "QALayout");
const QALoginPage = lazyRetry(() => import("./QALoginPage"), "QALoginPage");
const QADashboardPage = lazyRetry(() => import("./QADashboardPage"), "QADashboardPage");
const QAMonitoramentoPage = lazyRetry(() => import("./QAMonitoramentoPage"), "QAMonitoramentoPage");
const QABaseConhecimentoPage = lazyRetry(() => import("./QABaseConhecimentoPage"), "QABaseConhecimentoPage");
const QADocumentoDetalhePage = lazyRetry(() => import("./QADocumentoDetalhePage"), "QADocumentoDetalhePage");
const QALegislacaoPage = lazyRetry(() => import("./QALegislacaoPage"), "QALegislacaoPage");
const QAJurisprudenciaPage = lazyRetry(() => import("./QAJurisprudenciaPage"), "QAJurisprudenciaPage");
const QAIAPage = lazyRetry(() => import("./QAIAPage"), "QAIAPage");
const QAGerarPecaPage = lazyRetry(() => import("./QAGerarPecaPage"), "QAGerarPecaPage");
const QACasosPage = lazyRetry(() => import("./QACasosPage"), "QACasosPage");
const QAModelosDocxPage = lazyRetry(() => import("./QAModelosDocxPage"), "QAModelosDocxPage");
const QAHistoricoPage = lazyRetry(() => import("./QAHistoricoPage"), "QAHistoricoPage");
const QAConfiguracoesPage = lazyRetry(() => import("./QAConfiguracoesPage"), "QAConfiguracoesPage");
const QAClientesPage = lazyRetry(() => import("./QAClientesPage"), "QAClientesPage");
const QAAcessosPage = lazyRetry(() => import("./QAAcessosPage"), "QAAcessosPage");
const QAClubesPage = lazyRetry(() => import("./QAClubesPage"), "QAClubesPage");
const QARelatoriosPage = lazyRetry(() => import("./QARelatoriosPage"), "QARelatoriosPage");
const QAFinanceiroPage = lazyRetry(() => import("./QAFinanceiroPage"), "QAFinanceiroPage");
const QAPrecosServicosPage = lazyRetry(() => import("./QAPrecosServicosPage"), "QAPrecosServicosPage");
const QARecursosAuditoriaPage = lazyRetry(() => import("./QARecursosAuditoriaPage"), "QARecursosAuditoriaPage");
const QAAuditoriaPage = lazyRetry(() => import("./QAAuditoriaPage"), "QAAuditoriaPage");
const QAProcessosAuditoriaPage = lazyRetry(() => import("./QAProcessosAuditoriaPage"), "QAProcessosAuditoriaPage");
const QAArmamentosAdminPage = lazyRetry(() => import("./QAArmamentosAdminPage"), "QAArmamentosAdminPage");
const QAProcessosPage = lazyRetry(() => import("./QAProcessosPage"), "QAProcessosPage");
const QACorrecoesIAPage = lazyRetry(() => import("./QACorrecoesIAPage"), "QACorrecoesIAPage");
const QACadastroPublicoPage = lazyRetry(() => import("./QACadastroPublicoPage"), "QACadastroPublicoPage");
const QAEnviarFotoPage = lazyRetry(() => import("./QAEnviarFotoPage"), "QAEnviarFotoPage");
const QAClienteLoginPage = lazyRetry(() => import("./QAClienteLoginPage"), "QAClienteLoginPage");
const QACriarContaPage = lazyRetry(() => import("./QACriarContaPage"), "QACriarContaPage");
const QAArsenalDigitalGratuitoPage = lazyRetry(() => import("./QAArsenalDigitalGratuitoPage"), "QAArsenalDigitalGratuitoPage");
const QAClientePortalPage = lazyRetry(() => import("./QAClientePortalPage"), "QAClientePortalPage");
const QAAtivarAcessoPage = lazyRetry(() => import("./QAAtivarAcessoPage"), "QAAtivarAcessoPage");
const QARedefinirSenhaPage = lazyRetry(() => import("./QARedefinirSenhaPage"), "QARedefinirSenhaPage");
const QAContratarServicoPage = lazyRetry(() => import("./QAContratarServicoPage"), "QAContratarServicoPage");
const QAContratarConfirmarPage = lazyRetry(() => import("./QAContratarConfirmarPage"), "QAContratarConfirmarPage");
const QAContratarIdentificarPage = lazyRetry(() => import("./QAContratarIdentificarPage"), "QAContratarIdentificarPage");
const QAContratarPublicoPage = lazyRetry(() => import("./QAContratarPublicoPage"), "QAContratarPublicoPage");
const QAContratacoesPendentesPage = lazyRetry(() => import("./QAContratacoesPendentesPage"), "QAContratacoesPendentesPage");
const QAVendasPendentesPage = lazyRetry(() => import("./QAVendasPendentesPage"), "QAVendasPendentesPage");
const QAContratacoesTabsPage = lazyRetry(() => import("./QAContratacoesTabsPage"), "QAContratacoesTabsPage");
const QAClientesTabsPage = lazyRetry(() => import("./QAClientesTabsPage"), "QAClientesTabsPage");
const QAAuditoriaTabsPage = lazyRetry(() => import("./QAAuditoriaTabsPage"), "QAAuditoriaTabsPage");
const QAClienteContratacoesPage = lazyRetry(() => import("./QAClienteContratacoesPage"), "QAClienteContratacoesPage");
const QAHomologacaoClientesPage = lazyRetry(() => import("./QAHomologacaoClientesPage"), "QAHomologacaoClientesPage");
const HomePage = lazyRetry(() => import("@/pages/HomePage"), "HomePage");
const ServicesListPage = lazyRetry(() => import("@/pages/ServicesListPage"), "ServicesListPage");
const QuizPage = lazyRetry(() => import("@/pages/QuizPage"), "QuizPage");
const LpDefesaPessoalPosse = lazyRetry(() => import("@/pages/LpDefesaPessoalPosse"), "LpDefesaPessoalPosse");
const LpCacCr = lazyRetry(() => import("@/pages/LpCacCr"), "LpCacCr");
const LpAtividadesAvulsas = lazyRetry(() => import("@/pages/LpAtividadesAvulsas"), "LpAtividadesAvulsas");
const CursoPage = lazyRetry(() => import("@/pages/cursos/CursoPage"), "CursoPage");

/**
 * Envolve rotas QA standalone (fora do QALayout) com a classe `qa-scope`,
 * que sobrescreve os tokens semânticos do shadcn para Premium Light.
 * Sem isso, componentes shadcn (Button outline, Card, Dialog, Input)
 * herdam o tema Absolute Dark global do WMTi Core e renderizam pretos
 * dentro do módulo Quero Armas.
 */
function QAScope({ children }: { children: React.ReactNode }) {
  return <div className="qa-scope">{children}</div>;
}

export default function QARoutes() {
  return (
    <Suspense fallback={<QATacticalLoader />}>
      <Routes>
        {/* Raiz: landing page principal pública */}
        <Route path="/" element={<HomePage />} />

        {/* Public routes (no auth required) */}
        <Route path="servicos" element={<ServicesListPage />} />
        <Route path="descobrir-meu-caminho" element={<QuizPage />} />
        <Route path="lp/defesa-pessoal-posse" element={<LpDefesaPessoalPosse />} />
        <Route path="lp/cac-cr" element={<LpCacCr />} />
        <Route path="arsenal-digital-gratuito" element={<QAArsenalDigitalGratuitoPage />} />
        <Route path="app-arsenal-gratuito" element={<QAArsenalDigitalGratuitoPage />} />
        <Route path="lp/atividades-avulsas" element={<LpAtividadesAvulsas />} />
        <Route path="cursos/:slug" element={<CursoPage />} />
        <Route path="login" element={<QAScope><QALoginPage /></QAScope>} />
        <Route path="redefinir-senha" element={<QAScope><QARedefinirSenhaPage /></QAScope>} />
        <Route path="auth/callback" element={<QAScope><QARedefinirSenhaPage /></QAScope>} />
        <Route path="cadastro" element={<QAScope><QACadastroPublicoPage /></QAScope>} />
        <Route path="cadastro/foto" element={<QAScope><QAEnviarFotoPage /></QAScope>} />
        <Route path="enviar-foto" element={<QAScope><QAEnviarFotoPage /></QAScope>} />
        
        {/* Client portal (separate auth flow) */}
        <Route path="area-do-cliente/login" element={<QAScope><QAClienteLoginPage /></QAScope>} />
        <Route path="area-do-cliente/criar-conta" element={<QAScope><QACriarContaPage /></QAScope>} />
        <Route path="area-do-cliente" element={<QAScope><QAClientePortalPage /></QAScope>} />
        <Route path="area-do-cliente/contratar" element={<QAScope><QAContratarServicoPage /></QAScope>} />
        <Route path="area-do-cliente/contratacoes" element={<QAScope><QAClienteContratacoesPage /></QAScope>} />
        <Route path="area-do-cliente/contratar/:slug/identificar" element={<QAScope><QAContratarIdentificarPage /></QAScope>} />
        <Route path="area-do-cliente/contratar/:slug/solicitar" element={<QAScope><QAContratarPublicoPage /></QAScope>} />
        <Route path="area-do-cliente/contratar/:slug/confirmar" element={<QAScope><QAContratarConfirmarPage /></QAScope>} />
        <Route path="ativar-acesso" element={<QAScope><QAAtivarAcessoPage /></QAScope>} />
        <Route path="portal/acessar" element={<QAScope><QAAtivarAcessoPage /></QAScope>} />
        {/* Legacy redirects */}
        <Route path="portal/login" element={<Navigate to="/area-do-cliente/login" replace />} />
        <Route path="portal" element={<Navigate to="/area-do-cliente" replace />} />
        
        {/* Protected admin routes */}
        <Route element={<QALayout />}>
          <Route path="dashboard" element={<QADashboardPage />} />
          <Route path="operacao/monitoramento" element={<QAMonitoramentoPage />} />
          <Route path="ia" element={<QAIAPage />} />
          <Route path="base-conhecimento" element={<QABaseConhecimentoPage />} />
          <Route path="base-conhecimento/:id" element={<QADocumentoDetalhePage />} />
          <Route path="legislacao" element={<QALegislacaoPage />} />
          <Route path="jurisprudencia" element={<QAJurisprudenciaPage />} />
          <Route path="modelos-docx" element={<QAModelosDocxPage />} />
          <Route path="armamentos" element={<QAArmamentosAdminPage />} />
          <Route path="gerar-peca" element={<QAGerarPecaPage />} />
          <Route path="casos" element={<QACasosPage />} />
          <Route path="processos" element={<QAProcessosPage />} />
          <Route path="contratacoes-pendentes" element={<QAContratacoesPendentesPage />} />
          <Route path="operacao/contratacoes" element={<QAContratacoesTabsPage />} />
          <Route path="operacao/homologacao-clientes" element={<QAHomologacaoClientesPage />} />
          <Route path="historico" element={<QAHistoricoPage />} />
          <Route path="configuracoes" element={<QAConfiguracoesPage />} />
          <Route path="clientes" element={<QAClientesTabsPage />} />
          <Route path="clientes-lista" element={<QAClientesPage />} />
          <Route path="acessos" element={<QAAcessosPage />} />
          <Route path="clubes" element={<QAClubesPage />} />
          <Route path="financeiro" element={<QAFinanceiroPage />} />
          <Route path="precos-servicos" element={<QAPrecosServicosPage />} />
          <Route path="relatorios" element={<QARelatoriosPage />} />
          <Route path="auditoria" element={<QAAuditoriaTabsPage />} />
          <Route path="auditoria/geral" element={<QAAuditoriaPage />} />
          <Route path="auditoria/recursos-administrativos" element={<QARecursosAuditoriaPage />} />
          <Route path="auditoria/central-documentos" element={<QAProcessosAuditoriaPage />} />
          {/* Legacy redirect: rota antiga */}
          <Route path="recursos-auditoria" element={<Navigate to="/auditoria/recursos-administrativos" replace />} />
        </Route>

        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
