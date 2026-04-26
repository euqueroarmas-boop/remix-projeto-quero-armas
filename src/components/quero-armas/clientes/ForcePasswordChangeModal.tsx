import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ShieldCheck, KeyRound, Eye, EyeOff } from "lucide-react";

interface Props {
  open: boolean;
  onSuccess: () => void;
}

/**
 * Modal bloqueante exibido no primeiro acesso (quando o usuário possui
 * `password_change_required: true` no metadata). Força a substituição da
 * senha temporária por uma senha pessoal antes de liberar o portal.
 */
export function ForcePasswordChangeModal({ open, onSuccess }: Props) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      toast.error("A senha deve ter pelo menos 8 caracteres.");
      return;
    }
    if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) {
      toast.error("Use letras e números na nova senha.");
      return;
    }
    if (password !== confirm) {
      toast.error("A confirmação não confere com a nova senha.");
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password,
        data: {
          password_change_required: false,
          temp_password: null,
          password_changed_at: new Date().toISOString(),
        },
      });
      if (error) throw error;
      toast.success("Senha atualizada com sucesso!");
      onSuccess();
    } catch (err: any) {
      const raw = (err?.message || "").toLowerCase();
      if (
        raw.includes("weak") ||
        raw.includes("pwned") ||
        raw.includes("known") ||
        raw.includes("compromis")
      ) {
        toast.error(
          "Esta senha aparece em vazamentos públicos e é considerada fraca. Escolha uma senha única, com letras, números e símbolos.",
          { duration: 7000 }
        );
      } else if (raw.includes("should be at least") || raw.includes("password")) {
        toast.error(err.message);
      } else {
        toast.error(err?.message || "Não foi possível atualizar a senha.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden">
        <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-amber-50 to-white">
          <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
            <ShieldCheck className="h-5 w-5 text-amber-600" />
          </div>
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-900">
              Defina sua nova senha
            </h2>
            <p className="text-[11px] text-slate-500">
              Primeiro acesso — substitua a senha temporária
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <p className="text-xs text-slate-600 leading-relaxed">
            Por segurança, é necessário escolher uma senha pessoal antes de
            acessar o seu arsenal. Use no mínimo <strong>8 caracteres</strong>,
            combinando letras e números.
          </p>

          <div className="space-y-1.5">
            <Label htmlFor="new-password" className="text-[11px] uppercase tracking-wider text-slate-600">
              Nova senha
            </Label>
            <div className="relative">
              <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                id="new-password"
                type={show ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pl-9 pr-10"
                placeholder="Mínimo 8 caracteres"
                autoFocus
                required
              />
              <button
                type="button"
                onClick={() => setShow((s) => !s)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600"
                tabIndex={-1}
              >
                {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="confirm-password" className="text-[11px] uppercase tracking-wider text-slate-600">
              Confirmar nova senha
            </Label>
            <div className="relative">
              <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                id="confirm-password"
                type={show ? "text" : "password"}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="pl-9"
                placeholder="Repita a senha"
                required
              />
            </div>
          </div>

          <Button
            type="submit"
            disabled={loading}
            className="w-full bg-slate-900 hover:bg-slate-800 text-white uppercase tracking-wider text-xs font-bold"
          >
            {loading ? "Salvando..." : "Salvar nova senha"}
          </Button>

          <p className="text-[10px] text-slate-400 text-center">
            Esta etapa é obrigatória e não pode ser ignorada.
          </p>
        </form>
      </div>
    </div>
  );
}

export default ForcePasswordChangeModal;