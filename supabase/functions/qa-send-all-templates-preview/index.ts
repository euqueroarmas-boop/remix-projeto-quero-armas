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

  const stamp = Date.now()
  const names = Object.keys(TEMPLATES)

  const work = (async () => {
    for (const name of names) {
      const templateData = (TEMPLATES[name] as any).previewData ?? {}
      try {
        const { error } = await supabase.functions.invoke('send-transactional-email', {
          body: {
            templateName: name,
            recipientEmail,
            idempotencyKey: `preview-all-${stamp}-${name}`,
            templateData,
          },
        })
        console.log(`[preview-all] ${name}:`, error ? `ERR ${error.message}` : 'OK')
      } catch (e) {
        console.log(`[preview-all] ${name}: THROW ${(e as Error).message}`)
      }
    }
  })()
  // @ts-ignore EdgeRuntime is available in Supabase edge runtime
  EdgeRuntime.waitUntil(work)

  return new Response(JSON.stringify({ scheduled: names.length, templates: names }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})