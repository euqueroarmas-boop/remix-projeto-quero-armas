import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Index from "./pages/Index.tsx";

// Lazy load non-critical pages
const Provimento213 = lazy(() => import("./pages/Provimento213.tsx"));
const CartoriosPage = lazy(() => import("./pages/CartoriosPage.tsx"));
const ServicosPage = lazy(() => import("./pages/ServicosPage.tsx"));
const LocacaoPage = lazy(() => import("./pages/LocacaoPage.tsx"));
const InfraestruturaPage = lazy(() => import("./pages/InfraestruturaPage.tsx"));
const ServidoresDellPage = lazy(() => import("./pages/ServidoresDellPage.tsx"));
const Microsoft365Page = lazy(() => import("./pages/Microsoft365Page.tsx"));
const FirewallPfsensePage = lazy(() => import("./pages/FirewallPfsensePage.tsx"));
const MontagemRedesPage = lazy(() => import("./pages/MontagemRedesPage.tsx"));
const LocacaoComputadoresPage = lazy(() => import("./pages/LocacaoComputadoresPage.tsx"));
const SuporteTiPage = lazy(() => import("./pages/SuporteTiPage.tsx"));
const TiCartoriosPage = lazy(() => import("./pages/TiCartoriosPage.tsx"));
const InfraestruturaCorporativaPage = lazy(() => import("./pages/InfraestruturaCorporativaPage.tsx"));
const BlogPage = lazy(() => import("./pages/BlogPage.tsx"));
const BlogPostPage = lazy(() => import("./pages/BlogPostPage.tsx"));
const NotFound = lazy(() => import("./pages/NotFound.tsx"));

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
            <Route path="/provimento-213" element={<Provimento213 />} />
            <Route path="/cartorios" element={<CartoriosPage />} />
            <Route path="/servicos" element={<ServicosPage />} />
            <Route path="/locacao" element={<LocacaoPage />} />
            <Route path="/infraestrutura" element={<InfraestruturaPage />} />
            {/* SEO service pages */}
            <Route path="/servidores-dell-poweredge-jacarei" element={<ServidoresDellPage />} />
            <Route path="/microsoft-365-para-empresas-jacarei" element={<Microsoft365Page />} />
            <Route path="/firewall-pfsense-jacarei" element={<FirewallPfsensePage />} />
            <Route path="/montagem-e-monitoramento-de-redes-jacarei" element={<MontagemRedesPage />} />
            <Route path="/locacao-de-computadores-para-empresas" element={<LocacaoComputadoresPage />} />
            <Route path="/suporte-ti-empresarial-jacarei" element={<SuporteTiPage />} />
            <Route path="/ti-para-cartorios" element={<TiCartoriosPage />} />
            <Route path="/infraestrutura-ti-corporativa" element={<InfraestruturaCorporativaPage />} />
            {/* Blog */}
            <Route path="/blog" element={<BlogPage />} />
            <Route path="/blog/:slug" element={<BlogPostPage />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
