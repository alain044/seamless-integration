import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { z } from 'npm:zod@3.23.8';

const RECIPIENT = 'hakizimanaalainpacifique@gmail.com';
const GATEWAY_URL = 'https://connector-gateway.lovable.dev/resend';

const Body = z.object({
  name: z.string().trim().min(1).max(100),
  email: z.string().trim().email().max(255),
  phone: z.string().trim().max(40).optional().nullable(),
  message: z.string().trim().min(5).max(2000),
});

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  try {
    const parsed = Body.safeParse(await req.json());
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: parsed.error.flatten().fieldErrors }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const { name, email, phone, message } = parsed.data;

    // 1. Persist message FIRST so it's never lost.
    const { data: row, error: insErr } = await supabase
      .from('support_messages')
      .insert({ name, email, phone: phone ?? null, message, status: 'pending' })
      .select('id').single();
    if (insErr) {
      console.error('insert failed', insErr);
      return new Response(JSON.stringify({ error: 'Storage failed' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');

    if (!LOVABLE_API_KEY || !RESEND_API_KEY) {
      await supabase.from('support_messages').update({ status: 'stored', error: 'email_not_configured' }).eq('id', row.id);
      return new Response(JSON.stringify({ ok: true, stored: true, emailed: false }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const esc = (s: string) => s.replace(/[<>&]/g, (c) => ({ '<':'&lt;','>':'&gt;','&':'&amp;' }[c]!));
    const html = `
      <h2>New contact form message</h2>
      <p><strong>From:</strong> ${esc(name)} &lt;${esc(email)}&gt;</p>
      ${phone ? `<p><strong>Phone:</strong> ${esc(phone)}</p>` : ''}
      <p><strong>Message:</strong></p>
      <p style="white-space:pre-wrap">${esc(message)}</p>
    `;

    const r = await fetch(`${GATEWAY_URL}/emails`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        'X-Connection-Api-Key': RESEND_API_KEY,
      },
      body: JSON.stringify({
        from: 'Savvy Contact <onboarding@resend.dev>',
        to: [RECIPIENT],
        reply_to: email,
        subject: `New contact form message from ${name}`,
        html,
      }),
    });

    if (!r.ok) {
      const txt = await r.text();
      console.error('Resend error', r.status, txt);
      await supabase.from('support_messages').update({ status: 'failed', error: `${r.status}: ${txt.slice(0, 500)}` }).eq('id', row.id);
      // Still return OK to user — we have the message saved.
      return new Response(JSON.stringify({ ok: true, stored: true, emailed: false }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    await supabase.from('support_messages').update({ status: 'sent' }).eq('id', row.id);
    return new Response(JSON.stringify({ ok: true, stored: true, emailed: true }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: 'Server error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
