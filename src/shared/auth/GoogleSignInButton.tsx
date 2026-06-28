import { useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { lovable } from "@/integrations/lovable";

interface Props {
  /** Define para qual fluxo o callback deve rotear o usuário após o OAuth. */
  mode: "admin" | "cliente";
  /** Caminho relativo de destino após a validação (mesma origem). */
  next?: string;
  className?: string;
  label?: string;
}

/**
 * Botão único de "Entrar com Google" reaproveitado nos dois logins
 * (interno e portal do cliente). A validação de perfil acontece
 * em /auth/callback (QAAuthCallbackPage).
 */
export function GoogleSignInButton({ mode, next, className, label = "Entrar com Google" }: Props) {
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    setLoading(true);
    try {
      const callback = new URL("/auth/oauth-callback", window.location.origin);
      callback.searchParams.set("mode", mode);
      if (next && next.startsWith("/")) callback.searchParams.set("next", next);

      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: callback.toString(),
      });
      if (result.error) {
        toast.error("Não foi possível iniciar o login com Google.");
        setLoading(false);
        return;
      }
      if (result.redirected) return; // browser está redirecionando
      // Caso popup tenha retornado tokens — encaminha ao callback para validar perfil.
      window.location.replace(callback.toString());
    } catch (err: any) {
      toast.error(err?.message || "Erro ao entrar com Google");
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      className={
        className ||
        "inline-flex w-full items-center justify-center gap-2 h-10 px-4 rounded-md border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 text-sm font-medium transition disabled:opacity-60"
      }
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
          <path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.44a5.5 5.5 0 0 1-2.39 3.61v3h3.86c2.26-2.08 3.58-5.15 3.58-8.85z"/>
          <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.07.72-2.44 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.11A12 12 0 0 0 12 24z"/>
          <path fill="#FBBC05" d="M5.27 14.29A7.2 7.2 0 0 1 4.88 12c0-.8.14-1.57.39-2.29V6.6H1.29a12 12 0 0 0 0 10.8l3.98-3.11z"/>
          <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0A12 12 0 0 0 1.29 6.6l3.98 3.11C6.22 6.86 8.87 4.75 12 4.75z"/>
        </svg>
      )}
      {loading ? "Conectando..." : label}
    </button>
  );
}

export default GoogleSignInButton;