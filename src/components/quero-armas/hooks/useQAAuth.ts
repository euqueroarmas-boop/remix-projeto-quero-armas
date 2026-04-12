import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";

export interface QAProfile {
  id: string;
  user_id: string;
  nome: string;
  email: string;
  perfil: "administrador" | "advogado" | "assistente_juridico" | "leitura_auditoria";
  ativo: boolean;
}

export function useQAAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<QAProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const u = session?.user ?? null;
      setUser(u);
      if (u) {
        const { data } = await supabase
          .from("qa_usuarios_perfis" as any)
          .select("*")
          .eq("user_id", u.id)
          .eq("ativo", true)
          .maybeSingle();
        setProfile(data as QAProfile | null);
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      const u = session?.user ?? null;
      setUser(u);
      if (u) {
        const { data } = await supabase
          .from("qa_usuarios_perfis" as any)
          .select("*")
          .eq("user_id", u.id)
          .eq("ativo", true)
          .maybeSingle();
        setProfile(data as QAProfile | null);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
  };

  return { user, profile, loading, signOut };
}
