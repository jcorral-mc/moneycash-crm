// Generación de Calendario y Alta — RÉPLICA de _altaGenerarFechas / _altaCalcularMontos /
// _altaConstruirCalendario / altaVistaPrevia (Apps Script). Mismas reglas de fechas y reparto.
const U = s => String(s||'').toUpperCase();
const iso = d => { const x=new Date(d); return x.toISOString().slice(0,10); };

/** _altaGenerarFechas: fechas de pago según frecuencia (semanal a domingo, quincenal 15/fin, mensual/americano). */
export function generarFechas(freq, plazo, tipo, fechaSurtido) {
  const F = U(freq), T = U(tipo);
  const esAmericano = (T === 'AMERICANO' || F === 'AMERICANO');
  let fecha = fechaSurtido ? new Date(fechaSurtido) : new Date();
  fecha.setHours(12,0,0,0);
  let fechaPago = new Date(fecha);
  const diaSemana = fecha.getDay(), diaMes = fecha.getDate();
  let esMedioPago = false;

  if (F === 'SEMANAL') {
    let diasParaDomingo = 0;
    if (diaSemana === 1 || diaSemana === 2) diasParaDomingo = 7 - diaSemana;
    else { let d=(7-diaSemana)%7; if(d===0) d=7; diasParaDomingo = d + 7; }
    fechaPago.setDate(fecha.getDate() + diasParaDomingo);
  } else if (F === 'QUINCENAL') {
    const y=fecha.getFullYear(), m=fecha.getMonth();
    if (diaMes>=1 && diaMes<=3) fechaPago = new Date(y,m,15);
    else if (diaMes>=4 && diaMes<=7) { fechaPago = new Date(y,m,15); esMedioPago=true; }
    else if (diaMes>=8 && diaMes<=14) fechaPago = new Date(y,m+1,0);
    else if (diaMes>=15 && diaMes<=17) fechaPago = new Date(y,m+1,0);
    else if (diaMes>=18 && diaMes<=21) { fechaPago = new Date(y,m+1,0); esMedioPago=true; }
    else fechaPago = new Date(y,m+1,15);
  } else {
    fechaPago.setMonth(fecha.getMonth()+1); // MENSUAL y AMERICANO
  }

  const totalPagos = esMedioPago ? plazo+1 : plazo;
  const out = [];
  for (let i=1; i<=totalPagos; i++) {
    out.push({ fecha:new Date(fechaPago), esMedio:(esMedioPago && (i===1||i===totalPagos)), esUltimoAmericano:(esAmericano && i===totalPagos) });
    if (F === 'SEMANAL') fechaPago.setDate(fechaPago.getDate()+7);
    else if (F === 'QUINCENAL') { const d=fechaPago.getDate(), mm=fechaPago.getMonth(), yy=fechaPago.getFullYear(); fechaPago = (d===15) ? new Date(yy,mm+1,0) : new Date(yy,mm+1,15); }
    else fechaPago.setMonth(fechaPago.getMonth()+1);
  }
  return out;
}

/** _altaCalcularMontos */
export function calcularMontos(monto, comision, esFinanciada) {
  const capital = esFinanciada ? monto+comision : monto;
  const dispersion = esFinanciada ? monto : (monto - comision);
  return { capital, dispersion, comision };
}

/** _altaConstruirCalendario: filas del calendario + reparto capital/interés + %. */
export function construirCalendario(d) {
  const monto=parseFloat(d.monto)||0, comision=parseFloat(d.comision)||0, plazo=parseInt(d.plazo)||0;
  const freq=U(d.frecuencia), tipo=U(d.tipo||'PERSONAL');
  const abonoPuntual=parseFloat(d.abonoPuntual)||0, abonoImpuntual=parseFloat(d.abonoImpuntual)||0;
  const esFinanciada=(d.tipoComision==='FINANCIADA');
  const esAmericano=(tipo==='AMERICANO' || freq==='AMERICANO');

  const m=calcularMontos(monto,comision,esFinanciada);
  const capital=m.capital;

  let interesTotal, totalPagar, pctCap, pctInt, capitalPorPago, interesPorPago;
  if (esAmericano) {
    interesTotal=abonoPuntual*plazo; totalPagar=capital+interesTotal;
    pctCap=totalPagar>0?(capital/totalPagar):0; pctInt=totalPagar>0?(interesTotal/totalPagar):0;
    capitalPorPago=0; interesPorPago=abonoPuntual;
  } else {
    totalPagar=abonoPuntual*plazo; interesTotal=totalPagar-capital;
    pctCap=totalPagar>0?(capital/totalPagar):0; pctInt=totalPagar>0?(interesTotal/totalPagar):0;
    capitalPorPago=abonoPuntual*pctCap; interesPorPago=abonoPuntual*pctInt;
  }

  const fechas=generarFechas(freq,plazo,tipo,d.fechaSurtido);
  const filas=[]; let nPago=0;
  for (const f of fechas) {
    nPago++;
    let mp=abonoPuntual, mi=abonoImpuntual, cap=capitalPorPago, intr=interesPorPago;
    if (f.esMedio) { mp=Math.round(abonoPuntual/2); mi=Math.round(abonoImpuntual/2); cap=capitalPorPago/2; intr=interesPorPago/2; }
    if (f.esUltimoAmericano) { mp=abonoPuntual+capital; mi=abonoImpuntual+capital; cap=capital; intr=abonoPuntual; }
    filas.push({ nPago, fecha:iso(f.fecha), montoPuntual:Math.round(mp), montoImpuntual:Math.round(mi), capital:Math.round(cap), interes:Math.round(intr) });
  }
  return { filas, capital, dispersion:m.dispersion, comision, interesTotal:Math.round(interesTotal), saldoTotal:Math.round(totalPagar), pctCap, pctInt, esAmericano };
}

/** altaVistaPrevia: valida y devuelve preview (sin escribir). */
export function vistaPrevia(d) {
  if (!d.nombre || String(d.nombre).trim()==='') throw new Error('Indica el nombre del cliente.');
  const monto=parseFloat(d.monto)||0, plazo=parseInt(d.plazo)||0, abonoPuntual=parseFloat(d.abonoPuntual)||0;
  if (monto<=0) throw new Error('El monto debe ser mayor a 0.');
  if (plazo<=0) throw new Error('El plazo debe ser mayor a 0.');
  if (abonoPuntual<=0) throw new Error('Indica el abono puntual.');
  const cal=construirCalendario(d);
  return { cliente:String(d.nombre).trim(), capital:cal.capital, dispersion:cal.dispersion, comision:cal.comision,
    interesTotal:cal.interesTotal, saldoTotal:cal.saldoTotal, pctCap:Math.round(cal.pctCap*10000)/100, pctInt:Math.round(cal.pctInt*10000)/100,
    esAmericano:cal.esAmericano, calendario:cal.filas, _cal:cal };
}

/** Construye los registros de cartera + calendarios para escribir (réplica de altaEnviarACartera). */
export function construirAlta(d) {
  const cal = construirCalendario(d);
  const nombre = String(d.nombre||'').trim().toUpperCase();
  const plazo = parseInt(d.plazo)||0;
  const ejecutivo = U(d.ejecutivo||'');
  const esAmericano = cal.esAmericano;
  const credito_id = 'M'+Date.now();
  const hoy = new Date().toISOString().slice(0,10);
  const impuntualRef = (cal.filas.length) ? cal.filas[0].montoImpuntual : (parseFloat(d.abonoPuntual)||0);
  const scIni = esAmericano ? Math.min(cal.capital, cal.saldoTotal) : Math.round(cal.saldoTotal*cal.pctCap);

  const cartera = {
    credito_id, nombre, ejecutivo,
    frecuencia: esAmericano ? 'AMERICANO' : U(d.frecuencia),
    tipo_credito: esAmericano ? 'AMERICANO' : 'SIMPLE',
    capital: cal.capital,
    pg_cap: esAmericano ? 0 : Math.round(cal.capital/plazo),
    pg_int: esAmericano ? (parseFloat(d.abonoPuntual)||0) : Math.round(cal.interesTotal/plazo),
    pct_cap: cal.pctCap, pct_int: cal.pctInt,
    pagos: plazo, abono: parseFloat(d.abonoPuntual)||0, impuntual: impuntualRef,
    comision_apertura: Math.round(parseFloat(d.comision)||0),
    saldo: cal.saldoTotal, saldo_capital: scIni, saldo_interes: cal.saldoTotal-scIni,
    tasa: (esAmericano && cal.capital>0) ? ((parseFloat(d.abonoPuntual)||0)/cal.capital) : 0,
    surtimiento: hoy, vencimiento: cal.filas.length ? cal.filas[0].fecha : null,
    estatus: 'ACTIVO',
  };
  const calendarioRows = cal.filas.map(f => ({
    id_credito: credito_id, cliente: nombre, n_pago: f.nPago, fecha: f.fecha,
    monto_puntual: f.montoPuntual, monto_impuntual: f.montoImpuntual, capital: f.capital, interes: f.interes,
    pagado: 0, estatus: 'PENDIENTE',
  }));
  return { cartera, calendarioRows, resumen: { capital:cal.capital, dispersion:cal.dispersion, nPagos:cal.filas.length } };
}
