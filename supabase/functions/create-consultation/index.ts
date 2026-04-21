import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const INSUFFICIENT = 'INSUFFICIENT_CONSULTATION_BALANCE';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Missing or invalid Authorization' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
  if (!supabaseUrl || !supabaseAnonKey) {
    return new Response(JSON.stringify({ error: 'Server misconfigured' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  let body: { topic?: string; message?: string };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const topic = typeof body.topic === 'string' ? body.topic : '';
  const message = typeof body.message === 'string' ? body.message : '';

  const { data, error } = await supabase.rpc('create_consultation', {
    p_topic: topic,
    p_message: message,
  });

  if (error) {
    console.error('[create-consultation] rpc error:', error);
    return new Response(
      JSON.stringify({
        error: 'RPC_FAILED',
        message: error.message ?? 'Could not create consultation.',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }

  const payload = data as Record<string, unknown> | null;
  if (!payload || typeof payload !== 'object') {
    return new Response(JSON.stringify({ error: 'INVALID_RESPONSE' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  if (payload.ok === false && payload.code === INSUFFICIENT) {
    return new Response(
      JSON.stringify({
        error: INSUFFICIENT,
        message:
          typeof payload.message === 'string'
            ? payload.message
            : 'No consultation credits remaining. Purchase a top-up to continue.',
      }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }

  if (payload.ok === false && payload.code === 'UNAUTHORIZED') {
    return new Response(
      JSON.stringify({
        error: 'UNAUTHORIZED',
        message: typeof payload.message === 'string' ? payload.message : 'Not authenticated.',
      }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }

  if (payload.ok === true && typeof payload.id === 'string') {
    return new Response(JSON.stringify({ id: payload.id }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ error: 'UNEXPECTED_RESULT' }), {
    status: 500,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
