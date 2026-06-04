/**
 * FASE 22-C.2 — Tela unificada `/auditoria` com abas.
 *
 * Apenas wrapper de navegação. Não refatora lógica interna.
 * Rotas antigas (/historico, /auditoria/recursos-administrativos,
 * /auditoria/central-documentos) permanecem ativas em QARoutes.
 */
import { useState } from "react";
import { ShieldCheck, History, Gavel, FileSearch } from "lucide-react";
import QAAuditoriaPage from "./QAAuditoriaPage";
import QAHistoricoPage from "./QAHistoricoPage";
import QARecursosAuditoriaPage from "./QARecursosAuditoriaPage";
import QAProcessosAuditoriaPage from "./QAProcessosAuditoriaPage";

type TabKey = "geral" | "historico" | "recursos" | "documentos";

const TABS: { key: TabKey; label: string; icon: any }[] = [
  { key: "geral", label: "Auditoria Geral", icon: ShieldCheck },
  { key: "historico", label: "Histórico", icon: History },
  { key: "recursos", label: "Recursos Administrativos", icon: Gavel },
  { key: "documentos", label: "Central de Documentos", icon: FileSearch },
];

export default function QAAuditoriaTabsPage() {
  const [tab, setTab] = useState<TabKey>("geral");

  return (
    <div className="min-h-screen bg-[#F7F8FA]">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-[1400px] px-4 py-5">
          <h1 className="text-[20px] font-bold uppercase tracking-wider text-slate-900">
            Auditoria
          </h1>
          <p className="mt-1 text-[12px] text-slate-500">
            Logs, histórico operacional e auditorias específicas do sistema.
          </p>

          <div className="mt-4 inline-flex flex-wrap items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1">
            {TABS.map(t => {
              const Icon = t.icon;
              const active = tab === t.key;
              return (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setTab(t.key)}
                  className={`inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider transition-all ${
                    active
                      ? "bg-white text-slate-900 shadow-sm border border-slate-200"
                      : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>
      </header>

      <div>
        {tab === "geral" && <QAAuditoriaPage />}
        {tab === "historico" && <QAHistoricoPage />}
        {tab === "recursos" && <QARecursosAuditoriaPage />}
        {tab === "documentos" && <QAProcessosAuditoriaPage />}
      </div>
    </div>
  );
}