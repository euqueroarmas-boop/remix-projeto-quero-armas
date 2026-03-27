import { useTranslation } from "react-i18next";

type LanguageSwitcherProps = {
  compact?: boolean;
};

const LanguageSwitcher = ({ compact = false }: LanguageSwitcherProps) => {
  const { i18n } = useTranslation();
  const current = i18n.language?.startsWith("en") ? "en-US" : "pt-BR";

  const base = compact
    ? "w-8 h-8 rounded-full border flex items-center justify-center text-lg transition-all"
    : "w-9 h-9 rounded-full border flex items-center justify-center text-lg transition-all";

  return (
    <div className={`inline-flex items-center gap-1 ${!compact ? "h-16" : ""}`}>
      <button
        onClick={() => i18n.changeLanguage("pt-BR")}
        className={`${base} ${current === "pt-BR" ? "border-primary bg-primary/10 shadow-sm" : "border-transparent opacity-50 hover:opacity-80"}`}
        aria-label="Português"
        title="Português"
      >
        🇧🇷
      </button>
      <button
        onClick={() => i18n.changeLanguage("en-US")}
        className={`${base} ${current === "en-US" ? "border-primary bg-primary/10 shadow-sm" : "border-transparent opacity-50 hover:opacity-80"}`}
        aria-label="English"
        title="English"
      >
        🇺🇸
      </button>
    </div>
  );
};

export default LanguageSwitcher;
