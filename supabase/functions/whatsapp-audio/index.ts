import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
const formats: Record<string, string> = { mp3: 'audio/mpeg', m4a: 'audio/mp4', aac: 'audio/aac', amr: 'audio/amr', ogg: 'audio/ogg; codecs=opus' };

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response(null, { headers: cors });
  if (request.method !== 'POST') return json({ error: 'Método no permitido.' }, 405);
  try {
    const token = request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
    if (!token) return json({ error: 'Inicia sesión para enviar audio.' }, 401);
    const url = Deno.env.get('SUPABASE_URL')!;
    const { data: { user }, error } = await createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!).auth.getUser(token);
    if (error || !user) return json({ error: 'Sesión no válida.' }, 401);
    if (user.id !== Deno.env.get('CRM_USER_ID')) return json({ error: 'Acceso no autorizado.' }, 403);
    const db = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const form = await request.formData();
    const to = String(form.get('to') || '').replace(/\D/g, '');
    const file = form.get('file');
    if (!/^57\d{10}$/.test(to)) return json({ error: 'Número de Colombia no válido.' }, 400);
    if (!(file instanceof File)) return json({ error: 'Selecciona un audio.' }, 400);
    const filename = file.name.split(/[\\/]/).pop()?.replace(/[\x00-\x1f]/g, '').slice(0, 180) || 'audio';
    const extension = filename.split('.').pop()?.toLowerCase() || '';
    if (!formats[extension] || !file.size || file.size > 15 * 1024 * 1024)
      return json({ error: 'Usa MP3, M4A, AAC, AMR u OGG Opus de hasta 15 MB.' }, 400);
    const { data: incoming, error: queryError } = await db.from('whatsapp_mensajes').select('creado_en')
      .eq('telefono', to).neq('direccion', 'saliente').order('creado_en', { ascending: false }).limit(1);
    if (queryError) return json({ error: 'No se pudo verificar la conversación.' }, 500);
    if (!incoming?.[0]?.creado_en || Date.now() - new Date(incoming[0].creado_en).getTime() >= 86400000)
      return json({ error: 'El cliente debe responder para abrir la ventana de 24 horas.' }, 403);
    const accessToken = Deno.env.get('WHATSAPP_ACCESS_TOKEN');
    const phoneId = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID');
    if (!accessToken || !phoneId) return json({ error: 'Falta configurar WhatsApp.' }, 503);
    const base = `https://graph.facebook.com/v23.0/${phoneId}`;
    const headers = { Authorization: `Bearer ${accessToken}` };
    const upload = new FormData();
    upload.append('messaging_product', 'whatsapp');
    upload.append('type', formats[extension]);
    upload.append('file', new File([file], filename, { type: formats[extension] }));
    const uploaded = await fetch(`${base}/media`, { method: 'POST', headers, body: upload });
    const media = await uploaded.json();
    if (!uploaded.ok || !media.id) return json({ error: media.error?.message || 'WhatsApp rechazó el audio.' }, 502);
    const sent = await fetch(`${base}/messages`, { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ messaging_product: 'whatsapp', recipient_type: 'individual', to, type: 'audio', audio: { id: media.id } }) });
    const result = await sent.json();
    if (!sent.ok || !result.messages?.length) return json({ error: result.error?.message || 'WhatsApp rechazó el envío.' }, 502);
    const { error: logError } = await db.from('whatsapp_mensajes').insert({ user_id: user.id, telefono: to,
      direccion: 'saliente', tipo: 'audio', texto: '__mired_media__' + JSON.stringify({ id: media.id, name: filename, kind: 'audio' }),
      wamid: result.messages[0].id, estado: 'enviado' });
    return json({ messages: result.messages, logged: !logError, ...(logError ? { warning: 'El audio salió, pero no se guardó en el historial.' } : {}) });
  } catch (error) {
    console.error('whatsapp-audio:', error);
    return json({ error: 'No se pudo procesar el audio.' }, 500);
  }
});
