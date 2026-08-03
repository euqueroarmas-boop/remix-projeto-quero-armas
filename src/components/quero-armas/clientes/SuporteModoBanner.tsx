import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const KEY = "qa_suporte_sessao_id";

export function isSuporteAtivo() {
  try { return Boolean(sessionStorage.getItem(KEY)); } catch { return false; }
}

/**
 * Faixa "MODO SUPORTE": aparece quando a equipe entrou na conta do cliente.
 * O escopo é leitura + envio de documentos; ao encerrar, o cliente recebe o
 * resumo do atendimento por e-mail e a sessão é destruída.
 */
export default function SuporteModoBanner() {
  const [sessaoId, setSessaoId] = useState<string | null>(null);
  const [encerrando, setEncerrando] = useState(false);

  useEffect(() => {
    try {
      const url = new URL(window.location.href);
      const fromUrl = url.searchParams.get("suporte");
      if (fromUrl) {
        sessionStorage.setItem(KEY, fromUrl);
        url.searchParams.delete("suporte");
        window.history.replaceState({}, "", url.pathname + url.search + url.hash);
      }
      setSessaoId(sessionStorage.getItem(KEY));
    } catch { /* noop */ }
  }, []);

  if (!sessaoId) return null;

  async function encerrar() {
    setEncerrando(true);
    try {
      const resumo = window.prompt("Resumo do que foi feito (enviado ao cliente):") || "";
      await supabase.functions.invoke("qa-suporte-acesso", {
        body: { action: "encerrar", sessao_id: sessaoId, resumo },
      });
      try { sessionStorage.removeItem(KEY); } catch { /* noop */ }
      await supabase.auth.signOut();
      toast.success("Sessão de suporte encerrada.");
      window.location.href = "/area-do-cliente/login";
    } finally {
      setEncerrando(false);
    }
  }

  return (
    <div
      className="fixed top-0 left-0 right-0 z-[120] flex items-center justify-between gap-3 px-3 py-2"
      style={{ background: "#7A1F2B", color: "#fff" }}
    >
      <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-[0.18em] leading-tight">
        Modo suporte · acesso auditado · leitura e envio de documentos
      </span>
      <button
        onClick={encerrar}
        disabled={encerrando}
        className="shrink-0 rounded-md bg-white/15 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] hover:bg-white/25"
      >
        {encerrando ? "Encerrando…" : "Encerrar"}
      </button>
    </div>
  );
}