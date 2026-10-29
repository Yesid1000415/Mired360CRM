(function(){
 'use strict';
 function init(){
  if(document.body.dataset.m360ModuleReady)return;
  document.body.dataset.m360ModuleReady='1';
  document.body.classList.add('m360-module-mode','m360-module-standalone');
  var title=(document.title||'Módulo de gestión').replace(/\s*[\|·-]\s*MIRED360.*$/i,'').trim();
  var back='index.html';
  var bar=document.createElement('div');bar.className='m360-modulebar';
  bar.setAttribute('role','banner');
  bar.innerHTML='<div class="m360-modulebrand"><span class="m360-modulemark" aria-hidden="true">M</span><div><span class="m360-official-badge">MIRED360 · CRM EMPRESARIAL</span><b></b><small>Gestión conectada a tu centro de operaciones</small></div></div><div class="m360-modulebar-actions"><a class="m360-primary-link" href="index.html" aria-label="Volver al panel principal"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg><span class="m360-return-label">Panel principal</span></a><button type="button" class="m360-optional" id="m360ModuleExpand" title="Pantalla completa" aria-label="Pantalla completa"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 3H3v5M16 3h5v5M3 16v5h5M21 16v5h-5"/></svg>Pantalla completa</button></div>';
  bar.querySelector('b').textContent=title||'Módulo de gestión';
  var link=bar.querySelector('a');link.setAttribute('href',back);
  document.body.insertBefore(bar,document.body.firstChild);
  var fullscreen=document.getElementById('m360ModuleExpand');
  if(fullscreen)fullscreen.addEventListener('click',function(){
    if(document.fullscreenElement){if(document.exitFullscreen)document.exitFullscreen().catch(function(){})}
    else if(document.documentElement.requestFullscreen)document.documentElement.requestFullscreen().catch(function(){});
  });
  if(!document.querySelector('meta[name="theme-color"]')){
    var meta=document.createElement('meta');meta.name='theme-color';meta.content='#0a1c37';document.head.appendChild(meta);
  }
  // Avoid inserting duplicate page content or changing existing CRM actions.
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();