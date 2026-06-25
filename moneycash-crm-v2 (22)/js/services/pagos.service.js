// Lógica de Aplicación de Pagos — RÉPLICA de registrarPagoPendiente (Apps Script).
// Crea el pago PENDIENTE (no afecta saldo hasta conciliar). Reparto por %, multa FIFO.
import { norm } from '../lib/dom.js';
import { estaImpuntual } from './clientes.service.js';

const U = s => String(s||'').toUpperCase();

/** Próximo pago pendiente (FIFO), saltando los que ya tienen un pendiente registrado. */
export function proximoPagoPendiente(pagos, saltar) {
  for (const p of pagos) {
    if (U(p.estatus).indexOf('PAGADO') >= 0) continue;
    if (saltar && saltar.has(p.n_pago)) continue;
    return p;
  }
  return null;
}

/** N_PAGO que ya tienen un pago PENDIENTE registrado (sin conciliar) para este cliente. */
export function nPagosConPendiente(pendientesRows, cliente) {
  const set = new Set();
  for (const r of (pendientesRows||[])) {
    if (U(r.estatus) !== 'PENDIENTE') continue;
    if (norm(r.cliente) !== norm(cliente)) continue;
    if (r.n_pago) set.add(Number(r.n_pago));
  }
  return set;
}

// PC: _hayPerdonVigente (condonación de multa autorizada) — pendiente módulo Administración. Stub=false.
function hayPerdonVigente() { return false; }

/**
 * RÉPLICA de infoClientePago: montos sugeridos para la pantalla de pago.
 * Devuelve { sugerido, montoMinimo, liquidar50, liquidarCompleto, capPend, intPend, multaPago, esImpuntual, nPagoCobrar }.
 */
export function infoPago(carteraRow, calRows, pendientesRows, extra) {
  extra = extra || {};
  const hoy = new Date(); hoy.setHours(0,0,0,0);
  const pf = v => v ? new Date(v) : null;
  const fdate = d => d ? new Date(d).toLocaleDateString('es-MX',{day:'2-digit',month:'2-digit',year:'2-digit'}) : '';
  const pagos = (calRows||[]).slice().sort((a,b)=>(a.n_pago||0)-(b.n_pago||0));
  const yaReg = nPagosConPendiente(pendientesRows, carteraRow.nombre);
  const perdonVigente = extra.perdonVigente === true;
  const descuentoAutorizado = (extra.descuentoAutorizado != null) ? extra.descuentoAutorizado : null;
  const prox = proximoPagoPendiente(pagos, yaReg);
  if (prox && (Number(prox.monto_impuntual)||0) < (Number(prox.monto_puntual)||0)) prox.monto_impuntual = prox.monto_puntual;

  // Capital / interés pendientes
  let capPend=0, intPend=0;
  for (const p of pagos) { if (U(p.estatus).indexOf('PAGADO')<0) { capPend += Number(p.capital)||0; intPend += Number(p.interes)||0; } }
  const liquidar50 = Math.round((capPend + intPend*0.5)*100)/100;
  const liquidarCompleto = Math.round(capPend + intPend);
  const pgInt = parseFloat(carteraRow.pg_int)||0;
  const montoMinimo = prox ? Math.round(Number(prox.interes)>0 ? Number(prox.interes) : pgInt) : 0;

  // Contadores (réplica infoClientePago)
  let pagadosATiempo=0, pagadosTarde=0, pendientes=0, vencidos=0, multasAcum=0;
  for (const p of pagos) {
    const pagado = U(p.estatus).indexOf('PAGADO') >= 0;
    const multa = Number(p.multa)||0;
    if (pagado) { if (multa>0) pagadosTarde++; else pagadosATiempo++; multasAcum += multa; }
    else { pendientes++; if (estaImpuntual(pf(p.fecha), hoy)) vencidos++; }
  }

  // Sugerido + desglose acumulado (pagos pendientes con fecha <= hoy)
  let sugeridoAcum=0, multaAcum=0; const desglose=[];
  for (const pg of pagos) {
    if (U(pg.estatus).indexOf('PAGADO')>=0) continue;
    if (yaReg.has(pg.n_pago)) continue;
    const f = pf(pg.fecha); if (!f) continue;
    const fpg = new Date(f); fpg.setHours(0,0,0,0);
    if (fpg.getTime() > hoy.getTime()) continue;
    const impPg = estaImpuntual(f, hoy) && !perdonVigente;
    let fullPg = impPg ? (Number(pg.monto_impuntual)||0) : (Number(pg.monto_puntual)||0);
    if (fullPg < (Number(pg.monto_puntual)||0)) fullPg = Number(pg.monto_puntual)||0;
    const faltaPg = Math.max(0, Math.round(fullPg - (Number(pg.pagado)||0)));
    if (faltaPg <= 0) continue;
    const mPg = impPg ? Math.round((Number(pg.monto_impuntual)||0)-(Number(pg.monto_puntual)||0)) : 0;
    sugeridoAcum += faltaPg; multaAcum += mPg;
    desglose.push({ nPago:pg.n_pago, fecha:fdate(f), tipo: impPg?'impuntual':((Number(pg.pagado)||0)>0?'remanente':'puntual'), monto:faltaPg, multa:mPg });
  }

  let sugerido=0, multaPago=0, esImpuntual=false, nPagoCobrar=0;
  if (prox) {
    const seriaImp = estaImpuntual(pf(prox.fecha), hoy);
    esImpuntual = seriaImp && !perdonVigente;
    const pagoCompleto = esImpuntual ? (Number(prox.monto_impuntual)||0) : (Number(prox.monto_puntual)||0);
    sugerido = Math.max(0, pagoCompleto - Math.round(Number(prox.pagado)||0));
    multaPago = esImpuntual ? ((Number(prox.monto_impuntual)||0)-(Number(prox.monto_puntual)||0)) : 0;
    nPagoCobrar = prox.n_pago;
  }
  if (sugeridoAcum > 0) { sugerido = sugeridoAcum; multaPago = multaAcum; esImpuntual = (multaAcum>0); }

  const saldo = Number(carteraRow.saldo)||0;
  return {
    ok:true, saldo, abono: Number(carteraRow.abono)||0,
    sugerido, montoACobrar: sugerido, montoMinimo, liquidar50, liquidarCompleto,
    capPend:Math.round(capPend), intPend:Math.round(intPend),
    multaPago, esImpuntual, nPagoCobrar, perdonVigente,
    pagadosATiempo, pagadosTarde, pendientes, vencidos, multasAcum:Math.round(multasAcum),
    descuentoAutorizado, desglose, ultimos: extra.ultimos || [],
  };
}

/**
 * RÉPLICA de registrarPagoPendiente. Devuelve { record, msg } para insertar en pagos_pendientes.
 * Lanza Error con el mismo mensaje del Script si algo no cuadra.
 * @param datos { cliente, monto, tipo:'NORMAL'|'MINIMO'|'LIQUIDAR'|'OTRO', formaPago, cuenta, direccionExcedente }
 */
export function registrarPagoPendiente(carteraRow, calRows, pendientesRows, datos, perfil) {
  if (!carteraRow) throw new Error('Cliente no encontrado.');
  const ej = carteraRow.ejecutivo || '';
  if (perfil.rol === 'EJECUTIVO' && norm(ej) !== norm(perfil.ejecutivo)) throw new Error('Ese cliente no está en tu cartera.');
  if (perfil.rol === 'JURIDICO' && norm(ej) !== 'juridico') throw new Error('Ese cliente no está en tu cartera jurídica.');
  if (U(carteraRow.frecuencia) === 'AMERICANO') throw new Error('Este cliente es crédito AMERICANO. Cóbralo en la pantalla "Pago Americano".');

  const hoy = new Date(); hoy.setHours(0,0,0,0);
  const pagos = (calRows||[]).slice().sort((a,b)=>(a.n_pago||0)-(b.n_pago||0));
  const yaReg = nPagosConPendiente(pendientesRows, datos.cliente);
  const prox = proximoPagoPendiente(pagos, yaReg);
  if (prox && (Number(prox.monto_impuntual)||0) < (Number(prox.monto_puntual)||0)) prox.monto_impuntual = prox.monto_puntual;

  let cap=0, intt=0, multa=0, monto=parseFloat(datos.monto)||0, nPago=0, tipo=datos.tipo||'NORMAL';
  const direccionExcedente = datos.direccionExcedente || 'SIGUIENTE';
  const pf = v => v ? new Date(v) : null;

  // Multa FIFO: suma de multas (impuntual−puntual) de los vencidos que el monto cubre completos.
  const multaFIFO = () => {
    let m=0, rem=monto;
    for (const pgM of pagos) {
      if (U(pgM.estatus).indexOf('PAGADO')>=0) continue;
      if (yaReg.has(pgM.n_pago)) continue;
      const perdonM = hayPerdonVigente();
      const impM = estaImpuntual(pf(pgM.fecha), hoy) && !perdonM;
      const costoM = Math.round((impM?(Number(pgM.monto_impuntual)||0):(Number(pgM.monto_puntual)||0)) - (parseFloat(pgM.pagado)||0));
      if (costoM <= 0) continue;
      if (rem >= costoM) { if (impM) m += Math.round((Number(pgM.monto_impuntual)||0)-(Number(pgM.monto_puntual)||0)); rem -= costoM; }
      else break;
    }
    return m;
  };
  const pctCap = () => { let v=parseFloat(carteraRow.pct_cap)||0; if(v>1)v/=100; return v; };
  const pctInt = () => { let v=parseFloat(carteraRow.pct_int)||0; if(v>1)v/=100; return v; };

  if (tipo === 'MINIMO') {
    if (!prox) throw new Error('Este cliente no tiene pagos pendientes.');
    nPago = prox.n_pago;
    intt = Math.round((Number(prox.interes)>0) ? Number(prox.interes) : (parseFloat(carteraRow.pg_int)||0));
    cap=0; multa=0; monto=intt;
    if (monto<=0) throw new Error('No se pudo determinar el interés mínimo de este pago.');
  } else if (tipo === 'LIQUIDAR') {
    cap = monto; intt = 0; multa = 0;
  } else if (tipo === 'OTRO') {
    if (!prox) throw new Error('Este cliente no tiene pagos pendientes.');
    if (monto<=0) throw new Error('Indica el monto a aplicar.');
    const esImp = estaImpuntual(pf(prox.fecha), hoy) && !hayPerdonVigente();
    const pagoCompleto = esImp ? (Number(prox.monto_impuntual)||0) : (Number(prox.monto_puntual)||0);
    const yaPagado = Math.round(Number(prox.pagado)||0);
    nPago = prox.n_pago;
    const completa = (yaPagado + monto) >= pagoCompleto;
    multa = completa ? multaFIFO() : 0;
    const abonoSinMulta = monto - multa;
    const sumaPct = (pctCap()+pctInt())>0 ? (pctCap()+pctInt()) : 1;
    cap = Math.round(abonoSinMulta*(pctCap()/sumaPct));
    intt = abonoSinMulta - cap;
    tipo = completa ? 'NORMAL' : 'PARCIAL';
  } else { // NORMAL / SUGERIDO
    if (!prox) throw new Error('Este cliente no tiene pagos pendientes.');
    nPago = prox.n_pago;
    multa = multaFIFO();
    const baseSinMulta = monto - multa;
    const sumaPct = (pctCap()+pctInt())>0 ? (pctCap()+pctInt()) : 1;
    cap = Math.round(baseSinMulta*(pctCap()/sumaPct));
    intt = baseSinMulta - cap;
    tipo = 'NORMAL';
  }

  const record = {
    cliente: datos.cliente, ejecutivo: ej, cuenta: datos.cuenta||'',
    fecha: new Date().toISOString().slice(0,10),
    monto, n_pago: nPago, capital: cap, interes: intt, multa,
    tipo, forma_pago: U(datos.formaPago||'TRANSFERENCIA'), excedente_a: direccionExcedente,
    estatus: 'PENDIENTE', capturado_por: perfil.email || perfil.nombre || '',
  };
  let etiq;
  if (tipo==='PARCIAL') etiq = ` (PARCIAL: $${cap} cap + $${intt} int — el pago queda pendiente)`;
  else etiq = multa>0 ? ` (IMPUNTUAL, incluye multa $${multa.toFixed(2)})` : ' (puntual)';
  return { record, msg: `✅ Pago de $${Number(monto).toFixed(2)}${etiq} registrado como PENDIENTE. Se aplicará al conciliar.` };
}
