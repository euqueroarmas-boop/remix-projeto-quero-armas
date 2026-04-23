import type { PaymentStatus } from '@/shared/types/domain';

export interface CreateChargeInput {
  orderId: string;
  orderNumber: string;
  amountCents: number;
  customer: { userId: string; name: string | null; email: string; cpf?: string | null };
  description?: string;
  metadata?: Record<string, unknown>;
}

export interface CreateChargeResult {
  externalId: string;
  providerKey: string;
  status: PaymentStatus;
  redirectUrl?: string;
  rawPayload?: unknown;
}

export interface VerifyWebhookInput {
  rawBody: string;
  signature: string | null;
  headers: Record<string, string>;
}

export interface VerifyWebhookResult {
  valid: boolean;
  externalEventId: string;
  eventType: string;
  externalPaymentId?: string;
  payload: unknown;
}

export interface PaymentProviderAdapter {
  key: string;
  displayName: string;
  createCharge(input: CreateChargeInput): Promise<CreateChargeResult>;
  verifyWebhook(input: VerifyWebhookInput): Promise<VerifyWebhookResult>;
  mapStatus(externalStatus: string): PaymentStatus;
}

export class NoProviderConfiguredError extends Error {
  constructor() {
    super('Nenhum provider de pagamento está conectado nesta instalação.');
    this.name = 'NoProviderConfiguredError';
  }
}
