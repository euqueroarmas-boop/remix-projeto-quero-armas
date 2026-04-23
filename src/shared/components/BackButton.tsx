import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface BackButtonProps {
  className?: string;
  label?: string;
  fallback?: string;
}

/**
 * Botão "Voltar" universal. Usa o histórico do navegador quando disponível;
 * caso contrário, navega para um caminho de fallback (padrão: rota pai ou "/").
 */
export const BackButton = ({ className, label = 'Voltar', fallback }: BackButtonProps) => {
  const navigate = useNavigate();
  const location = useLocation();

  // Não mostrar na home
  if (location.pathname === '/' || location.pathname === '') return null;

  const handleClick = () => {
    if (window.history.length > 1) {
      navigate(-1);
      return;
    }
    if (fallback) {
      navigate(fallback);
      return;
    }
    // fallback automático: sobe um nível na URL
    const segments = location.pathname.split('/').filter(Boolean);
    segments.pop();
    navigate(segments.length ? `/${segments.join('/')}` : '/');
  };

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={handleClick}
      aria-label={label}
      className={cn('gap-1.5 text-muted-foreground hover:text-foreground', className)}
    >
      <ArrowLeft className="size-4" />
      <span className="font-heading text-xs uppercase tracking-[0.15em]">{label}</span>
    </Button>
  );
};

export default BackButton;