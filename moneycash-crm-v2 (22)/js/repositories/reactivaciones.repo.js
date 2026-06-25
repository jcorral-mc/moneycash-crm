// Repositorio de Reactivaciones — lee cartera + desglose.
import { db } from '../lib/supabase.js';
async function todo(tabla, cols) {
  let all=[], from=0, page=1000;
  for (let i=0;i<15;i++){ const { data } = await db.from(tabla).select(cols).range(from, from+page-1); const d=data||[]; all=all.concat(d); if(d.length<page) break; from+=page; }
  return all;
}
export async function cargarReactivaciones() {
  const [cartera, desglose] = await Promise.all([
    todo('cartera','nombre,ejecutivo,capital,saldo,vencimiento,frecuencia'),
    todo('desglose','cliente,fecha'),
  ]);
  return { cartera, desglose };
}
