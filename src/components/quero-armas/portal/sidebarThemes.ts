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
const CUSTOM_KEY = "qa.sidebar.custom-themes";
export const QA_CUSTOM_SLOTS = 6;

export type QACustomTheme = {
  key: string;       // ex: "custom-0"
  label: string;     // ex: "Minha criação 1"
  image: string;     // data URL
};

export function getCustomThemes(): (QACustomTheme | null)[] {
  const empty: (QACustomTheme | null)[] = Array.from({ length: QA_CUSTOM_SLOTS }, () => null);
  if (typeof window === "undefined") return empty;
  try {
    const raw = window.localStorage.getItem(CUSTOM_KEY);
    if (!raw) return empty;
    const parsed = JSON.parse(raw) as (QACustomTheme | null)[];
    return empty.map((_, i) => parsed[i] ?? null);
  } catch {
    return empty;
  }
}

function persistCustom(list: (QACustomTheme | null)[]) {
  try {
    window.localStorage.setItem(CUSTOM_KEY, JSON.stringify(list));
    window.dispatchEvent(new CustomEvent("qa:sidebar-custom-change"));
  } catch (e) {
    // Quota excedida ou storage indisponível — propaga para a UI tratar.
    throw e;
  }
}

// Wrapper antigo mantido para chamadas externas que não querem tratar erro.
function persistCustomSilent(list: (QACustomTheme | null)[]) {
  try {
    persistCustom(list);
  } catch {}
}

export function setCustomThemeSlot(slot: number, image: string | null) {
  const list = getCustomThemes();
  if (image == null) {
    list[slot] = null;
  } else {
    list[slot] = {
      key: `custom-${slot}`,
      label: `MINHA CRIAÇÃO ${slot + 1}`,
      image,
    };
  }
  persistCustom(list);
}

export function customToTheme(c: QACustomTheme): QASidebarTheme {
  return {
    key: c.key,
    label: c.label,
    description: "Tema personalizado enviado por upload.",
    // A arte enviada pelo usuário é o background COMPLETO da sidebar, alinhado
    // ao topo. Aplicamos um véu escuro vertical que começa transparente nos
    // primeiros ~200px (preserva a arte do hero) e escurece a partir dali, para
    // garantir legibilidade do texto branco do menu mesmo se a arte tiver
    // áreas claras na metade inferior.
    bg:
      `linear-gradient(180deg, rgba(0,0,0,0) 0px, rgba(0,0,0,0) 200px, rgba(0,0,0,0.78) 260px, rgba(0,0,0,0.88) 100%), ` +
      `url("${c.image}") top center / cover no-repeat, #0A0A0A`,
    accent: "#D6A64B",
    stripe: "linear-gradient(90deg, rgba(255,255,255,0.0) 0%, rgba(255,255,255,0.6) 50%, rgba(255,255,255,0.0) 100%)",
    topMode: "hero",
    heroEmpty: true,
  };
}

export function getStoredSidebarTheme(): QASidebarTheme {
  if (typeof window === "undefined") return QA_SIDEBAR_THEMES[0];
  try {
    const k = window.localStorage.getItem(STORAGE_KEY);
    if (k && k.startsWith("custom-")) {
      const slot = Number(k.split("-")[1]);
      const c = getCustomThemes()[slot];
      if (c) return customToTheme(c);
    }
    return QA_SIDEBAR_THEMES.find((t) => t.key === k) ?? QA_SIDEBAR_THEMES[0];
  } catch {
    return QA_SIDEBAR_THEMES[0];
  }
}

export function setStoredSidebarTheme(key: string) {
  try {
    window.localStorage.setItem(STORAGE_KEY, key);
    window.dispatchEvent(new CustomEvent("qa:sidebar-theme-change", { detail: { key } }));
  } catch {}
}