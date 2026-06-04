import { supabase } from '@/integrations/supabase/client';
import { sha256Hex } from './contractRendering';

export interface SignContractInput {
  contractId: string;
  userId: string;
  renderedContent: string;
  acceptanceMethod?: string;
  metadata?: Record<string, unknown>;
}

export interface SignContractResult {
  acceptanceId: string;
  contentHash: string;
  signedAt: string;
}

export const signContract = async (input: SignContractInput): Promise<SignContractResult> => {
  const hash = await sha256Hex(input.renderedContent);
  const signedAt = new Date().toISOString();

  const { data: acceptance, error } = await supabase
    .from('lp_contract_acceptances' as any)
    .insert({
      contract_id: input.contractId,
      user_id: input.userId,
      content_hash: hash,
      acceptance_method: input.acceptanceMethod ?? 'click',
      acceptance_type: 'contract_signature',
      user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
      metadata: input.metadata ?? {},
    })
    .select('id, accepted_at')
    .single();

  if (error) throw new Error(error.message ?? 'Falha ao registrar assinatura.');
  const row = acceptance as any;

  await supabase.from('lp_contracts' as any)
    .update({ signed_at: signedAt, status: 'signed', signature_metadata: { hash, method: input.acceptanceMethod ?? 'click' } })
    .eq('id', input.contractId);

  return { acceptanceId: row.id, contentHash: hash, signedAt: row.accepted_at };
};
