import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { KeyRound, Eye, EyeOff } from "lucide-react";

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
    if (password.length < 6) {
      toast.error("A senha deve ter pelo menos 6 caracteres.");
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
      if (raw.includes("should be at least") || raw.includes("at least 6")) {
        toast.error("A senha deve ter pelo menos 6 caracteres.");
      } else if (raw.includes("password")) {
        toast.error(err.message);
      } else {
        toast.error(err?.message || "Não foi possível atualizar a senha.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-3 sm:p-4 overflow-y-auto">
      <div className="relative w-full sm:max-w-md rounded-2xl bg-white shadow-2xl overflow-hidden flex flex-col max-h-[calc(100dvh-1.5rem)] sm:max-h-[90dvh]">
        <div className="px-6 pt-6 pb-4 shrink-0">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span className="inline-flex items-center rounded-full border border-[#8A1224]/20 bg-[#FFF7F8] px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.14em] text-[#8A1224]">
              Segurança
            </span>
            <span className="inline-flex items-center rounded-full border border-[#E4E4E4] bg-[#FAFAFA] px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.14em] text-[#6A6A6A]">
              Primeiro acesso
            </span>
          </div>
          <h2 className="text-2xl font-bold text-[#0A0A0A] leading-tight tracking-tight">
            Defina sua nova senha
          </h2>
          <p className="mt-2 rounded-md border border-[#E4E4E4] bg-[#FAFAFA] px-3 py-2 text-[13px] leading-relaxed text-[#3A3A3A]">
            Substitua a senha temporária por uma senha pessoal antes de acessar o portal.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 pb-6 space-y-4">
          <p className="text-xs text-slate-600 leading-relaxed">
            Por segurança, escolha uma senha pessoal antes de acessar o seu
            arsenal. Use no mínimo <strong>6 caracteres</strong>.
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
                placeholder="Mínimo 6 caracteres"
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
            className="w-full bg-[#7A1F2B] hover:bg-[#641722] text-white uppercase tracking-wider text-xs font-bold"
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