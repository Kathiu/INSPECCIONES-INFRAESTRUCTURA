(() => {
  const saveButton = document.getElementById('saveReportDrive');
  const reportButton = document.getElementById('report');
  const getConfig = () => ({url:localStorage.getItem('inspecciones_drive_url')||'',mes:document.getElementById('reportMonth').value,anio:Number(document.getElementById('reportYear').value)});
  async function saveToDrive(button, openAfter) {
    const {url,mes,anio}=getConfig();
    if(!url)return alert('Primero conecte Google Drive.');
    if(!navigator.onLine)return alert('No hay Internet. Para generar el reporte mensual necesita conexión.');
    button.disabled=true;
    const prefix='reportCallback_'+Date.now()+'_'+Math.random().toString(36).slice(2);
    const script=document.createElement('script'); let timer;
    const cleanup=()=>{clearTimeout(timer);delete window[prefix];if(script.parentNode)script.parentNode.removeChild(script);button.disabled=false};
    window[prefix]=(r)=>{cleanup();if(!r||!r.ok)return alert('No se pudo generar el reporte: '+((r&&r.error)||'error desconocido'));if(openAfter)window.open(r.url,'_blank');else alert(`Reporte de ${mes} ${anio} guardado correctamente en Google Drive.\n\nPDF: ${r.id}`)};
    script.src=url+'?action=generateReport&anio='+encodeURIComponent(anio)+'&mes='+encodeURIComponent(mes)+'&nombre='+encodeURIComponent(`Reporte_${anio}_${mes}`)+'&prefix='+encodeURIComponent(prefix)+'&t='+Date.now();
    script.onerror=()=>{cleanup();alert('No se pudo conectar con Google Drive. Verifique que la URL /exec siga activa.')};
    document.body.appendChild(script);
    timer=setTimeout(()=>{cleanup();alert('El reporte está tardando más de lo esperado. Revise REPORTES_MENSUALES en Google Drive antes de volver a intentarlo.')},30000);
  }
  if(saveButton)saveButton.onclick=()=>saveToDrive(saveButton,false);
  if(reportButton)reportButton.onclick=()=>saveToDrive(reportButton,true);
})();
