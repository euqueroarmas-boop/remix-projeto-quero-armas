import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, LogIn, UserPlus, Loader2, Sparkles, Zap } from "lucide-react";

/**
 * QAContratarIdentificarPage — Visitante não logado escolheu um serviço.
 * Pergunta: já é cliente? -> /area-do-cliente/login?next=...
 *           sou novo?    -> /cadastro?servico=slug (wizard público completo)
 */
export default function QAContratarIdentificarPage() {
  const navigate = useNavigate();
  const { slug = "" } = useParams();
  const [nome, setNome] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      // Se já estiver logado, vai direto para revisão
      const { data: sess } = await supabase.auth.getSession();
      if (sess.session) {
        navigate(`/area-do-cliente/contratar/${slug}/confirmar`, { replace: true });
        return;
      }
      const { data } = await supabase
        .from("qa_servicos_catalogo" as any)
        .select("nome")
        .eq("slug", slug)
        .maybeSingle();
      setNome((data as any)?.nome ?? slug);
      setLoading(false);
    })();
  }, [slug, navigate]);

  const irParaLogin = () => {
    const next = encodeURIComponent(`/area-do-cliente/contratar/${slug}/confirmar`);
    navigate(`/area-do-cliente/login?next=${next}`);
  };
  const irParaCadastro = () => navigate(`/cadastro?servico=${slug}`);
  const irParaSolicitar = () => navigate(`/area-do-cliente/contratar/${slug}/solicitar`);

  return (
    <div data-tactical-portal className="min-h-screen">
      <div className="qa-resumo-light">
        <div className="px-4 pt-4 pb-3 border-b border-slate-200/70 bg-white sticky top-0 z-10">
          <div className="max-w-xl mx-auto flex items-center gap-3">
            <button
              onClick={() => navigate("/area-do-cliente/contratar")}
              className="w-9 h-9 rounded-lg flex items-center justify-center bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
              aria-label="Voltar"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div className="flex-1 min-w-0">
              <h1 className="text-base md:text-lg font-bold text-slate-900 uppercase tracking-tight">
                Você já é cliente?
              </h1>
              <p className="text-[11px] md:text-xs text-slate-500 mt-0.5 truncate">
                Serviço: <strong className="text-slate-700">{loading ? "…" : nome}</strong>
              </p>
            </div>
          </div>
        </div>

        <div className="max-w-xl mx-auto px-4 py-6 space-y-3">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 text-amber-500 animate-spin" />
            </div>
          ) : (
            <>
              <button
                onClick={irParaLogin}
                className="w-full text-left rounded-xl bg-white border border-slate-200 hover:border-amber-300 hover:shadow-md transition p-4 flex items-center gap-3"
              >
                <div className="w-10 h-10 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                  <LogIn className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <div className="text-sm font-bold text-slate-900 uppercase">Já sou cliente</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    Faço login e contrato em segundos — só revisar dados.
                  </div>
                </div>
                <Sparkles className="h-4 w-4 text-amber-500" />
              </button>

              <button
                onClick={irParaCadastro}
                className="w-full text-left rounded-xl bg-white border border-slate-200 hover:border-amber-300 hover:shadow-md transition p-4 flex items-center gap-3"
              >
                <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
                  <UserPlus className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <div className="text-sm font-bold text-slate-900 uppercase">Sou novo aqui</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    Faço o cadastro guiado em 5 etapas com o serviço já selecionado.
                  </div>
                </div>
              </button>

              <button
                onClick={irParaSolicitar}
                className="w-full text-left rounded-xl bg-white border border-slate-200 hover:border-amber-300 hover:shadow-md transition p-4 flex items-center gap-3"
              >
                <div className="w-10 h-10 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center shrink-0">
                  <Zap className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <div className="text-sm font-bold text-slate-900 uppercase">Solicitar agora</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    Envio nome, CPF, e-mail, telefone e o valor combinado — equipe valida e me retorna.
                  </div>
                </div>
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}