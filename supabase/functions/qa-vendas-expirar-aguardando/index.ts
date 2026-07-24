// Cron diário: cancela vendas em "À INICIAR" / cobranca_status='nao_gerada'
// com mais de N dias (default 7) desde data_cadastro.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const diasLimite = Math.max(1, Number(url.searchParams.get('dias') ?? '7'));
    let dryRun = url.searchParams.get('dry_run') === 'true';

    let body: Record<string, unknown> = {};
    if (req.method === 'POST') {
      try { body = await req.json(); } catch { /* corpo vazio ok */ }
    }
    if (body.dry_run === true) dryRun = true;

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);
    const cutoff = new Date(Date.now() - diasLimite * 24 * 60 * 60 * 1000).toISOString();

    const { data: candidatas, error: selErr } = await supabase
      .from('qa_vendas')
      .select('id, id_legado, cliente_id, valor_a_pagar, data_cadastro, status, cobranca_status')
      .eq('status', 'À INICIAR')
      .eq('cobranca_status', 'nao_gerada')
      .lt('data_cadastro', cutoff);

    if (selErr) throw selErr;

    const alvos = candidatas ?? [];
    const resultado = {
      dias_limite: diasLimite,
      cutoff,
      dry_run: dryRun,
      total_encontradas: alvos.length,
      canceladas: [] as number[],
    };

    if (!dryRun && alvos.length > 0) {
      const ids = alvos.map((v) => v.id);
      const { error: updErr } = await supabase
        .from('qa_vendas')
        .update({
          status: 'EXPIRADA',
          cobranca_status: 'expirada',
          data_ultima_atualizacao: new Date().toISOString(),
        })
        .in('id', ids);
      if (updErr) throw updErr;

      resultado.canceladas = alvos
        .map((v) => v.id_legado)
        .filter((n): n is number => typeof n === 'number');

      // Log de auditoria (best-effort)
      await supabase.from('logs_sistema').insert({
        tipo: 'qa_vendas_expiracao_automatica',
        payload: resultado,
      }).then(() => null, () => null);
    }

    return new Response(JSON.stringify(resultado), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('qa-vendas-expirar-aguardando erro:', err);
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});