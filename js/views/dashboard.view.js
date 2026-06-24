// Vista Dashboard completo — RÉPLICA de obtenerResumenDashboard + resumenDashboardExtra.
import { el, money } from '../lib/dom.js';
import { construirResumen } from '../services/dashboard.service.js';
import { fetchCarteraResumen, fetchDesgloseMes, contarPendientesConciliar, contarSolicitudes } from '../repositories/dashboard.repo.js';
import { abrirConciliacion } from './conciliacion.view.js';

export async function renderDashboard(perfil) {
  const root = el('<div class="view"><div class="loader">Cargando indicadores…</div></div>');
  const [cartera, des] = await Promise.all([fetchCarteraResumen(), fetchDesgloseMes()]);
  const r = construirResumen(cartera, des, perfil.rol, perfil.ejecutivo);

  const esAdmin = perfil.rol === 'ADMIN';
  const puedeConciliar = ['ADMIN','GERENTE','AUX_ADMIN'].includes(perfil.rol);
  const veSolicitudes = ['ADMIN','GERENTE'].includes(perfil.rol);
  let pendConc = 0, nSol = 0;
  if (puedeConciliar) pendConc = await contarPendientesConciliar();
  if (veSolicitudes) nSol = await contarSolicitudes();

  const maxEj = Math.max(1, ...r.porEjecutivo.map(e=>e.monto));

  root.innerHTML = `
    <div class="kpis">
      <div class="kcard"><div class="klab">Capital vivo</div><div class="kval num">${money(r.totalCartera)}</div><div class="kfoot">${r.numActivos} créditos activos</div></div>
      <div class="kcard k-cob"><div class="klab">Cobrado hoy</div><div class="kval num green">${money(r.cobradoHoy)}</div><div class="kfoot">interés hoy ${money(r.intHoy)}</div></div>
    </div>
    <div class="kpis">
      <div class="kcard"><div class="klab">Cobrado del mes</div><div class="kval num">${money(r.cobradoMes)}</div><div class="kfoot">este mes</div></div>
      <div class="kcard"><div class="klab">Deuda total</div><div class="kval num">${money(r.deudaTotal)}</div><div class="kfoot">cap ${money(r.capitalPend)} · int ${money(r.interesPend)}</div></div>
    </div>

    ${puedeConciliar ? `<button class="btn-card" id="d-conc">
        <div><div class="bc-t">Conciliación</div><div class="bc-s">Pagos por revisar y aplicar</div></div>
        <div class="bc-n ${pendConc>0?'on':''}">${pendConc}</div></button>` : ''}
    ${veSolicitudes ? `<div class="btn-card" style="cursor:default">
        <div><div class="bc-t">Autorizaciones</div><div class="bc-s">Solicitudes pendientes (multa/liquidación)</div></div>
        <div class="bc-n ${nSol>0?'on':''}">${nSol}</div></div>` : ''}

    ${(perfil.rol!=='EJECUTIVO' && r.porEjecutivo.length) ? `
      <div class="sec-h"><span class="t">Cartera por ejecutivo</span><span class="ln"></span></div>
      <div class="fcard">
        ${r.porEjecutivo.map(e=>`
          <div class="ejbar">
            <div class="ejbar-h"><span>${e.ejecutivo}</span><b class="num">${money(e.monto)}</b></div>
            <div class="ejbar-t"><div class="ejbar-f" style="width:${Math.round(e.monto/maxEj*100)}%"></div></div>
          </div>`).join('')}
      </div>` : ''}`;

  const bConc = root.querySelector('#d-conc');
  if (bConc) bConc.addEventListener('click', () => abrirConciliacion(perfil, () => reload(perfil)));
  return root;
}

function reload(perfil) {
  renderDashboard(perfil).then(n => { const v=document.querySelector('.content'); if(v){ v.innerHTML=''; v.appendChild(n); } });
}
