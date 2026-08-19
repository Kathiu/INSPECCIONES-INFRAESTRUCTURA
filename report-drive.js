(() => {
  const button = document.getElementById('saveReportDrive');
  if (!button) return;
  const esc = s => String(s ?? '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
  const openDb = () => new Promise((resolve,reject)=>{const r=indexedDB.open('inspecciones-infraestructura',1);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)});
  const getAll = db => new Promise((resolve,reject)=>{const r=db.transaction('inspecciones','readonly').objectStore('inspecciones').getAll();r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)});
  button.onclick = async () => {
    const url = localStorage.getItem('inspecciones_drive_url');
    if (!url) return alert('Primero conecte Google Drive.');
    if (!navigator.onLine) return alert('No hay Internet. El reporte puede generarse localmente, pero para guardarlo en Drive necesita conexión.');
    const mes = document.getElementById('reportMonth').value;
    const anio = Number(document.getElementById('reportYear').value);
    button.disabled = true;
    try {
      const db = await openDb();
      const all = await getAll(db);
      const rows = all.filter(x=>x.mes===mes && Number(x.anio)===anio).sort((a,b)=>(a.zona+a.punto+a.fecha).localeCompare(b.zona+b.punto+b.fecha));
      if (!rows.length) return alert('No hay inspecciones para el mes y año seleccionados.');
      const zones=[...new Set(rows.map(x=>x.zona))];
      const points=[...new Set(rows.map(x=>x.zona+'|'+x.punto))];
      const incidence=rows.filter(x=>x.resultado==='CON INCIDENCIA').length;
      const pending=rows.filter(x=>x.estado==='PENDIENTE').length;
      const photos=rows.reduce((n,x)=>n+(x.fotos||[]).length,0);
      let html=`<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Reporte mensual ${esc(mes)} ${anio}</title><style>body{font-family:Arial,sans-serif;color:#17202a;margin:0}header{text-align:center;padding:30px;border-bottom:3px solid #0b57d0}h1{font-size:24px}h2{background:#e8eef8;padding:10px;margin-top:24px}.page{padding:0 28px}.summary{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:22px 0}.box{border:1px solid #ccc;padding:12px;text-align:center}.num{font-size:22px;font-weight:bold}.item{border:1px solid #ccd2d8;padding:14px;margin:12px 0;break-inside:avoid}.photos{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:10px}.photos img{width:100%;height:220px;object-fit:contain;border:1px solid #ddd}.small{font-size:12px;color:#555}@media print{.item{break-inside:avoid}}@media(max-width:700px){.summary{grid-template-columns:repeat(2,1fr)}.photos{grid-template-columns:1fr}}</style></head><body><header><h1>REPORTE MENSUAL DE INSPECCIÓN DE INFRAESTRUCTURA</h1><b>MES: ${esc(mes)} &nbsp; AÑO: ${anio}</b><div class="small">Generado: ${new Date().toLocaleString('es-PE')}</div></header><div class="page"><div class="summary"><div class="box"><div class="num">${rows.length}</div>Inspecciones</div><div class="box"><div class="num">${zones.length}</div>Áreas</div><div class="box"><div class="num">${points.length}</div>Puntos</div><div class="box"><div class="num">${incidence}</div>Incidencias</div></div><div class="summary"><div class="box"><div class="num">${pending}</div>Pendientes</div><div class="box"><div class="num">${rows.filter(x=>x.resultado==='SIN INCIDENCIA').length}</div>Sin incidencia</div><div class="box"><div class="num">${photos}</div>Fotografías</div><div class="box"><div class="num">${rows.filter(x=>x.sync==='SINCRONIZADO').length}</div>En Drive</div></div>`;
      let last='';
      rows.forEach(x=>{if(x.zona!==last){html+=`<h2>ÁREA / ZONA: ${esc(x.zona)}</h2>`;last=x.zona}html+=`<div class="item"><b>PUNTO DE INSPECCIÓN:</b> ${esc(x.punto)}<br><b>Fecha:</b> ${new Date(x.fecha).toLocaleString('es-PE')}<br><b>Resultado:</b> ${esc(x.resultado)}<br>${x.estado?`<b>Estado:</b> ${esc(x.estado)}<br>`:''}<b>Observación:</b> ${esc(x.observacion||'Sin incidencia')}<br><b>Fotografías:</b> ${(x.fotos||[]).length}<div class="photos">${(x.fotos||[]).map(f=>`<img src="${f}">`).join('')}</div></div>`});
      html+='</div></body></html>';
      const payload={action:'syncReport',anio,mes,nombre:`Reporte_${anio}_${mes}`,html};
      await fetch(url,{method:'POST',mode:'no-cors',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify(payload)});
      alert(`Reporte de ${mes} ${anio} enviado a Google Drive.\n\nQuedará en INSPECCIONES_INFRAESTRUCTURA / REPORTES_MENSUALES / ${anio} / ${mes}.`);
    } catch(e) { console.error(e); alert('No se pudo guardar el reporte en Drive. La generación local del reporte sigue disponible.'); }
    finally { button.disabled=false; }
  };
})();
