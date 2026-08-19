(() => {
  const saveButton=document.getElementById('saveReportDrive');
  const reportButton=document.getElementById('report');
  const getConfig=()=>({url:localStorage.getItem('inspecciones_drive_url')||'',mes:document.getElementById('reportMonth').value,anio:Number(document.getElementById('reportYear').value)});

  function openReport(){
    const {url,mes,anio}=getConfig();
    if(!url)return alert('Primero conecte Google Drive.');
    if(!navigator.onLine)return alert('No hay Internet. Para generar el reporte mensual necesita conexión.');
    // Abrir el reporte HTML directamente en el web app de Apps Script.
    // No intenta abrir ningún archivo de Drive.
    window.location.href=url+'?action=report&anio='+encodeURIComponent(anio)+'&mes='+encodeURIComponent(mes)+'&t='+Date.now();
  }

  function saveReport(){
    const {url,mes,anio}=getConfig();
    if(!url)return alert('Primero conecte Google Drive.');
    if(!navigator.onLine)return alert('No hay Internet. Para guardar el reporte necesita conexión.');
    window.location.href=url+'?action=generateReport&view=1&anio='+encodeURIComponent(anio)+'&mes='+encodeURIComponent(mes)+'&nombre='+encodeURIComponent('Reporte_'+anio+'_'+mes)+'&t='+Date.now();
  }

  if(reportButton)reportButton.onclick=openReport;
  if(saveButton)saveButton.onclick=saveReport;
})();
