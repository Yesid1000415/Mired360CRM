/* MIRED360 CRM Empresas · registros de telefonía IP
   Importación de CDR históricos vía archivo, NO hace llamadas ni conecta API del proveedor.
   Acceso exclusivo a gerencia y aislado por empresa/sucursal. */
(function(){
'use strict';
const core=window.MiredSaas;
if(!core||!core.db)return;
const db=core.db,$=id=>document.getElementById(id),esc=core.esc;
let orgId=null,request=0,files=null,items=[],csvRows=null,report=null,branchIds=[];
function manager(){return ['propietario','administrador'].includes(core.currentRole())}
function active(){return !!window.MiredSaasOps?.active('llamadas')}
function visible(){return manager()&&active()&&core.org}
function isoLocalToday(){
 const p=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:'America/Bogota',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date()).map(x=>[x.type,x.value]));
 return p.year+'-'+p.month+'-'+p.day;
}
function options(el,vals,sel){
 el.innerHTML=vals.map(p=>'<option value="'+esc(String(p[0]))+'">'+esc(String(p[1]))+'</option>').join('');
 if(vals.some(p=>String(p[0])===String(sel)))el.value=String(sel);
}
function fullNumber(raw){return String(raw??'').replace(/\D/g,'')}
function pad(v){return String(v).padStart(2,'0')}
function callStart(value){
 if(value instanceof Date&&!Number.isNaN(value.getTime()))return value.toISOString().replace(/\.\d{3}Z$/,'Z');
 if(typeof value==='number'&&value>10000&&value<100000){
  const dat=window.XLSX?.SSF?.parse_date_code?.(value);
  if(dat)return dat.y+'-'+pad(dat.m)+'-'+pad(dat.d)+'T'+pad(dat.H)+':'+pad(dat.M)+':'+pad(dat.S)+'-05:00';
 }
 const s=String(value??'').trim();
 let m=s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})[ T](\d{1,2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?(Z|[+-]\d{2}:\d{2})?$/i);
 if(m)return m[1]+'-'+pad(m[2])+'-'+pad(m[3])+'T'+pad(m[4])+':'+m[5]+':'+(m[6]||'00')+(m[7]||'-05:00');
 m=s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
 if(m)return m[3]+'-'+pad(m[2])+'-'+pad(m[1])+'T'+pad(m[4])+':'+m[5]+':'+(m[6]||'00')+'-05:00';
 return '';
}
function seconds(value){
 const s=String(value??'').trim();
 if(!s)return null;
 if(/^\d{1,5}$/.test(s))return Number(s);
 const x=s.match(/^(\d{1,3}):([0-5]\d):([0-5]\d)$/);
 if(x)return Number(x[1])*3600+Number(x[2])*60+Number(x[3]);
 const y=s.match(/^([0-5]?\d):([0-5]\d)$/);
 if(y)return Number(y[1])*60+Number(y[2]);
 return null;
}
function answered(value){
 const v=String(value??'').toUpperCase().trim();
 if(/^(NO|FALSE|0|NO ANSWER|NO ANSWERED|UNANSWERED|BUSY|FAILED|FAILURE|CONGESTION|REJECTED|CANCELLED|CANCELED|SIN RESPUESTA|NO CONTESTADA|NO CONTESTADO|OCUPADO|FALLIDA|PERDIDA|MISSED|ABANDONADA)$/.test(v))return false;
 if(/^(SI|SÍ|YES|TRUE|1|ANSWERED|ANSWER|COMPLETED|CONNECT|CONNECTED|CONTESTADA|CONTESTADO|ATENDIDA|ATENDIDO|EXITOSA|OK)$/.test(v))return true;
 return null;
}
function direction(v,fallback){
 const text=String(v??'').toLowerCase().trim();
 if(/(inbound|entrante|incoming|interna)/.test(text))return 'entrante';
 if(/(outbound|saliente|outgoing|externa)/.test(text))return 'saliente';
 return fallback;
}
function selectedSheet(){return files?.[Number($('pbxSheet').value)]||null}
function columns(){
 return {header:Number($('pbxHeader').value),time:Number($('pbxTime').value),number:Number($('pbxNumber').value),
  extension:Number($('pbxExtension').value),duration:Number($('pbxDuration').value),
  state:Number($('pbxState').value),direction:Number($('pbxDirection').value),external:Number($('pbxExternal').value)};
}
const guesses={
 time:/(fecha|inicio|start|calldate|datetime|hora|timestamp|time)/,
 number:/(destino|destination|number|telefono|celular|numero|phone|src|dst|origen|caller|callee)/,
 extension:/(extension|extensi[oó]n|exten|agente|agent)/,
 duration:/(duracion|duration|segundos|seconds|billsec|talktime)/,
 state:/(disposition|resultado|status|estado|answered|atendida|contestada)/,
 direction:/(direccion|direction|sentido|tipo)/,
 external:/(uniqueid|callid|idllamada|identificador|idregistro|reference)/
};
function norm(v){return String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9]/g,'').toLowerCase()}
function guess(row,field){
 return row.findIndex(v=>guesses[field].test(norm(v)));
}
function findHeader(rows){
 for(let i=0;i<Math.min(100,rows.length);i++){
  const r=rows[i],found=['time','number','duration','state'].filter(x=>guess(r,x)>=0);
  if(found.length>=3&&guess(r,'time')!==guess(r,'number'))return i;
 }
 return -1;
}
function mapColumns(){
 const file=selectedSheet();if(!file)return;
 const opts=columns(),head=opts.header,header=head>=0?file.rows[head]||[]:[],
  sample=file.rows[Math.max(0,head+1)]||[];
 const width=Math.min(60,Math.max(1,...file.rows.slice(0,40).map(r=>r.length)));
 const list=[[-1,'No disponible en archivo']];
 for(let i=0;i<width;i++){
  const excelCol=i<26?String.fromCharCode(65+i):'A'+String.fromCharCode(65+i-26);
  list.push([i,excelCol+(head>=0&&header[i]?' · '+String(header[i]).slice(0,32):'')+
    (sample[i]!==undefined&&String(sample[i]).trim()?' (ej. '+String(sample[i]).slice(0,20)+')':'')]);
 }
 const ids={time:'pbxTime',number:'pbxNumber',extension:'pbxExtension',duration:'pbxDuration',
  state:'pbxState',direction:'pbxDirection',external:'pbxExternal'};
 for(const [key,id] of Object.entries(ids))options($(id),list,head>=0?guess(header,key):-1);
 preview();
}
function changeSheet(){
 const f=selectedSheet();if(!f)return;
 const choices=[[-1,'Sin encabezados: primera fila es llamada']];
 for(let i=0;i<Math.min(100,f.rows.length);i++){
  choices.push([i,'Fila '+(i+1)+' · '+(f.rows[i]||[]).filter(v=>String(v??'').trim()).slice(0,3).map(v=>String(v).slice(0,20)).join(' / ')]);
 }
 options($('pbxHeader'),choices,findHeader(f.rows));
 mapColumns();
}
function extract(){
 const file=selectedSheet(),cfg=columns();
 if(!file)return {rows:[],invalid:0,duplicates:0,reason:'Selecciona archivo y hoja.'};
 if([cfg.time,cfg.number,cfg.duration,cfg.state].some(n=>n<0))
  return {rows:[],invalid:0,duplicates:0,reason:'Asigna las columnas de fecha, número, duración y resultado.'};
 if(new Set([cfg.time,cfg.number,cfg.duration,cfg.state]).size<4)
  return {rows:[],invalid:0,duplicates:0,reason:'Las cuatro columnas obligatorias deben ser diferentes.'};
 const data=[],seen=new Set();let invalid=0,duplicates=0;
 for(const row of file.rows.slice(cfg.header>=0?cfg.header+1:0)){
  if(!row.some(v=>String(v??'').trim()))continue;
  const phone=fullNumber(row[cfg.number]),start=callStart(row[cfg.time]),duration=seconds(row[cfg.duration]),
    state=String(row[cfg.state]??'').trim(),isAnswered=answered(state);
  if(phone.length<7||phone.length>18||!start||!Number.isFinite(Date.parse(start))||
      duration===null||duration<0||duration>86400||isAnswered===null){invalid++;continue}
  const ext=cfg.extension>=0?String(row[cfg.extension]??'').trim():'',
   dir=cfg.direction>=0?direction(row[cfg.direction],$('pbxDefaultDirection').value):$('pbxDefaultDirection').value,
   identifier=cfg.external>=0?String(row[cfg.external]??'').trim():'';
  const rec={id_externo:identifier,telefono:phone,extension:ext,inicio:start,
   duracion_segundos:duration,contestada:isAnswered,direccion:dir,estado:state};
  const fingerprint=identifier||[phone,start,ext,duration,dir].join('|');
  if(seen.has(fingerprint)){duplicates++;continue}
  seen.add(fingerprint);data.push(rec);
 }
 return {rows:data,invalid,duplicates,reason:''};
}
function preview(){
 const x=extract(),status=$('pbxPreviewStatus');
 if(x.reason){status.textContent=x.reason;$('pbxPreviewRows').innerHTML='';$('pbxImport').disabled=true;return}
 status.textContent='Reconocidas '+x.rows.length+' llamadas · '+x.duplicates+' repetidas · '+x.invalid+' filas sin datos válidos. Se permite hasta 1000 por importación.';
 $('pbxPreviewRows').innerHTML=x.rows.slice(0,5).map(r=>
  '<tr><td>'+esc(r.inicio.replace('T',' ').slice(0,19))+'</td><td>•••• '+esc(r.telefono.slice(-4))+
  '</td><td>'+esc(r.extension)+'</td><td>'+esc(r.direccion)+
  '</td><td>'+r.duracion_segundos+' s</td><td>'+esc(r.estado)+'</td></tr>').join('');
 $('pbxImport').disabled=!(x.rows.length>0&&x.rows.length<=1000);
}
async function selectFile(){
 const f=$('pbxFile').files?.[0],req=++request;
 files=null;$('pbxMapping').classList.add('hidden');
 $('pbxImport').disabled=true;
 if(!f){$('pbxImportStatus').textContent='';return}
 if(f.size>8*1024*1024){$('pbxImportStatus').textContent='El archivo supera 8 MB. Divide el archivo.';return}
 $('pbxImportStatus').textContent='Leyendo archivo…';
 try{
  const parser=window.MiredSaasCallCenter?.readImportSheets;
  if(!parser)throw Error('No está disponible el lector de archivos. Recarga la página.');
  const sheets=await parser(f);
  if(req!==request)return;
  files=sheets;
  options($('pbxSheet'),sheets.map((s,i)=>[i,s.name+' ('+s.rows.length+' filas)']),sheets.findIndex(s=>findHeader(s.rows)>=0)>=0?sheets.findIndex(s=>findHeader(s.rows)>=0):0);
  $('pbxMapping').classList.remove('hidden');changeSheet();
  $('pbxImportStatus').textContent='Archivo leído. Verifica los campos y la vista previa antes de importar.';
 }catch(e){if(req===request){$('pbxImportStatus').textContent='No se pudo abrir: '+e.message;core.flash(e.message,true)}}
}
function reset(){
 request++;orgId=null;files=null;report=null;branchIds=[];
 ['pbxMetricRows','pbxRecentRows','pbxExtRows','pbxPreviewRows'].forEach(id=>{if($(id))$(id).innerHTML=''});
 if($('pbxMapping'))$('pbxMapping').classList.add('hidden');
 if($('pbxImport'))$('pbxImport').disabled=true;
}
async function load(){
 document.querySelectorAll('[data-page="telefonia"]').forEach(el=>el.classList.toggle('hidden',!visible()));
 if(!visible()){reset();return}
 const org=core.org.id,req=++request;
 orgId=org;
 const {data,error}=await db.from('saas_sucursales').select('id,nombre').eq('organizacion_id',org).eq('activa',true).order('nombre');
 if(req!==request||core.org?.id!==org)return;
 if(error){core.flash('No se pudieron consultar sucursales: '+error.message,true);return}
 branchIds=(data||[]).map(x=>x.id);
 options($('pbxBranch'),(data||[]).map(x=>[x.id,x.nombre]),data?.[0]?.id||'');
 if(!$('pbxFrom').value){const today=isoLocalToday();$('pbxFrom').value=today.slice(0,8)+'01';$('pbxTo').value=today}
 await refresh();
}
async function refresh(){
 if(!visible()||!orgId)return;
 const req=++request,org=core.org.id,from=$('pbxFrom').value,to=$('pbxTo').value;
 if(!from||!to||from>to)return core.flash('Elige un rango de fechas válido.',true);
 $('pbxLoad').disabled=true;$('pbxStatus').textContent='Consultando registros importados…';
 try{
  const [sum,rows]=await Promise.all([
   db.rpc('saas_cc_resumen_cdr',{p_org:org,p_desde:from,p_hasta:to}),
   db.from('saas_cc_cdr').select('inicio,telefono,extension,direccion,estado,duracion_segundos,contestada')
    .eq('organizacion_id',org).gte('inicio',from+'T00:00:00-05:00')
    .lt('inicio',to+'T23:59:59-05:00')
    .order('inicio',{ascending:false}).limit(100)
  ]);
  if(req!==request||core.org?.id!==org)return;
  if(sum.error)throw sum.error;
  if(rows.error)throw rows.error;
  report=sum.data||{};
  const items=[['Llamadas importadas',report.total],['Contestadas',report.contestadas],
   ['No contestadas',report.no_contestadas],['Entrantes',report.entrantes],['Salientes',report.salientes],['Minutos registrados',report.minutos]];
  $('pbxMetricRows').innerHTML=items.map(([title,value])=>'<div class="cc-sup-metric"><small>'+esc(title)+'</small><strong>'+Number(value||0).toLocaleString('es-CO')+'</strong></div>').join('');
  $('pbxExtRows').innerHTML=(report.extensiones||[]).map(e=>'<tr><td>'+esc(e.extension||'Sin extensión')+'</td><td>'+e.total+'</td><td>'+e.contestadas+'</td></tr>').join('')||'<tr><td colspan="3" class="empty">Aún no se han importado llamadas para este período.</td></tr>';
  $('pbxRecentRows').innerHTML=(rows.data||[]).map(e=>'<tr><td>'+esc(e.inicio?.replace('T',' ').slice(0,19)||'')+'</td><td>•••• '+esc(String(e.telefono||'').slice(-4))+'</td><td>'+esc(e.extension)+'</td><td>'+esc(e.direccion)+'</td><td>'+esc(e.estado)+'</td><td>'+e.duracion_segundos+' s</td></tr>').join('')||'<tr><td colspan="6" class="empty">Sin registros importados todavía.</td></tr>';
  $('pbxStatus').textContent='Datos de archivos CDR importados manualmente. No equivale a una conexión automática de la central.';
 }catch(e){if(req===request){$('pbxStatus').textContent='Error: '+(e.message||String(e));core.flash(e.message||String(e),true)}}
 finally{if(req===request)$('pbxLoad').disabled=false}
}
async function importRecords(e){
 e.preventDefault();if(!visible()||!core.editable())return core.flash('Tu cuenta no puede importar registros.',true);
 const id=$('pbxBranch').value;
 if(!branchIds.includes(id))return core.flash('Selecciona una sucursal válida.',true);
 if(!$('pbxAuthorize').checked)return core.flash('Confirma que puedes importar legalmente este historial.',true);
 const x=extract();
 if(x.reason||!x.rows.length||x.rows.length>1000)return core.flash(x.reason||'Revisa el archivo (máximo 1000 llamadas).',true);
 if(!confirm('Importar '+x.rows.length+' registros de telefonía de un archivo externo a esta empresa y sucursal? Los duplicados no se guardarán.'))return;
 $('pbxImport').disabled=true;$('pbxImportStatus').textContent='Guardando historial…';
 try{
  const {data,error}=await db.rpc('saas_cc_importar_cdr',{p_org:orgId,p_sucursal:id,p_registros:x.rows});
  if(error)throw error;
  $('pbxImportStatus').textContent=Number(data.importados||0)+' nuevos · '+(Number(data.repetidos||0)+x.duplicates)+' repetidos · '+(Number(data.invalidos||0)+x.invalid)+' inválidos.';
  $('pbxFile').value='';files=null;$('pbxMapping').classList.add('hidden');$('pbxAuthorize').checked=false;
  core.flash('Se guardaron '+Number(data.importados||0)+' registros CDR. No se generaron gestiones ni ventas.');
  await refresh();
 }catch(err){$('pbxImportStatus').textContent='Error de importación: '+err.message;core.flash(err.message,true)}
 finally{$('pbxImport').disabled=!files}
}
function events(){
 $('pbxFile').addEventListener('change',selectFile);
 $('pbxSheet').addEventListener('change',changeSheet);
 $('pbxHeader').addEventListener('change',mapColumns);
 for(const id of ['pbxTime','pbxNumber','pbxDuration','pbxExtension','pbxState','pbxDirection','pbxExternal','pbxDefaultDirection'])$(id).addEventListener('change',preview);
 $('pbxForm').addEventListener('submit',importRecords);
 $('pbxLoad').addEventListener('click',refresh);
 document.addEventListener('click',e=>{
  if(e.target.closest('[data-page="telefonia"]')&&visible()&&orgId===core.org?.id)refresh();
 });
}
window.MiredSaasTelefonia={load,reset,refresh};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',events);else events();
})();