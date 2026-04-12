import { lazy, Suspense } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { lazyRetry } from "@/lib/lazyRetry";
import { Loader2 } from "lucide-react";

const QALayout = lazyRetry(() => import("@/components/quero-armas/QALayout"), "QALayout");
const QALoginPage = lazyRetry(() => import("./QALoginPage"), "QALoginPage");
const QADashboardPage = lazyRetry(() => import("./QADashboardPage"), "QADashboardPage");
const QABaseConhecimentoPage = lazyRetry(() => import("./QABaseConhecimentoPage"), "QABaseConhecimentoPage");
const QADocumentoDetalhePage = lazyRetry(() => import("./QADocumentoDetalhePage"), "QADocumentoDetalhePage");
const QALegislacaoPage = lazyRetry(() => import("./QALegislacaoPage"), "QALegislacaoPage");
const QAJurisprudenciaPage = lazyRetry(() => import("./QAJurisprudenciaPage"), "QAJurisprudenciaPage");
const QAIAPage = lazyRetry(() => import("./QAIAPage"), "QAIAPage");
const QAGerarPecaPage = lazyRetry(() => import("./QAGerarPecaPage"), "QAGerarPecaPage");
const QACasosPage = lazyRetry(() => import("./QACasosPage"), "QACasosPage");
const QAModelosDocxPage = lazyRetry(() => import("./QAModelosDocxPage"), "QAModelosDocxPage");
const QAHistoricoPage = lazyRetry(() => import("./QAHistoricoPage"), "QAHistoricoPage");
const QAConfiguracoesPage = lazyRetry(() => import("./QAConfiguracoesPage"), "QAConfiguracoesPage");

const Loader = () => (
  <div className="min-h-screen flex items-center justify-center bg-[#08080f]">
    <div className="w-6 h-6 border-2 border-slate-700 border-t-slate-400 rounded-full animate-spin" />
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
          <Route path="base-conhecimento/:id" element={<QADocumentoDetalhePage />} />
          <Route path="legislacao" element={<QALegislacaoPage />} />
          <Route path="jurisprudencia" element={<QAJurisprudenciaPage />} />
          <Route path="modelos-docx" element={<QAModelosDocxPage />} />
          <Route path="gerar-peca" element={<QAGerarPecaPage />} />
          <Route path="casos" element={<QACasosPage />} />
          <Route path="historico" element={<QAHistoricoPage />} />
          <Route path="configuracoes" element={<QAConfiguracoesPage />} />
        </Route>
      </Routes>
    </Suspense>
  );
}
