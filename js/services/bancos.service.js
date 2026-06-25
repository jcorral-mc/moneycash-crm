// Lógica de Bancos — RÉPLICA de bancosResumen y obtenerMovimientosBanco (Apps Script).
import { norm } from '../lib/dom.js';
const U = s => String(s||'').toUpperCase();
const MESES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];

/** Una transferencia interna NO cuenta como ingreso/egreso real del mes. */
function esTransfer(mov) {
  return U(mov.origen).indexOf('TRANSFERENCIA') >= 0 || U(mov.concepto).indexOf('TRANSFERENCIA') >= 0;
}

/** RÉPLICA de bancosResumen: cuentas con saldo, neto del mes (sin transferencias), lista de movimientos. */
export function construirResumen(bancos, movimientos, mes, anio) {
  const cuentas = (bancos||[]).filter(b=>b.activo!==false).map(b => ({ cuenta:b.cuenta, saldo:Math.round(Number(b.saldo_sistema)||0) }));
  const saldoTotal = cuentas.reduce((s,c)=>s+c.saldo,0);

  const hoy = new Date();
  const m = (mes!=null && mes!=='') ? parseInt(mes) : hoy.getMonth();
  const y = (anio!=null && anio!=='') ? parseInt(anio) : hoy.getFullYear();
  const yyMM = `${y}-${String(m+1).padStart(2,'0')}`;

  let mesIng=0, mesEgr=0; const movs=[];
  for (const r of (movimientos||[])) {
    if (!r.fecha) continue;
    const f = String(r.fecha).slice(0,10);
    if (f.slice(0,7) !== yyMM) continue;
    const tipo = U(r.tipo), monto = Number(r.monto)||0, tr = esTransfer(r);
    if (!tr) { if (tipo==='INGRESO') mesIng+=monto; else if (tipo==='EGRESO') mesEgr+=monto; }
    movs.push({ id:r.id, fecha:f, hora:String(r.hora||''), tipo, transfer:tr, cuenta:String(r.cuenta||'').trim(),
      monto:Math.round(monto), concepto:String(r.concepto||''), origen:String(r.origen||''), obs:String(r.obs||''), reversado:!!r.reversado });
  }
  movs.sort((a,b)=> (b.fecha<a.fecha?-1:b.fecha>a.fecha?1:0) || (b.id-a.id));

  return { cuentas, saldoTotal:Math.round(saldoTotal),
    mesIngresos:Math.round(mesIng), mesEgresos:Math.round(mesEgr), mesNeto:Math.round(mesIng-mesEgr),
    movimientos:movs, mes:m, anio:y, mesVista:MESES[m]+' '+y };
}

/** RÉPLICA de obtenerMovimientosBanco: movimientos de una cuenta con filtros. */
export function filtrarMovimientos(movimientos, cuenta, filtros) {
  const f = filtros||{};
  let totalIng=0, totalEgr=0; const out=[];
  for (const r of (movimientos||[])) {
    if (!r.fecha) continue;
    if (cuenta && norm(r.cuenta)!==norm(cuenta)) continue;
    const tipo = U(r.tipo), monto = Number(r.monto)||0;
    const concepto = String(r.concepto||''), obs = String(r.obs||'');
    const fStr = String(r.fecha).slice(0,10);
    if (f.tipo && tipo!==U(f.tipo)) continue;
    if (f.mes && fStr.slice(0,7)!==f.mes) continue;
    if (f.desde && fStr<f.desde) continue;
    if (f.hasta && fStr>f.hasta) continue;
    if (f.montoMin!=null && f.montoMin!=='' && monto<parseFloat(f.montoMin)) continue;
    if (f.montoMax!=null && f.montoMax!=='' && monto>parseFloat(f.montoMax)) continue;
    if (f.texto) { const q=norm(f.texto); if (norm(concepto).indexOf(q)<0 && norm(obs).indexOf(q)<0) continue; }
    if (tipo==='INGRESO') totalIng+=monto; else if (tipo==='EGRESO') totalEgr+=monto;
    out.push({ id:r.id, fecha:fStr, tipo, monto:Math.round(monto), concepto, origen:String(r.origen||''), obs, reversado:!!r.reversado });
  }
  out.sort((a,b)=> (b.fecha<a.fecha?-1:b.fecha>a.fecha?1:0) || (b.id-a.id));
  return { cuenta, movimientos:out, totalIngresos:Math.round(totalIng), totalEgresos:Math.round(totalEgr), neto:Math.round(totalIng-totalEgr), count:out.length };
}
