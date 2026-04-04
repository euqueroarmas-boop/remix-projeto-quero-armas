import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * Checkout persistence store — survives page refresh, deploys, and tab reopening.
 * Uses localStorage via Zustand's persist middleware.
 *
 * VERSION field enables safe migrations when checkout structure changes.
 */

const CHECKOUT_VERSION = 1;

export interface CheckoutRegistrationData {
  razaoSocial: string;
  nomeFantasia?: string;
  cnpjOuCpf: string;
  responsavel: string;
  responsavelCpf?: string;
  email: string;
  telefone?: string;
  whatsapp?: string;
  cep?: string;
  endereco?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  cidade?: string;
  uf?: string;
  isPJ?: boolean;
}

export type CheckoutFlowType = "on_demand" | "recurring";
export type OnDemandStep = "calculator" | "registration" | "contract" | "payment" | "success";
export type RecurringStep = "registration" | "planConfig" | "contract" | "payment";

export interface CheckoutSessionState {
  /** Version for forward compatibility */
  version: number;
  /** Which flow is active */
  flowType: CheckoutFlowType | null;
  /** The service slug this checkout belongs to */
  serviceSlug: string | null;

  /* ─── Step tracking ─── */
  onDemandStep: OnDemandStep;
  recurringStep: RecurringStep;

  /* ─── IDs (prevent duplication) ─── */
  quoteId: string | null;
  customerId: string | null;
  contractId: string | null;
  paymentId: string | null;

  /* ─── Registration data ─── */
  registrationData: CheckoutRegistrationData | null;

  /* ─── Payment state ─── */
  selectedPayment: "BOLETO" | "CREDIT_CARD" | null;
  invoiceUrl: string | null;
  paymentComplete: boolean;
  contractSigned: boolean;
  paymentReady: boolean;

  /* ─── On-demand specifics ─── */
  hours: number;
  contractMode: "recorrente" | "sob_demanda" | null;

  /* ─── Recurring specifics ─── */
  planConfig: { termMonths: number; support24h: boolean } | null;

  /* ─── Metadata ─── */
  updatedAt: number;
}

interface CheckoutStoreActions {
  /** Patch any subset of session state and bump updatedAt */
  patch: (partial: Partial<Omit<CheckoutSessionState, "version" | "updatedAt">>) => void;
  /** Reset all checkout state (e.g. after successful purchase) */
  reset: () => void;
  /** Get a safe snapshot — returns null if version mismatch or stale (>24h) */
  getSafeSession: (serviceSlug: string) => CheckoutSessionState | null;
}

const INITIAL_STATE: CheckoutSessionState = {
  version: CHECKOUT_VERSION,
  flowType: null,
  serviceSlug: null,
  onDemandStep: "calculator",
  recurringStep: "registration",
  quoteId: null,
  customerId: null,
  contractId: null,
  paymentId: null,
  registrationData: null,
  selectedPayment: null,
  invoiceUrl: null,
  paymentComplete: false,
  contractSigned: false,
  paymentReady: false,
  hours: 1,
  contractMode: null,
  planConfig: null,
  updatedAt: 0,
};

const MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours

export const useCheckoutStore = create<CheckoutSessionState & CheckoutStoreActions>()(
  persist(
    (set, get) => ({
      ...INITIAL_STATE,

      patch: (partial) =>
        set((s) => ({
          ...s,
          ...partial,
          updatedAt: Date.now(),
        })),

      reset: () => set({ ...INITIAL_STATE, updatedAt: 0 }),

      getSafeSession: (serviceSlug: string) => {
        const s = get();
        // Version mismatch → stale
        if (s.version !== CHECKOUT_VERSION) return null;
        // Different service → don't restore
        if (s.serviceSlug !== serviceSlug) return null;
        // Too old → stale
        if (s.updatedAt > 0 && Date.now() - s.updatedAt > MAX_AGE_MS) return null;
        // No meaningful progress saved
        if (!s.quoteId && !s.customerId && !s.registrationData) return null;
        return s;
      },
    }),
    {
      name: "wmti-checkout-session",
      version: CHECKOUT_VERSION,
      migrate: (persisted: any, version: number) => {
        // If version doesn't match, reset
        if (version !== CHECKOUT_VERSION) {
          return { ...INITIAL_STATE };
        }
        return persisted;
      },
    }
  )
);
