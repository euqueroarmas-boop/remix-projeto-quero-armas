import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { X, Copy, Check } from "lucide-react";

interface LogData {
  id: string;
  tipo: string;
  status: string;
  mensagem: string;
  payload: Record<string, unknown> | null;
  user_id?: string | null;
  created_at: string;
}

interface LogFullscreenViewerProps {
  log: LogData | null;
  onClose: () => void;
}

function StatusDot({ status }: { status: string }) {
  const color =
    status === "error" ? "bg-red-400" :
    status === "warning" ? "bg-amber-400" :
    status === "success" ? "bg-emerald-400" :
    "bg-blue-400";
  return <span className={`inline-block w-2 h-2 rounded-full ${color}`} />;
}

export default function LogFullscreenViewer({ log, onClose }: LogFullscreenViewerProps) {
  const [copied, setCopied] = useState(false);

  // Lock body scroll
  useEffect(() => {
    if (log) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [log]);

  if (!log) return null;

  const p = log.payload || {};
  const stackTrace = (p.stack as string) || (p.stack_trace as string) || null;
  const technicalMessage = (p.technical_message as string) || null;
  const route = (p.route as string) || null;
  const action = (p.action as string) || null;
  const functionName = (p.function_name as string) || null;
  const httpStatus = p.http_status as number | null;
  const quoteId = (p.quote_id as string) || null;
  const contractId = (p.contract_id as string) || null;
  const customerId = (p.customer_id as string) || null;
  const paymentId = (p.payment_id as string) || null;
  const browserInfo = (p.browser_info as string) || null;
  const entries = (p.entries as unknown[]) || null;

  const fullText = `[LOG WMTI — ${log.status.toUpperCase()}]
Horário: ${new Date(log.created_at).toLocaleString("pt-BR")}
Tipo: ${log.tipo}
Status: ${log.status}
Mensagem: ${log.mensagem}
${route ? `Rota: ${route}` : ""}
${action ? `Ação: ${action}` : ""}
${technicalMessage ? `Erro técnico: ${technicalMessage}` : ""}
${functionName ? `Function: ${functionName}` : ""}
${httpStatus ? `HTTP Status: ${httpStatus}` : ""}
${quoteId ? `Quote ID: ${quoteId}` : ""}
${contractId ? `Contract ID: ${contractId}` : ""}
${customerId ? `Customer ID: ${customerId}` : ""}
${paymentId ? `Payment ID: ${paymentId}` : ""}
${stackTrace ? `\nStack Trace:\n${stackTrace}` : ""}
${browserInfo ? `\nBrowser: ${browserInfo}` : ""}
\nPayload completo:\n${JSON.stringify(p, null, 2)}
${entries ? `\nEntries:\n${JSON.stringify(entries, null, 2)}` : ""}`.trim();

  const handleCopy = async () => {
    await navigator.clipboard.writeText(fullText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
        className="fixed inset-0 z-[9998] bg-[#0A0A0A] flex flex-col"
        style={{ background: "linear-gradient(to bottom, #0A0A0A, #060606)" }}
      >
        {/* Fixed Header */}
        <div className="flex items-center justify-between gap-3 px-4 md:px-6 py-3 border-b border-border shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <StatusDot status={log.status} />
            <Badge variant="outline" className="text-[10px] shrink-0">{log.tipo}</Badge>
            <Badge variant="outline" className={`text-[10px] shrink-0 ${
              log.status === "error" ? "border-red-600/30 text-red-400" :
              log.status === "warning" ? "border-amber-600/30 text-amber-400" :
              "border-emerald-600/30 text-emerald-400"
            }`}>{log.status}</Badge>
            <span className="text-[10px] text-muted-foreground shrink-0 hidden sm:inline">
              {new Date(log.created_at).toLocaleString("pt-BR")}
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button variant="outline" size="sm" onClick={handleCopy} className="text-xs gap-1.5 h-8">
              {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
              {copied ? "Copiado!" : "Copiar log completo"}
            </Button>
            <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6">
          <div className="max-w-4xl mx-auto space-y-5">

            {/* Summary */}
            <section>
              <h3 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Resumo</h3>
              <div className="bg-muted/20 border border-border rounded-lg p-4 space-y-2">
                <p className="text-sm text-foreground font-medium">{log.mensagem}</p>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  <span>Tipo: <span className="text-foreground">{log.tipo}</span></span>
                  <span>Status: <span className="text-foreground">{log.status}</span></span>
                  <span>Hora: <span className="text-foreground">{new Date(log.created_at).toLocaleString("pt-BR")}</span></span>
                  {log.user_id && <span>User: <span className="text-foreground font-mono">{log.user_id}</span></span>}
                </div>
              </div>
            </section>

            {/* Context IDs */}
            {(route || action || functionName || quoteId || contractId || customerId || paymentId || httpStatus) && (
              <section>
                <h3 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Contexto</h3>
                <div className="bg-muted/20 border border-border rounded-lg p-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    {route && <div><span className="text-muted-foreground">Rota:</span> <span className="text-foreground font-mono">{route}</span></div>}
                    {action && <div><span className="text-muted-foreground">Ação:</span> <span className="text-foreground">{action}</span></div>}
                    {functionName && <div><span className="text-muted-foreground">Function:</span> <span className="text-foreground font-mono">{functionName}</span></div>}
                    {httpStatus && <div><span className="text-muted-foreground">HTTP:</span> <span className="text-foreground font-mono">{httpStatus}</span></div>}
                    {quoteId && <div><span className="text-muted-foreground">Quote:</span> <span className="text-foreground font-mono">{quoteId}</span></div>}
                    {contractId && <div><span className="text-muted-foreground">Contract:</span> <span className="text-foreground font-mono">{contractId}</span></div>}
                    {customerId && <div><span className="text-muted-foreground">Customer:</span> <span className="text-foreground font-mono">{customerId}</span></div>}
                    {paymentId && <div><span className="text-muted-foreground">Payment:</span> <span className="text-foreground font-mono">{paymentId}</span></div>}
                  </div>
                </div>
              </section>
            )}

            {/* Technical Error */}
            {technicalMessage && (
              <section>
                <h3 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Erro Técnico</h3>
                <div className="bg-red-950/20 border border-red-900/30 rounded-lg p-4">
                  <pre className="text-xs text-red-300 font-mono whitespace-pre-wrap break-words">{technicalMessage}</pre>
                </div>
              </section>
            )}

            {/* Stack Trace */}
            {stackTrace && (
              <section>
                <h3 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Stack Trace</h3>
                <div className="bg-muted/10 border border-border rounded-lg p-4 overflow-x-auto">
                  <pre className="text-[11px] text-muted-foreground font-mono whitespace-pre-wrap break-words leading-relaxed">{stackTrace}</pre>
                </div>
              </section>
            )}

            {/* Full Payload */}
            <section>
              <h3 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Payload JSON Completo</h3>
              <div className="bg-muted/10 border border-border rounded-lg p-4 overflow-x-auto">
                <pre className="text-[11px] text-muted-foreground font-mono whitespace-pre-wrap break-words leading-relaxed">
                  {JSON.stringify(p, null, 2)}
                </pre>
              </div>
            </section>

            {/* Entries */}
            {entries && entries.length > 0 && (
              <section>
                <h3 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Entries / Detalhes</h3>
                <div className="bg-muted/10 border border-border rounded-lg p-4 overflow-x-auto">
                  <pre className="text-[11px] text-muted-foreground font-mono whitespace-pre-wrap break-words leading-relaxed">
                    {JSON.stringify(entries, null, 2)}
                  </pre>
                </div>
              </section>
            )}

            {/* Browser Info */}
            {browserInfo && (
              <section>
                <h3 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Browser / Contexto</h3>
                <div className="bg-muted/10 border border-border rounded-lg p-4">
                  <pre className="text-[11px] text-muted-foreground font-mono whitespace-pre-wrap break-words">{browserInfo}</pre>
                </div>
              </section>
            )}

          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
