(() => {
  const saveButton=document.getElementById('saveReportDrive');
  const reportButton=document.getElementById('report');
  const getConfig=()=>({url:localStorage.getItem('inspecciones_drive_url')||'',mes:document.getElementById('reportMonth').value,anio:Number(document.getElementById('reportYear').value)});
  function saveReport(){const {url,mes,anio}=getConfig();if(!url)return alert('Primero conecte Google Drive.');if(!navigator.onLine)return alert('No hay Internet. Para generar el reporte mensual necesita conexión.');const u=url+'?action=generateReport&view=1&anio='+encodeURIComponent(anio)+'&mes='+encodeURIComponent(mes)+'&nombre='+encodeURIComponent('Reporte_'+anio+'_'+mes)+'&t='+Date.now();window.location.href=u;}
  if(saveButton)saveButton.onclick=saveReport;
  if(reportButton)reportButton.onclick=saveReport;
})();
