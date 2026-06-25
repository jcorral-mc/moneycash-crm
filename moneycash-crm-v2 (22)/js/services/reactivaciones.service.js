// Lógica de Reactivaciones — RÉPLICA de obtenerReactivaciones.
// Candidatos: clientes EN CEROS (saldo<=0) que tuvieron crédito (capital>0). Mercado abierto (todos los ven).
import { norm } from '../lib/dom.js';

export function construirReactivaciones(cartera, desglose) {
  // Última fecha pagada por cliente (de desglose)
  const ultPago = {};
  for (const r of (desglose||[])) {
    const cli = norm(r.cliente); if (!cli || !r.fecha) continue;
    const t = new Date(r.fecha).getTime();
    if (!ultPago[cli] || t > ultPago[cli]) ultPago[cli] = t;
  }
  const out = [];
  for (const c of (cartera||[])) {
    const nombre = String(c.nombre||'').trim(); if (!nombre) continue;
    if ((Number(c.saldo)||0) > 0) continue;          // solo en ceros
    const capital = Number(c.capital)||0; if (capital <= 0) continue;  // debió tener crédito
    let fechaLiq = '';
    const t = ultPago[norm(nombre)];
    if (t) fechaLiq = new Date(t).toISOString().slice(0,10);
    else if (c.vencimiento) fechaLiq = String(c.vencimiento).slice(0,10);
    out.push({ nombre, ejecutivo:String(c.ejecutivo||'').trim()||'(sin ejecutivo)', ultimoPrestamo:Math.round(capital), fechaLiquido:fechaLiq, frecuencia:String(c.frecuencia||'') });
  }
  out.sort((a,b)=>a.nombre.localeCompare(b.nombre));
  const porEjec = {};
  out.forEach(cl => { (porEjec[cl.ejecutivo] = porEjec[cl.ejecutivo]||[]).push(cl); });
  return { total:out.length, clientes:out, porEjecutivo:Object.keys(porEjec).sort().map(k=>({ ejecutivo:k, n:porEjec[k].length, clientes:porEjec[k] })) };
}
