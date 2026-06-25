// Cotizador de Tubería — RÉPLICA EXACTA de calcular() del cotizador.html.
// Tipos: PERSONAL / CONVENIO / GOBIERNO / AMERICANO. Comisión PCT o FIJO. Financiada o descontada.

export const TIPOS_CREDITO = ['PERSONAL','CONVENIO','GOBIERNO','AMERICANO'];
export const FRECUENCIAS = ['SEMANAL','QUINCENAL','MENSUAL'];

// Tasas mensuales (puntual / impuntual) por tipo.
export function tasasPorTipo(tipo, monto) {
  const t = String(tipo||'').toUpperCase();
  if (t === 'PERSONAL')  return { puntual:0.107, impuntual:0.18 };
  if (t === 'CONVENIO')  return { puntual:0.02,  impuntual:0.07 };
  if (t === 'GOBIERNO')  return { puntual:0.10,  impuntual:0.15 };
  if (t === 'AMERICANO') {
    let p;
    if (monto >= 50000) p = 0.10;
    else if (monto <= 10000) p = 0.15;
    else p = 0.15 - ((monto - 10000) / 40000) * 0.05;
    return { puntual:p, impuntual:p + 0.05 };
  }
  return { puntual:0, impuntual:0 };
}

/** Calcula la cotización completa. Réplica fiel del cálculo del Script. */
export function cotizar(input) {
  const monto = parseFloat(input.monto) || 0;
  const tipo = String(input.tipo||'').toUpperCase();
  const freq = String(input.frecuencia||'MENSUAL').toUpperCase();
  const plazo = parseInt(input.plazo) || 1;
  const financiar = !!input.financiar;
  const adeudo = parseFloat(input.adeudo) || 0;

  if (monto <= 0) throw new Error('Monto inválido.');
  if (tipo === 'AMERICANO' && monto < 10000) throw new Error('El crédito americano requiere monto mínimo de $10,000.');

  // Comisión (PCT o FIJO)
  let montoComision = 0, pctVisual = 0, isFixed = false;
  if (String(input.comisionTipo||'PCT').toUpperCase() === 'FIJO') {
    montoComision = parseFloat(input.comisionValor) || 0;
    pctVisual = monto > 0 ? (montoComision / monto) * 100 : 0;
    isFixed = true;
  } else {
    const pct = parseFloat(input.comisionValor) || 0;
    montoComision = monto * (pct / 100);
    pctVisual = pct;
  }

  // Financiamiento: sumada (financiar) vs descontada
  let montoBaseDeuda, depositoCliente;
  if (financiar) { montoBaseDeuda = monto + montoComision; depositoCliente = monto; }
  else { montoBaseDeuda = monto; depositoCliente = monto - montoComision; }

  // Tasas y meses
  const { puntual:tasaPuntual, impuntual:tasaImpuntual } = tasasPorTipo(tipo, monto);
  let meses = plazo;
  if (freq === 'SEMANAL') meses = plazo / 4;
  if (freq === 'QUINCENAL') meses = plazo / 2;

  // Intereses
  const interesPuntual = montoBaseDeuda * tasaPuntual * meses;
  const totalPuntual = montoBaseDeuda + interesPuntual;
  const interesImpuntual = montoBaseDeuda * tasaImpuntual * meses;
  const totalImpuntual = montoBaseDeuda + interesImpuntual;

  // Abonos por período (AMERICANO solo interés; el capital es globazo al final)
  let abonoPuntual, abonoImpuntual;
  if (tipo === 'AMERICANO') { abonoPuntual = interesPuntual / plazo; abonoImpuntual = interesImpuntual / plazo; }
  else { abonoPuntual = totalPuntual / plazo; abonoImpuntual = totalImpuntual / plazo; }

  // Renovación: el cliente recibe el depósito menos su adeudo actual
  const recibe = depositoCliente - adeudo;

  return {
    monto, tipo, frecuencia:freq, plazo,
    comision: Math.round(montoComision), pctComision: Math.round(pctVisual*10)/10, isFixed, financiar,
    montoBaseDeuda: Math.round(montoBaseDeuda),
    deposito: Math.round(depositoCliente),
    adeudo: Math.round(adeudo), recibe: Math.round(recibe),
    tasaPuntual, tasaImpuntual,
    interesPuntual: Math.round(interesPuntual), interesImpuntual: Math.round(interesImpuntual),
    totalPuntual: Math.round(totalPuntual), totalImpuntual: Math.round(totalImpuntual),
    abonoPuntual: Math.round(abonoPuntual), abonoImpuntual: Math.round(abonoImpuntual),
  };
}
