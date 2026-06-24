// Lógica de Desglose — consulta de cobros con filtros (mes, ejecutivo, cliente).
import { norm } from '../lib/dom.js';
const enMes = (fecha, yyMM) => !yyMM || String(fecha||'').slice(0,7) === yyMM;

export function construirDesglose(desglose, filtros={}, rol, ejecutivoSesion) {
  const { yyMM='', ejecutivo='', cliente='' } = filtros;
  const forzarEjec = (rol==='EJECUTIVO') ? ejecutivoSesion : null;
  const lista = [];
  let tPago=0, tCap=0, tInt=0, tMulta=0;
  const ejecsSet = new Set();
  for (const r of (desglose||[])) {
    if (r.ejecutivo) ejecsSet.add(String(r.ejecutivo));
    if (!enMes(r.fecha, yyMM)) continue;
    if (forzarEjec && norm(r.ejecutivo)!==norm(forzarEjec)) continue;
    if (ejecutivo && norm(r.ejecutivo)!==norm(ejecutivo)) continue;
    if (cliente && norm(r.cliente).indexOf(norm(cliente))<0) continue;
    const pago=Number(r.pago)||0, cap=Number(r.capital)||0, int=Number(r.interes)||0, multa=Number(r.multa)||0;
    tPago+=pago; tCap+=cap; tInt+=int; tMulta+=multa;
    lista.push({ fecha:String(r.fecha||'').slice(0,10), cliente:String(r.cliente||''), ejecutivo:String(r.ejecutivo||''),
      pago:Math.round(pago), capital:Math.round(cap), interes:Math.round(int), multa:Math.round(multa), tipo:String(r.tipo||''), formaPago:String(r.forma_pago||'') });
  }
  lista.sort((a,b)=> a.fecha<b.fecha?1:a.fecha>b.fecha?-1:0);
  return {
    lista, total:lista.length,
    totales:{ pago:Math.round(tPago), capital:Math.round(tCap), interes:Math.round(tInt), multa:Math.round(tMulta) },
    ejecutivos:[...ejecsSet].sort(),
  };
}
