import { Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { lazyRetry } from "@/lib/lazyRetry";
import { AuthProvider } from "@/shared/auth/AuthProvider";
import { ProtectedRoute } from "@/shared/auth/ProtectedRoute";
import { CartProvider } from "@/shared/cart/CartProvider";

import HomePage from "@/pages/HomePage";
import AuthPage from "@/pages/AuthPage";
import ServicesListPage from "@/pages/ServicesListPage";
import ServiceLandingPage from "@/pages/ServiceLandingPage";
import ServiceSalesPage from "@/pages/ServiceSalesPage";
import QuizPage from "@/pages/QuizPage";
import LpDefesaPessoalPosse from "@/pages/LpDefesaPessoalPosse";
import LpCacCr from "@/pages/LpCacCr";
import LpAtividadesAvulsas from "@/pages/LpAtividadesAvulsas";
import CartPage from "@/pages/CartPage";
import CheckoutPage from "@/pages/CheckoutPage";
import CheckoutSuccessPage from "@/pages/CheckoutSuccessPage";
import ContractSignaturePage from "@/pages/ContractSignaturePage";
import AdminDashboard from "@/pages/admin/AdminDashboard";
import AdminCategorias from "@/pages/admin/AdminCategorias";
import AdminServicos from "@/pages/admin/AdminServicos";

const QARoutes = lazyRetry(() => import("./pages/quero-armas/QARoutes.tsx"), "QARoutes");

const queryClient = new QueryClient();

const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-background">
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
          <AuthProvider>
            <CartProvider>
              <Suspense fallback={<PageLoader />}>
                <Routes>
                  {/* Comercial / Público */}
                  <Route path="/" element={<HomePage />} />
                  <Route path="/auth" element={<AuthPage />} />
                  <Route path="/servicos" element={<ServicesListPage />} />
                  <Route path="/servicos/:slug" element={<ServiceLandingPage />} />
                  <Route path="/servicos/:slug/contratar" element={<ServiceSalesPage />} />
                  <Route path="/descobrir-meu-caminho" element={<QuizPage />} />
                  <Route path="/lp/defesa-pessoal-posse" element={<LpDefesaPessoalPosse />} />
                  <Route path="/lp/cac-cr" element={<LpCacCr />} />
                  <Route path="/lp/atividades-avulsas" element={<LpAtividadesAvulsas />} />

                  {/* Transacional */}
                  <Route path="/carrinho" element={<CartPage />} />
                  <Route path="/checkout" element={<ProtectedRoute><CheckoutPage /></ProtectedRoute>} />
                  <Route path="/checkout/sucesso" element={<CheckoutSuccessPage />} />
                  <Route path="/contratos/:id/assinar" element={<ProtectedRoute><ContractSignaturePage /></ProtectedRoute>} />

                  {/* Portal do cliente → redireciona para o portal robusto existente */}
                  <Route path="/portal" element={<Navigate to="/quero-armas/area-do-cliente" replace />} />
                  <Route path="/portal/*" element={<Navigate to="/quero-armas/area-do-cliente" replace />} />

                  {/* Admin */}
                  <Route path="/admin" element={<ProtectedRoute requireRole="admin"><AdminDashboard /></ProtectedRoute>} />
                  <Route path="/admin/categorias" element={<ProtectedRoute requireRole="admin"><AdminCategorias /></ProtectedRoute>} />
                  <Route path="/admin/servicos" element={<ProtectedRoute requireRole="admin"><AdminServicos /></ProtectedRoute>} />

                  {/* Quero Armas (portal cliente robusto + admin) */}
                  <Route path="/quero-armas/*" element={<QARoutes />} />

                  {/* Catch-all */}
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </Suspense>
            </CartProvider>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
