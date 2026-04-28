import { useState } from "react";
import { Eye, EyeOff, Copy, Loader2, Lock, Pencil, Check, X } from "lucide-react";
import { toast } from "sonner";
import { getSenhaGov, setSenhaGov } from "./senhaGovApi";

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
  /**
   * Quando não houver `cadastroCrId`, o campo continua visível.
   * Ao clicar em "Editar", chama este callback para criar o stub
   * `qa_cadastro_cr` e devolve o id recém-criado para salvar a senha.
   */
  onCreateCadastro?: () => Promise<number | null>;
}

/**
 * Exibe a Senha Gov sob demanda, decifrando via edge function `qa-senha-gov`.
 * Cada revelação registra auditoria em qa_senha_gov_acessos.
 */
export function SenhaGovField({ cadastroCrId, variant = "row", contexto, onCreateCadastro }: Props) {
  const [senha, setSenha] = useState<string | null>(null);
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);

  // Sem cadastroCrId E sem callback de criação: nada a fazer (modo legado).
  if (!cadastroCrId && !onCreateCadastro) return null;

  const ensure = async () => {
    if (!cadastroCrId) return null;
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

  const startEdit = async () => {
    if (cadastroCrId) {
      const current = await ensure();
      setDraft(current || "");
    } else {
      setDraft("");
    }
    setEditing(true);
  };

  const cancelEdit = () => {
    setEditing(false);
    setDraft("");
  };

  const save = async () => {
    setSaving(true);
    try {
      let id = cadastroCrId;
      if (!id && onCreateCadastro) {
        id = (await onCreateCadastro()) || undefined as any;
      }
      if (!id) {
        toast.error("Não foi possível preparar o cadastro CR");
        setSaving(false);
        return;
      }
      await setSenhaGov(id, draft, contexto);
      setSenha(draft);
      setEditing(false);
      setDraft("");
      toast.success(draft ? "Senha Gov salva" : "Senha Gov removida");
    } catch (e: any) {
      toast.error("Senha Gov: " + (e.message || "erro ao salvar"));
    } finally {
      setSaving(false);
    }
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
      {editing ? (
        <div className="flex items-center gap-1.5">
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Digite a senha gov.br"
            autoFocus
            disabled={saving}
            className="h-7 px-2 text-xs font-mono border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 w-48 uppercase"
            onKeyDown={(e) => {
              if (e.key === "Enter") save();
              if (e.key === "Escape") cancelEdit();
            }}
          />
          <button
            onClick={save}
            disabled={saving}
            className="p-1 rounded hover:bg-emerald-50 text-emerald-600 disabled:opacity-50"
            title="Salvar"
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
          </button>
          <button
            onClick={cancelEdit}
            disabled={saving}
            className="p-1 rounded hover:bg-slate-100 text-slate-500 disabled:opacity-50"
            title="Cancelar"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
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
          <button
            onClick={startEdit}
            className="p-1 rounded hover:bg-slate-100 text-slate-500"
            title="Editar"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}

export default SenhaGovField;