const ROOT_FOLDER_NAME = 'INSPECCIONES_INFRAESTRUCTURA';

function doGet(e) {
  const p = (e && e.parameter) || {};
  if (p.action === 'report') {
    const html = buildReportHtml_(p.anio || new Date().getFullYear(), p.mes || 'SIN_MES');
    return HtmlService.createHtmlOutput(html).setTitle('Reporte mensual de inspección');
  }
  if (p.action === 'check') {
    const id = String(p.id || '');
    const exists = fileExistsInFolderTree_(getOrCreateFolder_(ROOT_FOLDER_NAME), id + '.json');
    const result = {ok: exists, id: id};
    if (p.prefix) return ContentService.createTextOutput(String(p.prefix) + '(' + JSON.stringify(result) + ')').setMimeType(ContentService.MimeType.JAVASCRIPT);
    return json_(result);
  }
  return json_({ok:true,service:'INSPECCIONES_INFRAESTRUCTURA'});
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
  if (!existing.hasNext()) {
    const metadata = Object.assign({}, data);
    const photos = Array.isArray(metadata.fotos) ? metadata.fotos : [];
    metadata.fotos = photos.map((_, i) => ({archivo: safe_(data.id) + '_foto_' + (i + 1) + '.jpg'}));
    metadata.sincronizadoEn = new Date().toISOString();
    metadata.fotosAlmacenamiento = 'Google Drive';
    inspectionFolder.createFile(jsonName, JSON.stringify(metadata, null, 2), MimeType.PLAIN_TEXT);
    photos.forEach((src, i) => {
      if (!src || typeof src !== 'string') return;
      const match = src.match(/^data:image\/[^;]+;base64,(.+)$/);
      if (!match) return;
      const bytes = Utilities.base64Decode(match[1]);
      const blob = Utilities.newBlob(bytes, 'image/jpeg', safe_(data.id) + '_foto_' + (i + 1) + '.jpg');
      inspectionFolder.createFile(blob);
    });
  }
  return json_({ok:true,id:data.id,folder:inspectionFolder.getUrl()});
}

function syncReport_(data) {
  const year = safe_(data.anio || new Date().getFullYear());
  const month = safe_(data.mes || 'SIN_MES');
  const base = safe_(data.nombre || ('Reporte_' + year + '_' + month));
  const html = buildReportHtml_(year, month);
  if (!html || html.indexOf('No hay inspecciones') >= 0) throw new Error('No hay inspecciones sincronizadas en Drive para ese mes.');
  const root = getOrCreateFolder_(ROOT_FOLDER_NAME);
  const reports = getOrCreateFolder_('REPORTES_MENSUALES', root);
  const yearFolder = getOrCreateFolder_(year, reports);
  const monthFolder = getOrCreateFolder_(month, yearFolder);
  ['.pdf', '.html'].forEach(ext => {
    const old = monthFolder.getFilesByName(base + ext);
    while (old.hasNext()) old.next().setTrashed(true);
  });
  monthFolder.createFile(base + '.html', html, MimeType.HTML);
  const pdfBlob = Utilities.newBlob(html, 'text/html', base + '.html').getAs(MimeType.PDF).setName(base + '.pdf');
  const pdfFile = monthFolder.createFile(pdfBlob);
  return json_({ok:true,id:base + '.pdf',url:pdfFile.getUrl(),html:base + '.html'});
}

function buildReportHtml_(year, month) {
  const rows = collectMonthInspections_(year, month);
  if (!rows.length) return '<!doctype html><html lang="es"><body><h2>No hay inspecciones sincronizadas en Drive para ' + escapeHtml_(month) + ' ' + escapeHtml_(year) + '.</h2></body></html>';
  rows.sort(function(a,b){return (a.zona+a.punto+a.fecha).localeCompare(b.zona+b.punto+b.fecha);});
  const zones = unique_(rows.map(x=>x.zona));
  const points = unique_(rows.map(x=>x.zona+'|'+x.punto));
  const incidence = rows.filter(x=>x.resultado==='CON INCIDENCIA').length;
  const pending = rows.filter(x=>x.estado==='PENDIENTE').length;
  const noInc = rows.filter(x=>x.resultado==='SIN INCIDENCIA').length;
  const photos = rows.reduce((n,x)=>n+(x.photoData||[]).length,0);
  let h = '<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Reporte mensual '+escapeHtml_(month)+' '+escapeHtml_(year)+'</title><style>'+
    'body{font-family:Arial,sans-serif;color:#17202a;margin:0}header{text-align:center;padding:28px 24px;border-bottom:3px solid #0b57d0}h1{font-size:24px;margin:0 0 10px}h2{background:#e8eef8;padding:10px 12px;margin:24px 0 12px;break-after:avoid}.page{padding:0 25px}.summary{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:20px 0}.box{border:1px solid #ccc;padding:12px;text-align:center}.num{font-size:22px;font-weight:bold}.item{border:1px solid #ccd2d8;padding:12px;margin:12px 0;break-inside:avoid;page-break-inside:avoid}.itemTitle{font-weight:bold;margin-bottom:7px}.photos{display:grid;grid-template-columns:repeat(2,1fr);gap:8px;margin-top:10px}.photos img{width:100%;height:230px;object-fit:contain;border:1px solid #ddd}.small{font-size:12px;color:#555}@media print{h2{break-after:avoid;page-break-after:avoid}.item{break-inside:avoid;page-break-inside:avoid}.photos img{break-inside:avoid;page-break-inside:avoid}}@media(max-width:700px){.summary{grid-template-columns:repeat(2,1fr)}.photos{grid-template-columns:1fr}}'+
    '</style></head><body><header><h1>REPORTE MENSUAL DE INSPECCIÓN DE INFRAESTRUCTURA</h1><b>MES: '+escapeHtml_(month)+' &nbsp; AÑO: '+escapeHtml_(year)+'</b><div class="small">Generado: '+escapeHtml_(new Date().toLocaleString('es-PE'))+'</div></header><div class="page">'+
    '<div class="summary"><div class="box"><div class="num">'+rows.length+'</div>Inspecciones</div><div class="box"><div class="num">'+zones.length+'</div>Áreas</div><div class="box"><div class="num">'+points.length+'</div>Puntos</div><div class="box"><div class="num">'+incidence+'</div>Incidencias</div></div>'+
    '<div class="summary"><div class="box"><div class="num">'+pending+'</div>Pendientes</div><div class="box"><div class="num">'+noInc+'</div>Sin incidencia</div><div class="box"><div class="num">'+photos+'</div>Fotografías</div><div class="box"><div class="num">'+rows.length+'</div>En Drive</div></div>';
  let last='';
  rows.forEach(function(x){
    if(x.zona!==last){h += '<h2>ÁREA / ZONA: '+escapeHtml_(x.zona)+'</h2>'; last=x.zona;}
    h += '<div class="item"><div class="itemTitle">PUNTO DE INSPECCIÓN: '+escapeHtml_(x.punto)+'</div><b>Fecha:</b> '+escapeHtml_(formatDate_(x.fecha))+'<br><b>Resultado:</b> '+escapeHtml_(x.resultado||'')+'<br>'+(x.estado?'<b>Estado:</b> '+escapeHtml_(x.estado)+'<br>':'')+'<b>Observación:</b> '+escapeHtml_(x.observacion||'Sin incidencia')+'<br><b>Fotografías:</b> '+((x.photoData||[]).length)+'<div class="photos">'+(x.photoData||[]).map(function(src){return '<img src="'+src+'">';}).join('')+'</div></div>';
  });
  h += '<p class="small"><b>Total de inspecciones del mes:</b> '+rows.length+'</p></div></body></html>';
  return h;
}

function collectMonthInspections_(year, month) {
  const root = getOrCreateFolder_(ROOT_FOLDER_NAME);
  const yf = root.getFoldersByName(String(year));
  if(!yf.hasNext()) return [];
  const mf = yf.next().getFoldersByName(String(month));
  if(!mf.hasNext()) return [];
  const rows=[];
  collectInspectionFiles_(mf.next(), rows);
  return rows;
}

function collectInspectionFiles_(folder, rows) {
  const files = folder.getFiles();
  while(files.hasNext()){
    const f=files.next();
    if(f.getName().toLowerCase().endsWith('.json')){
      try{
        const x=JSON.parse(f.getBlob().getDataAsString());
        x.photoData=[];
        const parent=f.getParents().hasNext()?f.getParents().next():folder;
        const photoNames=(x.fotos||[]).map(p=>typeof p==='string'?p:p.archivo).filter(Boolean);
        photoNames.forEach(function(name){
          const pf=parent.getFilesByName(name);
          if(pf.hasNext()){
            const b=pf.next().getBlob();
            x.photoData.push('data:'+(b.getContentType()||'image/jpeg')+';base64,'+Utilities.base64Encode(b.getBytes()));
          }
        });
        rows.push(x);
      }catch(err){}
    }
  }
  const sub=folder.getFolders();
  while(sub.hasNext()) collectInspectionFiles_(sub.next(),rows);
}

function fileExistsInFolderTree_(folder, fileName) {
  if (folder.getFilesByName(fileName).hasNext()) return true;
  const sub = folder.getFolders();
  while (sub.hasNext()) if (fileExistsInFolderTree_(sub.next(), fileName)) return true;
  return false;
}

function unique_(arr){return Array.from(new Set(arr));}
function formatDate_(value){try{return new Date(value).toLocaleString('es-PE');}catch(e){return String(value||'');}}
function escapeHtml_(value){return String(value==null?'':value).replace(/[&<>"']/g,function(m){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m];});}
function getOrCreateFolder_(name,parent){const folder=parent||DriveApp.getRootFolder();const it=folder.getFoldersByName(name);return it.hasNext()?it.next():folder.createFolder(name);}
function safe_(value){return String(value).replace(/[\\/:*?"<>|]/g,'_').trim().slice(0,120)||'SIN_NOMBRE';}
function json_(obj){return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);}
