/**
 * FASE 22-C.2 — Tela unificada `/clientes` com abas.
 *
 * Apenas wrapper de navegação. Não refatora lógica interna.
 * Rotas antigas /acessos e /clubes permanecem ativas em QARoutes.
 */
import { useState } from "react";
import { Users, KeyRound, Building2 } from "lucide-react";
import QAClientesPage from "./QAClientesPage";
import QAAcessosPage from "./QAAcessosPage";
import QAClubesPage from "./QAClubesPage";

type TabKey = "clientes" | "acessos" | "clubes";

const TABS: { key: TabKey; label: string; icon: any }[] = [
  { key: "clientes", label: "Clientes", icon: Users },
  { key: "acessos", label: "Acessos", icon: KeyRound },
  { key: "clubes", label: "Clubes de Tiro", icon: Building2 },
];

export default function QAClientesTabsPage() {
  const [tab, setTab] = useState<TabKey>("clientes");

  return (
    <div className="min-h-screen bg-[#F7F8FA]">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-[1400px] px-4 py-5">
          <h1 className="text-[20px] font-bold uppercase tracking-wider text-slate-900">
            Clientes
          </h1>
          <p className="mt-1 text-[12px] text-slate-500">
            Gestão de clientes, acessos e entidades vinculadas.
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

      {/* Espaçamento vertical entre a faixa superior e o conteúdo (cabeçalho do cliente / listagem). */}
      <div className="pt-6 md:pt-8 pb-8">
        {tab === "clientes" && <QAClientesPage />}
        {tab === "acessos" && <QAAcessosPage />}
        {tab === "clubes" && <QAClubesPage />}
      </div>
    </div>
  );
}