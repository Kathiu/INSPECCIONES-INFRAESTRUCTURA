(() => {
  const saveButton = document.getElementById('saveReportDrive');

  const getConfig = () => ({
    url: localStorage.getItem('inspecciones_drive_url') || '',
    mes: document.getElementById('reportMonth').value,
    anio: Number(document.getElementById('reportYear').value)
  });

  async function saveReportToDrive() {
    const { url, mes, anio } = getConfig();

    if (!url) {
      return alert('Primero conecte Google Drive.');
    }

    if (!navigator.onLine) {
      return alert(
        'No hay Internet. Para guardar el reporte en Google Drive necesita conexión.'
      );
    }

    const nombre = 'Reporte_' + anio + '_' + mes;

    const payload = JSON.stringify({
      action: 'syncReport',
      anio: anio,
      mes: mes,
      nombre: nombre
    });

    const oldText = saveButton ? saveButton.textContent : '';

    if (saveButton) {
      saveButton.disabled = true;
      saveButton.textContent = '⏳ Guardando reporte…';
    }

    try {
      await fetch(url, {
        method: 'POST',
        mode: 'no-cors',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8'
        },
        body: payload
      });

      /*
       * No mostramos "guardado correctamente" inmediatamente,
       * porque no-cors no permite leer la respuesta.
       *
       * Esperamos unos segundos para dar tiempo a Apps Script
       * a crear el archivo.
       */
      await new Promise(resolve => setTimeout(resolve, 3000));

      alert(
        '☁️ Solicitud enviada a Google Drive.\n\n' +
        'Revise la carpeta:\n' +
        'INSPECCIONES_INFRAESTRUCTURA → REPORTES_MENSUALES → ' +
        anio + ' → ' + mes +
        '\n\n' +
        'Si el PDF no aparece, continuaremos con la corrección de la conexión.'
      );

    } catch (e) {
      console.error(e);

      alert(
        '❌ No se pudo enviar el reporte a Google Drive.\n\n' +
        'La información de sus inspecciones permanece guardada en el teléfono.'
      );

    } finally {
      if (saveButton) {
        saveButton.disabled = false;
        saveButton.textContent =
          oldText || '☁️ Guardar reporte en Drive';
      }
    }
  }

  /*
   * IMPORTANTE:
   * Solo el botón "Guardar reporte en Drive"
   * usa esta función.
   *
   * NO modificamos el botón "Generar reporte mensual".
   */
  if (saveButton) {
    saveButton.onclick = saveReportToDrive;
  }
})();
