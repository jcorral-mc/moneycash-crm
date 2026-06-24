// Vista Dashboard completo — RÉPLICA de obtenerResumenDashboard + resumenDashboardExtra.
import { el, money } from '../lib/dom.js';
import { construirResumen } from '../services/dashboard.service.js';
import { fetchCarteraResumen, fetchDesgloseMes, contarPendientesConciliar, contarSolicitudes } from '../repositories/dashboard.repo.js';
import { abrirConciliacion } from './conciliacion.view.js';
import { abrirExport } from './export.view.js';
import { abrirBancos } from './bancos.view.js';
import { abrirMovimientos } from './movimientos.view.js';
import { abrirAcreedores } from './acreedores.view.js';

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
      <div class="kcard"><div class="klab">Capital colocado</div><div class="kval num">${money(r.capitalColocado)}</div><div class="kfoot">${r.numActivos} créditos · préstamo original</div></div>
      <div class="kcard"><div class="klab">Por cobrar</div><div class="kval num">${money(r.deudaTotal)}</div><div class="kfoot">cap ${money(r.capitalPend)} · int ${money(r.interesPend)}</div></div>
    </div>
    <div class="kpis">
      <div class="kcard k-cob"><div class="klab">Cobrado hoy</div><div class="kval num green">${money(r.cobradoHoy)}</div><div class="kfoot">interés hoy ${money(r.intHoy)}</div></div>
      <div class="kcard"><div class="klab">Intereses cobrados (mes)</div><div class="kval num gold">${money(r.intCobradoMes)}</div><div class="kfoot">ingreso real del mes</div></div>
    </div>
    <div class="kpis">
      <div class="kcard"><div class="klab">Cobrado del mes</div><div class="kval num">${money(r.cobradoMes)}</div><div class="kfoot">total recibido (cap + int)</div></div>
      <div class="kcard"><div class="klab">Capital recuperado (mes)</div><div class="kval num">${money(Math.max(0, r.cobradoMes - r.intCobradoMes))}</div><div class="kfoot">devuelto a inversionistas</div></div>
    </div>

    ${puedeConciliar ? `<button class="btn-card" id="d-conc">
        <div><div class="bc-t">Conciliación</div><div class="bc-s">Pagos por revisar y aplicar</div></div>
        <div class="bc-n ${pendConc>0?'on':''}">${pendConc}</div></button>` : ''}
    ${veSolicitudes ? `<div class="btn-card" style="cursor:default">
        <div><div class="bc-t">Autorizaciones</div><div class="bc-s">Solicitudes pendientes (multa/liquidación)</div></div>
        <div class="bc-n ${nSol>0?'on':''}">${nSol}</div></div>` : ''}
    ${['ADMIN','GERENTE','AUX_ADMIN'].includes(perfil.rol) ? `<button class="btn-card" id="d-bancos">
        <div><div class="bc-t">Bancos</div><div class="bc-s">Saldos, movimientos, transferencias</div></div>
        <div class="bc-n">$</div></button>` : ''}
    ${['ADMIN','AUX_ADMIN'].includes(perfil.rol) ? `<button class="btn-card" id="d-movs">
        <div><div class="bc-t">Movimientos</div><div class="bc-s">Gastos, nómina, intereses, diligencias</div></div>
        <div class="bc-n">↹</div></button>` : ''}
    ${['ADMIN','GERENTE','AUX_ADMIN'].includes(perfil.rol) ? `<button class="btn-card" id="d-acre">
        <div><div class="bc-t">Acreedores</div><div class="bc-s">Inversionistas y lo que se les debe</div></div>
        <div class="bc-n">◷</div></button>` : ''}
    ${['ADMIN','AUX_ADMIN'].includes(perfil.rol) ? `<button class="btn-card" id="d-export">
        <div><div class="bc-t">Exportar / Respaldo</div><div class="bc-s">Descargar tablas en CSV</div></div>
        <div class="bc-n">⬇</div></button>` : ''}

    ${(perfil.rol!=='EJECUTIVO' && r.porEjecutivo.length) ? `
      <div class="sec-h"><span class="t">Cartera por ejecutivo</span><span class="ln"></span></div>
      <div class="fcard">
        ${r.porEjecutivo.map(e=>`
          <div class="ejbar">
            <div class="ejbar-h"><span>${e.ejecutivo}</span><b class="num">${money(e.monto)}</b></div>
            <div class="ejbar-t"><div class="ejbar-f" style="width:${Math.round(e.monto/maxEj*100)}%"></div></div>
          </div>`).join('')}
      </div>` : ''}`;

  const bAcr = root.querySelector('#d-acre');
  if (bAcr) bAcr.addEventListener('click', () => abrirAcreedores(perfil));
  const bMov = root.querySelector('#d-movs');
  if (bMov) bMov.addEventListener('click', () => abrirMovimientos(perfil));
  const bBan = root.querySelector('#d-bancos');
  if (bBan) bBan.addEventListener('click', () => abrirBancos(perfil));
  const bExp = root.querySelector('#d-export');
  if (bExp) bExp.addEventListener('click', () => abrirExport(perfil));
  const bConc = root.querySelector('#d-conc');
  if (bConc) bConc.addEventListener('click', () => abrirConciliacion(perfil, () => reload(perfil)));
  return root;
}

function reload(perfil) {
  renderDashboard(perfil).then(n => { const v=document.querySelector('.content'); if(v){ v.innerHTML=''; v.appendChild(n); } });
}
