import { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { X, CheckCircle2, XCircle, Clock3, FileSignature, Stamp, ChevronDown, ChevronUp, ExternalLink } from "lucide-react";

/**
 * Central de Notificação do administrador.
 *
 * Pop-ups discretos que chegam em tempo real (contrato assinado, procuração
 * assinada e qualquer mudança de status de documento do cliente: em análise,
 * aprovado ou rejeitado). Empilham um por cima do outro com deslocamento de
 * 2 mm, deixando visível que existem mais avisos além do de cima.
 *
 * Rejeições podem ser expandidas para ver o motivo técnico completo.
 * Clicar em "Ver cadastro" navega para /clientes?cliente={id}&tab=historico.
 */

export interface AdminNotificacao {
  id: string;
  tipo: string;
  status: string | null;
  titulo: string;
  mensagem: string;
  cliente_id: number | null;
  cliente_nome: string | null;
  documento_nome: string | null;
  link: string | null;
  metadata: {
    motivo_rejeicao?: string | null;
    arquivo?: string | null;
    detalhes?: string | null;
    [key: string]: any;
  } | null;
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

function temDetalheTecnico(n: AdminNotificacao): boolean {
  if (!n.metadata) return false;
  return !!(n.metadata.motivo_rejeicao || n.metadata.detalhes || n.metadata.arquivo);
}

export default function AdminNotificacoesOverlay() {
  const [pilha, setPilha] = useState<AdminNotificacao[]>([]);
  const [expandidoId, setExpandidoId] = useState<string | null>(null);
  const navigate = useNavigate();
  const timers = useRef<Record<string, number>>({});

  const remover = useCallback((id: string) => {
    setPilha((atual) => atual.filter((n) => n.id !== id));
    setExpandidoId((cur) => cur === id ? null : cur);
    const t = timers.current[id];
    if (t) { window.clearTimeout(t); delete timers.current[id]; }
  }, []);

  const empilhar = useCallback((n: AdminNotificacao) => {
    setPilha((atual) => {
      if (atual.some((x) => x.id === n.id)) return atual;
      return [n, ...atual].slice(0, MAX_PILHA);
    });
  }, []);

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

  const marcarLida = async (id: string) => {
    try {
      await supabase
        .from("qa_admin_notificacoes")
        .update({ lida: true, lida_em: new Date().toISOString() })
        .eq("id", id);
    } catch { /* silencioso */ }
  };

  const irParaCadastro = async (n: AdminNotificacao) => {
    await marcarLida(n.id);
    remover(n.id);
    if (n.cliente_id) {
      navigate(`/clientes?cliente=${n.cliente_id}&tab=historico`);
    } else if (n.link) {
      // Compatibilidade com links antigos no formato /clientes/{id}
      const match = n.link.match(/\/clientes\/(\d+)/);
      if (match) navigate(`/clientes?cliente=${match[1]}&tab=historico`);
      else navigate(n.link);
    }
  };

  const toggleExpand = (id: string) => {
    setExpandidoId((cur) => cur === id ? null : id);
  };

  if (pilha.length === 0) return null;

  return (
    <div className="fixed top-3 right-3 z-[95] pointer-events-none select-none" aria-live="polite">
      <div
        className="relative w-[310px] sm:w-[340px]"
        style={{ height: pilha[0] && expandidoId === pilha[0].id ? "auto" : 84 + (pilha.length - 1) * 8 }}
      >
        {pilha.map((n, i) => {
          const { cor, fundo, Icone, rotulo } = estiloDe(n);
          const atras = i > 0;
          const expandido = expandidoId === n.id && !atras;
          const podeExpandir = !atras && temDetalheTecnico(n);

          return (
            <div
              key={n.id}
              className="pointer-events-auto absolute right-0 top-0 w-full text-left rounded-xl border bg-white/95 backdrop-blur-md transition-all duration-300"
              style={{
                transform: `translate(${-i * 2}mm, ${i * 2}mm) scale(${1 - i * 0.012})`,
                zIndex: MAX_PILHA - i,
                opacity: atras ? Math.max(0.5, 1 - i * 0.18) : 1,
                borderColor: "#E7E5E0",
                boxShadow: atras ? "0 2px 6px rgba(10,10,10,0.05)" : "0 6px 20px rgba(10,10,10,0.10)",
              }}
            >
              <span className="absolute left-0 top-3 bottom-3 w-[3px] rounded-full" style={{ background: cor }} />

              {/* Linha principal — clicável */}
              <button
                type="button"
                onClick={() => atras ? undefined : (podeExpandir ? toggleExpand(n.id) : irParaCadastro(n))}
                className="w-full text-left"
              >
                <div className="flex items-start gap-2.5 pl-3.5 pr-2.5 py-2.5">
                  <span
                    className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-lg"
                    style={{ background: fundo, color: cor }}
                  >
                    <Icone className="h-3.5 w-3.5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[8.5px] font-bold uppercase tracking-[0.16em]" style={{ color: cor }}>
                        {rotulo}
                      </span>
                      <span className="text-[9px] text-[#9A9A9A] tracking-wide">
                        {new Date(n.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                      </span>
                      {podeExpandir && !expandido && (
                        <ChevronDown className="h-3 w-3 text-[#9A9A9A] ml-auto" />
                      )}
                      {podeExpandir && expandido && (
                        <ChevronUp className="h-3 w-3 text-[#9A9A9A] ml-auto" />
                      )}
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
                    className="absolute -top-2 -left-2 z-10 h-6 w-6 rounded-full border border-[#E7E5E0] bg-white shadow-[0_2px_6px_rgba(10,10,10,0.12)] flex items-center justify-center text-[#7A1F2B] hover:bg-[#FDF4F5] transition-colors"
                    aria-label="Dispensar notificação"
                  >
                    <X className="h-3.5 w-3.5" />
                  </span>
                </div>
              </button>

              {/* Painel de detalhes técnicos — só para rejeições expandidas */}
              {expandido && n.metadata && (
                <div className="border-t border-[#F0EDE8] mx-3 mb-3 pt-2.5 space-y-2">
                  {n.metadata.motivo_rejeicao && (
                    <div>
                      <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-[#7A1F2B] mb-0.5">
                        Motivo da rejeição
                      </p>
                      <p className="text-[11px] leading-snug text-[#2A2A2A]">
                        {n.metadata.motivo_rejeicao}
                      </p>
                    </div>
                  )}
                  {n.metadata.detalhes && (
                    <div>
                      <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-[#6A6A6A] mb-0.5">
                        Detalhes técnicos
                      </p>
                      <p className="text-[11px] leading-snug text-[#5A5A5A] whitespace-pre-wrap break-words">
                        {typeof n.metadata.detalhes === "string"
                          ? n.metadata.detalhes
                          : JSON.stringify(n.metadata.detalhes, null, 2)}
                      </p>
                    </div>
                  )}
                  {n.metadata.arquivo && (
                    <div>
                      <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-[#6A6A6A] mb-0.5">
                        Arquivo enviado
                      </p>
                      <p className="text-[11px] text-[#5A5A5A] truncate font-mono">
                        {n.metadata.arquivo}
                      </p>
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => irParaCadastro(n)}
                    className="mt-1 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-[#7A1F2B] hover:underline"
                  >
                    <ExternalLink className="h-3 w-3" />
                    Ver cadastro do cliente
                  </button>
                </div>
              )}
            </div>
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
