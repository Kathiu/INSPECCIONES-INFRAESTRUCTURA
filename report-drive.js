(() => {
  const saveButton=document.getElementById('saveReportDrive');
  const reportButton=document.getElementById('report');
  const getConfig=()=>({url:localStorage.getItem('inspecciones_drive_url')||'',mes:document.getElementById('reportMonth').value,anio:Number(document.getElementById('reportYear').value)});

  function generateAndSave(){
    const {url,mes,anio}=getConfig();
    if(!url)return alert('Primero conecte Google Drive.');
    if(!navigator.onLine)return alert('No hay Internet. Para generar el reporte mensual necesita conexión.');
    // Apps Script genera el PDF y lo guarda en el Drive de trabajo.
    // No intentamos abrir ningún archivo de Drive, evitando el conflicto
    // con la cuenta personal de Google del teléfono.
    window.location.href=url+'?action=generateReport&view=1&anio='+encodeURIComponent(anio)+'&mes='+encodeURIComponent(mes)+'&nombre='+encodeURIComponent('Reporte_'+anio+'_'+mes)+'&t='+Date.now();
  }

  if(reportButton)reportButton.onclick=generateAndSave;
  if(saveButton)saveButton.onclick=generateAndSave;
})();
