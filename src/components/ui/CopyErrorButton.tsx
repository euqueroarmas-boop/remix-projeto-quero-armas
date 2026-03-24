import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { copyErrorToClipboard, type WmtiError } from "@/lib/errorLogger";

interface Props {
  error: WmtiError;
  label?: string;
  variant?: "default" | "outline" | "ghost" | "destructive";
  size?: "default" | "sm" | "icon";
  className?: string;
}

export function CopyErrorButton({ error, label = "Copiar erro", variant = "outline", size = "sm", className }: Props) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    const ok = await copyErrorToClipboard(error);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <Button variant={variant} size={size} onClick={handleCopy} className={className}>
      {copied ? <Check className="h-3 w-3 mr-1" /> : <Copy className="h-3 w-3 mr-1" />}
      {copied ? "Copiado!" : label}
    </Button>
  );
}
