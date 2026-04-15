import { useState, useEffect, useRef } from "react";
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

/**
 * Resilient auth hook for QA modules.
 *
 * Fix: eliminates the race condition where onAuthStateChange could fire
 * INITIAL_SESSION before getSession hydrates from localStorage, causing
 * a false redirect to login and infinite loading on subsequent pages.
 *
 * Strategy:
 * 1. getSession() is the ONLY source that sets initial loading=false
 * 2. onAuthStateChange handles subsequent events (sign-in, sign-out, token refresh)
 *    but never flips loading from true→false on initial mount
 * 3. A 12s safety timeout guarantees loading ALWAYS resolves
 */
export function useQAAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<QAProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const initializedRef = useRef(false);
  const mountedRef = useRef(true);
  const loadingRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    loadingRef.current = true;

    // Safety timeout — uses ref to avoid stale closure
    const safetyTimer = setTimeout(() => {
      if (mountedRef.current && loadingRef.current) {
        console.warn("[useQAAuth] Safety timeout: forcing loading=false after 6s");
        loadingRef.current = false;
        setLoading(false);
      }
    }, 6000);

    const fetchProfile = async (userId: string): Promise<QAProfile | null> => {
      try {
        const { data } = await supabase
          .from("qa_usuarios_perfis" as any)
          .select("*")
          .eq("user_id", userId)
          .eq("ativo", true)
          .maybeSingle();
        return data as unknown as QAProfile | null;
      } catch (err) {
        console.error("[useQAAuth] fetchProfile error:", err);
        return null;
      }
    };

    // 1. Subscribe to auth changes FIRST (for subsequent events)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        // Skip if this is the initial event before getSession resolves
        if (!initializedRef.current) return;
        if (!mountedRef.current) return;

        const u = session?.user ?? null;
        setUser(u);

        if (u) {
          const p = await fetchProfile(u.id);
          if (mountedRef.current) setProfile(p);
        } else {
          setProfile(null);
        }
      }
    );

    // 2. getSession is the single source of truth for initial state
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!mountedRef.current) return;

      const u = session?.user ?? null;
      setUser(u);

      if (u) {
        const p = await fetchProfile(u.id);
        if (mountedRef.current) setProfile(p);
      }

      // Mark as initialized so onAuthStateChange can process future events
      initializedRef.current = true;

      if (mountedRef.current) {
        loadingRef.current = false;
        setLoading(false);
      }
    }).catch((err) => {
      console.error("[useQAAuth] getSession error:", err);
      if (mountedRef.current) {
        initializedRef.current = true;
        loadingRef.current = false;
        setLoading(false);
      }
    });

    return () => {
      mountedRef.current = false;
      clearTimeout(safetyTimer);
      subscription.unsubscribe();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
  };

  return { user, profile, loading, signOut };
}
