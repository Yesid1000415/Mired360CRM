import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const VERIFY_TOKEN = Deno.env.get("WHATSAPP_VERIFY_TOKEN") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const CRM_USER_ID = Deno.env.get("CRM_USER_ID") ?? "";

function getMessageText(message: any): string {
  if (message?.text?.body) return String(message.text.body);
  if (message?.button?.text) return String(message.button.text);
  if (message?.interactive?.button_reply?.title) return String(message.interactive.button_reply.title);
  if (message?.interactive?.list_reply?.title) return String(message.interactive.list_reply.title);
    if (message?.document?.id) return '__mired_media__' + JSON.stringify({ id: String(message.document.id), name: String(message.document.filename || 'documento') });
  if (message?.audio?.id) return '__mired_media__' + JSON.stringify({ id: String(message.audio.id), name: 'Nota de voz', kind: 'audio' });
if (message?.image?.id) return '__mired_media__' + JSON.stringify({ id: String(message.image.id), name: 'Imagen', kind: 'image' });
  if (message?.image?.caption) return String(message.image.caption);
  if (message?.video?.caption) return String(message.video.caption);
  if (message?.document?.caption) return String(message.document.caption);
  if (message?.location) return `Ubicación: ${message.location.latitude}, ${message.location.longitude}`;
  if (message?.contacts?.length) return "[Contacto compartido]";
  if (message?.audio) return "[Audio]";
  if (message?.image) return "[Imagen]";
  if (message?.video) return "[Video]";
  if (message?.document) return "[Documento]";
  if (message?.sticker) return "[Sticker]";
  return `[${String(message?.type || "mensaje")}]`;
}

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);

  if (req.method === "GET") {
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");

    if (mode === "subscribe" && token === VERIFY_TOKEN && challenge) {
      console.log("Webhook verificado correctamente");
      return new Response(challenge, {
        status: 200,
        headers: { "Content-Type": "text/plain" },
      });
    }

    return new Response("Token de verificación incorrecto", { status: 403 });
  }

  if (req.method !== "POST") {
    return new Response("MIRED360 WhatsApp Webhook activo", { status: 200 });
  }

  try {
    const body = await req.json();
    console.log("Webhook POST recibido");

    if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !CRM_USER_ID) {
      console.error("Faltan Secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY o CRM_USER_ID");
      return new Response("EVENT_RECEIVED", { status: 200 });
    }

    const db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    for (const entry of body?.entry ?? []) {
      for (const change of entry?.changes ?? []) {
        const value = change?.value;

        // Estados de mensajes salientes
        for (const status of value?.statuses ?? []) {
          if (!status?.id) continue;
          const { error: statusError } = await db
            .from("whatsapp_mensajes")
            .update({ estado: String(status.status || "") })
            .eq("wamid", String(status.id));

          if (statusError) console.error("Error actualizando estado", statusError);
        }

        // Mensajes entrantes
        for (const message of value?.messages ?? []) {
          const telefono = String(message?.from ?? "").trim();
          if (!telefono) continue;

          const nombre =
            String(value?.contacts?.[0]?.profile?.name ?? "").trim() ||
            `WhatsApp ${telefono}`;

          const texto = getMessageText(message);
          const tipo = String(message?.type || "text");
          const wamid = String(message?.id || "").trim() || null;

          console.log("Mensaje entrante", { telefono, tipo, texto, wamid });

          // Mantener creación automática de prospecto
          const { data: existente, error: leadSearchError } = await db
            .from("prospectos")
            .select("id")
            .eq("user_id", CRM_USER_ID)
            .eq("telefono", telefono)
            .limit(1);

          if (leadSearchError) {
            console.error("Error buscando prospecto", leadSearchError);
          } else if (!existente || existente.length === 0) {
            const { error: leadInsertError } = await db
              .from("prospectos")
              .insert({
                user_id: CRM_USER_ID,
                nombre,
                telefono,
                origen: "WhatsApp",
                campana: "WHATSAPP",
                producto: "Internet Hogar",
                estado: "Nuevo contacto",
              });

            if (leadInsertError) {
              console.error("Error creando prospecto", leadInsertError);
            } else {
              console.log("Prospecto creado", telefono);
            }
          }

          // Evitar duplicados SIN upsert/onConflict.
          // Primero buscamos por wamid; si no existe, insertamos.
          let yaExiste = false;
          if (wamid) {
            const { data: existenteMsg, error: msgSearchError } = await db
              .from("whatsapp_mensajes")
              .select("id")
              .eq("wamid", wamid)
              .limit(1);

            if (msgSearchError) {
              console.error("Error buscando mensaje duplicado", msgSearchError);
            } else {
              yaExiste = !!(existenteMsg && existenteMsg.length);
            }
          }

          if (!yaExiste) {
            const { error: msgInsertError } = await db
              .from("whatsapp_mensajes")
              .insert({
                user_id: CRM_USER_ID,
                telefono,
                nombre,
                direccion: "entrante",
                tipo,
                texto,
                wamid,
                estado: "recibido",
                creado_en: message?.timestamp
                  ? new Date(Number(message.timestamp) * 1000).toISOString()
                  : new Date().toISOString(),
              });

            if (msgInsertError) {
              console.error("ERROR GUARDANDO MENSAJE", msgInsertError);
            } else {
              console.log("MENSAJE GUARDADO OK", { telefono, texto });
            }
          } else {
            console.log("Mensaje duplicado ignorado", wamid);
          }
        }
      }
    }

    return new Response("EVENT_RECEIVED", {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    });
  } catch (error) {
    console.error("ERROR GENERAL WEBHOOK", error);
    return new Response("EVENT_RECEIVED", { status: 200 });
  }
});
