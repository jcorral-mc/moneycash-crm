// Repositorio de Finanzas — lee lo necesario para el P&L.
import { db } from '../lib/supabase.js';

async function todo(tabla, cols) {
  let all=[], from=0, page=1000;
  for (let i=0;i<15;i++){ const { data } = await db.from(tabla).select(cols).range(from, from+page-1); const d=data||[]; all=all.concat(d); if(d.length<page) break; from+=page; }
  return all;
}
export async function cargarBalance() {
  const [desglose, movimientos, cartera, bancos] = await Promise.all([
    todo('desglose','fecha,interes,multa,capital'),
    todo('movimientos','fecha,origen,monto'),
    todo('cartera','surtimiento,comision_apertura'),
    db.from('bancos').select('cuenta,saldo_sistema').then(r=>r.data||[]),
  ]);
  return { desglose, movimientos, cartera, bancos };
}
