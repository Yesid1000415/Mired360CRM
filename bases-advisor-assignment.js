(function(){
  let advisorDirectory=[];

  function optionHtml(a){
    const name=String(a.nombre||a.email||'Asesor').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
    return `<option value="${name}" data-user-id="${a.user_id}">${name}</option>`;
  }

  async function setupAdvisorSelector(){
    const current=document.getElementById('advisorName');
    if(!current)return;

    let select=current;
    if(current.tagName!=='SELECT'){
      select=document.createElement('select');
      select.id='advisorName';
      select.innerHTML='<option value="">Sin asesor asignado</option>';
      select.addEventListener('change',()=>window.saveAdvisorName());
      current.replaceWith(select);
    }

    const {data,error}=await sb.from('perfiles')
      .select('user_id,nombre,email,rol')
      .eq('rol','asesor')
      .order('nombre',{ascending:true});

    if(error){
      console.error('No se pudieron cargar asesores',error);
      select.innerHTML='<option value="">No fue posible cargar asesores</option>';
      return;
    }

    advisorDirectory=data||[];
    select.innerHTML='<option value="">Sin asesor asignado</option>'+advisorDirectory.map(optionHtml).join('');
    if(typeof activeBase!=='undefined' && activeBase?.asesor_nombre){
      select.value=activeBase.asesor_nombre;
    }
  }

  async function saveAdvisorNameSafe(){
    if(typeof activeBase==='undefined' || !activeBase)return;
    const select=document.getElementById('advisorName');
    if(!select)return;

    const selected=select.options[select.selectedIndex];
    const advisorUserId=selected?.dataset?.userId||null;
    const advisorName=advisorUserId ? (selected?.value||null) : null;
    select.disabled=true;

    const {data,error}=await sb.rpc('asignar_asesor_base',{
      p_base_id:activeBase.id,
      p_asesor_user_id:advisorUserId||null
    });

    select.disabled=false;
    if(error){
      alert('No se pudo asignar el asesor. '+error.message);
      if(activeBase?.asesor_nombre)select.value=activeBase.asesor_nombre;
      return;
    }

    const saved=Array.isArray(data)?data[0]:data;
    activeBase.asesor_user_id=saved?.asesor_user_id||null;
    activeBase.asesor_nombre=saved?.asesor_nombre||advisorName||null;
    const base=typeof bases!=='undefined'?bases.find(x=>x.id===activeBase.id):null;
    if(base){
      base.asesor_user_id=activeBase.asesor_user_id;
      base.asesor_nombre=activeBase.asesor_nombre;
    }

    if(typeof contacts!=='undefined' && typeof extensionShort==='function'){
      const status=document.getElementById('baseStatus');
      if(status)status.textContent=`${activeBase.nombre} · ${contacts.length} registros · Extensión ${extensionShort(activeBase.extension)}${activeBase.asesor_nombre?' · Asesor: '+activeBase.asesor_nombre:''}`;
    }

    alert(activeBase.asesor_nombre
      ? 'Base asignada correctamente a '+activeBase.asesor_nombre+'.'
      : 'La base quedó sin asesor asignado.');
  }

  window.saveAdvisorName=saveAdvisorNameSafe;

  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',()=>setTimeout(setupAdvisorSelector,250));
  }else{
    setTimeout(setupAdvisorSelector,250);
  }
})();
