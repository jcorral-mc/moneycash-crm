// Lógica de Cuentas — CxP (por pagar, tabla cxp) y CxC (por cobrar, derivado de cartera).
const enDias = fecha => { if(!fecha) return null; const f=new Date(fecha); f.setHours(0,0,0,0); const h=new Date(); h.setHours(0,0,0,0); return Math.round((f-h)/86400000); };

/** CxP: lista pendiente + total + próximos a vencer. */
export function construirCxP(cxp) {
  const lista = (cxp||[]).map(r => ({
    id:r.id, concepto:String(r.concepto||''), proveedor:String(r.proveedor||''),
    monto:Number(r.monto)||0, vencimiento:r.vencimiento?String(r.vencimiento).slice(0,10):'',
    diasVenc:enDias(r.vencimiento), estatus:String(r.estatus||'PENDIENTE'), banco:String(r.banco||''),
  }));
  const pendientes = lista.filter(x=>x.estatus==='PENDIENTE');
  const totalPendiente = pendientes.reduce((s,x)=>s+x.monto,0);
  const vencidas = pendientes.filter(x=>x.diasVenc!==null && x.diasVenc<0);
  pendientes.sort((a,b)=> (a.diasVenc==null?1:0)-(b.diasVenc==null?1:0) || (a.diasVenc-b.diasVenc));
  return { pendientes, pagadas:lista.filter(x=>x.estatus==='PAGADO'), totalPendiente:Math.round(totalPendiente), totalVencido:Math.round(vencidas.reduce((s,x)=>s+x.monto,0)), nVencidas:vencidas.length };
}

/** CxC: por cobrar derivado de la cartera (saldo) con aging por días de atraso. */
export function construirCxC(carteraRows, calByCliente, rol, ejecutivo) {
  const hoy = new Date(); hoy.setHours(0,0,0,0);
  const GRACIA = 3;
  let total=0, vigente=0, vencido=0; const buckets={ '0':0,'1-7':0,'8-15':0,'16-30':0,'+30':0 };
  for (const c of (carteraRows||[])) {
    if (rol==='EJECUTIVO' && ejecutivo && String(c.ejecutivo||'').toUpperCase()!==String(ejecutivo).toUpperCase()) continue;
    const saldo = Number(c.saldo)||0; if (saldo<=0) continue;
    total += saldo;
    const cal = (calByCliente && (calByCliente[c.nombre]||calByCliente[String(c.nombre||'').toUpperCase()])) || [];
    let maxAtraso = 0;
    for (const p of cal) {
      if (String(p.estatus||'').toUpperCase().indexOf('PAGADO')>=0) continue;
      if (!p.fecha) continue;
      const f=new Date(p.fecha); f.setHours(0,0,0,0);
      const d=Math.floor((hoy-f)/86400000);
      if (d>GRACIA && d>maxAtraso) maxAtraso=d;
    }
    if (maxAtraso<=0) { vigente += saldo; buckets['0']+=saldo; }
    else {
      vencido += saldo;
      if (maxAtraso<=7) buckets['1-7']+=saldo; else if (maxAtraso<=15) buckets['8-15']+=saldo;
      else if (maxAtraso<=30) buckets['16-30']+=saldo; else buckets['+30']+=saldo;
    }
  }
  const r = {}; Object.keys(buckets).forEach(k=>r[k]=Math.round(buckets[k]));
  return { total:Math.round(total), vigente:Math.round(vigente), vencido:Math.round(vencido), buckets:r };
}
