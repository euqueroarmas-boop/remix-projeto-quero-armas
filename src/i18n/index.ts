import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import ptBR from "./locales/pt-BR.json";
import enUS from "./locales/en-US.json";
import ptBRPages from "./locales/pt-BR-pages.json";
import enUSPages from "./locales/en-US-pages.json";

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const deepMerge = <T extends Record<string, unknown>>(base: T, override: Record<string, unknown>): T => {
  const output: Record<string, unknown> = { ...base };

  Object.entries(override).forEach(([key, value]) => {
    const current = output[key];
    output[key] = isObject(current) && isObject(value)
      ? deepMerge(current, value)
      : value;
  });

  return output as T;
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      "pt-BR": { translation: deepMerge(ptBR as Record<string, unknown>, ptBRPages as Record<string, unknown>) },
      "en-US": { translation: deepMerge(enUS as Record<string, unknown>, enUSPages as Record<string, unknown>) },
    },
    fallbackLng: "pt-BR",
    interpolation: { escapeValue: false },
    saveMissing: true,
    missingKeyHandler: (lng, _ns, key) => {
      console.error(`[i18n] Missing translation key: ${key} (${lng.join(", ")})`);
    },
    detection: {
      order: ["localStorage", "navigator"],
      lookupLocalStorage: "wmti-lang",
      caches: ["localStorage"],
    },
  });

export default i18n;
