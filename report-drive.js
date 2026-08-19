(() => {
  const saveButton=document.getElementById('saveReportDrive');
  const reportButton=document.getElementById('report');
  const getConfig=()=>({url:localStorage.getItem('inspecciones_drive_url')||'',mes:document.getElementById('reportMonth').value,anio:Number(document.getElementById('reportYear').value)});

  // Generar reporte: muestra el HTML directamente desde Apps Script.
  // No intenta abrir el archivo PDF de Drive, por lo que no depende de la
  // cuenta principal de Google del teléfono.
  function openReport(){
    const {url,mes,anio}=getConfig();
    if(!url)return alert('Primero conecte Google Drive.');
    if(!navigator.onLine)return alert('No hay Internet. Para generar el reporte mensual necesita conexión.');
    const u=url+'?action=report&anio='+encodeURIComponent(anio)+'&mes='+encodeURIComponent(mes)+'&t='+Date.now();
    window.location.href=u;
  }

  // Guardar reporte: conserva el mecanismo que ya comprobamos que funciona.
  function saveReport(){
    const {url,mes,anio}=getConfig();
    if(!url)return alert('Primero conecte Google Drive.');
    if(!navigator.onLine)return alert('No hay Internet. Para guardar el reporte necesita conexión.');
    const u=url+'?action=generateReport&view=1&anio='+encodeURIComponent(anio)+'&mes='+encodeURIComponent(mes)+'&nombre='+encodeURIComponent('Reporte_'+anio+'_'+mes)+'&t='+Date.now();
    window.location.href=u;
  }

  if(reportButton)reportButton.onclick=openReport;
  if(saveButton)saveButton.onclick=saveReport;
})();
