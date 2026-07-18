import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { z } from 'https://deno.land/x/zod@v3.23.8/mod.ts'
import { requireQAStaff } from '../_shared/qaAuth.ts'

const BodySchema = z.object({
  processo_id: z.string().uuid(),
  origem: z.string().min(1).max(80).optional(),
})

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const guard = await requireQAStaff(req)
  if (!guard.ok) return guard.response

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return json({ error: 'JSON inválido' }, 400)
  }

  const parsed = BodySchema.safeParse(body)
  if (!parsed.success) {
    return json({ error: 'Parâmetros inválidos', details: parsed.error.flatten().fieldErrors }, 400)
  }

  const url = Deno.env.get('SUPABASE_URL')!
  const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const admin = createClient(url, serviceRole)

  const { processo_id, origem } = parsed.data

  const { data: processo, error: processoErr } = await admin
    .from('qa_processos')
    .select('id, cliente_id, status, servico_id, servico_nome')
    .eq('id', processo_id)
    .maybeSingle()

  if (processoErr) return json({ error: 'Falha ao localizar processo', detail: processoErr.message }, 500)
  if (!processo) return json({ error: 'Processo não encontrado' }, 404)

  const { data, error } = await admin.rpc('qa_reaproveitar_documentos_hub_processo', {
    p_processo_id: processo_id,
    p_origem: origem || 'manual_staff',
  })

  if (error) return json({ error: 'Falha ao reprocessar reaproveitamento', detail: error.message }, 500)

  const result = Array.isArray(data) ? data[0] : data
  const reaproveitados = Number(result?.reaproveitados ?? 0)
  const pendentes = Number(result?.pendentes ?? 0)
  const total = Number(result?.total_exigencias ?? 0)

  const { error: eventErr } = await admin.from('qa_processo_eventos').insert({
    processo_id,
    tipo_evento: 'reaproveitamento_hub_reprocessado_manual',
    descricao: `Equipe reprocessou reaproveitamento documental: ${reaproveitados} exigência(s) reaproveitada(s).`,
    ator: 'equipe_operacional',
    dados_json: {
      origem: origem || 'manual_staff',
      reaproveitados,
      pendentes,
      total_exigencias: total,
      operador_user_id: guard.userId,
      operador_perfil: guard.perfil,
      operador_email: guard.email,
    },
  })

  if (eventErr) return json({ error: 'Reaproveitamento concluído, mas auditoria falhou', detail: eventErr.message }, 500)

  return json({ ok: true, reaproveitados, pendentes, total_exigencias: total })
})