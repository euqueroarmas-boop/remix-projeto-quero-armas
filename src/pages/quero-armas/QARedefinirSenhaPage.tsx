import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, Eye, EyeOff } from "lucide-react";
import { QALogo } from "@/components/quero-armas/QALogo";

/**
 * Página de redefinição de senha — destino do link de recovery enviado por e-mail.
 * Aceita os formatos:
 *  - PKCE:  ?code=xxx
 *  - Hash:  #access_token=...&refresh_token=...&type=recovery
 *  - OTP:   ?token_hash=xxx&type=recovery
 */
export default function QARedefinirSenhaPage() {
  const navigate = useNavigate();
  const [verifying, setVerifying] = useState(true);
  const [ready, setReady] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const url = new URL(window.location.href);
        const search = url.searchParams;
        const hash = new URLSearchParams(url.hash.replace(/^#/, ""));

        const errParam = search.get("error_description") || hash.get("error_description") || search.get("error") || hash.get("error");
        if (errParam) throw new Error(decodeURIComponent(errParam));

        const code = search.get("code");
        const tokenHash = search.get("token_hash") || hash.get("token_hash");
        const type = (search.get("type") || hash.get("type") || "").toLowerCase();
        const accessToken = hash.get("access_token");
        const refreshToken = hash.get("refresh_token");

        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
        } else if (accessToken && refreshToken) {
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (error) throw error;
        } else if (tokenHash) {
          const { error } = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type: (type as any) || "recovery",
          });
          if (error) throw error;
        } else {
          // Talvez já exista sessão de recovery (fluxo antigo)
          const { data } = await supabase.auth.getSession();
          if (!data.session) throw new Error("Link inválido ou expirado. Solicite um novo e-mail de redefinição.");
        }

        // Limpa parâmetros sensíveis somente depois de validar/criar sessão de recovery.
        window.history.replaceState({}, document.title, "/redefinir-senha");

        if (!cancelled) {
          setReady(true);
          setVerifying(false);
        }
      } catch (err: any) {
        if (!cancelled) {
          setErrorMsg(err?.message || "Não foi possível validar o link.");
          setVerifying(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      toast.error("A senha deve ter ao menos 8 caracteres.");
      return;
    }
    if (password !== confirm) {
      toast.error("As senhas não conferem.");
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast.success("Senha redefinida com sucesso. Faça login novamente.");
      await supabase.auth.signOut();
      navigate("/login", { replace: true });
    } catch (err: any) {
      toast.error(err?.message || "Erro ao atualizar a senha.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center mb-3">
            <QALogo className="h-20 w-auto rounded-2xl" alt="Quero Armas" />
          </div>
          <p className="text-[11px] text-slate-400 tracking-wider uppercase">
            Redefinição de Senha
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
          <div className="mb-4">
            <h1 className="text-base font-semibold text-slate-800">
              Redefinir senha
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Informe uma nova senha para concluir a recuperação do acesso.
            </p>
          </div>

          {verifying && (
            <div className="flex flex-col items-center gap-3 py-6 text-slate-500 text-sm">
              <Loader2 className="h-5 w-5 animate-spin" />
              Validando link…
            </div>
          )}

          {!verifying && errorMsg && (
            <div className="space-y-4">
              <p className="text-sm text-red-600">{errorMsg}</p>
              <Button
                type="button"
                onClick={() => navigate("/login", { replace: true })}
                className="w-full bg-[#2563EB] hover:bg-[#1D4ED8] text-white h-10 text-sm"
              >
                Voltar para o login
              </Button>
            </div>
          )}

          {!verifying && ready && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label
                  htmlFor="password"
                  className="text-slate-500 text-[11px] uppercase tracking-wider"
                >
                  Nova senha
                </Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    required
                    minLength={8}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="bg-white border-slate-200 text-slate-700 focus:border-blue-500 focus:ring-blue-500/20 h-10 text-sm pr-10"
                    placeholder="Mínimo 8 caracteres"
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((s) => !s)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600"
                    tabIndex={-1}
                    aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label
                  htmlFor="confirm"
                  className="text-slate-500 text-[11px] uppercase tracking-wider"
                >
                  Confirmar senha
                </Label>
                <div className="relative">
                  <Input
                    id="confirm"
                    type={showConfirm ? "text" : "password"}
                    required
                    minLength={8}
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    className="bg-white border-slate-200 text-slate-700 focus:border-blue-500 focus:ring-blue-500/20 h-10 text-sm pr-10"
                    placeholder="Repita a nova senha"
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm((s) => !s)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600"
                    tabIndex={-1}
                    aria-label={showConfirm ? "Ocultar senha" : "Mostrar senha"}
                  >
                    {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <Button
                type="submit"
                disabled={saving}
                className="w-full bg-[#2563EB] hover:bg-[#1D4ED8] text-white h-10 text-sm font-medium"
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Salvar nova senha"
                )}
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
