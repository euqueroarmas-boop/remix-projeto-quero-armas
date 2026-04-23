import logoSrc from "@/assets/quero-armas-logo.png";

interface QALogoProps {
  className?: string;
  alt?: string;
}

/**
 * Logo oficial do módulo Quero Armas.
 * Use este componente em qualquer lugar do /* que precise exibir a marca.
 */
export function QALogo({ className = "h-8 w-8", alt = "Quero Armas" }: QALogoProps) {
  return (
    <img
      src={logoSrc}
      alt={alt}
      className={`object-contain ${className}`}
      draggable={false}
    />
  );
}

export default QALogo;
