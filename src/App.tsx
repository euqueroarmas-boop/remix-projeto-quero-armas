import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Index from "./pages/Index.tsx";

const Provimento213 = lazy(() => import("./pages/Provimento213.tsx"));
const CartoriosPage = lazy(() => import("./pages/CartoriosPage.tsx"));
const ServicosPage = lazy(() => import("./pages/ServicosPage.tsx"));
const LocacaoPage = lazy(() => import("./pages/LocacaoPage.tsx"));
const InfraestruturaPage = lazy(() => import("./pages/InfraestruturaPage.tsx"));
const BlogPage = lazy(() => import("./pages/BlogPage.tsx"));
const BlogPostPage = lazy(() => import("./pages/BlogPostPage.tsx"));
const DynamicSeoPage = lazy(() => import("./pages/DynamicSeoPage.tsx"));
const NotFound = lazy(() => import("./pages/NotFound.tsx"));
const TiHospitaisClinicasPage = lazy(() => import("./pages/TiHospitaisClinicasPage.tsx"));
const SobrePage = lazy(() => import("./pages/SobrePage.tsx"));
const InstitucionalPage = lazy(() => import("./pages/InstitucionalPage.tsx"));
const TerceirizacaoPage = lazy(() => import("./pages/TerceirizacaoPage.tsx"));
const FirewallPfsensePage = lazy(() => import("./pages/FirewallPfsensePage.tsx"));
const ServidoresDellPage = lazy(() => import("./pages/ServidoresDellPage.tsx"));
const Microsoft365Page = lazy(() => import("./pages/Microsoft365Page.tsx"));
const MontagemRedesPage = lazy(() => import("./pages/MontagemRedesPage.tsx"));
const LocacaoComputadoresPage = lazy(() => import("./pages/LocacaoComputadoresPage.tsx"));
const SuporteTiPage = lazy(() => import("./pages/SuporteTiPage.tsx"));
const TiCartoriosPage = lazy(() => import("./pages/TiCartoriosPage.tsx"));
const TiServentiasCartoriaisPage = lazy(() => import("./pages/TiServentiasCartoriaisPage.tsx"));
const TiIndustriasAlimenticiaPage = lazy(() => import("./pages/TiIndustriasAlimenticiaPage.tsx"));
const TiIndustriasPetroliferasPage = lazy(() => import("./pages/TiIndustriasPetroliferasPage.tsx"));
const TiEscritoriosAdvocaciaPage = lazy(() => import("./pages/TiEscritoriosAdvocaciaPage.tsx"));
const TiContabilidadesPage = lazy(() => import("./pages/TiContabilidadesPage.tsx"));
const TiEscritoriosCorporativosPage = lazy(() => import("./pages/TiEscritoriosCorporativosPage.tsx"));
const InfraestruturaCorporativaPage = lazy(() => import("./pages/InfraestruturaCorporativaPage.tsx"));
const OrcamentoTiPage = lazy(() => import("./pages/OrcamentoTiPage.tsx"));
const ContratoPage = lazy(() => import("./pages/ContratoPage.tsx"));
const AdministracaoServidoresPage = lazy(() => import("./pages/AdministracaoServidoresPage.tsx"));
const MonitoramentoServidoresPage = lazy(() => import("./pages/MonitoramentoServidoresPage.tsx"));
const BackupCorporativoPage = lazy(() => import("./pages/BackupCorporativoPage.tsx"));
const SegurancaDeRedePage = lazy(() => import("./pages/SegurancaDeRedePage.tsx"));
const MonitoramentoDeRedePage = lazy(() => import("./pages/MonitoramentoDeRedePage.tsx"));
const SuporteEmergencialPage = lazy(() => import("./pages/SuporteEmergencialPage.tsx"));
const SuporteWindowsServerPage = lazy(() => import("./pages/SuporteWindowsServerPage.tsx"));
const SuporteLinuxPage = lazy(() => import("./pages/SuporteLinuxPage.tsx"));
const ManutencaoInfraestruturaPage = lazy(() => import("./pages/ManutencaoInfraestruturaPage.tsx"));
const SuporteRedesCorporativasPage = lazy(() => import("./pages/SuporteRedesCorporativasPage.tsx"));

const queryClient = new QueryClient();

const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center section-dark">
    <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
  </div>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
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
            {/* Budget system */}
            <Route path="/orcamento-ti" element={<OrcamentoTiPage />} />
            <Route path="/contrato" element={<ContratoPage />} />
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
            <Route path="/locacao-de-computadores-para-empresas" element={<Navigate to="/locacao-de-computadores-para-empresas-jacarei" replace />} />
            <Route path="/suporte-ti-empresarial-jacarei" element={<Navigate to="/suporte-ti-jacarei" replace />} />
            <Route path="/infraestrutura-ti-corporativa" element={<Navigate to="/infraestrutura-ti-corporativa-jacarei" replace />} />
            <Route path="/seguranca-da-informacao-empresarial-jacarei" element={<Navigate to="/seguranca-informacao-empresarial" replace />} />
            <Route path="/microsoft-365-empresas-jacarei" element={<Navigate to="/microsoft-365-para-empresas-jacarei" replace />} />
            <Route path="/montagem-redes-corporativas-jacarei" element={<Navigate to="/montagem-e-monitoramento-de-redes-jacarei" replace />} />
            {/* Dynamic SEO pages (40+) */}
            <Route path="/:slug" element={<DynamicSeoPage />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
