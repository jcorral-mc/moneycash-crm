// Lógica de negocio de Clientes — RÉPLICA EXACTA de obtenerCartera y fichaCliente (Apps Script).
import { GRACIA_DIAS } from '../config.js';
import { norm } from '../lib/dom.js';

/** _estaImpuntual: impuntual a partir del 4º día tras el vencimiento (gracia = 3). */
export function estaImpuntual(fechaPago, hoy) {
  if (!fechaPago) return false;
  const limite = new Date(fechaPago); limite.setHours(0,0,0,0);
  limite.setDate(limite.getDate() + GRACIA_DIAS);
  const h = new Date(hoy); h.setHours(0,0,0,0);
  return h > limite;
}

const fdate = (d) => d ? new Date(d).toLocaleDateString('es-MX',{day:'2-digit',month:'2-digit',year:'numeric'}) : '—';
const pf = (v) => { if(!v) return null; const d=new Date(v); return isNaN(d)?null:d; };

/** Agrupa calendarios por cliente (norm). */
export function agruparCalendario(calRows) {
  const by = {};
  for (const r of calRows) {
    const k = norm(r.cliente); if (!k) continue;
    (by[k] = by[k] || []).push(r);
  }
  return by;
}

/** RÉPLICA de obtenerCartera: vencido, estado, proxPago, vencimiento por cliente. */
export function construirCartera(carteraRows, calByCliente, rol, ejecutivo) {
  const filtraPorEjec = (rol === 'EJECUTIVO') || (rol === 'JURIDICO');
  const miEjec = (rol === 'JURIDICO') ? 'JURIDICO' : ejecutivo;
  const hoy = new Date(); hoy.setHours(0,0,0,0);
  const out = [];
  for (const row of carteraRows) {
    const nombre = String(row.nombre||'').trim();
    const saldo = parseFloat(row.saldo)||0;
    if (!nombre || saldo <= 0) continue;
    if (filtraPorEjec && norm(row.ejecutivo) !== norm(miEjec)) continue;

    let vencido=0, prox=null, ultima=null;
    const cal = (calByCliente[norm(nombre)]||[]).slice().sort((a,b)=>(a.n_pago||0)-(b.n_pago||0));
    for (const pg of cal) {
      const fecha = pf(pg.fecha); if (!fecha) { continue; }
      if (String(pg.estatus||'').toUpperCase().indexOf('PAGADO') < 0) {
        if (estaImpuntual(fecha, hoy)) vencido += (parseFloat(pg.monto_puntual)||0);
        if (!prox && fecha >= hoy) prox = fecha;
      }
      ultima = fecha;
    }
    if (!prox) {
      for (const pg of cal) { if (String(pg.estatus||'').toUpperCase().indexOf('PAGADO')<0) { prox = pf(pg.fecha); break; } }
    }
    const surt = pf(row.surtimiento);
    out.push({
      nombre, ejecutivo: row.ejecutivo||'', frecuencia: row.frecuencia||'',
      capital: parseFloat(row.capital)||0, abono: parseFloat(row.abono)||0,
      saldo, vencido,
      proxPago: prox?fdate(prox):'—',
      surtimiento: surt?fdate(surt):'—',
      vencimiento: ultima?fdate(ultima):'—',
      estado: vencido>0 ? 'VENCIDO' : 'AL DIA',
    });
  }
  out.sort((a,b)=> (b.vencido-a.vencido) || a.nombre.localeCompare(b.nombre));
  return out;
}

/** RÉPLICA de fichaCliente: capital pagado, descuento (escala 0/25/50), contadores, calendario con estados. */
export function construirFicha(carteraRow, calRows) {
  const row = carteraRow || {};
  const hoy = new Date(); hoy.setHours(0,0,0,0);
  const capitalOriginal = parseFloat(row.capital)||0;
  const saldo = parseFloat(row.saldo)||0;
  const abono = parseFloat(row.abono)||0;

  let capitalPend = parseFloat(row.saldo_capital);
  let intPend = parseFloat(row.saldo_interes);
  if (isNaN(capitalPend) || isNaN(intPend)) { capitalPend = saldo; intPend = 0; } // fallback (PC: recalcular como Script)
  const capitalPagado = Math.max(0, capitalOriginal - capitalPend);

  const pagos = (calRows||[]).slice().sort((a,b)=>(a.n_pago||0)-(b.n_pago||0));
  let pagadosATiempo=0, pagadosTarde=0, pendientes=0, vencidos=0, multasAcum=0;
  const calendario = pagos.map(p => {
    const fecha = pf(p.fecha);
    const est = String(p.estatus||'').toUpperCase();
    const pagComp = parseFloat(p.monto_puntual)||0;
    const abonado = Math.round(parseFloat(p.pagado)||0);
    const falta = Math.max(0, pagComp - abonado);
    const multa = 0;                                  // el Script lee multa=0 en el calendario
    const tieneMinimo = est.indexOf('MÍNIMO')>=0 || est.indexOf('MINIMO')>=0;
    const estaPendiente = est.indexOf('PENDIENTE')>=0;
    let estadoVista='PENDIENTE';
    if (est==='PAGADO' || (tieneMinimo && !estaPendiente)) {
      if (tieneMinimo) { estadoVista='PAGO_MINIMO'; pagadosATiempo++; }
      else { estadoVista = multa>0 ? 'PAGADO_TARDE' : 'PAGADO'; if (multa>0) pagadosTarde++; else pagadosATiempo++; }
      multasAcum += multa;
    } else if (tieneMinimo && estaPendiente) {
      estadoVista='EXT_MINIMO'; pendientes++; if (estaImpuntual(fecha,hoy)) vencidos++;
    } else if (abonado>0 && falta>0) {
      estadoVista='PARCIAL'; pendientes++; if (estaImpuntual(fecha,hoy)) vencidos++;
    } else {
      pendientes++; if (estaImpuntual(fecha,hoy)) { estadoVista='VENCIDO'; vencidos++; }
    }
    return { nPago:p.n_pago, fecha:fecha?fdate(fecha):'—', montoPuntual:pagComp,
             montoImpuntual:parseFloat(p.monto_impuntual)||0, capital:parseFloat(p.capital)||0,
             interes:parseFloat(p.interes)||0, multa, pagado:abonado, falta, estado:estadoVista };
  });

  const pctCapitalPagado = capitalOriginal>0 ? (capitalPagado/capitalOriginal) : 0;
  let pctCondonaInteres = 0;
  if (pctCapitalPagado>=0.67) pctCondonaInteres=0.5;
  else if (pctCapitalPagado>=0.34) pctCondonaInteres=0.25;
  const descuentoSugerido = Math.round(capitalPend + intPend*(1-pctCondonaInteres));
  const liquidar50 = Math.round(capitalPend + intPend*0.5);

  return {
    nombre: row.nombre, ejecutivo: row.ejecutivo||'', frecuencia: row.frecuencia||'',
    surtimiento: fdate(pf(row.surtimiento)), vencimiento: fdate(pf(row.vencimiento)),
    capitalOriginal, saldo, abono, capitalPagado, capitalPend, intPend,
    pctCapitalPagado: Math.round(pctCapitalPagado*100),
    pagadosATiempo, pagadosTarde, pendientes, vencidos, multasAcum,
    descuentoSugerido, liquidar50, descuentoAutorizado: null, // PC: _descuentoVigente (lectura de autorizaciones) pendiente
    calendario,
  };
}
