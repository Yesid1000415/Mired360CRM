const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { stripTypeScriptTypes } = require('node:module');
const source = stripTypeScriptTypes(fs.readFileSync(__dirname+'/../supabase/functions/practi-produccion/index.ts','utf8').replace(/^import .*;\n/gm,''));
function setup(extra={},user=true,role='administrador') {
 const secrets={SUPABASE_URL:'https://example.supabase.co',SUPABASE_ANON_KEY:'public',SUPABASE_SERVICE_ROLE_KEY:'private',PRACTI_PRODUCTION_ENABLED:'true',PRACTI_PRODUCTION_IDCOMERCIO:'138723',PRACTI_PRODUCTION_CLAVEVENTA:'test-secret',PRACTI_PRODUCTION_BASE_URL:'https://bridge.example/practi',...extra};
 let handler; const calls=[];
 const client={auth:{getUser:async()=>({data:{user:user?{id:'user-id'}:null},error:null})},from:()=>({select:()=>({eq:()=>({maybeSingle:async()=>({data:{rol:role,activo:true}})})})})};
 vm.runInNewContext(source,{Deno:{env:{get:n=>secrets[n]},serve:h=>handler=h},createClient:()=>client,Response,URL,AbortController,setTimeout,clearTimeout,Intl,fetch:async(url,opts)=>{calls.push({url,opts});return new Response(JSON.stringify({estado:'00',saldo:'0',saldomp:'0.000'}))}});
 return {calls,request:async(action)=>handler(new Request('https://example',{method:'POST',headers:{Authorization:'Bearer valid','Content-Type':'application/json'},body:JSON.stringify({action})}))};
}
test('saldo works without terminal and stays server-side',async()=>{const s=setup();const r=await s.request('saldo');assert.equal(r.status,200);assert.equal((await r.json()).data.estado,'00');assert.equal(s.calls.length,1);const b=JSON.parse(s.calls[0].opts.body);assert.equal(b.idcomercio,'138723');assert.equal('terminal' in b,false)});
test('configuration reports missing fields without exposing secrets',async()=>{const s=setup({PRACTI_PRODUCTION_CLAVEVENTA:undefined});const r=await s.request('configuracion');const b=await r.json();assert.equal(b.configured,false);assert.deepEqual(b.missing,['PRACTI_PRODUCTION_CLAVEVENTA']);assert.equal(s.calls.length,0);assert.equal(JSON.stringify(b).includes('private'),false)});
test('unauthenticated and unauthorized calls never reach provider',async()=>{for(const s of [setup({},false),setup({},true,'asesor')]){const r=await s.request('saldo');assert.ok([401,403].includes(r.status));assert.equal(s.calls.length,0)}});
test('disabled production and plaintext transport never reach provider',async()=>{for(const extra of [{PRACTI_PRODUCTION_ENABLED:'false'},{PRACTI_PRODUCTION_BASE_URL:'http://bridge.example'}]){const s=setup(extra);assert.ok((await s.request('saldo')).status>=400);assert.equal(s.calls.length,0)}});
test('bridge token sent only to upstream; invoice still requires terminal',async()=>{const s=setup({PRACTI_PRODUCTION_BRIDGE_TOKEN:'bridge-secret'});await s.request('saldo');assert.equal(s.calls[0].opts.headers['X-Bridge-Token'],'bridge-secret');const r=await s.request('consultar_factura');assert.equal(r.status,500);assert.equal(s.calls.length,1)});
test('frontend JavaScript parses',()=>{const html=fs.readFileSync(__dirname+'/../pagos-recargas.html','utf8');const scripts=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];assert.equal(scripts.length,1);new vm.Script(scripts[0][1])});
