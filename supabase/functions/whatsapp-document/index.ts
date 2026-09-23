// Supabase Edge Function: upload a document to WhatsApp Cloud API and send it.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
const types: Record<string, string> = {
  pdf: 'application/pdf', xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', csv: 'text/csv',
};

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response(null, { headers: cors });
  if (request.method !== 'POST') return json({ error: 'Método no permitido.' }, 405);
  try {
    const token = request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
    if (!token) return json({ error: 'Inicia sesión para enviar archivos.' }, 401);
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const publicClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!);
    const { data: { user }, error: authError } = await publicClient.auth.getUser(token);
    if (authError || !user) return json({ error: 'Sesión no válida.' }, 401);
    if (user.id !== Deno.env.get('CRM_USER_ID')) return json({ error: 'Acceso no autorizado.' }, 403);
    const supabase = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    const form = await request.formData();
    const to = String(form.get('to') || '').replace(/\D/g, '');
    const file = form.get('file');
    if (!/^57\d{10}$/.test(to)) return json({ error: 'Número de Colombia no válido.' }, 400);
    if (!(file instanceof File)) return json({ error: 'Selecciona un archivo.' }, 400);
    const filename = file.name.split(/[\\/]/).pop()?.replace(/[\x00-\x1f]/g, '').slice(0, 180) || 'documento';
    const extension = filename.split('.').pop()?.toLowerCase() || '';
    if (!types[extension] || file.size < 1 || file.size > 15 * 1024 * 1024)
      return json({ error: 'Solo PDF y Excel de hasta 15 MB.' }, 400);

    // Check the customer service window against stored inbound messages, not the browser clock.
    const { data: incoming, error: queryError } = await supabase
      .from('whatsapp_mensajes').select('creado_en').eq('telefono', to)
      .neq('direccion', 'saliente').order('creado_en', { ascending: false }).limit(1);
    if (queryError) return json({ error: 'No se pudo verificar la conversación.' }, 500);
    if (!incoming?.[0]?.creado_en || Date.now() - new Date(incoming[0].creado_en).getTime() >= 24 * 60 * 60 * 1000)
      return json({ error: 'El cliente debe responder para abrir la ventana de 24 horas.' }, 403);

    const accessToken = Deno.env.get('WHATSAPP_ACCESS_TOKEN');
    const phoneId = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID');
    if (!accessToken || !phoneId) return json({ error: 'Falta configurar WhatsApp en Supabase.' }, 503);
    const base = `https://graph.facebook.com/v23.0/${phoneId}`;
    const headers = { Authorization: `Bearer ${accessToken}` };
    const upload = new FormData();
    upload.append('messaging_product', 'whatsapp');
    upload.append('type', types[extension]);
    upload.append('file', new File([file], filename, { type: types[extension] }));
    const uploaded = await fetch(`${base}/media`, { method: 'POST', headers, body: upload });
    const media = await uploaded.json();
    if (!uploaded.ok || !media.id) return json({ error: media.error?.message || 'Error al subir el archivo a WhatsApp.' }, 502);

    const sent = await fetch(`${base}/messages`, {
      method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ messaging_product: 'whatsapp', recipient_type: 'individual', to, type: 'document', document: { id: media.id, filename } }),
    });
    const result = await sent.json();
    if (!sent.ok || !result.messages?.length) return json({ error: result.error?.message || 'WhatsApp rechazó el envío.' }, 502);

    // Log successful sends for the CRM conversation history.
    const { error: logError } = await supabase.from('whatsapp_mensajes').insert({
      user_id: user.id, telefono: to, direccion: 'saliente', tipo: 'document',
      texto: '__mired_media__' + JSON.stringify({ id: media.id, name: filename }),
      wamid: result.messages[0].id, estado: 'enviado',
    });
    return json({ messages: result.messages, logged: !logError, ...(logError ? { warning: 'El archivo salió, pero no se pudo guardar en el historial.' } : {}) });
  } catch (error) {
    console.error('whatsapp-document:', error);
    return json({ error: 'No se pudo procesar el archivo.' }, 500);
  }
});
