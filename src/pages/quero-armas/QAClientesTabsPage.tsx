/**
 * FASE 22-C.2 — Tela unificada `/clientes` com abas.
 *
 * Apenas wrapper de navegação. Não refatora lógica interna.
 * Rotas antigas /acessos e /clubes permanecem ativas em QARoutes.
 */
import { useState } from "react";
import { Users, KeyRound, Building2, Activity } from "lucide-react";
import { QALogo } from "@/components/quero-armas/QALogo";
import QAClientesPage from "./QAClientesPage";
import QAAcessosPage from "./QAAcessosPage";
import QAClubesPage from "./QAClubesPage";
import MonitorCadastrosDocumentos from "@/components/quero-armas/clientes/MonitorCadastrosDocumentos";

type TabKey = "clientes" | "monitor" | "acessos" | "clubes";

const TABS: { key: TabKey; label: string; icon: any }[] = [
  { key: "clientes", label: "Clientes", icon: Users },
  { key: "monitor",  label: "Monitor",  icon: Activity },
  { key: "acessos", label: "Acessos", icon: KeyRound },
  { key: "clubes", label: "Clubes de Tiro", icon: Building2 },
];

export default function QAClientesTabsPage() {
  const [tab, setTab] = useState<TabKey>("clientes");

  return (
    <div className="qa-scope min-h-screen bg-[#F7F8FA]">
      <header className="border-b border-slate-200 bg-white">
        <div className="w-full pr-4 py-5 flex items-start gap-5" style={{ paddingLeft: '25px' }}>
          {/* Logo Quero Armas — preenche o espaço quadrado à esquerda do título */}
          <QALogo
            linkTo={null}
            className="h-20 w-20 md:h-24 md:w-24 shrink-0 mt-0.5"
            alt="Quero Armas"
          />
          <div className="min-w-0 flex-1">
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
        </div>
      </header>

      {/* Espaçamento vertical entre a faixa superior e o conteúdo (cabeçalho do cliente / listagem). */}
      <div className="pt-6 md:pt-8 pb-8">
        {tab === "clientes" && <QAClientesPage />}
        {tab === "monitor"  && <MonitorCadastrosDocumentos />}
        {tab === "acessos" && <QAAcessosPage />}
        {tab === "clubes" && <QAClubesPage />}
      </div>
    </div>
  );
}