import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const CUSTOMER_ID = '15020'
const DEFAULT_ACCOUNT_ID = '1502000101'
const ALLOWED_ACCOUNT_IDS = new Set(['1502000101', '1502000102', '1502000103', '1502000104', '1502000105'])

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function normalizeColombiaPhone(value: unknown) {
  let digits = String(value ?? '').replace(/\D/g, '')
  if (digits.startsWith('57') && digits.length === 12) return digits
  if (digits.length === 10) return `57${digits}`
  return ''
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Método no permitido.' }, 405)

  try {
    const authHeader = req.headers.get('Authorization') || ''
    const token = authHeader.replace(/^Bearer\s+/i, '').trim()
    if (!token) return json({ error: 'Sesión requerida.' }, 401)

    const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
    const publishableKeys = Deno.env.get('SUPABASE_PUBLISHABLE_KEYS')
    const legacyAnon = Deno.env.get('SUPABASE_ANON_KEY') || ''
    let publicKey = legacyAnon
    if (publishableKeys) {
      try { publicKey = JSON.parse(publishableKeys)?.default || legacyAnon } catch (_) {}
    }
    if (!supabaseUrl || !publicKey) return json({ error: 'Configuración de Supabase incompleta.' }, 500)

    const supabase = createClient(supabaseUrl, publicKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const { data: userData, error: userError } = await supabase.auth.getUser(token)
    if (userError || !userData?.user) return json({ error: 'Sesión inválida o vencida.' }, 401)

    const crmUserId = Deno.env.get('CRM_USER_ID')
    if (crmUserId && userData.user.id !== crmUserId) return json({ error: 'No autorizado para realizar llamadas.' }, 403)

    const body = await req.json().catch(() => ({}))
    const tel = normalizeColombiaPhone(body?.tel ?? body?.phone ?? body?.telefono)
    if (!tel) return json({ error: 'Número no válido. Use un celular colombiano de 10 dígitos.' }, 400)

    const requestedAccount = String(body?.account_id || DEFAULT_ACCOUNT_ID)
    const accountId = ALLOWED_ACCOUNT_IDS.has(requestedAccount) ? requestedAccount : DEFAULT_ACCOUNT_ID

    const endpoint = Deno.env.get('VOIP_ORIGINATE_URL') || ''
    const username = Deno.env.get('VOIP_API_USERNAME') || ''
    const password = Deno.env.get('VOIP_API_PASSWORD') || ''
    if (!endpoint || !username || !password) {
      return json({ error: 'Faltan los secretos VOIP de Comuniquémonos en Supabase.' }, 500)
    }

    const basic = btoa(`${username}:${password}`)
    const providerResponse = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${basic}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        customer_id: CUSTOMER_ID,
        account_id: accountId,
        tel,
      }),
    })

    const raw = await providerResponse.text()
    let providerData: unknown = raw
    try { providerData = raw ? JSON.parse(raw) : {} } catch (_) {}

    if (!providerResponse.ok) {
      return json({
        error: 'Comuniquémonos rechazó la solicitud de llamada.',
        status: providerResponse.status,
        detail: providerData,
      }, 502)
    }

    return json({
      ok: true,
      message: 'Llamada solicitada correctamente.',
      account_id: accountId,
      tel,
      provider: providerData,
    })
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Error inesperado.' }, 500)
  }
})
