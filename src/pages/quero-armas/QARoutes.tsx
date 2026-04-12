import { lazy, Suspense } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { lazyRetry } from "@/lib/lazyRetry";
import { Loader2 } from "lucide-react";

const QALayout = lazyRetry(() => import("@/components/quero-armas/QALayout"), "QALayout");
const QALoginPage = lazyRetry(() => import("./QALoginPage"), "QALoginPage");
const QADashboardPage = lazyRetry(() => import("./QADashboardPage"), "QADashboardPage");
const QABaseConhecimentoPage = lazyRetry(() => import("./QABaseConhecimentoPage"), "QABaseConhecimentoPage");
const QALegislacaoPage = lazyRetry(() => import("./QALegislacaoPage"), "QALegislacaoPage");
const QAJurisprudenciaPage = lazyRetry(() => import("./QAJurisprudenciaPage"), "QAJurisprudenciaPage");
const QAIAPage = lazyRetry(() => import("./QAIAPage"), "QAIAPage");
const QAPlaceholderPage = lazyRetry(() => import("./QAPlaceholderPage"), "QAPlaceholderPage");

const Loader = () => (
  <div className="min-h-screen flex items-center justify-center bg-[#0c0c14]">
    <Loader2 className="h-6 w-6 animate-spin text-amber-500" />
  </div>
);

export default function QARoutes() {
  return (
    <Suspense fallback={<Loader />}>
      <Routes>
        <Route path="login" element={<QALoginPage />} />
        <Route element={<QALayout />}>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<QADashboardPage />} />
          <Route path="ia" element={<QAIAPage />} />
          <Route path="base-conhecimento" element={<QABaseConhecimentoPage />} />
          <Route path="base-conhecimento/:id" element={<QAPlaceholderPage />} />
          <Route path="legislacao" element={<QALegislacaoPage />} />
          <Route path="jurisprudencia" element={<QAJurisprudenciaPage />} />
          <Route path="modelos-docx" element={<QAPlaceholderPage />} />
          <Route path="gerar-peca" element={<QAPlaceholderPage />} />
          <Route path="historico" element={<QAPlaceholderPage />} />
          <Route path="configuracoes" element={<QAPlaceholderPage />} />
        </Route>
      </Routes>
    </Suspense>
  );
}
