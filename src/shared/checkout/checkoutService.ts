import { supabase } from '@/integrations/supabase/client';
import type { CartItem } from '@/shared/types/domain';
import { resolveActiveProvider } from '@/shared/payments/registry';
import { interpolateTemplate, sha256Hex } from './contractRendering';
import { formatBRL } from '@/shared/lib/formatters';

export interface CheckoutInput {
  userId: string;
  customer: { name: string | null; email: string; cpf: string | null };
  items: CartItem[];
  notes?: string;
  termsAccepted: boolean;
}

export interface CheckoutOutput {
  orderId: string;
  orderNumber: string;
  contractId: string | null;
  paymentStatus: 'awaiting_provider' | 'initialized';
  redirectUrl?: string;
}

export const runCheckout = async (input: CheckoutInput): Promise<CheckoutOutput> => {
  if (!input.termsAccepted) throw new Error('É necessário aceitar o termo comercial para concluir o pedido.');
  if (input.items.length === 0) throw new Error('Carrinho vazio.');

  const subtotal = input.items.reduce((a, i) => a + i.unit_price_cents * i.quantity, 0);

  const { data: order, error: orderErr } = await supabase
    .from('lp_orders' as any)
    .insert({ user_id: input.userId, subtotal_cents: subtotal, total_cents: subtotal, notes: input.notes ?? null, status: 'pending' })
    .select('id, order_number')
    .single();
  if (orderErr || !order) throw orderErr ?? new Error('Falha ao criar pedido.');
  const orderRow = order as any;

  const itemsPayload = input.items.map((i) => ({
    order_id: orderRow.id,
    service_id: i.service_id,
    service_name_snapshot: i.service_name,
    service_slug_snapshot: i.service_slug,
    unit_price_cents: i.unit_price_cents,
    quantity: i.quantity,
    subtotal_cents: i.unit_price_cents * i.quantity,
  }));
  const { error: itemsErr } = await supabase.from('lp_order_items' as any).insert(itemsPayload);
  if (itemsErr) throw itemsErr;

  const { data: template, error: tplErr } = await supabase
    .from('lp_contract_templates' as any)
    .select('id, body, version')
    .eq('is_active', true)
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (tplErr) throw tplErr;
  if (!template) {
    return { orderId: orderRow.id, orderNumber: orderRow.order_number, contractId: null, paymentStatus: 'awaiting_provider' };
  }
  const tpl = template as any;

  const variables: Record<string, string> = {
    client_name: input.customer.name ?? '—',
    client_cpf: input.customer.cpf ?? '—',
    order_number: orderRow.order_number,
    services_list: input.items.map((i) => `${i.quantity}× ${i.service_name}`).join('; '),
    order_total: formatBRL(subtotal).replace('R$', '').trim(),
    accepted_at: new Date().toLocaleString('pt-BR'),
  };
  const rendered = interpolateTemplate(tpl.body, variables);
  const hash = await sha256Hex(rendered);

  const { data: contract, error: contractErr } = await supabase
    .from('lp_contracts' as any)
    .insert({
      order_id: orderRow.id,
      user_id: input.userId,
      template_id: tpl.id,
      template_version: tpl.version,
      template_snapshot: tpl.body,
      variables,
      rendered_content: rendered,
      status: 'awaiting_signature',
      checkout_accepted_at: new Date().toISOString(),
    })
    .select('id')
    .single();
  if (contractErr) throw contractErr;
  const contractId: string = (contract as any).id;

  const { error: acceptErr } = await supabase.from('lp_contract_acceptances' as any).insert({
    contract_id: contractId,
    user_id: input.userId,
    content_hash: hash,
    acceptance_method: 'checkout_summary',
    acceptance_type: 'checkout_terms',
    user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
    metadata: { stage: 'checkout', order_number: orderRow.order_number, template_version: tpl.version },
  });
  if (acceptErr) throw acceptErr;

  const provider = await resolveActiveProvider();
  if (!provider || !provider.adapter) {
    return { orderId: orderRow.id, orderNumber: orderRow.order_number, contractId, paymentStatus: 'awaiting_provider' };
  }

  const charge = await provider.adapter.createCharge({
    orderId: orderRow.id,
    orderNumber: orderRow.order_number,
    amountCents: subtotal,
    customer: { userId: input.userId, name: input.customer.name, email: input.customer.email, cpf: input.customer.cpf },
    description: `Pedido ${orderRow.order_number}`,
  });

  await supabase.from('lp_payments' as any).insert({
    order_id: orderRow.id,
    provider: charge.providerKey,
    external_id: charge.externalId,
    amount_cents: subtotal,
    status: charge.status,
    raw_payload: (charge.rawPayload ?? null) as never,
  });

  return { orderId: orderRow.id, orderNumber: orderRow.order_number, contractId, paymentStatus: 'initialized', redirectUrl: charge.redirectUrl };
};
