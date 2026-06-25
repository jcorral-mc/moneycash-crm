// Repositorio del Balance del mes ("cómo vamos"): lee desglose, movimientos y cartera.
import { db } from '../lib/supabase.js';

async function todo(tabla, cols) {
  let all = [], from = 0, page = 1000;
  for (let i = 0; i < 15; i++) {
    const { data } = await db.from(tabla).select(cols).range(from, from + page - 1);
    const d = data || []; all = all.concat(d); if (d.length < page) break; from += page;
  }
  return all;
}

export async function cargarBalanceMes() {
  const [desglose, movimientos, cartera] = await Promise.all([
    todo('desglose', 'fecha,cliente,ejecutivo,interes,multa,tipo'),
    todo('movimientos', 'fecha,origen,monto,concepto,subconcepto'),
    todo('cartera', 'surtimiento,comision_apertura,nombre,ejecutivo'),
  ]);
  return { desglose, movimientos, cartera };
}
