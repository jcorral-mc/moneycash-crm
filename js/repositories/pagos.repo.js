// Repositorio de Aplicación de Pagos
import { db } from '../lib/supabase.js';

export async function fetchPendientesByCliente(cliente) {
  const { data } = await db.from('pagos_pendientes').select('*').ilike('cliente', cliente).eq('estatus','PENDIENTE');
  return data || [];
}
export async function fetchBancos() {
  const { data } = await db.from('bancos').select('id,cuenta').eq('activo', true);
  return data || [];
}
export async function insertPendiente(record) {
  const { error } = await db.from('pagos_pendientes').insert(record);
  if (error) throw error;
  return true;
}
