/**
 * Temas para a Sidebar Z6 Dark do portal do cliente.
 * REGRA: todos os temas mantêm BASE PRETA (#0A0A0A) para garantir legibilidade
 * do texto branco/cinza claro do menu. A diferenciação vem de:
 *  - bg: gradiente sutil aplicado sobre o preto
 *  - accent: cor da borda esquerda do item ativo + hover
 *  - stripe: faixa decorativa de 3px no topo (CSS puro, sem imagens)
 */
export type QASidebarTheme = {
  key: string;
  label: string;
  description: string;
  bg: string;     // background CSS do <aside>
  accent: string; // cor principal de destaque
  stripe: string; // gradient da faixa de 3px no topo
  /**
   * "compact" = menu colado no topo (padrão, temas sólidos/preto).
   * "hero"    = abre um espaço nobre no topo (arte ou gradiente+emblema)
   *             e empurra nome do cliente + menu para baixo.
   */
  topMode: "compact" | "hero";
  /** URL da arte do bloco de topo (somente temas "hero" com imagem). */
  heroImage?: string;
  /** Emoji decorativo para o modo "hero" sem imagem (gradiente + emblema). */
  emblem?: string;
  /**
   * Quando true, o bloco de topo "hero" é apenas um espaçador transparente
   * (sem emblema, sem imagem própria). Útil para temas customizados, em que
   * a arte do usuário já é o background completo da sidebar.
   */
  heroEmpty?: boolean;
};

import { supabase } from "@/integrations/supabase/client";

export const QA_SIDEBAR_THEMES: QASidebarTheme[] = [
  {
    key: "default",
    label: "Clássico (padrão)",
    description: "Preto absoluto com dourado bordô — identidade Arsenal.",
    bg: "#0A0A0A",
    accent: "#D6A64B",
    stripe: "linear-gradient(90deg, #D6A64B 0%, #7A1F2B 100%)",
    topMode: "compact",
  },
  {
    key: "carnaval",
    label: "Carnaval",
    description: "Roxo, verde e amarelo carnavalesco.",
    bg: "linear-gradient(160deg, #2D0A4E 0%, #4A148C 40%, #1A0033 100%)",
    accent: "#F5C518",
    stripe: "linear-gradient(90deg, #6B1B9A 0%, #F5C518 50%, #2E7D32 100%)",
    topMode: "hero",
    emblem: "🎭",
  },
  {
    key: "festa-junina",
    label: "Festa Junina",
    description: "Vermelho e amarelo de fogueira.",
    bg: "linear-gradient(180deg, #3D1408 0%, #5C2110 50%, #1F0A04 100%)",
    accent: "#F2A93B",
    stripe: "linear-gradient(90deg, #C0392B 0%, #F2A93B 50%, #6B3410 100%)",
    topMode: "hero",
    emblem: "🎉",
  },
  {
    key: "independencia",
    label: "Independência (7 de Setembro)",
    description: "Verde, amarelo e azul da bandeira.",
    bg: "linear-gradient(165deg, #003D1F 0%, #00612E 45%, #0B2E6B 100%)",
    accent: "#F7C600",
    stripe: "linear-gradient(90deg, #008C45 0%, #F7C600 50%, #0B2E6B 100%)",
    topMode: "hero",
    emblem: "🇧🇷",
  },
  {
    key: "natal",
    label: "Natal",
    description: "Verde pinheiro com vermelho natalino.",
    bg: "linear-gradient(180deg, #0E3B1C 0%, #1B5E20 50%, #4A0E12 100%)",
    accent: "#E63946",
    stripe: "linear-gradient(90deg, #1B5E20 0%, #E63946 100%)",
    topMode: "hero",
    emblem: "🎄",
  },
  {
    key: "ano-novo",
    label: "Ano Novo / Réveillon",
    description: "Preto profundo com dourado de fogos.",
    bg: "linear-gradient(180deg, #1A1405 0%, #2B2008 45%, #050505 100%)",
    accent: "#E6C24E",
    stripe: "linear-gradient(90deg, #E6C24E 0%, #FFF2B0 50%, #E6C24E 100%)",
    topMode: "hero",
    emblem: "🎆",
  },
  {
    key: "dia-das-maes",
    label: "Dia das Mães",
    description: "Rosa profundo e elegante.",
    bg: "linear-gradient(170deg, #3D0A22 0%, #6A1740 50%, #1F0612 100%)",
    accent: "#F48FB1",
    stripe: "linear-gradient(90deg, #AD1457 0%, #F48FB1 100%)",
    topMode: "hero",
    emblem: "💐",
  },
  {
    key: "dia-dos-pais",
    label: "Dia dos Pais",
    description: "Azul-marinho com prata sóbria.",
    bg: "linear-gradient(180deg, #0B2E6B 0%, #122E55 50%, #050B14 100%)",
    accent: "#C0C8D6",
    stripe: "linear-gradient(90deg, #0B2E6B 0%, #C0C8D6 100%)",
    topMode: "hero",
    emblem: "👔",
  },
  {
    key: "dia-das-criancas",
    label: "Dia das Crianças",
    description: "Índigo profundo com toque de arco-íris.",
    bg: "linear-gradient(170deg, #1A1A4E 0%, #2D1B5C 50%, #0A0A1F 100%)",
    accent: "#FFD166",
    stripe: "linear-gradient(90deg, #EF476F 0%, #FFD166 33%, #06D6A0 66%, #118AB2 100%)",
    topMode: "hero",
    emblem: "🎈",
  },
  {
    key: "pascoa",
    label: "Páscoa",
    description: "Lilás pastel sobre fundo profundo.",
    bg: "linear-gradient(170deg, #2A1F4E 0%, #3D2B6B 50%, #14102B 100%)",
    accent: "#C8B6FF",
    stripe: "linear-gradient(90deg, #FFC8DD 0%, #C8B6FF 50%, #B8E0D2 100%)",
    topMode: "compact",
  },
  {
    key: "black-friday",
    label: "Black Friday",
    description: "Preto puro com amarelo neon.",
    bg: "#000000",
    accent: "#FFE600",
    stripe: "linear-gradient(90deg, #FFE600 0%, #000000 50%, #FFE600 100%)",
    topMode: "compact",
  },
  {
    key: "copa-2026",
    label: "Copa do Mundo 2026 — Brasil",
    description: "Verde, amarelo e azul da Seleção.",
    bg: "linear-gradient(165deg, #00471F 0%, #009B3A 40%, #002776 100%)",
    accent: "#FFDF1B",
    stripe: "linear-gradient(90deg, #009B3A 0%, #FFDF1B 50%, #002776 100%)",
    topMode: "hero",
    emblem: "🇧🇷",
  },
  {
    key: "brasil-2026",
    label: "Brasil 2026 (arte)",
    description: "Arte dedicada da campanha Brasil 2026 no topo da sidebar.",
    bg: "linear-gradient(165deg, #00471F 0%, #009B3A 40%, #002776 100%)",
    accent: "#FFDF1B",
    stripe: "linear-gradient(90deg, #009B3A 0%, #FFDF1B 50%, #002776 100%)",
    topMode: "hero",
    // Substituir por arte definitiva quando disponível.
    heroImage: "/placeholder.svg",
  },
];

const STORAGE_KEY = "qa.sidebar.theme";

/* ============================================================================
 * TEMAS VINDOS DO BANCO (qa_sidebar_temas) + STORAGE (bucket qa-temas)
 *
 * - O cliente NÃO usa mais base64/localStorage para imagens (estourava cota).
 * - A equipe administra temas em Configurações → Temas da Sidebar.
 * - O tema aplicado a TODOS por padrão é o is_global_default = true.
 * - Cada cliente pode manter uma preferência pessoal (apenas a chave do tema)
 *   em localStorage; se a preferência apontar para um tema inexistente, cai
 *   no global default e, por fim, no built-in "default".
 * ========================================================================== */

export type QASidebarThemeRow = {
  id: string;
  key: string;
  label: string;
  descricao: string | null;
  bg: string;
  accent: string;
  stripe: string | null;
  top_mode: "compact" | "hero";
  hero_image_path: string | null;
  hero_image_url: string | null;
  emblem: string | null;
  ativo: boolean;
  is_global_default: boolean;
  ordem: number;
};

function buildBgWithImage(imageUrl: string, fallback: string): string {
  // A arte enviada é o background do bloco hero (topo). O restante (menu/footer)
  // recebe escurecimento contínuo para garantir legibilidade do texto branco.
  return (
    `linear-gradient(180deg, ` +
      `rgba(0,0,0,0) 0px, ` +
      `rgba(0,0,0,0) 80px, ` +
      `rgba(0,0,0,0.55) 130px, ` +
      `rgba(0,0,0,0.55) 100%), ` +
    `url("${imageUrl}") top center / cover no-repeat, ${fallback || "#0A0A0A"}`
  );
}

export async function signHeroImagePath(path: string | null | undefined): Promise<string | null> {
  if (!path) return null;
  try {
    const { data, error } = await supabase
      .storage
      .from("qa-temas")
      .createSignedUrl(path, 60 * 60 * 24 * 7); // 7 dias
    if (error || !data?.signedUrl) return null;
    return data.signedUrl;
  } catch {
    return null;
  }
}

export async function dbRowToTheme(row: QASidebarThemeRow): Promise<QASidebarTheme> {
  const image =
    row.hero_image_url ??
    (row.hero_image_path ? await signHeroImagePath(row.hero_image_path) : null);
  const bg = image ? buildBgWithImage(image, row.bg) : row.bg;
  return {
    key: row.key,
    label: row.label,
    description: row.descricao ?? "",
    bg,
    accent: row.accent,
    stripe: row.stripe ?? "linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.6) 50%, rgba(255,255,255,0) 100%)",
    topMode: row.top_mode,
    heroImage: image ?? undefined,
    emblem: row.emblem ?? undefined,
    heroEmpty: !!image, // se há arte, o hero não desenha emblema próprio
  };
}

export async function fetchSidebarThemesFromDb(): Promise<{
  themes: QASidebarTheme[];
  globalDefaultKey: string | null;
}> {
  try {
    const { data, error } = await supabase
      .from("qa_sidebar_temas")
      .select("id,key,label,descricao,bg,accent,stripe,top_mode,hero_image_path,hero_image_url,emblem,ativo,is_global_default,ordem")
      .eq("ativo", true)
      .order("ordem", { ascending: true })
      .order("label", { ascending: true });
    if (error || !data) return { themes: [], globalDefaultKey: null };
    const rows = data as unknown as QASidebarThemeRow[];
    const themes = await Promise.all(rows.map((r) => dbRowToTheme(r)));
    const globalDefaultKey = rows.find((r) => r.is_global_default)?.key ?? null;
    return { themes, globalDefaultKey };
  } catch {
    return { themes: [], globalDefaultKey: null };
  }
}

/** Mescla built-in + DB; entradas do DB com a mesma key sobrescrevem built-in. */
export function mergeThemes(builtIn: QASidebarTheme[], db: QASidebarTheme[]): QASidebarTheme[] {
  const map = new Map<string, QASidebarTheme>();
  for (const t of builtIn) map.set(t.key, t);
  for (const t of db) map.set(t.key, t);
  return Array.from(map.values());
}

export function getPersonalThemeKey(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setPersonalThemeKey(key: string | null) {
  try {
    if (key == null) window.localStorage.removeItem(STORAGE_KEY);
    else window.localStorage.setItem(STORAGE_KEY, key);
    window.dispatchEvent(new CustomEvent("qa:sidebar-theme-change", { detail: { key } }));
  } catch {}
}

/** Resolve o tema efetivo: preferência pessoal → global default → built-in default. */
export function resolveEffectiveTheme(
  catalog: QASidebarTheme[],
  personalKey: string | null,
  globalDefaultKey: string | null,
): QASidebarTheme {
  const find = (k: string | null) => (k ? catalog.find((t) => t.key === k) : undefined);
  return (
    find(personalKey) ??
    find(globalDefaultKey) ??
    catalog.find((t) => t.key === "default") ??
    QA_SIDEBAR_THEMES[0]
  );
}

// ── Compat: nomes antigos que ainda podem ser importados em outros pontos ──
export const setStoredSidebarTheme = setPersonalThemeKey;
export function getStoredSidebarTheme(): QASidebarTheme {
  // Sem await aqui — devolve o built-in por chave; o resolver assíncrono fica
  // por conta do consumidor (que combina built-in + DB).
  const k = getPersonalThemeKey();
  return QA_SIDEBAR_THEMES.find((t) => t.key === k) ?? QA_SIDEBAR_THEMES[0];
}