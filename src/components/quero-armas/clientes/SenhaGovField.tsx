import { useEffect, useState } from "react";
import { Eye, EyeOff, Copy, Loader2, Lock, Pencil, Check, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getSenhaGov, setSenhaGov, subscribeSenhaGovUpdates } from "./senhaGovApi";

/**
 * Pós-incidente P0 (28/04/2026):
 *   - reconciliação concluída e duplicatas órfãs consolidadas;
 *   - Senha GOV agora opera em modo "revelação manual segura":
 *       • nunca carrega valor automaticamente;
 *       • revelação exige clique explícito;
 *       • toda chamada à edge function inclui `cliente_id` para
 *         bloquear leitura/gravação cruzada (resposta 409 + log
 *         `denied_mismatch` no servidor);
 *       • troca de cliente/CR limpa estado local imediatamente.
 */

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
  /** Opcional. Quando informado e `cadastroCrId` estiver vazio, o componente
   *  resolve automaticamente o `qa_cadastro_cr.id` a partir do cliente. */
  clienteId?: number | null;
  /** "row" = inline tipo Field (admin); "compact" = mini chip; "exposed" = valor visível direto, só copiar */
  variant?: "row" | "compact" | "exposed";
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
export function SenhaGovField({ cadastroCrId, clienteId, variant = "row", contexto, onCreateCadastro }: Props) {
  const [senha, setSenha] = useState<string | null>(null);
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [resolvedCrId, setResolvedCrId] = useState<number | null | undefined>(cadastroCrId ?? null);

  // Mantém em sincronia quando o pai atualiza o id após salvar.
  // Também limpa qualquer senha em memória ao trocar de CR/cliente
  // (anti cache cruzado entre cadastros).
  useEffect(() => {
    setSenha(null);
    setVisible(false);
    setEditing(false);
    setDraft("");
    if (cadastroCrId) setResolvedCrId(cadastroCrId);
    else setResolvedCrId(null);
  }, [cadastroCrId, clienteId]);

  // Fallback: resolve o cadastro_cr_id pelo cliente quando não foi recebido.
  useEffect(() => {
    let cancel = false;
    if (!cadastroCrId && clienteId) {
      (async () => {
        const { data } = await supabase
          .from("qa_cadastro_cr" as any)
          .select("id")
          .eq("cliente_id", clienteId)
          .is("consolidado_em", null)
          .order("id", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (!cancel) setResolvedCrId((data as any)?.id ?? null);
      })();
    }
    return () => { cancel = true; };
  }, [cadastroCrId, clienteId]);

  const effectiveCrId = cadastroCrId ?? resolvedCrId ?? null;
  // Modo "cliente sem CR": a Senha GOV pertence ao cliente e é lida/gravada
  // diretamente em qa_cliente_credenciais via edge function (Cenário 2).
  const allowNoCr = !!clienteId;

  // Quando outra parte do app (ex.: ClienteFormModal) grava a senha,
 // invalidamos o cache local para forçar recarga do valor atualizado.
  useEffect(() => {
    const unsub = subscribeSenhaGovUpdates((updatedId) => {
      if (effectiveCrId && updatedId === effectiveCrId) {
        setSenha(null);
        setVisible(false);
      }
    });
    return () => { unsub(); };
  }, [effectiveCrId]);

  // ⚠️  Política pós-P0: NUNCA carregar a senha automaticamente.
  // Mesmo no variant "exposed" o admin precisa clicar em "Revelar".

  // Sem cadastroCrId, sem clienteId e sem callback: nada a fazer (modo legado),
  // exceto no variant "exposed" que sempre exibe o slot (mostra "—").
  if (!effectiveCrId && !onCreateCadastro && !clienteId && variant !== "exposed") return null;

  const ensure = async () => {
    if (!effectiveCrId && !allowNoCr) return null;
    if (senha != null) return senha;
    // Sem clienteId não chamamos a edge function (a função recusaria com 400/409).
    if (!clienteId) {
      toast.error("clienteId obrigatório para acessar Senha GOV");
      return null;
    }
    setLoading(true);
    try {
      const s = await getSenhaGov(effectiveCrId ?? null, contexto, clienteId);
      setSenha(s || "");
      return s || "";
    } catch (e: any) {
      if (e?.name === "SenhaGovAuthError") return null;
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

  // Variante "exposed": carrega automaticamente e exibe em texto claro.
  // O admin já está autenticado — não há necessidade de "revelar".
  if (variant === "exposed") {
    return (
      <div className="flex flex-col gap-0.5 py-1">
        <span className="text-[11px] text-slate-400 uppercase tracking-wide font-medium">Senha Gov</span>
        <div className="flex items-center gap-2 pl-0.5">
          <span className="font-mono text-[13px] text-slate-800 font-semibold select-all">
            {loading ? "…" : (visible ? (senha || "—") : "••••••••")}
          </span>
          <button
            onClick={toggle}
            className="p-1 rounded hover:bg-slate-100 text-slate-500"
            title={visible ? "Ocultar" : "Revelar (validação cliente↔CR)"}
          >
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : visible ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          </button>
          {senha ? (
            <button
              onClick={copy}
              className="p-1 rounded hover:bg-slate-100 text-slate-500"
              title="Copiar"
            >
              <Copy className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </div>
      </div>
    );
  }

  const startEdit = async () => {
    if (!clienteId) {
      toast.error("clienteId obrigatório para editar Senha GOV");
      return;
    }
    if (effectiveCrId || allowNoCr) {
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
    if (!clienteId) {
      toast.error("clienteId obrigatório para salvar Senha GOV");
      return;
    }
    setSaving(true);
    try {
      let id: number | null | undefined = effectiveCrId ?? cadastroCrId;
      // Se não há CR e o consumidor expôs callback de criação (modo legado),
      // usa-o. Caso contrário, segue Cenário 2: grava direto na central.
      if (!id && onCreateCadastro && !allowNoCr) {
        id = (await onCreateCadastro()) || undefined as any;
      }
      // id pode ser null aqui (cliente sem CR) — a edge function aceita.
      await setSenhaGov(id ?? null, draft, contexto, clienteId);
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
    <div className="flex flex-col gap-0.5 py-1">
      <span className="text-[11px] text-slate-400 uppercase tracking-wide font-medium">
        SENHA GOV {effectiveCrId
          ? <span className="text-emerald-600 normal-case font-normal">— vinculada ao cliente (com CR)</span>
          : (allowNoCr
              ? <span className="text-amber-600 normal-case font-normal">— cliente sem CR ativo</span>
              : null)}
      </span>
      {editing ? (
        <div className="flex items-center gap-1.5 pl-0.5">
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Digite a senha gov.br"
            autoFocus
            disabled={saving}
            className="h-7 px-2 text-[13px] font-mono border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 w-56"
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
        <div className="flex items-center gap-2 pl-0.5">
          <span className="font-mono text-[13px] text-slate-800 font-semibold">
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