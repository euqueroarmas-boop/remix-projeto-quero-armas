import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { sanitizeClientPortalNext } from "@/shared/quero-armas/portalNavigation";
import { clearOAuthNext, readOAuthNext } from "@/shared/auth/socialSignIn";

export default function QAAuthCallbackPage() {
  const navigate = useNavigate();
  const [message, setMessage] = useState("Finalizando seu acesso...");
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const url = new URL(window.location.href);
        const search = url.searchParams;
        const hash = new URLSearchParams(url.hash.replace(/^#/, ""));
        const next = search.get("next") ? sanitizeClientPortalNext(search.get("next")) : readOAuthNext();
        const error = search.get("error_description") || hash.get("error_description") || search.get("error") || hash.get("error");
        const code = search.get("code");
        const accessToken = hash.get("access_token");
        const refreshToken = hash.get("refresh_token");

        if (error) throw new Error(decodeURIComponent(error));

        if (code) {
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          if (exchangeError) throw exchangeError;
        } else if (accessToken && refreshToken) {
          const { error: sessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (sessionError) throw sessionError;
        }

        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error("Sessão não foi criada pelo Google.");

        // TRAVA DE VÍNCULO — não entrar no portal sem cadastro resolvido.
        //
        // O login social por REDIRECT volta aqui, e não pela tela de login: o
        // fallback por CPF que existe lá nunca era oferecido. Entrando assim,
        // o portal chamava `qa_ensure_cliente_from_auth` sem CPF e, quando o
        // e-mail do Google era diferente do e-mail do contrato, nada casava e
        // um cadastro NOVO era criado — cliente num Arsenal vazio e o cadastro
        // verdadeiro órfão. Aqui conferimos antes e mandamos para o CPF.
        const userId = session.user.id;
        const [{ data: link }, { data: clienteDireto }] = await Promise.all([
          supabase.from("cliente_auth_links" as any)
            .select("id").eq("user_id", userId).eq("status", "active").maybeSingle(),
          supabase.from("qa_clientes" as any)
            .select("id").eq("user_id", userId).eq("excluido", false).maybeSingle(),
        ]);

        clearOAuthNext();
        if (cancelled) return;
        if (!link && !clienteDireto) {
          const destino = `/area-do-cliente/login?vincular=1&next=${encodeURIComponent(next)}`;
          navigate(destino, { replace: true });
          return;
        }
        navigate(next, { replace: true });
      } catch (err: any) {
        if (cancelled) return;
        setFailed(true);
        setMessage(err?.message || "Não foi possível finalizar o login pelo Google.");
      }
    })();

    return () => { cancelled = true; };
  }, [navigate]);

  return (
    <main className="min-h-screen bg-[#050505] text-white flex items-center justify-center px-6">
      <section className="w-full max-w-md border border-white/10 bg-white/[0.04] p-8 text-center">
        <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center border border-[#D6A64B]/50 text-[#D6A64B]">
          {failed ? <ShieldCheck className="h-5 w-5" /> : <Loader2 className="h-5 w-5 animate-spin" />}
        </div>
        <h1 className="text-xl font-semibold">Login Google</h1>
        <p className="mt-3 text-sm text-white/70">{message}</p>
        {failed && (
          <button
            type="button"
            onClick={() => navigate("/area-do-cliente/login", { replace: true })}
            className="mt-6 h-11 w-full border border-[#D6A64B]/50 text-sm font-semibold text-[#D6A64B] hover:bg-[#D6A64B]/10"
          >
            Voltar ao login
          </button>
        )}
      </section>
    </main>
  );
}
