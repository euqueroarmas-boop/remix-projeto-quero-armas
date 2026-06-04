/**
 * Tipos de domínio compartilhados entre camadas (módulo comercial Eu Quero Armas).
 * Espelham as tabelas do banco prefixadas com lp_.
 */

export type AppRole = 'admin' | 'client';

export type OrderStatus = 'pending' | 'paid' | 'in_progress' | 'completed' | 'cancelled';
export type PaymentStatus = 'pending' | 'authorized' | 'paid' | 'failed' | 'refunded';
export type ContractStatus = 'draft' | 'awaiting_signature' | 'signed' | 'cancelled';
export type ProviderEnvironment = 'sandbox' | 'live';
export type WebhookEventStatus = 'received' | 'processing' | 'processed' | 'failed' | 'ignored';
export type AcceptanceType = 'checkout_terms' | 'contract_signature';

export interface Profile {
  id: string;
  user_id: string;
  full_name: string | null;
  cpf: string | null;
  phone: string | null;
  created_at: string;
  updated_at: string;
}

export interface ServiceCategory {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  display_order: number;
  is_active: boolean;
}

export interface Service {
  id: string;
  category_id: string | null;
  slug: string;
  name: string;
  short_description: string | null;
  long_description: string | null;
  base_price_cents: number;
  is_active: boolean;
  display_order: number;
}

export interface CartItem {
  service_id: string;
  service_slug: string;
  service_name: string;
  unit_price_cents: number;
  quantity: number;
}

export interface PaymentProvider {
  id: string;
  key: string;
  display_name: string;
  environment: ProviderEnvironment;
  is_active: boolean;
}

export interface ContractAcceptance {
  id: string;
  contract_id: string;
  user_id: string;
  content_hash: string;
  ip_address: string | null;
  user_agent: string | null;
  acceptance_method: string;
  acceptance_type: AcceptanceType;
  accepted_at: string;
}