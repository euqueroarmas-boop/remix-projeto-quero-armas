import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Lock, Loader2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import SeoHead from "@/components/SeoHead";

export default function RedefinirSenhaPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [isRecovery, setIsRecovery] = useState(false);

  useEffect(() => {
    // Check if this is a recovery flow
    const hash = window.location.hash;
    if (hash.includes("type=recovery")) {
      setIsRecovery(true);
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setIsRecovery(true);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) { setError("A senha deve ter pelo menos 6 caracteres."); return; }
    if (password !== confirm) { setError("As senhas não coincidem."); return; }

    setLoading(true);
    setError("");

    const { error: err } = await supabase.auth.updateUser({ password });

    setLoading(false);

    if (err) {
      setError("Erro ao atualizar a senha. Tente novamente.");
      return;
    }

    setSuccess(true);
    setTimeout(() => navigate("/area-do-cliente"), 3000);
  };

  return (
    <>
      <SeoHead title="Redefinir Senha | WMTi" description="Defina sua nova senha de acesso." />
      <Navbar />
      <section className="min-h-screen flex items-center justify-center py-24 px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md mx-auto text-center"
        >
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 mb-6">
            <Lock size={32} className="text-primary" />
          </div>

          <h1 className="text-2xl font-heading font-bold text-foreground mb-2">
            {success ? "Senha Atualizada!" : "Definir Nova Senha"}
          </h1>

          {success ? (
            <div className="space-y-4">
              <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-4 flex items-center gap-2 text-emerald-400">
                <Check size={18} /> Sua senha foi atualizada com sucesso.
              </div>
              <p className="text-sm text-muted-foreground">Redirecionando para a Área do Cliente...</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4 text-left mt-6">
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">Nova Senha</label>
                <Input
                  type="password"
                  placeholder="Mínimo 6 caracteres"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setError(""); }}
                  className="bg-card border-border text-foreground"
                />
              </div>
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">Confirmar Senha</label>
                <Input
                  type="password"
                  placeholder="Repita a senha"
                  value={confirm}
                  onChange={(e) => { setConfirm(e.target.value); setError(""); }}
                  className="bg-card border-border text-foreground"
                />
              </div>

              {error && <p className="text-sm text-destructive">{error}</p>}

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Salvar Nova Senha
              </Button>
            </form>
          )}
        </motion.div>
      </section>
      <Footer />
    </>
  );
}
