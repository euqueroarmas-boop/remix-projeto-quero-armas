import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, Shield } from "lucide-react";

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
    <div className="min-h-screen flex items-center justify-center bg-[#050505] px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded bg-[#161616] border border-[#1a1a1a] mb-4">
            <Shield className="h-5 w-5 text-slate-500" />
          </div>
          <h1 className="text-lg font-semibold text-slate-300 tracking-tight">Quero Armas</h1>
          <p className="text-[11px] text-slate-600 mt-1 tracking-wider uppercase">Acesso Restrito</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4 bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg p-5">
          <div className="space-y-1.5">
            <Label htmlFor="email" className="text-slate-500 text-[11px] uppercase tracking-wider">E-mail</Label>
            <Input
              id="email" type="email" required value={email}
              onChange={e => setEmail(e.target.value)}
              className="bg-[#050505] border-[#1a1a1a] text-slate-300 focus:border-slate-600 h-9 text-sm"
              placeholder="seu@email.com"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password" className="text-slate-500 text-[11px] uppercase tracking-wider">Senha</Label>
            <Input
              id="password" type="password" required value={password}
              onChange={e => setPassword(e.target.value)}
              className="bg-[#050505] border-[#1a1a1a] text-slate-300 focus:border-slate-600 h-9 text-sm"
              placeholder="••••••••"
            />
          </div>
          <Button type="submit" disabled={loading} className="w-full bg-[#161616] hover:bg-[#1f1f1f] text-slate-300 border border-[#1a1a1a] h-9 text-sm">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Entrar"}
          </Button>
          <div className="text-center pt-1">
            <button type="button" onClick={handleForgotPassword}
              className="text-[10px] text-slate-600 hover:text-slate-400 transition-colors">
              Esqueci minha senha
            </button>
          </div>
        </form>

        <p className="text-center text-[10px] text-slate-700 mt-6 tracking-wider">
          Ambiente seguro · Acesso auditado
        </p>
      </div>
    </div>
  );
}
