/**
 * Fonte única dos atalhos do rail do portal.
 * Usado tanto pela área do cliente quanto pelo espelho do painel admin,
 * garantindo que os dois painéis sejam visualmente idênticos.
 */
import {
  IconLayoutGrid,
  IconCrosshair,
  IconFileCertificate,
  IconFolders,
  IconLayoutKanban,
  IconBellRinging2,
  IconTargetArrow,
  IconPackages,
  IconCreditCardPay,
  IconHeadset,
  IconAdjustmentsHorizontal,
} from "@tabler/icons-react";

export type PortalNavKey =
  | "resumo"
  | "armas_municoes"
  | "contratos"
  | "documentos"
  | "processos"
  | "pendencias"
  | "analise_alvo"
  | "recarga_municoes"
  | "financeiro"
  | "mensagens"
  | "configuracoes";

export interface PortalNavItem {
  key: PortalNavKey;
  label: string;
  icon: any;
  path: string;
  group: "primary";
}

export const PORTAL_NAV_ITEMS: PortalNavItem[] = [
  { key: "resumo", label: "Resumo", icon: IconLayoutGrid, path: "/area-do-cliente", group: "primary" },
  { key: "armas_municoes", label: "Arsenal Inteligente", icon: IconCrosshair, path: "/area-do-cliente/arsenal-inteligente", group: "primary" },
  { key: "contratos", label: "Contratos", icon: IconFileCertificate, path: "/area-do-cliente/contratos", group: "primary" },
  { key: "documentos", label: "Documentos", icon: IconFolders, path: "/area-do-cliente/documentos", group: "primary" },
  { key: "processos", label: "Meus Processos", icon: IconLayoutKanban, path: "/area-do-cliente/processos", group: "primary" },
  { key: "pendencias", label: "Pendências", icon: IconBellRinging2, path: "/area-do-cliente/pendencias", group: "primary" },
  { key: "analise_alvo", label: "Análise de Alvo", icon: IconTargetArrow, path: "/area-do-cliente/analise-de-alvo", group: "primary" },
  { key: "recarga_municoes", label: "Recarga de Munições", icon: IconPackages, path: "/area-do-cliente/recarga-de-municoes", group: "primary" },
  { key: "financeiro", label: "Financeiro", icon: IconCreditCardPay, path: "/area-do-cliente/financeiro", group: "primary" },
  { key: "mensagens", label: "Suporte", icon: IconHeadset, path: "/area-do-cliente/mensagens", group: "primary" },
  { key: "configuracoes", label: "Configurações", icon: IconAdjustmentsHorizontal, path: "/area-do-cliente/configuracoes", group: "primary" },
];
