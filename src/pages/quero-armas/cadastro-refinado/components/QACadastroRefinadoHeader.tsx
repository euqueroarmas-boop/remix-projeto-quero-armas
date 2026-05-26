import { ArrowLeft, X, UserCheck, LogOut } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
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
  contextTag = "EM ANDAMENTO",
  step,
  total = 6,
  onClose,
}: Props) {
  const pct =
    typeof step === "number" && total > 0
      ? Math.min(100, Math.max(0, Math.round((step / total) * 100)))
      : 0;
  const [userLabel, setUserLabel] = useState<string | null>(null);
  const [hasSession, setHasSession] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    let active = true;

    const formatName = (full?: string | null): string | null => {
      if (!full) return null;
      const parts = full.trim().split(/\s+/).filter(Boolean);
      if (parts.length === 0) return null;
      if (parts.length === 1) return parts[0];
      return `${parts[0]} ${parts[parts.length - 1]}`;
    };

    const resolveLabel = async (userId: string, email: string | null, metaName?: string | null) => {
      const fromMeta = formatName(metaName);
      if (fromMeta) return fromMeta;
      try {
        const { data } = await supabase
          .from("qa_clientes" as any)
          .select("nome")
          .eq("user_id", userId)
          .maybeSingle();
        const nome = formatName((data as any)?.nome);
        if (nome) return nome;
      } catch {}
      return email;
    };

    const apply = async (session: any) => {
      const u = session?.user;
      if (!u) {
        console.log("[QAHeader] sem sessão ativa");
        if (active) {
          setUserLabel(null);
          setHasSession(false);
        }
        return;
      }
      if (active) setHasSession(true);
      const metaName =
        (u.user_metadata?.full_name as string | undefined) ??
        (u.user_metadata?.name as string | undefined) ??
        (u.user_metadata?.nome as string | undefined) ??
        null;
      const label = await resolveLabel(u.id, u.email ?? null, metaName);
      console.log("[QAHeader] sessão ativa", { id: u.id, email: u.email, metaName, label });
      if (active) setUserLabel(label);
    };

    supabase.auth.getSession().then(({ data }) => apply(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => apply(session));
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const handleLogout = async () => {
    const ok = window.confirm(
      "Deseja sair desta conta? O serviço selecionado será mantido, mas você precisará informar seus dados novamente ou entrar com outra conta."
    );
    if (!ok) return;
    setSigningOut(true);
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      setUserLabel(null);
      setHasSession(false);
      // Mantém pathname/search atuais — apenas recarrega o estado sem sessão.
      window.location.reload();
    } catch (e) {
      console.error("[QAHeader] erro ao sair", e);
      toast.error("Não foi possível sair da conta agora. Tente novamente.");
      setSigningOut(false);
    }
  };

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
              <span className="qa-ref-header-eyebrow-top">CHECKOUT GUIADO</span>
              <span className="qa-ref-header-eyebrow-main">{contextTag}</span>
            </div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {userLabel && (
            <span
              title={`Logado como ${userLabel}`}
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
                {userLabel}
              </span>
            </span>
          )}
          {hasSession && (
            <button
              type="button"
              onClick={handleLogout}
              disabled={signingOut}
              aria-label="Sair da conta"
              title="Sair da conta"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "6px 10px",
                borderRadius: 999,
                background: "rgba(122, 31, 43, 0.18)",
                border: "1px solid rgba(214, 166, 75, 0.45)",
                color: "#f4e7c8",
                fontSize: 10.5,
                fontWeight: 600,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                cursor: signingOut ? "wait" : "pointer",
                opacity: signingOut ? 0.6 : 1,
                whiteSpace: "nowrap",
              }}
            >
              <LogOut size={12} />
              <span className="qa-ref-logout-label">
                {signingOut ? "Saindo..." : "Sair da conta"}
              </span>
            </button>
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
