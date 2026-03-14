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
            <Route path="/ti-para-hospitais-e-clinicas" element={<TiHospitaisClinicasPage />} />
            <Route path="/sobre" element={<SobrePage />} />
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
