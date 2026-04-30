/**
 * FASE 22-C.1 — Tela unificada `/operacao/contratacoes` com abas.
 *
 * Não refatora. Apenas envelopa as duas páginas existentes em abas:
 *  - "Vendas a validar"        → QAVendasPendentesPage
 *  - "Cadastros incompletos"   → QAContratacoesPendentesPage
 *
 * Rota antiga `/contratacoes-pendentes` permanece intacta em QARoutes.
 */

import { useState } from "react";
import { ClipboardList, Inbox } from "lucide-react";
import QAVendasPendentesPage from "./QAVendasPendentesPage";
import QAContratacoesPendentesPage from "./QAContratacoesPendentesPage";

type TabKey = "vendas" | "cadastros";

export default function QAContratacoesTabsPage() {
  const [tab, setTab] = useState<TabKey>("vendas");

  return (
    <div className="min-h-screen bg-[#F7F8FA]">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-[1400px] px-4 py-5">
          <h1 className="text-[20px] font-bold uppercase tracking-wider text-slate-900">
            Contratações
          </h1>
          <p className="mt-1 text-[12px] text-slate-500">
            Validação de vendas, valores informados pelo cliente e cadastros públicos pendentes.
          </p>

          <div className="mt-4 inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1">
            <button
              type="button"
              onClick={() => setTab("vendas")}
              className={`inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider transition-all ${
                tab === "vendas"
                  ? "bg-white text-slate-900 shadow-sm border border-slate-200"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              <ClipboardList className="h-3.5 w-3.5" />
              Vendas a validar
            </button>
            <button
              type="button"
              onClick={() => setTab("cadastros")}
              className={`inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider transition-all ${
                tab === "cadastros"
                  ? "bg-white text-slate-900 shadow-sm border border-slate-200"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              <Inbox className="h-3.5 w-3.5" />
              Cadastros incompletos
            </button>
          </div>
        </div>
      </header>

      <div>
        {tab === "vendas" ? <QAVendasPendentesPage /> : <QAContratacoesPendentesPage />}
      </div>
    </div>
  );
}