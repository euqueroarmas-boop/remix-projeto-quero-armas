import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { QALogo } from "@/components/quero-armas/QALogo";

export default function QALoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleForgotPassword = async () => {
    if (!email) { toast.error("Informe seu e-mail primeiro."); return; }
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/redefinir-senha`,
      });
      if (error) throw error;
      toast.success("E-mail de redefinição enviado.");
    } catch (err: any) {
      toast.error(err.message || "Erro ao enviar e-mail.");
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Falha ao obter usuário");
      const { data: profile } = await supabase
        .from("qa_usuarios_perfis" as any)
        .select("*")
        .eq("user_id", user.id)
        .eq("ativo", true)
        .maybeSingle();
      if (!profile) {
        await supabase.auth.signOut();
        toast.error("Acesso negado. Perfil não encontrado.");
        return;
      }
      toast.success("Acesso autorizado");
      navigate("/quero-armas/dashboard", { replace: true });
    } catch (err: any) {
      toast.error(err.message || "Erro ao autenticar");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center mb-4">
            <QALogo className="h-24 w-auto rounded-2xl" alt="Quero Armas" />
          </div>
          <p className="text-[11px] text-slate-400 mt-1 tracking-wider uppercase">Acesso Restrito</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4 bg-white border border-slate-200 rounded-xl p-6">
          <div className="space-y-1.5">
            <Label htmlFor="email" className="text-slate-500 text-[11px] uppercase tracking-wider">E-mail</Label>
            <Input
              id="email" type="email" required value={email}
              onChange={e => setEmail(e.target.value)}
              className="bg-white border-slate-200 text-slate-700 focus:border-blue-500 focus:ring-blue-500/20 h-10 text-sm"
              placeholder="seu@email.com"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password" className="text-slate-500 text-[11px] uppercase tracking-wider">Senha</Label>
            <Input
              id="password" type="password" required value={password}
              onChange={e => setPassword(e.target.value)}
              className="bg-white border-slate-200 text-slate-700 focus:border-blue-500 focus:ring-blue-500/20 h-10 text-sm"
              placeholder="••••••••"
            />
          </div>
          <Button type="submit" disabled={loading} className="w-full bg-slate-800 hover:bg-slate-900 text-white border-0 h-10 text-sm font-medium transition-all active:scale-[0.98]">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Entrar"}
          </Button>
          <div className="text-center pt-1">
            <button type="button" onClick={handleForgotPassword}
              className="text-[10px] text-slate-400 hover:text-blue-600 transition-colors">
              Esqueci minha senha
            </button>
          </div>
        </form>

        <p className="text-center text-[10px] text-slate-300 mt-6 tracking-wider">
          Ambiente seguro · Acesso auditado
        </p>
      </div>
    </div>
  );
}
