import http from 'node:http';
import https from 'node:https';
import crypto from 'node:crypto';

const PORT = Number(process.env.PORT || 3000);
const PRACTI_BASE = 'https://sandboxpracti.practisistemas.com:9343/api';
const BRIDGE_TOKEN = process.env.BRIDGE_TOKEN;

if (!BRIDGE_TOKEN) {
  console.error('Missing BRIDGE_TOKEN');
  process.exit(1);
}

const allowedPaths = new Set(['/cSaldo','/consultaProducto','/preConsulta','/pracRec','/consRec']);
const agent = new https.Agent({ rejectUnauthorized: false }); // SANDBOX ONLY

function send(res, status, body) {
  const text = typeof body === 'string' ? body : JSON.stringify(body);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff'
  });
  res.end(text);
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'GET' && req.url === '/health') {
    return send(res, 200, { ok: true, service: 'mired360-practi-sandbox-bridge' });
  }

  if (req.method !== 'POST') return send(res, 405, { error: 'method_not_allowed' });

  const token = req.headers['x-bridge-token'];
  if (typeof token !== 'string') return send(res, 401, { error: 'unauthorized' });
  const a = Buffer.from(token);
  const b = Buffer.from(BRIDGE_TOKEN);
  if (a.length !== b.length || !crypto.timingSafeEqual(a,b)) return send(res, 401, { error: 'unauthorized' });

  const path = req.url?.split('?')[0] || '';
  if (!allowedPaths.has(path)) return send(res, 404, { error: 'not_found' });

  let raw = '';
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > 200000) return send(res, 413, { error: 'payload_too_large' });
  }

  let body;
  try { body = JSON.parse(raw || '{}'); }
  catch { return send(res, 400, { error: 'invalid_json' }); }

  try {
    const upstream = await new Promise((resolve, reject) => {
      const data = JSON.stringify(body);
      const u = new URL(PRACTI_BASE + path);
      const r = https.request({
        hostname: u.hostname,
        port: u.port,
        path: u.pathname,
        method: 'POST',
        agent,
        headers: {
          'content-type': 'application/json',
          'accept': 'application/json',
          'content-length': Buffer.byteLength(data)
        },
        timeout: 15000
      }, rr => {
        let out = '';
        rr.on('data', c => out += c);
        rr.on('end', () => resolve({ status: rr.statusCode || 502, body: out }));
      });
      r.on('timeout', () => r.destroy(new Error('upstream_timeout')));
      r.on('error', reject);
      r.write(data);
      r.end();
    });

    res.writeHead(upstream.status, {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff'
    });
    res.end(upstream.body);
  } catch (e) {
    send(res, 502, { error: 'upstream_error', detail: e instanceof Error ? e.message : String(e) });
  }
});

server.listen(PORT, '0.0.0.0', () => console.log(`bridge listening on ${PORT}`));
