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
const InfraestruturaCorporativaPage = lazy(() => import("./pages/InfraestruturaCorporativaPage.tsx"));
const OrcamentoTiPage = lazy(() => import("./pages/OrcamentoTiPage.tsx"));
const ContratoPage = lazy(() => import("./pages/ContratoPage.tsx"));

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
            {/* Budget system */}
            <Route path="/orcamento-ti" element={<OrcamentoTiPage />} />
            {/* Segment dedicated pages */}
            <Route path="/ti-para-cartorios" element={<TiCartoriosPage />} />
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
