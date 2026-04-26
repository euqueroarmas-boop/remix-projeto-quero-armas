import { useState } from "react";
import { Eye, EyeOff, Copy, Loader2, Lock } from "lucide-react";
import { toast } from "sonner";
import { getSenhaGov } from "./senhaGovApi";

/**
 * Copia texto compatível com Safari iOS, que bloqueia navigator.clipboard
 * fora de gestos síncronos. Faz fallback via textarea + execCommand('copy').
 */
async function copyTextSafe(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fallback abaixo */
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.top = "0";
    ta.style.left = "0";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    ta.setSelectionRange(0, text.length);
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

interface Props {
  cadastroCrId: number | null | undefined;
  /** "row" = inline tipo Field (admin); "compact" = mini chip */
  variant?: "row" | "compact";
  contexto?: string;
}

/**
 * Exibe a Senha Gov sob demanda, decifrando via edge function `qa-senha-gov`.
 * Cada revelação registra auditoria em qa_senha_gov_acessos.
 */
export function SenhaGovField({ cadastroCrId, variant = "row", contexto }: Props) {
  const [senha, setSenha] = useState<string | null>(null);
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);

  if (!cadastroCrId) return null;

  const ensure = async () => {
    if (senha != null) return senha;
    setLoading(true);
    try {
      const s = await getSenhaGov(cadastroCrId, contexto);
      setSenha(s || "");
      return s || "";
    } catch (e: any) {
      toast.error("Senha Gov: " + (e.message || "erro"));
      return null;
    } finally {
      setLoading(false);
    }
  };

  const toggle = async () => {
    if (!visible) {
      const s = await ensure();
      if (s != null) setVisible(true);
    } else {
      setVisible(false);
    }
  };

  const copy = async () => {
    const s = await ensure();
    if (!s) {
      toast.info("Sem Senha Gov cadastrada");
      return;
    }
    // Safari iOS bloqueia clipboard.writeText após await (perde user gesture).
    // Tentamos Clipboard API, com fallback para textarea + execCommand.
    const ok = await copyTextSafe(s);
    if (ok) toast.success("Senha Gov copiada");
    else toast.error("Não foi possível copiar — toque e segure para copiar manualmente");
  };

  if (variant === "compact") {
    return (
      <div className="inline-flex items-center gap-1.5">
        <Lock className="h-3 w-3 text-slate-400" />
        <span className="font-mono text-[11px]">
          {visible ? (senha || "—") : "••••••••"}
        </span>
        <button onClick={toggle} className="text-slate-400 hover:text-slate-600">
          {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : visible ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
        </button>
        <button onClick={copy} className="text-slate-400 hover:text-slate-600">
          <Copy className="h-3 w-3" />
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between py-1.5 border-b border-slate-100 last:border-0">
      <span className="text-[10px] text-slate-500 uppercase tracking-wider">Senha Gov</span>
      <div className="flex items-center gap-2">
        <span className="font-mono text-xs text-slate-800">
          {visible ? (senha || "—") : "••••••••"}
        </span>
        <button
          onClick={toggle}
          className="p-1 rounded hover:bg-slate-100 text-slate-500"
          title={visible ? "Ocultar" : "Revelar"}
        >
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : visible ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
        </button>
        <button
          onClick={copy}
          className="p-1 rounded hover:bg-slate-100 text-slate-500"
          title="Copiar"
        >
          <Copy className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

export default SenhaGovField;