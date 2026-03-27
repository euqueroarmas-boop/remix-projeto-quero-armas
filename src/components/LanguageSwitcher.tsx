import { useTranslation } from "react-i18next";

type LanguageSwitcherProps = {
  compact?: boolean;
};

const LanguageSwitcher = ({ compact = false }: LanguageSwitcherProps) => {
  const { i18n } = useTranslation();
  const current = i18n.language?.startsWith("en") ? "en-US" : "pt-BR";
  const next = current === "pt-BR" ? "en-US" : "pt-BR";

  return (
    <button
      onClick={() => i18n.changeLanguage(next)}
      className={compact
        ? "inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-background/80 px-2.5 py-1.5 text-[11px] uppercase tracking-wider text-foreground shadow-sm backdrop-blur-sm transition-colors hover:border-primary/60 hover:text-primary min-h-[36px]"
        : "inline-flex items-center gap-2 font-mono text-xs uppercase tracking-wider text-muted-foreground hover:text-primary transition-colors h-16 justify-center"
      }
      aria-label={current === "pt-BR" ? "Switch to English" : "Mudar para Português"}
      title={current === "pt-BR" ? "Switch to English" : "Mudar para Português"}
    >
      <span className="inline-flex items-center gap-1.5 leading-none font-mono">
        <span className={`inline-flex items-center gap-0.5 ${current === "pt-BR" ? "text-foreground font-semibold" : "text-muted-foreground/50"}`}>
          🇧🇷 PT
        </span>
        <span className="text-muted-foreground/40">/</span>
        <span className={`inline-flex items-center gap-0.5 ${current === "en-US" ? "text-foreground font-semibold" : "text-muted-foreground/50"}`}>
          🇺🇸 EN
        </span>
      </span>
    </button>
  );
};

export default LanguageSwitcher;
