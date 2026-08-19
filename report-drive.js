(() => {
  const button = document.getElementById('saveReportDrive');
  if (!button) return;
  button.onclick = async () => {
    const url = localStorage.getItem('inspecciones_drive_url');
    if (!url) return alert('Primero conecte Google Drive.');
    if (!navigator.onLine) return alert('No hay Internet. Para guardar el reporte en Drive necesita conexión.');
    const mes = document.getElementById('reportMonth').value;
    const anio = Number(document.getElementById('reportYear').value);
    button.disabled = true;
    try {
      // El servidor genera el reporte directamente desde las inspecciones y fotografías ya sincronizadas en Drive.
      await fetch(url,{method:'POST',mode:'no-cors',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({action:'syncReport',anio,mes,nombre:`Reporte_${anio}_${mes}`})});
      alert(`Reporte de ${mes} ${anio} enviado a Google Drive.\n\nSe guardará como PDF y HTML en INSPECCIONES_INFRAESTRUCTURA / REPORTES_MENSUALES / ${anio} / ${mes}.`);
    } catch(e) {
      console.error(e);
      alert('No se pudo solicitar el reporte en Drive.');
    } finally {
      button.disabled=false;
    }
  };
})();
