import { create } from "zustand";
import { persist } from "zustand/middleware";

export type OsType = "windows" | "linux" | "macos";
export type ServerOsType = "windows_server" | "linux";
export type ContractModeType = "recorrente" | "sob_demanda";
export type SlaType = "padrao" | "24h";
export type CriticidadeType = "baixo" | "medio" | "alto";

export const SLA_MULTIPLIER: Record<SlaType, number> = {
  padrao: 1,
  "24h": 1.35,
};

export const CRITICIDADE_MULTIPLIER: Record<CriticidadeType, number> = {
  baixo: 1.0,
  medio: 1.2,
  alto: 1.5,
};

export const SLA_LABELS: Record<SlaType, string> = {
  padrao: "Padrão (horário comercial)",
  "24h": "24 horas (+35%)",
};

export const CRITICIDADE_LABELS: Record<CriticidadeType, string> = {
  baixo: "Baixo (×1.0)",
  medio: "Médio (×1.2)",
  alto: "Alto (×1.5)",
};

interface RecorrenteState {
  hosts: number;
  vms: number;
  estacoes: number;
  sistemaServidores: ServerOsType;
  sistemaEstacoes: OsType;
  sla: SlaType;
  criticidade: CriticidadeType;
  /** @deprecated use sistemaEstacoes instead */
  sistema?: OsType;
}

interface SobDemandaState {
  horas: number;
}

interface InfraState {
  modo: ContractModeType;
  recorrente: RecorrenteState;
  sobDemanda: SobDemandaState;
  setModo: (modo: ContractModeType) => void;
  setRecorrente: (partial: Partial<RecorrenteState>) => void;
  setSobDemanda: (partial: Partial<SobDemandaState>) => void;
  hydrateFromParams: (params: URLSearchParams) => void;
  toSearchParams: () => URLSearchParams;
}

export const useInfraStore = create<InfraState>()(
  persist(
    (set, get) => ({
      modo: "recorrente",
      recorrente: {
        hosts: 1,
        vms: 0,
        estacoes: 0,
        sistemaServidores: "windows_server",
        sistemaEstacoes: "windows",
        sla: "padrao",
        criticidade: "baixo",
      },
      sobDemanda: {
        horas: 1,
      },
      setModo: (modo) => set({ modo }),
      setRecorrente: (partial) =>
        set((s) => ({ recorrente: { ...s.recorrente, ...partial } })),
      setSobDemanda: (partial) =>
        set((s) => ({ sobDemanda: { ...s.sobDemanda, ...partial } })),
      hydrateFromParams: (params) => {
        const modo = params.get("modo");
        if (modo === "recorrente" || modo === "sob_demanda") {
          set({ modo });
        }
        const hosts = params.get("hosts");
        const vms = params.get("vms");
        const estacoes = params.get("estacoes");
        const osServidores = params.get("os_servidores");
        const osEstacoes = params.get("os_estacoes");
        const osLegacy = params.get("os");
        const horas = params.get("horas");
        const sla = params.get("sla");
        const criticidade = params.get("criticidade");

        const rec: Partial<RecorrenteState> = {};
        if (hosts) rec.hosts = Math.max(1, Number(hosts));
        if (vms) rec.vms = Math.max(0, Number(vms));
        if (estacoes) rec.estacoes = Math.max(0, Number(estacoes));
        if (osServidores && ["windows_server", "linux"].includes(osServidores)) {
          rec.sistemaServidores = osServidores as ServerOsType;
        }
        if (osEstacoes && ["windows", "linux", "macos"].includes(osEstacoes)) {
          rec.sistemaEstacoes = osEstacoes as OsType;
        } else if (osLegacy && ["windows", "linux", "macos"].includes(osLegacy)) {
          rec.sistemaEstacoes = osLegacy as OsType;
        }
        if (sla && ["padrao", "24h"].includes(sla)) {
          rec.sla = sla as SlaType;
        }
        if (criticidade && ["baixo", "medio", "alto"].includes(criticidade)) {
          rec.criticidade = criticidade as CriticidadeType;
        }
        if (Object.keys(rec).length > 0) {
          set((s) => ({ recorrente: { ...s.recorrente, ...rec } }));
        }

        if (horas) {
          set((s) => ({ sobDemanda: { ...s.sobDemanda, horas: Math.max(1, Number(horas)) } }));
        }
      },
      toSearchParams: () => {
        const s = get();
        const p = new URLSearchParams();
        p.set("modo", s.modo);
        p.set("hosts", String(s.recorrente.hosts));
        p.set("vms", String(s.recorrente.vms));
        p.set("estacoes", String(s.recorrente.estacoes));
        p.set("os_servidores", s.recorrente.sistemaServidores);
        p.set("os_estacoes", s.recorrente.sistemaEstacoes);
        p.set("sla", s.recorrente.sla);
        p.set("criticidade", s.recorrente.criticidade);
        return p;
      },
    }),
    {
      name: "wmti-infra-calculator",
      migrate: (persisted: any, version: number) => {
        if (persisted && persisted.recorrente) {
          if (!persisted.recorrente.sistemaServidores) {
            persisted.recorrente.sistemaServidores = "windows_server";
          }
          if (!persisted.recorrente.sistemaEstacoes) {
            persisted.recorrente.sistemaEstacoes = persisted.recorrente.sistema || "windows";
          }
          if (!persisted.recorrente.sla) {
            persisted.recorrente.sla = "padrao";
          }
          if (!persisted.recorrente.criticidade) {
            persisted.recorrente.criticidade = "baixo";
          }
        }
        return persisted;
      },
      version: 2,
    }
  )
);
