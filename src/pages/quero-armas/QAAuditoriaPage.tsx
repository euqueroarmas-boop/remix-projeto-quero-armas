/**
 * Auditoria — Página índice.
 * Lista as sub-áreas auditáveis do sistema. A primeira é "Recursos Administrativos".
 * Novos módulos de auditoria devem ser adicionados na lista AUDIT_MODULES.
 */
import { Link } from "react-router-dom";
import { Gavel, ShieldCheck, ArrowRight } from "lucide-react";

interface AuditModule {
  slug: string;
  title: string;
  description: string;
  icon: any;
  available: boolean;
}

const AUDIT_MODULES: AuditModule[] = [
  {
    slug: "recursos-administrativos",
    title: "Recursos Administrativos",
    description: "Êxito, perdas, prazos expirados e oportunidades não aproveitadas em processos indeferidos.",
    icon: Gavel,
    available: true,
  },
  // Próximos módulos de auditoria virão aqui.
];

export default function QAAuditoriaPage() {
  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg flex items-center justify-center bg-slate-900 text-white">
          <ShieldCheck className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight text-slate-900 uppercase">Auditoria</h1>
          <p className="text-xs text-slate-500">Central de relatórios e indicadores de qualidade operacional.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {AUDIT_MODULES.map(m => {
          const Icon = m.icon;
          const card = (
            <div className={`group h-full p-5 rounded-xl border transition-all ${
              m.available
                ? "bg-white border-slate-200 hover:border-slate-900 hover:shadow-md cursor-pointer"
                : "bg-slate-50 border-slate-200 opacity-60 cursor-not-allowed"
            }`}>
              <div className="flex items-start justify-between gap-3">
                <div className="h-9 w-9 rounded-lg flex items-center justify-center bg-slate-100 group-hover:bg-slate-900 group-hover:text-white transition">
                  <Icon className="h-4 w-4" />
                </div>
                {m.available && (
                  <ArrowRight className="h-4 w-4 text-slate-300 group-hover:text-slate-900 group-hover:translate-x-0.5 transition" />
                )}
              </div>
              <h3 className="mt-4 text-sm font-bold uppercase tracking-wide text-slate-900">{m.title}</h3>
              <p className="mt-1 text-xs text-slate-500 leading-relaxed">{m.description}</p>
              {!m.available && (
                <span className="mt-3 inline-block text-[10px] font-bold uppercase tracking-wider text-slate-400">Em breve</span>
              )}
            </div>
          );
          return m.available
            ? <Link key={m.slug} to={`/auditoria/${m.slug}`}>{card}</Link>
            : <div key={m.slug}>{card}</div>;
        })}
      </div>
    </div>
  );
}
