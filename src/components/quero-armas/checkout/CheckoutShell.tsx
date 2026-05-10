import { ReactNode, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import {
  ArrowLeft,
  Check,
  Sparkles,
  ShieldCheck,
  Headphones,
  LayoutDashboard,
  FileSignature,
  ListChecks,
  Lock,
} from "lucide-react";

type Step = 1 | 2 | 3 | 4;

interface ServiceSummary {
  nome: string;
  descricao_curta: string | null;
  preco: number | null;
  recorrente: boolean;
}

interface CheckoutShellProps {
  step: Step;
  slug: string;
  backTo?: string;
  children: ReactNode;
  /** se omitido, CheckoutShell carrega pelo slug */
  summary?: ServiceSummary | null;
}

const STEPS: Array<{ n: Step; label: string }> = [
  { n: 1, label: "Identificação" },
  { n: 2, label: "Dados" },
  { n: 3, label: "Confirmação" },
  { n: 4, label: "Pagamento" },
];

function formatBRL(v: number | null) {
  if (v == null) return null;
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}

export default function CheckoutShell({
  step,
  slug,
  backTo = "/carrinho",
  children,
  summary,
}: CheckoutShellProps) {
  const navigate = useNavigate();
  const [internal, setInternal] = useState<ServiceSummary | null>(summary ?? null);

  useEffect(() => {
    if (summary) {
      setInternal(summary);
      return;
    }
    if (!slug) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("qa_servicos_catalogo" as any)
        .select("nome, descricao_curta, preco, recorrente")
        .eq("slug", slug)
        .eq("ativo", true)
        .maybeSingle();
      if (!cancelled && data) setInternal(data as any);
    })();
    return () => {
      cancelled = true;
    };
  }, [slug, summary]);

  const preco = formatBRL(internal?.preco ?? null);

  return (
    <div data-tactical-portal className="min-h-screen bg-slate-50">
      {/* HERO */}
      <header className="relative overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white">
        <div className="absolute inset-0 opacity-[0.06] bg-[radial-gradient(circle_at_30%_20%,#fbbf24_0,transparent_45%),radial-gradient(circle_at_80%_80%,#f59e0b_0,transparent_45%)]" />
        <div className="relative max-w-6xl mx-auto px-4 pt-5 pb-6 md:pt-8 md:pb-10">
          <button
            onClick={() => navigate(backTo)}
            className="inline-flex items-center gap-2 text-[11px] uppercase tracking-widest text-slate-300 hover:text-amber-300 transition mb-4"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Voltar
          </button>
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[10px] font-bold uppercase tracking-widest mb-3">
            <Sparkles className="h-3 w-3" /> Checkout Quero Armas
          </div>
          <h1 className="text-xl md:text-3xl font-extrabold uppercase tracking-tight leading-tight">
            Finalize sua contratação com segurança
          </h1>
          <p className="text-[13px] md:text-sm text-slate-300 mt-2 max-w-2xl leading-relaxed">
            Estamos a poucos passos de iniciar seu atendimento. Revise seus dados e
            conclua sua contratação com a Quero Armas.
          </p>

          {/* STEPPER */}
          <ol className="mt-6 grid grid-cols-4 gap-2 md:gap-3">
            {STEPS.map((s) => {
              const done = s.n < step;
              const active = s.n === step;
              return (
                <li key={s.n} className="flex flex-col items-start gap-1.5">
                  <div className="flex items-center gap-2 w-full">
                    <div
                      className={`shrink-0 w-7 h-7 md:w-8 md:h-8 rounded-full flex items-center justify-center text-[11px] md:text-xs font-bold border transition ${
                        active
                          ? "bg-amber-500 border-amber-400 text-slate-950 shadow-[0_0_0_4px_rgba(245,158,11,0.18)]"
                          : done
                            ? "bg-emerald-500/90 border-emerald-400 text-white"
                            : "bg-slate-800/70 border-slate-700 text-slate-400"
                      }`}
                    >
                      {done ? <Check className="h-3.5 w-3.5" /> : s.n}
                    </div>
                    <div
                      className={`hidden md:block flex-1 h-[2px] rounded ${
                        done ? "bg-emerald-500/70" : "bg-slate-700/60"
                      }`}
                    />
                  </div>
                  <span
                    className={`text-[10px] md:text-[11px] font-bold uppercase tracking-wider ${
                      active ? "text-amber-300" : done ? "text-emerald-300" : "text-slate-500"
                    }`}
                  >
                    {s.n}. {s.label}
                  </span>
                </li>
              );
            })}
          </ol>
        </div>
      </header>

      {/* CONTENT GRID */}
      <main className="max-w-6xl mx-auto px-4 py-6 md:py-8">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6">
          <div className="min-w-0 space-y-4">{children}</div>

          {/* SIDEBAR SUMMARY */}
          <aside className="lg:sticky lg:top-4 self-start space-y-3">
            <div className="rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-4 py-3 bg-gradient-to-r from-slate-950 to-slate-900 text-white flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-widest text-amber-300">
                  Resumo
                </span>
                <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-widest text-emerald-300">
                  <Sparkles className="h-3 w-3" /> Catálogo oficial
                </span>
              </div>
              <div className="p-4 space-y-3">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                    Serviço
                  </div>
                  <div className="text-sm font-bold text-slate-900 uppercase mt-0.5 leading-tight">
                    {internal?.nome || "—"}
                  </div>
                  {internal?.descricao_curta && (
                    <p className="text-[11px] text-slate-600 mt-1 leading-relaxed line-clamp-3">
                      {internal.descricao_curta}
                    </p>
                  )}
                </div>
                <div className="border-t border-slate-100 pt-3 flex items-end justify-between">
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                      Total
                    </div>
                    <div className="text-lg font-extrabold text-slate-900">
                      {preco ?? "A combinar"}
                      {internal?.recorrente && preco && (
                        <span className="text-[11px] font-medium text-slate-500 ml-1">/mês</span>
                      )}
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5">
                    <Lock className="h-3 w-3" /> Seguro
                  </span>
                </div>
                <div className="rounded-lg bg-slate-50 border border-slate-200 p-2.5 text-[11px] text-slate-600 leading-relaxed">
                  Seu processo começa após a confirmação do pagamento. Você receberá
                  acesso ao portal para acompanhar documentos, etapas e próximos passos.
                </div>
              </div>
            </div>

            {/* TRUST STRIP */}
            <div className="grid grid-cols-1 gap-2">
              {[
                { Icon: ShieldCheck, label: "Pagamento seguro" },
                { Icon: Headphones, label: "Atendimento especializado" },
                { Icon: LayoutDashboard, label: "Portal do cliente incluso" },
                { Icon: FileSignature, label: "Contrato liberado após confirmação" },
                { Icon: ListChecks, label: "Checklist documental orientado" },
              ].map(({ Icon, label }) => (
                <div
                  key={label}
                  className="flex items-center gap-2 rounded-lg bg-white border border-slate-200 px-3 py-2 text-[11px] text-slate-700"
                >
                  <Icon className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                  <span className="font-medium uppercase tracking-wide">{label}</span>
                </div>
              ))}
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}