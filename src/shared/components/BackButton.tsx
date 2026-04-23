import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
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
    // Calcula destino de fallback (parâmetro explícito ou nível acima)
    const computedFallback = (() => {
      if (fallback) return fallback;
      const segments = location.pathname.split('/').filter(Boolean);
      segments.pop();
      return segments.length ? `/${segments.join('/')}` : '/';
    })();

    // Tenta voltar no histórico; se não houver mudança real, vai para o fallback
    if (window.history.length > 1) {
      const currentPath = location.pathname;
      navigate(-1);
      // Se após um tick continuamos no mesmo lugar, força o fallback
      window.setTimeout(() => {
        if (window.location.pathname === currentPath) {
          navigate(computedFallback, { replace: true });
        }
      }, 120);
      return;
    }
    navigate(computedFallback, { replace: true });
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={label}
      className={cn(
        'group inline-flex items-center gap-2 rounded-full',
        'border border-slate-200/80 bg-white/70 px-3.5 py-1.5',
        'text-slate-600 shadow-sm backdrop-blur-sm',
        'transition-all duration-200',
        'hover:border-slate-300 hover:bg-white hover:text-slate-900 hover:shadow',
        'active:scale-[0.97]',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400/40',
        className,
      )}
    >
      <ArrowLeft className="size-3.5 transition-transform duration-200 group-hover:-translate-x-0.5" />
      <span className="text-[10px] font-semibold uppercase tracking-[0.18em]">{label}</span>
    </button>
  );
};

export default BackButton;