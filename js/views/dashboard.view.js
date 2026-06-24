// Inicio — pantalla única con módulos agrupados por tipo (filosofía dashboard del Script).
import { el, money } from '../lib/dom.js';
import { construirResumen } from '../services/dashboard.service.js';
import { fetchCarteraResumen, fetchDesgloseMes, contarPendientesConciliar, contarSolicitudes } from '../repositories/dashboard.repo.js';
import { abrirConciliacion } from './conciliacion.view.js';
import { abrirExport } from './export.view.js';
import { abrirBancos } from './bancos.view.js';
import { abrirMovimientos } from './movimientos.view.js';
import { abrirAcreedores } from './acreedores.view.js';
import { abrirClientes } from './clientes.view.js';
import { abrirCobranza } from './cobranza.view.js';

export async function renderDashboard(perfil) {
  const root = el('<div class="view"><div class="loader">Cargando indicadores…</div></div>');
  const [cartera, des] = await Promise.all([fetchCarteraResumen(), fetchDesgloseMes()]);
  const r = construirResumen(cartera, des, perfil.rol, perfil.ejecutivo);

  const rol = perfil.rol;
  const esEjecutivo = rol === 'EJECUTIVO';
  const finanzas = ['ADMIN','GERENTE','AUX_ADMIN'].includes(rol);
  const adminAux = ['ADMIN','AUX_ADMIN'].includes(rol);
  const puedeConciliar = ['ADMIN','GERENTE','AUX_ADMIN'].includes(rol);
  const veSolicitudes = ['ADMIN','GERENTE'].includes(rol);

  let pendConc = 0, nSol = 0;
  if (puedeConciliar) pendConc = await contarPendientesConciliar();
  if (veSolicitudes) nSol = await contarSolicitudes();

  // KPIs (para ejecutivo, construirResumen ya filtra a su cartera)
  const kpisHtml = `
    <div class="kpis">
      <div class="kcard"><div class="klab">Capital colocado</div><div class="kval num">${money(r.capitalColocado)}</div><div class="kfoot">${r.numActivos} créditos · préstamo original</div></div>
      <div class="kcard"><div class="klab">Por cobrar</div><div class="kval num">${money(r.deudaTotal)}</div><div class="kfoot">cap ${money(r.capitalPend)} · int ${money(r.interesPend)}</div></div>
    </div>
    <div class="kpis">
      <div class="kcard k-cob"><div class="klab">Cobrado hoy</div><div class="kval num green">${money(r.cobradoHoy)}</div><div class="kfoot">interés hoy ${money(r.intHoy)}</div></div>
      <div class="kcard"><div class="klab">Intereses cobrados (mes)</div><div class="kval num gold">${money(r.intCobradoMes)}</div><div class="kfoot">ingreso real del mes</div></div>
    </div>
    ${!esEjecutivo ? `<div class="kpis">
      <div class="kcard"><div class="klab">Cobrado del mes</div><div class="kval num">${money(r.cobradoMes)}</div><div class="kfoot">total recibido (cap + int)</div></div>
      <div class="kcard"><div class="klab">Capital recuperado (mes)</div><div class="kval num">${money(Math.max(0, r.cobradoMes - r.intCobradoMes))}</div><div class="kfoot">devuelto a inversionistas</div></div>
    </div>` : ''}`;

  // Definición de grupos y botones (con visibilidad por rol)
  const grupos = [
    { titulo:'Cobranza', items:[
      { k:'cartera',  t:'Cartera',       s:'Clientes y fichas',            show:true },
      { k:'cobranza', t:'Cobranza',      s:'Prioridad y mora',             show:true },
      { k:'conc',     t:'Conciliación',  s:'Pagos por revisar y aplicar',  show:puedeConciliar, badge:pendConc },
    ]},
    { titulo:'Finanzas', items:[
      { k:'bancos', t:'Bancos',      s:'Saldos, movimientos, transferencias', show:finanzas },
      { k:'movs',   t:'Movimientos', s:'Gastos, nómina, intereses, diligencias', show:adminAux },
      { k:'acre',   t:'Acreedores',  s:'Inversionistas y lo que se les debe', show:finanzas },
    ]},
    { titulo:'Administración', items:[
      { k:'autoriz', t:'Autorizaciones', s:'Solicitudes pendientes (multa/liquidación)', show:veSolicitudes, badge:nSol, estatico:true },
      { k:'export',  t:'Exportar / Respaldo', s:'Descargar tablas en CSV', show:adminAux },
    ]},
  ];

  const btnHtml = (it) => {
    const badge = (it.badge!==undefined) ? `<div class="bc-n ${it.badge>0?'on':''}">${it.badge}</div>` : `<div class="bc-n">›</div>`;
    const tag = it.estatico ? 'div' : 'button';
    return `<${tag} class="btn-card"${it.estatico?' style="cursor:default"':` id="g-${it.k}"`}>
        <div><div class="bc-t">${it.t}</div><div class="bc-s">${it.s}</div></div>${badge}</${tag}>`;
  };

  let gruposHtml = '';
  for (const g of grupos) {
    const visibles = g.items.filter(it => it.show);
    if (!visibles.length) continue;
    gruposHtml += `<div class="sec-h"><span class="t">${g.titulo}</span><span class="ln"></span></div>` + visibles.map(btnHtml).join('');
  }

  root.innerHTML = kpisHtml + gruposHtml;

  // Handlers
  const on = (k, fn) => { const b = root.querySelector('#g-'+k); if (b) b.addEventListener('click', fn); };
  on('cartera',  () => abrirClientes(perfil));
  on('cobranza', () => abrirCobranza(perfil));
  on('conc',     () => abrirConciliacion(perfil, () => reload(perfil)));
  on('bancos',   () => abrirBancos(perfil));
  on('movs',     () => abrirMovimientos(perfil));
  on('acre',     () => abrirAcreedores(perfil));
  on('export',   () => abrirExport(perfil));

  return root;
}

function reload(perfil) {
  renderDashboard(perfil).then(n => { const v=document.querySelector('.content'); if(v){ v.innerHTML=''; v.appendChild(n); } });
}
