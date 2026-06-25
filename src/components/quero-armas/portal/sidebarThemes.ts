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
};

export const QA_SIDEBAR_THEMES: QASidebarTheme[] = [
  {
    key: "default",
    label: "Clássico (padrão)",
    description: "Preto absoluto com dourado bordô — identidade Arsenal.",
    bg: "#0A0A0A",
    accent: "#D6A64B",
    stripe: "linear-gradient(90deg, #D6A64B 0%, #7A1F2B 100%)",
  },
  {
    key: "carnaval",
    label: "Carnaval",
    description: "Roxo, verde e amarelo carnavalesco.",
    bg: "linear-gradient(180deg, #0A0A0A 0%, #120016 100%)",
    accent: "#F5C518",
    stripe: "linear-gradient(90deg, #6B1B9A 0%, #F5C518 50%, #2E7D32 100%)",
  },
  {
    key: "festa-junina",
    label: "Festa Junina",
    description: "Vermelho e amarelo de fogueira.",
    bg: "linear-gradient(180deg, #0A0A0A 0%, #170A05 100%)",
    accent: "#F2A93B",
    stripe: "linear-gradient(90deg, #C0392B 0%, #F2A93B 50%, #6B3410 100%)",
  },
  {
    key: "independencia",
    label: "Independência (7 de Setembro)",
    description: "Verde, amarelo e azul da bandeira.",
    bg: "linear-gradient(180deg, #0A0A0A 0%, #04140A 100%)",
    accent: "#F7C600",
    stripe: "linear-gradient(90deg, #008C45 0%, #F7C600 50%, #0B2E6B 100%)",
  },
  {
    key: "natal",
    label: "Natal",
    description: "Verde pinheiro com vermelho natalino.",
    bg: "linear-gradient(180deg, #0A0A0A 0%, #0D1A10 100%)",
    accent: "#E63946",
    stripe: "linear-gradient(90deg, #1B5E20 0%, #E63946 100%)",
  },
  {
    key: "ano-novo",
    label: "Ano Novo / Réveillon",
    description: "Preto profundo com dourado de fogos.",
    bg: "linear-gradient(180deg, #0A0A0A 0%, #050505 100%)",
    accent: "#E6C24E",
    stripe: "linear-gradient(90deg, #E6C24E 0%, #FFF2B0 50%, #E6C24E 100%)",
  },
  {
    key: "dia-das-maes",
    label: "Dia das Mães",
    description: "Rosa delicado em destaque.",
    bg: "linear-gradient(180deg, #0A0A0A 0%, #160910 100%)",
    accent: "#F48FB1",
    stripe: "linear-gradient(90deg, #AD1457 0%, #F48FB1 100%)",
  },
  {
    key: "dia-dos-pais",
    label: "Dia dos Pais",
    description: "Azul-marinho com prata sóbria.",
    bg: "linear-gradient(180deg, #0A0A0A 0%, #07101C 100%)",
    accent: "#C0C8D6",
    stripe: "linear-gradient(90deg, #0B2E6B 0%, #C0C8D6 100%)",
  },
  {
    key: "dia-das-criancas",
    label: "Dia das Crianças",
    description: "Arco-íris alegre no topo.",
    bg: "linear-gradient(180deg, #0A0A0A 0%, #0A0A14 100%)",
    accent: "#FFD166",
    stripe: "linear-gradient(90deg, #EF476F 0%, #FFD166 33%, #06D6A0 66%, #118AB2 100%)",
  },
  {
    key: "pascoa",
    label: "Páscoa",
    description: "Tons pastel suaves.",
    bg: "linear-gradient(180deg, #0A0A0A 0%, #0F0C14 100%)",
    accent: "#C8B6FF",
    stripe: "linear-gradient(90deg, #FFC8DD 0%, #C8B6FF 50%, #B8E0D2 100%)",
  },
  {
    key: "black-friday",
    label: "Black Friday",
    description: "Preto puro com amarelo neon.",
    bg: "#000000",
    accent: "#FFE600",
    stripe: "linear-gradient(90deg, #FFE600 0%, #000000 50%, #FFE600 100%)",
  },
  {
    key: "copa-2026",
    label: "Copa do Mundo 2026 — Brasil",
    description: "Verde, amarelo e azul da Seleção.",
    bg: "linear-gradient(180deg, #0A0A0A 0%, #051A0E 100%)",
    accent: "#FFDF1B",
    stripe: "linear-gradient(90deg, #009B3A 0%, #FFDF1B 50%, #002776 100%)",
  },
];

const STORAGE_KEY = "qa.sidebar.theme";

export function getStoredSidebarTheme(): QASidebarTheme {
  if (typeof window === "undefined") return QA_SIDEBAR_THEMES[0];
  try {
    const k = window.localStorage.getItem(STORAGE_KEY);
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