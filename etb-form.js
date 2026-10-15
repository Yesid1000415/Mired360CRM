const form=document.getElementById('form'),statusEl=document.getElementById('status'),send=document.getElementById('send');
let requestId=crypto.randomUUID();const photos={},tasks={},generation={};
const today=new Date().toLocaleDateString('en-CA',{timeZone:'America/Bogota'});
form.elements.fecha_solicitud.value=today;for(const n of ['fecha_solicitud','expedicion','nacimiento'])form.elements[n].max=today;
async function prepare(file){
 if(file.size>30*1024*1024)throw Error('La foto supera 30 MB. Selecciona una foto más pequeña.');
 const url=URL.createObjectURL(file),img=new Image();
 try{await new Promise((ok,no)=>{img.onload=ok;img.onerror=()=>no(Error('No se pudo leer la imagen. Usa JPG, PNG o toma otra foto.'));img.src=url;});
 const scale=Math.min(1,2200/Math.max(img.width,img.height)),c=document.createElement('canvas');c.width=Math.round(img.width*scale);c.height=Math.round(img.height*scale);const ctx=c.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,c.width,c.height);ctx.drawImage(img,0,0,c.width,c.height);
 const blob=await new Promise(ok=>c.toBlob(ok,'image/jpeg',.88));if(!blob||blob.size>4*1024*1024)throw Error('La foto sigue siendo demasiado grande. Selecciona otra.');return blob;
 }finally{URL.revokeObjectURL(url);}
}
for(const side of ['frontal','posterior']){
 document.getElementById(side).addEventListener('change',()=>{
 const token=Symbol();generation[side]=token;delete photos[side];const input=document.getElementById(side),info=document.getElementById(side+'Info'),preview=document.getElementById(side+'Preview');preview.hidden=true;if(preview.src)URL.revokeObjectURL(preview.src);
 if(!input.files[0]){info.textContent='Sin foto seleccionada';return;}
 info.textContent='Preparando foto…';tasks[side]=(async()=>{try{const blob=await prepare(input.files[0]);if(generation[side]!==token)return;photos[side]=blob;preview.src=URL.createObjectURL(blob);preview.hidden=false;info.textContent='Lista para enviar · '+Math.round(blob.size/1024)+' KB';}catch(e){if(generation[side]===token){info.textContent=e.message;input.value='';}}})();
 });
}
form.addEventListener('submit',async e=>{
 e.preventDefault();send.disabled=true;statusEl.className='status';statusEl.textContent='Preparando fotos…';
 try{await Promise.all(Object.values(tasks));if(!photos.frontal||!photos.posterior)throw Error('Selecciona una foto válida de cada lado de la cédula.');
 const data=new FormData(form);data.set('id',requestId);for(const side of ['frontal','posterior'])data.append(side,photos[side],side+'.jpg');
 statusEl.textContent='Enviando datos y fotos. Mantén esta página abierta…';
 const response=await fetch('https://lpiusomsuswdcraoozdn.supabase.co/functions/v1/etb-solicitud',{method:'POST',headers:{apikey:'sb_publishable_ZFjdUsgyfSxOqm4L1SrJJg_Z2f0lL0r'},body:data});const result=await response.json();if(!response.ok||!result.ok)throw Error(result.error||'No se confirmó el envío. Intenta nuevamente.');
 form.classList.add('hidden');document.getElementById('success').classList.remove('hidden');document.getElementById('receipt').textContent='Número de solicitud: '+result.id;form.reset();for(const side of ['frontal','posterior']){URL.revokeObjectURL(document.getElementById(side+'Preview').src);delete photos[side];}window.scrollTo({top:0,behavior:'smooth'});
 }catch(e){statusEl.className='status error';statusEl.textContent=e.message==='Failed to fetch'?'No se confirmó el envío. Revisa tu conexión y vuelve a intentar; tus datos siguen aquí.':e.message;}finally{send.disabled=false;}
});
