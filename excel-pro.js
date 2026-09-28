function exportExcelPro(){
  if(typeof XLSX==='undefined'){
    alert('No se pudo cargar el generador de Excel. Actualiza la página e inténtalo nuevamente.');
    return;
  }
  try{
    const wb=XLSX.utils.book_new();
    wb.Props={Title:'MIRED360 CRM - Reporte comercial',Subject:'Exportación comercial',Author:'MIRED360SERVICIOS',Company:'MIRED360SERVICIOS',CreatedDate:new Date()};

    const ventas=leads.filter(l=>['Venta','Pendiente instalación','Instalado'].includes(l.status));
    const instalados=leads.filter(l=>l.status==='Instalado');
    const seguimientos=leads.filter(l=>l.nextFollow&&!['Instalado','No interesado'].includes(l.status)).sort((a,b)=>String(a.nextFollow).localeCompare(String(b.nextFollow)));
    const noInteresados=leads.filter(l=>l.status==='No interesado');
    const valorVentas=ventas.reduce((s,l)=>s+Number(l.value||0),0);
    const comisiones=ventas.reduce((s,l)=>s+Number(l.commission||0),0);
    const tasa=leads.length?ventas.length/leads.length:0;

    const resumen=[
      ['MIRED360SERVICIOS','REPORTE COMERCIAL CRM'],
      ['Fecha de exportación',new Date().toLocaleString('es-CO')],
      [],
      ['Indicador','Resultado'],
      ['Prospectos',leads.length],
      ['Seguimientos pendientes',seguimientos.length],
      ['Ventas',ventas.length],
      ['Instalados',instalados.length],
      ['No interesados',noInteresados.length],
      ['Tasa de conversión',tasa],
      ['Valor mensual de ventas',valorVentas],
      ['Comisiones registradas',comisiones]
    ];
    const wsResumen=XLSX.utils.aoa_to_sheet(resumen);
    wsResumen['!cols']=[{wch:30},{wch:24}];
    if(wsResumen['B10'])wsResumen['B10'].z='0.0%';
    if(wsResumen['B11'])wsResumen['B11'].z='$#,##0';
    if(wsResumen['B12'])wsResumen['B12'].z='$#,##0';
    XLSX.utils.book_append_sheet(wb,wsResumen,'Resumen');

    const leadRow=l=>({
      'Fecha ingreso':l.created||'',
      'Cliente':l.name||'',
      'Teléfono':l.phone||'',
      'Ciudad':l.city||'',
      'Barrio':l.barrio||'',
      'Dirección':l.address||'',
      'Origen':l.origin||'',
      'Campaña':l.campaign||'',
      'Producto':l.product||'',
      'Operador':l.operator||'',
      'Plan':l.plan||'',
      'Valor mensual':Number(l.value||0),
      'Estado':l.status||'',
      'Próximo seguimiento':l.nextFollow||'',
      'Fecha instalación':l.installDate||'',
      'Comisión':Number(l.commission||0),
      'Notas':l.notes||''
    });

    const widths=[12,24,15,16,18,28,18,22,22,16,28,16,22,18,18,16,38].map(wch=>({wch}));
    const appendTable=(name,items)=>{
      const rows=items.length?items.map(leadRow):[leadRow({})];
      const ws=XLSX.utils.json_to_sheet(rows);
      ws['!cols']=widths;
      if(ws['!ref']){
        const range=XLSX.utils.decode_range(ws['!ref']);
        ws['!autofilter']={ref:XLSX.utils.encode_range({s:{r:0,c:0},e:{r:range.e.r,c:range.e.c}})};
        for(let r=1;r<=range.e.r;r++){
          const valor=ws[XLSX.utils.encode_cell({r:r,c:11})];
          const comision=ws[XLSX.utils.encode_cell({r:r,c:15})];
          if(valor)valor.z='$#,##0';
          if(comision)comision.z='$#,##0';
        }
      }
      XLSX.utils.book_append_sheet(wb,ws,name);
    };

    appendTable('Prospectos',leads);
    appendTable('Ventas',ventas);
    appendTable('Seguimientos',seguimientos);
    appendTable('Instalados',instalados);

    XLSX.writeFile(wb,'MIRED360_CRM_'+today()+'.xlsx');
  }catch(e){
    console.error(e);
    alert('No se pudo generar el Excel Pro. '+String(e.message||e));
  }
}

/* Administración segura de usuarios de asesores.
   Se carga después del CRM y reemplaza únicamente las funciones de la sección Usuarios. */
window.addEventListener('load',()=>{
  const ADMIN_ADVISOR_URL='https://lpiusomsuswdcraoozdn.supabase.co/functions/v1/administrar-asesor';
  window.miredAdvisorAdminCache=[];

  const html=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
  const groupLabel=g=>g==='callcenter'?'Call Center':'Asesores actuales';

  async function advisorAdminRequest(payload){
    const {data:{session}}=await supabaseClient.auth.getSession();
    if(!session?.access_token)throw new Error('La sesión terminó. Ingresa nuevamente al CRM.');
    const res=await fetch(ADMIN_ADVISOR_URL,{
      method:'POST',
      headers:{'Content-Type':'application/json','Authorization':'Bearer '+session.access_token,'apikey':SUPABASE_KEY},
      body:JSON.stringify(payload)
    });
    const data=await res.json().catch(()=>({}));
    if(!res.ok)throw new Error(data.error||'No fue posible realizar la operación.');
    return data;
  }

  function prepareAdvisorTable(){
    const table=document.querySelector('#usuarios table');
    if(!table)return;
    const head=table.querySelector('thead tr');
    if(head)head.innerHTML='<th>Nombre</th><th>Correo</th><th>Grupo</th><th>Estado</th><th>Fecha de creación</th><th>Acciones</th>';
    table.style.minWidth='1050px';
  }

  window.loadAdvisorUsers=async function(){
    prepareAdvisorTable();
    const {data,error}=await supabaseClient.from('perfiles').select('user_id,nombre,email,rol,grupo,activo,creado_en').order('creado_en',{ascending:false});
    const rows=document.getElementById('advisorUsersRows');
    if(!rows)return;
    if(error){rows.innerHTML='<tr><td colspan="6" class="empty">No fue posible cargar los usuarios: '+html(error.message)+'</td></tr>';return;}
    const advisors=(data||[]).filter(x=>x.rol==='asesor');
    window.miredAdvisorAdminCache=advisors;
    const count=document.getElementById('advisorUsersCount');
    if(count)count.textContent=advisors.length+' asesor(es)';
    rows.innerHTML=advisors.map(x=>{
      const active=x.activo!==false;
      return `<tr>
        <td><b>${html(x.nombre||'')}</b></td>
        <td>${html(x.email||'')}</td>
        <td><span class="badge">${html(groupLabel(x.grupo))}</span></td>
        <td><span class="badge ${active?'ok':'danger'}">${active?'Activo':'Desactivado'}</span></td>
        <td>${html(new Date(x.creado_en).toLocaleDateString('es-CO'))}</td>
        <td style="white-space:nowrap">
          <button class="btn ghost" onclick="editAdvisor('${x.user_id}')">✏️ Editar</button>
          <button class="btn ghost" onclick="toggleAdvisor('${x.user_id}',${active?'false':'true'})">${active?'⛔ Desactivar':'✅ Reactivar'}</button>
          <button class="btn danger-btn" onclick="deleteTestAdvisor('${x.user_id}')">🗑️ Eliminar prueba</button>
        </td>
      </tr>`;
    }).join('')||'<tr><td colspan="6" class="empty">Aún no hay asesores registrados.</td></tr>';
  };

  window.editAdvisor=async function(userId){
    const x=window.miredAdvisorAdminCache.find(a=>a.user_id===userId);
    if(!x)return;
    const nombre=prompt('Nombre y apellidos del asesor:',x.nombre||'');
    if(nombre===null)return;
    const email=prompt('Correo electrónico del asesor:',x.email||'');
    if(email===null)return;
    const grupoActual=x.grupo==='callcenter'?'callcenter':'asesores_actuales';
    const grupo=prompt('Grupo comercial:\n\nEscribe: callcenter o asesores_actuales',grupoActual);
    if(grupo===null)return;
    const g=String(grupo).trim().toLowerCase();
    if(!['callcenter','asesores_actuales'].includes(g)){alert('Grupo no válido. Usa callcenter o asesores_actuales.');return;}
    if(!nombre.trim()||!/^\S+@\S+\.\S+$/.test(email.trim())){alert('Nombre o correo no válidos.');return;}
    if(!confirm('¿Guardar los cambios de '+(x.nombre||x.email)+'?'))return;
    try{
      const data=await advisorAdminRequest({action:'edit',user_id:userId,nombre:nombre.trim(),email:email.trim(),grupo:g});
      await window.loadAdvisorUsers();
      alert(data.message||'Asesor actualizado correctamente.');
    }catch(e){alert(e.message||'No fue posible editar el asesor.');}
  };

  window.toggleAdvisor=async function(userId,activar){
    const x=window.miredAdvisorAdminCache.find(a=>a.user_id===userId);
    if(!x)return;
    const action=activar?'reactivar':'desactivar';
    const text=activar?'podrá volver a ingresar al CRM':'no podrá ingresar al CRM, pero todo su historial se conservará';
    if(!confirm(`¿${action.charAt(0).toUpperCase()+action.slice(1)} a ${x.nombre||x.email}?\n\nEl asesor ${text}.`))return;
    try{
      const data=await advisorAdminRequest({action:'toggle',user_id:userId,activar:Boolean(activar)});
      await window.loadAdvisorUsers();
      alert(data.message||'Estado actualizado.');
    }catch(e){alert(e.message||'No fue posible cambiar el estado.');}
  };

  window.deleteTestAdvisor=async function(userId){
    const x=window.miredAdvisorAdminCache.find(a=>a.user_id===userId);
    if(!x)return;
    if(!confirm(`ELIMINACIÓN PERMANENTE\n\nEsta opción es solamente para usuarios de prueba sin actividad.\n\n¿Quieres intentar eliminar a ${x.nombre||x.email}?`))return;
    const verify=prompt('Para confirmar escribe exactamente: ELIMINAR');
    if(verify!=='ELIMINAR')return;
    try{
      const data=await advisorAdminRequest({action:'delete',user_id:userId});
      await window.loadAdvisorUsers();
      alert(data.message||'Usuario eliminado definitivamente.');
    }catch(e){alert(e.message||'No fue posible eliminar el usuario.');}
  };
});

/* Acceso aislado a WhatsApp Call Center.
   Se muestra solo a asesores Call Center y a coordinación, sin modificar index.html. */
window.addEventListener('load',async()=>{
  try{
    if(typeof supabaseClient==='undefined')return;
    const {data:{session}}=await supabaseClient.auth.getSession();
    if(!session?.user)return;
    const {data:perfil}=await supabaseClient.from('perfiles').select('rol,grupo,activo').eq('user_id',session.user.id).maybeSingle();
    if(!perfil||perfil.activo===false)return;
    const permitido=perfil.grupo==='callcenter'||perfil.rol==='coordinador'||perfil.rol==='administrador';
    if(!permitido)return;
    const nav=document.querySelector('aside nav');
    if(!nav||document.getElementById('whatsappCallCenterNav'))return;
    const btn=document.createElement('button');
    btn.id='whatsappCallCenterNav';
    btn.type='button';
    btn.textContent='💬 WhatsApp Call Center';
    btn.addEventListener('click',()=>{location.href='whatsapp-callcenter.html?v=1'});
    const academia=[...nav.querySelectorAll('button')].find(x=>String(x.textContent||'').includes('Academia Call Center'));
    if(academia)nav.insertBefore(btn,academia);else nav.appendChild(btn);
  }catch(e){console.warn('No se pudo agregar acceso WhatsApp Call Center',e)}
});