import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import FloatingCtaBar from "@/components/FloatingCtaBar";
import RouteTracker from "@/components/RouteTracker";
import { lazyRetry } from "@/lib/lazyRetry";
import Index from "./pages/Index.tsx";

const Provimento213 = lazyRetry(() => import("./pages/Provimento213.tsx"), "Provimento213");
const CartoriosPage = lazyRetry(() => import("./pages/CartoriosPage.tsx"), "CartoriosPage");
const ServicosPage = lazyRetry(() => import("./pages/ServicosPage.tsx"), "ServicosPage");
const LocacaoPage = lazyRetry(() => import("./pages/LocacaoPage.tsx"), "LocacaoPage");
const InfraestruturaPage = lazyRetry(() => import("./pages/InfraestruturaPage.tsx"), "InfraestruturaPage");
const BlogPage = lazyRetry(() => import("./pages/BlogPage.tsx"), "BlogPage");
const BlogPostPage = lazyRetry(() => import("./pages/BlogPostPage.tsx"), "BlogPostPage");
const DynamicSeoPage = lazyRetry(() => import("./pages/DynamicSeoPage.tsx"), "DynamicSeoPage");
const NotFound = lazyRetry(() => import("./pages/NotFound.tsx"), "NotFound");
const TiHospitaisClinicasPage = lazyRetry(() => import("./pages/TiHospitaisClinicasPage.tsx"), "TiHospitaisClinicasPage");
const SobrePage = lazyRetry(() => import("./pages/SobrePage.tsx"), "SobrePage");
const InstitucionalPage = lazyRetry(() => import("./pages/InstitucionalPage.tsx"), "InstitucionalPage");
const TerceirizacaoPage = lazyRetry(() => import("./pages/TerceirizacaoPage.tsx"), "TerceirizacaoPage");
const FirewallPfsensePage = lazyRetry(() => import("./pages/FirewallPfsensePage.tsx"), "FirewallPfsensePage");
const ServidoresDellPage = lazyRetry(() => import("./pages/ServidoresDellPage.tsx"), "ServidoresDellPage");
const Microsoft365Page = lazyRetry(() => import("./pages/Microsoft365Page.tsx"), "Microsoft365Page");
const MontagemRedesPage = lazyRetry(() => import("./pages/MontagemRedesPage.tsx"), "MontagemRedesPage");
const LocacaoComputadoresPage = lazyRetry(() => import("./pages/LocacaoComputadoresPage.tsx"), "LocacaoComputadoresPage");
const SuporteTiPage = lazyRetry(() => import("./pages/SuporteTiPage.tsx"), "SuporteTiPage");
const TiCartoriosPage = lazyRetry(() => import("./pages/TiCartoriosPage.tsx"), "TiCartoriosPage");
const TiServentiasCartoriaisPage = lazyRetry(() => import("./pages/TiServentiasCartoriaisPage.tsx"), "TiServentiasCartoriaisPage");
const TiIndustriasAlimenticiaPage = lazyRetry(() => import("./pages/TiIndustriasAlimenticiaPage.tsx"), "TiIndustriasAlimenticiaPage");
const TiIndustriasPetroliferasPage = lazyRetry(() => import("./pages/TiIndustriasPetroliferasPage.tsx"), "TiIndustriasPetroliferasPage");
const TiEscritoriosAdvocaciaPage = lazyRetry(() => import("./pages/TiEscritoriosAdvocaciaPage.tsx"), "TiEscritoriosAdvocaciaPage");
const TiContabilidadesPage = lazyRetry(() => import("./pages/TiContabilidadesPage.tsx"), "TiContabilidadesPage");
const TiEscritoriosCorporativosPage = lazyRetry(() => import("./pages/TiEscritoriosCorporativosPage.tsx"), "TiEscritoriosCorporativosPage");
const InfraestruturaCorporativaPage = lazyRetry(() => import("./pages/InfraestruturaCorporativaPage.tsx"), "InfraestruturaCorporativaPage");
const OrcamentoTiPage = lazyRetry(() => import("./pages/OrcamentoTiPage.tsx"), "OrcamentoTiPage");
const ContratoPage = lazyRetry(() => import("./pages/ContratoPage.tsx"), "ContratoPage");
const AdministracaoServidoresPage = lazyRetry(() => import("./pages/AdministracaoServidoresPage.tsx"), "AdministracaoServidoresPage");
const MonitoramentoServidoresPage = lazyRetry(() => import("./pages/MonitoramentoServidoresPage.tsx"), "MonitoramentoServidoresPage");
const BackupCorporativoPage = lazyRetry(() => import("./pages/BackupCorporativoPage.tsx"), "BackupCorporativoPage");
const SegurancaDeRedePage = lazyRetry(() => import("./pages/SegurancaDeRedePage.tsx"), "SegurancaDeRedePage");
const MonitoramentoDeRedePage = lazyRetry(() => import("./pages/MonitoramentoDeRedePage.tsx"), "MonitoramentoDeRedePage");
const SuporteEmergencialPage = lazyRetry(() => import("./pages/SuporteEmergencialPage.tsx"), "SuporteEmergencialPage");
const SuporteWindowsServerPage = lazyRetry(() => import("./pages/SuporteWindowsServerPage.tsx"), "SuporteWindowsServerPage");
const SuporteLinuxPage = lazyRetry(() => import("./pages/SuporteLinuxPage.tsx"), "SuporteLinuxPage");
const ManutencaoInfraestruturaPage = lazyRetry(() => import("./pages/ManutencaoInfraestruturaPage.tsx"), "ManutencaoInfraestruturaPage");
const SuporteRedesCorporativasPage = lazyRetry(() => import("./pages/SuporteRedesCorporativasPage.tsx"), "SuporteRedesCorporativasPage");
const ContratarServicoPage = lazyRetry(() => import("./pages/ContratarServicoPage.tsx"), "ContratarServicoPage");
const CompraConcluida = lazyRetry(() => import("./pages/CompraConcluida.tsx"), "CompraConcluida");
const AtivacaoAcessoPage = lazyRetry(() => import("./pages/AtivacaoAcessoPage.tsx"), "AtivacaoAcessoPage");
const ContratoFinalPage = lazyRetry(() => import("./pages/ContratoFinalPage.tsx"), "ContratoFinalPage");
const AreaDoClientePage = lazyRetry(() => import("./pages/AreaDoClientePage.tsx"), "AreaDoClientePage");
const ReestruturacaoRedePage = lazyRetry(() => import("./pages/ReestruturacaoRedePage.tsx"), "ReestruturacaoRedePage");
const DesenvolvimentoWebPage = lazyRetry(() => import("./pages/DesenvolvimentoWebPage.tsx"), "DesenvolvimentoWebPage");
const AutomacaoIaPage = lazyRetry(() => import("./pages/AutomacaoIaPage.tsx"), "AutomacaoIaPage");
const AutomacaoAlexaPage = lazyRetry(() => import("./pages/AutomacaoAlexaPage.tsx"), "AutomacaoAlexaPage");
const AdminPage = lazyRetry(() => import("./pages/AdminPage.tsx"), "AdminPage");
const RedefinirSenhaPage = lazyRetry(() => import("./pages/RedefinirSenhaPage.tsx"), "RedefinirSenhaPage");

const queryClient = new QueryClient();

const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center section-dark">
    <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
  </div>
);

const App = () => (
  <ErrorBoundary>
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <RouteTracker />
        <FloatingCtaBar />
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/" element={<Index />} />
            {/* Legacy mobile pages */}
            <Route path="/cartorios" element={<CartoriosPage />} />
            <Route path="/servicos" element={<ServicosPage />} />
            <Route path="/locacao" element={<LocacaoPage />} />
            <Route path="/infraestrutura" element={<InfraestruturaPage />} />
            {/* Dedicated pages */}
            <Route path="/institucional" element={<InstitucionalPage />} />
            <Route path="/ti-para-hospitais-e-clinicas" element={<TiHospitaisClinicasPage />} />
            <Route path="/terceirizacao-de-mao-de-obra-ti" element={<TerceirizacaoPage />} />
            <Route path="/sobre" element={<Navigate to="/institucional" replace />} />
            {/* Service dedicated pages */}
            <Route path="/firewall-pfsense-jacarei" element={<FirewallPfsensePage />} />
            <Route path="/servidor-dell-poweredge-jacarei" element={<ServidoresDellPage />} />
            <Route path="/microsoft-365-para-empresas-jacarei" element={<Microsoft365Page />} />
            <Route path="/montagem-e-monitoramento-de-redes-jacarei" element={<MontagemRedesPage />} />
            <Route path="/locacao-de-computadores-para-empresas-jacarei" element={<LocacaoComputadoresPage />} />
            <Route path="/suporte-ti-jacarei" element={<SuporteTiPage />} />
            <Route path="/infraestrutura-ti-corporativa-jacarei" element={<InfraestruturaCorporativaPage />} />
            {/* New service pages */}
            <Route path="/administracao-de-servidores" element={<AdministracaoServidoresPage />} />
            <Route path="/monitoramento-de-servidores" element={<MonitoramentoServidoresPage />} />
            <Route path="/backup-corporativo" element={<BackupCorporativoPage />} />
            <Route path="/seguranca-de-rede" element={<SegurancaDeRedePage />} />
            <Route path="/monitoramento-de-rede" element={<MonitoramentoDeRedePage />} />
            <Route path="/suporte-tecnico-emergencial" element={<SuporteEmergencialPage />} />
            <Route path="/suporte-windows-server" element={<SuporteWindowsServerPage />} />
            <Route path="/suporte-linux" element={<SuporteLinuxPage />} />
            <Route path="/manutencao-de-infraestrutura-de-ti" element={<ManutencaoInfraestruturaPage />} />
            <Route path="/suporte-tecnico-para-redes-corporativas" element={<SuporteRedesCorporativasPage />} />
            {/* Service contracting flow */}
            <Route path="/contratar/:slug" element={<ContratarServicoPage />} />
            {/* Budget system */}
            <Route path="/orcamento-ti" element={<OrcamentoTiPage />} />
            <Route path="/contrato" element={<ContratoPage />} />
            <Route path="/compra-concluida" element={<CompraConcluida />} />
            <Route path="/ativacao-acesso" element={<AtivacaoAcessoPage />} />
            <Route path="/contrato-final/:quoteId" element={<ContratoFinalPage />} />
            <Route path="/area-do-cliente" element={<AreaDoClientePage />} />
            <Route path="/cliente" element={<Navigate to="/area-do-cliente" replace />} />
            <Route path="/redefinir-senha" element={<RedefinirSenhaPage />} />
            <Route path="/reestruturacao-completa-de-rede-corporativa" element={<ReestruturacaoRedePage />} />
            <Route path="/desenvolvimento-de-sites-e-sistemas-web" element={<DesenvolvimentoWebPage />} />
            <Route path="/automacao-de-ti-com-inteligencia-artificial" element={<AutomacaoIaPage />} />
            <Route path="/automacao-alexa-casa-empresa-inteligente" element={<AutomacaoAlexaPage />} />
            <Route path="/admin" element={<AdminPage />} />
            {/* Segment dedicated pages */}
            <Route path="/ti-para-cartorios" element={<TiCartoriosPage />} />
            <Route path="/ti-para-serventias-cartoriais" element={<TiServentiasCartoriaisPage />} />
            <Route path="/ti-para-industrias-alimenticias" element={<TiIndustriasAlimenticiaPage />} />
            <Route path="/ti-para-industrias-petroliferas" element={<TiIndustriasPetroliferasPage />} />
            <Route path="/ti-para-escritorios-de-advocacia" element={<TiEscritoriosAdvocaciaPage />} />
            <Route path="/ti-para-contabilidades" element={<TiContabilidadesPage />} />
            <Route path="/ti-para-escritorios-corporativos" element={<TiEscritoriosCorporativosPage />} />
            {/* Provimento 213 */}
            <Route path="/provimento-213" element={<Navigate to="/cartorios/provimento-213" replace />} />
            <Route path="/cartorios/provimento-213" element={<Provimento213 />} />
            {/* Blog */}
            <Route path="/blog" element={<BlogPage />} />
            <Route path="/blog/:slug" element={<BlogPostPage />} />
            {/* Legacy redirects */}
            <Route path="/servidores-dell-poweredge-jacarei" element={<Navigate to="/servidor-dell-poweredge-jacarei" replace />} />
            <Route path="/servidores-dell-poweredge" element={<Navigate to="/servidor-dell-poweredge-jacarei" replace />} />
            <Route path="/locacao-de-computadores-para-empresas" element={<Navigate to="/locacao-de-computadores-para-empresas-jacarei" replace />} />
            <Route path="/locacao-computadores-jacarei" element={<Navigate to="/locacao-de-computadores-para-empresas-jacarei" replace />} />
            <Route path="/suporte-ti-empresarial-jacarei" element={<Navigate to="/suporte-ti-jacarei" replace />} />
            <Route path="/infraestrutura-ti-corporativa" element={<Navigate to="/infraestrutura-ti-corporativa-jacarei" replace />} />
            <Route path="/infraestrutura-corporativa" element={<Navigate to="/infraestrutura-ti-corporativa-jacarei" replace />} />
            <Route path="/seguranca-da-informacao-empresarial-jacarei" element={<Navigate to="/seguranca-de-rede" replace />} />
            <Route path="/microsoft-365-empresas-jacarei" element={<Navigate to="/microsoft-365-para-empresas-jacarei" replace />} />
            <Route path="/microsoft-365-para-empresas" element={<Navigate to="/microsoft-365-para-empresas-jacarei" replace />} />
            <Route path="/montagem-redes-corporativas-jacarei" element={<Navigate to="/montagem-e-monitoramento-de-redes-jacarei" replace />} />
            <Route path="/montagem-redes-estruturadas-jacarei" element={<Navigate to="/montagem-e-monitoramento-de-redes-jacarei" replace />} />
            <Route path="/montagem-redes-jacarei" element={<Navigate to="/montagem-e-monitoramento-de-redes-jacarei" replace />} />
            <Route path="/ti-para-industrias" element={<Navigate to="/ti-para-industrias-alimenticias" replace />} />
            {/* Dynamic SEO pages (40+) */}
            <Route path="/:slug" element={<DynamicSeoPage />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
