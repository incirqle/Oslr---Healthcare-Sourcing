import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'
import { z } from 'npm:zod@3'
import { sendTemplateEmail } from '../_shared/transactional-email-templates/send-email.ts'
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const db = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '')
    const { data: auth } = await db.auth.getUser((req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, ''))
    if (!auth.user) return json({ error: 'Please sign in again.' }, 401)
    const parsed = z.object({ invite_id: z.string().uuid() }).safeParse(await req.json())
    if (!parsed.success) return json({ error: 'Invalid invitation.' }, 400)
    const { data: invite } = await db.from('company_invites').select('*').eq('id', parsed.data.invite_id).maybeSingle()
    if (!invite || invite.accepted_at) return json({ error: 'Invitation unavailable.' }, 404)
    const { data: allowed } = await db.rpc('has_company_role', { _user_id: auth.user.id, _company_id: invite.company_id, _role: 'admin' })
    if (!allowed) return json({ error: 'Only workspace admins can send invitations.' }, 403)
    const { data: company } = await db.from('companies').select('name').eq('id', invite.company_id).maybeSingle()
    const acceptUrl = `https://oslr.health/auth?invite=${encodeURIComponent(invite.token)}`
    try {
      const result = await sendTemplateEmail('team-invite', invite.email, { templateData: { companyName: company?.name ?? 'your team', acceptUrl } })
      return json({ emailSent: result.sent, acceptUrl })
    } catch {
      return json({ emailSent: false, acceptUrl, error: 'Email could not be delivered. Share the invitation link instead.' })
    }
  } catch { return json({ error: 'Invitation unavailable. Try again shortly.' }, 500) }
})