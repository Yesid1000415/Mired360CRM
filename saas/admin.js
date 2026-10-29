(function(){
'use strict';
const $=x=>document.getElementById(x);
const client=window.supabase.createClient('https://lpiusomsuswdcraoozdn.supabase.co','sb_publishable_ZFjdUsgyfSxOqm4L1SrJJg_Z2f0lL0r');
const safe=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=s=>s?new Date(s).toLocaleDateString('es-CO'):'—';
let companies=[],target=null,history=[],moduleTarget=null;
function status(o){
 if(o.estado_suscripcion==='activa' && (!o.vigente_hasta || new Date(o.vigente_hasta)<=new Date()))return 'vencida';
 if(o.estado_suscripcion==='prueba' && new Date(o.prueba_hasta)<=new Date())return 'vencida';
 return o.estado_suscripcion;
}
function message(s,err=false){$('statusMessage').textContent=s;$('statusMessage').style.color=err?'#b53e52':'#17845f'}
function render(){
 const q=$('search').value.trim().toLowerCase(),filter=$('stateFilter').value;
 const filtered=companies.filter(o=>(!filter||status(o)===filter)&&(!q||[o.nombre,o.correo_facturacion,o.plan].join(' ').toLowerCase().includes(q)));
 $('stats').textContent=companies.length+' empresas · '+companies.filter(o=>status(o)==='activa').length+' activas · '+companies.filter(o=>status(o)==='prueba').length+' en prueba';
 $('companyRows').innerHTML=filtered.map(o=>'<tr><td><b>'+safe(o.nombre)+'</b></td><td>'+safe(o.correo_facturacion)+'</td><td>'+safe(o.plan)+'</td><td>'+safe(status(o))+'</td><td>'+fmt(o.vigente_hasta||o.prueba_hasta)+'</td><td>'+Number(o.usuarios)+'</td><td>'+Number(o.prospectos)+'</td><td><button class="button primary" data-activate="'+o.id+'">Activar</button> <button class="button" data-modules="'+o.id+'">Módulos</button> <button class="button danger" data-suspend="'+o.id+'">Suspender</button></td></tr>').join('')||'<tr><td colspan="8">No hay empresas para mostrar.</td></tr>';
}
async function load(){
 message('Consultando empresas...');
 const {data,error}=await client.rpc('saas_admin_listar_empresas');
 if(error){$('adminPanel').classList.add('hidden');$('loginPanel').classList.remove('hidden');$('loginMessage').textContent='Cuenta sin permiso administrativo: '+error.message;return}
 companies=Array.isArray(data)?data:[];
 $('adminPanel').classList.remove('hidden');$('loginPanel').classList.add('hidden');
 render();await loadHistory();message('Información actualizada.');
}

async function loadHistory(){
 const {data,error}=await client.from('saas_activaciones')
  .select('id,organizacion_id,tipo,plan,monto,referencia,observacion,hasta,creado_en')
  .order('creado_en',{ascending:false}).limit(1000);
 if(error){message('No fue posible cargar los movimientos: '+error.message,true);return}
 history=data||[];
 $('historyRows').innerHTML=history.map(x=>{
   const org=companies.find(c=>c.id===x.organizacion_id);
   return '<tr><td>'+fmt(x.creado_en)+'</td><td>'+safe(org?.nombre||'Empresa')+'</td><td>'+safe(x.tipo)+'</td><td>'+safe(x.plan)+'</td><td>'+new Intl.NumberFormat('es-CO').format(Number(x.monto||0))+'</td><td>'+safe(x.referencia||x.observacion)+'</td><td>'+fmt(x.hasta)+'</td></tr>';
 }).join('')||'<tr><td colspan="7">Aún no existen activaciones registradas.</td></tr>';
}
function exportHistory(){
 const rows=[['Fecha','Empresa','Tipo','Plan','Monto','Referencia','Observación','Vigencia']];
 history.forEach(x=>{
   const org=companies.find(c=>c.id===x.organizacion_id);
   rows.push([x.creado_en,org?.nombre||'',x.tipo,x.plan,x.monto,x.referencia,x.observacion,x.hasta]);
 });
 const quote=v=>'"'+String(v??'').replace(/^[=+\-@]/,"'").replace(/"/g,'""')+'"';
 const csv='\ufeff'+rows.map(r=>r.map(quote).join(';')).join('\r\n');
 const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));
 const a=document.createElement('a');a.href=url;a.download='MIRED360_SUSCRIPCIONES_MOVIMIENTOS.csv';a.click();
 setTimeout(()=>URL.revokeObjectURL(url),1200);
}
async function login(e){
 e.preventDefault();$('loginSubmit').disabled=true;
 const {error}=await client.auth.signInWithPassword({email:$('email').value.trim(),password:$('password').value});
 if(error)$('loginMessage').textContent=error.message;else await load();
 $('loginSubmit').disabled=false;
}
function activateDialog(id){
 const o=companies.find(v=>v.id===id);if(!o)return;target=id;
 $('modalTitle').textContent='Activar: '+o.nombre;
 $('plan').value=['esencial','equipo','empresa'].includes(o.plan)?o.plan:'esencial';
 $('activationModal').classList.remove('hidden');
}
async function activate(e){
 e.preventDefault();
 if(!target||!confirm('¿Confirmas que verificaste el pago o que la cortesía fue autorizada?'))return;
 $('confirmActivation').disabled=true;
 const {data,error}=await client.rpc('saas_admin_activar',{p_org:target,p_plan:$('plan').value,p_dias:Number($('days').value),p_monto:Number($('amount').value),p_referencia:$('reference').value.trim()});
 $('confirmActivation').disabled=false;
 if(error)return message(error.message,true);
 $('activationModal').classList.add('hidden');$('reference').value='';
 await load();message('Suscripción activada hasta '+fmt(data));
}
async function suspend(id){
 const o=companies.find(v=>v.id===id);if(!o)return;
 const reason=prompt('Motivo de suspensión para '+o.nombre+':');
 if(reason===null)return;
 if(reason.trim().length<8)return message('Motivo mínimo de ocho caracteres.',true);
 if(!confirm('¿Confirmar suspensión de '+o.nombre+'?'))return;
 const {error}=await client.rpc('saas_admin_suspender',{p_org:id,p_motivo:reason.trim()});
 if(error)return message(error.message,true);
 await load();message('Empresa suspendida.');
}
async function openModules(id){
 const o=companies.find(x=>x.id===id);if(!o)return;
 moduleTarget=id;
 $('moduleModalTitle').textContent='Módulos: '+o.nombre;
 $('modulesModal').classList.remove('hidden');
 await refreshModules();
}
async function refreshModules(){
 if(!moduleTarget)return;
 const {data,error}=await client.rpc('saas_admin_listar_modulos',{p_org:moduleTarget});
 if(error){message(error.message,true);return}
 const names={crm:'Clientes y ventas',sucursales:'Sucursales',equipo:'Asesores y equipo',campanas:'Campañas',llamadas:'Registro de llamadas'};
 $('adminModuleRows').innerHTML=(data||[]).map(m=>
  '<div class="module-admin-item"><strong>'+safe(names[m.codigo]||m.codigo)+'</strong>'+
  '<button type="button" class="button '+(m.activo?'danger':'primary')+'" data-module-code="'+safe(m.codigo)+'" data-module-active="'+(!m.activo)+'">'+(m.activo?'Desactivar':'Activar')+'</button></div>'
 ).join('')||'<p>No hay módulos configurados.</p>';
}
async function updateModule(code,active){
 if(!moduleTarget)return;
 if(!confirm('¿Confirmas '+(active?'activar':'desactivar')+' el módulo '+code+' para esta empresa?'))return;
 const {error}=await client.rpc('saas_admin_modulo',{p_org:moduleTarget,p_codigo:code,p_activo:active});
 if(error)return message(error.message,true);
 await refreshModules();message('Módulo '+code+' '+(active?'activado':'desactivado')+' correctamente.');
}
document.addEventListener('click',e=>{
 const a=e.target.closest('[data-activate]');
 const s=e.target.closest('[data-suspend]');
 const m=e.target.closest('[data-modules]'),t=e.target.closest('[data-module-code]');
 if(a)activateDialog(a.dataset.activate);
 if(s)suspend(s.dataset.suspend);
 if(m)openModules(m.dataset.modules);
 if(t)updateModule(t.dataset.moduleCode,t.dataset.moduleActive==='true');
});
$('loginForm').addEventListener('submit',login);
$('activationForm').addEventListener('submit',activate);
$('refresh').addEventListener('click',load);
$('exportHistory').addEventListener('click',exportHistory);
$('search').addEventListener('input',render);
$('stateFilter').addEventListener('change',render);
$('closeModal').addEventListener('click',()=>$('activationModal').classList.add('hidden'));
$('closeModules').addEventListener('click',()=>$('modulesModal').classList.add('hidden'));
$('modulesModal').addEventListener('click',e=>{if(e.target===$('modulesModal'))$('modulesModal').classList.add('hidden')});
$('activationModal').addEventListener('click',e=>{if(e.target===$('activationModal'))$('activationModal').classList.add('hidden')});
$('logout').addEventListener('click',async()=>{await client.auth.signOut();$('adminPanel').classList.add('hidden');$('loginPanel').classList.remove('hidden')});
client.auth.getSession().then(({data:{session}})=>{if(session?.user)load()}).catch(console.warn);
})();