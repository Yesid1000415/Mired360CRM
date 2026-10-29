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
 $('ccAssignShortcut').classList.toggle('hidden',!manager());
 $('ccRoleNotice').textContent=manager()?'Administración: puedes asignar la base a un asesor, vincular su extensión y cambiar la asignación cuando lo necesites.':'Has ingresado como asesor. Puedes trabajar las bases que te asignaron, pero para asignar o cambiar bases debes ingresar con una cuenta de propietario o administrador.';
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
 const first=new Date(),start=new Date(first.getFullYear(),first.getMonth(),1).toISOString();
 const {data,error}=await db.from('saas_cc_gestiones').select('usuario_id,extension_id,contacto_id,resultado,creado_en').eq('organizacion_id',orgId).gte('creado_en',start).eq('resultado','Venta').order('creado_en',{ascending:false}).limit(5000);
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
  return '<tr><td><b>'+esc(b.nombre)+'</b></td><td>'+esc(branchName(b.sucursal_id))+'</td><td>'+esc(teamName(b.asignado_a))+'</td><td>'+esc(e?.codigo||'—')+'</td><td>'+esc(b.estado)+'</td><td><button type="button" class="btn secondary" data-cc-base="'+b.id+'">Trabajar base</button> '+(manager()?'<button type="button" class="btn primary" data-cc-assign-base="'+b.id+'">Asignar</button> <button type="button" class="btn secondary" data-cc-toggle="'+b.id+'">'+(b.estado==='activa'?'Pausar':'Reactivar')+'</button>':'')+'</td></tr>';
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
   const sold=new Set(monthResults.filter(x=>x.extension_id===e.id).map(x=>x.contacto_id)).size;
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
   const {data,error}=await db.from('saas_cc_contactos').select('id,nombre,telefono,ciudad,estado,proxima_llamada,observaciones,base_id,prospecto_id').eq('organizacion_id',orgId).eq('base_id',baseId).order('creado_en',{ascending:false}).range(offset,offset+499);
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
  return '<tr><td><b>'+esc(c.nombre)+'</b></td><td>'+esc(c.telefono)+'</td><td>'+esc(c.ciudad)+'</td><td>'+esc(c.estado)+'</td><td>'+core.dateFmt(c.proxima_llamada)+'</td><td class="cc-actions"><a class="btn secondary" href="tel:'+encodeURIComponent(number)+'">Llamar</a> <button type="button" class="btn primary" data-cc-manage="'+c.id+'">Gestionar</button> '+(c.estado==='Venta'?(c.prospecto_id?'<span class="badge ok">En CRM</span>':'<button type="button" class="btn secondary" data-cc-convert="'+c.id+'">Pasar al CRM</button>'):'')+'</td></tr>'
 }).join('')||empty(6,'No hay contactos disponibles con este filtro.');
 $('ccPagination').innerHTML='<span>'+rows.length+' contactos · Página '+(page+1)+' / '+(maxPage+1)+'</span> '+
 '<button class="btn secondary" type="button" data-cc-page="-1" '+(!page?'disabled':'')+'>Anterior</button> '+
 '<button class="btn secondary" type="button" data-cc-page="1" '+(page>=maxPage?'disabled':'')+'>Siguiente</button>';
 const convertSelected=$('ccConvertContact').value;
 const converted=contacts.find(x=>x.id===convertSelected&&x.estado==='Venta'&&!x.prospecto_id);
 $('ccConvertContact').innerHTML='<option value="">Selecciona una venta desde la tabla</option>'+(converted?option(converted.id,converted.nombre,converted.id):'');
 const existing=$('ccManageContact').value;
 const pick=contacts.find(x=>x.id===existing);
 $('ccManageContact').innerHTML='<option value="">Selecciona un contacto desde la tabla</option>'+(pick?option(pick.id,pick.nombre,pick.id):'');
 $('ccHistoryRows').innerHTML=history.map(h=>{
  const c=contacts.find(v=>v.id===h.contacto_id);
  return '<tr><td>'+core.dateFmt(h.creado_en)+'</td><td>'+esc(c?.nombre||'Cliente')+'</td><td>'+esc(teamName(h.usuario_id))+'</td><td>'+esc(h.resultado)+'</td><td>'+core.dateFmt(h.proxima_llamada)+'</td><td>'+esc(h.notas)+'</td></tr>';
 }).join('')||empty(6,'Sin gestiones todavía.');
}
function selectConvert(id){
 const c=contacts.find(x=>x.id===id&&x.estado==='Venta'&&!x.prospecto_id);
 if(!c)return core.flash('Solo se pueden convertir ventas que aún no están en CRM.',true);
 $('ccConvertContact').innerHTML=option('', 'Selecciona una venta','')+option(c.id,c.nombre,c.id);
 $('ccConvertSave').scrollIntoView({behavior:'smooth',block:'center'});
 $('ccConvertProduct').focus();
}
async function convertSale(e){
 e.preventDefault();if(!checkWrite())return;
 const id=$('ccConvertContact').value;
 if(!contacts.some(c=>c.id===id&&c.estado==='Venta'&&!c.prospecto_id))return core.flash('Selecciona una venta sin convertir.',true);
 const product=$('ccConvertProduct').value.trim(),value=Number($('ccConvertValue').value);
 if(product.length<3||!Number.isFinite(value)||value<0)return core.flash('Indica producto y valor válido.',true);
 $('ccConvertSave').disabled=true;
 try{
  const {error}=await db.rpc('saas_cc_pasar_crm',{p_org:orgId,p_contacto:id,p_producto:product,p_valor:value});
  if(error)throw error;
  $('ccConvertForm').reset();
  await Promise.all([core.reloadLeads(),loadContacts()]);
  core.flash('Venta enviada al CRM y contabilizada en los reportes comerciales.');
 }catch(err){core.flash(err.message,true)}
 finally{$('ccConvertSave').disabled=false}
}
async function toggleBase(id){
 if(!manager()||!checkWrite())return;
 const base=bases.find(b=>b.id===id);if(!base)return;
 const status=base.estado==='activa'?'pausada':'activa';
 if(!confirm((status==='pausada'?'Pausar':'Reactivar')+' la base «'+base.nombre+'»?'))return;
 const {error}=await db.rpc('saas_cc_estado_base',{p_org:orgId,p_base:id,p_estado:status});
 if(error)return core.flash(error.message,true);
 await load();core.flash('Base '+(status==='activa'?'reactivada.':'pausada.'));
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
  $('ccManageForm').reset();await load();core.flash('Gestión registrada y guardada en historial.');
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
const ccHeaderPatterns={
 name:/^(nombre|nombres|cliente|usuario|titular|contacto|name|full ?name|razonsocial|nom)(s|completo|delcliente|yapellidos|apellido|apellidos|1|2|contacto|titular)?$/,
 phone:/(celular|telefono|telefonico|movil|whatsapp|msisdn|phone|numero(?:de)?(?:celular|telefono|movil)|numcel|numtel|telef|cel|movil1)/,
 city:/(ciudad|municipio|city|localidad|poblacion)/,
 notes:/(observacion|comentario|detalle|nota|direccion|barrio|referencia)/
};
function headerMatch(value,type){
 const t=normalizeHeader(value);if(!t)return false;
 if(type==='name')return ccHeaderPatterns.name.test(t)||((t.includes('nombre')||t.includes('apellido'))&&!t.includes('archivo'));
 return ccHeaderPatterns[type].test(t);
}
function inferColumn(head,type){
 let idx=head.findIndex(v=>headerMatch(v,type));
 if(idx>=0)return idx;
 if(type==='phone'){
  const alias=head.map(normalizeHeader);
  idx=alias.findIndex(v=>/^(numero|tel|cel|linea|contacto|numerodecontacto|numeromovil)$/.test(v));
 }
 return idx;
}
function suggestHeader(rows){
 for(let i=0;i<Math.min(160,rows.length);i++){
  const row=rows[i]||[];
  if(inferColumn(row,'phone')>=0&&inferColumn(row,'name')>=0)return i;
 }
 for(let i=0;i<Math.min(160,rows.length);i++){
  if(inferColumn(rows[i]||[],'phone')>=0)return i;
 }
 return rows.length?0:-1;
}
function normalizedPhone(value){
 const text=String(value??'').replace(/[^\d+]/g,''),digits=text.replace(/\D/g,'');
 return digits.length===12&&digits.startsWith('57')&&digits[2]==='3'?digits.slice(2):digits;
}
function prepareContacts(rows,columns,headerIndex){
 const result=[],seen=new Set();
 let invalid=0,dupes=0;
 const start=headerIndex>=0?headerIndex+1:0;
 for(const row of rows.slice(start)){
  if(!row||!row.some(x=>String(x??'').trim()))continue;
  const phone=normalizedPhone(row[columns.phone]);
  let name=columns.name>=0?String(row[columns.name]??'').trim():'';
  if(!name&&phone.length>=7)name='Contacto '+phone.slice(-4);
  if(name.length<2||phone.length<7||phone.length>18){invalid++;continue}
  if(seen.has(phone)){dupes++;continue}
  seen.add(phone);
  result.push({
   nombre:name.slice(0,150),telefono:phone,
   ciudad:columns.city>=0?String(row[columns.city]??'').trim().slice(0,110):'',
   observaciones:columns.notes>=0?String(row[columns.notes]??'').trim().slice(0,1000):''
  });
 }
 return {result,invalid,dupes};
}
// XLS/XLSX import: SheetJS is used in the original MIRED360 Call Center.
// Load it on demand (client-side only) and show explicit diagnostics if the CDN is unavailable.
let spreadsheetLoader=null;
function loadSpreadsheetReader(){
 if(window.XLSX?.read&&window.XLSX?.utils?.sheet_to_json)return Promise.resolve(window.XLSX);
 if(spreadsheetLoader)return spreadsheetLoader;
 const urls=[
  'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js',
  'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js'
 ];
 function next(index){
  return new Promise((resolve,reject)=>{
   const tag=document.createElement('script');
   tag.src=urls[index];tag.crossOrigin='anonymous';
   tag.onload=()=>window.XLSX?.read?resolve(window.XLSX):reject(Error('Se descargó el lector, pero no inició.'));
   tag.onerror=()=>reject(Error('No se pudo acceder al servidor del lector Excel.'));
   document.head.appendChild(tag);
  }).catch(err=>index+1<urls.length?next(index+1):Promise.reject(Error('No se pudo cargar el lector Excel. Verifica la conexión a internet o guarda una copia CSV e inténtalo de nuevo.')));
 }
 spreadsheetLoader=next(0).catch(e=>{spreadsheetLoader=null;throw e});
 return spreadsheetLoader;
}
function csvHeadersPresent(row){
 const headers=(row||[]).map(normalizeHeader);
 const hasName=headers.some(v=>['nombre','nombres','cliente','fullname','nombrecompleto','razonsocial','nombrecliente','nombreyapellido','nombresyapellidos'].includes(v));
 const hasPhone=headers.some(v=>['telefono','celular','movil','telefono1','cel','numero','phone','contacto','numerocelular','numerodetelefono','numerotelefono','tel','whatsapp','celular1','telefono_contacto','telefonocontacto','movil1'].includes(v));
 return hasName&&hasPhone;
}
function locateDataHeader(rows){
 const limit=Math.min(rows.length,15);
 for(let i=0;i<limit;i++){if(csvHeadersPresent(rows[i]))return rows.slice(i)}
 return rows;
}
async function readImportRows(file){
 const extension=(file.name.split('.').pop()||'').toLowerCase();
 if(['xlsx','xls'].includes(extension)){
  const XLSX=await loadSpreadsheetReader();
  let wb;
  try{
   wb=XLSX.read(await file.arrayBuffer(),{type:'array',cellText:true,cellDates:false,cellFormula:false});
  }catch(err){throw Error('No se pudo leer el Excel. Comprueba que no esté protegido con contraseña y que el archivo sea .xlsx o .xls válido.')}
  for(const name of wb.SheetNames){
   const ws=wb.Sheets[name];if(!ws)continue;
   const rows=XLSX.utils.sheet_to_json(ws,{header:1,raw:false,defval:'',blankrows:false});
   const candidate=locateDataHeader(rows);
   if(candidate.length>=2&&csvHeadersPresent(candidate[0]))return candidate;
  }
  throw Error('No encuentro encabezados «Nombre» y «Teléfono/Celular» en las primeras 15 filas. Revisa los títulos de columnas del Excel.');
 }
 if(['csv','tsv','txt'].includes(extension))return locateDataHeader(parseCsv(await file.text()));
 throw Error('Archivo no compatible. Usa Excel .xlsx, .xls o CSV.');
}
let ccImportSource=null,ccImportSeq=0;
async function readImportSheets(file){
 const extension=(file.name.split('.').pop()||'').toLowerCase();
 if(['xlsx','xls'].includes(extension)){
  const XLSX=await loadSpreadsheetReader();
  let wb;
  try{wb=XLSX.read(await file.arrayBuffer(),{type:'array',cellText:true,cellDates:false,cellFormula:false})}
  catch(e){throw Error('El Excel no se pudo abrir. Comprueba que no esté protegido ni dañado.')}
  const sheets=[];
  for(const name of wb.SheetNames){
   const ws=wb.Sheets[name];if(!ws)continue;
   const rows=XLSX.utils.sheet_to_json(ws,{header:1,raw:true,defval:'',blankrows:false});
   if(rows.length)sheets.push({name,rows});
  }
  if(!sheets.length)throw Error('El Excel no contiene hojas con datos.');
  return sheets;
 }
 if(['csv','tsv','txt'].includes(extension)){
  const rows=parseCsv(await file.text());
  if(!rows.length)throw Error('El archivo está vacío.');
  return [{name:'Datos del archivo',rows}];
 }
 throw Error('Formato no compatible. Selecciona Excel (.xlsx o .xls), CSV o TXT.');
}
function ccSelectOptions(select,items,selected){
 select.innerHTML=items.map(x=>'<option value="'+esc(String(x.value))+'">'+esc(x.label)+'</option>').join('');
 if(items.some(x=>String(x.value)===String(selected)))select.value=String(selected);
}
function ccCurrentSheet(){
 return ccImportSource?.sheets?.[Number($('ccImportSheet').value)]||null;
}
function ccHeaderIndex(){return Number($('ccImportHeaderRow').value)}
function ccColumnOptions(rows,header){
 const length=Math.min(65,Math.max(1,...rows.slice(0,Math.min(rows.length,40)).map(r=>r.length)));
 const labels=header>=0?rows[header]||[]:rows[0]||[];
 const exampleIndex=Math.min(rows.length-1,header>=0?header+1:0);
 const examples=rows[exampleIndex]||[];
 const opts=[{value:-1,label:'No disponible / usar automático'}];
 for(let i=0;i<length;i++){
  const c=i+1;let n=c;let letter='';
  while(n>0){n--;letter=String.fromCharCode(65+n%26)+letter;n=Math.floor(n/26)}
  const title=header>=0?String(labels[i]??'').trim().slice(0,55):'';
  const example=String(examples[i]??'').trim().slice(0,36);
  opts.push({value:i,label:'Columna '+letter+(title?' · '+title:'')+(example?' (ej.: '+example+')':'')});
 }
 return opts;
}
function ccMapValues(){
 return {name:Number($('ccImportNameCol').value),phone:Number($('ccImportPhoneCol').value),
 city:Number($('ccImportCityCol').value),notes:Number($('ccImportNotesCol').value)};
}
function ccResetColumns(){
 const sheet=ccCurrentSheet();if(!sheet)return;
 const head=ccHeaderIndex(),header=head>=0?sheet.rows[head]||[]:[];
 const options=ccColumnOptions(sheet.rows,head);
 for(const [type,id] of [['name','ccImportNameCol'],['phone','ccImportPhoneCol'],['city','ccImportCityCol'],['notes','ccImportNotesCol']]){
  ccSelectOptions($(id),options,inferColumn(header,type));
 }
 ccRenderImportPreview();
}
function ccRenderImportPreview(){
 if(!ccImportSource)return;
 const sheet=ccCurrentSheet();if(!sheet)return;
 const columns=ccMapValues(),head=ccHeaderIndex(),info=$('ccImportPreviewInfo');
 $('ccImportSubmit').disabled=true;
 if(columns.phone<0){
  info.textContent='Selecciona cuál columna contiene los teléfonos. Puedes dejar el nombre en «No disponible» si el archivo solo tiene números.';
  $('ccImportPreviewRows').innerHTML='';
  return;
 }
 if([columns.name,columns.city,columns.notes].includes(columns.phone)){
  info.textContent='La columna de teléfono debe ser distinta de las otras columnas seleccionadas.';
  $('ccImportPreviewRows').innerHTML='';
  return;
 }
 const parsed=prepareContacts(sheet.rows,columns,head);
 const count=parsed.result.length;
 info.textContent='Se detectaron '+count+' contactos válidos, '+parsed.dupes+' repetidos y '+parsed.invalid+' filas incompletas. Revisa esta vista previa antes de importar.';
 $('ccImportPreviewRows').innerHTML=parsed.result.slice(0,5).map(x=>
  '<tr><td>'+esc(x.nombre)+'</td><td>•••• '+esc(x.telefono.slice(-4))+'</td><td>'+esc(x.ciudad)+'</td></tr>'
 ).join('')||empty(3,'No hay contactos válidos con estas columnas. Cambia la selección.');
 if(count>2000)info.textContent+=' El máximo es 2.000 contactos por archivo. Divide el Excel.';
 $('ccImportSubmit').disabled=count===0||count>2000;
}
function ccChangeSheet(){
 const sheet=ccCurrentSheet();if(!sheet)return;
 const proposed=suggestHeader(sheet.rows),limit=Math.min(sheet.rows.length,220),options=[
  {value:-1,label:'Mi archivo no tiene encabezados (la primera fila es un contacto)'}
 ];
 for(let i=0;i<limit;i++){
  const row=sheet.rows[i]||[];
  const glimpse=row.filter(x=>String(x??'').trim()).slice(0,3).map(x=>String(x).slice(0,32)).join(' | ');
  options.push({value:i,label:'Fila '+(i+1)+(glimpse?' · '+glimpse:'')});
 }
 ccSelectOptions($('ccImportHeaderRow'),options,proposed);
 ccResetColumns();
}
async function ccReadFile(){
 const file=$('ccImportFile').files?.[0],request=++ccImportSeq;
 ccImportSource=null;$('ccImportMapping').classList.add('hidden');
 $('ccImportSubmit').disabled=true;
 if(!file){$('ccImportStatus').textContent='';return}
 if(file.size>8*1024*1024){$('ccImportStatus').textContent='El archivo supera 8 MB. Divídelo en partes.';return}
 $('ccImportStatus').textContent='Leyendo '+file.name+' y preparando vista previa...';
 try{
  const sheets=await readImportSheets(file);
  if(request!==ccImportSeq)return;
  ccImportSource={file,sheets};
  const options=sheets.map((sheet,i)=>({value:i,label:sheet.name+' ('+sheet.rows.length+' filas)'}));
  const selected=sheets.findIndex(sheet=>suggestHeader(sheet.rows)>=0&&inferColumn(sheet.rows[suggestHeader(sheet.rows)]||[],'phone')>=0);
  ccSelectOptions($('ccImportSheet'),options,Math.max(0,selected));
  $('ccImportMapping').classList.remove('hidden');
  ccChangeSheet();
  $('ccImportStatus').textContent='Archivo leído. Selecciona las columnas y comprueba la vista previa antes de importar.';
 }catch(err){
  if(request!==ccImportSeq)return;
  $('ccImportStatus').textContent='Error leyendo archivo: '+(err?.message||String(err));
  core.flash(err?.message||String(err),true);
 }
}
async function importContacts(e){
 e.preventDefault();
 if(!manager()||!checkWrite()||!$('ccImportConsent').checked)return;
 const base=bases.find(x=>x.id===$('ccImportBase').value),status=$('ccImportStatus');
 const sheet=ccCurrentSheet();
 if(!base||base.estado!=='activa')return core.flash('Selecciona una base activa.',true);
 if(!ccImportSource||!sheet)return core.flash('Carga el archivo y revisa primero las columnas.',true);
 const columns=ccMapValues();
 if(columns.phone<0)return core.flash('Indica la columna del teléfono.',true);
 if([columns.name,columns.city,columns.notes].includes(columns.phone))return core.flash('El teléfono debe tener su propia columna.',true);
 const parsed=prepareContacts(sheet.rows,columns,ccHeaderIndex());
 if(!parsed.result.length)return core.flash('No hay números válidos con las columnas seleccionadas.',true);
 if(parsed.result.length>2000)return core.flash('Máximo 2.000 contactos por archivo. Divide el Excel.',true);
 if(!confirm('Importar '+parsed.result.length+' contactos a «'+base.nombre+'»? Verifica que cuentas con autorización para contactar a estas personas.'))return;
 const request=ccImportSeq;
 $('ccImportSubmit').disabled=true;status.textContent='Guardando '+parsed.result.length+' contactos...';
 try{
  const {data,error}=await db.rpc('saas_cc_importar_contactos',{
   p_org:orgId,p_base:base.id,p_registros:parsed.result
  });
  if(error)throw error;
  const saved=Number(data?.importados||0),duplicates=Number(data?.repetidos||0)+parsed.dupes,invalid=Number(data?.invalidos||0)+parsed.invalid;
  selected=base.id;
  await load();
  status.textContent=saved+' contactos nuevos guardados · '+duplicates+' repetidos · '+invalid+' inválidos.';
  if(request===ccImportSeq){
   ccImportSeq++;ccImportSource=null;
   $('ccImportForm').reset();$('ccImportMapping').classList.add('hidden');
  }
  core.flash(saved?('Se guardaron '+saved+' contactos correctamente.'):('No se agregaron contactos nuevos: '+duplicates+' repetidos.'));
 }catch(err){
  console.error('MIRED360 Call Center import:',err);
  const msg=(err?.hint?err.hint+' · ':'')+(err?.message||String(err));
  status.textContent='Error al guardar: '+msg;
  core.flash('Importación: '+msg,true);
 }finally{
  if(ccImportSource)ccRenderImportPreview();
  else $('ccImportSubmit').disabled=true;
 }
}
function events(){
 $('ccAssignShortcut').addEventListener('click',()=>{if(!manager())return core.flash('Solo el propietario o administrador puede asignar bases.',true);$('ccAssignCard').scrollIntoView({behavior:'smooth',block:'start'});$('ccAssignBase').focus();});
 $('ccRefresh').addEventListener('click',load);
 $('ccBaseForm').addEventListener('submit',createBase);
 $('ccExtForm').addEventListener('submit',saveExtension);
 $('ccAssignForm').addEventListener('submit',assignBase);
 $('ccImportForm').addEventListener('submit',importContacts);
 $('ccImportFile').addEventListener('change',ccReadFile);
 $('ccImportSheet').addEventListener('change',ccChangeSheet);
 $('ccImportHeaderRow').addEventListener('change',ccResetColumns);
 for(const id of ['ccImportNameCol','ccImportPhoneCol','ccImportCityCol','ccImportNotesCol'])
  $(id).addEventListener('change',ccRenderImportPreview);
 $('ccManageForm').addEventListener('submit',submitManage);
 $('ccConvertForm').addEventListener('submit',convertSale);
 $('ccWorkBase').addEventListener('change',e=>{selected=e.target.value;loadContacts()});
 $('ccAssignBase').addEventListener('change',refreshAssignmentOptions);
 $('ccAssignAdvisor').addEventListener('change',refreshExtensionOptions);
 $('ccExtBranch').addEventListener('change',refreshAssignmentOptions);
 $('ccSearch').addEventListener('input',()=>{page=0;renderContacts()});
 $('ccStateFilter').addEventListener('change',()=>{page=0;renderContacts()});
 document.addEventListener('click',e=>{
  const b=e.target.closest('[data-cc-base]'),m=e.target.closest('[data-cc-manage]'),p=e.target.closest('[data-cc-page]'),v=e.target.closest('[data-cc-convert]'),toggle=e.target.closest('[data-cc-toggle]'),assign=e.target.closest('[data-cc-assign-base]');
  if(assign&&manager()){const id=assign.dataset.ccAssignBase;$('ccAssignBase').value=id;refreshAssignmentOptions();$('ccAssignCard').scrollIntoView({behavior:'smooth',block:'start'});$('ccAssignAdvisor').focus();}
  if(b){selected=b.dataset.ccBase;$('ccWorkBase').value=selected;loadContacts();$('ccSearch').scrollIntoView({behavior:'smooth'})}
  if(m)manageContact(m.dataset.ccManage);
  if(v)selectConvert(v.dataset.ccConvert);
  if(toggle)toggleBase(toggle.dataset.ccToggle);
  if(p){page+=Number(p.dataset.ccPage);renderContacts()}
 });
}
window.MiredSaasCallCenter={load,reset};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',events);else events();
})();
