import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

/**
 * Recebe o retorno do OAuth (Google) e roteia o usuário conforme o perfil:
 *  - admin/equipe → /dashboard (precisa de qa_usuarios_perfis ativo)
 *  - cliente      → /area-do-cliente (precisa de cliente_auth_links ativo OU qa_clientes.user_id)
 *  - sem vínculo  → signOut + redirect para o login de origem com mensagem
 */
export default function QAAuthCallbackPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [msg, setMsg] = useState("Validando acesso...");

  useEffect(() => {
    let cancelled = false;
    const mode = (params.get("mode") || "cliente") as "admin" | "cliente";
    const next = params.get("next");

    const loginPath = mode === "admin" ? "/login" : "/area-do-cliente/login";

    const run = async () => {
      // Aguarda a sessão hidratar (lovable.auth chama setSession antes do redirect).
      let user = null as Awaited<ReturnType<typeof supabase.auth.getUser>>["data"]["user"];
      for (let i = 0; i < 10 && !cancelled; i++) {
        const { data } = await supabase.auth.getUser();
        user = data.user;
        if (user) break;
        await new Promise((r) => setTimeout(r, 250));
      }
      if (cancelled) return;
      if (!user) {
        toast.error("Sessão não estabelecida. Tente novamente.");
        navigate(loginPath, { replace: true });
        return;
      }

      const email = (user.email || "").toLowerCase();

      // Carrega perfil interno e vínculo de cliente em paralelo.
      const [{ data: qaProfile }, { data: clienteLink }] = await Promise.all([
        supabase
          .from("qa_usuarios_perfis" as any)
          .select("id, perfil, ativo")
          .eq("user_id", user.id)
          .eq("ativo", true)
          .maybeSingle(),
        supabase
          .from("cliente_auth_links" as any)
          .select("id, status, qa_cliente_id")
          .eq("user_id", user.id)
          .eq("status", "active")
          .limit(1)
          .maybeSingle(),
      ]);

      // Fallback: vínculo direto via qa_clientes.user_id
      let temCliente = !!clienteLink;
      if (!temCliente) {
        const { data: cd } = await supabase
          .from("qa_clientes" as any)
          .select("id, status")
          .eq("user_id", user.id)
          .maybeSingle();
        if (cd && (cd as any).status !== "excluido_lgpd") temCliente = true;
      }

      if (mode === "admin") {
        if (!qaProfile) {
          await supabase.auth.signOut();
          toast.error(`Acesso negado para ${email}. Conta sem perfil interno ativo.`);
          navigate("/login", { replace: true });
          return;
        }
        toast.success("Acesso autorizado");
        const dest = next && next.startsWith("/") ? next : "/dashboard";
        window.location.replace(dest);
        return;
      }

      // mode === "cliente"
      if (!qaProfile && !temCliente) {
        await supabase.auth.signOut();
        toast.error(`Conta ${email} não está vinculada a nenhum cliente ativo.`);
        navigate("/area-do-cliente/login", { replace: true });
        return;
      }
      toast.success("Bem-vindo!");
      const dest = next && next.startsWith("/") ? next : "/area-do-cliente";
      navigate(dest, { replace: true });
    };

    void run().catch((err) => {
      console.error("[QAAuthCallback]", err);
      setMsg("Erro ao validar acesso.");
      navigate(loginPath, { replace: true });
    });

    return () => {
      cancelled = true;
    };
  }, [navigate, params]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="flex flex-col items-center gap-3 text-slate-600">
        <Loader2 className="h-6 w-6 animate-spin text-[#7A1F2B]" />
        <span className="text-sm">{msg}</span>
      </div>
    </div>
  );
}