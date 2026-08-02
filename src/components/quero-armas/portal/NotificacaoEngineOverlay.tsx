import { useEffect, useState } from "react";
import { AlertTriangle, Info, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

type NotificacaoAtiva = {
  id: string;
  categoria: string;
  urgencia: "urgente" | "normal";
  titulo: string;
  mensagem: string;
  link: string | null;
  created_at: string;
  is_teste?: boolean;
};

// Consulta as pendências uma única vez a cada abertura do portal (sem
// polling agressivo). O reaparecimento de uma notificação urgente
// respeita 24h — o cliente vê no máximo 1x por dia até resolver.
const REAPARECER_MS = 24 * 60 * 60_000; // 24h

function hiddenUntilKey(id: string) {
  return `qa_notif_hidden_${id}`;
}
function seenNormalKey(id: string) {
  return `qa_notif_seen_normal_${id}`;
}

/**
 * Motor de notificações persistentes do cliente. Renderizado uma única vez,
 * fora dos blocos condicionais de seção do portal — por isso aparece em
 * qualquer "tela" (na verdade todas são o mesmo componente, só trocam
 * activeSection). Notificações urgentes (contrato pendente, exames e
 * documentos vencendo em até 30 dias) reaparecem a cada 10 minutos até a
 * pendência real ser resolvida — fechar no X só esconde temporariamente.
 * Notificações normais somem até o próximo login ao serem fechadas.
 */
export default function NotificacaoEngineOverlay({ clienteId, bloqueado = false }: { clienteId: number | null; bloqueado?: boolean }) {
  const [todas, setTodas] = useState<NotificacaoAtiva[]>([]);
  const [visiveis, setVisiveis] = useState<NotificacaoAtiva[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    if (!clienteId) return;
    let cancelado = false;
    (async () => {
      const { data, error } = await supabase.rpc("qa_cliente_notificacoes_ativas" as any, {
        p_cliente_id: clienteId,
      });
      if (!cancelado && !error && Array.isArray(data)) {
        setTodas(data as NotificacaoAtiva[]);
        // Notificações de teste aparecem 1x apenas: assim que a lista chega,
        // dispara o desligamento server-side (função marca ativa=false).
        const testes = (data as NotificacaoAtiva[]).filter((n) => n.is_teste);
        for (const n of testes) {
          supabase.rpc("qa_notificacao_marcar_vista" as any, { p_id: n.id }).then(() => {});
        }
      }
    })();
    return () => { cancelado = true; };
  }, [clienteId]);

  useEffect(() => {
    const agora = Date.now();
    const filtradas = todas.filter((n) => {
      if (n.urgencia === "urgente") {
        const escondidoAte = Number(localStorage.getItem(hiddenUntilKey(n.id)) || 0);
        return agora >= escondidoAte;
      }
      return !sessionStorage.getItem(seenNormalKey(n.id));
    });
    setVisiveis(filtradas);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [todas]);

  function fechar(n: NotificacaoAtiva) {
    if (n.urgencia === "urgente") {
      localStorage.setItem(hiddenUntilKey(n.id), String(Date.now() + REAPARECER_MS));
    } else {
      sessionStorage.setItem(seenNormalKey(n.id), "1");
    }
    setVisiveis((prev) => prev.filter((x) => x.id !== n.id));
  }

  function abrirDetalhes(n: NotificacaoAtiva, e: React.MouseEvent) {
    e.preventDefault();
    // Categoria de contrato/procuração pendente: abre o popup de assinaturas
    // do portal em vez de navegar (a rota /area-do-cliente/contratos não existe
    // e caía no fallback da home).
    const cat = String(n.categoria || "").toLowerCase();
    if (cat.includes("contrato") || cat.includes("assinatura") || cat.includes("procuracao")) {
      window.dispatchEvent(new CustomEvent("qa:abrir-assinaturas-pendentes"));
      return;
    }
    // Demais categorias: o portal é uma SPA de seções, então links internos
    // do tipo /area-do-cliente/<secao> devem trocar a seção em vez de navegar
    // (navegar caía no fallback da home e "nada acontecia").
    const link = String(n.link || "");
    const interna = link.match(/^\/area-do-cliente\/?([a-z_-]*)/i);
    if (interna) {
      const secao = (interna[1] || "").toLowerCase();
      const mapa: Record<string, string> = {
        "": "resumo",
        documentos: "documentos",
        processos: "processos",
        financeiro: "financeiro",
        contratos: "contratos",
        arsenal: "arsenal",
        pendencias: "pendencias",
        mensagens: "mensagens",
        configuracoes: "configuracoes",
      };
      window.dispatchEvent(
        new CustomEvent("qa:portal-ir-para-secao", { detail: { secao: mapa[secao] || "documentos" } }),
      );
      fechar(n);
      return;
    }
    if (link) navigate(link);
  }

  if (visiveis.length === 0 || bloqueado) return null;

  return (
    <div className="fixed top-3 left-1/2 -translate-x-1/2 z-[200] flex flex-col gap-2 w-[calc(100%-1.5rem)] max-w-[380px] sm:left-auto sm:right-4 sm:translate-x-0">
      {visiveis.map((n) => {
        const urgente = n.urgencia === "urgente";
        return (
          <div
            key={n.id}
            className="relative rounded-2xl border border-black/5 bg-white/80 backdrop-blur-xl shadow-[0_8px_30px_-8px_rgba(0,0,0,0.28)] px-3 py-2.5 pr-8 animate-in slide-in-from-top-2 fade-in"
          >
            <button
              onClick={() => fechar(n)}
              className="absolute top-1.5 right-1.5 h-6 w-6 rounded-full flex items-center justify-center text-black/35 hover:text-black/70 hover:bg-black/5"
              aria-label="Fechar notificação"
            >
              <X className="w-3.5 h-3.5" />
            </button>
            <div className="flex items-start gap-2.5">
              <span
                className={`shrink-0 mt-0.5 h-6 w-6 rounded-[9px] flex items-center justify-center ${
                  urgente ? "bg-[#7A1F2B]" : "bg-black/80"
                }`}
              >
                {urgente
                  ? <AlertTriangle className="w-3.5 h-3.5 text-white" />
                  : <Info className="w-3.5 h-3.5 text-white" />}
              </span>
              <div className="min-w-0">
                <p className="text-[13px] leading-tight font-semibold text-black tracking-[-0.01em]">
                  {n.titulo}
                </p>
                <p className="text-[12px] leading-snug mt-0.5 text-black/55 line-clamp-2">
                  {n.mensagem}
                </p>
                {n.link && (
                  <a
                    href={n.link}
                    onClick={(e) => abrirDetalhes(n, e)}
                    className={`text-[12px] font-semibold mt-1 inline-block ${urgente ? "text-[#7A1F2B]" : "text-black/80"}`}
                  >
                    Ver detalhes
                  </a>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
