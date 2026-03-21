import { useState } from "react";
import { motion } from "framer-motion";
import { Building2, ArrowRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import type { CustomerData } from "@/pages/AreaDoClientePage";

function formatCnpj(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 14);
  if (d.length <= 2) return d;
  if (d.length <= 5) return d.replace(/(\d{2})(\d+)/, "$1.$2");
  if (d.length <= 8) return d.replace(/(\d{2})(\d{3})(\d+)/, "$1.$2.$3");
  if (d.length <= 12) return d.replace(/(\d{2})(\d{3})(\d{3})(\d+)/, "$1.$2.$3/$4");
  return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d+)/, "$1.$2.$3/$4-$5");
}

interface Props {
  onLogin: (c: CustomerData) => void;
}

export default function ClientLogin({ onLogin }: Props) {
  const [cnpj, setCnpj] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const digits = cnpj.replace(/\D/g, "");
    if (digits.length < 11) { setError("Informe um CNPJ ou CPF válido."); return; }

    setLoading(true);
    setError("");

    const { data, error: err } = await supabase
      .from("customers")
      .select("*")
      .eq("cnpj_ou_cpf", digits)
      .maybeSingle();

    setLoading(false);

    if (err) { setError("Erro ao consultar. Tente novamente."); return; }
    if (!data) { setError("Cadastro não encontrado. Verifique o CNPJ/CPF informado."); return; }

    onLogin(data as CustomerData);
  };

  return (
    <section className="relative flex flex-col items-center justify-center min-h-screen py-24 px-4 text-center">
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="w-[500px] h-[500px] rounded-full bg-primary/5 blur-[120px]" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="relative z-10 w-full max-w-md mx-auto"
      >
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 mb-6">
          <Building2 size={32} className="text-primary" />
        </div>

        <h1 className="text-3xl md:text-4xl font-heading font-bold text-foreground mb-2">
          Área do <span className="text-primary">Cliente</span>
        </h1>
        <p className="text-muted-foreground mb-8">
          Acesse com o CNPJ ou CPF cadastrado
        </p>

        <form onSubmit={handleSubmit} className="space-y-4 text-left">
          <div>
            <label className="text-sm text-muted-foreground mb-1 block">CNPJ / CPF</label>
            <Input
              placeholder="00.000.000/0000-00"
              value={cnpj}
              onChange={(e) => { setCnpj(formatCnpj(e.target.value)); setError(""); }}
              className="bg-card border-border text-foreground"
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ArrowRight className="h-4 w-4 mr-2" />}
            Acessar Portal
          </Button>
        </form>

        <p className="text-xs text-muted-foreground mt-6">
          Acesso exclusivo para clientes WMTi com cadastro ativo.
        </p>
      </motion.div>
    </section>
  );
}
