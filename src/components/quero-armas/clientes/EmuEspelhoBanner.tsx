import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Eye, Loader2, PenLine, X } from "lucide-react";
import {
  clearEmuSessao,
  formatarRestante,
  getEmuSessao,
  segundosRestantes,
  type EmuSessao,
} from "@/lib/quero-armas/emuSessao";

/**
 * Faixa fixa do MODO ESPELHO. Só aparece na aba em que a equipe abriu a área
 * de um cliente. Deixa explícito quem está operando, por quem, e quanto tempo
 * falta — e dá o botão de encerrar (que dispara o e-mail de resumo ao cliente).
 */
export default function EmuEspelhoBanner({ onEncerrar }: { onEncerrar?: () => void }) {
  const [sessao, setSessao] = useState<EmuSessao | null>(null);
  const [restante, setRestante] = useState(0);
  const [encerrando, setEncerrando] = useState(false);

  useEffect(() => {
    // `getEmuSessao` já adota o `?emu=` da URL quando preciso — quem chegar
    // primeiro (portal ou faixa) grava, o outro só lê.
    const s = getEmuSessao();
    setSessao(s);
    setRestante(segundosRestantes(s));
  }, []);

  // Contagem regressiva. Ao zerar, o banco já ignora a janela — então a aba
  // avisa e sai do espelho em vez de fingir que ainda está valendo.
  useEffect(() => {
    if (!sessao) return;
    const t = setInterval(() => {
      const s = segundosRestantes(sessao);
      setRestante(s);
      if (s <= 0) {
        clearEmuSessao();
        setSessao(null);
        toast.info("A janela de espelho expirou.");
        window.location.href = "/clientes";
      }
    }, 1000);
    return () => clearInterval(t);
  }, [sessao]);

  const encerrar = useCallback(async () => {
    if (!sessao) return;
    const resumo = window.prompt("Resumo do atendimento (vai por e-mail ao cliente):") ?? "";
    setEncerrando(true);
    try {
      const { data, error } = await supabase.functions.invoke("qa-emu-sessao", {
        body: { action: "encerrar", sessao_id: sessao.sessaoId, resumo: resumo.trim() },
      });
      if (error || !data?.ok) {
        toast.error((data as { error?: string } | null)?.error || error?.message || "Falha ao encerrar.");
        return;
      }
      clearEmuSessao();
      toast.success("Espelho encerrado. O cliente recebeu o resumo.");
      onEncerrar?.();
      window.location.href = "/clientes";
    } finally {
      setEncerrando(false);
    }
  }, [sessao, onEncerrar]);

  const registrarNota = useCallback(async () => {
    if (!sessao) return;
    const descricao = window.prompt("O que você fez? (fica visível para o cliente)") ?? "";
    if (descricao.trim().length < 3) return;
    const { data, error } = await supabase.functions.invoke("qa-emu-sessao", {
      body: { action: "registrar_acao", sessao_id: sessao.sessaoId, descricao: descricao.trim() },
    });
    if (error || !data?.ok) {
      toast.error("Não foi possível registrar a nota.");
      return;
    }
    toast.success("Registrado no histórico do cliente.");
  }, [sessao]);

  if (!sessao) return null;

  const acabando = restante <= 120;

  return (
    // `sticky`, não `fixed`: fixo saía do fluxo e cobria o topo da página do
    // cliente (o "bem-vindo" ficava atrás da faixa). Sticky ocupa a própria
    // altura, empurra o conteúdo e continua visível ao rolar.
    <div
      className="sticky top-0 z-[130] flex flex-wrap items-center justify-between gap-2 px-3 py-2"
      style={{ background: "#7A1F2B", color: "#fff" }}
    >
      <span className="flex min-w-0 items-center gap-2 text-[10px] font-black uppercase leading-tight tracking-[0.16em] sm:text-[11px]">
        <Eye className="h-3.5 w-3.5 shrink-0" />
        <span className="truncate">
          Modo espelho · vendo como {sessao.clienteNome} · operador {sessao.operadorNome}
        </span>
      </span>
      <span className="flex shrink-0 items-center gap-2">
        <span
          className="rounded-md px-2 py-1 text-[10px] font-black tabular-nums tracking-[0.12em]"
          style={{ background: acabando ? "#fff" : "rgba(255,255,255,0.15)", color: acabando ? "#7A1F2B" : "#fff" }}
        >
          {formatarRestante(restante)}
        </span>
        <button
          onClick={registrarNota}
          className="inline-flex items-center gap-1 rounded-md bg-white/15 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] hover:bg-white/25"
        >
          <PenLine className="h-3 w-3" /> Nota
        </button>
        <button
          onClick={encerrar}
          disabled={encerrando}
          className="inline-flex items-center gap-1 rounded-md bg-white/15 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] hover:bg-white/25 disabled:opacity-60"
        >
          {encerrando ? <Loader2 className="h-3 w-3 animate-spin" /> : <X className="h-3 w-3" />}
          {encerrando ? "Encerrando" : "Encerrar"}
        </button>
      </span>
    </div>
  );
}
