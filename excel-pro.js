/*
  MIRED360 CRM - cargador estable + modo Call Center.
  Conserva la versión funcional anterior y agrega únicamente la separación
  de navegación para asesores del grupo callcenter.
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

  async function applyCallCenterMode(redirectOnFirstEntry=false){
    const perfil=await getCallCenterProfile();
    if(!perfil||perfil.activo===false)return false;
    const isCallCenter=String(perfil.rol||'').toLowerCase()==='asesor'&&perfil.grupo==='callcenter';
    if(!isCallCenter)return false;

    const nav=document.querySelector('aside nav');
    if(!nav)return true;
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

    if(redirectOnFirstEntry&&!sessionStorage.getItem('mired_callcenter_landing')){
      sessionStorage.setItem('mired_callcenter_landing','1');
      location.assign('bases-llamadas.html');
    }
    return true;
  }

  window.addEventListener('load',()=>{
    setTimeout(()=>applyCallCenterMode(false),250);
    setTimeout(()=>applyCallCenterMode(false),1200);

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
