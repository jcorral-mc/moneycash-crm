// Lógica de Jurídico — RÉPLICA del módulo jurídico del Script.
// Abono jurídico: 40% interés / 60% capital (JUR_INTERES=0.40, JUR_CAPITAL=0.60).
import { norm } from '../lib/dom.js';

export const JUR_ESTADOS = ['SIN PRESENTAR','DEMANDA PRESENTADA','CONVENIO','ESPERANDO FECHA','JUICIO','NO LOCALIZADO','BUSQUEDA','DILIGENCIA PROXIMA'];
export const JUR_INTERES = 0.40, JUR_CAPITAL = 0.60;

/** RÉPLICA de obtenerCarteraJuridico: lista de casos + dashboard (conteos por estatus, deuda en demanda). */
export function construirCartera(casos) {
  const hoy = new Date(); hoy.setHours(0,0,0,0);
  const lista = (casos||[]).map(r => {
    let diasDil = null;
    if (r.prox_diligencia) { const f = new Date(r.prox_diligencia); f.setHours(0,0,0,0); diasDil = Math.round((f-hoy)/86400000); }
    return {
      id:r.id, cliente:String(r.cliente||''), ejecutivo:String(r.ejecutivo||''),
      capitalOrig:Number(r.capital_orig)||0, saldoMC:Number(r.saldo_mc)||0,
      capPagado:Number(r.cap_pagado)||0, intPagado:Number(r.int_pagado)||0, nAbonos:Number(r.n_abonos)||0,
      saldoDemanda:Number(r.saldo_demanda)||0, estatus:String(r.estatus||'SIN PRESENTAR'),
      proxDiligencia:r.prox_diligencia ? String(r.prox_diligencia).slice(0,10) : '', diasDiligencia:diasDil,
    };
  });
  const porEstatus = {}; JUR_ESTADOS.forEach(e => porEstatus[e]=0);
  let deudaDemanda = 0;
  for (const c of lista) { if (porEstatus[c.estatus]!==undefined) porEstatus[c.estatus]++; deudaDemanda += c.saldoDemanda; }
  const proximasDiligencias = lista.filter(c => c.diasDiligencia!==null).sort((a,b)=>a.diasDiligencia-b.diasDiligencia);
  return { casos:lista, porEstatus, deudaDemanda:Math.round(deudaDemanda), total:lista.length, proximasDiligencias, estados:JUR_ESTADOS };
}

/** Detalle de un caso + su bitácora, convenio vigente y pagos del convenio. */
export function construirCaso(caso, bitacora, convenios, pagosConvenio) {
  const bit = (bitacora||[]).map(b=>({ fecha:String(b.created_at||'').slice(0,16).replace('T',' '), autor:b.autor||'', estatus:b.estatus||'', nota:b.nota||'' }))
    .sort((a,b)=> b.fecha<a.fecha?-1:b.fecha>a.fecha?1:0);
  const convVigente = (convenios||[]).find(c => String(c.estatus)==='VIGENTE') || null;
  const pagos = (pagosConvenio||[]).map(p=>({ nPago:Number(p.n_pago)||0, fecha:String(p.fecha||'').slice(0,10), monto:Number(p.monto)||0, pagado:Number(p.pagado)||0, estatus:String(p.estatus||'PENDIENTE') }))
    .sort((a,b)=>a.nPago-b.nPago);
  const pagosConvPagados = pagos.filter(p=>p.estatus==='PAGADO').reduce((s,p)=>s+p.monto,0);
  return {
    capitalOrig:Number(caso.capital_orig)||0, saldoMC:Number(caso.saldo_mc)||0,
    capPagado:Number(caso.cap_pagado)||0, intPagado:Number(caso.int_pagado)||0, nAbonos:Number(caso.n_abonos)||0,
    saldoDemanda:Number(caso.saldo_demanda)||0, estatus:String(caso.estatus||''),
    proxDiligencia:caso.prox_diligencia ? String(caso.prox_diligencia).slice(0,10) : '',
    bitacora:bit, convenio:convVigente, pagosConvenio:pagos, pagadoConvenio:Math.round(pagosConvPagados),
  };
}

/** RÉPLICA del reparto del abono jurídico (40/60, o liquidación). */
export function planAbono(caso, monto, liquidar) {
  monto = Math.round((parseFloat(monto)||0));
  if (monto<=0) throw new Error('Monto inválido.');
  const saldo = Number(caso.saldo_demanda)||0;
  if (saldo<=0) throw new Error('El caso ya está en ceros.');
  const esLiquidar = liquidar===true || monto>=saldo;
  let cap, int, nuevoSaldo;
  if (esLiquidar) {
    const capPend = Math.max(0, (Number(caso.capital_orig)||0) - (Number(caso.cap_pagado)||0));
    cap = Math.min(Math.round(capPend), monto);
    int = Math.max(0, monto - cap);
    nuevoSaldo = 0;
  } else {
    int = Math.round(monto*JUR_INTERES);
    cap = Math.round(monto*JUR_CAPITAL);
    nuevoSaldo = Math.max(0, saldo - monto);
  }
  return { monto, cap, int, nuevoSaldo, esLiquidar };
}

/** RÉPLICA de crearConvenio: mini calendario mensual. */
export function planConvenio(monto, numPagos, fechaInicio) {
  monto = parseFloat(monto)||0; numPagos = parseInt(numPagos)||0;
  if (monto<=0) throw new Error('Monto inválido.');
  if (numPagos<1) throw new Error('Número de pagos inválido.');
  const montoPago = Math.round((monto/numPagos)*100)/100;
  const inicio = fechaInicio ? new Date(fechaInicio) : new Date();
  const pagos = [];
  for (let n=1;n<=numPagos;n++) {
    const f = new Date(inicio); f.setMonth(f.getMonth()+(n-1));
    pagos.push({ nPago:n, fecha:f.toISOString().slice(0,10), monto:montoPago });
  }
  return { montoPago, pagos };
}
