import { createContext, useContext, type ReactNode } from "react";
import { useQAAuth, type QAProfile } from "./hooks/useQAAuth";
import type { User } from "@supabase/supabase-js";

interface QAAuthContextValue {
  user: User | null;
  profile: QAProfile | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const QAAuthContext = createContext<QAAuthContextValue | null>(null);

/**
 * Single auth provider — mounts ONE listener for the entire QA module tree.
 * Must wrap all QA routes inside QALayout.
 */
export function QAAuthProvider({ children }: { children: ReactNode }) {
  const auth = useQAAuth();
  return <QAAuthContext.Provider value={auth}>{children}</QAAuthContext.Provider>;
}

/**
 * Use this in any QA page/component instead of calling useQAAuth() directly.
 * This avoids duplicate onAuthStateChange listeners and getSession() calls.
 */
export function useQAAuthContext(): QAAuthContextValue {
  const ctx = useContext(QAAuthContext);
  if (!ctx) {
    throw new Error("useQAAuthContext must be used within QAAuthProvider (QALayout)");
  }
  return ctx;
}
