(function(){
  let advisorDirectory=[];
  let loading=false;

  function esc(v){
    return String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
  }

  function optionHtml(a){
    const name=esc(a.nombre||a.email||'Asesor');
    return `<option value="${name}" data-user-id="${a.user_id}">${name}</option>`;
  }

  function ensureSaveButton(select){
    if(document.getElementById('advisorSaveBtn'))return;
    const btn=document.createElement('button');
    btn.id='advisorSaveBtn';
    btn.type='button';
    btn.className='btn primary';
    btn.style.marginTop='6px';
    btn.style.width='100%';
    btn.textContent='Guardar asignación';
    btn.addEventListener('click',()=>window.saveAdvisorName());
    const label=select.closest('label');
    if(label)label.appendChild(btn);
  }

  async function setupAdvisorSelector(){
    if(loading)return;
    loading=true;
    try{
      const current=document.getElementById('advisorName');
      if(!current)return;

      let select=current;
      if(current.tagName!=='SELECT'){
        select=document.createElement('select');
        select.id='advisorName';
        select.innerHTML='<option value="">Cargando asesores...</option>';
        current.replaceWith(select);
      }
      ensureSaveButton(select);

      const {data,error}=await sb.from('perfiles')
        .select('user_id,nombre,email,rol')
        .eq('rol','asesor')
        .order('nombre',{ascending:true});

      if(error){
        console.error('No se pudieron cargar asesores',error);
        select.innerHTML='<option value="">Error cargando asesores</option>';
        const status=document.getElementById('baseStatus');
        if(status)status.textContent='No fue posible cargar la lista de asesores: '+error.message;
        return;
      }

      advisorDirectory=data||[];
      select.innerHTML='<option value="">Sin asesor asignado</option>'+advisorDirectory.map(optionHtml).join('');
      syncCurrentAdvisor();
    } finally {
      loading=false;
    }
  }

  function syncCurrentAdvisor(){
    const select=document.getElementById('advisorName');
    if(!select || select.tagName!=='SELECT')return;
    if(typeof activeBase!=='undefined' && activeBase?.asesor_user_id){
      const opt=[...select.options].find(o=>o.dataset?.userId===activeBase.asesor_user_id);
      if(opt){select.value=opt.value;return;}
    }
    if(typeof activeBase!=='undefined' && activeBase?.asesor_nombre){
      const opt=[...select.options].find(o=>o.value===activeBase.asesor_nombre);
      if(opt){select.value=opt.value;return;}
    }
    select.value='';
  }

  async function saveAdvisorNameSafe(){
    if(typeof activeBase==='undefined' || !activeBase){
      alert('Selecciona primero una base.');
      return;
    }
    const select=document.getElementById('advisorName');
    if(!select || select.tagName!=='SELECT'){
      alert('La lista de asesores aún no está lista. Actualiza la página e inténtalo nuevamente.');
      return;
    }

    const selected=select.options[select.selectedIndex];
    const advisorUserId=selected?.dataset?.userId||null;
    const advisorName=advisorUserId ? (selected?.value||null) : null;
    const btn=document.getElementById('advisorSaveBtn');
    select.disabled=true;
    if(btn){btn.disabled=true;btn.textContent='Guardando...';}

    try{
      const {data,error}=await sb.rpc('asignar_asesor_base',{
        p_base_id:activeBase.id,
        p_asesor_user_id:advisorUserId||null
      });

      if(error)throw error;

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
    }catch(error){
      console.error('Error asignando asesor',error);
      alert('No se pudo asignar el asesor. '+String(error?.message||error));
      syncCurrentAdvisor();
    }finally{
      select.disabled=false;
      if(btn){btn.disabled=false;btn.textContent='Guardar asignación';}
    }
  }

  window.saveAdvisorName=saveAdvisorNameSafe;

  const originalSelectBase=typeof window.selectBase==='function'?window.selectBase:null;
  if(originalSelectBase){
    window.selectBase=async function(id){
      const result=await originalSelectBase(id);
      setTimeout(syncCurrentAdvisor,50);
      return result;
    };
  }

  function start(){
    setupAdvisorSelector();
    setTimeout(setupAdvisorSelector,800);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);
  else start();
})();
