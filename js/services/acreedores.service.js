// Lógica de Acreedores (inversionistas) — RÉPLICA de obtenerAcreedores (Apps Script).
const fdate = d => d ? new Date(d).toLocaleDateString('es-MX',{day:'2-digit',month:'2-digit',year:'numeric'}) : '';

/** RÉPLICA de obtenerAcreedores: lista activa + próximos a pagar + deuda total. */
export function construirLista(acreedores) {
  const hoy = new Date(); hoy.setHours(0,0,0,0);
  const out = [];
  for (const r of (acreedores||[])) {
    if (!r.nombre || !String(r.nombre).trim()) continue;
    if (r.activo === false) continue;            // dado de baja
    let proxStr = '', dias = null;
    if (r.prox_pago) { const f = new Date(r.prox_pago); f.setHours(0,0,0,0); proxStr = fdate(f); dias = Math.round((f-hoy)/86400000); }
    out.push({
      id: r.id, acreedor_id: r.acreedor_id, nombre: String(r.nombre), tipo: String(r.tipo||''),
      montoDebo: Number(r.monto_debo)||0,          // capital invertido
      pctInteres: Number(r.pct_interes)||0,
      frecuencia: String(r.frecuencia||''),
      proxPago: proxStr, diasParaPago: dias,
      saldo: Number(r.saldo)||0,                   // saldo pendiente
      notas: String(r.notas||''),
    });
  }
  const proximos = out.filter(a=>a.diasParaPago!==null).sort((a,b)=>a.diasParaPago-b.diasParaPago);
  const totalDeuda = out.reduce((s,a)=>s+a.saldo, 0);
  return { acreedores: out, proximos, totalDeuda: Math.round(totalDeuda) };
}

/** Estado de cuenta de un acreedor + su histórico de pagos (movimientos ligados). */
export function estadoCuenta(acreedor, historicoMovs) {
  const a = acreedor;
  const hist = (historicoMovs||[]).map(m => ({
    fecha: String(m.fecha).slice(0,10), tipo: m.tipo, monto: Number(m.monto)||0,
    concepto: m.concepto||'', origen: m.origen||'',
  })).sort((x,y)=> y.fecha<x.fecha?-1:y.fecha>x.fecha?1:0);
  const totalPagado = hist.filter(h=>h.tipo==='EGRESO').reduce((s,h)=>s+h.monto,0);
  const totalRecibido = hist.filter(h=>h.tipo==='INGRESO').reduce((s,h)=>s+h.monto,0);
  return {
    nombre: a.nombre, tipo: a.tipo,
    capitalInvertido: Number(a.monto_debo)||0,
    pctInteres: Number(a.pct_interes)||0,
    frecuencia: a.frecuencia||'',
    proxPago: a.prox_pago ? fdate(a.prox_pago) : '—',
    saldoPendiente: Number(a.saldo)||0,
    totalPagado: Math.round(totalPagado),
    totalRecibido: Math.round(totalRecibido),
    historico: hist,
  };
}
