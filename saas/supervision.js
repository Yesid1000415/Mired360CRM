/* MIRED360 CRM Empresas · Reporte gerencial de Call Center
   Datos agregados de Supabase, control de acceso por rol y módulo. */
(function(){
'use strict';
const core=window.MiredSaas;
if(!core||!core.db)return;
const $=id=>document.getElementById(id), db=core.db, esc=core.esc;
const n=v=>Number(v)||0, fmt=v=>n(v).toLocaleString('es-CO');
let report=null,people=[],agenda=[],agendaError='',period='mes',sequence=0,company=null;
function manager(){return ['propietario','administrador'].includes(core.currentRole())}
function active(){return !!window.MiredSaasOps?.active('llamadas')}
function fmtDay(date){return new Intl.DateTimeFormat('es-CO',{timeZone:'UTC',day:'2-digit',month:'short'}).format(new Date(date+'T12:00:00Z'))}
function coDate(){
 const parts=new Intl.DateTimeFormat('en-US',{timeZone:'America/Bogota',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
 const p=Object.fromEntries(parts.map(x=>[x.type,x.value]));
 return p.year+'-'+p.month+'-'+p.day;
}
function dateShift(date,days){
 const d=new Date(date+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+days);return d.toISOString().slice(0,10);
}
function presetDates(key){
 const today=coDate();
 if(key==='hoy')return [today,today];
 if(key==='semana')return [dateShift(today,-6),today];
 if(key==='mes')return [today.slice(0,8)+'01',today];
 if(key==='treinta')return [dateShift(today,-29),today];
 return [$('ccSupStart').value,$('ccSupEnd').value];
}
function fullName(id){
 const p=people.find(x=>x.usuario_id===id);
 return p?.correo || (id===core.user?.id?core.user.email||'Mi usuario':id?'Usuario registrado':'Sin asignar');
}
function blank(cols,label){return '<tr><td colspan="'+cols+'" class="empty">'+esc(label)+'</td></tr>'}
function metric(label,value,sub){
 return '<div class="cc-sup-metric"><small>'+esc(label)+'</small><strong>'+fmt(value)+'</strong><span>'+esc(sub)+'</span></div>';
}
function escapeCsv(v){return '"'+String(v==null?'':v).replace(/"/g,'""').replace(/[\r\n]+/g,' ')+'"'}
function rowsToCsv(rows){return '\uFEFF'+rows.map(row=>row.map(escapeCsv).join(';')).join('\r\n')}
function csvExport(){
 if(!report)return core.flash('Primero consulta los datos de supervisión.',true);
 const lines=[['MIRED360 · Supervisión Call Center','Desde','Hasta'],['',report.desde,report.hasta],
  ['RESUMEN','Cantidad'],...Object.entries(report.summary||{}).map(x=>x),
  [],['ASESOR','Gestiones','Contactos únicos','Interesados','Seguimientos','Sin respuesta','Ventas'],
  ...((report.asesores||[]).map(a=>[fullName(a.usuario_id),a.gestiones,a.contactos,a.interesados,a.seguimientos,a.sin_respuesta,a.ventas])),
  [],['EXTENSIÓN','Asesor actual','Gestiones','Contactos únicos','Ventas','Meta mensual'],
  ...((report.extensiones||[]).map(e=>[e.codigo,fullName(e.usuario_id),e.gestiones,e.contactos,e.ventas,e.meta])),
  [],['DÍA','Gestiones','Contactos únicos','Ventas'],
  ...((report.dias||[]).map(d=>[d.dia,d.gestiones,d.contactos,d.ventas])),
  [],['BASE','Total','Gestionados actuales','Pendientes actuales','Ventas actuales','Seguimientos vencidos'],
  ...((report.bases||[]).map(b=>[b.nombre,b.total,b.gestionados,b.pendientes,b.ventas,b.vencidos]))
 ];
 const blob=new Blob([rowsToCsv(lines)],{type:'text/csv;charset=utf-8'});
 const url=URL.createObjectURL(blob),a=document.createElement('a');
 a.href=url;a.download='mired360-supervision-'+report.desde+'-'+report.hasta+'.csv';
 document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);
}
function render(){
 if(!report||!company||core.org?.id!==company)return;
 const summary=report.summary||{};
 $('ccSupMetrics').innerHTML=[
  metric('Gestiones del período',summary.gestiones,'Llamadas registradas por los asesores'),
  metric('Contactos atendidos',summary.contactos_gestionados,'Clientes únicos contactados en el período'),
  metric('Interesados',summary.interesados,'Clientes con resultado Interesado'),
  metric('Ventas',summary.ventas,'Clientes únicos con resultado Venta'),
  metric('Sin respuesta',summary.sin_respuesta,'Gestiones sin contacto'),
  metric('Seguimientos vencidos',summary.seguimientos_vencidos,'En todas las bases, a fecha de hoy'),
  metric('Próximos 7 días',summary.seguimientos_proximos,'Seguimientos actuales programados'),
  metric('Pendientes sin gestionar',summary.pendientes,'Contactos con estado Pendiente en la empresa')
 ].join('');
 const byUser=new Map((report.asesores||[]).map(a=>[a.usuario_id,a]));
 const allPeople=people.length?people:[...(report.asesores||[])].map(a=>({usuario_id:a.usuario_id}));
 $('ccSupAdvisorRows').innerHTML=allPeople.map(p=>{
  const a=byUser.get(p.usuario_id)||{},total=n(a.contactos),sales=n(a.ventas);
  const rate=total?Math.round(sales/total*100):0;
  return '<tr><td><b>'+esc(fullName(p.usuario_id))+'</b></td><td>'+fmt(a.gestiones)+'</td><td>'+fmt(total)+'</td><td>'+fmt(a.interesados)+'</td><td>'+fmt(a.seguimientos)+'</td><td>'+fmt(a.sin_respuesta)+'</td><td>'+fmt(sales)+'</td><td>'+rate+'%</td></tr>';
 }).join('')||blank(8,'Todavía no hay colaboradores.');
 const showGoal=period==='mes';
 $('ccSupExtRows').innerHTML=(report.extensiones||[]).map(e=>{
  const percentage=e.meta?Math.round(n(e.ventas)/n(e.meta)*100):0;
  const bar=Math.min(100,percentage);
  const goal=showGoal?'<b>'+fmt(e.ventas)+' / '+fmt(e.meta)+'</b><div class="cc-sup-progress"><span style="width:'+bar+'%"></span></div><small>'+percentage+'%</small>':
   '<span class="muted">Meta mensual '+fmt(e.meta)+' · selecciona «Este mes» para medirla</span>';
  return '<tr><td><b>'+esc(e.codigo)+'</b></td><td>'+esc(fullName(e.usuario_id))+'</td><td>'+fmt(e.gestiones)+'</td><td>'+fmt(e.contactos)+'</td><td>'+fmt(e.ventas)+'</td><td>'+goal+'</td></tr>';
 }).join('')||blank(6,'Aún no hay extensiones configuradas.');
 const maxDay=Math.max(1,...(report.dias||[]).map(x=>n(x.gestiones)));
 $('ccSupDayRows').innerHTML=(report.dias||[]).map(d=>{
  const width=Math.max(2,Math.round(n(d.gestiones)/maxDay*100));
  return '<tr><td>'+esc(fmtDay(d.dia))+'</td><td>'+fmt(d.gestiones)+'</td><td><div class="cc-sup-bar"><span style="width:'+width+'%"></span></div></td><td>'+fmt(d.contactos)+'</td><td>'+fmt(d.ventas)+'</td></tr>';
 }).join('')||blank(5,'No hay gestiones registradas durante este período.');
 const allResults=['Sin respuesta','Contactado','Interesado','Seguimiento','Venta','No interesado'];
 const resultMap=new Map((report.resultados||[]).map(r=>[r.resultado,n(r.total)]));
 const maxResults=Math.max(1,...allResults.map(x=>resultMap.get(x)||0));
 $('ccSupOutcomeRows').innerHTML=allResults.map(name=>{
  const count=resultMap.get(name)||0;
  return '<tr><td>'+esc(name)+'</td><td>'+fmt(count)+'</td><td><div class="cc-sup-bar"><span style="width:'+(count?Math.max(2,Math.round(count/maxResults*100)):0)+'%"></span></div></td></tr>';
 }).join('');
 $('ccSupBaseRows').innerHTML=(report.bases||[]).map(b=>{
  const total=n(b.total),pct=total?Math.round(n(b.gestionados)/total*100):0;
  return '<tr><td><b>'+esc(b.nombre)+'</b><br><small>'+esc(b.estado)+'</small></td><td>'+esc(fullName(b.asignado_a))+'</td><td>'+fmt(total)+'</td><td>'+fmt(b.gestionados)+'</td><td>'+fmt(b.pendientes)+'</td><td>'+fmt(b.ventas)+'</td><td>'+fmt(b.vencidos)+'</td><td><b>'+pct+'%</b><div class="cc-sup-progress"><span style="width:'+Math.min(pct,100)+'%"></span></div></td></tr>';
 }).join('')||blank(8,'No hay bases en esta empresa.');
 const today=coDate(),bases=new Map((report.bases||[]).map(b=>[b.id,b]));
 const scheduled=agenda.filter(c=>bases.get(c.base_id)?.estado==='activa');
 $('ccSupFollowupRows').innerHTML=scheduled.map(c=>{
  const base=bases.get(c.base_id),late=c.proxima_llamada<today;
  const due=late?'Vencido':c.proxima_llamada===today?'Hoy':'Próximo';
  const phone=String(c.telefono||'').replace(/[^\d+]/g,'');
  return '<tr><td><b>'+esc(c.proxima_llamada)+'</b><br><small class="'+(late?'cc-sup-overdue':'')+'">'+due+'</small></td>'+
   '<td><b>'+esc(c.nombre)+'</b><br><small>'+esc(c.ciudad||'')+'</small></td>'+
   '<td>'+esc(base?.nombre||'Base')+'</td><td>'+esc(fullName(base?.asignado_a))+'</td><td>'+esc(c.estado)+'</td>'+
   '<td><a class="btn secondary" href="tel:'+encodeURIComponent(phone)+'">Llamar</a> '+
   '<button type="button" class="btn primary" data-cc-followup-contact="'+esc(c.id)+'" data-cc-followup-base="'+esc(c.base_id)+'">Gestionar</button></td></tr>';
 }).join('')||blank(6,'No hay seguimientos vencidos o próximos en las bases activas.');
 $('ccSupFollowupInfo').textContent=agendaError?
  'No se pudo consultar la agenda: '+agendaError:
  'Muestra hasta 100 contactos próximos o vencidos de bases activas, ordenados por fecha. Agenda vigente a hoy, sin depender del período seleccionado.';
 $('ccSupCount').textContent='Datos del '+report.desde+' al '+report.hasta+' · '+fmt(summary.bases)+' bases · '+fmt(summary.contactos)+' contactos en cartera.';
 $('ccSupExport').disabled=false;
}
function setPeriod(key){
 period=key;
 const dates=presetDates(key);
 $('ccSupStart').value=dates[0];$('ccSupEnd').value=dates[1];
 document.querySelectorAll('[data-cc-period]').forEach(b=>b.classList.toggle('active',b.dataset.ccPeriod===key));
}
async function refresh(){
 if(!manager()||!active()||!core.org)return;
 const from=$('ccSupStart').value,to=$('ccSupEnd').value;
 if(!from||!to||from>to)return core.flash('Selecciona un rango de fechas válido.',true);
 const days=(Date.parse(to+'T00:00:00Z')-Date.parse(from+'T00:00:00Z'))/86400000;
 if(!Number.isFinite(days)||days>366)return core.flash('El rango máximo es de 367 días.',true);
 const orgId=core.org.id,seq=++sequence;
 $('ccSupStatus').textContent='Actualizando indicadores…';
 $('ccSupRefresh').disabled=true;
 try{
  const [result,teamResult,followupResult]=await Promise.all([
   db.rpc('saas_cc_reporte_gerencia',{p_org:orgId,p_desde:from,p_hasta:to}),
   db.rpc('saas_listar_equipo',{p_org:orgId}),
   db.from('saas_cc_contactos')
    .select('id,base_id,nombre,telefono,ciudad,estado,proxima_llamada')
    .eq('organizacion_id',orgId).not('proxima_llamada','is',null)
    .lte('proxima_llamada',dateShift(coDate(),7))
    .in('estado',['Pendiente','Sin respuesta','Contactado','Interesado','Seguimiento'])
    .order('proxima_llamada',{ascending:true}).limit(100)
  ]);
  if(seq!==sequence||core.org?.id!==orgId)return;
  if(result.error)throw result.error;
  if(teamResult.error)throw teamResult.error;
  company=orgId;report=result.data;people=teamResult.data||[];agenda=followupResult.data||[];agendaError=followupResult.error?.message||'';
  render();
  $('ccSupStatus').textContent='Actualizado. Indicadores calculados desde las gestiones guardadas; no son registros de la central IP.';
 }catch(err){
  if(seq!==sequence)return;
  $('ccSupStatus').textContent='No se pudo consultar la supervisión: '+(err?.message||err);
  core.flash(err?.message||String(err),true);
 }finally{if(seq===sequence)$('ccSupRefresh').disabled=false}
}
function reset(){
 sequence++;report=null;people=[];agenda=[];agendaError='';company=null;period='mes';
 for(const id of ['ccSupMetrics','ccSupAdvisorRows','ccSupExtRows','ccSupDayRows','ccSupOutcomeRows','ccSupBaseRows','ccSupFollowupRows'])if($(id))$(id).innerHTML='';
 if($('ccSupStatus'))$('ccSupStatus').textContent='';
 if($('ccSupExport'))$('ccSupExport').disabled=true;
}
async function load(){
 const permitted=manager()&&active();
 document.querySelectorAll('[data-page="supervision"]').forEach(el=>el.classList.toggle('hidden',!permitted));
 if(!permitted){reset();return}
 if(!company||company!==core.org.id||!$('ccSupStart').value){setPeriod('mes')}
 await refresh();
}
function events(){
 for(const b of document.querySelectorAll('[data-cc-period]'))b.addEventListener('click',()=>{setPeriod(b.dataset.ccPeriod);refresh()});
 $('ccSupRefresh').addEventListener('click',()=>{if(period!=='personalizado'&&
 ( $('ccSupStart').value!==presetDates(period)[0]||$('ccSupEnd').value!==presetDates(period)[1]))period='personalizado';refresh()});
 $('ccSupStart').addEventListener('change',()=>{period='personalizado';document.querySelectorAll('[data-cc-period]').forEach(b=>b.classList.remove('active'))});
 $('ccSupEnd').addEventListener('change',()=>{period='personalizado';document.querySelectorAll('[data-cc-period]').forEach(b=>b.classList.remove('active'))});
 $('ccSupExport').addEventListener('click',csvExport);
 document.addEventListener('click',e=>{
  const follow=e.target.closest('[data-cc-followup-contact]');
  if(follow&&manager()&&active()){
   document.querySelector('[data-page="callcenter"]')?.click();
   window.MiredSaasCallCenter?.openContactFromSupervisor(follow.dataset.ccFollowupBase,follow.dataset.ccFollowupContact);
  }
  if(e.target.closest('[data-page="supervision"],[data-go="supervision"]')&&manager()&&active()&&company===core.org?.id)
    refresh();
 });
}
window.MiredSaasSupervisor={reset,load,refresh};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',events);else events();
})();
