import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Index from "./pages/Index.tsx";
import Provimento213 from "./pages/Provimento213.tsx";
import CartoriosPage from "./pages/CartoriosPage.tsx";
import ServicosPage from "./pages/ServicosPage.tsx";
import LocacaoPage from "./pages/LocacaoPage.tsx";
import InfraestruturaPage from "./pages/InfraestruturaPage.tsx";
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/provimento-213" element={<Provimento213 />} />
          <Route path="/cartorios" element={<CartoriosPage />} />
          <Route path="/servicos" element={<ServicosPage />} />
          <Route path="/locacao" element={<LocacaoPage />} />
          <Route path="/infraestrutura" element={<InfraestruturaPage />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
