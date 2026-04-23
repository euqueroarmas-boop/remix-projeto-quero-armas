import { supabase } from '@/integrations/supabase/client';
import type { PaymentProviderAdapter } from './types';

const adapters = new Map<string, PaymentProviderAdapter>();

export const registerProvider = (adapter: PaymentProviderAdapter) => {
  adapters.set(adapter.key, adapter);
};

export const getProvider = (key: string): PaymentProviderAdapter | undefined => adapters.get(key);

export interface ActiveProviderInfo {
  key: string;
  displayName: string;
  environment: 'sandbox' | 'live';
  adapter: PaymentProviderAdapter | null;
}

export const resolveActiveProvider = async (): Promise<ActiveProviderInfo | null> => {
  const { data, error } = await supabase
    .from('lp_payment_providers' as any)
    .select('key, display_name, environment')
    .eq('is_active', true)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  const row = data as any;
  return { key: row.key, displayName: row.display_name, environment: row.environment, adapter: adapters.get(row.key) ?? null };
};
