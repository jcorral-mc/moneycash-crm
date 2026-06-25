// Lógica de Finanzas — Estado de resultados (P&L) del mes.
// INGRESOS reales = intereses + multas + comisión de apertura (+ entradas extraordinarias).
// EGRESOS = gastos fijos + varios + nómina + intereses a inversionistas + diligencias.
// El CAPITAL cobrado NO es ingreso (es devolución a inversionistas).
const MESES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
const enMes = (fecha, yyMM) => String(fecha||'').slice(0,7) === yyMM;

export function construirBalance(desglose, movimientos, cartera, bancos, mes, anio) {
  const hoy = new Date();
  const m = (mes!=null && mes!=='') ? parseInt(mes) : hoy.getMonth();
  const y = (anio!=null && anio!=='') ? parseInt(anio) : hoy.getFullYear();
  const yyMM = `${y}-${String(m+1).padStart(2,'0')}`;

  // INGRESOS
  let intereses=0, multas=0, capitalRecuperado=0;
  for (const r of (desglose||[])) {
    if (!enMes(r.fecha, yyMM)) continue;
    intereses += Number(r.interes)||0;
    multas    += Number(r.multa)||0;
    capitalRecuperado += Number(r.capital)||0;
  }
  // Comisión de apertura realizada (créditos surtidos en el mes)
  let comision=0;
  for (const c of (cartera||[])) { if (enMes(c.surtimiento, yyMM)) comision += Number(c.comision_apertura)||0; }

  // EGRESOS + entradas extraordinarias (otros ingresos), desde el libro de movimientos
  const egr = { 'GASTOS FIJOS':0, 'GASTOS VARIOS':0, 'NOMINA':0, 'INTERESES':0, 'DILIGENCIAS':0 };
  let otrosIngresos=0;
  for (const r of (movimientos||[])) {
    if (!enMes(r.fecha, yyMM)) continue;
    const o = String(r.origen||'').toUpperCase(); const monto = Number(r.monto)||0;
    if (egr[o] !== undefined) egr[o] += monto;
    else if (o === 'ENTRADAS EXTRAORDINARIAS') otrosIngresos += monto;
  }

  const ingresos = {
    intereses:Math.round(intereses), multas:Math.round(multas), comision:Math.round(comision), otros:Math.round(otrosIngresos),
    total: Math.round(intereses + multas + comision + otrosIngresos),
  };
  const egresos = {
    gastosFijos:Math.round(egr['GASTOS FIJOS']), gastosVarios:Math.round(egr['GASTOS VARIOS']),
    nomina:Math.round(egr['NOMINA']), interesesInversionistas:Math.round(egr['INTERESES']), diligencias:Math.round(egr['DILIGENCIAS']),
    total: Math.round(egr['GASTOS FIJOS']+egr['GASTOS VARIOS']+egr['NOMINA']+egr['INTERESES']+egr['DILIGENCIAS']),
  };
  const saldosBancarios = Math.round((bancos||[]).reduce((s,b)=>s+(Number(b.saldo_sistema)||0),0));

  return {
    mes:m, anio:y, etiqueta:MESES[m]+' '+y,
    ingresos, egresos,
    ganancia: ingresos.total - egresos.total,
    capitalRecuperado: Math.round(capitalRecuperado),
    saldosBancarios,
  };
}
