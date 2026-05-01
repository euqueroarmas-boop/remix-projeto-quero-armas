import { Link } from "react-router-dom";
import logoSrc from "@/assets/quero-armas-logo.png";

interface QALogoProps {
  className?: string;
  alt?: string;
  /**
   * Destino ao clicar no logo. Default: "/" (home institucional).
   * Passe `null` para renderizar apenas a imagem (sem link), útil dentro
   * de barras de navegação que já têm seu próprio handler.
   */
  linkTo?: string | null;
}

/**
 * Logo oficial do módulo Quero Armas.
 * Por padrão é clicável e leva para a home ("/"). Para desabilitar o link,
 * passe `linkTo={null}`.
 */
export function QALogo({
  className = "h-8 w-8",
  alt = "Quero Armas",
  linkTo = "/",
}: QALogoProps) {
  const img = (
    <img
      src={logoSrc}
      alt={alt}
      className={`object-contain rounded-xl ${className}`}
      draggable={false}
    />
  );

  if (linkTo === null) return img;

  return (
    <Link
      to={linkTo}
      aria-label="Ir para a página inicial"
      className="inline-flex items-center justify-center cursor-pointer transition-opacity hover:opacity-80"
    >
      {img}
    </Link>
  );
}

export default QALogo;
