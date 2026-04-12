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
        toast.error("Acesso negado. Você não possui perfil ativo no módulo Quero Armas.");
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
    <div className="min-h-screen flex items-center justify-center bg-[#0c0c14] px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 mb-4">
            <Shield className="h-8 w-8 text-amber-500" />
          </div>
          <h1 className="text-2xl font-bold text-slate-100 tracking-tight">Quero Armas</h1>
          <p className="text-sm text-slate-500 mt-1">IA Jurídica | Acesso Restrito</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4 bg-[#12121c] border border-slate-800/60 rounded-xl p-6">
          <div className="space-y-2">
            <Label htmlFor="email" className="text-slate-300 text-sm">E-mail</Label>
            <Input
              id="email" type="email" required value={email}
              onChange={e => setEmail(e.target.value)}
              className="bg-[#0c0c14] border-slate-700 text-slate-100 focus:border-amber-500/50"
              placeholder="seu@email.com"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password" className="text-slate-300 text-sm">Senha</Label>
            <Input
              id="password" type="password" required value={password}
              onChange={e => setPassword(e.target.value)}
              className="bg-[#0c0c14] border-slate-700 text-slate-100 focus:border-amber-500/50"
              placeholder="••••••••"
            />
          </div>
          <Button type="submit" disabled={loading} className="w-full bg-amber-600 hover:bg-amber-700 text-white">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Entrar"}
          </Button>
        </form>

        <p className="text-center text-xs text-slate-600 mt-6">
          Ambiente seguro • Acesso auditado • Dados protegidos
        </p>
      </div>
    </div>
  );
}
