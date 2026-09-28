function exportExcelPro(){
  if(typeof XLSX==='undefined'){
    alert('No se pudo cargar el generador de Excel. Actualiza la página e inténtalo nuevamente.');
    return;
  }
  try{
    const wb=XLSX.utils.book_new();
    wb.Props={Title:'MIRED360 CRM - Reporte comercial',Subject:'Exportación comercial',Author:'MIRED360SERVICIOS',Company:'MIRED360SERVICIOS',CreatedDate:new Date()};

    const ventas=leads.filter(l=>['Venta','Pendiente instalación','Instalado'].includes(l.status));
    const instalados=leads.filter(l=>l.status==='Instalado');
    const seguimientos=leads.filter(l=>l.nextFollow&&!['Instalado','No interesado'].includes(l.status)).sort((a,b)=>String(a.nextFollow).localeCompare(String(b.nextFollow)));
    const noInteresados=leads.filter(l=>l.status==='No interesado');
    const valorVentas=ventas.reduce((s,l)=>s+Number(l.value||0),0);
    const comisiones=ventas.reduce((s,l)=>s+Number(l.commission||0),0);
    const tasa=leads.length?ventas.length/leads.length:0;

    const resumen=[
      ['MIRED360SERVICIOS','REPORTE COMERCIAL CRM'],
      ['Fecha de exportación',new Date().toLocaleString('es-CO')],
      [],
      ['Indicador','Resultado'],
      ['Prospectos',leads.length],
      ['Seguimientos pendientes',seguimientos.length],
      ['Ventas',ventas.length],
      ['Instalados',instalados.length],
      ['No interesados',noInteresados.length],
      ['Tasa de conversión',tasa],
      ['Valor mensual de ventas',valorVentas],
      ['Comisiones registradas',comisiones]
    ];
    const wsResumen=XLSX.utils.aoa_to_sheet(resumen);
    wsResumen['!cols']=[{wch:30},{wch:24}];
    if(wsResumen['B10'])wsResumen['B10'].z='0.0%';
    if(wsResumen['B11'])wsResumen['B11'].z='$#,##0';
    if(wsResumen['B12'])wsResumen['B12'].z='$#,##0';
    XLSX.utils.book_append_sheet(wb,wsResumen,'Resumen');

    const leadRow=l=>({
      'Fecha ingreso':l.created||'',
      'Cliente':l.name||'',
      'Teléfono':l.phone||'',
      'Ciudad':l.city||'',
      'Barrio':l.barrio||'',
      'Dirección':l.address||'',
      'Origen':l.origin||'',
      'Campaña':l.campaign||'',
      'Producto':l.product||'',
      'Operador':l.operator||'',
      'Plan':l.plan||'',
      'Valor mensual':Number(l.value||0),
      'Estado':l.status||'',
      'Próximo seguimiento':l.nextFollow||'',
      'Fecha instalación':l.installDate||'',
      'Comisión':Number(l.commission||0),
      'Notas':l.notes||''
    });

    const widths=[12,24,15,16,18,28,18,22,22,16,28,16,22,18,18,16,38].map(wch=>({wch}));
    const appendTable=(name,items)=>{
      const rows=items.length?items.map(leadRow):[leadRow({})];
      const ws=XLSX.utils.json_to_sheet(rows);
      ws['!cols']=widths;
      if(ws['!ref']){
        const range=XLSX.utils.decode_range(ws['!ref']);
        ws['!autofilter']={ref:XLSX.utils.encode_range({s:{r:0,c:0},e:{r:range.e.r,c:range.e.c}})};
        for(let r=1;r<=range.e.r;r++){
          const valor=ws[XLSX.utils.encode_cell({r:r,c:11})];
          const comision=ws[XLSX.utils.encode_cell({r:r,c:15})];
          if(valor)valor.z='$#,##0';
          if(comision)comision.z='$#,##0';
        }
      }
      XLSX.utils.book_append_sheet(wb,ws,name);
    };

    appendTable('Prospectos',leads);
    appendTable('Ventas',ventas);
    appendTable('Seguimientos',seguimientos);
    appendTable('Instalados',instalados);

    XLSX.writeFile(wb,'MIRED360_CRM_'+today()+'.xlsx');
  }catch(e){
    console.error(e);
    alert('No se pudo generar el Excel Pro. '+String(e.message||e));
  }
}
