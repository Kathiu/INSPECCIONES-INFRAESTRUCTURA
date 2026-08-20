(() => {
  const saveButton = document.getElementById('saveReportDrive');
  const reportButton = document.getElementById('report');
  const getConfig = () => ({
    url: localStorage.getItem('inspecciones_drive_url') || '',
    mes: document.getElementById('reportMonth').value,
    anio: Number(document.getElementById('reportYear').value)
  });

  async function generateAndSave() {
    const { url, mes, anio } = getConfig();
    if (!url) return alert('Primero conecte Google Drive.');
    if (!navigator.onLine) return alert('No hay Internet. Para generar el reporte mensual necesita conexión.');

    const nombre = 'Reporte_' + anio + '_' + mes;
    const payload = JSON.stringify({
      action: 'syncReport',
      anio,
      mes,
      nombre
    });

    const button = reportButton;
    const oldText = button ? button.textContent : '';
    if (button) {
      button.disabled = true;
      button.textContent = '⏳ Generando reporte…';
    }

    try {
      // Enviamos el reporte por POST sin abrir /exec en el navegador.
      // Esto evita el conflicto con la cuenta personal de Google del teléfono.
      await fetch(url, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: payload
      });

      alert('✅ Reporte mensual generado y guardado en Google Drive.\n\nRuta: INSPECCIONES_INFRAESTRUCTURA → REPORTES_MENSUALES → ' + anio + ' → ' + mes);
    } catch (e) {
      alert('No se pudo enviar el reporte a Google Drive. Se mantiene la información de las inspecciones.');
    } finally {
      if (button) {
        button.disabled = false;
        button.textContent = oldText || '📄 Generar reporte mensual';
      }
    }
  }

  if (reportButton) reportButton.onclick = generateAndSave;
  if (saveButton) saveButton.onclick = generateAndSave;
})();
