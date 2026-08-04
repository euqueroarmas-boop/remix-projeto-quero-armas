import { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { X, CheckCircle2, XCircle, Clock3, FileSignature, Stamp } from "lucide-react";

/**
 * Central de Notificação do administrador.
 *
 * Pop-ups discretos que chegam em tempo real (contrato assinado, procuração
 * assinada e qualquer mudança de status de documento do cliente: em análise,
 * aprovado ou rejeitado). Empilham um por cima do outro com deslocamento de
 * 2 mm, deixando visível que existem mais avisos além do de cima.
 */

export interface AdminNotificacao {
  id: string;
  tipo: string;
  status: string | null;
  titulo: string;
  mensagem: string;
  cliente_nome: string | null;
  documento_nome: string | null;
  link: string | null;
  created_at: string;
}

const MAX_PILHA = 4;

const ESTILO_STATUS: Record<string, { cor: string; fundo: string; Icone: typeof CheckCircle2; rotulo: string }> = {
  aprovado: { cor: "#0F7A45", fundo: "#F1FAF4", Icone: CheckCircle2, rotulo: "Aprovado" },
  rejeitado: { cor: "#7A1F2B", fundo: "#FDF4F5", Icone: XCircle, rotulo: "Rejeitado" },
  em_analise: { cor: "#8A6A17", fundo: "#FDFAF1", Icone: Clock3, rotulo: "Em análise" },
};

function estiloDe(n: AdminNotificacao) {
  if (n.tipo === "contrato") return { ...ESTILO_STATUS.em_analise, Icone: FileSignature, rotulo: "Contrato" };
  if (n.tipo === "procuracao") return { ...ESTILO_STATUS.em_analise, Icone: Stamp, rotulo: "Procuração" };
  return ESTILO_STATUS[n.status || "em_analise"] || ESTILO_STATUS.em_analise;
}

export default function AdminNotificacoesOverlay() {
  const [pilha, setPilha] = useState<AdminNotificacao[]>([]);
  const navigate = useNavigate();
  const timers = useRef<Record<string, number>>({});

  const remover = useCallback((id: string) => {
    setPilha((atual) => atual.filter((n) => n.id !== id));
    const t = timers.current[id];
    if (t) { window.clearTimeout(t); delete timers.current[id]; }
  }, []);

  const empilhar = useCallback((n: AdminNotificacao) => {
    setPilha((atual) => {
      if (atual.some((x) => x.id === n.id)) return atual;
      return [n, ...atual].slice(0, MAX_PILHA);
    });
    timers.current[n.id] = window.setTimeout(() => remover(n.id), TEMPO_VISIVEL);
  }, [remover]);

  useEffect(() => {
    const canal = supabase
      .channel("qa-admin-notificacoes")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "qa_admin_notificacoes" },
        (payload) => empilhar(payload.new as AdminNotificacao),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(canal);
      Object.values(timers.current).forEach((t) => window.clearTimeout(t));
      timers.current = {};
    };
  }, [empilhar]);

  const abrir = async (n: AdminNotificacao) => {
    remover(n.id);
    try {
      await supabase
        .from("qa_admin_notificacoes")
        .update({ lida: true, lida_em: new Date().toISOString() })
        .eq("id", n.id);
    } catch { /* silencioso */ }
    if (n.link) navigate(n.link);
  };

  if (pilha.length === 0) return null;

  return (
    <div className="fixed top-3 right-3 z-[95] pointer-events-none select-none" aria-live="polite">
      <div className="relative w-[290px] sm:w-[320px]" style={{ height: 84 + (pilha.length - 1) * 8 }}>
        {pilha.map((n, i) => {
          const { cor, fundo, Icone, rotulo } = estiloDe(n);
          const atras = i > 0;
          return (
            <button
              key={n.id}
              type="button"
              onClick={() => abrir(n)}
              className="pointer-events-auto absolute right-0 top-0 w-full text-left rounded-xl border bg-white/95 backdrop-blur-md transition-all duration-300"
              style={{
                // deslocamento de 2 mm por camada — mostra que há mais avisos
                transform: `translate(${-i * 2}mm, ${i * 2}mm) scale(${1 - i * 0.012})`,
                zIndex: MAX_PILHA - i,
                opacity: atras ? Math.max(0.5, 1 - i * 0.18) : 1,
                borderColor: "#E7E5E0",
                boxShadow: atras ? "0 2px 6px rgba(10,10,10,0.05)" : "0 6px 20px rgba(10,10,10,0.10)",
              }}
            >
              <span className="absolute left-0 top-3 bottom-3 w-[3px] rounded-full" style={{ background: cor }} />
              <div className="flex items-start gap-2.5 pl-3.5 pr-2.5 py-2.5">
                <span
                  className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-lg"
                  style={{ background: fundo, color: cor }}
                >
                  <Icone className="h-3.5 w-3.5" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span
                      className="text-[8.5px] font-bold uppercase tracking-[0.16em]"
                      style={{ color: cor }}
                    >
                      {rotulo}
                    </span>
                    <span className="text-[9px] text-[#9A9A9A] tracking-wide">
                      {new Date(n.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                  <p className="mt-0.5 text-[12px] font-semibold leading-tight text-[#0A0A0A] truncate">
                    {n.titulo}
                  </p>
                  <p className="mt-0.5 text-[11px] leading-snug text-[#5A5A5A] line-clamp-2">
                    {n.mensagem}
                  </p>
                </div>
                <span
                  role="button"
                  tabIndex={-1}
                  onClick={(e) => { e.stopPropagation(); remover(n.id); }}
                  className="shrink-0 rounded-md p-1 text-[#B0B0B0] hover:text-[#7A1F2B] hover:bg-[#FDF4F5] transition-colors"
                  aria-label="Dispensar notificação"
                >
                  <X className="h-3.5 w-3.5" />
                </span>
              </div>
            </button>
          );
        })}
      </div>
      {pilha.length > 1 && (
        <div className="mt-1.5 text-right text-[9px] uppercase tracking-[0.18em] text-[#9A9A9A]">
          +{pilha.length - 1} aviso{pilha.length - 1 > 1 ? "s" : ""} na pilha
        </div>
      )}
    </div>
  );
}
