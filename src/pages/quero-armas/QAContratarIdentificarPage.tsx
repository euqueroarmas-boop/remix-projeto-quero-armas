import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { LogIn, UserPlus, Loader2, Sparkles, Zap } from "lucide-react";
import CheckoutShell from "@/components/quero-armas/checkout/CheckoutShell";

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
    <CheckoutShell step={1} slug={slug} backTo="/carrinho">
      <div className="rounded-2xl bg-white border border-slate-200 shadow-sm p-5 md:p-6">
        <h2 className="text-base md:text-lg font-bold text-slate-900 uppercase tracking-tight">
          Você já é cliente?
        </h2>
        <p className="text-[12px] text-slate-500 mt-1">
          Serviço selecionado: <strong className="text-slate-700 uppercase">{loading ? "…" : nome}</strong>
        </p>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 text-amber-500 animate-spin" />
          </div>
        ) : (
          <div className="mt-5 space-y-3">
            <button
                onClick={irParaLogin}
                className="w-full text-left rounded-xl bg-white border border-slate-200 hover:border-amber-300 hover:shadow-md transition p-4 flex items-center gap-3"
              >
                <div className="w-10 h-10 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                  <LogIn className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <div className="text-sm font-bold text-slate-900 uppercase">Continuar contratação — já sou cliente</div>
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
            <p className="text-[11px] text-slate-500 leading-relaxed pt-2 border-t border-slate-100">
              Seu processo começa após a confirmação do pagamento. Você receberá acesso ao portal
              para acompanhar documentos, etapas e próximos passos.
            </p>
          </div>
        )}
      </div>
    </CheckoutShell>
  );
}