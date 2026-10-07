import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.95.0";

const productionEnabled = () => Deno.env.get("PRACTI_PRODUCTION_ENABLED") === "true";
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};
const env = (name: string) => { const v = Deno.env.get(name); if (!v) throw new Error(`Falta el secret ${name}`); return v; };
const creds = () => ({
  idcomercio: env("PRACTI_PRODUCTION_IDCOMERCIO"),
  claveventa: env("PRACTI_PRODUCTION_CLAVEVENTA"),
  ...(Deno.env.get("PRACTI_PRODUCTION_TERMINAL") ? { terminal: Deno.env.get("PRACTI_PRODUCTION_TERMINAL")! } : {}),
});
const digits = (v: unknown, name: string, min = 1, max = 30) => { const s = String(v ?? "").trim(); if (!/^\d+$/.test(s) || s.length < min || s.length > max) throw new Error(`${name} inválido`); return s; };
const tipoProducto = (v: unknown) => { const s = String(v ?? "").trim(); if (!/^[012]$/.test(s)) throw new Error("tipo inválido. Use 0 Multiproducto, 1 Recargas o 2 Pines"); return s; };
const colombiaDate = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());

async function practi(path: string, body: Record<string, unknown>) {
  if (!productionEnabled()) throw new Error("Producción Practi aún no habilitada");
  const base = env("PRACTI_PRODUCTION_BASE_URL").replace(/\/$/, "");
  if (new URL(base).protocol !== "https:") throw new Error("La conexión de producción requiere HTTPS");
  const bridgeToken = Deno.env.get("PRACTI_PRODUCTION_BRIDGE_TOKEN");
  const ctrl = new AbortController(); const timeout = setTimeout(() => ctrl.abort(), 20000);
  try {
    const res = await fetch(`${base}/${path}`, { method: "POST", headers: { "Content-Type": "application/json", "Accept": "application/json", ...(bridgeToken ? { "X-Bridge-Token": bridgeToken } : {}) }, body: JSON.stringify(body), signal: ctrl.signal });
    const raw = await res.text(); let data: unknown; try { data = JSON.parse(raw); } catch { data = { raw }; }
    return { http_status: res.status, ok: res.ok, data };
  } finally { clearTimeout(timeout); }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return new Response(JSON.stringify({ error: "Método no permitido" }), { status: 405, headers: cors });
  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const supabaseUrl = env("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? "";
    const serviceKey = env("SUPABASE_SERVICE_ROLE_KEY");
    if (!anonKey) throw new Error("Falta clave pública Supabase");
    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const token = authHeader.replace(/^Bearer\s+/i, "");
    const { data: userData, error: userError } = await userClient.auth.getUser(token);
    if (userError || !userData.user) return new Response(JSON.stringify({ error: "Sesión no válida" }), { status: 401, headers: cors });
    const { data: perfil } = await userClient.from("perfiles").select("rol,activo").eq("user_id", userData.user.id).maybeSingle();
    if (!perfil?.activo || !["coordinador", "administrador"].includes(perfil.rol)) return new Response(JSON.stringify({ error: "No autorizado para operaciones Practi" }), { status: 403, headers: cors });

    const input = await req.json(); const action = String(input?.action ?? "");
    if (action === "configuracion") {
      const required = ["PRACTI_PRODUCTION_IDCOMERCIO", "PRACTI_PRODUCTION_CLAVEVENTA", "PRACTI_PRODUCTION_BASE_URL"];
      const missing = required.filter(name => !Deno.env.get(name));
      const base = Deno.env.get("PRACTI_PRODUCTION_BASE_URL");
      let https = false;
      try { https = !!base && new URL(base).protocol === "https:"; } catch {}
      return new Response(JSON.stringify({ production: true, enabled: productionEnabled(), configured: missing.length === 0 && https, missing, https, terminal_configured: !!Deno.env.get("PRACTI_PRODUCTION_TERMINAL") }), { headers: cors });
    }

    if (!productionEnabled()) return new Response(JSON.stringify({ sandbox: false, production: true, enabled: false, error: "Producción Practi aún no habilitada" }), { status: 423, headers: cors });

    const admin = createClient(supabaseUrl, serviceKey); const actorId = userData.user.id; const c = creds();
    let result: any; let comprobanteToken: string | null = null;

    switch (action) {
      case "saldo": result = await practi("cSaldo", c); break;
      case "productos": {
        const producto = String(input.producto ?? "pc").trim(); if (!/^[a-z0-9]{1,20}$/i.test(producto)) throw new Error("producto inválido");
        result = await practi("consultaProducto", { ...c, producto }); break;
      }
      case "productos_tipo": {
        const tipo = tipoProducto(input.tipo); result = await practi("consultaProducto", { ...c, tipo }); break;
      }
      case "convenios": {
        const idTrx = digits(input.idtrans ?? Date.now(), "idtrans", 6, 30); const key = String(input.key ?? "CLARO").trim().slice(0, 40); const page = Number.isInteger(input.page) && input.page >= 0 ? input.page : 0;
        result = await practi("preConsulta", { ...c, tipoConsulta: "convenios_consulta", idTrx, data: { key, page } }); break;
      }
      case "recarga": {
        const idtrans = digits(input.idtrans ?? Date.now(), "idtrans", 6, 30); const celular = digits(input.celular, "celular", 10, 10); const valor = digits(input.valor, "valor", 3, 8); const operador = String(input.operador ?? "cm").trim().toLowerCase();
        if (!/^[a-z0-9]{1,20}$/.test(operador)) throw new Error("operador inválido");
        result = await practi("pracRec", { ...c, idtrans, celular, operador, valor, jsonAdicional: input.jsonAdicional ?? {} }); break;
      }
      case "estado": {
        const idtrans = digits(input.idtrans, "idtrans", 6, 30); const fecha = String(input.fecha ?? colombiaDate()); if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) throw new Error("fecha inválida");
        result = await practi("consRec", { ...c, fecha, idtrans }); break;
      }
      case "consultar_factura": {
        if (!c.terminal) throw new Error("Falta el secret PRACTI_PRODUCTION_TERMINAL para facturas");
        const idTrx = digits(input.idtrans ?? Date.now(), "idtrans", 6, 30); const convenio = digits(input.convenio ?? "72", "convenio", 1, 12); const referencia = digits(input.referencia, "referencia", 3, 40);
        result = await practi("preConsulta", { ...c, tipoConsulta: "consultaValorConvRef", idTrx, data: { idConv: convenio, extConvenio: referencia, ref1: referencia, ref2: "", ref3: "", ref4: "", terminal: c.terminal } }); break;
      }
      case "pagar_factura": {
        if (!c.terminal) throw new Error("Falta el secret PRACTI_PRODUCTION_TERMINAL para facturas");
        const idtrans = digits(input.idtrans, "idtrans", 6, 30); const referencia = digits(input.referencia, "referencia", 3, 40); const valor = digits(input.valor, "valor", 1, 10); const idPre = digits(input.idPre, "idPre", 1, 30);
        result = await practi("pracRec", { ...c, idtrans, celular: referencia, operador: "fc", valor, jsonAdicional: { idPre, ref1: referencia, ref2: "", ref3: "", ref4: "", terminalPayment: c.terminal } }); break;
      }
      default: return new Response(JSON.stringify({ error: "Acción no válida" }), { status: 400, headers: cors });
    }

    const practiData: any = result?.data ?? {}; const core: any = practiData?.data ?? practiData; const inner: any = core?.data ?? core;
    const estado = String(inner?.estado ?? core?.estado ?? practiData?.estado ?? ""); const respuesta = String(inner?.respuesta ?? core?.respuesta ?? practiData?.respuesta ?? "");
    if (["recarga", "pagar_factura", "estado"].includes(action)) {
      const idtrans = String(input.idtrans ?? inner?.idtrans ?? core?.idtrans ?? "");
      if (idtrans) {
        const tipo = action === "recarga" ? "recarga" : (String(inner?.codop ?? core?.codop ?? "") === "fc" || action === "pagar_factura" ? "factura" : "recarga");
        const row = { user_id: actorId, tipo, idtrans, referencia: String(input.celular ?? input.referencia ?? ""), operador: String(input.operador ?? (tipo === "factura" ? "fc" : "")), convenio: String(input.convenio ?? ""), valor: input.valor ? Number(input.valor) : null, estado, respuesta, codigoaut: String(inner?.codigoauth ?? core?.codigoauth ?? ""), sandbox: false, detalle: { action, http_status: result?.http_status, response: practiData }, actualizado_en: new Date().toISOString() };
        const { data: saved, error: historyError } = await admin.from("practi_transacciones").upsert(row, { onConflict: "idtrans" }).select("comprobante_token").single();
        if (historyError) throw new Error(`Practi respondió, pero no se pudo guardar el historial: ${historyError.message}`);
        comprobanteToken = saved?.comprobante_token ?? null;
      }
    }
    return new Response(JSON.stringify({ sandbox: false, production: true, enabled: true, action, comprobante_token: comprobanteToken, ...result }), { status: 200, headers: cors });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Error interno";
    return new Response(JSON.stringify({ sandbox: false, production: true, error: message }), { status: 500, headers: cors });
  }
});
