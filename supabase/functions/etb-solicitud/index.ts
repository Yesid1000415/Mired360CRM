import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';
const key='sb_publishable_ZFjdUsgyfSxOqm4L1SrJJg_Z2f0lL0r';
const allowed=['https://yesid1000415.github.io','https://mired360servicios.com','https://www.mired360servicios.com'];
Deno.serve(async req=>{
 const origin=req.headers.get('origin')||'';
 const headers={'Content-Type':'application/json','Cache-Control':'no-store','Access-Control-Allow-Origin':allowed.includes(origin)?origin:allowed[0],'Vary':'Origin','Access-Control-Allow-Headers':'apikey,content-type','Access-Control-Allow-Methods':'POST,OPTIONS'};
 const reply=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers});
 if(req.method==='OPTIONS')return new Response(null,{headers});
 if(req.method!=='POST')return reply({error:'Método no permitido'},405);
 // Public intake API: require the designated publishable API key; private read access uses RLS.
 if(req.headers.get('apikey')!==key || (origin&&!allowed.includes(origin)))return reply({error:'Acceso no permitido'},403);
 if(Number(req.headers.get('content-length')||0)>9*1024*1024)return reply({error:'Archivos demasiado grandes'},413);
 const db=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
 let paths:string[]=[];
 try{
 const form=await req.formData();
 const get=(k:string)=>String(form.get(k)||'').trim();
 if(get('website'))return reply({error:'Solicitud no válida'},400);
 const id=get('id');if(!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id))return reply({error:'Identificador no válido'},400);
 const fields=['tipo','nombre','cedula','expedicion','nacimiento','email','telefono','direccion','barrio','ciudad','plan','asesor','fecha_solicitud'];
 const row:Record<string,unknown>={id};
 for(const f of fields){const v=get(f);if(!v||v.length>300)return reply({error:'Revisa el campo '+f},400);row[f]=v;}
 if(!['Residencial','PyME'].includes(get('tipo'))||!/^\d{5,15}$/.test(get('cedula'))||!/^3\d{9}$/.test(get('telefono'))||!/^\S+@\S+\.\S+$/.test(get('email')))return reply({error:'Revisa tipo, cédula, correo y celular de 10 dígitos'},400);
 if(get('adicional')&&!/^\d{7,15}$/.test(get('adicional')))return reply({error:'Teléfono adicional no válido'},400);
 for(const f of ['expedicion','nacimiento','fecha_solicitud']){if(!/^\d{4}-\d{2}-\d{2}$/.test(get(f))||!Number.isFinite(Date.parse(get(f)))||get(f)>new Date().toISOString().slice(0,10))return reply({error:'Revisa las fechas'},400);}
 if(get('expedicion')<get('nacimiento'))return reply({error:'Revisa la fecha de expedición'},400);
 for(const f of ['estrato','velocidad','valor']){const n=Number(get(f));if(!Number.isFinite(n)||n<=0||n>1e8)return reply({error:'Revisa '+f},400);row[f]=n;}
 if(!Number.isInteger(row.estrato)||Number(row.estrato)>6||!Number.isInteger(row.velocidad))return reply({error:'Revisa estrato y velocidad'},400);
 if(get('consentimiento')!=='si')return reply({error:'Se requiere autorización del titular'},400);
 row.consentimiento='v1: Titular autoriza a MIRED360SERVICIOS a tratar datos y documentos para gestionar su solicitud ETB, contactarlo y remitirlos a ETB para validación. Canal de consultas: ventas@mired360servicios.com.';
 row.adicional=get('adicional');
 const ip=req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()||'unknown';
 row.ip_hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(ip+Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'))))).map(x=>x.toString(16).padStart(2,'0')).join('');
 const {count,error:rateError}=await db.from('etb_solicitudes').select('id',{count:'exact',head:true}).eq('ip_hash',row.ip_hash).gte('creado_en',new Date(Date.now()-3600000).toISOString());
 if(rateError)throw rateError;if((count||0)>=12)return reply({error:'Has alcanzado el límite por hora. Intenta más tarde.'},429);
 const {data:existing}=await db.from('etb_solicitudes').select('id').eq('id',id).maybeSingle();if(existing)return reply({ok:true,id});
 const {data:owner,error:ownerError}=await db.from('perfiles').select('user_id').eq('email','yesidrojasrodriguez18@gmail.com').eq('rol','coordinador').single();if(ownerError||!owner)throw new Error('owner');row.owner_id=owner.user_id;
 const images:{side:string,bytes:Uint8Array,mime:string,ext:string}[]=[];
 for(const side of ['frontal','posterior']){
 const file=form.get(side);if(!(file instanceof File)||!file.size||file.size>4194304)return reply({error:'Adjunta ambas fotos, máximo 4 MB cada una'},400);
 const bytes=new Uint8Array(await file.arrayBuffer());let mime='',ext='';
 if(bytes[0]===255&&bytes[1]===216&&bytes[2]===255){mime='image/jpeg';ext='jpg';}
 else if([137,80,78,71,13,10,26,10].every((v,i)=>bytes[i]===v)){mime='image/png';ext='png';}
 else if(new TextDecoder().decode(bytes.slice(0,4))==='RIFF'&&new TextDecoder().decode(bytes.slice(8,12))==='WEBP'){mime='image/webp';ext='webp';}
 else return reply({error:'Las fotos deben ser JPG, PNG o WEBP'},400);
 images.push({side,bytes,mime,ext});
 }
 for(const img of images){const path=id+'/'+crypto.randomUUID()+'-'+img.side+'.'+img.ext;const {error}=await db.storage.from('etb-documentos').upload(path,img.bytes,{contentType:img.mime,upsert:false});if(error)throw error;paths.push(path);row[img.side]=path;}
 const {error}=await db.from('etb_solicitudes').insert(row);if(error)throw error;
 return reply({ok:true,id});
 }catch(e){console.error('etb intake failure',e?.code||'',e?.message||'unknown');if(paths.length)await db.storage.from('etb-documentos').remove(paths);return reply({error:'No se pudo guardar la solicitud. Revisa los datos y vuelve a intentar.'},500);}
});
