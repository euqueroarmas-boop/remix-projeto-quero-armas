import { create } from "zustand";
import { persist } from "zustand/middleware";

export type OsType = "windows" | "linux" | "macos";
export type ServerOsType = "windows_server" | "linux";
export type ContractModeType = "recorrente" | "sob_demanda";

interface RecorrenteState {
  hosts: number;
  vms: number;
  estacoes: number;
  sistemaServidores: ServerOsType;
  sistemaEstacoes: OsType;
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
        // Legacy compat
        const osLegacy = params.get("os");
        const horas = params.get("horas");

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
        return p;
      },
    }),
    {
      name: "wmti-infra-calculator",
      // Migrate old persisted state that had `sistema` instead of split fields
      migrate: (persisted: any, version: number) => {
        if (persisted && persisted.recorrente) {
          if (!persisted.recorrente.sistemaServidores) {
            persisted.recorrente.sistemaServidores = "windows_server";
          }
          if (!persisted.recorrente.sistemaEstacoes) {
            persisted.recorrente.sistemaEstacoes = persisted.recorrente.sistema || "windows";
          }
        }
        return persisted;
      },
      version: 1,
    }
  )
);
