import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Expose-Headers': 'X-Document-Name' };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response(null, { headers: cors });
  if (request.method !== 'POST') return json({ error: 'Método no permitido.' }, 405);
  try {
    const token = request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
    if (!token) return json({ error: 'Debes iniciar sesión.' }, 401);
    const url = Deno.env.get('SUPABASE_URL')!;
    const client = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!);
    const { data: { user }, error } = await client.auth.getUser(token);
    if (error || !user) return json({ error: 'Sesión no válida.' }, 401);
    if (user.id !== Deno.env.get('CRM_USER_ID')) return json({ error: 'Acceso no autorizado.' }, 403);

    const { messageId } = await request.json();
    if (!/^[0-9a-f-]{36}$/i.test(String(messageId || ''))) return json({ error: 'Mensaje no válido.' }, 400);
    const db = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { data: row, error: dbError } = await db.from('whatsapp_mensajes')
      .select('texto,tipo').eq('id', messageId).eq('user_id', user.id).single();
    if (dbError || !row || row.tipo !== 'document' || !row.texto?.startsWith('__mired_media__'))
      return json({ error: 'Este documento no está disponible. Solicita que lo envíen de nuevo.' }, 404);
    const media = JSON.parse(row.texto.slice('__mired_media__'.length));
    if (!/^\d+$/.test(String(media.id))) return json({ error: 'Archivo no válido.' }, 400);
    const accessToken = Deno.env.get('WHATSAPP_ACCESS_TOKEN');
    if (!accessToken) return json({ error: 'Falta configurar WhatsApp.' }, 503);
    const headers = { Authorization: `Bearer ${accessToken}` };
    const metaResponse = await fetch(`https://graph.facebook.com/v23.0/${media.id}`, { headers });
    const meta = await metaResponse.json();
    if (!metaResponse.ok || !meta.url) return json({ error: 'Meta ya no tiene disponible el archivo. Solicita que lo envíen de nuevo.' }, 404);
    const fileResponse = await fetch(meta.url, { headers });
    if (!fileResponse.ok || !fileResponse.body) return json({ error: 'No se pudo descargar el documento.' }, 502);
    const name = String(media.name || 'documento').split(/[\\/]/).pop()!.replace(/[\x00-\x1f"\\]/g, '').slice(0, 180);
    return new Response(fileResponse.body, {
      status: 200,
      headers: { ...cors, 'Content-Type': meta.mime_type || 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${name.replace(/[^\x20-\x7e]/g, '_')}"`,
        'X-Document-Name': encodeURIComponent(name), 'Cache-Control': 'private, no-store' },
    });
  } catch (error) {
    console.error('whatsapp-media:', error);
    return json({ error: 'No se pudo obtener el archivo.' }, 500);
  }
});
