/*
  MIRED360 CRM - cargador estable + modo Call Center.
  Conserva la versión funcional anterior y agrega únicamente la separación
  de navegación para asesores del grupo callcenter y acceso de coordinación.
*/
document.write('<script src="https://cdn.jsdelivr.net/gh/Yesid1000415/Mired360CRM@dff82d2014c5fc3e9f2b4fe11bcc30e6ed8a7b2f/excel-pro.js"><\/script>');

(function(){
  async function getCallCenterProfile(){
    try{
      if(typeof supabaseClient==='undefined')return null;
      const {data:{session}}=await supabaseClient.auth.getSession();
      if(!session?.user)return null;
      const {data:perfil}=await supabaseClient.from('perfiles')
        .select('rol,grupo,activo,nombre')
        .eq('user_id',session.user.id)
        .maybeSingle();
      return perfil||null;
    }catch(e){
      console.warn('No se pudo validar perfil Call Center',e);
      return null;
    }
  }

  function ensureWhatsappCallCenterButton(nav){
    let btn=document.getElementById('whatsappCallCenterNav');
    if(btn)return btn;
    btn=document.createElement('button');
    btn.id='whatsappCallCenterNav';
    btn.type='button';
    btn.textContent='💬 WhatsApp Call Center';
    btn.addEventListener('click',()=>{location.href='whatsapp-callcenter.html?v=1'});
    const rendimiento=[...nav.querySelectorAll('button')].find(x=>x.dataset.link==='rendimiento.html');
    if(rendimiento)nav.insertBefore(btn,rendimiento.nextSibling);else nav.appendChild(btn);
    return btn;
  }

  function ensureCoordinatorDashboardButton(nav){
    let btn=document.getElementById('callCenterDashboardNav');
    if(btn)return btn;
    btn=document.createElement('button');
    btn.id='callCenterDashboardNav';
    btn.type='button';
    btn.textContent='📊 Control Call Center';
    btn.addEventListener('click',()=>{location.href='dashboard-callcenter.html?v=1'});
    const rendimiento=[...nav.querySelectorAll('button')].find(x=>x.dataset.link==='rendimiento.html');
    if(rendimiento)nav.insertBefore(btn,rendimiento);else nav.appendChild(btn);
    return btn;
  }

  async function applyCallCenterMode(redirectToPanel=false){
    const perfil=await getCallCenterProfile();
    if(!perfil||perfil.activo===false)return false;
    const role=String(perfil.rol||'').toLowerCase();
    const isCallCenter=role==='asesor'&&perfil.grupo==='callcenter';
    const isCoordinator=['coordinador','administrador','admin'].includes(role);

    const nav=document.querySelector('aside nav');
    if(isCoordinator&&nav)ensureCoordinatorDashboardButton(nav);
    if(!isCallCenter)return false;

    if(nav){
      const waBtn=ensureWhatsappCallCenterButton(nav);
      const allowed=new Set(['bases-llamadas.html','rendimiento.html','academia-callcenter.html']);
      [...nav.querySelectorAll('button')].forEach(btn=>{
        const keep=btn===waBtn||allowed.has(btn.dataset.link||'');
        btn.style.display=keep?'':'none';
      });
      const ordered=[
        [...nav.querySelectorAll('button')].find(b=>b.dataset.link==='bases-llamadas.html'),
        waBtn,
        [...nav.querySelectorAll('button')].find(b=>b.dataset.link==='rendimiento.html'),
        [...nav.querySelectorAll('button')].find(b=>b.dataset.link==='academia-callcenter.html')
      ].filter(Boolean);
      ordered.forEach(b=>nav.appendChild(b));
      const subtitle=document.querySelector('aside .brand > div:last-child > span');
      if(subtitle)subtitle.textContent='MIRED CALL EN CASA · ASESOR';
    }

    if(redirectToPanel){
      location.replace('callcenter-panel.html?v=1');
    }
    return true;
  }

  window.addEventListener('load',()=>{
    setTimeout(()=>applyCallCenterMode(true),300);

    if(typeof window.enterCRM==='function'&&!window.__miredCallCenterEnterWrapped){
      const original=window.enterCRM;
      window.enterCRM=async function(user){
        const result=await original(user);
        await applyCallCenterMode(true);
        return result;
      };
      window.__miredCallCenterEnterWrapped=true;
    }
  });
})();
