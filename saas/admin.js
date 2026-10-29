(function(){
'use strict';
const $=x=>document.getElementById(x);
const client=window.supabase.createClient('https://lpiusomsuswdcraoozdn.supabase.co','sb_publishable_ZFjdUsgyfSxOqm4L1SrJJg_Z2f0lL0r');
const safe=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=s=>s?new Date(s).toLocaleDateString('es-CO'):'—';
let companies=[],target=null;
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
 $('companyRows').innerHTML=filtered.map(o=>'<tr><td><b>'+safe(o.nombre)+'</b></td><td>'+safe(o.correo_facturacion)+'</td><td>'+safe(o.plan)+'</td><td>'+safe(status(o))+'</td><td>'+fmt(o.vigente_hasta||o.prueba_hasta)+'</td><td>'+Number(o.usuarios)+'</td><td>'+Number(o.prospectos)+'</td><td><button class="button primary" data-activate="'+o.id+'">Activar</button> <button class="button danger" data-suspend="'+o.id+'">Suspender</button></td></tr>').join('')||'<tr><td colspan="8">No hay empresas para mostrar.</td></tr>';
}
async function load(){
 message('Consultando empresas...');
 const {data,error}=await client.rpc('saas_admin_listar_empresas');
 if(error){$('adminPanel').classList.add('hidden');$('loginPanel').classList.remove('hidden');$('loginMessage').textContent='Cuenta sin permiso administrativo: '+error.message;return}
 companies=Array.isArray(data)?data:[];
 $('adminPanel').classList.remove('hidden');$('loginPanel').classList.add('hidden');
 render();message('Información actualizada.');
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
document.addEventListener('click',e=>{
 const a=e.target.closest('[data-activate]');
 const s=e.target.closest('[data-suspend]');
 if(a)activateDialog(a.dataset.activate);
 if(s)suspend(s.dataset.suspend);
});
$('loginForm').addEventListener('submit',login);
$('activationForm').addEventListener('submit',activate);
$('refresh').addEventListener('click',load);
$('search').addEventListener('input',render);
$('stateFilter').addEventListener('change',render);
$('closeModal').addEventListener('click',()=>$('activationModal').classList.add('hidden'));
$('activationModal').addEventListener('click',e=>{if(e.target===$('activationModal'))$('activationModal').classList.add('hidden')});
$('logout').addEventListener('click',async()=>{await client.auth.signOut();$('adminPanel').classList.add('hidden');$('loginPanel').classList.remove('hidden')});
client.auth.getSession().then(({data:{session}})=>{if(session?.user)load()}).catch(console.warn);
})();