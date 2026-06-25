// Vista "Mis Solicitudes" — réplica del Script: chips de filtro + lista de las solicitudes propias.
import { el, money } from '../lib/dom.js';
import { fetchMisSolicitudes } from '../repositories/mis_solicitudes.repo.js';

const TIPOS = { MULTA:'Quitar multa', DESCUENTO:'Descuento de liquidación' };
const EST_CLS = { APROBADA:'on', RECHAZADA:'off', PENDIENTE:'pe' };

export async function abrirMisSolicitudes(perfil) {
  const ov = el(`<div class="overlay"><div class="ohead"><button class="back">\u2190</button><div class="ot">Mis Solicitudes</div></div><div class="ocontent"><div class="loader">Cargando\u2026</div></div></div>`);
  document.body.appendChild(ov);
  const c = ov.querySelector('.ocontent');
  ov.querySelector('.back').addEventListener('click', () => ov.remove());

  const datos = await fetchMisSolicitudes(perfil);
  let filtro = 'TODAS';

  c.innerHTML = `
    <div class="bk-chips" style="margin-bottom:12px">
      ${['TODAS','PENDIENTE','APROBADA','RECHAZADA'].map((x,i)=>`<button class="bk-chip ${i===0?'on':''}" data-f="${x}">${x==='TODAS'?'Todas':x.charAt(0)+x.slice(1).toLowerCase()+'s'}</button>`).join('')}
    </div>
    <div id="ms-lista"></div>`;

  const render = () => {
    const rows = datos.filter(x => filtro==='TODAS' || x.estatus===filtro);
    const box = c.querySelector('#ms-lista');
    if (!rows.length) { box.innerHTML = `<div class="note" style="text-align:center;padding:18px">No hay solicitudes${filtro!=='TODAS'?' en este filtro.':'.'}</div>`; return; }
    box.innerHTML = rows.map(x => {
      const cls = EST_CLS[x.estatus]||'pe';
      let extra = '';
      if (x.estatus==='APROBADA' && x.tipo==='DESCUENTO')
        extra = `<div class="ms-extra ok">Monto a cobrar: ${money(x.montoAut)}${x.pct?(' · condona '+x.pct+'% interés'):''}</div><div class="ms-extra warn">Vigente solo el día que se aprobó.</div>`;
      else if (x.estatus==='APROBADA' && x.tipo==='MULTA')
        extra = `<div class="ms-extra ok">Multa perdonada · cóbrala el mismo día</div>`;
      return `<div class="ms-card ${cls}">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px">
          <div style="font-weight:600;font-size:.92em">${TIPOS[x.tipo]||x.tipo} · ${x.cliente}</div>
          <span class="ms-badge ${cls}">${x.estatus}</span>
        </div>
        <div class="ms-meta">${x.fecha}${x.motivo?(' · '+x.motivo):''}</div>
        ${extra}
        ${x.resueltoPor?`<div class="ms-meta" style="margin-top:5px">Resuelta por ${x.resueltoPor}</div>`:''}
      </div>`;
    }).join('');
  };

  c.querySelectorAll('.bk-chip').forEach(b => b.addEventListener('click', () => {
    filtro = b.dataset.f; c.querySelectorAll('.bk-chip').forEach(x=>x.classList.toggle('on', x===b)); render();
  }));
  render();
}
