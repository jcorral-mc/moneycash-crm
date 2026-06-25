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

  // ── INGRESOS ──
  let tInteres = 0, tMulta = 0;
  const porEjec = {}; const itemsMulta = [];
  for (const r of desglose) {
    if (!enMes(r.fecha, yyMM)) continue;
    const interes = Number(r.interes) || 0;
    const multa = Number(r.multa) || 0;
    if (interes > 0) {
      const ej = String(r.ejecutivo || '').trim() || '(sin ejecutivo)';
      porEjec[ej] = (porEjec[ej] || 0) + interes; tInteres += interes;
    }
    if (multa > 0) {
      tMulta += multa;
      itemsMulta.push({ cliente: r.cliente || '(cliente)', ejecutivo: r.ejecutivo || '', fecha: ddmm(r.fecha), monto: Math.round(multa) });
    }
  }
  // Comisión de apertura realizada (créditos surtidos en el mes)
  let tApertura = 0; const itemsApertura = [];
  for (const c of cartera) {
    if (!enMes(c.surtimiento, yyMM)) continue;
    const m = Number(c.comision_apertura) || 0;
    if (m > 0) { tApertura += m; itemsApertura.push({ cliente: c.nombre || '(cliente)', ejecutivo: c.ejecutivo || '', monto: Math.round(m) }); }
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
    if (tipo === 'ENTRADAS EXTRAORDINARIAS') continue;   // eso es ingreso, no gasto
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
