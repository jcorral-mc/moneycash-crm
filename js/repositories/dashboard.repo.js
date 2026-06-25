// Repositorio del Dashboard
import { db } from '../lib/supabase.js';

export async function fetchCarteraResumen() {
  const { data } = await db.from('cartera').select('nombre,saldo,capital,ejecutivo,estatus,saldo_capital,saldo_interes,pct_cap');
  return data || [];
}
export async function fetchDesgloseMes() {
  const ini = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0,10);
  const { data } = await db.from('desglose').select('pago,interes,fecha,ejecutivo').gte('fecha', ini);
  return data || [];
}
export async function contarPendientesConciliar() {
  const { count } = await db.from('pagos_pendientes').select('*',{count:'exact',head:true}).eq('estatus','PENDIENTE');
  return count || 0;
}
export async function contarSolicitudes() {
  const { count } = await db.from('autorizaciones').select('*',{count:'exact',head:true}).eq('estatus','PENDIENTE');
  return count || 0;
}

/** Cuenta casos EN REVISION (alerta del gerente en el inicio). */
export async function contarCasosRevision() {
  try {
    const { count } = await db.from('revision_cobranza').select('*',{count:'exact',head:true}).eq('estatus','EN REVISION');
    return count || 0;
  } catch(e){ return 0; }
}
