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
    if (n.link) navigate(n.link);
  }

  if (visiveis.length === 0 || bloqueado) return null;

  return (
    <div className="fixed top-4 right-4 z-[200] flex flex-col gap-2 w-[calc(100%-2rem)] max-w-sm">
      {visiveis.map((n) => {
        const urgente = n.urgencia === "urgente";
        return (
          <div
            key={n.id}
            className={`relative rounded-xl border shadow-lg p-3.5 pr-8 animate-in slide-in-from-top-2 ${
              urgente ? "bg-red-50 border-red-200" : "bg-blue-50 border-blue-200"
            }`}
          >
            <button
              onClick={() => fechar(n)}
              className="absolute top-2 right-2 h-5 w-5 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-black/5"
              aria-label="Fechar notificação"
            >
              <X className="w-3.5 h-3.5" />
            </button>
            <div className="flex items-start gap-2">
              {urgente
                ? <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                : <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />}
              <div className="min-w-0">
                <p className={`text-xs font-semibold ${urgente ? "text-red-800" : "text-blue-800"}`}>
                  {n.titulo}
                </p>
                <p className={`text-[11px] mt-0.5 ${urgente ? "text-red-700" : "text-blue-700"}`}>
                  {n.mensagem}
                </p>
                {n.link && (
                  <a
                    href={n.link}
                    onClick={(e) => abrirDetalhes(n, e)}
                    className={`text-[11px] font-medium underline mt-1 inline-block ${urgente ? "text-red-800" : "text-blue-800"}`}
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
