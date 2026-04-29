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
const QARecursosAuditoriaPage = lazyRetry(() => import("./QARecursosAuditoriaPage"), "QARecursosAuditoriaPage");
const QAAuditoriaPage = lazyRetry(() => import("./QAAuditoriaPage"), "QAAuditoriaPage");
const QAProcessosAuditoriaPage = lazyRetry(() => import("./QAProcessosAuditoriaPage"), "QAProcessosAuditoriaPage");
const QAArmamentosAdminPage = lazyRetry(() => import("./QAArmamentosAdminPage"), "QAArmamentosAdminPage");
const QAProcessosPage = lazyRetry(() => import("./QAProcessosPage"), "QAProcessosPage");
const QACadastroPublicoPage = lazyRetry(() => import("./QACadastroPublicoPage"), "QACadastroPublicoPage");
const QAEnviarFotoPage = lazyRetry(() => import("./QAEnviarFotoPage"), "QAEnviarFotoPage");
const QAClienteLoginPage = lazyRetry(() => import("./QAClienteLoginPage"), "QAClienteLoginPage");
const QAClientePortalPage = lazyRetry(() => import("./QAClientePortalPage"), "QAClientePortalPage");
const QAAtivarAcessoPage = lazyRetry(() => import("./QAAtivarAcessoPage"), "QAAtivarAcessoPage");
const QARedefinirSenhaPage = lazyRetry(() => import("./QARedefinirSenhaPage"), "QARedefinirSenhaPage");
const QAContratarServicoPage = lazyRetry(() => import("./QAContratarServicoPage"), "QAContratarServicoPage");
const QAContratarConfirmarPage = lazyRetry(() => import("./QAContratarConfirmarPage"), "QAContratarConfirmarPage");
const QAContratarIdentificarPage = lazyRetry(() => import("./QAContratarIdentificarPage"), "QAContratarIdentificarPage");
const QAContratacoesPendentesPage = lazyRetry(() => import("./QAContratacoesPendentesPage"), "QAContratacoesPendentesPage");
const QAClienteContratacoesPage = lazyRetry(() => import("./QAClienteContratacoesPage"), "QAClienteContratacoesPage");
const HomePage = lazyRetry(() => import("@/pages/HomePage"), "HomePage");
const ServicesListPage = lazyRetry(() => import("@/pages/ServicesListPage"), "ServicesListPage");
const QuizPage = lazyRetry(() => import("@/pages/QuizPage"), "QuizPage");
const LpDefesaPessoalPosse = lazyRetry(() => import("@/pages/LpDefesaPessoalPosse"), "LpDefesaPessoalPosse");
const LpCacCr = lazyRetry(() => import("@/pages/LpCacCr"), "LpCacCr");
const LpAtividadesAvulsas = lazyRetry(() => import("@/pages/LpAtividadesAvulsas"), "LpAtividadesAvulsas");
const CursoPage = lazyRetry(() => import("@/pages/cursos/CursoPage"), "CursoPage");

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
        <Route path="lp/atividades-avulsas" element={<LpAtividadesAvulsas />} />
        <Route path="cursos/:slug" element={<CursoPage />} />
        <Route path="login" element={<QALoginPage />} />
        <Route path="redefinir-senha" element={<QARedefinirSenhaPage />} />
        <Route path="auth/callback" element={<QARedefinirSenhaPage />} />
        <Route path="cadastro" element={<QACadastroPublicoPage />} />
        <Route path="cadastro/foto" element={<QAEnviarFotoPage />} />
        <Route path="enviar-foto" element={<QAEnviarFotoPage />} />
        
        {/* Client portal (separate auth flow) */}
        <Route path="area-do-cliente/login" element={<QAClienteLoginPage />} />
        <Route path="area-do-cliente" element={<QAClientePortalPage />} />
        <Route path="area-do-cliente/contratar" element={<QAContratarServicoPage />} />
        <Route path="area-do-cliente/contratacoes" element={<QAClienteContratacoesPage />} />
        <Route path="area-do-cliente/contratar/:slug/identificar" element={<QAContratarIdentificarPage />} />
        <Route path="area-do-cliente/contratar/:slug/confirmar" element={<QAContratarConfirmarPage />} />
        <Route path="ativar-acesso" element={<QAAtivarAcessoPage />} />
        <Route path="portal/acessar" element={<QAAtivarAcessoPage />} />
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
          <Route path="historico" element={<QAHistoricoPage />} />
          <Route path="configuracoes" element={<QAConfiguracoesPage />} />
          <Route path="clientes" element={<QAClientesPage />} />
          <Route path="acessos" element={<QAAcessosPage />} />
          <Route path="clubes" element={<QAClubesPage />} />
          <Route path="financeiro" element={<QAFinanceiroPage />} />
          <Route path="relatorios" element={<QARelatoriosPage />} />
          <Route path="auditoria" element={<QAAuditoriaPage />} />
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
