import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, ChevronLeft, ShieldCheck, Eye, EyeOff } from "lucide-react";
import logoColor from "@/assets/logo-color.png";

function maskCpf(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 11);
  return d
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}

function maskPhone(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 10) {
    return d.replace(/(\d{2})(\d{4})(\d{0,4})/, "($1) $2-$3").trim();
  }
  return d.replace(/(\d{2})(\d{5})(\d{0,4})/, "($1) $2-$3").trim();
}

export default function QACriarContaPage() {
  const navigate = useNavigate();
  const [nome, setNome] = useState("");
  const [cpf, setCpf] = useState("");
  const [email, setEmail] = useState("");
  const [telefone, setTelefone] = useState("");
  const [senha, setSenha] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [accept, setAccept] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;

    const cpfNorm = cpf.replace(/\D/g, "");
    if (nome.trim().length < 2) return toast.error("Informe seu nome completo.");
    if (cpfNorm.length !== 11) return toast.error("CPF inválido.");
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return toast.error("E-mail inválido.");
    if (senha.length < 8) return toast.error("Senha deve ter no mínimo 8 caracteres.");
    if (!accept) return toast.error("Você precisa aceitar os termos.");

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke(
        "qa-cliente-criar-conta-publica",
        {
          body: {
            cpf: cpfNorm,
            nome: nome.trim(),
            email: email.trim().toLowerCase(),
            telefone: telefone.replace(/\D/g, "") || null,
            senha,
          },
        },
      );

      if (error) {
        // tenta extrair reason do contexto
        const ctx: any = (error as any).context;
        let payload: any = null;
        try {
          payload = ctx ? await ctx.json() : null;
        } catch {
          /* ignore */
        }
        const reason = payload?.reason;
        if (reason === "cpf_ja_possui_login" || reason === "email_ja_cadastrado") {
          toast.error(payload?.message || "Conta já existe. Faça login.");
          navigate("/area-do-cliente/login", {
            state: { prefillEmail: email.trim().toLowerCase() },
          });
          return;
        }
        throw new Error(payload?.message || error.message || "Falha ao criar conta.");
      }

      if (!data?.ok) {
        const reason = data?.reason;
        if (reason === "cpf_ja_possui_login" || reason === "email_ja_cadastrado") {
          toast.error(data?.message || "Conta já existe. Faça login.");
          navigate("/area-do-cliente/login", {
            state: { prefillEmail: email.trim().toLowerCase() },
          });
          return;
        }
        throw new Error(data?.message || "Falha ao criar conta.");
      }

      // Login automático para entrar direto no portal
      const { error: signErr } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password: senha,
      });
      if (signErr) {
        toast.success("Conta criada. Faça login para continuar.");
        navigate("/area-do-cliente/login", {
          state: { prefillEmail: email.trim().toLowerCase() },
        });
        return;
      }

      toast.success("Conta criada com sucesso!");
      navigate("/area-do-cliente", { replace: true });
    } catch (err: any) {
      toast.error(err?.message || "Não foi possível criar sua conta.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      <div className="px-4 py-3">
        <Link
          to="/area-do-cliente/login"
          className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-900"
        >
          <ChevronLeft className="h-4 w-4" /> Voltar para o login
        </Link>
      </div>

      <div className="flex-1 flex items-center justify-center px-4 py-6">
        <div className="w-full max-w-md">
          <div className="flex flex-col items-center mb-6">
            <img src={logoColor} alt="Quero Armas" className="h-12 mb-3" />
            <div className="inline-flex items-center gap-2 text-[11px] uppercase tracking-widest text-slate-500">
              <ShieldCheck className="h-3.5 w-3.5" />
              Conta gratuita do app de arsenal
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h1 className="text-xl font-semibold tracking-tight mb-1 text-slate-900">Criar minha conta</h1>
            <p className="text-sm text-slate-600 mb-5">
              Cadastre-se grátis para gerenciar suas armas, documentos e vencimentos.
              Sem compromisso, sem cobrança.
            </p>

            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="block text-[11px] uppercase tracking-wider text-slate-500 mb-1">
                  Nome completo
                </label>
                <input
                  className="w-full h-10 rounded-md bg-white border border-slate-200 px-3 text-sm text-slate-900 focus:outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  autoComplete="name"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] uppercase tracking-wider text-slate-500 mb-1">
                    CPF
                  </label>
                  <input
                    className="w-full h-10 rounded-md bg-white border border-slate-200 px-3 text-sm text-slate-900 focus:outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
                    value={cpf}
                    onChange={(e) => setCpf(maskCpf(e.target.value))}
                    inputMode="numeric"
                    placeholder="000.000.000-00"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[11px] uppercase tracking-wider text-slate-500 mb-1">
                    Telefone
                  </label>
                  <input
                    className="w-full h-10 rounded-md bg-white border border-slate-200 px-3 text-sm text-slate-900 focus:outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
                    value={telefone}
                    onChange={(e) => setTelefone(maskPhone(e.target.value))}
                    inputMode="tel"
                    placeholder="(11) 90000-0000"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] uppercase tracking-wider text-slate-500 mb-1">
                  E-mail
                </label>
                <input
                  type="email"
                  className="w-full h-10 rounded-md bg-white border border-slate-200 px-3 text-sm text-slate-900 focus:outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] uppercase tracking-wider text-slate-500 mb-1">
                  Senha
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    className="w-full h-10 rounded-md bg-white border border-slate-200 px-3 pr-10 text-sm text-slate-900 focus:outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
                    value={senha}
                    onChange={(e) => setSenha(e.target.value)}
                    autoComplete="new-password"
                    minLength={8}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((s) => !s)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                    aria-label="Mostrar/ocultar senha"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <p className="text-[11px] text-slate-400 mt-1">Mínimo 8 caracteres.</p>
              </div>

              <label className="flex items-start gap-2 text-xs text-slate-700 mt-2">
                <input
                  type="checkbox"
                  checked={accept}
                  onChange={(e) => setAccept(e.target.checked)}
                  className="mt-0.5"
                />
                <span>
                  Aceito os Termos de Uso e a Política de Privacidade da Quero Armas.
                  Esta conta é gratuita e não envolve compra de serviço.
                </span>
              </label>

              <button
                type="submit"
                disabled={loading}
                className="w-full h-11 mt-2 rounded-md bg-slate-900 text-white font-semibold text-sm hover:bg-slate-800 disabled:opacity-60 inline-flex items-center justify-center gap-2 shadow-sm"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {loading ? "Criando conta..." : "Criar minha conta gratuita"}
              </button>

              <p className="text-center text-xs text-slate-500 mt-2">
                Já tem conta?{" "}
                <Link to="/area-do-cliente/login" className="text-slate-900 font-semibold hover:underline">
                  Fazer login
                </Link>
              </p>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}