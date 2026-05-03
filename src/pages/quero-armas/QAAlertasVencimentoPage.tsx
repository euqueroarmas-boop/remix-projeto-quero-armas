import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Loader2, AlertTriangle, Mail, RefreshCw, Send } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

interface Preview {
  destinatario: string;
  remetente: string;
  assunto: string;
  fonte: "CR" | "CRAF" | "DOCUMENTO" | "AUTORIZACAO";
  item: string;
  data_vencimento: string;
  marco_dias: number;
  dias_restantes: number;
  mensagem: string;
  portal: string;
  cliente_nome?: string;
}

interface DryRunResp {
  success: boolean;
  dry_run: boolean;
  candidatos_total: number;
  previews_count: number;
  pulados_dedupe_ou_sem_email: number;
  enviados_reais: number;
  previews: Preview[];
  error?: string;
}

function brDate(iso: string) { return iso.split("-").reverse().join("/"); }

export default function QAAlertasVencimentoPage() {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<DryRunResp | null>(null);
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const [confirmStep, setConfirmStep] = useState<0 | 1 | 2>(0);
  const [confirmText, setConfirmText] = useState("");
  const [sending, setSending] = useState(false);
  const [lastSendResult, setLastSendResult] = useState<{
    enviados: number;
    pulados: number;
    erros: number;
  } | null>(null);

  const carregar = async () => {
    setLoading(true);
    setErrMsg(null);
    try {
      const { data: resp, error } = await supabase.functions.invoke("qa-vencimentos-alertas", {
        body: { dry_run: true },
      });
      if (error) {
        const msg = String(error?.message || error);
        if (msg.includes("401") || /unauthor/i.test(msg)) {
          setErrMsg("Sessão expirada ou sem permissão de equipe. Faça login novamente como Equipe Quero Armas.");
        } else {
          setErrMsg(`Falha ao carregar pré-visualização: ${msg}`);
        }
        toast.error("Não foi possível carregar a pré-visualização");
        return;
      }
      setData(resp as DryRunResp);
      toast.success(`Pré-visualização carregada (${(resp as DryRunResp).previews_count} alertas)`);
    } catch (e: any) {
      setErrMsg(String(e?.message || e));
      toast.error("Erro inesperado");
    } finally {
      setLoading(false);
    }
  };

  const enviarReal = async () => {
    setSending(true);
    try {
      const { data: resp, error } = await supabase.functions.invoke("qa-vencimentos-alertas", {
        body: { dry_run: false },
      });
      if (error) {
        toast.error(`Falha ao enviar: ${String(error?.message || error)}`);
        return;
      }
      const r = resp as DryRunResp & { erros_count?: number };
      const erros = (r as any).erros_count ?? 0;
      setLastSendResult({
        enviados: r.enviados_reais || 0,
        pulados: r.pulados_dedupe_ou_sem_email || 0,
        erros,
      });
      toast.success(`Envio concluído: ${r.enviados_reais} enviado(s)`);
      setConfirmStep(0);
      setConfirmText("");
      // Recarregar preview para refletir dedupe atualizado
      await carregar();
    } catch (e: any) {
      toast.error(`Erro inesperado: ${String(e?.message || e)}`);
    } finally {
      setSending(false);
    }
  };

  const previews = data?.previews || [];

  const totaisFonte = useMemo(() => {
    const m = new Map<string, number>();
    previews.forEach((p) => m.set(p.fonte, (m.get(p.fonte) || 0) + 1));
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [previews]);

  const totaisMarco = useMemo(() => {
    const m = new Map<number, number>();
    previews.forEach((p) => m.set(p.marco_dias, (m.get(p.marco_dias) || 0) + 1));
    return [...m.entries()].sort((a, b) => b[0] - a[0]);
  }, [previews]);

  return (
    <div className="p-4 md:p-6 max-w-[1400px] mx-auto space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-amber-900/20 pb-3">
        <div>
          <h1 className="text-lg md:text-xl font-mono uppercase tracking-wider text-amber-900 flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" /> Alertas de Vencimento — Pré-visualização
          </h1>
          <p className="text-xs uppercase tracking-wide text-stone-600 mt-1 font-mono">
            Modo dry-run · Nenhum e-mail é enviado · Cobre lacunas (CR · CRAF · Documentos · Autorizações)
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={carregar}
            disabled={loading || sending}
            className="bg-amber-900 hover:bg-amber-800 text-amber-50 uppercase tracking-wide font-mono text-xs"
          >
            {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
            {data ? "Recarregar" : "Pré-visualizar alertas de vencimento"}
          </Button>
          {data && previews.length > 0 && (
            <Button
              onClick={() => setConfirmStep(1)}
              disabled={loading || sending}
              className="bg-red-800 hover:bg-red-700 text-red-50 uppercase tracking-wide font-mono text-xs"
            >
              <Send className="h-4 w-4 mr-2" />
              Enviar alertas agora ({previews.length})
            </Button>
          )}
        </div>
      </div>

      {errMsg && (
        <div className="border-l-4 border-red-700 bg-red-50 text-red-900 p-3 text-sm font-mono uppercase">
          {errMsg}
        </div>
      )}

      {lastSendResult && (
        <div className="border-l-4 border-emerald-700 bg-emerald-50 text-emerald-900 p-3 text-xs font-mono uppercase grid grid-cols-3 gap-3">
          <div><span className="text-stone-600">Enviados reais:</span> <strong>{lastSendResult.enviados}</strong></div>
          <div><span className="text-stone-600">Pulados (dedupe):</span> <strong>{lastSendResult.pulados}</strong></div>
          <div><span className="text-stone-600">Erros:</span> <strong>{lastSendResult.erros}</strong></div>
        </div>
      )}

      {data && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Stat label="CANDIDATOS" value={data.candidatos_total} />
            <Stat label="A ENVIAR" value={data.previews_count} highlight />
            <Stat label="PULADOS / DEDUPE" value={data.pulados_dedupe_ou_sem_email} />
            <Stat label="ENVIADOS REAIS" value={data.enviados_reais} muted />
          </div>

          <div className="grid md:grid-cols-2 gap-3">
            <Group title="TOTAL POR FONTE" rows={totaisFonte.map(([k, v]) => [k, String(v)])} />
            <Group title="TOTAL POR MARCO (DIAS)" rows={totaisMarco.map(([k, v]) => [k === 0 ? "HOJE" : k < 0 ? `VENCIDO (${k}d)` : `${k}d`, String(v)])} />
          </div>

          {previews.length === 0 ? (
            <div className="border border-amber-900/20 bg-stone-50 p-6 text-center font-mono uppercase text-stone-600 text-sm">
              Nenhum alerta a enviar neste momento.
            </div>
          ) : (
            <div className="border border-amber-900/20 overflow-x-auto bg-stone-50">
              <table className="w-full text-xs font-mono">
                <thead className="bg-amber-900 text-amber-50 uppercase tracking-wider">
                  <tr>
                    <Th>Cliente</Th>
                    <Th>Destinatário</Th>
                    <Th>Fonte</Th>
                    <Th>Item</Th>
                    <Th>Vencimento</Th>
                    <Th>Marco</Th>
                    <Th>Assunto</Th>
                    <Th>Mensagem</Th>
                  </tr>
                </thead>
                <tbody>
                  {previews.map((p, i) => (
                    <tr key={i} className="border-t border-amber-900/10 hover:bg-amber-50/50">
                      <Td className="uppercase">{p.cliente_nome || "—"}</Td>
                      <Td className="text-stone-700">{p.destinatario}</Td>
                      <Td><FonteBadge fonte={p.fonte} /></Td>
                      <Td className="uppercase">{p.item}</Td>
                      <Td>{brDate(p.data_vencimento)}</Td>
                      <Td>
                        <span className={p.dias_restantes < 0 ? "text-red-700 font-bold" : p.marco_dias <= 15 ? "text-orange-700 font-bold" : "text-amber-800"}>
                          {p.dias_restantes < 0 ? `${p.dias_restantes}d` : p.marco_dias === 0 ? "HOJE" : `${p.marco_dias}d`}
                        </span>
                      </Td>
                      <Td className="text-stone-800">{p.assunto}</Td>
                      <Td className="text-stone-600 max-w-[280px]">{p.mensagem}</Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="text-[10px] font-mono uppercase text-stone-500 flex items-center gap-2 border-t border-amber-900/10 pt-2">
            <Mail className="h-3 w-3" /> Remetente padrão: naoresponda@queroarmas.com.br · dry_run obrigatório nesta etapa
          </div>
        </>
      )}

      <Dialog open={confirmStep > 0} onOpenChange={(o) => { if (!o) { setConfirmStep(0); setConfirmText(""); } }}>
        <DialogContent className="bg-stone-50 border-amber-900/30 max-w-md">
          <DialogHeader>
            <DialogTitle className="font-mono uppercase tracking-wider text-amber-900 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-700" />
              {confirmStep === 1 ? "Confirmar envio real" : "Confirmação final"}
            </DialogTitle>
            <DialogDescription className="font-mono text-xs uppercase text-stone-600">
              Esta ação dispara e-mails reais via send-smtp-email.
            </DialogDescription>
          </DialogHeader>

          {confirmStep === 1 && (
            <div className="space-y-3 font-mono text-sm">
              <div className="border border-amber-900/30 bg-amber-50 p-3 uppercase text-xs">
                <div className="text-stone-700">Quantidade de e-mails a enviar:</div>
                <div className="text-3xl text-red-800 font-bold mt-1">{previews.length}</div>
              </div>
              <ul className="text-[11px] uppercase text-stone-700 list-disc pl-4 space-y-1">
                <li>Remetente: naoresponda@queroarmas.com.br</li>
                <li>Itens já enviados (dedupe) serão pulados</li>
                <li>Resultado gravado em qa_vencimentos_alertas_enviados</li>
              </ul>
            </div>
          )}

          {confirmStep === 2 && (
            <div className="space-y-3 font-mono text-sm">
              <p className="text-xs uppercase text-stone-700">
                Para confirmar, digite exatamente: <strong className="text-red-800">ENVIAR ALERTAS</strong>
              </p>
              <Input
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value.toUpperCase())}
                placeholder="ENVIAR ALERTAS"
                className="font-mono uppercase"
                autoFocus
              />
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => { setConfirmStep(0); setConfirmText(""); }}
              disabled={sending}
              className="font-mono uppercase text-xs"
            >
              Cancelar
            </Button>
            {confirmStep === 1 ? (
              <Button
                onClick={() => setConfirmStep(2)}
                className="bg-amber-900 hover:bg-amber-800 text-amber-50 font-mono uppercase text-xs"
              >
                Continuar
              </Button>
            ) : (
              <Button
                onClick={enviarReal}
                disabled={sending || confirmText !== "ENVIAR ALERTAS"}
                className="bg-red-800 hover:bg-red-700 text-red-50 font-mono uppercase text-xs"
              >
                {sending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
                Enviar agora
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Stat({ label, value, highlight, muted }: { label: string; value: number; highlight?: boolean; muted?: boolean }) {
  return (
    <div className={`border p-3 ${highlight ? "border-amber-900 bg-amber-100" : muted ? "border-stone-300 bg-stone-100" : "border-amber-900/30 bg-stone-50"}`}>
      <div className="text-[10px] font-mono uppercase tracking-wider text-stone-600">{label}</div>
      <div className={`text-2xl font-mono ${highlight ? "text-amber-900" : "text-stone-800"}`}>{value}</div>
    </div>
  );
}

function Group({ title, rows }: { title: string; rows: [string, string][] }) {
  return (
    <div className="border border-amber-900/20 bg-stone-50">
      <div className="px-3 py-2 bg-amber-900 text-amber-50 text-[11px] font-mono uppercase tracking-wider">{title}</div>
      {rows.length === 0 ? (
        <div className="p-3 text-xs font-mono uppercase text-stone-500">—</div>
      ) : (
        <div className="divide-y divide-amber-900/10">
          {rows.map(([k, v]) => (
            <div key={k} className="flex justify-between px-3 py-1.5 text-xs font-mono uppercase">
              <span className="text-stone-700">{k}</span>
              <span className="text-amber-900 font-bold">{v}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function FonteBadge({ fonte }: { fonte: string }) {
  const colors: Record<string, string> = {
    CR: "bg-[#7A1F2B] text-[#FBF3F4]",
    CRAF: "bg-purple-900 text-purple-50",
    DOCUMENTO: "bg-stone-700 text-stone-50",
    AUTORIZACAO: "bg-emerald-900 text-emerald-50",
  };
  return <span className={`inline-block px-2 py-0.5 text-[10px] uppercase tracking-wider ${colors[fonte] || "bg-stone-600 text-white"}`}>{fonte}</span>;
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="text-left px-3 py-2 text-[10px]">{children}</th>;
}
function Td({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-3 py-2 align-top ${className}`}>{children}</td>;
}