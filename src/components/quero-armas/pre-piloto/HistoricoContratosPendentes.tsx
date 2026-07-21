import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import {
  Upload, RefreshCw, Play, Loader2, FileText, CheckCircle2, Clock,
  ChevronDown, ChevronUp, ExternalLink, Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

type ContratoItem = {
  contrato_id: string;
  contrato_status: string;
  venda_id: number;
  venda_id_legado: number | null;
  cliente_id: number;
  cliente_nome: string;
  cliente_email: string | null;
  servico_nome: string | null;
  gerado_em: string;
  link_assinatura: string | null;
};

function fmt(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  });
}

function statusLabel(s: string) {
  const map: Record<string, { label: string; color: string }> = {
    generated_pending_company_signature: { label: "Aguardando assinatura", color: "text-amber-700 bg-amber-50 border-amber-200" },
    pending_customer_signature: { label: "Aguardando assinatura", color: "text-amber-700 bg-amber-50 border-amber-200" },
    pending_company_signature: { label: "Aguardando contra-assinatura", color: "text-amber-700 bg-amber-50 border-amber-200" },
    signed_pending_validation: { label: "Assinado — validando", color: "text-blue-700 bg-blue-50 border-blue-200" },
    validated: { label: "Validado", color: "text-green-700 bg-green-50 border-green-200" },
    signed: { label: "Assinado", color: "text-green-700 bg-green-50 border-green-200" },
    cancelled: { label: "Cancelado", color: "text-red-700 bg-red-50 border-red-200" },
  };
  return map[s] ?? { label: s, color: "text-muted-foreground bg-muted border-muted" };
}

export type HistoricoContratosPendentesHandle = { carregar: () => void };

const HistoricoContratosPendentes = forwardRef<HistoricoContratosPendentesHandle>(function HistoricoContratosPendentes(_, ref) {
  const navigate = useNavigate();
  const [contratos, setContratos] = useState<ContratoItem[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [expandido, setExpandido] = useState<string | null>(null);
  const [uploadArquivo, setUploadArquivo] = useState<File | null>(null);
  const [obs, setObs] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [excluindo, setExcluindo] = useState<string | null>(null);
  const inputFileRef = useRef<HTMLInputElement>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      // Busca todos os contratos pendentes de assinatura (independente de auditoria pré-piloto),
      // para que contratos gerados em fluxos parciais/interrompidos também apareçam.
      const { data: auditorias } = await supabase
        .from("qa_logs_auditoria" as any)
        .select("entidade_id, detalhes_json, created_at")
        .eq("acao", "pre_piloto_contrato_gerado")
        .order("created_at", { ascending: false })
        .limit(100);

      const { data: contratoRows } = await supabase
        .from("qa_contracts" as any)
        .select("id, status, venda_id, cliente_id, created_at")
        .in("status", [
          "generated_pending_company_signature",
          "pending_customer_signature",
          "customer_signature_uploaded",
          "validating",
        ])
        .order("created_at", { ascending: false })
        .limit(50);

      if (!contratoRows?.length) { setContratos([]); setCarregando(false); return; }

      const clienteIds = [...new Set((contratoRows as any[]).map((c) => c.cliente_id))];
      const { data: clientes } = await supabase
        .from("qa_clientes" as any)
        .select("id, nome_completo, email")
        .in("id", clienteIds);

      const clienteMap = Object.fromEntries(((clientes ?? []) as any[]).map((c) => [c.id, c]));

      const items: ContratoItem[] = (contratoRows as any[]).map((c) => {
        const auditoria = (auditorias as any[]).find(
          (a) => Number(a?.detalhes_json?.venda_id ?? a?.entidade_id) === Number(c.venda_id),
        );
        const det = auditoria?.detalhes_json ?? {};
        const cli = clienteMap[c.cliente_id] ?? {};
        return {
          contrato_id: c.id,
          contrato_status: c.status,
          venda_id: c.venda_id,
          venda_id_legado: det.venda_id_legado ?? null,
          cliente_id: c.cliente_id,
          cliente_nome: cli.nome_completo ?? det.cliente_nome ?? "—",
          cliente_email: cli.email ?? null,
          servico_nome: det.servico_nome ?? null,
          gerado_em: c.created_at,
          link_assinatura: `https://www.euqueroarmas.com.br/area-do-cliente/contratos/${c.id}`,
        };
      });

      setContratos(items);
    } catch (e: any) {
      toast.error("Erro ao carregar histórico: " + (e?.message || ""));
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  useImperativeHandle(ref, () => ({ carregar }), [carregar]);

  async function uploadAssinado(contratoId: string, vendaId: number) {
    if (!uploadArquivo) { toast.error("Selecione o arquivo PDF assinado"); return; }
    setEnviando(true);
    try {
      const fd = new FormData();
      fd.append("contract_id", contratoId);
      fd.append("file", uploadArquivo);
      fd.append("observacao", obs.trim() || "Contrato assinado via GOV.BR — enviado por WhatsApp");
      fd.append("origem", "pre_piloto_historico_whatsapp");
      fd.append("notificacao_policy", JSON.stringify({
        notificar_cliente: true,
        canais: { email: true, whatsapp: false, push: false },
        motivo_nao_notificar: "",
      }));
      const { data, error } = await supabase.functions.invoke("qa-piloto-upload-contrato-staff", { body: fd });
      if (error || !(data as any)?.ok) throw new Error((data as any)?.error || error?.message || "Falha no upload");
      toast.success("Contrato assinado enviado com sucesso!");
      setUploadArquivo(null);
      setObs("");
      setExpandido(null);
      await carregar();
    } catch (e: any) {
      toast.error(e?.message || "Erro ao enviar contrato");
    } finally {
      setEnviando(false);
    }
  }

  async function excluirPermanente(contratoId: string, clienteNome: string) {
    const confirm1 = window.confirm(
      `Excluir permanentemente o contrato de ${clienteNome}?\n\nEsta ação é IRREVERSÍVEL — remove o contrato, assinaturas, itens, aceites e eventos vinculados.`,
    );
    if (!confirm1) return;
    const confirm2 = window.prompt('Digite EXCLUIR para confirmar:');
    if ((confirm2 || "").trim().toUpperCase() !== "EXCLUIR") {
      toast.info("Exclusão cancelada");
      return;
    }
    setExcluindo(contratoId);
    try {
      const { data, error } = await supabase.functions.invoke("qa-contrato-excluir-permanente", {
        body: { contrato_id: contratoId },
      });
      if (error || !(data as any)?.ok) {
        throw new Error((data as any)?.error || error?.message || "Falha ao excluir");
      }
      toast.success("Contrato excluído permanentemente");
      setContratos((prev) => prev.filter((x) => x.contrato_id !== contratoId));
    } catch (e: any) {
      toast.error(e?.message || "Erro ao excluir contrato");
    } finally {
      setExcluindo(null);
    }
  }

  if (carregando) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground py-6 justify-center">
        <Loader2 className="w-4 h-4 animate-spin" /> Carregando histórico...
      </div>
    );
  }

  if (contratos.length === 0) {
    return (
      <div className="text-center py-8 text-xs text-muted-foreground italic">
        Nenhum contrato gerado via Pré-Piloto ainda.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs text-muted-foreground">{contratos.length} contrato(s) encontrado(s)</p>
        <Button variant="ghost" size="sm" onClick={carregar} className="text-xs gap-1 h-7">
          <RefreshCw className="w-3 h-3" /> Atualizar
        </Button>
      </div>

      {contratos.map((c) => {
        const st = statusLabel(c.contrato_status);
        const aberto = expandido === c.contrato_id;
        const pendente = c.contrato_status === "generated_pending_company_signature";

        return (
          <div key={c.contrato_id} className="border rounded-lg overflow-hidden">
            {/* Cabeçalho da linha */}
            <button
              onClick={() => setExpandido(aberto ? null : c.contrato_id)}
              className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-muted/30 transition-colors text-left gap-2"
            >
              <div className="flex items-center gap-2 min-w-0">
                <FileText className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs font-medium truncate">{c.cliente_nome}</p>
                  <p className="text-[11px] text-muted-foreground truncate">
                    {c.servico_nome} · {fmt(c.gerado_em)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${st.color}`}>
                  {st.label}
                </span>
                {aberto ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
              </div>
            </button>

            {/* Painel expandido */}
            {aberto && (
              <div className="border-t bg-muted/20 px-3 py-3 space-y-3">
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                  <p><span className="text-muted-foreground">Cliente:</span> {c.cliente_nome}</p>
                  <p><span className="text-muted-foreground">E-mail:</span> {c.cliente_email || "—"}</p>
                  <p><span className="text-muted-foreground">Venda:</span> #{c.venda_id_legado ?? c.venda_id}</p>
                  <p><span className="text-muted-foreground">Contrato:</span> {c.contrato_id.slice(0, 8)}…</p>
                </div>

                {/* Link do contrato */}
                {c.link_assinatura && (
                  <div className="flex items-center gap-2">
                    <Input value={c.link_assinatura} readOnly className="text-[11px] h-7 bg-white flex-1" />
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2"
                      onClick={() => window.open(c.link_assinatura!, "_blank")}
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                )}

                {/* Upload contrato assinado */}
                {pendente && (
                  <div className="space-y-2 pt-1 border-t">
                    <p className="text-[11px] font-medium text-foreground">Upload do contrato assinado</p>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs h-7 gap-1"
                        onClick={() => inputFileRef.current?.click()}
                      >
                        <Upload className="w-3 h-3" />
                        {uploadArquivo ? uploadArquivo.name.slice(0, 25) + (uploadArquivo.name.length > 25 ? "…" : "") : "Selecionar PDF"}
                      </Button>
                      <input
                        ref={inputFileRef}
                        type="file"
                        accept=".pdf"
                        className="hidden"
                        onChange={(e) => setUploadArquivo(e.target.files?.[0] ?? null)}
                      />
                    </div>
                    <Input
                      value={obs}
                      onChange={(e) => setObs(e.target.value)}
                      placeholder="Observação (opcional)"
                      className="text-xs h-7"
                    />
                    <Button
                      size="sm"
                      onClick={() => uploadAssinado(c.contrato_id, c.venda_id)}
                      disabled={!uploadArquivo || enviando}
                      className="bg-[#7B1C2E] hover:bg-[#6a1827] text-white text-xs gap-1 h-7"
                    >
                      {enviando ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
                      {enviando ? "Enviando..." : "Confirmar assinatura"}
                    </Button>
                  </div>
                )}

                {/* Ir para Piloto Real */}
                <div className="flex justify-between items-center pt-1 border-t gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-xs gap-1 h-7 text-red-700 hover:text-red-800 hover:bg-red-50"
                    disabled={excluindo === c.contrato_id}
                    onClick={() => excluirPermanente(c.contrato_id, c.cliente_nome)}
                  >
                    {excluindo === c.contrato_id
                      ? <Loader2 className="w-3 h-3 animate-spin" />
                      : <Trash2 className="w-3 h-3" />}
                    Excluir permanentemente
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-xs gap-1 h-7"
                    onClick={() => navigate("/admin/piloto-real", {
                      state: { clienteId: c.cliente_id, clienteNome: c.cliente_nome, vendaId: c.venda_id },
                    })}
                  >
                    <Play className="w-3 h-3" /> Abrir no Piloto Real
                  </Button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
});

export default HistoricoContratosPendentes;
