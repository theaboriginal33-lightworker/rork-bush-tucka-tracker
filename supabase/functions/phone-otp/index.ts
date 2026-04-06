import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const otpStore = new Map<string, { otp: string; expires: number }>()

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const { action, phone, otp } = await req.json()

  // ── SEND ──
  if (action === 'send') {
    const code = Math.floor(100000 + Math.random() * 900000).toString()
    otpStore.set(phone, { otp: code, expires: Date.now() + 10 * 60 * 1000 })

    const sid   = Deno.env.get('TWILIO_SID')!
    const token = Deno.env.get('TWILIO_TOKEN')!
    const from  = Deno.env.get('TWILIO_FROM')!

    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
      {
        method: 'POST',
        headers: {
          'Authorization': 'Basic ' + btoa(`${sid}:${token}`),
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          To: phone,
          From: from,
          Body: `Your Bush Tucka Tracka verification code is: ${code}`,
        }),
      }
    )

    if (!res.ok) {
      const err = await res.text()
      console.error('Twilio error:', err)
      return new Response(JSON.stringify({ error: 'Failed to send SMS' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  // ── VERIFY ──
  if (action === 'verify') {
    const stored = otpStore.get(phone)

    if (!stored) {
      return new Response(JSON.stringify({ error: 'No OTP found. Request a new code.' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    if (Date.now() > stored.expires) {
      otpStore.delete(phone)
      return new Response(JSON.stringify({ error: 'Code expired. Request a new one.' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    if (stored.otp !== otp) {
      return new Response(JSON.stringify({ error: 'Incorrect code. Try again.' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    otpStore.delete(phone)
    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  return new Response(JSON.stringify({ error: 'Invalid action' }), {
    status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  })
})