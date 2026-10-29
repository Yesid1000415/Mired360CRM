(function(){
'use strict';
const URL_SB='https://lpiusomsuswdcraoozdn.supabase.co';
const KEY_SB='sb_publishable_ZFjdUsgyfSxOqm4L1SrJJg_Z2f0lL0r';
const db=window.supabase&&window.supabase.createClient(URL_SB,KEY_SB);
const $=id=>document.getElementById(id);
const money=n=>new Intl.NumberFormat('es-CO',{style:'currency',currency:'COP',maximumFractionDigits:0}).format(Number(n||0));
const dateFmt=v=>v?new Intl.DateTimeFormat('es-CO',{year:'numeric',month:'short',day:'numeric',timeZone:'UTC'}).format(new Date(v.slice(0,10)+'T12:00:00Z')):'—';
const escapeHTML=value=>String(value==null?'':value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const statuses=['Nuevo','Contactado','Seguimiento','Venta','Instalado','Perdido'];
let user=null,organizations=[],org=null,memberships=[],members=[],leads=[],authMode='login',loading=false;
let modalEditing=null,activePage='dashboard';
function show(id){['authScreen','consentScreen','onboardingScreen','saasApp'].forEach(k=>$(k).classList.toggle('hidden',k!==id))}
function setAuthMessage(s,success=false){$('authMessage').textContent=s;$('authMessage').classList.toggle('success',success)}
function flash(s,bad=false){
 const el=$('flash');el.textContent=s;el.classList.toggle('error',bad);el.classList.remove('hidden');
 clearTimeout(flash._timer);flash._timer=setTimeout(()=>el.classList.add('hidden'),6000)
}
function fail(e,def='No fue posible completar la acción'){
 console.error('[MIRED360 SaaS]',e);
 return e&&e.message?e.message:def;
}
function setLoading(b){loading=b;$('authSubmit').disabled=b;$('companySubmit').disabled=b;$('leadSubmit').disabled=b;$('inviteSubmit').disabled=b}
function authUI(mode){
 authMode=mode;const showPw=mode!=='recover';
 $('authLegalLabel').classList.toggle('hidden',mode!=='register');$('authLegal').required=mode==='register';
 $('authPassword').closest('label').classList.toggle('hidden',!showPw);$('authPassword').required=showPw;
 $('authPassword').autocomplete=mode==='register'?'new-password':'current-password';
 const names={login:['Bienvenido a MIRED360','Ingresa para administrar la información de tu empresa.','Ingresar a mi empresa'],register:['Empieza a organizar tu negocio','Crea tu cuenta y configura una empresa con prueba de 14 días.','Crear cuenta'],recover:['Recuperar contraseña','Recibirás un enlace para actualizarla.','Enviar enlace'],update:['Cambiar contraseña','Escribe una nueva contraseña para tu cuenta.','Guardar contraseña']};
 const t=names[mode]||names.login;
 $('authHeading').textContent=t[0];$('authSubheading').textContent=t[1];$('authSubmit').textContent=t[2];
 $('authSwitch').textContent=mode==='login'?'Crear cuenta':'Volver a ingresar';
 $('authReset').classList.toggle('hidden',mode==='recover'||mode==='update');
 $('authEmail').closest('label').classList.toggle('hidden',mode==='update');
 $('authEmail').required=mode!=='update';
 setAuthMessage('');
}
function invitationToken(){return new URLSearchParams(location.search).get('invitacion')||''}
function cleanInviteUrl(){
 const next=new URL(location.href);next.searchParams.delete('invitacion');history.replaceState({},'',next.pathname+next.search+next.hash)
}
async function onAuthSubmit(e){
 e.preventDefault();if(loading||!db)return;
 const email=$('authEmail').value.trim().toLowerCase(),password=$('authPassword').value;
 setLoading(true);setAuthMessage('');
 try{
  if(authMode==='recover'){
   const {error}=await db.auth.resetPasswordForEmail(email,{redirectTo:location.origin+location.pathname});
   if(error)throw error;
   setAuthMessage('Si el correo está registrado, recibirás instrucciones para recuperar tu contraseña.',true);
  }else if(authMode==='update'){
   if(password.length<8)throw Error('La contraseña debe tener mínimo ocho caracteres.');
   const {error}=await db.auth.updateUser({password});
   if(error)throw error;
   setAuthMessage('Contraseña actualizada. Ingresa nuevamente.',true);
   await db.auth.signOut();authUI('login');
  }else if(authMode==='register'){
   if(!$('authLegal').checked)throw Error('Debes aceptar los términos y el aviso de privacidad.');
   if(password.length<8)throw Error('La contraseña debe tener mínimo ocho caracteres.');
   const invite=invitationToken();
   const confirmUrl=location.origin+location.pathname+(invite?'?invitacion='+encodeURIComponent(invite):'');
   const {data,error}=await db.auth.signUp({email,password,options:{emailRedirectTo:confirmUrl}});
   if(error)throw error;
   if(data.session){await bootstrap()}
   else{setAuthMessage('Cuenta registrada. Revisa tu correo y confirma tu dirección antes de ingresar.',true);authUI('login');setAuthMessage('Revisa tu correo para confirmar la cuenta y luego ingresa.',true)}
  }else{
   const {error}=await db.auth.signInWithPassword({email,password});
   if(error)throw error;
   await bootstrap();
  }
 }catch(err){setAuthMessage(fail(err))}
 finally{setLoading(false)}
}
async function logout(){
 if(!db)return;try{await db.auth.signOut()}catch(e){console.warn(e)}
 user=null;org=null;leads=[];organizations=[];memberships=[];show('authScreen');authUI('login');
 document.body.classList.remove('drawer-open')
}
async function bootstrap(){
 if(!db){setAuthMessage('El servicio de autenticación no pudo cargarse. Recarga la página.');return}
 const {data:{user:me},error:authError}=await db.auth.getUser();
 if(authError||!me){show('authScreen');return}
 user=me;
 $('sidebarEmail').textContent=user.email||'';
 $('userAvatar').textContent=(user.email||'M')[0].toUpperCase();
 $('companyEmail').value=user.email||'';
 const {data:acceptance,error:acceptanceError}=await db.from('saas_aceptaciones').select('version').eq('usuario_id',user.id).eq('version','2026-10-29-v1').maybeSingle();
 if(acceptanceError){show('authScreen');setAuthMessage('No se pudo comprobar la aceptación de condiciones: '+acceptanceError.message);return}
 if(!acceptance){show('consentScreen');return}
 const token=invitationToken();
 if(token){
  const {error}=await db.rpc('saas_aceptar_invitacion',{p_token:token});
  if(error){show('authScreen');setAuthMessage('Invitación no aceptada: '+fail(error));return}
  cleanInviteUrl();
 }
 const {data:orgRows,error:orgError}=await db.from('saas_organizaciones').select('*').order('creado_en',{ascending:true});
 if(orgError){show('authScreen');setAuthMessage('No fue posible leer tus empresas: '+orgError.message);return}
 organizations=orgRows||[];
 const {data:ms,error:msError}=await db.from('saas_miembros').select('organizacion_id,usuario_id,rol').eq('usuario_id',user.id);
 if(msError){show('authScreen');setAuthMessage('No fue posible verificar los permisos: '+msError.message);return}
 memberships=ms||[];
 if(!organizations.length){show('onboardingScreen');return}
 const preferred=localStorage.getItem('mired360_saas_last_org');
 org=organizations.find(x=>x.id===preferred)||organizations[0];
 if(org.propietario_id===user.id&&!memberships.some(x=>x.organizacion_id===org.id)){
  const {error}=await db.from('saas_miembros').insert({organizacion_id:org.id,usuario_id:user.id,rol:'propietario'});
  if(error){show('onboardingScreen');$('companyMessage').textContent='La empresa existe, pero falta activar el propietario: '+error.message;return}
  return bootstrap();
 }
 await enterOrg();
}
async function createOrg(e){
 e.preventDefault();if(loading||!user)return;
 const name=$('companyName').value.trim(),email=$('companyEmail').value.trim().toLowerCase();
 if(name.length<3)return;
 setLoading(true);$('companyMessage').textContent='';
 try{
  const {data,error}=await db.from('saas_organizaciones')
   .insert({nombre:name,correo_facturacion:email,propietario_id:user.id}).select('*').single();
  if(error)throw error;
  const {error:memberError}=await db.from('saas_miembros')
   .insert({organizacion_id:data.id,usuario_id:user.id,rol:'propietario'});
  if(memberError)throw memberError;
  await bootstrap();
 }catch(e){$('companyMessage').textContent=fail(e)+' Si tu empresa ya se creó, vuelve a ingresar.'}
 finally{setLoading(false)}
}
function editable(){
 return !!org && ((org.estado_suscripcion==='activa'&&org.vigente_hasta&&new Date(org.vigente_hasta)>new Date())||(org.estado_suscripcion==='prueba'&&new Date(org.prueba_hasta)>new Date()));
}
function isOwner(){return !!org&&!!user&&org.propietario_id===user.id}
function currentRole(){return (memberships.find(x=>x.organizacion_id===org?.id)||{}).rol||'asesor'}
async function enterOrg(){
 localStorage.setItem('mired360_saas_last_org',org.id);
 $('orgNameSide').textContent=org.nombre;$('orgAvatar').textContent=(org.nombre||'E')[0].toUpperCase();
 $('orgPlanSide').textContent='Plan '+org.plan;
 $('settingsName').value=org.nombre;$('settingsEmail').value=org.correo_facturacion;
 $('heroPlan').textContent=org.plan==='prueba'?'Prueba gratuita':'Plan '+org.plan;
 const days=Math.max(0,Math.ceil((new Date(org.prueba_hasta)-new Date())/86400000));
 $('heroDays').textContent=org.estado_suscripcion==='prueba'?days+' días restantes':'Estado: '+org.estado_suscripcion;
 const active=editable();
 $('trialBanner').classList.toggle('hidden',active&&org.estado_suscripcion==='activa');
 $('trialBanner').classList.toggle('expired',!active);
 if(org.estado_suscripcion==='prueba'){
  $('trialBanner').textContent=active?'Tu prueba está activa: '+days+' día(s) restante(s). Activa un plan cuando estés listo.':'La prueba terminó. Puedes consultar y exportar datos; solicita una suscripción para seguir registrando.';
 }else if(!active){$('trialBanner').textContent='El acceso de escritura está suspendido. Solicita la reactivación a MIRED360.'}
 $('addLead').disabled=!active;
 const switcher=$('orgSwitcher');switcher.innerHTML='';
 organizations.forEach(o=>{const opt=document.createElement('option');opt.value=o.id;opt.textContent=o.nombre;switcher.appendChild(opt)});
 switcher.value=org.id;switcher.classList.toggle('hidden',organizations.length<2);
 $('teamAdmin').classList.toggle('hidden',!isOwner());$('inviteHistoryCard').classList.toggle('hidden',!isOwner());
 $('settingsForm').querySelectorAll('input,button').forEach(el=>el.disabled=!isOwner());
 $('subscriptionDetails').innerHTML='<p><strong>Plan actual:</strong> '+escapeHTML(org.plan)+'</p><p><strong>Estado:</strong> '+escapeHTML(org.estado_suscripcion)+'</p><p><strong>Fin de prueba:</strong> '+dateFmt(org.prueba_hasta)+'</p><p><strong>Suscripción hasta:</strong> '+dateFmt(org.vigente_hasta)+'</p>';
 show('saasApp');await Promise.all([loadLeads(),loadTeam()]);navigate('dashboard');
}
async function loadLeads(){
 if(!org)return;
 $('syncStatus').textContent='Sincronizando...';
 let all=[];let start=0;
 try{
  while(true){
   const {data,error}=await db.from('saas_prospectos').select('*').eq('organizacion_id',org.id).order('creado_en',{ascending:false}).range(start,start+499);
   if(error)throw error;all.push(...(data||[]));
   if(!data||data.length<500||all.length>=20000)break;
   start+=500;
  }
  leads=all;
  $('syncStatus').textContent='Datos actualizados';
  render();
 }catch(e){$('syncStatus').textContent='Error de sincronización';flash(fail(e),true)}
}
function card(title,value,desc){return '<div class="metric"><small>'+escapeHTML(title)+'</small><strong>'+escapeHTML(value)+'</strong><em>'+escapeHTML(desc)+'</em></div>'}
function badge(s){let k=s==='Instalado'||s==='Venta'?'ok':s==='Seguimiento'?'warn':s==='Perdido'?'danger':'';return '<span class="badge '+k+'">'+escapeHTML(s)+'</span>'}
function bars(rows){
 const max=Math.max(1,...rows.map(r=>r[1]));return rows.map(r=>'<div class="bar"><span>'+escapeHTML(r[0])+'</span><div class="track"><span style="width:'+Math.round(100*r[1]/max)+'%"></span></div><b>'+r[1]+'</b></div>').join('')||'<p class="muted">Sin datos todavía.</p>'
}
function tableEmpty(cols,text){return '<tr><td colspan="'+cols+'" class="empty">'+escapeHTML(text)+'</td></tr>'}
function render(){
 const count=leads.length,sold=leads.filter(l=>['Venta','Instalado'].includes(l.estado)),installed=leads.filter(l=>l.estado==='Instalado');
 const tasks=leads.filter(l=>l.proximo_seguimiento&& !['Perdido','Instalado'].includes(l.estado)).sort((a,b)=>a.proximo_seguimiento.localeCompare(b.proximo_seguimiento));
 const revenue=sold.reduce((n,l)=>n+Number(l.valor_mensual||0),0);
 $('metrics').innerHTML=card('Prospectos',count,'Contactos registrados')+card('Seguimientos',tasks.length,'Gestiones programadas')+card('Cierres',sold.length,'Ventas e instalados')+card('Instalados',installed.length,'Servicios completados');
 $('pipeline').innerHTML=bars(statuses.map(s=>[s,leads.filter(l=>l.estado===s).length]));
 $('salesMetrics').innerHTML=card('Ventas',sold.length,'Negocios cerrados')+card('Instalados',installed.length,'Registros instalados')+card('Valor mensual',money(revenue),'Total estimado')+card('Conversión',count?Math.round(sold.length/count*100)+'%':'0%','Sobre prospectos');
 $('reportMetrics').innerHTML=card('Prospectos',count,'En tu empresa')+card('Ventas',sold.length,'Negocios cerrados')+card('Valor mensual',money(revenue),'Estimado')+card('Ciudades',new Set(leads.map(l=>l.ciudad).filter(Boolean)).size,'Con presencia');
 $('reportBars').innerHTML=$('pipeline').innerHTML;
 const sources={};leads.forEach(l=>sources[l.origen]=(sources[l.origen]||0)+1);
 $('sourcesBars').innerHTML=bars(Object.entries(sources).sort((a,b)=>b[1]-a[1]));
 $('nextTasks').innerHTML=tasks.slice(0,5).map(l=>'<div class="task"><div><b>'+escapeHTML(l.nombre)+'</b><small>'+dateFmt(l.proximo_seguimiento)+'</small></div><button data-edit="'+l.id+'">Abrir</button></div>').join('')||'<p class="muted">No hay seguimientos pendientes.</p>';
 const query=$('leadSearch').value.toLocaleLowerCase('es').trim(),state=$('leadFilter').value;
 const filtered=leads.filter(l=>(!state||l.estado===state)&&(!query||[l.nombre,l.telefono,l.ciudad,l.producto,l.origen].join(' ').toLocaleLowerCase('es').includes(query)));
 $('leadRows').innerHTML=filtered.map(l=>'<tr><td><b>'+escapeHTML(l.nombre)+'</b></td><td>'+escapeHTML(l.telefono)+'</td><td>'+escapeHTML(l.ciudad)+'</td><td>'+escapeHTML(l.producto)+'</td><td>'+badge(l.estado)+'</td><td>'+money(l.valor_mensual)+'</td><td><button class="btn secondary" data-edit="'+l.id+'">Editar</button></td></tr>').join('')||tableEmpty(7,'No hay prospectos que coincidan.');
 $('taskRows').innerHTML=tasks.map(l=>'<tr><td>'+escapeHTML(l.nombre)+'</td><td>'+escapeHTML(l.telefono)+'</td><td>'+dateFmt(l.proximo_seguimiento)+'</td><td>'+badge(l.estado)+'</td><td><button class="btn secondary" data-edit="'+l.id+'">Gestionar</button></td></tr>').join('')||tableEmpty(5,'Sin gestiones programadas.');
 $('salesRows').innerHTML=sold.map(l=>'<tr><td>'+escapeHTML(l.nombre)+'</td><td>'+escapeHTML(l.producto)+'</td><td>'+escapeHTML(l.ciudad)+'</td><td>'+badge(l.estado)+'</td><td>'+money(l.valor_mensual)+'</td></tr>').join('')||tableEmpty(5,'Sin ventas registradas.');
}
async function loadTeam(){
 if(!org)return;
 const {data,error}=await db.from('saas_miembros').select('usuario_id,rol,creado_en').eq('organizacion_id',org.id);
 if(error){flash(fail(error),true);return}
 members=data||[];
 $('memberRows').innerHTML=members.map(m=>{
  const self=m.usuario_id===user.id;
  return '<tr><td>'+escapeHTML(self?(user.email||'Mi cuenta'):'Usuario '+m.usuario_id.slice(0,8)+'…')+'</td><td>'+escapeHTML(m.rol)+'</td><td>'+(isOwner()&&!self?'<button class="btn secondary" data-remove="'+m.usuario_id+'">Retirar</button>':self?'<span class="badge ok">Tu cuenta</span>':'<span class="badge">Activo</span>')+'</td></tr>'
 }).join('')||tableEmpty(3,'Sin miembros');
 if(isOwner()){
  const {data:invitations,error:inviteError}=await db.from('saas_invitaciones').select('correo,rol,vence_en,aceptada_en').eq('organizacion_id',org.id).order('creado_en',{ascending:false}).limit(50);
  if(inviteError){flash(fail(inviteError),true);return}
  $('inviteRows').innerHTML=(invitations||[]).map(i=>'<tr><td>'+escapeHTML(i.correo)+'</td><td>'+escapeHTML(i.rol)+'</td><td>'+dateFmt(i.vence_en)+'</td><td>'+badge(i.aceptada_en?'Aceptada':new Date(i.vence_en)<new Date()?'Vencida':'Pendiente')+'</td></tr>').join('')||tableEmpty(4,'Aún no has enviado invitaciones.');
 }
}
function navigate(page){
 if(!$('view-'+page))return;activePage=page;
 document.querySelectorAll('.view').forEach(v=>v.classList.toggle('active',v.id==='view-'+page));
 document.querySelectorAll('[data-page]').forEach(b=>b.classList.toggle('active',b.dataset.page===page));
 document.querySelectorAll('[data-mobile]').forEach(b=>b.classList.toggle('active',b.dataset.mobile===page));
 document.body.classList.remove('drawer-open');
 window.scrollTo({top:0,behavior:'smooth'});
}
function openLead(id){
 if(!editable()){flash('Activa un plan para registrar o editar prospectos.',true);return}
 modalEditing=id||null;
 const l=id?leads.find(x=>x.id===id):null;
 if(id&&!l)return;
 $('leadForm').reset();$('leadId').value=l?.id||'';
 $('leadAuthorization').checked=!!l;
 const fields={leadName:'nombre',leadPhone:'telefono',leadEmail:'correo',leadCity:'ciudad',leadSource:'origen',leadProduct:'producto',leadStatus:'estado',leadValue:'valor_mensual',leadFollow:'proximo_seguimiento',leadNotes:'notas'};
 Object.entries(fields).forEach(([id,key])=>{if(l)$(id).value=l[key]??''});
 $('leadTitle').textContent=l?'Editar prospecto':'Nuevo prospecto';
 $('leadModal').classList.remove('hidden');$('leadName').focus()
}
function closeLead(){$('leadModal').classList.add('hidden');modalEditing=null}
async function saveLead(e){
 e.preventDefault();if(!org||!user||!editable())return;
 const payload={
 nombre:$('leadName').value.trim(),telefono:$('leadPhone').value.trim(),correo:$('leadEmail').value.trim(),
 ciudad:$('leadCity').value.trim(),origen:$('leadSource').value,producto:$('leadProduct').value.trim(),
 estado:$('leadStatus').value,valor_mensual:Number($('leadValue').value||0),
 proximo_seguimiento:$('leadFollow').value||null,notas:$('leadNotes').value.trim()
 };
 if(!$('leadAuthorization').checked)return flash('Confirma que puedes tratar los datos del cliente.',true);
 if(payload.nombre.length<2||!Number.isFinite(payload.valor_mensual)||payload.valor_mensual<0)return flash('Revisa el nombre y el valor.',true);
 $('leadSubmit').disabled=true;
 try{
  let res;
  if(modalEditing){
   res=await db.from('saas_prospectos').update({...payload,actualizado_en:new Date().toISOString()}).eq('id',modalEditing).eq('organizacion_id',org.id).select('id').maybeSingle();
   if(!res.error&&!res.data)throw Error('No tienes permiso para actualizar este prospecto.');
  }else{
   res=await db.from('saas_prospectos').insert({...payload,organizacion_id:org.id,creado_por:user.id,autorizacion_confirmada:true}).select('id').single();
  }
  if(res.error)throw res.error;
  const wasEdit=!!modalEditing;
  const contactId=wasEdit?modalEditing:res.data.id;
  closeLead();
  try{await db.from('saas_actividades').insert({organizacion_id:org.id,prospecto_id:contactId,usuario_id:user.id,tipo:wasEdit?'cambio_estado':'nota',detalle:wasEdit?'Prospecto actualizado':'Prospecto creado'});}
  catch(e){console.warn(e)}
  await loadLeads();flash(wasEdit?'Prospecto actualizado.':'Prospecto guardado.');
 }catch(e){flash(fail(e),true)}
 finally{$('leadSubmit').disabled=false}
}
async function invite(e){
 e.preventDefault();if(!isOwner())return;
 $('inviteSubmit').disabled=true;
 try{
  const mail=$('inviteEmail').value.trim().toLowerCase(),role=$('inviteRole').value;
  const {data,error}=await db.rpc('saas_crear_invitacion',{p_org:org.id,p_correo:mail,p_rol:role});
  if(error)throw error;
  const link=new URL(location.href);link.search='';link.hash='';link.searchParams.set('invitacion',data);
  $('inviteLink').value=link.toString();$('inviteResult').classList.remove('hidden');
  await loadTeam();flash('Invitación creada: comparte el enlace solamente con su destinatario.');
 }catch(e){flash(fail(e),true)}
 finally{$('inviteSubmit').disabled=false}
}
async function removeMember(uid){
 if(!isOwner()||!confirm('¿Retirar el acceso de este colaborador?'))return;
 const {data,error}=await db.rpc('saas_retirar_miembro',{p_org:org.id,p_usuario:uid});
 if(error)return flash(fail(error),true);
 await loadTeam();flash(data?'Acceso retirado.':'No se encontró el colaborador.');
}
async function saveSettings(e){
 e.preventDefault();if(!isOwner())return;
 const name=$('settingsName').value.trim(),email=$('settingsEmail').value.trim().toLowerCase();
 const {data,error}=await db.from('saas_organizaciones').update({nombre:name,correo_facturacion:email}).eq('id',org.id).select('*').single();
 if(error)return flash(fail(error),true);
 org=data;organizations=organizations.map(o=>o.id===org.id?data:o);
 $('orgNameSide').textContent=org.nombre;$('orgAvatar').textContent=org.nombre[0].toUpperCase();flash('Datos empresariales actualizados.');
}
function exportCsv(){
 if(!org)return;
 const cols=['Nombre','Teléfono','Correo','Ciudad','Origen','Producto','Estado','Valor mensual','Próximo seguimiento','Notas'];
 const rows=leads.map(l=>[l.nombre,l.telefono,l.correo,l.ciudad,l.origen,l.producto,l.estado,l.valor_mensual,l.proximo_seguimiento||'',l.notas||'']);
 const esc=v=>'"'+String(v??'').replace(/^[=+\-@\t\r]/,"'").replace(/"/g,'""')+'"';
 const csv='\ufeff'+[cols,...rows].map(r=>r.map(esc).join(';')).join('\r\n');
 const href=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));
 const a=document.createElement('a');a.href=href;a.download='MIRED360_'+org.nombre.replace(/[^\w-]/g,'_').slice(0,25)+'_prospectos.csv';a.click();
 setTimeout(()=>URL.revokeObjectURL(href),1500);
}
function events(){
 $('authForm').addEventListener('submit',onAuthSubmit);
 $('authSwitch').addEventListener('click',()=>authUI(authMode==='login'?'register':'login'));
 $('authReset').addEventListener('click',()=>authUI('recover'));
 $('companyForm').addEventListener('submit',createOrg);
 $('consentForm').addEventListener('submit',async e=>{
  e.preventDefault();if(!user||!$('termsCheck').checked)return;
  const {error}=await db.from('saas_aceptaciones').insert({usuario_id:user.id,version:'2026-10-29-v1'});
  if(error){$('consentMessage').textContent=fail(error);return}
  $('consentMessage').textContent='';
  await bootstrap();
 });
 $('consentLogout').addEventListener('click',logout);
 $('companyLogout').addEventListener('click',logout);
 $('logout').addEventListener('click',logout);
 $('leadForm').addEventListener('submit',saveLead);
 $('inviteForm').addEventListener('submit',invite);
 $('settingsForm').addEventListener('submit',saveSettings);
 $('addLead').addEventListener('click',()=>openLead());
 $('closeLead').addEventListener('click',closeLead);$('cancelLead').addEventListener('click',closeLead);
 $('leadModal').addEventListener('click',e=>{if(e.target===$('leadModal'))closeLead()});
 $('leadSearch').addEventListener('input',render);$('leadFilter').addEventListener('change',render);
 $('exportBtn').addEventListener('click',exportCsv);$('exportReport').addEventListener('click',exportCsv);
 $('orgSwitcher').addEventListener('change',async e=>{const v=organizations.find(o=>o.id===e.target.value);if(v){org=v;await enterOrg()}});
 $('copyInvite').addEventListener('click',async()=>{
  try{await navigator.clipboard.writeText($('inviteLink').value);flash('Enlace copiado.')}catch(e){$('inviteLink').select();flash('Selecciona y copia el enlace.')}
 });
 $('openMenu').addEventListener('click',()=>document.body.classList.add('drawer-open'));
 $('scrim').addEventListener('click',()=>document.body.classList.remove('drawer-open'));
 $('fullscreen').addEventListener('click',()=>{if(document.fullscreenElement){document.exitFullscreen().catch(()=>{})}else if(document.documentElement.requestFullscreen)document.documentElement.requestFullscreen().catch(()=>{})});
 $('changePassword').addEventListener('click',async()=>{
  const {error}=await db.auth.resetPasswordForEmail(user.email,{redirectTo:location.origin+location.pathname});
  flash(error?fail(error):'Se enviaron instrucciones a tu correo.',!!error)
 });
 document.addEventListener('click',e=>{
  const nav=e.target.closest('[data-page]'),go=e.target.closest('[data-go]'),mob=e.target.closest('[data-mobile]'),edit=e.target.closest('[data-edit]'),rm=e.target.closest('[data-remove]');
  if(nav)navigate(nav.dataset.page);if(go)navigate(go.dataset.go);
  if(mob){if(mob.dataset.mobile==='menu')document.body.classList.add('drawer-open');else navigate(mob.dataset.mobile)}
  if(edit)openLead(edit.dataset.edit);
  if(rm)removeMember(rm.dataset.remove)
 });
 document.addEventListener('keydown',e=>{if(e.key==='Escape'){closeLead();document.body.classList.remove('drawer-open')}});
}
async function init(){
 events();
 if(!db){show('authScreen');setAuthMessage('No se pudo cargar la conexión. Revisa internet y vuelve a cargar.');return}
 db.auth.onAuthStateChange((event)=>{
  if(event==='PASSWORD_RECOVERY'){show('authScreen');authUI('update')}
  if(event==='SIGNED_OUT'){user=null;org=null;show('authScreen')}
 });
 const {data:{session}}=await db.auth.getSession();
 if(session?.user){try{await bootstrap()}catch(e){show('authScreen');setAuthMessage('Error al iniciar: '+fail(e))}}
 else{show('authScreen');authUI('login')}
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();