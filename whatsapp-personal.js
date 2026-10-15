(function(root){
  'use strict';
  function phone(value){
    let n=String(value??'').replace(/\D/g,'');
    if(n.startsWith('00'))n=n.slice(2);
    if(n.length===10){if(!/^[1-9]/.test(n))return '';n='57'+n;}
    if(n.startsWith('57')&&!/^57[1-9]\d{9}$/.test(n))return '';
    return /^[1-9]\d{7,14}$/.test(n)?n:'';
  }
  function message(client,advisor){
    const name=String(client||'').trim();
    const who=String(advisor||'').trim();
    return 'Hola'+(name?' '+name:'')+' 👋. '+(who?'Soy '+who+', asesor de MIRED360SERVICIOS.':'Te escribe el equipo comercial de MIRED360SERVICIOS.')+' Te escribo para continuar tu asesoría por WhatsApp. ¿Podemos seguir por aquí?';
  }
  function url(value,client,advisor,text){
    const n=phone(value);
    return n?'https://wa.me/'+n+'?text='+encodeURIComponent(text===undefined?message(client,advisor):String(text)):'';
  }
  function open(value,client,advisor,text){
    const target=url(value,client,advisor,text);
    if(!target){root.alert('Revisa el número de WhatsApp del cliente. En Colombia debe tener 10 dígitos.');return false;}
    root.open(target,'_blank','noopener,noreferrer');
    return true;
  }
  root.MiredWhatsApp={phone,message,url,open};
})(typeof window==='undefined'?globalThis:window);
