import { RotateCcw } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { clearCadastroRefinadoStorage } from "../hooks/useCadastroRefinadoState";

interface Props {
  /** Texto exibido. Default: "Reiniciar processo". */
  label?: string;
  /** Classe extra opcional. */
  className?: string;
  /** Estilo extra opcional. */
  style?: React.CSSProperties;
  /**
   * Se true, preserva `?servico=` da URL atual ao reiniciar (vai para
   * `/cadastro?servico=...&novo=1`). Default: true.
   */
  preservarServico?: boolean;
  /** Callback opcional executado ANTES da navegação (ex.: cancelar polling). */
  onAntesDeReiniciar?: () => void;
}

/**
 * Botão "Reiniciar processo" — limpa o estado local do cadastro refinado
 * (sessionStorage) e leva o usuário para `/cadastro?novo=1`, preservando
 * apenas o serviço atual da URL se houver. NÃO toca em auth, banco ou
 * arquivos do storage.
 */
export default function QAReiniciarLink({
  label = "Reiniciar processo",
  className,
  style,
  preservarServico = true,
  onAntesDeReiniciar,
}: Props) {
  const navigate = useNavigate();
  const [params] = useSearchParams();

  const handleClick = () => {
    const ok = window.confirm(
      "Isso vai limpar os dados preenchidos nesta sessão e começar um novo processo. Deseja continuar?",
    );
    if (!ok) return;
    try {
      onAntesDeReiniciar?.();
    } catch {
      /* ignore */
    }
    clearCadastroRefinadoStorage();
    const servico = preservarServico ? params.get("servico") : null;
    const qs = new URLSearchParams();
    if (servico) qs.set("servico", servico);
    qs.set("novo", "1");
    // Navega para /cadastro com flag — a página detecta e completa o reset.
    navigate(`/cadastro?${qs.toString()}`, { replace: true });
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className={className ?? "qa-ref-btn-link"}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        background: "transparent",
        border: "none",
        cursor: "pointer",
        ...style,
      }}
      aria-label={label}
    >
      <RotateCcw size={13} aria-hidden />
      {label}
    </button>
  );
}