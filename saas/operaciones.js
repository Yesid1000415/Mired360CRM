/* MIRED360 CRM Empresas | Sucursales, campañas y gestiones reales */
(function(){
'use strict';
const core=window.MiredSaas;
if(!core||!core.db){console.error('MIRED360: módulo operacional sin contexto');return}
const db=core.db,$=id=>document.getElementById(id),esc=core.esc,money=core.money,dateFmt=core.dateFmt;
let branches=[],members=[],campaigns=[],calls=[],modules=[];
function org(){return core.org}
function editable(){return core.editable()}
function manage(){return ['propietario','administrador'].includes(core.currentRole())}
function owner(){return core.isOwner()}
function myBranch(){return (core.memberships.find(m=>m.organizacion_id===org()?.id)||{}).sucursal_id||null}
function branchName(id){return branches.find(x=>x.id===id)?.nombre||'Sin sucursal'}
function memberName(id){return members.find(x=>x.usuario_id===id)?.correo|| (id===core.user?.id?core.user.email||'Mi cuenta':'Colaborador')}
function active(code){return modules.some(m=>m.codigo===code&&m.activo)}
function checkWrite(code){if(!editable()){core.flash('La suscripción no permite registrar información.',true);return false}if(code&&!active(code)){core.flash('Módulo no habilitado en esta empresa.',true);return false}return true}
function empty(n,msg){return '<tr><td colspan="'+n+'" class="empty">'+esc(msg)+'</td></tr>'}
function dropdown(id,selected){
 const el=$(id);if(!el)return;
 const choices=branches.filter(b=>(b.activa||b.id===selected)&&(manage()||b.id===myBranch()));
 el.innerHTML=choices.map(b=>'<option value="'+b.id+'">'+esc(b.nombre)+'</option>').join('');
 if(selected&&choices.some(b=>b.id===selected))el.value=selected;
}
function renderCampaignSelect(selected){
 const el=$('leadCampaign');if(!el)return;
 const wanted=selected===undefined?el.value:selected;
 const branch=$('leadBranch').value;
 const options=campaigns.filter(c=>c.sucursal_id===branch&&(c.estado==='activa'||c.id===wanted));
 el.innerHTML='<option value="">Sin campaña</option>'+options.map(c=>'<option value="'+c.id+'">'+esc(c.nombre)+'</option>').join('');
 if(options.some(c=>c.id===wanted))el.value=wanted;
}
function prepareLead(lead){
 dropdown('leadBranch',lead?.sucursal_id||myBranch());
 $('leadBranch').disabled=!manage();
 renderCampaignSelect(lead?.campana_id||'');
}
async function load(){
 if(!org())return;
 const oid=org().id;
 const requests=[
  db.from('saas_sucursales').select('id,nombre,ciudad,activa,creado_en').eq('organizacion_id',oid).order('creado_en'),
  db.rpc('saas_listar_equipo',{p_org:oid}),
  db.from('saas_campanas').select('*').eq('organizacion_id',oid).order('creado_en',{ascending:false}).limit(500),
  db.from('saas_llamadas').select('*').eq('organizacion_id',oid).order('creado_en',{ascending:false}).limit(500),
  db.from('saas_modulos').select('codigo,activo').eq('organizacion_id',oid)
 ];
 const results=await Promise.all(requests);
 for(const r of results){if(r.error){core.flash('Error cargando operación: '+r.error.message,true);return}}
 if(!org()||org().id!==oid)return;
 [branches,members,campaigns,calls,modules]=results.map(r=>r.data||[]);
 dropdown('leadBranch',myBranch());dropdown('campaignBranch',myBranch());
 renderCampaignSelect('');render();
}
function render(){
 if(!org()||!$('branchRows'))return;
 const leads=core.leads||[];
 $('branchAdmin').classList.toggle('hidden',!manage()||!active('sucursales'));
 $('campaignAdmin').classList.toggle('hidden',!manage()||!active('campanas'));
 document.querySelectorAll('[data-module]').forEach(el=>el.classList.toggle('hidden',!active(el.dataset.module)));
 const labels={crm:'CRM · Clientes y ventas',sucursales:'Sucursales',equipo:'Equipo comercial',campanas:'Campañas',llamadas:'Registro de llamadas'};
 $('moduleRows').innerHTML=Object.entries(labels).map(([code,label])=>'<div class="module-item"><strong>'+esc(label)+'</strong><span class="badge '+(active(code)?'ok':'')+'">'+(active(code)?'Activo':'No contratado')+'</span></div>').join('');
 $('branchRows').innerHTML=branches.map(b=>{
  const sub=leads.filter(l=>l.sucursal_id===b.id),team=members.filter(m=>m.sucursal_id===b.id);
  return '<tr><td><b>'+esc(b.nombre)+'</b></td><td>'+esc(b.ciudad)+'</td><td><span class="badge '+(b.activa?'ok':'')+'">'+(b.activa?'Activa':'Inactiva')+'</span></td><td>'+sub.length+'</td><td>'+team.length+'</td></tr>';
 }).join('')||empty(5,'No hay sucursales registradas.');
 $('branchPerformance').innerHTML=branches.map(b=>{
  const rows=leads.filter(l=>l.sucursal_id===b.id),closed=rows.filter(l=>['Venta','Instalado'].includes(l.estado));
  return '<tr><td>'+esc(b.nombre)+'</td><td>'+rows.length+'</td><td>'+closed.length+'</td><td>'+rows.filter(l=>l.estado==='Instalado').length+'</td><td>'+money(closed.reduce((v,l)=>v+Number(l.valor_mensual||0),0))+'</td></tr>';
 }).join('')||empty(5,'No hay datos por sucursal.');
 $('advisorPerformance').innerHTML=members.map(m=>{
  const rows=leads.filter(l=>l.creado_por===m.usuario_id),closed=rows.filter(l=>['Venta','Instalado'].includes(l.estado));
  return '<tr><td>'+esc(m.correo||'Usuario')+'</td><td>'+esc(branchName(m.sucursal_id))+'</td><td>'+rows.length+'</td><td>'+closed.length+'</td><td>'+rows.filter(l=>l.estado==='Instalado').length+'</td><td>'+money(closed.reduce((v,l)=>v+Number(l.valor_mensual||0),0))+'</td></tr>';
 }).join('')||empty(6,'Sin asesores o datos disponibles.');
 const self=core.user?.id;
 $('memberRows').innerHTML=members.map(m=>{
  const picker=owner()&&m.usuario_id!==self?'<select data-assign-user="'+m.usuario_id+'" aria-label="Sucursal para '+esc(m.correo||'asesor')+'">'+branches.filter(b=>b.activa||b.id===m.sucursal_id).map(b=>'<option value="'+b.id+'" '+(b.id===m.sucursal_id?'selected':'')+'>'+esc(b.nombre)+'</option>').join('')+'</select>':esc(branchName(m.sucursal_id));
  return '<tr><td>'+esc(m.correo||'Usuario')+'</td><td>'+esc(m.rol)+'</td><td>'+picker+'</td><td>'+(owner()&&m.usuario_id!==self?'<button type="button" class="btn secondary" data-remove="'+m.usuario_id+'">Retirar</button>':m.usuario_id===self?'<span class="badge ok">Tu cuenta</span>':'Activo')+'</td></tr>';
 }).join('')||empty(4,'Sin colaboradores registrados.');
 $('campaignRows').innerHTML=campaigns.map(c=>{
  const rows=leads.filter(l=>l.campana_id===c.id);
  const button=manage()&&editable()&&c.estado!=='cerrada'?'<button type="button" class="btn secondary" data-campaign-toggle="'+c.id+'">'+(c.estado==='activa'?'Pausar':'Reactivar')+'</button>':'';
  return '<tr><td><b>'+esc(c.nombre)+'</b></td><td>'+esc(branchName(c.sucursal_id))+'</td><td>'+esc(c.canal)+'</td><td>'+money(c.presupuesto)+'</td><td>'+rows.length+'</td><td>'+rows.filter(l=>['Venta','Instalado'].includes(l.estado)).length+'</td><td>'+esc(c.estado)+' '+button+'</td></tr>';
 }).join('')||empty(7,'Registra tu primera campaña.');
 const pick=$('callLead'),prev=pick.value;
 pick.innerHTML='<option value="">Selecciona un prospecto</option>'+leads.map(l=>'<option value="'+l.id+'">'+esc(l.nombre)+' · '+esc(branchName(l.sucursal_id))+'</option>').join('');
 if(leads.some(l=>l.id===prev))pick.value=prev;
 $('callRows').innerHTML=calls.map(c=>{
  const l=leads.find(v=>v.id===c.prospecto_id);
  return '<tr><td>'+dateFmt(c.creado_en)+'</td><td>'+esc(l?.nombre||'Prospecto')+'</td><td>'+esc(memberName(c.usuario_id))+'</td><td>'+esc(c.resultado)+'</td><td>'+dateFmt(c.siguiente_contacto)+'</td><td>'+esc(c.detalle)+'</td></tr>';
 }).join('')||empty(6,'Todavía no hay llamadas registradas.');
}
function reset(){branches=[];members=[];campaigns=[];calls=[];modules=[];render()}
async function refreshAll(){await load()}
async function addBranch(e){
 e.preventDefault();if(!checkWrite('sucursales')||!manage())return;
 const name=$('branchName').value.trim(),ciudad=$('branchCity').value.trim();
 $('branchSubmit').disabled=true;
 try{
  const {error}=await db.from('saas_sucursales').insert({organizacion_id:org().id,nombre,ciudad});
  if(error)throw error;
  $('branchForm').reset();await refreshAll();core.flash('Sucursal creada.');
 }catch(err){core.flash(err.message,true)}
 finally{$('branchSubmit').disabled=false}
}
async function assignBranch(uid,bid){
 if(!owner()||!checkWrite('sucursales'))return;
 const {data,error}=await db.rpc('saas_asignar_sucursal',{p_org:org().id,p_usuario:uid,p_sucursal:bid});
 if(error||!data)return core.flash(error?.message||'No se pudo cambiar la sucursal.',true);
 await refreshAll();core.flash('Colaborador asignado a la sucursal.');
}
async function addCampaign(e){
 e.preventDefault();if(!checkWrite('campanas')||!manage())return;
 const payload={organizacion_id:org().id,sucursal_id:$('campaignBranch').value,nombre:$('campaignName').value.trim(),canal:$('campaignChannel').value,presupuesto:Number($('campaignBudget').value||0),estado:'activa',creado_por:core.user.id};
 if(!payload.sucursal_id||!payload.nombre||payload.presupuesto<0)return core.flash('Revisa los datos de la campaña.',true);
 $('campaignSubmit').disabled=true;
 try{
  const {error}=await db.from('saas_campanas').insert(payload);
  if(error)throw error;
  $('campaignForm').reset();await refreshAll();core.flash('Campaña comercial registrada.');
 }catch(err){core.flash(err.message,true)}
 finally{$('campaignSubmit').disabled=false}
}
async function toggleCampaign(id){
 if(!checkWrite('campanas')||!manage())return;
 const c=campaigns.find(x=>x.id===id);if(!c)return;
 const estado=c.estado==='activa'?'pausada':'activa';
 const {data,error}=await db.from('saas_campanas').update({estado}).eq('id',id).eq('organizacion_id',org().id).select('id').maybeSingle();
 if(error||!data)return core.flash(error?.message||'No se pudo actualizar.',true);
 await refreshAll();core.flash('Campaña '+(estado==='activa'?'reactivada.':'pausada.'));
}
async function addCall(e){
 e.preventDefault();if(!checkWrite('llamadas'))return;
 const lead=core.leads.find(l=>l.id===$('callLead').value);
 if(!lead)return core.flash('Selecciona un prospecto.',true);
 const data={organizacion_id:org().id,sucursal_id:lead.sucursal_id,prospecto_id:lead.id,usuario_id:core.user.id,resultado:$('callOutcome').value,detalle:$('callDetails').value.trim(),siguiente_contacto:$('callNext').value||null};
 $('callSubmit').disabled=true;
 try{
  const {error}=await db.from('saas_llamadas').insert(data);
  if(error)throw error;
  $('callForm').reset();await refreshAll();
  if(data.siguiente_contacto){
   const {data:updated,error:followErr}=await db.from('saas_prospectos').update({proximo_seguimiento:data.siguiente_contacto,actualizado_en:new Date().toISOString()}).eq('organizacion_id',org().id).eq('id',lead.id).select('id').maybeSingle();
   if(followErr||!updated)core.flash('Llamada guardada; el seguimiento del prospecto requiere permiso de edición.',true);
   else core.flash('Llamada y próximo seguimiento registrados.');
  }else core.flash('Llamada registrada en el historial.');
 }catch(err){core.flash(err.message,true)}
 finally{$('callSubmit').disabled=false}
}
function events(){
 $('branchForm').addEventListener('submit',addBranch);
 $('campaignForm').addEventListener('submit',addCampaign);
 $('callForm').addEventListener('submit',addCall);
 $('leadBranch').addEventListener('change',()=>renderCampaignSelect(''));
 $('refreshPerformance').addEventListener('click',async()=>{await refreshAll();core.flash('Indicadores actualizados.');});
 document.addEventListener('click',e=>{
  const t=e.target.closest('[data-campaign-toggle]');
  if(t)toggleCampaign(t.dataset.campaignToggle);
 });
 document.addEventListener('change',e=>{
  const t=e.target.closest('[data-assign-user]');
  if(t)assignBranch(t.dataset.assignUser,t.value);
 });
}
window.MiredSaasOps={load,reset,render,prepareLead,branchName,memberName,active};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',events);
else events();
})();
