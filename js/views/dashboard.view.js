// Inicio / Dashboard — réplica del acomodo del Script (tarjetas financieras + indicadores +
// alertas por rol + módulos en grupos acordeón con íconos). Estilo CRM nuevo (navy/dorado, SVG de línea).
import { el, money } from '../lib/dom.js';
import { construirResumen } from '../services/dashboard.service.js';
import { fetchCarteraResumen, fetchDesgloseMes, contarPendientesConciliar, contarCasosRevision } from '../repositories/dashboard.repo.js';
import { contarPendientes as contarAutorizaciones } from '../repositories/autorizaciones.repo.js';
import { abrirConciliacion } from './conciliacion.view.js';
import { abrirExport } from './export.view.js';
import { abrirBancos } from './bancos.view.js';
import { abrirMovimientos } from './movimientos.view.js';
import { abrirAcreedores } from './acreedores.view.js';
import { abrirClientes } from './clientes.view.js';
import { abrirCobranza } from './cobranza.view.js';
import { abrirVisitas } from './visitas.view.js';
import { abrirJuridico } from './juridico.view.js';
import { abrirEquipo } from './equipo.view.js';
import { abrirAutorizaciones } from './autorizaciones.view.js';
import { abrirFinanzas } from './finanzas.view.js';
import { abrirCuentas } from './cuentas.view.js';
import { abrirCompensaciones } from './compensaciones.view.js';
import { abrirReactivaciones } from './reactivaciones.view.js';
import { abrirReno } from './reno.view.js';
import { abrirAgenda } from './agenda.view.js';
import { abrirDesglose } from './desglose.view.js';
import { abrirTuberia } from './tuberia.view.js';
import { abrirCotizador } from './cotizador.view.js';
import { abrirAplicarPago } from './pago.view.js';
import { abrirMisSolicitudes } from './mis_solicitudes.view.js';
import { abrirPagoAmericano } from './pago_americano.view.js';
import { abrirMisTuberia } from './mistuberia.view.js';
import { abrirBalance } from './balance.view.js';
import { abrirAvisos } from './avisos.view.js';

// Íconos SVG de línea por módulo (estilo del CRM nuevo, sin emojis)
const I = {
  cartera:'<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.9"/>',
  pago:'<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/>',
  cobranza:'<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3-8.6A2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.4-1.2a2 2 0 0 1 2.1-.5c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2Z"/>',
  conc:'<path d="M22 11.1V12a10 10 0 1 1-5.9-9.1"/><path d="m9 11 3 3L22 4"/>',
  comision:'<path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/>',
  reactiv:'<path d="M3 12a9 9 0 0 1 9-9 9.7 9.7 0 0 1 6.7 2.7L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.7 9.7 0 0 1-6.7-2.7L3 16"/><path d="M3 21v-5h5"/>',
  desglose:'<line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>',
  tuberia:'<path d="M22 3H2l8 9.5V19l4 2v-8.5L22 3z"/>',
  cotizador:'<rect x="4" y="2" width="16" height="20" rx="2"/><path d="M8 6h8M8 10h2M12 10h2M16 10h0M8 14h2M12 14h2M16 14h0M8 18h6"/>',
  juridico:'<path d="M12 3v18"/><path d="M5 7h14"/><path d="m5 7-3 6h6Z"/><path d="m19 7-3 6h6Z"/><path d="M8 21h8"/>',
  visitas:'<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>',
  finanzas:'<line x1="12" y1="2" x2="12" y2="22"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>',
  bancos:'<path d="m3 21 18 0"/><path d="M3 10h18"/><path d="m5 6 7-3 7 3"/><path d="M4 10v11"/><path d="M20 10v11"/><path d="M8 14v3"/><path d="M12 14v3"/><path d="M16 14v3"/>',
  movs:'<path d="M3 7h14"/><path d="m14 4 3 3-3 3"/><path d="M21 17H7"/><path d="m10 14-3 3 3 3"/>',
  acre:'<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.9"/><path d="M16 3.1a4 4 0 0 1 0 7.8"/>',
  cuentas:'<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M9 13h6"/><path d="M9 17h6"/>',
  equipo:'<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.9"/><path d="M16 3.1a4 4 0 0 1 0 7.8"/>',
  compen:'<circle cx="12" cy="8" r="6"/><path d="M15.5 13.6 17 22l-5-3-5 3 1.5-8.4"/>',
  autoriz:'<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/><path d="m9 12 2 2 4-4"/>',
  export:'<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 10l5 5 5-5"/><path d="M12 15V3"/>',
  missol:'<path d="M22 2 11 13"/><path d="M22 2 15 22l-4-9-9-4Z"/>',
  americano:'<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/><path d="M6 15h4"/>',
  reno:'<path d="M3 2v6h6"/><path d="M3 13a9 9 0 1 0 3-7.7L3 8"/>',
  agenda:'<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
  mistuberia:'<path d="M3 4h18l-7 8v6l-4 2v-8L3 4z"/>',
  balance:'<path d="M12 3v18"/><path d="M5 7h14"/><path d="m5 7-3 6a3.5 3.5 0 0 0 6 0L5 7z"/><path d="m19 7-3 6a3.5 3.5 0 0 0 6 0l-3-6z"/>',
  avisos:'<path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/>',
};
const svg = k => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${I[k]||''}</svg>`;

export async function renderDashboard(perfil) {
  const root = el('<div class="view"><div class="loader">Cargando indicadores…</div></div>');
  const [cartera, des] = await Promise.all([fetchCarteraResumen(), fetchDesgloseMes()]);
  const r = construirResumen(cartera, des, perfil.rol, perfil.ejecutivo);

  const rol = perfil.rol;
  const esEjec = rol === 'EJECUTIVO';
  const finanzas = ['ADMIN','GERENTE','AUX_ADMIN'].includes(rol);
  const adminAux = ['ADMIN','AUX_ADMIN'].includes(rol);
  const puedeConciliar = ['ADMIN','GERENTE','AUX_ADMIN'].includes(rol);
  const veSolic = ['ADMIN','GERENTE'].includes(rol);
  const veVisitas = ['ADMIN','GERENTE','AUX_ADMIN','JURIDICO','VISITAS'].includes(rol);
  const veTuberia = ['ADMIN','GERENTE','AUX_ADMIN','EJECUTIVO'].includes(rol);
  const veJuridico = ['ADMIN','GERENTE','JURIDICO'].includes(rol);
  const veFin = !['AUX_ADMIN','JURIDICO','VISITAS'].includes(rol);  // tarjetas financieras

  let pendConc=0, nSol=0, nCasos=0;
  if (puedeConciliar) pendConc = await contarPendientesConciliar();
  if (veSolic) nSol = await contarAutorizaciones();
  if (rol==='GERENTE') nCasos = await contarCasosRevision();

  // ── Tarjetas financieras (4) ──
  const finHtml = veFin ? `
    <div class="dash-fin">
      <div class="ffin" id="f-cartera" style="border-top:3px solid var(--steel);cursor:pointer">
        <div class="ffin-l">Cartera activa <span style="color:var(--slate)" id="f-arrow">\u203a</span></div>
        <div class="ffin-v num">${r.numActivos}</div><div class="ffin-s">préstamos activos · toca para indicadores</div>
      </div>
      <div class="ffin" style="border-top:3px solid var(--ink)">
        <div class="ffin-l">Capital colocado</div>
        <div class="ffin-v num">${money(r.capitalColocado)}</div><div class="ffin-s">capital original vivo</div>
      </div>
      <div class="ffin" id="f-cobrado" style="border-top:3px solid var(--green)${esEjec?';cursor:pointer':''}">
        <div class="ffin-l">Cobrado del mes</div>
        <div class="ffin-v num" style="color:var(--green)">${money(r.cobradoMes)}</div><div class="ffin-s">${esEjec?'toca para ver detalle':'total recibido (cap + int)'}</div>
      </div>
      ${!esEjec ? `<div class="ffin" id="f-balance" style="border-top:3px solid var(--gold);cursor:pointer">
        <div class="ffin-l">Intereses del mes</div>
        <div class="ffin-v num" style="color:var(--gold)">${money(r.intCobradoMes)}</div><div class="ffin-s">ingreso real · toca para balance</div>
      </div>` : `<div class="ffin" style="border-top:3px solid var(--gold)">
        <div class="ffin-l">Interés cobrado (mes)</div>
        <div class="ffin-v num" style="color:var(--gold)">${money(r.intCobradoMes)}</div><div class="ffin-s">tu ingreso generado</div>
      </div>`}
    </div>
    <div id="dash-ind" class="fcard" style="display:none;margin-bottom:14px;border-left:3px solid var(--steel)">
      <div class="ind-h">Indicadores globales</div>
      <div class="ind-1"><div class="ind-lab">Saldo en capitales activos</div><div class="num" style="font-size:1.2em;font-weight:700;color:var(--navy)">${money(r.capitalColocado)}</div><div class="ind-s">capital original de cada cliente activo</div></div>
      <div class="ind-2">
        <div class="liqrow"><span>Capital pendiente</span><b class="num">${money(r.capitalPend)}</b></div>
        <div class="liqrow"><span>Interés pendiente</span><b class="num" style="color:var(--gold)">${money(r.interesPend)}</b></div>
        <div class="liqrow" style="border-top:1px solid var(--line);padding-top:6px"><span style="font-weight:600">Deuda total</span><b class="num" style="color:var(--navy)">${money(r.deudaTotal)}</b></div>
      </div>
    </div>` : '';

  // ── Alertas por rol ──
  const alerta = (id, cls, lab, n, sub) => `<div class="dash-alert ${cls}" id="${id}"><div><div class="al-lab">${lab}</div><div class="al-sub">${sub}</div></div><div class="al-n">${n}</div></div>`;
  let alertasHtml = '';
  if (rol==='GERENTE' && nCasos>0) alertasHtml += alerta('a-casos','amber','Requerimientos de ayuda', nCasos, 'Casos en revisión · toca para verlos en Cobranza');
  if (veSolic && nSol>0) alertasHtml += alerta('a-sol','red','Autorizaciones pendientes', nSol, 'Multas, descuentos y movimientos · toca para revisar');
  if (puedeConciliar && pendConc>0) alertasHtml += alerta('a-conc','steel','Pendientes de conciliar', pendConc, 'Pagos esperando validación · toca para conciliar');

  // ── Módulos en grupos acordeón ──
  const grupos = [
    { id:'g1', t:'Cobranza', items:[
      { k:'cartera', t:'Cartera', show:true },
      { k:'pago', t:'Aplicar pago', show:['ADMIN','GERENTE','EJECUTIVO'].includes(rol) },
      { k:'americano', t:'Pago americano', show:['ADMIN','GERENTE','EJECUTIVO'].includes(rol) },
      { k:'cobranza', t:'Cobranza', show:true },
      { k:'conc', t:'Conciliación', show:puedeConciliar, badge:pendConc },
      { k:'reactiv', t:'Reactivaciones', show:true },
      { k:'comision', t:'Mi comisión', show:esEjec },
    ]},
    { id:'g2', t:'Finanzas', items:[
      { k:'bancos', t:'Bancos', show:finanzas },
      { k:'movs', t:'Movimientos', show:adminAux },
      { k:'desglose', t:'Desglose', show:true },
      { k:'acre', t:'Acreedores', show:finanzas },
      { k:'cuentas', t:'Cuentas', show:finanzas },
      { k:'balance', t:'Balance del mes', show:['ADMIN','GERENTE','AUX_ADMIN'].includes(rol) },
      { k:'finanzas', t:'Estado resultados', show:['ADMIN','GERENTE'].includes(rol) },
    ]},
    { id:'g3', t:'Gestión', items:[
      { k:'cotizador', t:'Cotizador', show:true },
      { k:'tuberia', t:'Tubería', show:veTuberia },
      { k:'mistuberia', t:'Mi Tubería', show:['ADMIN','GERENTE','EJECUTIVO'].includes(rol) },
      { k:'juridico', t:'Jurídico', show:veJuridico },
      { k:'visitas', t:'Visitas', show:veVisitas },
      { k:'missol', t:'Mis solicitudes', show:['EJECUTIVO','GERENTE'].includes(rol) },
      { k:'reno', t:'Renovaciones', show:['ADMIN','GERENTE'].includes(rol) },
      { k:'agenda', t:'Agenda', show:true },
      { k:'autoriz', t:'Autorizaciones', show:veSolic, badge:nSol },
    ]},
    { id:'g4', t:'Admin', items:[
      { k:'equipo', t:'Equipo', show:rol==='ADMIN' },
      { k:'avisos', t:'Avisos', show:rol==='ADMIN' },
      { k:'compen', t:'Compensaciones', show:['ADMIN','GERENTE'].includes(rol) },
      { k:'export', t:'Exportar', show:adminAux },
    ]},
  ];
  let gruposHtml = '';
  grupos.forEach((g,gi) => {
    const vis = g.items.filter(it=>it.show);
    if (!vis.length) return;
    const cards = vis.map(it => `<div class="modcard" id="m-${it.k}">
      ${(it.badge>0)?`<span class="mod-dot"></span>`:''}
      <div class="mod-ic">${svg(it.k)}</div><div class="mod-t">${it.t}</div></div>`).join('');
    gruposHtml += `<div class="grp">
      <div class="grp-h" data-g="${g.id}"><div class="grp-hl">${g.t}<span class="grp-n">${vis.length}</span></div><span class="grp-arr" id="arr-${g.id}">\u25b8</span></div>
      <div class="grp-body" id="${g.id}" style="display:${gi===0?'grid':'none'}">${cards}</div>
    </div>`;
  });

  root.innerHTML = finHtml + alertasHtml + `<div class="dash-modtit">Módulos</div>` + gruposHtml;

  // Indicadores desplegables
  const fc = root.querySelector('#f-cartera');
  if (fc) fc.addEventListener('click', () => {
    const p = root.querySelector('#dash-ind'), a = root.querySelector('#f-arrow');
    const open = p.style.display!=='none'; p.style.display = open?'none':'block'; if(a) a.textContent = open?'\u203a':'\u2304';
  });
  const fb = root.querySelector('#f-balance'); if (fb) fb.addEventListener('click', () => abrirFinanzas(perfil));
  const fco = root.querySelector('#f-cobrado'); if (fco && esEjec) fco.addEventListener('click', () => abrirDesglose(perfil));

  // Alertas
  const ac = root.querySelector('#a-casos'); if (ac) ac.addEventListener('click', () => abrirCobranza(perfil));
  const as = root.querySelector('#a-sol'); if (as) as.addEventListener('click', () => abrirAutorizaciones(perfil, () => reload(perfil)));
  const acc = root.querySelector('#a-conc'); if (acc) acc.addEventListener('click', () => abrirConciliacion(perfil, () => reload(perfil)));

  // Acordeón de grupos
  root.querySelectorAll('.grp-h').forEach(h => h.addEventListener('click', () => {
    const id=h.dataset.g, b=root.querySelector('#'+id), a=root.querySelector('#arr-'+id);
    const open=b.style.display!=='none'; b.style.display=open?'none':'grid'; a.textContent=open?'\u25b8':'\u25be';
  }));

  // Módulos
  const on = (k, fn) => { const b=root.querySelector('#m-'+k); if (b) b.addEventListener('click', fn); };
  on('cartera', ()=>abrirClientes(perfil));
  on('pago', ()=>abrirAplicarPago('', perfil, ()=>reload(perfil)));
  on('americano', ()=>abrirPagoAmericano('', perfil, ()=>reload(perfil)));
  on('missol', ()=>abrirMisSolicitudes(perfil));
  on('cobranza', ()=>abrirCobranza(perfil));
  on('conc', ()=>abrirConciliacion(perfil, ()=>reload(perfil)));
  on('reactiv', ()=>abrirReactivaciones(perfil));
  on('reno', ()=>abrirReno(perfil, ()=>reload(perfil)));
  on('agenda', ()=>abrirAgenda(perfil));
  on('comision', ()=>abrirCompensaciones(perfil));
  on('bancos', ()=>abrirBancos(perfil));
  on('movs', ()=>abrirMovimientos(perfil));
  on('desglose', ()=>abrirDesglose(perfil));
  on('acre', ()=>abrirAcreedores(perfil));
  on('cuentas', ()=>abrirCuentas(perfil));
  on('finanzas', ()=>abrirFinanzas(perfil));
  on('tuberia', ()=>abrirTuberia(perfil));
  on('cotizador', ()=>abrirCotizador(perfil));
  on('mistuberia', ()=>abrirMisTuberia(perfil));
  on('balance', ()=>abrirBalance(perfil));
  on('avisos', ()=>abrirAvisos(perfil));
  on('juridico', ()=>abrirJuridico(perfil));
  on('visitas', ()=>abrirVisitas(perfil));
  on('autoriz', ()=>abrirAutorizaciones(perfil, ()=>reload(perfil)));
  on('equipo', ()=>abrirEquipo(perfil));
  on('compen', ()=>abrirCompensaciones(perfil));
  on('export', ()=>abrirExport(perfil));

  return root;
}

function reload(perfil) {
  renderDashboard(perfil).then(n => { const v=document.querySelector('.content'); if(v){ v.innerHTML=''; v.appendChild(n); } });
}
