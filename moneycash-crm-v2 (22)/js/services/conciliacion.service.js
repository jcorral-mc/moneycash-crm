// Lógica de Conciliación — RÉPLICA de _aplicarPagoReal (Apps Script).
// Calcula el PLAN de aplicación de un pago pendiente aprobado (sin tocar la BD).
// El repo ejecuta el plan. Cubre crédito simple: MINIMO / LIQUIDAR / NORMAL / PARCIAL.
const U = s => String(s||'').toUpperCase();

export function planAplicarPago(carteraRow, calRows, p) {
  const tipo = U(p.tipo);
  if (/^AM_|AMERICANO/.test(tipo)) throw new Error('Crédito americano: se aplica en su módulo (Pago Americano).');
  if (/JURIDICO/.test(tipo)) throw new Error('Abono jurídico: se aplica en el módulo Jurídico.');
  if (tipo === 'COMBO') throw new Error('Combinación de pagos: se aplica en su módulo.');

  const cal = (calRows||[]).slice().sort((a,b)=>(a.n_pago||0)-(b.n_pago||0));
  const saldo = Number(carteraRow.saldo)||0;
  const nPago = Number(p.n_pago)||0, multa = Number(p.multa)||0, monto = Number(p.monto)||0;
  let pctCap = Number(carteraRow.pct_cap)||0; if (pctCap>1) pctCap/=100;
  const recalc = (s) => { const sc=Math.round(s*pctCap); return { saldo_capital:sc, saldo_interes:s-sc }; };
  const plan = { calUpdates:[], calInserts:[], desglose:[], bancoIngreso:0,
                 cuenta:p.cuenta, cliente:p.cliente, ejecutivo:p.ejecutivo, saldo:saldo, saldo_capital:null, saldo_interes:null, detalle:'' };

  if (tipo === 'MINIMO') {
    const pg = cal.find(x=>x.n_pago===nPago) || cal.find(x=>U(x.estatus).indexOf('PAGADO')<0);
    if (!pg) throw new Error('No se encontró el pago pendiente para el mínimo.');
    const interesMin = monto, capitalRecorrido = Number(pg.capital)||0, interesPeriodo = Number(pg.interes)||0;
    plan.calUpdates.push({ id:pg.id, pagado:interesMin, estatus:'PAGADO (MÍNIMO)' });
    const last = cal[cal.length-1];
    const nuevoNPago = (last?last.n_pago:cal.length)+1;
    let nf = new Date(last && last.fecha ? last.fecha : new Date());
    if (cal.length>=2 && cal[cal.length-1].fecha && cal[cal.length-2].fecha) {
      const dif = Math.round((new Date(cal[cal.length-1].fecha)-new Date(cal[cal.length-2].fecha))/86400000);
      nf.setDate(nf.getDate() + (dif>0?dif:30));
    } else nf.setMonth(nf.getMonth()+1);
    const nuevoPuntual = Math.round(capitalRecorrido+interesPeriodo);
    const nuevoImpuntual = Math.round(nuevoPuntual + ((Number(pg.monto_impuntual)||0)-(Number(pg.monto_puntual)||0)));
    plan.calInserts.push({ cartera_id:carteraRow.id, id_credito:pg.id_credito, cliente:p.cliente, n_pago:nuevoNPago,
      fecha:nf.toISOString().slice(0,10), monto_puntual:nuevoPuntual, monto_impuntual:nuevoImpuntual,
      capital:capitalRecorrido, interes:interesPeriodo, pagado:0, estatus:'PENDIENTE (EXT MÍNIMO)' });
    const nuevoSaldo = Math.max(0, saldo - interesMin + interesPeriodo);
    plan.saldo = nuevoSaldo; Object.assign(plan, recalc(nuevoSaldo));
    plan.bancoIngreso = interesMin;
    plan.desglose.push({ pago:interesMin, capital:0, interes:interesMin, tipo:'MINIMO' });
    plan.detalle = `Mínimo $${interesMin} a interés; pago #${nPago} recorrido a #${nuevoNPago}.`;
    return plan;
  }

  if (tipo === 'LIQUIDAR') {
    cal.forEach(pg => { if (U(pg.estatus).indexOf('PAGADO')<0) plan.calUpdates.push({ id:pg.id, pagado:Number(pg.monto_puntual)||0, estatus:'PAGADO' }); });
    let capLiq = Number(carteraRow.saldo_capital); if (isNaN(capLiq)||capLiq<=0) capLiq = Number(carteraRow.capital)||0;
    capLiq = Math.min(Math.round(capLiq), Math.round(monto));
    const intLiq = Math.max(0, Math.round(monto)-capLiq);
    plan.saldo = 0; plan.saldo_capital = 0; plan.saldo_interes = 0;
    plan.bancoIngreso = monto;
    plan.desglose.push({ pago:monto, capital:capLiq, interes:intLiq, tipo:'LIQUIDACION' });
    plan.detalle = `Liquidado $${monto} (cap $${capLiq} + int $${intLiq}). Saldo a cero.`;
    return plan;
  }

  // NORMAL / PARCIAL
  const abonoNormal = monto - multa;
  if (nPago>0) {
    const pg = cal.find(x=>x.n_pago===nPago);
    if (pg) {
      const prev = Number(pg.pagado)||0, puntual = Number(pg.monto_puntual)||0;
      if (tipo === 'PARCIAL') {
        plan.calUpdates.push({ id:pg.id, pagado:Math.round(prev+abonoNormal) });
      } else {
        const acum = Math.round(prev+abonoNormal);
        const upd = { id:pg.id, pagado:acum };
        if (acum >= puntual-1) upd.estatus = 'PAGADO';
        plan.calUpdates.push(upd);
        let excedente = Math.round(abonoNormal - (puntual - prev));
        if (excedente>0) {
          const dir = U(p.excedente_a||'SIGUIENTE');
          const sig = cal.filter(x=>x.n_pago>nPago && U(x.estatus).indexOf('PAGADO')<0)
                         .sort((a,b)=> dir==='ULTIMO' ? (b.n_pago-a.n_pago) : (a.n_pago-b.n_pago));
          for (const s of sig) {
            if (excedente<=0) break;
            const falta = Math.round((Number(s.monto_puntual)||0)-(Number(s.pagado)||0));
            if (excedente>=falta) { plan.calUpdates.push({ id:s.id, pagado:Number(s.monto_puntual)||0, estatus:'PAGADO' }); excedente-=falta; }
            else { plan.calUpdates.push({ id:s.id, pagado:Math.round((Number(s.pagado)||0)+excedente) }); excedente=0; }
          }
        }
      }
    }
  }
  const nuevoSaldo = Math.max(0, saldo-abonoNormal);
  plan.saldo = nuevoSaldo; Object.assign(plan, recalc(nuevoSaldo));
  if (abonoNormal>0) { plan.bancoIngreso += abonoNormal; plan.desglose.push({ pago:abonoNormal, capital:Number(p.capital)||0, interes:Number(p.interes)||0, tipo:tipo }); }
  if (multa>0) { plan.bancoIngreso += multa; plan.desglose.push({ pago:multa, capital:0, interes:multa, tipo:'MULTA' }); }
  plan.detalle = tipo==='PARCIAL' ? `Parcial $${abonoNormal}.` : `Abono $${abonoNormal}.` + (multa>0?` Multa $${multa}.`:'');
  return plan;
}
