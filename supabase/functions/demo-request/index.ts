import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { z } from 'npm:zod@3.23.8'
import { sendTemplateEmail } from '../_shared/transactional-email-templates/send-email.ts'

const Body = z.object({
  name: z.string().trim().min(1).max(100),
  email: z.string().trim().email().max(255),
  company: z.string().trim().min(1).max(150),
  page: z.string().max(200).optional(),
})

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  const parsed = Body.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return json({ error: parsed.error.flatten().fieldErrors }, 400)
  const d = parsed.data
  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

  const since = new Date(Date.now() - 3600_000).toISOString()
  const { count } = await db.from('demo_requests').select('id', { count: 'exact', head: true })
    .ilike('email', d.email).gte('created_at', since)
  if ((count ?? 0) >= 3) return json({ ok: true, throttled: true })

  const { data: row, error } = await db.from('demo_requests')
    .insert({ name: d.name, email: d.email.toLowerCase(), company: d.company, page: d.page ?? null })
    .select('id').single()
  if (error) return json({ error: 'Could not save' }, 500)

  try {
    await sendTemplateEmail('demo-request', 'steven@pitchsink.com', {
      templateData: { ...d },
      idempotencyKey: `demo-request-${row.id}`,
    })
  } catch (e) {
    console.error('demo email failed', e)
  }
  return json({ ok: true })
})
