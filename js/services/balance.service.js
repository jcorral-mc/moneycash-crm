// Lógica del Balance del mes — réplica de balanceDetalle del Script.
// INGRESOS = interés cobrado (por ejecutivo) + multas + comisión de apertura.
// GASTOS  = movimientos por tipo (nómina, intereses a inversionistas, fijos, varios, diligencias).
// El capital cobrado NO es ingreso (es devolución a inversionistas).
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const enMes = (fecha, yyMM) => String(fecha || '').slice(0, 7) === yyMM;
const ddmm = f => { const s = String(f || ''); return s.length >= 10 ? s.slice(8, 10) + '/' + s.slice(5, 7) : ''; };

const ETIQ = {
  'NOMINA': 'Nómina', 'INTERESES': 'Intereses a inversionistas',
  'GASTOS FIJOS': 'Gastos fijos', 'GASTOS VARIOS': 'Gastos varios', 'DILIGENCIAS': 'Diligencias',
};

export function construirBalanceMes(data, mes, anio) {
  const { desglose = [], movimientos = [], cartera = [] } = data || {};
  const yyMM = `${anio}-${String(mes + 1).padStart(2, '0')}`;

  // ── INGRESOS (clasificados por TIPO de desglose; el importe vive en la columna `interes`) ──
  //  INTERÉS real = renglones de interés EXCLUYENDO APERTURA y MULTA.
  //  MULTA        = renglones tipo MULTA.
  //  APERTURA     = renglones tipo APERTURA (fuente ÚNICA; NO se lee de cartera para no contar doble).
  //  Capital cobrado NUNCA entra a ingresos (es retorno a inversionistas; vive en la col. `capital`).
  let tInteres = 0, tMulta = 0, tApertura = 0;
  const porEjec = {}; const itemsMulta = []; const itemsApertura = [];
  for (const r of desglose) {
    if (!enMes(r.fecha, yyMM)) continue;
    const tipo = String(r.tipo || '').toUpperCase();
    const monto = Number(r.interes) || 0;
    if (monto <= 0) continue;
    if (tipo === 'APERTURA') {
      tApertura += monto;
      itemsApertura.push({ cliente: r.cliente || '(cliente)', ejecutivo: r.ejecutivo || '', monto: Math.round(monto) });
    } else if (tipo === 'MULTA') {
      tMulta += monto;
      itemsMulta.push({ cliente: r.cliente || '(cliente)', ejecutivo: r.ejecutivo || '', fecha: ddmm(r.fecha), monto: Math.round(monto) });
    } else {
      const ej = String(r.ejecutivo || '').trim() || '(sin ejecutivo)';
      porEjec[ej] = (porEjec[ej] || 0) + monto; tInteres += monto;
    }
  }
  const interesPorEjecutivo = Object.keys(porEjec)
    .map(k => ({ ejecutivo: k, monto: Math.round(porEjec[k]) }))
    .sort((a, b) => b.monto - a.monto);
  const ingresos = Math.round(tInteres + tMulta + tApertura);

  // ── GASTOS por tipo ──
  const gMap = {}; let gastos = 0;
  for (const r of movimientos) {
    if (!enMes(r.fecha, yyMM)) continue;
    const tipo = String(r.origen || '').toUpperCase().trim() || 'OTROS';
    // GASTO real únicamente: nómina, intereses a inversionistas, fijos, varios, diligencias.
    // Se EXCLUYE el resto del libro de banco (cobranza, jurídico, surtimientos, dispersión,
    // renovación, transferencias y entradas extraordinarias), que no son gasto de P&L.
    if (!ETIQ[tipo]) continue;
    const monto = Number(r.monto) || 0; if (monto <= 0) continue;
    const concepto = String(r.concepto || r.subconcepto || '').trim() || (ETIQ[tipo] || tipo);
    gastos += monto;
    if (!gMap[tipo]) gMap[tipo] = { tipo, nombre: ETIQ[tipo] || (tipo[0] + tipo.slice(1).toLowerCase()), total: 0, items: [] };
    gMap[tipo].total += monto;
    gMap[tipo].items.push({ concepto, fecha: ddmm(r.fecha), monto: Math.round(monto) });
  }
  const gastosPorTipo = Object.values(gMap)
    .map(g => { g.total = Math.round(g.total); g.items.sort((a, b) => b.monto - a.monto); return g; })
    .sort((a, b) => b.total - a.total);

  const ganancia = ingresos - Math.round(gastos);
  const margen = ingresos > 0 ? Math.round(ganancia / ingresos * 1000) / 10 : 0;

  return {
    mes, anio, etiqueta: MESES[mes] + ' ' + anio,
    ingresos, gastos: Math.round(gastos), ganancia, margen,
    interes: Math.round(tInteres), multas: Math.round(tMulta), apertura: Math.round(tApertura),
    interesPorEjecutivo, itemsMulta: itemsMulta.slice(0, 80), itemsApertura: itemsApertura.slice(0, 80),
    gastosPorTipo,
  };
}
