import { ArrowLeft, X, UserCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { MiraDot } from "../mira-ui";

interface Props {
  onBack?: () => void;
  showBack?: boolean;
  contextTag?: string;
  /** Step atual (0..total) — usado para a progress bar fina no topo. */
  step?: number;
  total?: number;
  /** Callback do botão X (close). Se ausente, oculta. */
  onClose?: () => void;
}

export default function QACadastroRefinadoHeader({
  onBack,
  showBack = true,
  contextTag = "TUDO PRONTO",
  step,
  total = 6,
  onClose,
}: Props) {
  const pct =
    typeof step === "number" && total > 0
      ? Math.min(100, Math.max(0, Math.round((step / total) * 100)))
      : 0;
  const [userEmail, setUserEmail] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (active) setUserEmail(data.session?.user?.email ?? null);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setUserEmail(session?.user?.email ?? null);
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);
  return (
    <header className="qa-ref-header">
      <div className="qa-ref-header-inner">
        <div className="qa-ref-header-left">
          {showBack && (
            <button
              type="button"
              className="qa-ref-round-btn"
              onClick={onBack}
              aria-label="Voltar"
            >
              <ArrowLeft size={16} />
            </button>
          )}
          <div className="qa-ref-logo">
            <MiraDot size={22} />
            <div className="qa-ref-header-eyebrow">
              <span className="qa-ref-header-eyebrow-top">ANÁLISE CONCLUÍDA</span>
              <span className="qa-ref-header-eyebrow-main">{contextTag}</span>
            </div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {userEmail && (
            <span
              title={`Logado como ${userEmail}`}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "5px 10px",
                borderRadius: 999,
                background: "rgba(214, 166, 75, 0.12)",
                border: "1px solid rgba(214, 166, 75, 0.45)",
                color: "#d6a64b",
                fontSize: 10.5,
                fontWeight: 600,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                maxWidth: 180,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              <UserCheck size={12} />
              <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
                {userEmail}
              </span>
            </span>
          )}
          <button
            type="button"
            className="qa-ref-round-btn"
            onClick={onClose ?? onBack}
            aria-label="Fechar"
          >
            <X size={16} />
          </button>
        </div>
      </div>
      {typeof step === "number" && (
        <div className="qa-ref-progress-top" aria-hidden>
          <span style={{ width: `${pct}%` }} />
        </div>
      )}
    </header>
  );
}