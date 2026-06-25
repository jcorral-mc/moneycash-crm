// Repositorio de exportación — lee tablas completas (paginado).
import { db } from '../lib/supabase.js';

async function fetchAll(tabla) {
  let all=[], from=0, page=1000;
  for (let i=0;i<20;i++) {
    const { data, error } = await db.from(tabla).select('*').range(from, from+page-1);
    if (error) throw error;
    const d = data||[]; all = all.concat(d);
    if (d.length < page) break;
    from += page;
  }
  return all;
}
export const exportCartera         = () => fetchAll('cartera');
export const exportCalendarios     = () => fetchAll('calendarios');
export const exportPagosPendientes = () => fetchAll('pagos_pendientes');
export const exportDesglose        = () => fetchAll('desglose');
export const exportMovimientos     = () => fetchAll('movimientos');
export const exportAuditoria       = () => fetchAll('auditoria');
