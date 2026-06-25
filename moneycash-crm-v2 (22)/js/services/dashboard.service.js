// Lógica del Dashboard — RÉPLICA de obtenerResumenDashboard (Apps Script).
import { norm } from '../lib/dom.js';
const U = s => String(s||'').toUpperCase();

/** Réplica de obtenerResumenDashboard: capital vivo, deuda, cobrado mes/hoy, cartera por ejecutivo. */
export function construirResumen(carteraRows, desgloseRows, rol, ejecutivo) {
  let totalCartera=0, numActivos=0, capitalColocado=0, capitalPend=0, interesPend=0;
  const porEjec = {};
  for (const row of carteraRows) {
    const n = row.nombre, saldo = Number(row.saldo)||0, capital = Number(row.capital)||0, ej = row.ejecutivo;
    if (!n || saldo<=0) continue;
    const _ej = U(row.ejecutivo).trim();
    if (rol==='ADMIN' && _ej==='JURIDICO') continue;          // jurídico no suma a capital vivo
    if (rol==='EJECUTIVO' && norm(ej)!==norm(ejecutivo)) continue;
    totalCartera += saldo; numActivos++; capitalColocado += capital;
    let sc = Number(row.saldo_capital), si = Number(row.saldo_interes);
    if (isNaN(sc) || isNaN(si)) { let pctCap=Number(row.pct_cap)||0; if(pctCap>1)pctCap/=100; sc=Math.round(saldo*pctCap); si=saldo-sc; }
    capitalPend += sc; interesPend += si;
    if (ej) porEjec[ej] = (porEjec[ej]||0) + saldo;
  }
  const deudaTotal = capitalPend + interesPend;

  // Cobrado del MES y de HOY (desde DESGLOSE) + interés cobrado (ingreso real)
  let cobradoMes=0, cobradoHoy=0, intHoy=0, intCobradoMes=0;
  const ahora = new Date();
  const yyMM = ahora.toISOString().slice(0,7);     // 'yyyy-MM'
  const hoyISO = ahora.toISOString().slice(0,10);  // 'yyyy-MM-dd'
  for (const r of (desgloseRows||[])) {
    if (!r.fecha) continue;
    if (rol==='EJECUTIVO' && norm(r.ejecutivo)!==norm(ejecutivo)) continue;
    const f = String(r.fecha).slice(0,10);
    const monto = Number(r.pago)||0, intt = Number(r.interes)||0;
    if (f.slice(0,7) === yyMM) { cobradoMes += monto; intCobradoMes += intt; }
    if (f === hoyISO) { cobradoHoy += monto; intHoy += intt; }
  }

  const porEjecutivo = Object.entries(porEjec).map(([k,v])=>({ejecutivo:k, monto:v})).sort((a,b)=>b.monto-a.monto);
  return { totalCartera, numActivos, capitalColocado, capitalPend, interesPend, deudaTotal, cobradoMes, cobradoHoy, intHoy, intCobradoMes, porEjecutivo };
}
