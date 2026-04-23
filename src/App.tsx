import { Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate, useLocation } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { lazyRetry } from "@/lib/lazyRetry";
import { AuthProvider } from "@/shared/auth/AuthProvider";
import { CartProvider } from "@/shared/cart/CartProvider";

const QARoutes = lazyRetry(() => import("./pages/quero-armas/QARoutes.tsx"), "QARoutes");

const queryClient = new QueryClient();

const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-background">
    <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
  </div>
);

/**
 * Redireciona /quero-armas/<resto> → /<resto> preservando query/hash.
 */
const LegacyRedirect = () => {
  const location = useLocation();
  const stripped = location.pathname.replace(/^\/quero-armas/, "") || "/";
  return <Navigate to={`${stripped}${location.search}${location.hash}`} replace />;
};

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
                  {/* Legacy: redireciona /quero-armas/* → /* */}
                  <Route path="/quero-armas" element={<Navigate to="/" replace />} />
                  <Route path="/quero-armas/*" element={<LegacyRedirect />} />

                  {/* Quero Armas (todas as rotas) */}
                  <Route path="/*" element={<QARoutes />} />
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
