import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

const CACHE_PREFIX = "wmti-runtime-i18n-v1";

const shouldTranslate = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (/^(https?:\/\/|\/)/i.test(trimmed)) return false;
  if (/^[A-Z0-9_-]+$/.test(trimmed)) return false;
  return /[A-Za-zÀ-ÿ]/.test(trimmed);
};

const getCacheKey = (text: string, lang: string) => `${CACHE_PREFIX}:${lang}:${text}`;

const getCachedTranslation = (text: string, lang: string) => {
  try {
    return localStorage.getItem(getCacheKey(text, lang));
  } catch {
    return null;
  }
};

const setCachedTranslation = (text: string, lang: string, translated: string) => {
  try {
    localStorage.setItem(getCacheKey(text, lang), translated);
  } catch {
    return;
  }
};

const translateText = async (text: string, lang: string) => {
  if (lang.startsWith("pt")) return text;

  const cached = getCachedTranslation(text, lang);
  if (cached) return cached;

  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=pt&tl=${lang.startsWith("en") ? "en" : lang}&dt=t&q=${encodeURIComponent(text)}`;
  const response = await fetch(url);

  if (!response.ok) {
    console.error(`[i18n] Runtime translation failed (${response.status}) for:`, text);
    return text;
  }

  const data = await response.json();
  const translated = Array.isArray(data?.[0])
    ? data[0].map((item: unknown[]) => item?.[0] || "").join("")
    : text;

  if (translated && translated !== text) {
    setCachedTranslation(text, lang, translated);
  }

  return translated || text;
};

const collectStrings = (value: unknown, bucket: Set<string>) => {
  if (typeof value === "string") {
    if (shouldTranslate(value)) bucket.add(value);
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((item) => collectStrings(item, bucket));
    return;
  }

  if (value && typeof value === "object") {
    Object.values(value).forEach((item) => collectStrings(item, bucket));
  }
};

const replaceStrings = (value: unknown, dictionary: Map<string, string>): unknown => {
  if (typeof value === "string") {
    return dictionary.get(value) || value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => replaceStrings(item, dictionary));
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, replaceStrings(item, dictionary)]),
    );
  }

  return value;
};

export function useLocalizedContent<T>(content: T): T {
  const { i18n } = useTranslation();
  const [localized, setLocalized] = useState(content);
  const serialized = useMemo(() => JSON.stringify(content), [content]);

  useEffect(() => {
    let active = true;

    if (!i18n.language.startsWith("en")) {
      setLocalized(content);
      return () => {
        active = false;
      };
    }

    const strings = new Set<string>();
    collectStrings(content, strings);
    const items = Array.from(strings);

    if (!items.length) {
      setLocalized(content);
      return () => {
        active = false;
      };
    }

    Promise.all(items.map(async (text) => [text, await translateText(text, i18n.language)] as const))
      .then((entries) => {
        if (!active) return;
        setLocalized(replaceStrings(content, new Map(entries)) as T);
      })
      .catch((error) => {
        console.error("[i18n] Runtime localization error:", error);
        if (active) setLocalized(content);
      });

    return () => {
      active = false;
    };
  }, [content, i18n.language, serialized]);

  return localized;
}