import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { X, Globe } from "lucide-react";
import { track } from "@/lib/tracking";

/**
 * Shows a subtle suggestion banner when browser language is English
 * but the app is in Portuguese (default). Only appears once per session
 * and never if the user already made a manual language choice.
 */
const LanguageSuggestion = () => {
  const { i18n } = useTranslation();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Don't show if user already made a manual choice
    const hasManual = localStorage.getItem("wmti-lang-manual") === "true";
    if (hasManual) return;

    // Don't show if already dismissed this session
    const dismissed = sessionStorage.getItem("wmti-lang-suggestion-dismissed");
    if (dismissed) return;

    // Only show if browser is English and app is in Portuguese
    const browserLang = navigator.language || "";
    const isEnglishBrowser = browserLang.startsWith("en");
    const isPortuguese = i18n.language === "pt-BR";

    if (isEnglishBrowser && isPortuguese) {
      // Small delay so it doesn't flash on load
      const timer = setTimeout(() => setVisible(true), 2000);
      return () => clearTimeout(timer);
    }
  }, [i18n.language]);

  const handleSwitch = () => {
    i18n.changeLanguage("en-US");
    localStorage.setItem("wmti-lang-manual", "true");
    track("language_switch", "suggestion_accepted_en-US");
    setVisible(false);
  };

  const handleDismiss = () => {
    sessionStorage.setItem("wmti-lang-suggestion-dismissed", "true");
    track("language_switch", "suggestion_dismissed_pt-BR");
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-20 right-4 z-50 max-w-xs animate-in slide-in-from-bottom-4 fade-in duration-500">
      <div className="rounded-xl border border-border/60 bg-background/95 p-4 shadow-lg backdrop-blur-md">
        <button
          onClick={handleDismiss}
          className="absolute right-2 top-2 rounded-full p-1 text-muted-foreground/60 hover:text-foreground transition-colors"
          aria-label="Dismiss"
        >
          <X className="h-3.5 w-3.5" />
        </button>
        <div className="flex items-start gap-3 pr-4">
          <Globe className="h-5 w-5 text-primary mt-0.5 shrink-0" />
          <div className="space-y-2">
            <p className="text-sm text-foreground leading-snug">
              We detected you may prefer English.
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={handleSwitch}
                className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                Switch to English
              </button>
              <button
                onClick={handleDismiss}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Manter português
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LanguageSuggestion;
