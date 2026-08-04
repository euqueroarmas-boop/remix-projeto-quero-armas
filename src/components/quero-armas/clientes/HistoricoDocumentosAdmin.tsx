import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { XCircle, CheckCircle2, Clock3, ChevronDown, ChevronUp, FileText } from "lucide-react";

interface EventoDoc {
  id: string;
  tipo: string;
  status: string | null;
  titulo: string;
  mensagem: string;
  documento_nome: string | null;
  metadata: {
    motivo_rejeicao?: string | null;
    arquivo?: string | null;
    detalhes?: string | null;
    [key: string]: any;
  } | null;
  created_at: string;
}

const fmtDateTime = (d: string) => {
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return d;
  return dt.toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  });
};

const CONFIG_STATUS: Record<string, { cor: string; fundo: string; ponto: string; rotulo: string; Icone: typeof FileText }> = {
  rejeitado: { cor: "#7A1F2B", fundo: "#FDF4F5", ponto: "#C4333E", rotulo: "Rejeitado", Icone: XCircle },
  aprovado:  { cor: "#0F7A45", fundo: "#F1FAF4", ponto: "#16A34A", rotulo: "Aprovado",  Icone: CheckCircle2 },
  em_analise:{ cor: "#8A6A17", fundo: "#FDFAF1", ponto: "#B45309", rotulo: "Em análise",Icone: Clock3 },
};

function configDe(ev: EventoDoc) {
  return CONFIG_STATUS[ev.status || "em_analise"] ?? CONFIG_STATUS.em_analise;
}

interface Props {
  clienteId: number;
}

export function HistoricoDocumentosAdmin({ clienteId }: Props) {
  const [eventos, setEventos] = useState<EventoDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandidoId, setExpandidoId] = useState<string | null>(null);

  const carregar = async (vivo: { ok: boolean }) => {
    try {
      const { data, error } = await supabase
        .from("qa_admin_notificacoes" as any)
        .select("id, tipo, status, titulo, mensagem, documento_nome, metadata, created_at")
        .eq("cliente_id", clienteId)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      if (vivo.ok) setEventos((data as unknown as EventoDoc[]) ?? []);
    } catch (e) {
      console.error("[HistoricoDocumentosAdmin] erro:", e);
      if (vivo.ok) setEventos([]);
    } finally {
      if (vivo.ok) setLoading(false);
    }
  };

  useEffect(() => {
    const vivo = { ok: true };
    setLoading(true);
    carregar(vivo);

    // Realtime: novos eventos aparecem automaticamente sem reload
    const canal = supabase
      .channel(`historico-docs-${clienteId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "qa_admin_notificacoes",
          filter: `cliente_id=eq.${clienteId}`,
        },
        (payload) => {
          setEventos((prev) => [payload.new as EventoDoc, ...prev]);
        },
      )
      .subscribe();

    return () => {
      vivo.ok = false;
      supabase.removeChannel(canal);
    };
  }, [clienteId]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-6 text-[#8A8A8A] text-[11px]">
        <Clock3 className="h-3.5 w-3.5 animate-pulse" />
        Carregando eventos de documentos…
      </div>
    );
  }

  if (eventos.length === 0) {
    return (
      <div className="rounded-sm border border-dashed border-[#E4E4E4] bg-[#FAFAFA] px-6 py-8 text-center">
        <FileText className="h-4 w-4 mx-auto mb-2 text-[#C4C4C4]" />
        <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#6A6A6A]">
          Nenhum evento de documento registrado
        </div>
        <p className="mt-1 text-[11px] text-[#9A9A9A]">
          Aprovações e rejeições aparecem aqui assim que ocorrem.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 px-1">
        <FileText className="h-3.5 w-3.5 text-[#6A6A6A]" />
        <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#6A6A6A]">
          {eventos.length} {eventos.length === 1 ? "evento" : "eventos"} de documento
        </span>
      </div>

      <div className="relative pl-6">
        <div className="absolute left-2.5 top-1 bottom-1 w-px bg-[#E4E4E4]" />
        <div className="space-y-4">
          {eventos.map((ev) => {
            const { cor, fundo, ponto, rotulo, Icone } = configDe(ev);
            const expandido = expandidoId === ev.id;
            const temDetalhes = ev.metadata && (
              ev.metadata.motivo_rejeicao || ev.metadata.detalhes || ev.metadata.arquivo
            );

            return (
              <div key={ev.id} className="relative flex items-start gap-3">
                {/* Ponto na linha do tempo */}
                <span
                  className="absolute -left-[18px] top-1.5 z-10 h-2 w-2 rounded-full border border-white"
                  style={{ background: ponto }}
                />

                <div className="min-w-0 flex-1 pl-4">
                  {/* Badge + horário */}
                  <div className="flex items-center gap-2 mb-0.5">
                    <span
                      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[8.5px] font-bold uppercase tracking-[0.14em]"
                      style={{ background: fundo, color: cor }}
                    >
                      <Icone className="h-3 w-3" />
                      {rotulo}
                    </span>
                    <span className="text-[10px] text-[#8A8A8A]">{fmtDateTime(ev.created_at)}</span>
                  </div>

                  {/* Documento */}
                  {ev.documento_nome && (
                    <p className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[#0A0A0A]">
                      {ev.documento_nome}
                    </p>
                  )}

                  {/* Mensagem resumida */}
                  <p className="text-[11px] text-[#5A5A5A] leading-snug mt-0.5">
                    {ev.mensagem}
                  </p>

                  {/* Expandir detalhes técnicos */}
                  {temDetalhes && (
                    <button
                      type="button"
                      onClick={() => setExpandidoId(expandido ? null : ev.id)}
                      className="mt-1.5 inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-[#0A0A0A] hover:underline"
                    >
                      {expandido ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                      {expandido ? "Recolher detalhes" : "Ver detalhes técnicos"}
                    </button>
                  )}

                  {expandido && ev.metadata && (
                    <div className="mt-2 space-y-2 rounded-sm border border-[#E4E4E4] bg-[#FAFAFA] px-3 py-2.5">
                      {ev.metadata.motivo_rejeicao && (
                        <div>
                          <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-[#7A1F2B] mb-0.5">
                            Motivo da rejeição
                          </p>
                          <p className="text-[11px] leading-snug text-[#2A2A2A]">
                            {ev.metadata.motivo_rejeicao}
                          </p>
                        </div>
                      )}
                      {ev.metadata.detalhes && (
                        <div>
                          <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-[#6A6A6A] mb-0.5">
                            Detalhes técnicos
                          </p>
                          <pre className="text-[10px] leading-snug text-[#4A4A4A] whitespace-pre-wrap break-words font-mono bg-white rounded border border-[#EBEBEB] p-2">
                            {typeof ev.metadata.detalhes === "string"
                              ? ev.metadata.detalhes
                              : JSON.stringify(ev.metadata.detalhes, null, 2)}
                          </pre>
                        </div>
                      )}
                      {ev.metadata.arquivo && (
                        <div>
                          <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-[#6A6A6A] mb-0.5">
                            Arquivo enviado
                          </p>
                          <p className="text-[11px] font-mono text-[#5A5A5A] break-all">
                            {ev.metadata.arquivo}
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
