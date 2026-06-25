// Repositorio de Desglose — lee la tabla desglose con el nombre del banco (join).
import { db } from '../lib/supabase.js';

export async function fetchDesglose() {
  let all=[], from=0, page=1000;
  for (let i=0;i<20;i++){
    const { data } = await db.from('desglose')
      .select('fecha,cliente,ejecutivo,pago,capital,interes,multa,tipo,forma_pago,bancos(cuenta)')
      .order('fecha',{ascending:false}).range(from, from+page-1);
    const d=data||[]; all=all.concat(d); if(d.length<page) break; from+=page;
  }
  // Aplanar el banco a r.cuenta (texto)
  return all.map(r => ({ ...r, cuenta: (r.bancos && r.bancos.cuenta) || '' }));
}
