import { useState } from 'react';
import { Share2, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface ShareButtonProps {
  /** Override do título compartilhado. Padrão: document.title */
  title?: string;
  /** Override da descrição. Padrão: meta[name=description] */
  description?: string;
  /** Override da URL. Padrão: window.location.href */
  url?: string;
  /** Texto do botão. */
  label?: string;
  className?: string;
  variant?: React.ComponentProps<typeof Button>['variant'];
  size?: React.ComponentProps<typeof Button>['size'];
}

/**
 * Botão global de compartilhamento.
 * Usa Web Share API quando disponível (mobile); fallback para copiar link.
 */
function shareableUrlForPreview(currentUrl: string): string {
  try {
    const parsed = new URL(currentUrl);
    if (
      parsed.pathname !== '/' &&
      !parsed.pathname.endsWith('/') &&
      !parsed.pathname.endsWith('/index.html')
    ) {
      parsed.pathname = `${parsed.pathname}/index.html`;
    }
    return parsed.toString();
  } catch {
    return currentUrl;
  }
}

export function ShareButton({
  title,
  description,
  url,
  label = 'Compartilhar esta página',
  className,
  variant = 'outline',
  size = 'sm',
}: ShareButtonProps) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  async function handleShare() {
    if (typeof window === 'undefined') return;
    const resolvedUrl = url || shareableUrlForPreview(window.location.href);
    const resolvedTitle = title || document.title;
    const resolvedDescription =
      description ||
      document.querySelector('meta[name="description"]')?.getAttribute('content') ||
      '';

    const shareData: ShareData = {
      title: resolvedTitle,
      text: resolvedDescription,
      url: resolvedUrl,
    };

    try {
      if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
        await navigator.share(shareData);
        return;
      }
    } catch (err) {
      // Usuário cancelou ou falhou — cai no fallback de copiar.
      const aborted = err instanceof DOMException && err.name === 'AbortError';
      if (aborted) return;
    }

    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(resolvedUrl);
      } else {
        const ta = document.createElement('textarea');
        ta.value = resolvedUrl;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      setCopied(true);
      toast({ title: 'Link copiado', description: 'A URL desta página foi copiada.' });
      setTimeout(() => setCopied(false), 2500);
    } catch {
      toast({
        title: 'Não foi possível compartilhar',
        description: 'Copie a URL diretamente da barra do navegador.',
        variant: 'destructive',
      });
    }
  }

  return (
    <Button
      type="button"
      onClick={handleShare}
      variant={variant}
      size={size}
      className={cn('font-heading uppercase tracking-wide', className)}
      data-testid="share-button"
    >
      {copied ? <Check className="mr-2 size-4" /> : <Share2 className="mr-2 size-4" />}
      {copied ? 'Link copiado' : label}
    </Button>
  );
}
