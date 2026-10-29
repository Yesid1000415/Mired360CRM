(function(){
'use strict';
function init(){
  var app=document.getElementById('crmApp');if(!app||app.dataset.corporativoInit)return;
  app.dataset.corporativoInit='1';document.body.classList.add('m360-pro-mode');
  var sidebar=app.querySelector('aside'),nav=sidebar&&sidebar.querySelector('nav'),main=app.querySelector('main');
  if(!nav||!main)return;
  var paths={
    dashboard:'<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
    people:'<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
    phone:'<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.12.96.34 1.9.66 2.8a2 2 0 0 1-.45 2.11L8.05 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.9.32 1.84.54 2.8.66A2 2 0 0 1 22 16.92z"/>',
    chart:'<path d="M3 3v18h18"/><path d="m7 15 4-4 4 3 5-7"/>',
    building:'<rect x="4" y="3" width="16" height="18" rx="1"/><path d="M9 21v-4h6v4M8 7h.01M12 7h.01M16 7h.01M8 12h.01M12 12h.01M16 12h.01"/>',
    handshake:'<path d="m2 12 4-4 4 2 4-3 8 5-4 7-5-3-3 2-4-2-4-4z"/><path d="m6 8 2-3h4l2 2"/>',
    message:'<path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8A8.5 8.5 0 0 1 12.5 3h.5a8.5 8.5 0 0 1 8 8v.5z"/>',
    spark:'<path d="m12 3 1.9 5.8L20 11l-6.1 2.2L12 19l-1.9-5.8L4 11l6.1-2.2L12 3z"/><path d="m19 18 .6 1.4L21 20l-1.4.6L19 22l-.6-1.4L17 20l1.4-.6L19 18z"/>',
    calendar:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/>',
    wallet:'<rect x="2" y="5" width="20" height="16" rx="2"/><path d="M16 14h6M2 9h20M6 2h12"/>',
    document:'<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h8"/>',
    shield:'<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/>',
    users:'<circle cx="9" cy="7" r="4"/><path d="M3 21v-2a6 6 0 0 1 12 0v2M16 3a4 4 0 0 1 0 8M17 15a6 6 0 0 1 4 6"/>',
    school:'<path d="m2 10 10-6 10 6-10 6-10-6zM6 13v5c3 3 9 3 12 0v-5M22 10v7"/>',
    target:'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
    settings:'<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-1.9 1.9-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1 1.56V21h-2.7v-.09a1.7 1.7 0 0 0-1-1.56 1.7 1.7 0 0 0-1.88.34l-.06.06-1.9-1.9.06-.06A1.7 1.7 0 0 0 6.6 15a1.7 1.7 0 0 0-1.56-1H5v-2.7h.09a1.7 1.7 0 0 0 1.56-1A1.7 1.7 0 0 0 6.3 8.4l-.06-.06 1.9-1.9.06.06a1.7 1.7 0 0 0 1.88.34 1.7 1.7 0 0 0 1-1.56V5h2.7v.09a1.7 1.7 0 0 0 1 1.56 1.7 1.7 0 0 0 1.88-.34l.06-.06 1.9 1.9-.06.06a1.7 1.7 0 0 0-.34 1.88 1.7 1.7 0 0 0 1.56 1H21v2.7h-.09A1.7 1.7 0 0 0 19.4 15z"/>',
    menu:'<path d="M4 7h16M4 12h16M4 17h16"/>',
    search:'<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
    expand:'<path d="M8 3H3v5M16 3h5v5M3 16v5h5M21 16v5h-5"/>',
    more:'<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>'
  };
  function svg(name){return '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">'+(paths[name]||paths.document)+'</svg>';}
  var iconMap={dashboard:'dashboard',prospectos:'people','bases-llamadas.html':'phone','rendimiento.html':'chart','negocios.html':'building','coordinador-asesor.html':'handshake',conversaciones:'message','solicitudes-mired360-ia.html':'spark',seguimientos:'calendar',ventas:'wallet','etb.html':'document',autorizaciones:'shield',comisiones:'wallet','red-comercial.html':'users',usuarios:'users','callcenter-usuarios.html':'people','academia-callcenter.html':'school','reclutamiento.html':'target',publicidad:'target',config:'settings'};
  function keyOf(b){return b.dataset.view||b.dataset.link||'';}
  var navButtons=Array.from(nav.querySelectorAll('button'));
  navButtons.forEach(function(b){
    var text=Array.from(b.childNodes).find(function(n){return n.nodeType===3});
    if(text)text.textContent=text.textContent.replace(/^[^\p{L}\p{N}]+/u,'');
    var icon=document.createElement('span');icon.className='m360-nav-icon';
    icon.innerHTML=svg(iconMap[keyOf(b)]||'document');b.prepend(icon);
  });
  var groups=[
    ['PANEL PRINCIPAL',['dashboard','prospectos','seguimientos','ventas']],
    ['CONTACTO Y CAMPAÑAS',['conversaciones','bases-llamadas.html','rendimiento.html','publicidad','solicitudes-mired360-ia.html']],
    ['GESTIÓN COMERCIAL',['negocios.html','etb.html','autorizaciones','comisiones','coordinador-asesor.html']],
    ['EQUIPO Y FORMACIÓN',['usuarios','callcenter-usuarios.html','academia-callcenter.html','red-comercial.html','reclutamiento.html','https://mired360servicios.com/admin-referidos.html']],
    ['SISTEMA',['config']]
  ];
  groups.forEach(function(item){
    var section=document.createElement('div');section.className='m360-nav-group';
    var title=document.createElement('div');title.className='m360-nav-heading';title.textContent=item[0];section.appendChild(title);
    item[1].forEach(function(key){var btn=navButtons.find(function(b){return keyOf(b)===key});if(btn)section.appendChild(btn)});
    if(section.querySelector('button'))nav.appendChild(section);
  });
  navButtons.filter(function(b){return !b.parentElement.classList.contains('m360-nav-group')}).forEach(function(b){nav.appendChild(b)});
  var overlay=document.createElement('div');overlay.className='m360-drawer-overlay';overlay.setAttribute('aria-hidden','true');document.body.appendChild(overlay);
  function closeMenu(){document.body.classList.remove('m360-drawer-open');document.body.style.overflow='';}
  function openMenu(){document.body.classList.add('m360-drawer-open');document.body.style.overflow='hidden';}
  overlay.addEventListener('click',closeMenu);
  navButtons.forEach(function(b){b.addEventListener('click',closeMenu)});
  var topbar=document.createElement('div');topbar.className='m360-topbar';
  topbar.innerHTML='<div class="m360-topbar-start"><button type="button" class="m360-icon-button m360-menu-toggle" id="m360MenuBtn" aria-label="Abrir menú">'+svg('menu')+'</button><div><span class="m360-topbar-eyebrow">PLATAFORMA DE GESTIÓN</span><span class="m360-topbar-title">MIRED360 CRM</span></div></div><div class="m360-topbar-search"><span class="m360-search-icon">'+svg('search')+'</span><input id="m360Search" autocomplete="off" placeholder="Buscar módulos y herramientas..." aria-label="Buscar módulo"><span class="m360-keyhint">Ctrl K</span><div id="m360SearchResults" class="m360-search-results hidden"></div></div><div class="m360-topbar-actions"><button id="m360Expand" type="button" class="m360-icon-button" aria-label="Pantalla completa" title="Pantalla completa">'+svg('expand')+'</button><span class="m360-avatar" id="m360Avatar" aria-label="Sesión de usuario">M</span></div>';
  main.prepend(topbar);
  topbar.querySelector('.m360-search-icon').style.cssText='position:absolute;left:13px;top:50%;transform:translateY(-50%);display:flex;pointer-events:none;color:#7e92ae';
  topbar.querySelector('.m360-search-icon svg').style.cssText='width:17px;height:17px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;';
  document.getElementById('m360MenuBtn').addEventListener('click',function(){document.body.classList.contains('m360-drawer-open')?closeMenu():openMenu()});
  function activate(key){
    var btn=navButtons.find(function(n){return keyOf(n)===key});
    if(btn){closeMenu();btn.click();window.scrollTo({top:0,behavior:'smooth'})}
  }
  var expand=document.getElementById('m360Expand');
  expand.addEventListener('click',function(){
    if(document.fullscreenElement){document.exitFullscreen().catch(function(){document.body.classList.toggle('m360-focus')});return}
    if(document.documentElement.requestFullscreen){document.documentElement.requestFullscreen().catch(function(){document.body.classList.toggle('m360-focus')})}
    else document.body.classList.toggle('m360-focus');
  });
  var search=document.getElementById('m360Search'),results=document.getElementById('m360SearchResults');
  function listModules(q){
    var val=(q||'').toLocaleLowerCase('es').trim();
    var matches=navButtons.filter(function(b){return !b.classList.contains('hidden')&&(!val||b.textContent.toLocaleLowerCase('es').includes(val))}).slice(0,9);
    results.innerHTML='';
    if(!matches.length){var empty=document.createElement('small');empty.textContent='No se encontraron módulos';empty.style.cssText='display:block;padding:12px';results.appendChild(empty)}
    matches.forEach(function(b){var option=document.createElement('button');option.type='button';option.innerHTML=svg(iconMap[keyOf(b)]||'document')+'<span></span>';option.querySelector('svg').style.cssText='width:17px;height:17px;fill:none;stroke:currentColor;stroke-width:1.8';option.querySelector('span').textContent=b.textContent.trim();option.addEventListener('click',function(){results.classList.add('hidden');search.value='';activate(keyOf(b))});results.appendChild(option)});
    results.classList.remove('hidden');
  }
  search.addEventListener('focus',function(){listModules(search.value)});
  search.addEventListener('input',function(){listModules(search.value)});
  search.addEventListener('keydown',function(e){
    if(e.key==='Escape'){results.classList.add('hidden');search.blur()}
    if(e.key==='Enter'){var first=results.querySelector('button');if(first){e.preventDefault();first.click()}}
  });
  document.addEventListener('pointerdown',function(e){if(!e.target.closest('.m360-topbar-search'))results.classList.add('hidden')});
  document.addEventListener('keydown',function(e){if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();search.focus();search.select()}if(e.key==='Escape')closeMenu()});
  var userLabel=document.getElementById('userLabel');
  function updateAvatar(){var email=(userLabel&&userLabel.textContent||'').trim(),avatar=document.getElementById('m360Avatar');if(avatar)avatar.textContent=email?email[0].toUpperCase():'M'}
  if(userLabel){new MutationObserver(updateAvatar).observe(userLabel,{childList:true,characterData:true,subtree:true});updateAvatar()}
  var dash=document.getElementById('dashboard');
  if(dash){
    var hero=document.createElement('div');hero.className='m360-hero';
    var date=new Intl.DateTimeFormat('es-CO',{timeZone:'America/Bogota',day:'numeric',month:'long',year:'numeric'}).format(new Date());
    hero.innerHTML='<div><div class="m360-hero-eyebrow">CENTRO DE OPERACIONES</div><h2>Tu negocio, bajo control.</h2><p>Gestiona clientes, campañas, asesores y resultados desde una plataforma comercial centralizada.</p></div><div class="m360-hero-meta"></div>';
    hero.querySelector('.m360-hero-meta').textContent=date;
    dash.prepend(hero);
    var title=document.createElement('div');title.className='m360-module-header';title.innerHTML='<strong>Accesos rápidos</strong><small>Todo tu equipo de trabajo, en un solo lugar</small>';
    var launch=document.createElement('div');launch.className='m360-launchpad';
    [
      ['prospectos','people','Prospectos','Clientes y oportunidades'],
      ['bases-llamadas.html','phone','Call Center','Bases y gestión de llamadas'],
      ['ventas','wallet','Control de ventas','Seguimiento de cierres'],
      ['comisiones','chart','Comisiones','Solicitudes y pagos'],
      ['reclutamiento.html','target','Reclutamiento','Incorporación de asesores']
    ].forEach(function(x){
      var btn=document.createElement('button');btn.type='button';btn.innerHTML='<span class="m360-quickicon">'+svg(x[1])+'</span><b></b><small></small>';btn.querySelector('b').textContent=x[2];btn.querySelector('small').textContent=x[3];btn.addEventListener('click',function(){activate(x[0])});launch.appendChild(btn)
    });
    hero.after(title,launch);
  }
  var bottom=document.createElement('div');bottom.className='m360-mobile-nav';
  [['dashboard','dashboard','Inicio'],['prospectos','people','Clientes'],['ventas','wallet','Ventas'],['bases-llamadas.html','phone','Llamadas'],['__more','menu','Menú']].forEach(function(item){
    var btn=document.createElement('button');btn.type='button';btn.dataset.mobileKey=item[0];btn.innerHTML=svg(item[1])+'<span></span>';btn.querySelector('span').textContent=item[2];btn.addEventListener('click',function(){item[0]==='__more'?openMenu():activate(item[0])});bottom.appendChild(btn)
  });
  app.appendChild(bottom);
  function updateMobile(){var active=navButtons.find(function(b){return b.classList.contains('active')});var key=active?keyOf(active):'dashboard';bottom.querySelectorAll('button').forEach(function(b){b.classList.toggle('active',b.dataset.mobileKey===key)})}
  var navObserver=new MutationObserver(updateMobile);navButtons.forEach(function(b){navObserver.observe(b,{attributes:true,attributeFilter:['class']})});updateMobile();
  window.addEventListener('resize',function(){if(window.innerWidth>1000)closeMenu()});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();