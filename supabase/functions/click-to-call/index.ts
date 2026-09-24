// Supabase Edge Function: click-to-call para la central IP de MIRED360SERVICIOS.
// Las credenciales del proveedor se guardan únicamente como Secrets de Supabase.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...cors, 'Content-Type': 'application/json' },
});

function normalizeColombia(value: unknown) {
  let tel = String(value ?? '').replace(/\D/g, '');
  if (tel.length === 10) tel = '57' + tel;
  return tel;
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response(null, { headers: cors });
  if (request.method !== 'POST') return json({ error: 'Método no permitido.' }, 405);

  try {
    const token = request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
    if (!token) return json({ error: 'Inicia sesión para realizar llamadas.' }, 401);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const publicClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!);
    const { data: { user }, error: authError } = await publicClient.auth.getUser(token);
    if (authError || !user) return json({ error: 'Sesión no válida.' }, 401);

    const crmUserId = Deno.env.get('CRM_USER_ID');
    if (crmUserId && user.id !== crmUserId) return json({ error: 'Acceso no autorizado.' }, 403);

    const body = await request.json().catch(() => ({}));
    const tel = normalizeColombia(body?.tel ?? body?.phone ?? body?.to);
    if (!/^57\d{10}$/.test(tel)) return json({ error: 'Número colombiano no válido.' }, 400);

    const endpoint = Deno.env.get('VOIP_ORIGINATE_URL');
    const username = Deno.env.get('VOIP_API_USERNAME');
    const password = Deno.env.get('VOIP_API_PASSWORD');
    const customerId = Deno.env.get('VOIP_CUSTOMER_ID');
    const accountId = Deno.env.get('VOIP_ACCOUNT_ID');

    const missing = [
      ['VOIP_ORIGINATE_URL', endpoint],
      ['VOIP_API_USERNAME', username],
      ['VOIP_API_PASSWORD', password],
      ['VOIP_CUSTOMER_ID', customerId],
      ['VOIP_ACCOUNT_ID', accountId],
    ].filter(([, value]) => !value).map(([name]) => name);

    if (missing.length) {
      return json({ error: 'Falta configurar la central IP en Supabase.', missing }, 503);
    }

    const basic = btoa(`${username}:${password}`);
    const providerResponse = await fetch(endpoint!, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${basic}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        customer_id: customerId,
        account_id: accountId,
        tel,
      }),
    });

    const raw = await providerResponse.text();
    let provider: unknown = raw;
    try { provider = raw ? JSON.parse(raw) : {}; } catch { /* conservar texto */ }

    if (!providerResponse.ok) {
      console.error('click-to-call proveedor:', providerResponse.status, raw);
      return json({
        error: 'La central IP rechazó la llamada.',
        provider_status: providerResponse.status,
        provider,
      }, 502);
    }

    return json({
      ok: true,
      tel,
      provider_status: providerResponse.status,
      provider,
    });
  } catch (error) {
    console.error('click-to-call:', error);
    return json({ error: 'No se pudo iniciar la llamada.' }, 500);
  }
});
