import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'
import { TEMPLATES } from '../_shared/transactional-email-templates/registry.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  const { recipientEmail } = await req.json().catch(() => ({ recipientEmail: '' }))
  if (!recipientEmail) {
    return new Response(JSON.stringify({ error: 'recipientEmail required' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  const results: Array<{ template: string; ok: boolean; error?: string }> = []
  const stamp = Date.now()

  for (const [name, entry] of Object.entries(TEMPLATES)) {
    const templateData = (entry as any).previewData ?? {}
    const { data, error } = await supabase.functions.invoke('send-transactional-email', {
      body: {
        templateName: name,
        recipientEmail,
        idempotencyKey: `preview-all-${stamp}-${name}`,
        templateData,
      },
    })
    if (error) {
      results.push({ template: name, ok: false, error: error.message })
    } else {
      results.push({ template: name, ok: true, ...(data as object) })
    }
  }

  return new Response(JSON.stringify({ total: results.length, results }, null, 2), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})