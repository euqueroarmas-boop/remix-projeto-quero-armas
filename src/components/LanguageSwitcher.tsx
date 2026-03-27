import { useTranslation } from "react-i18next";

const flags: Record<string, { emoji: string; label: string }> = {
  "pt-BR": { emoji: "🇧🇷", label: "Português" },
  "en-US": { emoji: "🇺🇸", label: "English" },
};

const LanguageSwitcher = () => {
  const { i18n } = useTranslation();
  const current = i18n.language?.startsWith("en") ? "en-US" : "pt-BR";
  const next = current === "pt-BR" ? "en-US" : "pt-BR";

  return (
    <button
      onClick={() => i18n.changeLanguage(next)}
      className="flex items-center gap-2 font-mono text-xs uppercase tracking-wider text-muted-foreground hover:text-primary transition-colors h-16 min-h-[44px] min-w-[44px] justify-center"
      aria-label={`Switch to ${flags[next].label}`}
      title={flags[next].label}
    >
      <span className="text-lg leading-none">{flags[current].emoji}</span>
      <span>{current === "pt-BR" ? "PT" : "EN"}</span>
    </button>
  );
};

export default LanguageSwitcher;
