import { AlertTriangle, RefreshCw, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { type WmtiError, copyErrorToClipboard } from "@/lib/errorLogger";
import { useState } from "react";

interface Props {
  title?: string;
  message: string;
  error?: WmtiError | null;
  onRetry?: () => void;
  retryLabel?: string;
}

export function ErrorBlock({ title = "Não foi possível concluir a operação", message, error, onRetry, retryLabel = "Tentar novamente" }: Props) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!error) return;
    const ok = await copyErrorToClipboard(error);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="space-y-3 rounded-xl border border-destructive/30 bg-destructive/10 p-4">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 text-destructive shrink-0" />
        <div className="min-w-0">
          <p className="font-semibold text-foreground">{title}</p>
          <p className="text-sm text-muted-foreground mt-1">{message}</p>
          {error?.technicalMessage && error.technicalMessage !== message && (
            <p className="text-xs text-muted-foreground/70 mt-1 font-mono break-all">{error.technicalMessage}</p>
          )}
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {onRetry && (
          <Button size="sm" onClick={onRetry}>
            <RefreshCw className="h-3 w-3 mr-1" />
            {retryLabel}
          </Button>
        )}
        {error && (
          <Button size="sm" variant="outline" onClick={handleCopy}>
            {copied ? <Check className="h-3 w-3 mr-1" /> : <Copy className="h-3 w-3 mr-1" />}
            {copied ? "Copiado!" : "Copiar erro"}
          </Button>
        )}
      </div>
    </div>
  );
}
