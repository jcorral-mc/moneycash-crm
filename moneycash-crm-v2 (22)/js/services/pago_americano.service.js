// Lógica de Pago Americano — RÉPLICA de infoClientePagoAmericano / registrarPagoAmericano (Apps Script).
// Crédito americano: interés mensual fijo (capital · tasa), capital se abona/liquida al final.
import { estaImpuntual } from './clientes.service.js';
const U = s => String(s||'').toUpperCase();
const r0 = n => Math.round(Number(n)||0);

/** Normaliza la tasa a porcentaje (5 = 5%). Acepta 0.05 o 5. */
export function tasaPct(t) { const v = Number(t)||0; return v>1 ? v : v*100; }

/** Info del periodo para un cliente americano. */
export function infoAmericano(row, calRows) {
  const tp = tasaPct(row.tasa);
  const capitalActual = r0(row.saldo_capital ?? row.capital ?? row.saldo);
  const interesPeriodo  = r0(capitalActual * tp/100);
  const impuntualPeriodo = r0(capitalActual * (tp/100 + 0.05));
  const multaPeriodo = Math.max(0, impuntualPeriodo - interesPeriodo);

  const pagos = (calRows||[]).slice().sort((a,b)=>(a.n_pago||0)-(b.n_pago||0));
  const totalPagos = Number(row.pagos)||pagos.length||0;
  const prox = pagos.find(p => U(p.estatus).indexOf('PAGADO')<0);
  if (!prox) return { ok:true, sinPendientes:true, msg:'Este cliente americano no tiene pagos pendientes.' };

  const nPago = prox.n_pago;
  const fechaPago = String(prox.fecha||'').slice(0,10);
  const yaPagadoPeriodo = r0(prox.pagado);
  const faltaInteres = Math.max(0, interesPeriodo - yaPagadoPeriodo);

  const hoy = new Date(); hoy.setHours(0,0,0,0);
  const esImpuntual = estaImpuntual(prox.fecha, hoy);
  const enGracia = !esImpuntual;
  const montoInteres = esImpuntual ? (faltaInteres + multaPeriodo) : faltaInteres;

  const esFinal = nPago >= totalPagos;
  const montoFinal = capitalActual + faltaInteres;

  // Liquidación a la fecha (aprox.): capital + interés vencido (periodos no pagados ya vencidos) + interés corrido
  let interesVencido = 0;
  for (const p of pagos) {
    if (U(p.estatus).indexOf('PAGADO')>=0) continue;
    if (estaImpuntual(p.fecha, hoy)) interesVencido += Math.max(0, r0(p.interes||interesPeriodo) - r0(p.pagado));
  }
  const fProx = new Date(fechaPago); fProx.setHours(0,0,0,0);
  const diasCorridos = Math.max(0, Math.round((hoy - fProx)/86400000));
  const interesCorrido = r0(capitalActual * tp/100 * (diasCorridos/30));
  const montoLiquidar = capitalActual + interesVencido + interesCorrido;

  return {
    ok:true, cliente:row.nombre, capitalActual, tasa:tp, interesPeriodo, impuntualPeriodo, multaPeriodo,
    nPago, totalPagos, fechaPago, yaPagadoPeriodo, faltaInteres, esImpuntual, enGracia,
    montoInteres, montoLiquidar, montoLiquidarHoy:montoLiquidar, interesVencido, diasCorridos, interesCorrido,
    esFinal, montoFinal,
  };
}

/** Recalcula el interés tras un abono a capital (respeta la tasa pactada). */
export function recalcAbono(info, abono) {
  const ab = Number(abono)||0;
  const capNuevo = Math.max(0, info.capitalActual - ab);
  const intNuevo = r0(capNuevo * info.tasa/100);
  const impNuevo = r0(capNuevo * (info.tasa/100 + 0.05));
  return { capNuevo, intNuevo, impNuevo };
}

/** Arma el registro PENDIENTE del pago americano (se concilia/aplica aparte). */
export function construirPagoAmericano(info, datos, perfil) {
  const opcion = U(datos.opcion);
  let capital=0, interes=0, multa=0, monto=0;
  if (opcion==='INTERES') { interes = r0(datos.montoInteres); monto = interes; if (info.esImpuntual) { multa = Math.min(info.multaPeriodo, interes); interes -= multa; } }
  else if (opcion==='CAPITAL') { capital = r0(datos.abonoCapital); monto = capital; }
  else if (opcion==='AMBOS') { capital = r0(datos.abonoCapital); interes = r0(info.faltaInteres); monto = capital + interes; }
  else if (opcion==='LIQUIDAR') { capital = info.capitalActual; interes = r0(info.interesVencido + info.interesCorrido); monto = info.montoLiquidar; }
  else if (opcion==='FINAL') { capital = info.capitalActual; interes = r0(info.faltaInteres); monto = info.montoFinal; }
  if (monto<=0) throw new Error('El monto del pago no puede ser 0.');
  return {
    cliente: info.cliente, ejecutivo: datos.ejecutivo||'', cuenta: datos.cuenta||'',
    fecha: new Date().toISOString().slice(0,10), monto, n_pago: info.nPago,
    capital, interes, multa, tipo: 'AM_'+opcion, forma_pago: U(datos.formaPago||'TRANSFERENCIA'),
    estatus: 'PENDIENTE', capturado_por: (perfil&&(perfil.email||perfil.nombre))||'',
  };
}
