import { lazy, Suspense } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { lazyRetry } from "@/lib/lazyRetry";
import QARouteFallback from "@/components/quero-armas/QARouteFallback";
import { isCadastroRefinadoEnabled } from "@/lib/quero-armas/cadastroRefinadoFlag";

const QALayout = lazyRetry(() => import("@/components/quero-armas/QALayout"), "QALayout");
const QALoginPage = lazyRetry(() => import("./QALoginPage"), "QALoginPage");
const QADashboardPage = lazyRetry(() => import("./QADashboardPage"), "QADashboardPage");
const QAMonitoramentoPage = lazyRetry(() => import("./QAMonitoramentoPage"), "QAMonitoramentoPage");
const QABaseConhecimentoPage = lazyRetry(() => import("./QABaseConhecimentoPage"), "QABaseConhecimentoPage");
const QABaseEquipePage = lazyRetry(() => import("./QABaseEquipePage"), "QABaseEquipePage");
const QADocumentoDetalhePage = lazyRetry(() => import("./QADocumentoDetalhePage"), "QADocumentoDetalhePage");
const QALegislacaoPage = lazyRetry(() => import("./QALegislacaoPage"), "QALegislacaoPage");
const QAJurisprudenciaPage = lazyRetry(() => import("./QAJurisprudenciaPage"), "QAJurisprudenciaPage");
const QAIAPage = lazyRetry(() => import("./QAIAPage"), "QAIAPage");
const QAGerarPecaPage = lazyRetry(() => import("./QAGerarPecaPage"), "QAGerarPecaPage");
const QACasosPage = lazyRetry(() => import("./QACasosPage"), "QACasosPage");
const QAModelosDocxPage = lazyRetry(() => import("./QAModelosDocxPage"), "QAModelosDocxPage");
const QAModelosDeclaracaoPage = lazyRetry(() => import("./QAModelosDeclaracaoPage"), "QAModelosDeclaracaoPage");
const QAWizardPerguntasPage = lazyRetry(() => import("./QAWizardPerguntasPage"), "QAWizardPerguntasPage");
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
const QACadastroRefinadoPage = lazyRetry(() => import("./cadastro-refinado/QACadastroRefinadoPage"), "QACadastroRefinadoPage");
// MiraPrototypePage (sandbox visual com dados fake) NÃO é mais montado em nenhuma
// rota pública. /cadastro-mira passa a renderizar o mesmo fluxo real de /cadastro.
// /cadastro-v2 e sub-rotas agora redirecionam para /cadastro (Etapa 00 refinada).
// Componentes legados permanecem no projeto para histórico, mas não são mais montados.
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
const QAContratarSucessoPage = lazyRetry(() => import("./QAContratarSucessoPage"), "QAContratarSucessoPage");
const QAContratacoesPendentesPage = lazyRetry(() => import("./QAContratacoesPendentesPage"), "QAContratacoesPendentesPage");
const QAVendasPendentesPage = lazyRetry(() => import("./QAVendasPendentesPage"), "QAVendasPendentesPage");
const QAContratacoesTabsPage = lazyRetry(() => import("./QAContratacoesTabsPage"), "QAContratacoesTabsPage");
const QAClientesTabsPage = lazyRetry(() => import("./QAClientesTabsPage"), "QAClientesTabsPage");
const QAAuditoriaTabsPage = lazyRetry(() => import("./QAAuditoriaTabsPage"), "QAAuditoriaTabsPage");
const QAClienteContratacoesPage = lazyRetry(() => import("./QAClienteContratacoesPage"), "QAClienteContratacoesPage");
const QAClienteAgendarExamePage = lazyRetry(() => import("./QAClienteAgendarExamePage"), "QAClienteAgendarExamePage");
const QAAgendarExameMockupsPage = lazyRetry(() => import("./QAAgendarExameMockupsPage"), "QAAgendarExameMockupsPage");
const QAAgendarExameMockupsV2Page = lazyRetry(() => import("./QAAgendarExameMockupsV2Page"), "QAAgendarExameMockupsV2Page");
const QAAlertasVencimentoPage = lazyRetry(() => import("./QAAlertasVencimentoPage"), "QAAlertasVencimentoPage");
const QAPrazosExpiradosPage = lazyRetry(() => import("./QAPrazosExpiradosPage"), "QAPrazosExpiradosPage");
const QAHistoricoStatusPage = lazyRetry(() => import("./QAHistoricoStatusPage"), "QAHistoricoStatusPage");
const ResumoClienteKanbanMockPage = lazyRetry(() => import("./mocks/ResumoClienteKanbanMockPage"), "ResumoClienteKanbanMockPage");
const ResumoClienteFocoMockPage = lazyRetry(() => import("./mocks/ResumoClienteFocoMockPage"), "ResumoClienteFocoMockPage");
const QAEmailMockupsPage = lazyRetry(() => import("./QAEmailMockupsPage"), "QAEmailMockupsPage");
// ============================================================================
// DEV-ONLY: Bancada visual do Wizard KYC (DocumentDataOnboardingWizard).
//   - Permite QA do fluxo de cadastro documental SEM login real, SEM cliente
//     real e SEM tocar no banco — mocks ficam confinados à própria página.
//   - Gated por `import.meta.env.DEV`: em build de produção a constante vira
//     `null`, o lazy import é eliminado (tree-shaking) e o <Route> abaixo
//     também não é montado, então a rota nem existe no bundle publicado.
//   - Não deve aparecer em menus, sidebar, sitemap ou links públicos.
// ============================================================================
const QAWizardKycPreviewPage = import.meta.env.DEV
  ? lazyRetry(() => import("./dev/QAWizardKycPreviewPage"), "QAWizardKycPreviewPage")
  : null;
const HomePage = lazyRetry(() => import("@/pages/HomePage"), "HomePage");
const ServicesListPage = lazyRetry(() => import("@/pages/ServicesListPage"), "ServicesListPage");
const ServicoDetalhePage = lazyRetry(() => import("./ServicoDetalhePage"), "ServicoDetalhePage");
const CarrinhoPage = lazyRetry(() => import("@/pages/CarrinhoPage"), "CarrinhoPage");
const QACheckoutFinalizarPage = lazyRetry(() => import("./QACheckoutFinalizarPage"), "QACheckoutFinalizarPage");
const LpDefesaPessoalPosse = lazyRetry(() => import("@/pages/LpDefesaPessoalPosse"), "LpDefesaPessoalPosse");
const LpCacCr = lazyRetry(() => import("@/pages/LpCacCr"), "LpCacCr");
const LpAtividadesAvulsas = lazyRetry(() => import("@/pages/LpAtividadesAvulsas"), "LpAtividadesAvulsas");
const CursoPage = lazyRetry(() => import("@/pages/cursos/CursoPage"), "CursoPage");
const QuemSomosPage = lazyRetry(() => import("@/pages/about/AboutPages").then((m) => ({ default: m.QuemSomosPage })), "QuemSomosPage");
const ComoFuncionaPage = lazyRetry(() => import("@/pages/about/AboutPages").then((m) => ({ default: m.ComoFuncionaPage })), "ComoFuncionaPage");
const AtendimentoNacionalPage = lazyRetry(() => import("@/pages/about/AboutPages").then((m) => ({ default: m.AtendimentoNacionalPage })), "AtendimentoNacionalPage");
const LimitesResponsabilidadesPage = lazyRetry(() => import("@/pages/about/AboutPages").then((m) => ({ default: m.LimitesResponsabilidadesPage })), "LimitesResponsabilidadesPage");
const TermosPage = lazyRetry(() => import("@/pages/about/AboutPages").then((m) => ({ default: m.TermosPage })), "TermosPage");
const PrivacidadePage = lazyRetry(() => import("@/pages/about/AboutPages").then((m) => ({ default: m.PrivacidadePage })), "PrivacidadePage");

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

/**
 * Redirect /cadastro-v2[/...] → /cadastro preservando ?search.
 * Sem isso o `<Navigate to="/cadastro">` apaga `?servico=`, `?perfil_v2=`,
 * `?retomar=`, quebrando deep-links vindos da landing/CTAs.
 */
function CadastroV2Redirect({ extraParams }: { extraParams?: Record<string, string> }) {
  const location = useLocation();
  const sp = new URLSearchParams(location.search);
  if (extraParams) {
    Object.entries(extraParams).forEach(([k, v]) => {
      if (!sp.has(k)) sp.set(k, v);
    });
  }
  const qs = sp.toString();
  return <Navigate to={`/cadastro${qs ? `?${qs}` : ""}`} replace />;
}

function CatchAllRedirect() {
  const location = useLocation();
  const normalizedPath = location.pathname.toLowerCase().replace(/\/+$/, "");

  if (
    normalizedPath.includes("resumo-cliente-foco") ||
    normalizedPath.includes("foco-no-que-vence") ||
    normalizedPath.includes("foco-em-quem-vence")
  ) {
    return <ResumoClienteFocoMockPage />;
  }

  if (location.pathname.endsWith("/index.html")) {
    const stripped = location.pathname.replace(/\/index\.html$/, "") || "/";
    return <Navigate to={`${stripped}${location.search}${location.hash}`} replace />;
  }
  return <Navigate to="/" replace />;
}

/**
 * /cadastro (refinado é o PADRÃO):
 *  - default → QACadastroRefinadoPage (UI editorial 5 etapas)
 *  - VITE_QA_CADASTRO_V2_ENABLED="false" → kill-switch reverso, força o legado
 *  - ?cadastro_legado=1 ou ?cadastro_v2=0 → força o legado em runtime (canal de emergência)
 *  - ?cadastro_v2=1 → força o refinado (idempotente com o default)
 */
function CadastroRouteSwitch() {
  return isCadastroRefinadoEnabled()
    ? <QAScope><QACadastroRefinadoPage /></QAScope>
    : <QAScope><QACadastroPublicoPage /></QAScope>;
}

export default function QARoutes() {
  return (
    <Suspense fallback={<QARouteFallback />}>
      <Routes>
        {/* Raiz: landing page principal pública */}
        <Route path="/" element={<HomePage />} />
        <Route path="mocks/resumo-cliente-kanban" element={<ResumoClienteKanbanMockPage />} />
        <Route path="mocks/resumo-cliente-kanban.html" element={<ResumoClienteKanbanMockPage />} />
        <Route path="mocks/resumo-cliente-foco" element={<ResumoClienteFocoMockPage />} />
        <Route path="mocks/resumo-cliente-foco.html" element={<ResumoClienteFocoMockPage />} />
        <Route path="email-mockups" element={<QAEmailMockupsPage />} />
        <Route path="resumo-cliente-foco" element={<ResumoClienteFocoMockPage />} />
        <Route path="resumo-cliente-foco.html" element={<ResumoClienteFocoMockPage />} />
        <Route path="foco-no-que-vence" element={<ResumoClienteFocoMockPage />} />
        <Route path="foco-no-que-vence.html" element={<ResumoClienteFocoMockPage />} />
        <Route path="foco-em-quem-vence" element={<ResumoClienteFocoMockPage />} />
        <Route path="foco-em-quem-vence.html" element={<ResumoClienteFocoMockPage />} />

        {/* DEV-ONLY: rota de QA visual do Wizard KYC (não montada em produção). */}
        {QAWizardKycPreviewPage && (
          <Route
            path="dev/wizard-kyc-preview"
            element={<QAScope><QAWizardKycPreviewPage /></QAScope>}
          />
        )}

        {/* Public routes (no auth required) */}
        <Route path="servicos" element={<ServicesListPage />} />
        <Route path="servicos/:slug" element={<ServicoDetalhePage />} />
        <Route path="carrinho" element={<CarrinhoPage />} />
        <Route path="checkout/finalizar" element={<QAScope><QACheckoutFinalizarPage /></QAScope>} />
        {/* /descobrir-meu-caminho foi absorvido pelo fluxo guiado de /cadastro.
            Redireciona para a sub-árvore "orientacao_necessaria" preservando
            query string original (origem, utm_*, etc). O QuizPage permanece
            como componente legado mas não é mais montado em rota pública. */}
        <Route
          path="descobrir-meu-caminho"
          element={<CadastroV2Redirect extraParams={{ perfil_v2: "orientacao_necessaria", origem: "descobrir_meu_caminho" }} />}
        />
        <Route path="defesa-pessoal-posse" element={<LpDefesaPessoalPosse />} />
        <Route path="cac-cr" element={<LpCacCr />} />
        <Route path="atividades-avulsas" element={<LpAtividadesAvulsas />} />
        <Route path="lp/defesa-pessoal-posse" element={<LpDefesaPessoalPosse />} />
        <Route path="lp/cac-cr" element={<LpCacCr />} />
        <Route path="arsenal-digital-gratuito" element={<QAArsenalDigitalGratuitoPage />} />
        <Route path="app-arsenal-gratuito" element={<QAArsenalDigitalGratuitoPage />} />
        <Route path="lp/atividades-avulsas" element={<LpAtividadesAvulsas />} />
        <Route path="cursos/:slug" element={<CursoPage />} />
        <Route path="quem-somos" element={<QuemSomosPage />} />
        <Route path="como-funciona" element={<ComoFuncionaPage />} />
        <Route path="atendimento-nacional" element={<AtendimentoNacionalPage />} />
        <Route path="limites-e-responsabilidades" element={<LimitesResponsabilidadesPage />} />
        <Route path="termos" element={<TermosPage />} />
        <Route path="privacidade" element={<PrivacidadePage />} />
        <Route path="login" element={<QAScope><QALoginPage /></QAScope>} />
        <Route path="redefinir-senha" element={<QAScope><QARedefinirSenhaPage /></QAScope>} />
        <Route path="auth/callback" element={<QAScope><QARedefinirSenhaPage /></QAScope>} />
        <Route path="cadastro" element={<CadastroRouteSwitch />} />
        {/* /cadastro-mira agora usa o MESMO componente real de /cadastro
            (upload, extração, revisão, checkout 2C). Visual Mira já é o padrão. */}
        <Route path="cadastro-mira" element={<CadastroRouteSwitch />} />
        <Route path="cadastro-v2" element={<CadastroV2Redirect />} />
        <Route path="cadastro-v2/defesa-pessoal" element={<CadastroV2Redirect extraParams={{ perfil_v2: "defesa_pessoal" }} />} />
        <Route path="cadastro-v2/cac" element={<CadastroV2Redirect extraParams={{ perfil_v2: "cac" }} />} />
        <Route path="cadastro-v2/profissao-ativa" element={<CadastroV2Redirect extraParams={{ perfil_v2: "profissional_ativo" }} />} />
        <Route path="cadastro-v2/aposentado" element={<CadastroV2Redirect extraParams={{ perfil_v2: "aposentado_inativo" }} />} />
        <Route path="cadastro-v2/cursos" element={<CadastroV2Redirect extraParams={{ perfil_v2: "cursos" }} />} />
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
        <Route path="area-do-cliente/contratar/:slug/sucesso" element={<QAScope><QAContratarSucessoPage /></QAScope>} />
        <Route path="area-do-cliente/agendar-exame" element={<QAScope><QAClienteAgendarExamePage /></QAScope>} />
        <Route path="area-do-cliente/agendar-exame/mockups" element={<QAScope><QAAgendarExameMockupsPage /></QAScope>} />
        <Route path="area-do-cliente/agendar-exame/mockups-v2" element={<QAScope><QAAgendarExameMockupsV2Page /></QAScope>} />
        <Route path="ativar-acesso" element={<QAScope><QAAtivarAcessoPage /></QAScope>} />
        <Route path="portal/acessar" element={<QAScope><QAAtivarAcessoPage /></QAScope>} />
        {/* Legacy redirects */}
        <Route path="portal/login" element={<Navigate to="/area-do-cliente/login" replace />} />
        <Route path="portal" element={<Navigate to="/area-do-cliente" replace />} />
        
        {/* Protected admin routes */}
        <Route element={<QALayout />}>
          <Route path="admin" element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<QADashboardPage />} />
          <Route path="operacao/monitoramento" element={<QAMonitoramentoPage />} />
          <Route path="ia" element={<QAIAPage />} />
          <Route path="base-conhecimento" element={<QABaseConhecimentoPage />} />
          <Route path="base-conhecimento/:id" element={<QADocumentoDetalhePage />} />
          <Route path="base-equipe" element={<QABaseEquipePage />} />
          <Route path="legislacao" element={<QALegislacaoPage />} />
          <Route path="jurisprudencia" element={<QAJurisprudenciaPage />} />
          <Route path="modelos-docx" element={<QAModelosDocxPage />} />
          <Route path="modelos-declaracao" element={<QAModelosDeclaracaoPage />} />
          <Route path="wizard-perguntas" element={<QAWizardPerguntasPage />} />
          <Route path="armamentos" element={<QAArmamentosAdminPage />} />
          <Route path="gerar-peca" element={<QAGerarPecaPage />} />
          <Route path="correcoes-ia" element={<QACorrecoesIAPage />} />
          <Route path="casos" element={<QACasosPage />} />
          <Route path="processos" element={<QAProcessosPage />} />
          <Route path="contratacoes-pendentes" element={<QAContratacoesPendentesPage />} />
          <Route path="operacao/contratacoes" element={<QAContratacoesTabsPage />} />
          <Route path="operacao/alertas-vencimento" element={<QAAlertasVencimentoPage />} />
          <Route path="operacao/prazos-expirados" element={<QAPrazosExpiradosPage />} />
          <Route path="operacao/historico-status" element={<QAHistoricoStatusPage />} />
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
        <Route path="*" element={<CatchAllRedirect />} />
      </Routes>
    </Suspense>
  );
}
