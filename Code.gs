const ROOT_FOLDER_NAME = 'INSPECCIONES_INFRAESTRUCTURA';

function doGet() {
  return ContentService.createTextOutput(JSON.stringify({ok:true,service:'INSPECCIONES_INFRAESTRUCTURA'}))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    const data = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    if (data.action === 'syncInspection') return syncInspection_(data);
    if (data.action === 'syncReport') return syncReport_(data);
    throw new Error('Acción no válida.');
  } catch (err) {
    return json_({ok:false,error:String(err && err.message ? err.message : err)});
  }
}

function syncInspection_(data) {
  if (!data.id) throw new Error('Falta el ID de inspección.');
  const root = getOrCreateFolder_(ROOT_FOLDER_NAME);
  const year = String(data.anio || new Date(data.fecha || Date.now()).getFullYear());
  const month = safe_(data.mes || 'SIN_MES');
  const day = Utilities.formatDate(new Date(data.fecha || Date.now()), Session.getScriptTimeZone(), 'yyyy-MM-dd');
  const zone = safe_(data.zona || 'SIN_ZONA');
  const point = safe_(data.punto || 'SIN_PUNTO');
  const yearFolder = getOrCreateFolder_(year, root);
  const monthFolder = getOrCreateFolder_(month, yearFolder);
  const dayFolder = getOrCreateFolder_(day, monthFolder);
  const inspectionFolder = getOrCreateFolder_(safe_(data.id) + '_' + zone + '_' + point, dayFolder);
  const jsonName = safe_(data.id) + '.json';
  const existing = inspectionFolder.getFilesByName(jsonName);
  if (existing.hasNext()) return json_({ok:true,alreadySynced:true,id:data.id});
  const metadata = Object.assign({}, data);
  const photos = Array.isArray(metadata.fotos) ? metadata.fotos : [];
  metadata.fotos = photos.map((_, i) => ({archivo: safe_(data.id) + '_foto_' + (i + 1) + '.jpg'}));
  metadata.sincronizadoEn = new Date().toISOString();
  inspectionFolder.createFile(jsonName, JSON.stringify(metadata, null, 2), MimeType.PLAIN_TEXT);
  photos.forEach((src, i) => {
    if (!src || typeof src !== 'string') return;
    const match = src.match(/^data:image\/[^;]+;base64,(.+)$/);
    if (!match) return;
    const bytes = Utilities.base64Decode(match[1]);
    const blob = Utilities.newBlob(bytes, 'image/jpeg', safe_(data.id) + '_foto_' + (i + 1) + '.jpg');
    inspectionFolder.createFile(blob);
  });
  return json_({ok:true,alreadySynced:false,id:data.id,folder:inspectionFolder.getUrl()});
}

function syncReport_(data) {
  const year = safe_(data.anio || new Date().getFullYear());
  const month = safe_(data.mes || 'SIN_MES');
  const name = safe_(data.nombre || ('Reporte_' + year + '_' + month)) + '.html';
  const html = String(data.html || '');
  if (!html) throw new Error('El reporte está vacío.');
  const root = getOrCreateFolder_(ROOT_FOLDER_NAME);
  const reports = getOrCreateFolder_('REPORTES_MENSUALES', root);
  const yearFolder = getOrCreateFolder_(year, reports);
  const monthFolder = getOrCreateFolder_(month, yearFolder);
  const old = monthFolder.getFilesByName(name);
  while (old.hasNext()) old.next().setTrashed(true);
  const file = monthFolder.createFile(name, html, MimeType.HTML);
  return json_({ok:true,id:name,url:file.getUrl()});
}

function getOrCreateFolder_(name, parent) {
  const folder = parent || DriveApp.getRootFolder();
  const it = folder.getFoldersByName(name);
  return it.hasNext() ? it.next() : folder.createFolder(name);
}

function safe_(value) {
  return String(value).replace(/[\\/:*?"<>|]/g, '_').trim().slice(0, 120) || 'SIN_NOMBRE';
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
