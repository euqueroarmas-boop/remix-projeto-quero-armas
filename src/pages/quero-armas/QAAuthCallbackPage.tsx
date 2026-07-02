import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const DEFAULT_NEXT = "/area-do-cliente";

function safeNext(raw: string | null | undefined) {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return DEFAULT_NEXT;
  return raw;
}

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
        const next = safeNext(search.get("next") || localStorage.getItem("qa_oauth_next"));
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

        localStorage.removeItem("qa_oauth_next");
        if (!cancelled) navigate(next, { replace: true });
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