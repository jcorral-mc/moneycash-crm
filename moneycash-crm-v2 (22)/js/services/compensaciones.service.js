// Lógica de Compensaciones — RÉPLICA de _compCalcular del Script.
// Meta = base × pctMeta%. Comisión = base × escalón%. Bono apertura al 100% si el escalón lo incluye.
import { norm } from '../lib/dom.js';

export const COMP_DEFAULT = {
  pctMeta: 10,
  escalones: [
    { desde:0,   hasta:79.99,  pct:0,   apertura:false },
    { desde:80,  hasta:84.99,  pct:1,   apertura:false },
    { desde:85,  hasta:94.99,  pct:1.5, apertura:false },
    { desde:95,  hasta:99.99,  pct:2,   apertura:false },
    { desde:100, hasta:109.99, pct:2,   apertura:true },
    { desde:110, hasta:99999,  pct:2.5, apertura:true, crecimiento:5 },
  ],
};

const enMes = (fecha, yyMM) => String(fecha||'').slice(0,7) === yyMM;

/** Interés cobrado por un ejecutivo en el mes (desglose, EXCLUYE tipo APERTURA). */
export function interesCobrado(desglose, ejecutivo, yyMM) {
  let tot = 0;
  for (const r of (desglose||[])) {
    if (norm(r.ejecutivo) !== norm(ejecutivo)) continue;
    if (String(r.tipo||'').toUpperCase() === 'APERTURA') continue;
    if (!enMes(r.fecha, yyMM)) continue;
    tot += Number(r.interes)||0;
  }
  return Math.round(tot);
}

/** Comisión de apertura cobrada en el mes (desglose con tipo APERTURA). */
export function aperturaCobrada(desglose, ejecutivo, yyMM) {
  let tot = 0; const detalle = [];
  for (const r of (desglose||[])) {
    if (String(r.tipo||'').toUpperCase() !== 'APERTURA') continue;
    if (norm(r.ejecutivo) !== norm(ejecutivo)) continue;
    if (!enMes(r.fecha, yyMM)) continue;
    const m = Number(r.interes)||0; tot += m; detalle.push({ cliente:String(r.cliente||''), monto:Math.round(m) });
  }
  return { total:Math.round(tot), detalle };
}

/** Cartera de capital actual del ejecutivo (saldo>0) — para medir crecimiento. */
export function carteraActualCapital(cartera, ejecutivo) {
  let tot = 0;
  for (const c of (cartera||[])) {
    if (norm(c.ejecutivo) !== norm(ejecutivo)) continue;
    if ((Number(c.saldo)||0) <= 0) continue;
    tot += Number(c.capital)||0;
  }
  return Math.round(tot);
}

/** RÉPLICA de _compCalcular: meta, % cumplimiento, escalón, comisión, bono apertura, crecimiento. */
export function calcular(ejecutivo, base, cobrado, carteraActual, apertura, cfg) {
  cfg = cfg || COMP_DEFAULT;
  base = Number(base)||0;
  const meta = base * (cfg.pctMeta/100);
  const pct = meta>0 ? (cobrado/meta*100) : 0;
  const crecimiento = base>0 ? ((carteraActual-base)/base*100) : 0;

  let esc = cfg.escalones[0];
  for (const e of cfg.escalones) { if (pct >= e.desde) esc = e; }
  // Si el escalón pide crecimiento y no se cumple, baja al anterior sin requisito
  if (esc.crecimiento && crecimiento < esc.crecimiento) {
    for (let i=cfg.escalones.length-1; i>=0; i--) { const e=cfg.escalones[i]; if (pct>=e.desde && !e.crecimiento) { esc=e; break; } }
  }
  const comision = base * (esc.pct/100);
  const aperturaTotal = (apertura && apertura.total) || 0;
  const bonoApertura = (pct>=100 && esc.apertura) ? aperturaTotal : 0;
  const comisionTotal = comision + bonoApertura;

  return {
    ejecutivo, base:Math.round(base), meta:Math.round(meta), cobrado:Math.round(cobrado),
    pct:Math.round(pct*10)/10, comision:Math.round(comisionTotal), comisionBase:Math.round(comision),
    bonoApertura:Math.round(bonoApertura), pctComision:esc.pct, incluyeApertura:!!esc.apertura,
    aperturaTotal:Math.round(aperturaTotal), crecimiento:Math.round(crecimiento*10)/10, carteraActual:Math.round(carteraActual),
    llegaAMeta: pct>=100,
  };
}

/** Siguiente escalón por alcanzar (para el medidor del ejecutivo). */
export function siguienteEscalon(pct, cfg) {
  cfg = cfg || COMP_DEFAULT;
  for (const e of cfg.escalones) { if (e.desde > pct) return { desde:e.desde, pct:e.pct, apertura:e.apertura }; }
  return null;
}
