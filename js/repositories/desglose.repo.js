// Repositorio de Desglose — lee la tabla desglose.
import { db } from '../lib/supabase.js';
export async function fetchDesglose() {
  let all=[], from=0, page=1000;
  for (let i=0;i<20;i++){ const { data } = await db.from('desglose').select('fecha,cliente,ejecutivo,pago,capital,interes,multa,tipo,forma_pago').order('fecha',{ascending:false}).range(from, from+page-1); const d=data||[]; all=all.concat(d); if(d.length<page) break; from+=page; }
  return all;
}
