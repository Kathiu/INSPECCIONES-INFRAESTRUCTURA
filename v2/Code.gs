/************************************************************
 * INSPECCIONES INFRAESTRUCTURA 2
 * Backend de Google Apps Script independiente
 * Autorizar/publicar desde: kcorrea@aliexperu.com.pe
 * Version: 1.0
 ************************************************************/

const ROOT_FOLDER_NAME = 'INSPECCIONES_INFRAESTRUCTURA_2';
const REPORTS_FOLDER_NAME = 'REPORTES_MENSUALES_2';
const MAX_PHOTOS_PER_INSPECTION = 12;

/************************************************************
 * 1. GET: ESTADO, VERIFICACIÓN Y REPORTES
 ************************************************************/

function doGet(e) {
  const p = (e && e.parameter) || {};

  // Abrir el reporte HTML mensual.
  if (p.action === 'report') {
    return HtmlService.createHtmlOutput(
      buildReportHtml_(
        p.anio || new Date().getFullYear(),
        p.mes || 'SIN_MES'
      )
    ).setTitle('Reporte mensual de inspección');
  }

  // Generar PDF mensual.
  if (p.action === 'generateReport') {
    try {
      const result = syncReport_({
        anio: p.anio,
        mes: p.mes,
        nombre: p.nombre ||
          ('Reporte_' + p.anio + '_' + p.mes)
      });

      const data = JSON.parse(result.getContent());

      if (p.view === '1') {
        return HtmlService.createHtmlOutput(
          '<!doctype html><html lang="es">' +
          '<head><meta charset="utf-8">' +
          '<meta name="viewport" content="width=device-width,initial-scale=1">' +
          '<style>' +
          'body{font-family:Arial,sans-serif;padding:24px;max-width:560px;margin:auto;text-align:center}' +
          'a{display:block;padding:14px;margin:12px 0;background:#0b57d0;color:white;text-decoration:none;border-radius:8px}' +
          'a.download{background:#16803a}' +
          'small{color:#666;overflow-wrap:anywhere}' +
          '</style></head><body>' +
          '<h2>Reporte mensual generado</h2>' +
          '<p>El PDF fue creado y guardado en Google Drive.</p>' +
          '<a class="download" href="' +
          escapeHtml_(data.downloadUrl) +
          '" target="_blank">Descargar PDF al celular</a>' +
          '<a href="' + escapeHtml_(data.url) +
          '" target="_blank">Abrir PDF en Drive</a>' +
          '<a href="' + escapeHtml_(data.htmlUrl) +
          '" target="_blank">Abrir HTML</a>' +
          '<small>' + escapeHtml_(data.id) +
          '</small></body></html>'
        ).setTitle('Reporte mensual');
      }

      return callbackOrJson_(data, p.prefix);

    } catch (err) {
      const obj = {
        ok: false,
        error: String(err && err.message ? err.message : err)
      };

      if (p.view === '1') {
        return HtmlService.createHtmlOutput(
          '<h3>No se pudo generar el reporte</h3><p>' +
          escapeHtml_(obj.error) + '</p>'
        );
      }

      return callbackOrJson_(obj, p.prefix);
    }
  }

  // Comprobar si una inspección está guardada en Drive.
  if (p.action === 'check') {
    try {
      const id = String(p.id || '').trim();

      if (!id) {
        throw new Error('Falta el ID para verificar.');
      }

      const found = fileExistsInFolderTree_(
        getOrCreateFolder_(ROOT_FOLDER_NAME),
        safe_(id) + '.json'
      );

      return callbackOrJson_({
        ok: found,
        id: id,
        checkedAt: new Date().toISOString()
      }, p.prefix);

    } catch (err) {
      return callbackOrJson_({
        ok: false,
        error: String(err && err.message ? err.message : err),
        id: String(p.id || '')
      }, p.prefix);
    }
  }

  // Comprobación general del servicio.
  return json_({
    ok: true,
    service: 'INSPECCIONES_INFRAESTRUCTURA_2',
    version: '1.0'
  });
}

/************************************************************
 * 2. POST: RECIBIR DATOS DE LA APLICACIÓN
 ************************************************************/

function doPost(e) {
  try {
    console.log('doPost recibido; payload en formulario=' +
      Boolean(e && e.parameter && e.parameter.payload) +
      '; postData presente=' +
      Boolean(e && e.postData && e.postData.contents) +
      '; tipo=' +
      String(e && e.postData && e.postData.type || 'no indicado'));
    const data = parsePostData_(e);

    if (!data || typeof data !== 'object' ||
        Array.isArray(data)) {
      throw new Error('Los datos recibidos no son válidos.');
    }

    if (!data.action) {
      throw new Error('Falta la acción solicitada.');
    }

    switch (String(data.action)) {
      case 'syncInspection':
        return syncInspection_(data);

      case 'syncReport':
        return syncReport_(data);

      default:
        throw new Error(
          'Acción no válida: ' + String(data.action)
        );
    }

  } catch (err) {
    console.error(
      'doPost: ' +
      String(err && err.stack ? err.stack : err)
    );

    return json_({
      ok: false,
      error: String(err && err.message ? err.message : err)
    });
  }
}

/************************************************************
 * 3. INTERPRETAR LOS DATOS RECIBIDOS
 ************************************************************/

function parsePostData_(e) {
  // Formulario enviado con un campo llamado payload.
  if (e && e.parameter && e.parameter.payload) {
    return JSON.parse(e.parameter.payload);
  }

  const raw = e && e.postData && e.postData.contents
    ? e.postData.contents
    : '';

  if (!raw) {
    throw new Error(
      'La solicitud POST llegó vacía. Revisa app.js.'
    );
  }

  // Intentar interpretar JSON directamente.
  try {
    return JSON.parse(raw);
  } catch (jsonError) {
    // Si no es JSON, intentar formulario URL-encoded.
    const params = {};

    raw.split('&').forEach(function(part) {
      const i = part.indexOf('=');

      if (i < 0) return;

      const key = decodeURIComponent(
        part.slice(0, i).replace(/\+/g, ' ')
      );

      const value = decodeURIComponent(
        part.slice(i + 1).replace(/\+/g, ' ')
      );

      params[key] = value;
    });

    if (!params.payload) {
      throw new Error(
        'No se encontró payload en la solicitud POST.'
      );
    }

    return JSON.parse(params.payload);
  }
}

/************************************************************
 * 4. GUARDAR INSPECCIÓN Y FOTOGRAFÍAS EN DRIVE
 ************************************************************/

function syncInspection_(data) {
  if (!data.id) {
    throw new Error('Falta el ID de inspección.');
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(20000);

  try {
    const root = getOrCreateFolder_(ROOT_FOLDER_NAME);
    const date = new Date(data.fecha || new Date());

    if (isNaN(date.getTime())) {
      throw new Error('La fecha de inspección no es válida.');
    }

    const year = String(
      data.anio || date.getFullYear()
    );

    const month = safe_(data.mes || 'SIN_MES');

    const day = Utilities.formatDate(
      date,
      Session.getScriptTimeZone(),
      'yyyy-MM-dd'
    );

    const zone = safe_(data.zona || 'SIN_ZONA');
    const point = safe_(data.punto || 'SIN_PUNTO');

    // Estructura: raíz / año / mes / día / inspección.
    const yearFolder = getOrCreateFolder_(year, root);
    const monthFolder = getOrCreateFolder_(month, yearFolder);
    const dayFolder = getOrCreateFolder_(day, monthFolder);

    const inspectionFolder = getOrCreateFolder_(
      safe_(data.id) + '_' + zone + '_' + point,
      dayFolder
    );

    const photos = Array.isArray(data.fotos)
      ? data.fotos
      : [];

    if (photos.length > MAX_PHOTOS_PER_INSPECTION) {
      throw new Error(
        'El máximo permitido es ' +
        MAX_PHOTOS_PER_INSPECTION + ' fotografías.'
      );
    }

    const photoFiles = [];
    const photoErrors = [];

    photos.forEach(function(src, i) {
      try {
        // Aceptar imágenes en formato data URL.
        if (typeof src !== 'string') {
          throw new Error(
            'La fotografía no está en formato de texto.'
          );
        }

        const match = src.match(
          /^data:(image\/[a-zA-Z0-9.+-]+);base64,([\s\S]+)$/
        );

        if (!match) {
          throw new Error(
            'Formato de fotografía no válido.'
          );
        }

        const mimeType = match[1].toLowerCase();

        const allowed = [
          'image/jpeg',
          'image/jpg',
          'image/png',
          'image/webp'
        ];

        if (allowed.indexOf(mimeType) < 0) {
          throw new Error(
            'Formato no admitido: ' + mimeType
          );
        }

        const extension = mimeType === 'image/png'
          ? 'png'
          : mimeType === 'image/webp'
            ? 'webp'
            : 'jpg';

        const fileName =
          safe_(data.id) + '_foto_' + (i + 1) +
          '.' + extension;

        // Reutilizar la foto si ya se guardó anteriormente.
        const existing =
          inspectionFolder.getFilesByName(fileName);

        if (existing.hasNext()) {
          photoFiles.push({
            archivo: fileName,
            mimeType: mimeType
          });
          return;
        }

        const bytes = Utilities.base64Decode(match[2]);

        const blob = Utilities.newBlob(
          bytes,
          mimeType,
          fileName
        );

        inspectionFolder.createFile(blob);

        photoFiles.push({
          archivo: fileName,
          mimeType: mimeType
        });

      } catch (photoError) {
        photoErrors.push({
          foto: i + 1,
          error: String(
            photoError && photoError.message
              ? photoError.message
              : photoError
          )
        });
      }
    });

    if (photos.length > 0 && photoFiles.length === 0) {
      throw new Error(
        'No se pudo guardar ninguna fotografía: ' +
        JSON.stringify(photoErrors)
      );
    }

    // Guardar los datos de la inspección.
    const metadata = Object.assign({}, data);

    metadata.fotos = photoFiles;
    metadata.sincronizadoEn = new Date().toISOString();
    metadata.fotosAlmacenamiento = 'Google Drive';

    if (photoErrors.length > 0) {
      metadata.erroresFotos = photoErrors;
    } else {
      delete metadata.erroresFotos;
    }

    const jsonName = safe_(data.id) + '.json';
    const jsonText = JSON.stringify(metadata, null, 2);
    const existingJson =
      inspectionFolder.getFilesByName(jsonName);

    if (existingJson.hasNext()) {
      existingJson.next().setContent(jsonText);
    } else {
      inspectionFolder.createFile(
        jsonName,
        jsonText,
        MimeType.PLAIN_TEXT
      );
    }

    return json_({
      ok: true,
      id: data.id,
      folder: inspectionFolder.getUrl(),
      fotos: photoFiles.length,
      erroresFotos: photoErrors
    });

  } finally {
    lock.releaseLock();
  }
}

/************************************************************
 * 5. GENERAR REPORTE MENSUAL EN HTML Y PDF
 ************************************************************/

function syncReport_(data) {
  const year = safe_(
    data.anio || new Date().getFullYear()
  );

  const month = safe_(data.mes || 'SIN_MES');

  const base = safe_(
    data.nombre || ('Reporte_' + year + '_' + month)
  );

  const html = buildReportHtml_(year, month);

  if (!html || html.indexOf('No hay inspecciones') >= 0) {
    throw new Error(
      'No hay inspecciones sincronizadas en Drive para ' +
      month + ' ' + year + '.'
    );
  }

  let pdfBlob;

  try {
    const htmlBlob = Utilities.newBlob(
      html,
      MimeType.HTML,
      base + '.html'
    );

    pdfBlob = htmlBlob.getAs(MimeType.PDF);
    pdfBlob.setName(base + '.pdf');

  } catch (err) {
    throw new Error(
      'No se pudo convertir el reporte a PDF. ' +
      'Puede ser demasiado grande. Detalle: ' +
      String(err && err.message ? err.message : err)
    );
  }

  const root = getOrCreateFolder_(ROOT_FOLDER_NAME);
  const reports = getOrCreateFolder_(
    REPORTS_FOLDER_NAME,
    root
  );
  const yearFolder = getOrCreateFolder_(year, reports);
  const monthFolder = getOrCreateFolder_(month, yearFolder);

  // Crear primero los archivos nuevos.
  const htmlFile = monthFolder.createFile(
    base + '.html',
    html,
    MimeType.HTML
  );

  let pdfFile;

  try {
    pdfFile = monthFolder.createFile(pdfBlob);
  } catch (err) {
    htmlFile.setTrashed(true);
    throw new Error(
      'No se pudo guardar el PDF en Drive: ' +
      String(err && err.message ? err.message : err)
    );
  }

  // Eliminar versiones anteriores solo si el PDF se guardó.
  ['.pdf', '.html'].forEach(function(ext) {
    const oldFiles = monthFolder.getFilesByName(base + ext);

    while (oldFiles.hasNext()) {
      const oldFile = oldFiles.next();

      if (oldFile.getId() !== pdfFile.getId() &&
          oldFile.getId() !== htmlFile.getId()) {
        oldFile.setTrashed(true);
      }
    }
  });

  return json_({
    ok: true,
    id: pdfFile.getName(),
    url: pdfFile.getUrl(),
    downloadUrl:
      'https://drive.google.com/uc?export=download&id=' +
      encodeURIComponent(pdfFile.getId()),
    htmlUrl: htmlFile.getUrl(),
    bytes: pdfBlob.getBytes().length
  });
}

/************************************************************
 * 6. CONSTRUIR EL CONTENIDO DEL REPORTE
 ************************************************************/

function buildReportHtml_(year, month) {
  const rows = collectMonthInspections_(year, month);

  if (!rows.length) {
    return '<!doctype html><html lang="es"><body>' +
      '<h2>No hay inspecciones sincronizadas en Drive para ' +
      escapeHtml_(month) + ' ' + escapeHtml_(year) +
      '.</h2></body></html>';
  }

  rows.sort(function(a, b) {
    const first =
      String(a.zona || '') +
      String(a.punto || '') +
      String(a.fecha || '');

    const second =
      String(b.zona || '') +
      String(b.punto || '') +
      String(b.fecha || '');

    return first.localeCompare(second);
  });

  const zones = unique_(rows.map(function(x) {
    return x.zona || 'SIN_ZONA';
  }));

  const points = unique_(rows.map(function(x) {
    return (x.zona || '') + '|' + (x.punto || '');
  }));

  const incidence = rows.filter(function(x) {
    return String(x.resultado || '').toUpperCase() ===
      'CON INCIDENCIA';
  }).length;

  const pending = rows.filter(function(x) {
    return String(x.estado || '').toUpperCase() ===
      'PENDIENTE';
  }).length;

  const noInc = rows.filter(function(x) {
    return String(x.resultado || '').toUpperCase() ===
      'SIN INCIDENCIA';
  }).length;

  const photoCount = rows.reduce(function(total, x) {
    return total + (x.photoData || []).length;
  }, 0);

  let html = '<!doctype html><html lang="es"><head>' +
    '<meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<title>Reporte mensual ' + escapeHtml_(month) +
    ' ' + escapeHtml_(year) + '</title>' +
    '<style>' + reportCss_() + '</style></head><body>' +
    '<header>' +
    '<h1>REPORTE MENSUAL DE INSPECCIÓN DE INFRAESTRUCTURA</h1>' +
    '<b>MES: ' + escapeHtml_(month) +
    ' | AÑO: ' + escapeHtml_(year) + '</b>' +
    '<div class="small">Generado: ' +
    escapeHtml_(new Date().toLocaleString('es-PE')) +
    '</div></header><main><section class="summary">' +
    summaryCell_(rows.length, 'Inspecciones') +
    summaryCell_(zones.length, 'Áreas') +
    summaryCell_(points.length, 'Puntos') +
    summaryCell_(incidence, 'Incidencias') +
    summaryCell_(pending, 'Pendientes') +
    summaryCell_(noInc, 'Sin incidencia') +
    summaryCell_(photoCount, 'Fotografías') +
    summaryCell_(rows.length, 'Registros') +
    '</section>';

  let lastZone = '';

  rows.forEach(function(item) {
    const zone = item.zona || 'SIN_ZONA';

    if (zone !== lastZone) {
      html += '<h2>ÁREA / ZONA: ' +
        escapeHtml_(zone) + '</h2>';
      lastZone = zone;
    }

    const photos = item.photoData || [];

    html += '<article class="item">' +
      '<div class="itemInfo">' +
      '<div class="itemTitle">PUNTO DE INSPECCIÓN: ' +
      escapeHtml_(item.punto || 'SIN_PUNTO') +
      '</div>' +
      '<div class="data"><b>Fecha:</b> ' +
      escapeHtml_(formatDate_(item.fecha)) + '</div>' +
      '<div class="data"><b>Resultado:</b> ' +
      escapeHtml_(item.resultado || '') + '</div>' +
      (item.estado
        ? '<div class="data"><b>Estado:</b> ' +
          escapeHtml_(item.estado) + '</div>'
        : '') +
      '<div class="data"><b>Observación:</b> ' +
      escapeHtml_(item.observacion || 'Sin observación') +
      '</div>' +
      '<div class="photoLabel"><b>Fotografías:</b> ' +
      photos.length + '</div></div>' +
      '<div class="photoArea">' +
      photoRowsHtml_(photos) +
      '</div></article>';
  });

  return html + '</main></body></html>';
}

function summaryCell_(value, label) {
  return '<div><b>' + escapeHtml_(value) +
    '</b><span>' + escapeHtml_(label) +
    '</span></div>';
}

/************************************************************
 * 7. INSERTAR FOTOGRAFÍAS EN EL REPORTE
 ************************************************************/

function photoRowsHtml_(photos) {
  let html = '';

  for (let i = 0; i < photos.length; i += 2) {
    html += '<div class="photoRow">';

    html += '<div class="photoCell">' +
      (photos[i]
        ? '<img src="' + photos[i] +
          '" alt="Fotografía de inspección">'
        : '') +
      '</div>';

    html += '<div class="photoCell">' +
      (photos[i + 1]
        ? '<img src="' + photos[i + 1] +
          '" alt="Fotografía de inspección">'
        : '') +
      '</div>';

    html += '</div>';
  }

  return html;
}

/************************************************************
 * 8. ESTILOS DEL REPORTE
 ************************************************************/

function reportCss_() {
  return '@page{size:A4;margin:10mm 9mm 11mm}' +
    'html,body{font-family:Arial,sans-serif;color:#17202a;margin:0;padding:0;font-size:9pt}' +
    'header{text-align:center;padding:10px 14px 9px;border-bottom:2px solid #0b57d0}' +
    'h1{font-size:16pt;margin:0 0 5px}' +
    'h2{font-size:12pt;background:#e8eef8;padding:5px 8px;margin:9px 0 6px;page-break-after:avoid}' +
    '.small{font-size:7.5pt;color:#555}' +
    'main{padding:0 2px}' +
    '.summary{display:grid;grid-template-columns:repeat(4,1fr);gap:4px;margin:7px 0}' +
    '.summary div{border:1px solid #c9cdd2;padding:4px;text-align:center}' +
    '.summary b{display:block;font-size:11pt}' +
    '.summary span{font-size:7pt}' +
    '.item{display:grid;grid-template-columns:5.7cm 1fr;column-gap:5mm;border:1px solid #c9cdd2;padding:5px;margin:5px 0}' +
    '.itemInfo{padding:1px 2px}' +
    '.itemTitle{font-weight:bold;margin-bottom:4px;font-size:9.5pt}' +
    '.data{font-size:8pt;margin-bottom:3px;line-height:1.3;overflow-wrap:anywhere}' +
    '.photoLabel{margin-top:4px;font-size:8pt}' +
    '.photoArea{min-width:0}' +
    '.photoRow{display:grid;grid-template-columns:6cm 6cm;column-gap:3mm;margin-bottom:2mm;page-break-inside:avoid}' +
    '.photoCell{width:6cm;height:4cm;display:flex;align-items:center;justify-content:center;overflow:hidden;border:1px solid #ddd;background:#fff}' +
    '.photoCell img{width:6cm;height:4cm;object-fit:contain;display:block}' +
    '@media print{.photoRow{page-break-inside:avoid}}' +
    '@media(max-width:700px){.summary{grid-template-columns:repeat(2,1fr)}.item{grid-template-columns:1fr}}';
}

/************************************************************
 * 9. LEER INSPECCIONES Y FOTOGRAFÍAS DESDE DRIVE
 ************************************************************/

function collectMonthInspections_(year, month) {
  const root = getOrCreateFolder_(ROOT_FOLDER_NAME);
  const yearFolders = root.getFoldersByName(String(year));

  if (!yearFolders.hasNext()) return [];

  const monthFolders = yearFolders.next().getFoldersByName(
    String(month)
  );

  if (!monthFolders.hasNext()) return [];

  const rows = [];

  collectInspectionFiles_(monthFolders.next(), rows);

  return rows;
}

function collectInspectionFiles_(folder, rows) {
  const files = folder.getFiles();

  while (files.hasNext()) {
    const file = files.next();

    if (!file.getName().toLowerCase().endsWith('.json')) {
      continue;
    }

    try {
      const item = JSON.parse(
        file.getBlob().getDataAsString()
      );

      item.photoData = [];

      const parents = file.getParents();
      const parent = parents.hasNext()
        ? parents.next()
        : folder;

      const photos = Array.isArray(item.fotos)
        ? item.fotos
        : [];

      photos.forEach(function(photo) {
        try {
          const name = typeof photo === 'string'
            ? photo
            : photo && photo.archivo;

          if (!name) return;

          const photoFiles = parent.getFilesByName(name);

          if (!photoFiles.hasNext()) {
            console.warn('No se encontró la foto: ' + name);
            return;
          }

          const photoFile = photoFiles.next();
          const blob = photoFile.getBlob();
          const mimeType =
            blob.getContentType() || 'image/jpeg';

          if (mimeType.indexOf('image/') !== 0) {
            return;
          }

          const base64 = Utilities.base64Encode(
            blob.getBytes()
          );

          item.photoData.push(
            'data:' + mimeType + ';base64,' + base64
          );

        } catch (photoError) {
          console.error(
            'Error leyendo fotografía: ' +
            String(
              photoError && photoError.message
                ? photoError.message
                : photoError
            )
          );
        }
      });

      rows.push(item);

    } catch (err) {
      console.error(
        'Error leyendo ' + file.getName() + ': ' + err
      );
    }
  }

  // Buscar también dentro de las carpetas de inspección.
  const subfolders = folder.getFolders();

  while (subfolders.hasNext()) {
    collectInspectionFiles_(subfolders.next(), rows);
  }
}

/************************************************************
 * 10. FUNCIONES AUXILIARES
 ************************************************************/

function fileExistsInFolderTree_(folder, fileName) {
  if (folder.getFilesByName(fileName).hasNext()) {
    return true;
  }

  const subfolders = folder.getFolders();

  while (subfolders.hasNext()) {
    if (
      fileExistsInFolderTree_(subfolders.next(), fileName)
    ) {
      return true;
    }
  }

  return false;
}

function unique_(arr) {
  return Array.from(new Set(arr));
}

function formatDate_(value) {
  if (!value) return '';

  try {
    return new Date(value).toLocaleString('es-PE');
  } catch (err) {
    return String(value);
  }
}

function escapeHtml_(value) {
  return String(value == null ? '' : value).replace(
    /[&<>"']/g,
    function(m) {
      return {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
      }[m];
    }
  );
}

function safe_(value) {
  return String(value == null ? '' : value)
    .replace(/[\\/:*?"<>|]/g, '_')
    .trim()
    .slice(0, 120) || 'SIN_NOMBRE';
}

function getOrCreateFolder_(name, parent) {
  const folder = parent || DriveApp.getRootFolder();
  const folders = folder.getFoldersByName(name);

  return folders.hasNext()
    ? folders.next()
    : folder.createFolder(name);
}

function json_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function callbackOrJson_(obj, prefix) {
  if (
    prefix &&
    /^[A-Za-z_$][0-9A-Za-z_$]*$/.test(String(prefix))
  ) {
    return ContentService.createTextOutput(
      prefix + '(' + JSON.stringify(obj) + ');'
    ).setMimeType(ContentService.MimeType.JAVASCRIPT);
  }

  return json_(obj);
}

/**
 * Ejecutar manualmente una sola vez desde el editor de Apps Script.
 * Crea las carpetas de la nueva aplicación y solicita autorización de Drive.
 * No lee, mueve ni elimina archivos de la aplicación anterior.
 */
function autorizarDriveInspecciones2() {
  const root = getOrCreateFolder_(ROOT_FOLDER_NAME);
  getOrCreateFolder_(REPORTS_FOLDER_NAME, root);
  Logger.log('Autorización de Drive completada. Carpeta: ' + root.getUrl());
  return root.getUrl();
}
