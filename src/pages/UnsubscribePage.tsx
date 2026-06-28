import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

type State = "loading" | "ready" | "already" | "invalid" | "submitting" | "done" | "error";

export default function UnsubscribePage() {
  const [params] = useSearchParams();
  const token = params.get("token");
  const [state, setState] = useState<State>("loading");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setState("invalid");
      return;
    }
    (async () => {
      try {
        const res = await fetch(
          `${SUPABASE_URL}/functions/v1/handle-email-unsubscribe?token=${encodeURIComponent(token)}`,
          { headers: { apikey: SUPABASE_ANON_KEY } }
        );
        const data = await res.json();
        if (!res.ok) {
          setState("invalid");
          setError(data?.error || "Token inválido");
          return;
        }
        if (data.valid === false && data.reason === "already_unsubscribed") {
          setState("already");
        } else if (data.valid === true) {
          setState("ready");
        } else {
          setState("invalid");
        }
      } catch (e: any) {
        setState("error");
        setError(e?.message || "Falha ao validar");
      }
    })();
  }, [token]);

  const confirm = async () => {
    if (!token) return;
    setState("submitting");
    try {
      const { data, error } = await supabase.functions.invoke("handle-email-unsubscribe", {
        body: { token },
      });
      if (error) throw error;
      if (data?.success || data?.reason === "already_unsubscribed") setState("done");
      else {
        setState("error");
        setError("Não foi possível concluir.");
      }
    } catch (e: any) {
      setState("error");
      setError(e?.message || "Falha ao processar");
    }
  };

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#f6f5f1",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
        fontFamily: "system-ui, -apple-system, sans-serif",
      }}
    >
      <section
        style={{
          background: "#fff",
          border: "1px solid #e6e3dc",
          borderRadius: 8,
          maxWidth: 480,
          width: "100%",
          padding: "32px",
          color: "#0a0a0a",
        }}
      >
        <h1 style={{ fontSize: 18, fontWeight: 800, letterSpacing: "0.08em", color: "#7A1F2B", margin: 0 }}>
          QUERO ARMAS
        </h1>
        <h2 style={{ fontSize: 22, fontWeight: 700, margin: "16px 0 8px" }}>Cancelar inscrição</h2>

        {state === "loading" && <p>Validando link…</p>}
        {state === "invalid" && (
          <p style={{ color: "#7A1F2B" }}>Link inválido ou expirado. {error}</p>
        )}
        {state === "already" && <p>Este e-mail já foi removido das comunicações.</p>}
        {state === "ready" && (
          <>
            <p style={{ color: "#444", lineHeight: 1.6 }}>
              Confirme abaixo para parar de receber e-mails do sistema Quero Armas.
            </p>
            <button
              onClick={confirm}
              style={{
                marginTop: 16,
                background: "#7A1F2B",
                color: "#fff",
                border: 0,
                padding: "12px 24px",
                borderRadius: 4,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Confirmar cancelamento
            </button>
          </>
        )}
        {state === "submitting" && <p>Processando…</p>}
        {state === "done" && (
          <p style={{ color: "#1a5e1a" }}>Pronto. Você foi removido da nossa lista.</p>
        )}
        {state === "error" && (
          <p style={{ color: "#7A1F2B" }}>Erro: {error}</p>
        )}
      </section>
    </main>
  );
}
