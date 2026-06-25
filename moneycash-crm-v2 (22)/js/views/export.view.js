// Vista Exportar / Respaldo (solo ADMIN / AUX_ADMIN). Descarga CSV de cada tabla.
import { el } from '../lib/dom.js';
import { toCSV } from '../services/export.service.js';
import * as repo from '../repositories/export.repo.js';

const TABLAS = [
  { id:'exportCartera',         nombre:'Cartera',           archivo:'cartera' },
  { id:'exportCalendarios',     nombre:'Calendarios',       archivo:'calendarios' },
  { id:'exportPagosPendientes', nombre:'Pagos pendientes',  archivo:'pagos_pendientes' },
  { id:'exportDesglose',        nombre:'Desglose (cobros)', archivo:'desglose' },
  { id:'exportMovimientos',     nombre:'Movimientos banco', archivo:'movimientos' },
  { id:'exportAuditoria',       nombre:'Auditoría',         archivo:'auditoria' },
];

function descargar(nombreArchivo, csv) {
  const blob = new Blob([csv], { type:'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const fecha = new Date().toISOString().slice(0,10);
  a.href = url; a.download = `${nombreArchivo}_${fecha}.csv`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(()=>URL.revokeObjectURL(url), 1000);
}

export function abrirExport(perfil) {
  if (!['ADMIN','AUX_ADMIN'].includes(perfil.rol)) { alert('Solo administración puede exportar respaldos.'); return; }
  const ov = el(`<div class="overlay">
    <div class="ohead"><button class="back">←</button><div class="ot">Exportar / Respaldo</div></div>
    <div class="ocontent">
      <div class="note" style="margin-bottom:12px">Descarga cada tabla en CSV (se abre en Excel/Sheets). Hazlo seguido como respaldo.</div>
      <div id="ex-list"></div>
      <button class="btn-primary" id="ex-todo" style="margin-top:12px">Descargar TODO</button>
    </div></div>`);
  document.body.appendChild(ov);
  ov.querySelector('.back').addEventListener('click', () => ov.remove());

  const list = ov.querySelector('#ex-list');
  list.innerHTML = TABLAS.map(t => `<button class="btn-card" data-id="${t.id}" data-ar="${t.archivo}" style="margin-bottom:8px">
      <div><div class="bc-t">${t.nombre}</div><div class="bc-s">Descargar ${t.archivo}.csv</div></div>
      <div class="bc-n">⬇</div></button>`).join('');

  async function bajar(id, archivo) {
    try { const rows = await repo[id](); descargar(archivo, toCSV(rows)); }
    catch (e) { alert('No se pudo exportar '+archivo+': '+(e.message||e)); }
  }
  list.querySelectorAll('.btn-card').forEach(b => b.addEventListener('click', () => bajar(b.dataset.id, b.dataset.ar)));
  ov.querySelector('#ex-todo').addEventListener('click', async () => { for (const t of TABLAS) await bajar(t.id, t.archivo); });
}
