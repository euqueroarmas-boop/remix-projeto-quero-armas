import { useTranslation } from "react-i18next";

type LanguageSwitcherProps = {
  compact?: boolean;
};

const flags: Record<string, { emoji: string; label: string }> = {
  "pt-BR": { emoji: "🇧🇷", label: "Português" },
  "en-US": { emoji: "🇺🇸", label: "English" },
};

const LanguageSwitcher = ({ compact = false }: LanguageSwitcherProps) => {
  const { i18n } = useTranslation();
  const current = i18n.language?.startsWith("en") ? "en-US" : "pt-BR";
  const next = current === "pt-BR" ? "en-US" : "pt-BR";

  return (
    <button
      onClick={() => i18n.changeLanguage(next)}
      className={compact
        ? "inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/80 px-3 py-2 font-mono text-[11px] uppercase tracking-wider text-foreground shadow-sm backdrop-blur-sm transition-colors hover:border-primary/60 hover:text-primary min-h-[42px]"
        : "flex items-center gap-2 font-mono text-xs uppercase tracking-wider text-muted-foreground hover:text-primary transition-colors h-16 min-h-[44px] min-w-[44px] justify-center"
      }
      aria-label={`Switch to ${flags[next].label}`}
      title={flags[next].label}
    >
      <span className="text-lg leading-none">{flags[current].emoji}</span>
      {compact ? (
        <span className="inline-flex items-center gap-1.5 leading-none">
          <span className={current === "pt-BR" ? "text-foreground" : "text-muted-foreground"}>PT</span>
          <span className="text-muted-foreground/60">/</span>
          <span className={current === "en-US" ? "text-foreground" : "text-muted-foreground"}>EN</span>
        </span>
      ) : (
        <span>{current === "pt-BR" ? "PT" : "EN"}</span>
      )}
    </button>
  );
};

export default LanguageSwitcher;
