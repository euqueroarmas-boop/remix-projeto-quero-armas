import { create } from "zustand";
import { persist } from "zustand/middleware";

export type OsType = "windows" | "linux" | "macos";
export type ContractModeType = "recorrente" | "sob_demanda";

interface RecorrenteState {
  hosts: number;
  vms: number;
  estacoes: number;
  sistema: OsType;
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
        sistema: "windows",
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
        const os = params.get("os");
        const horas = params.get("horas");

        const rec: Partial<RecorrenteState> = {};
        if (hosts) rec.hosts = Math.max(1, Number(hosts));
        if (vms) rec.vms = Math.max(0, Number(vms));
        if (estacoes) rec.estacoes = Math.max(0, Number(estacoes));
        if (os && ["windows", "linux", "macos"].includes(os)) rec.sistema = os as OsType;
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
        p.set("os", s.recorrente.sistema);
        return p;
      },
    }),
    {
      name: "wmti-infra-calculator",
    }
  )
);
