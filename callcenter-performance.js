(function(){
  const META_DEFAULT=15;

  function esc(v){return String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]))}
  function shortExt(v){return String(v||'').slice(-3)}
  function roleKey(v){return String(v||'').toLowerCase()}
  function stateFor(sales,meta,assigned){
    if(!assigned)return{key:'gray',icon:'⚪',label:'Sin asesor'};
    if(sales>meta)return{key:'diamond',icon:'💎',label:'Diamante'};
    if(sales===meta)return{key:'green',icon:'🟢',label:'Meta cumplida'};
    const d=new Date(),days=new Date(d.getFullYear(),d.getMonth()+1,0).getDate();
    const expected=Math.max(1,meta*(d.getDate()/days));
    const ratio=sales/expected;
    if(ratio>=1)return{key:'green',icon:'🟢',label:'Va cumpliendo'};
    if(ratio>=0.60)return{key:'yellow',icon:'🟡',label:'En progreso'};
    return{key:'red',icon:'🔴',label:'Necesita impulso'};
  }
  function ensureStyles(){
    if(document.getElementById('cc-performance-styles'))return;
    const st=document.createElement('style');
    st.id='cc-performance-styles';
    st.textContent=`
      .cc-wrap{margin-bottom:16px}.cc-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;margin-bottom:12px}.cc-head h2{margin:0;font-size:19px}.cc-head p{margin:4px 0 0;color:var(--m);font-size:12px}
      .cc-mine{display:grid;grid-template-columns:1.2fr .8fr;gap:12px;margin-bottom:12px}.cc-status{border:1px solid var(--l);border-radius:16px;padding:16px}.cc-status.red{background:#fff0f0;border-color:#f0b1b1}.cc-status.yellow{background:#fff7e4;border-color:#f2d38b}.cc-status.green{background:#eaf8f1;border-color:#a7dfc5}.cc-status.diamond{background:linear-gradient(135deg,#eef7ff,#f7efff);border-color:#b7c9ef}.cc-status.gray{background:#f2f5f8;border-color:#d6dee7}
      .cc-status-top{display:flex;justify-content:space-between;gap:12px;align-items:center}.cc-icon{font-size:28px}.cc-sales{font-size:34px;font-weight:900;margin:6px 0}.cc-muted{color:var(--m);font-size:12px}.cc-progress{height:9px;background:#dfe8f1;border-radius:999px;overflow:hidden;margin:10px 0}.cc-progress>span{display:block;height:100%;background:#0f7cff;border-radius:999px}.cc-diamond .cc-progress>span{background:linear-gradient(90deg,#0f7cff,#8a5cff)}
      .cc-prize{border:1px dashed #c9a43d;background:#fffaf0;border-radius:16px;padding:16px}.cc-prize h3{margin:0 0 6px;font-size:17px}.cc-prize strong{font-size:15px}.cc-top3{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}.cc-rank{border:1px solid var(--l);border-radius:14px;padding:12px;background:#fff}.cc-rank b{display:block;margin-bottom:4px}.cc-rank .num{font-size:24px;font-weight:900}.cc-rank.first{background:#fffaf0;border-color:#ead18a}.cc-rank.second{background:#f7f9fb}.cc-rank.third{background:#fff7f0}.cc-team{display:grid;grid-template-columns:repeat(5,1fr);gap:9px;margin-top:12px}.cc-team .cc-status{padding:12px}.cc-team .cc-sales{font-size:25px}
      @media(max-width:1100px){.cc-team{grid-template-columns:repeat(2,1fr)}.cc-mine{grid-template-columns:1fr}}
      @media(max-width:650px){.cc-top3,.cc-team{grid-template-columns:1fr}.cc-head{flex-direction:column}}
    `;
    document.head.appendChild(st);
  }
  function ensureHost(){
    const dashboard=document.getElementById('dashboard');if(!dashboard)return null;
    let host=document.getElementById('ccPerformanceCard');
    if(!host){
      host=document.createElement('div');host.id='ccPerformanceCard';host.className='card cc-wrap';
      const kpis=dashboard.querySelector('.kpis');
      dashboard.insertBefore(host,kpis||dashboard.firstChild);
    }
    return host;
  }
  function rankHtml(rows){
    const assigned=rows.filter(x=>x.asesor_user_id).sort((a,b)=>Number(b.ventas_mes)-Number(a.ventas_mes)||String(a.asesor_nombre||'').localeCompare(String(b.asesor_nombre||'')));
    const medals=['🥇','🥈','🥉'];
    return assigned.slice(0,3).map((x,i)=>`<div class="cc-rank ${i===0?'first':i===1?'second':'third'}"><b>${medals[i]} ${esc(x.asesor_nombre||('Extensión '+shortExt(x.extension)))}</b><div class="num">${Number(x.ventas_mes||0)}</div><div class="cc-muted">ventas · Ext. ${shortExt(x.extension)}</div></div>`).join('')||'<div class="cc-muted">Todavía no hay asesores asignados al ranking.</div>';
  }
  function statusHtml(x,title){
    const sales=Number(x?.ventas_mes||0),meta=Number(x?.meta_mensual||META_DEFAULT),assigned=!!x?.asesor_user_id,st=stateFor(sales,meta,assigned);
    const pct=Math.min(100,Math.round((sales/meta)*100));
    const detail=sales>meta?`Superó la meta por ${sales-meta} venta(s).`:sales===meta?'¡Meta mensual alcanzada!':`Le faltan ${Math.max(0,meta-sales)} venta(s) para la meta.`;
    return `<div class="cc-status ${st.key}"><div class="cc-status-top"><div><b>${esc(title)}</b><div class="cc-muted">${esc(x?.asesor_nombre||'Sin asesor')} · Ext. ${shortExt(x?.extension)}</div></div><div class="cc-icon">${st.icon}</div></div><div class="cc-sales">${sales} <span class="cc-muted">ventas</span></div><b>${esc(st.label)}</b><div class="cc-muted">${detail} Meta: ${meta}</div><div class="cc-progress"><span style="width:${pct}%"></span></div></div>`;
  }
  async function loadPerformance(){
    try{
      if(typeof supabaseClient==='undefined')return;
      const {data:{session}}=await supabaseClient.auth.getSession();if(!session?.user)return;
      ensureStyles();const host=ensureHost();if(!host)return;
      const [{data:profile},{data:rows,error}]=await Promise.all([
        supabaseClient.from('perfiles').select('user_id,nombre,email,rol').eq('user_id',session.user.id).maybeSingle(),
        supabaseClient.rpc('callcenter_ranking_mes')
      ]);
      if(error){host.innerHTML='<div class="cc-muted">No fue posible cargar el rendimiento del Call Center.</div>';return}
      const list=rows||[],role=roleKey(profile?.rol),isCoord=role==='coordinador'||role==='admin';
      const own=list.find(x=>x.asesor_user_id===session.user.id)||null;
      const ranked=list.filter(x=>x.asesor_user_id).sort((a,b)=>Number(b.ventas_mes)-Number(a.ventas_mes)||String(a.asesor_nombre||'').localeCompare(String(b.asesor_nombre||'')));
      const leader=ranked[0]||null,eligibleLeader=leader&&Number(leader.ventas_mes)>Number(leader.meta_mensual||META_DEFAULT);
      const prizeText=eligibleLeader?`Actualmente lidera <b>${esc(leader.asesor_nombre||'')}</b> con <b>${Number(leader.ventas_mes)} ventas</b>.`:'El premio se activa para quien cierre el mes con más ventas y haya superado la meta de 15.';
      let html=`<div class="cc-head"><div><h2>🚦 Rendimiento Call Center</h2><p>Meta mensual: 15 ventas · 💎 Diamante al superar la meta</p></div><button class="btn ghost" type="button" onclick="window.loadCallCenterPerformance && window.loadCallCenterPerformance()">Actualizar</button></div>`;
      if(isCoord){
        html+=`<div class="cc-prize"><h3>🏆 Premio Sorpresa MIRED360</h3><div>El asesor con más ventas del mes, superando la meta, recibe un premio sorpresa.</div><div class="cc-muted" style="margin-top:5px">${prizeText}</div></div><div class="cc-team">${list.map(x=>statusHtml(x,'Extensión '+shortExt(x.extension))).join('')}</div>`;
      }else{
        html+=`<div class="cc-mine">${own?statusHtml(own,'Mi rendimiento'):'<div class="cc-status gray"><b>Mi rendimiento</b><div class="cc-sales">—</div><div class="cc-muted">Aún no tienes una extensión asignada.</div></div>'}<div class="cc-prize"><h3>🏆 Premio Sorpresa MIRED360</h3><strong>Supera la meta y busca el primer lugar.</strong><div class="cc-muted" style="margin-top:7px">${prizeText}</div><div class="cc-muted" style="margin-top:7px">El premio puede ser un bono, una entrada a cine, un detalle u otra sorpresa.</div></div></div>`;
      }
      html+=`<div class="section" style="margin:8px 0"><h2>🏁 Top 3 del mes</h2></div><div class="cc-top3">${rankHtml(list)}</div>`;
      host.innerHTML=html;
    }catch(e){console.error('Call center performance',e)}
  }
  window.loadCallCenterPerformance=loadPerformance;
  document.addEventListener('DOMContentLoaded',()=>setTimeout(loadPerformance,500));
  if(typeof supabaseClient!=='undefined')supabaseClient.auth.onAuthStateChange((event)=>{if(event==='SIGNED_IN'||event==='TOKEN_REFRESHED')setTimeout(loadPerformance,300)});
})();
