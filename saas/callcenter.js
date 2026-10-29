/* MIRED360 CRM Empresas · Call Center por empresa y sucursal
   Base de contactos y gestiones persistentes. Marcación directa sólo mediante tel: del dispositivo. */
(function(){
'use strict';
const core=window.MiredSaas;
if(!core||!core.db)return;
const db=core.db, $=id=>document.getElementById(id), esc=core.esc;
let orgId=null,bases=[],extensions=[],team=[],contacts=[],history=[],monthResults=[],selected='',page=0,refreshSeq=0;
const PAGE=60,MAX_CONTACTS=20000;
function org(){return core.org}
function manager(){return ['propietario','administrador'].includes(core.currentRole())}
function checkWrite(){if(!core.editable()){core.flash('No hay suscripción vigente para modificar datos.',true);return false}if(!window.MiredSaasOps?.active('llamadas')){core.flash('Call Center no está habilitado para esta empresa.',true);return false}return true}
function baseName(id){return bases.find(b=>b.id===id)?.nombre||'Base'}
function teamName(id){return team.find(m=>m.usuario_id===id)?.correo || (id===core.user?.id?core.user.email||'Mi cuenta':'Sin asesor')}
function branchName(id){return window.MiredSaasOps?.branchName(id)||'Sucursal'}
function option(value,label,selectedValue){return '<option value="'+esc(value)+'"'+(value===selectedValue?' selected':'')+'>'+esc(label)+'</option>'}
function empty(n,msg){return '<tr><td colspan="'+n+'" class="empty">'+esc(msg)+'</td></tr>'}
function dropdown(id,opts,selectedValue,emptyLabel){
 const el=$(id);if(!el)return;
 el.innerHTML=(emptyLabel!==undefined?option('',emptyLabel,selectedValue):'')+opts.map(o=>option(o.value,o.label,selectedValue)).join('');
}
function reset(){
 refreshSeq++;orgId=null;bases=[];extensions=[];team=[];contacts=[];history=[];monthResults=[];selected='';page=0;
 for(const id of ['ccMetrics','ccExtRows','ccBaseRows','ccContactRows','ccHistoryRows','ccPagination']){if($(id))$(id).innerHTML=''}
}
async function load(){
 if(!org())return;
 const current=org().id,seq=++refreshSeq;
 const queries=[
  db.from('saas_cc_bases').select('id,organizacion_id,sucursal_id,nombre,estado,asignado_a,extension_id,creado_en').eq('organizacion_id',current).order('creado_en',{ascending:false}),
  db.from('saas_cc_extensiones').select('id,sucursal_id,codigo,usuario_id,meta_mensual').eq('organizacion_id',current).order('codigo'),
  db.rpc('saas_listar_equipo',{p_org:current})
 ];
 let data;
 try{data=await Promise.all(queries)}catch(e){core.flash('Call Center: '+e.message,true);return}
 if(seq!==refreshSeq||org()?.id!==current)return;
 if(data.some(x=>x.error)){core.flash('Call Center: '+data.find(x=>x.error).error.message,true);return}
 orgId=current;[bases,extensions,team]=data.map(x=>x.data||[]);
 $('ccSetupArea').classList.toggle('hidden',!manager());
 $('ccAssignCard').classList.toggle('hidden',!manager());
 $('ccImportCard').classList.toggle('hidden',!manager());
 const branches=(await db.from('saas_sucursales').select('id,nombre,activa').eq('organizacion_id',current)).data||[];
 if(seq!==refreshSeq||org()?.id!==current)return;
 const scoped=branches.filter(b=>b.activa&&(manager()||b.id===core.memberships.find(m=>m.organizacion_id===current)?.sucursal_id));
 const items=scoped.map(b=>({value:b.id,label:b.nombre}));
 dropdown('ccBaseBranch',items,items[0]?.value);
 dropdown('ccExtBranch',items,items[0]?.value);
 refreshAssignmentOptions();
 const available=bases.map(b=>({value:b.id,label:b.nombre+' · '+branchName(b.sucursal_id)}));
 dropdown('ccWorkBase',available,selected);
 dropdown('ccAssignBase',available,selected);
 dropdown('ccImportBase',available,selected);
 if(!bases.some(b=>b.id===selected))selected=bases[0]?.id||'';
 $('ccWorkBase').value=selected;$('ccAssignBase').value=selected;$('ccImportBase').value=selected;
 refreshAssignmentOptions();
 await loadMonthResults(seq);
 if(seq!==refreshSeq)return;
 renderLists();await loadContacts();
}
async function loadMonthResults(seq){
 if(!org())return;
 const first=new Date(),start=new Date(Date.UTC(first.getFullYear(),first.getMonth(),1)).toISOString();
 const {data,error}=await db.from('saas_cc_gestiones').select('usuario_id,resultado,creado_en').eq('organizacion_id',orgId).gte('creado_en',start).eq('resultado','Venta').order('creado_en',{ascending:false}).limit(5000);
 if(seq!==refreshSeq)return;
 if(error){monthResults=[];return}
 monthResults=data||[];
}
function refreshAssignmentOptions(){
 const br=$('ccExtBranch').value;
 const advisers=team.filter(m=>m.sucursal_id===br).map(m=>({value:m.usuario_id,label:m.correo}));
 dropdown('ccExtAdvisor',advisers,'','Sin asignar');
 const base=bases.find(x=>x.id===$('ccAssignBase').value);
 const members=team.filter(m=>m.sucursal_id===base?.sucursal_id).map(m=>({value:m.usuario_id,label:m.correo}));
 dropdown('ccAssignAdvisor',members,base?.asignado_a||'','Sin asignar');
 refreshExtensionOptions();
}
function refreshExtensionOptions(){
 const base=bases.find(x=>x.id===$('ccAssignBase').value);
 const assigned=$('ccAssignAdvisor').value;
 const ext=extensions.filter(e=>e.sucursal_id===base?.sucursal_id&&(assigned?e.usuario_id===assigned:!e.usuario_id))
 .map(e=>({value:e.id,label:'Ext. '+e.codigo}));
 dropdown('ccAssignExt',ext,base?.extension_id||'','Sin extensión');
}
function renderLists(){
 if(!org())return;
 $('ccExtRows').innerHTML=extensions.map(e=>'<tr><td><b>'+esc(e.codigo)+'</b></td><td>'+esc(branchName(e.sucursal_id))+'</td><td>'+esc(teamName(e.usuario_id))+'</td><td>'+e.meta_mensual+'</td></tr>').join('')||empty(4,'Sin extensiones configuradas.');
 $('ccBaseRows').innerHTML=bases.map(b=>{
  const e=extensions.find(e=>e.id===b.extension_id);
  return '<tr><td><b>'+esc(b.nombre)+'</b></td><td>'+esc(branchName(b.sucursal_id))+'</td><td>'+esc(teamName(b.asignado_a))+'</td><td>'+esc(e?.codigo||'—')+'</td><td>'+esc(b.estado)+'</td><td><button type="button" class="btn secondary" data-cc-base="'+b.id+'">Trabajar base</button></td></tr>';
 }).join('')||empty(6,manager()?'Crea una base para comenzar.':'Todavía no te han asignado una base.');
 const n=contacts.length,worked=contacts.filter(x=>x.estado!=='Pendiente').length,sold=contacts.filter(x=>x.estado==='Venta').length,
 pending=contacts.filter(x=>x.proxima_llamada&&x.estado!=='Venta').length;
 const metric=(name,val,desc)=>'<div class="metric"><small>'+esc(name)+'</small><strong>'+val+'</strong><em>'+esc(desc)+'</em></div>';
 $('ccMetrics').innerHTML=metric('Bases disponibles',bases.length,'Acceso autorizado')+
 metric('Contactos de esta base',n,'Máximo '+MAX_CONTACTS+' consultados')+
 metric('Gestionados',worked,'Resultados guardados')+metric('Ventas',sold,'Estado final Venta')+
 metric('Próximas llamadas',pending,'Con fecha registrada');
 if($('ccExtPerformanceRows')){
  $('ccExtPerformanceRows').innerHTML=extensions.map(e=>{
   const sold=monthResults.filter(x=>x.usuario_id===e.usuario_id&&e.usuario_id).length;
   return '<tr><td>'+esc(e.codigo)+'</td><td>'+esc(teamName(e.usuario_id))+'</td><td>'+sold+'</td><td>'+e.meta_mensual+'</td><td>'+Math.round(sold/e.meta_mensual*100)+'%</td></tr>';
  }).join('')||empty(5,'Sin extensiones registradas.');
 }
}
async function loadContacts(){
 if(!orgId)return;
 const baseId=selected,seq=++refreshSeq;
 page=0;contacts=[];history=[];renderLists();renderContacts();
 if(!baseId)return;
 let offset=0;
 try{
  while(offset<MAX_CONTACTS){
   const {data,error}=await db.from('saas_cc_contactos').select('id,nombre,telefono,ciudad,estado,proxima_llamada,observaciones,base_id').eq('organizacion_id',orgId).eq('base_id',baseId).order('creado_en',{ascending:false}).range(offset,offset+499);
   if(error)throw error;if(seq!==refreshSeq||selected!==baseId)return;
   contacts.push(...(data||[]));if(!data||data.length<500)break;offset+=500;
  }
  const {data,error}=await db.from('saas_cc_gestiones').select('id,contacto_id,usuario_id,resultado,notas,proxima_llamada,creado_en').eq('organizacion_id',orgId).eq('base_id',baseId).order('creado_en',{ascending:false}).limit(100);
  if(error)throw error;
  if(seq!==refreshSeq||selected!==baseId)return;
  history=data||[];
  renderLists();renderContacts();
 }catch(err){core.flash('No fue posible consultar la base: '+err.message,true)}
}
function renderContacts(){
 if(!$('ccContactRows'))return;
 const search=$('ccSearch').value.trim().toLocaleLowerCase('es'),state=$('ccStateFilter').value;
 const rows=contacts.filter(c=>(!state||c.estado===state)&&(!search||(c.nombre+' '+c.telefono+' '+c.ciudad).toLocaleLowerCase('es').includes(search)));
 const maxPage=Math.max(0,Math.ceil(rows.length/PAGE)-1);page=Math.min(maxPage,page);
 const slice=rows.slice(page*PAGE,(page+1)*PAGE);
 $('ccContactRows').innerHTML=slice.map(c=>{
  const number=c.telefono.replace(/[^\d+]/g,'');
  return '<tr><td><b>'+esc(c.nombre)+'</b></td><td>'+esc(c.telefono)+'</td><td>'+esc(c.ciudad)+'</td><td>'+esc(c.estado)+'</td><td>'+core.dateFmt(c.proxima_llamada)+'</td><td class="cc-actions"><a class="btn secondary" href="tel:'+encodeURIComponent(number)+'">Llamar</a> <button type="button" class="btn primary" data-cc-manage="'+c.id+'">Gestionar</button></td></tr>'
 }).join('')||empty(6,'No hay contactos disponibles con este filtro.');
 $('ccPagination').innerHTML='<span>'+rows.length+' contactos · Página '+(page+1)+' / '+(maxPage+1)+'</span> '+
 '<button class="btn secondary" type="button" data-cc-page="-1" '+(!page?'disabled':'')+'>Anterior</button> '+
 '<button class="btn secondary" type="button" data-cc-page="1" '+(page>=maxPage?'disabled':'')+'>Siguiente</button>';
 const existing=$('ccManageContact').value;
 const pick=contacts.find(x=>x.id===existing);
 $('ccManageContact').innerHTML='<option value="">Selecciona un contacto desde la tabla</option>'+(pick?option(pick.id,pick.nombre,pick.id):'');
 $('ccHistoryRows').innerHTML=history.map(h=>{
  const c=contacts.find(v=>v.id===h.contacto_id);
  return '<tr><td>'+core.dateFmt(h.creado_en)+'</td><td>'+esc(c?.nombre||'Cliente')+'</td><td>'+esc(teamName(h.usuario_id))+'</td><td>'+esc(h.resultado)+'</td><td>'+core.dateFmt(h.proxima_llamada)+'</td><td>'+esc(h.notas)+'</td></tr>';
 }).join('')||empty(6,'Sin gestiones todavía.');
}
function manageContact(id){
 const c=contacts.find(x=>x.id===id);if(!c)return;
 $('ccManageContact').innerHTML=option('', 'Selecciona un contacto', '')+option(c.id,c.nombre,c.id);
 $('ccManageResult').value=c.estado==='Pendiente'?'Contactado':c.estado;
 $('ccManageNext').value=c.proxima_llamada||'';
 $('ccManageNotes').value=c.observaciones||'';
 $('ccManageSave').scrollIntoView({behavior:'smooth',block:'center'});
}
async function submitManage(e){
 e.preventDefault();if(!checkWrite())return;
 const id=$('ccManageContact').value;if(!contacts.some(c=>c.id===id))return core.flash('Selecciona un contacto de tu base.',true);
 $('ccManageSave').disabled=true;
 try{
  const {error}=await db.rpc('saas_cc_registrar_gestion',{p_org:orgId,p_contacto:id,p_resultado:$('ccManageResult').value,p_notas:$('ccManageNotes').value.trim(),p_proxima:$('ccManageNext').value||null});
  if(error)throw error;
  $('ccManageForm').reset();await loadContacts();core.flash('Gestión registrada y guardada en historial.');
 }catch(err){core.flash(err.message,true)}
 finally{$('ccManageSave').disabled=false}
}
async function createBase(e){
 e.preventDefault();if(!manager()||!checkWrite())return;
 if(!$('ccBaseAuthorization').checked)return core.flash('Confirma la autorización para los datos.',true);
 $('ccBaseCreate').disabled=true;
 try{
  const {data,error}=await db.from('saas_cc_bases').insert({
   organizacion_id:orgId,sucursal_id:$('ccBaseBranch').value,nombre:$('ccBaseName').value.trim(),
   autorizacion_declarada:true,creado_por:core.user.id}).select('id').single();
  if(error)throw error;
  selected=data.id;$('ccBaseForm').reset();await load();core.flash('Base creada. Ya puedes importar contactos.');
 }catch(err){core.flash(err.message,true)}
 finally{$('ccBaseCreate').disabled=false}
}
async function saveExtension(e){
 e.preventDefault();if(!manager()||!checkWrite())return;
 $('ccExtSave').disabled=true;
 try{
  const {error}=await db.rpc('saas_cc_guardar_extension',{p_org:orgId,p_sucursal:$('ccExtBranch').value,p_codigo:$('ccExtCode').value.trim(),p_usuario:$('ccExtAdvisor').value||null,p_meta:Number($('ccExtTarget').value)});
  if(error)throw error;
  $('ccExtForm').reset();await load();core.flash('Extensión y meta guardadas.');
 }catch(err){core.flash(err.message,true)}
 finally{$('ccExtSave').disabled=false}
}
async function assignBase(e){
 e.preventDefault();if(!manager()||!checkWrite())return;
 $('ccAssignSave').disabled=true;
 try{
  const {error}=await db.rpc('saas_cc_asignar_base',{p_org:orgId,p_base:$('ccAssignBase').value,p_usuario:$('ccAssignAdvisor').value||null,p_extension:$('ccAssignExt').value||null});
  if(error)throw error;
  await load();core.flash('Base asignada. El asesor podrá verla en su cuenta.');
 }catch(err){core.flash(err.message,true)}
 finally{$('ccAssignSave').disabled=false}
}
function delimiterOf(first){
 const chars=[',',';','\t'],freq=chars.map(ch=>{
  let quote=false,n=0;for(let i=0;i<first.length;i++){const c=first[i];if(c==='"')quote=!quote;if(c===ch&&!quote)n++}
  return n;
 });
 const best=Math.max(...freq);return best?chars[freq.indexOf(best)]:',';
}
function parseCsv(text){
 const line=(text.replace(/^\uFEFF/,'').split(/\r?\n/,1)[0]||''),sep=delimiterOf(line),rows=[];
 let cell='',row=[],quoted=false;
 for(let i=0;i<text.length;i++){
  const c=text[i];
  if(c==='"'){if(quoted&&text[i+1]==='"'){cell+='"';i++}else quoted=!quoted}
  else if(c===sep&&!quoted){row.push(cell.trim());cell=''}
  else if((c==='\n'||c==='\r')&&!quoted){
   if(c==='\r'&&text[i+1]==='\n')i++;
   row.push(cell.trim());cell='';if(row.some(v=>v))rows.push(row);row=[];
  }else cell+=c;
 }
 if(quoted)throw Error('El archivo tiene comillas sin cerrar.');
 row.push(cell.trim());if(row.some(v=>v))rows.push(row);
 return rows;
}
function normalizeHeader(v){return String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9]/g,'').toLowerCase()}
function mapCsv(rows){
 if(rows.length<2)throw Error('El archivo no tiene encabezados y contactos.');
 const headers=rows[0].map(normalizeHeader);
 const idx=(names)=>headers.findIndex(x=>names.includes(x));
 const name=idx(['nombre','nombres','cliente','fullname','nombrecompleto','razonsocial']),phone=idx(['telefono','celular','movil','telefono1','cel','numero','phone','contacto']);
 const city=idx(['ciudad','municipio','city']),notes=idx(['observaciones','nota','notas','comentarios','barrio','direccion']);
 if(name<0||phone<0)throw Error('El archivo debe tener columnas «nombre» y «telefono» o «celular».');
 const result=[],seen=new Set();let invalid=0,dupes=0;
 for(const row of rows.slice(1)){
  const n=String(row[name]||'').trim(),tel=String(row[phone]||'').trim().replace(/[^\d+]/g,'');
  const key=tel.replace(/\D/g,'');
  if(n.length<2||tel.length<7||tel.length>32||key.length<7){invalid++;continue}
  if(seen.has(key)){dupes++;continue}
  seen.add(key);result.push({nombre:n.slice(0,150),telefono:tel,ciudad:city>=0?String(row[city]||'').slice(0,110):'',observaciones:notes>=0?String(row[notes]||'').slice(0,1000):''});
 }
 if(!result.length)throw Error('No se encontraron teléfonos y nombres válidos.');
 return {result,invalid,dupes};
}
async function importContacts(e){
 e.preventDefault();if(!manager()||!checkWrite()||!$('ccImportConsent').checked)return;
 const base=bases.find(x=>x.id===$('ccImportBase').value),file=$('ccImportFile').files?.[0],status=$('ccImportStatus');
 if(!base||base.estado!=='activa'||!file)return core.flash('Selecciona una base activa y archivo válido.',true);
 if(file.size>2*1024*1024)return core.flash('El archivo supera los 2 MB. Divídelo en archivos CSV más pequeños.',true);
 $('ccImportSubmit').disabled=true;let saved=0;
 try{
  const parsed=mapCsv(parseCsv(await file.text()));
  if(parsed.result.length>2000)throw Error('Máximo 2.000 contactos por importación. Divide el archivo.');
  const existing=new Set();let cursor=0;
  while(cursor<MAX_CONTACTS){
   const {data,error}=await db.from('saas_cc_contactos').select('telefono').eq('organizacion_id',orgId).eq('base_id',base.id).range(cursor,cursor+499);
   if(error)throw error;(data||[]).forEach(v=>existing.add(v.telefono.replace(/\D/g,'')));
   if(!data||data.length<500)break;cursor+=500;
  }
  const pending=parsed.result.filter(x=>!existing.has(x.telefono.replace(/\D/g,'')));
  if(!pending.length){status.textContent='No hay contactos nuevos para esta base.';return}
  if(!confirm('Importar '+pending.length+' contactos nuevos a «'+base.nombre+'»? Declara que tienes autorización de tratamiento para todos.'))return;
  for(let i=0;i<pending.length;i+=100){
   const group=pending.slice(i,i+100).map(x=>({...x,organizacion_id:orgId,sucursal_id:base.sucursal_id,base_id:base.id}));
   const {error}=await db.from('saas_cc_contactos').insert(group);
   if(error)throw error;
   saved+=group.length;status.textContent=saved+' / '+pending.length+' contactos guardados.';
  }
  selected=base.id;$('ccImportFile').value='';$('ccImportConsent').checked=false;
  await load();status.textContent=saved+' contactos importados. Repetidos: '+(parsed.dupes+parsed.result.length-pending.length)+'. Inválidos: '+parsed.invalid+'.';
  core.flash(saved+' contactos importados correctamente.');
 }catch(err){status.textContent='Importados: '+saved+'. Error: '+err.message;core.flash('Importación detenida: '+err.message,true)}
 finally{$('ccImportSubmit').disabled=false}
}
function events(){
 $('ccRefresh').addEventListener('click',load);
 $('ccBaseForm').addEventListener('submit',createBase);
 $('ccExtForm').addEventListener('submit',saveExtension);
 $('ccAssignForm').addEventListener('submit',assignBase);
 $('ccImportForm').addEventListener('submit',importContacts);
 $('ccManageForm').addEventListener('submit',submitManage);
 $('ccWorkBase').addEventListener('change',e=>{selected=e.target.value;loadContacts()});
 $('ccAssignBase').addEventListener('change',refreshAssignmentOptions);
 $('ccAssignAdvisor').addEventListener('change',refreshExtensionOptions);
 $('ccExtBranch').addEventListener('change',refreshAssignmentOptions);
 $('ccSearch').addEventListener('input',()=>{page=0;renderContacts()});
 $('ccStateFilter').addEventListener('change',()=>{page=0;renderContacts()});
 document.addEventListener('click',e=>{
  const b=e.target.closest('[data-cc-base]'),m=e.target.closest('[data-cc-manage]'),p=e.target.closest('[data-cc-page]');
  if(b){selected=b.dataset.ccBase;$('ccWorkBase').value=selected;loadContacts();$('ccSearch').scrollIntoView({behavior:'smooth'})}
  if(m)manageContact(m.dataset.ccManage);
  if(p){page+=Number(p.dataset.ccPage);renderContacts()}
 });
}
window.MiredSaasCallCenter={load,reset};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',events);else events();
})();
