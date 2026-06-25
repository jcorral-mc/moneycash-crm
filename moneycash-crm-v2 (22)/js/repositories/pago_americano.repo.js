// Repositorio de Pago Americano — clientes americanos, info y registro del pago.
import { db } from '../lib/supabase.js';
import { logAudit } from '../lib/audit.js';
import { fetchCalendarioCliente } from './clientes.repo.js';

const esAmericano = c => String(c.frecuencia||'').toUpperCase()==='AMERICANO' || String(c.tipo_credito||'').toUpperCase()==='AMERICANO';

/** Clientes americanos activos con saldo. */
export async function fetchClientesAmericanos(perfil) {
  const { data } = await db.from('cartera').select('*').eq('estatus','ACTIVO').gt('saldo',0);
  let rows = (data||[]).filter(esAmericano);
  if (perfil && perfil.rol==='EJECUTIVO') {
    const ej = String(perfil.ejecutivo||'').toUpperCase();
    rows = rows.filter(c => String(c.ejecutivo||'').toUpperCase()===ej);
  }
  return rows;
}

/** Fila de cartera + calendario de un cliente americano. */
export async function fetchAmericano(nombre) {
  const { data } = await db.from('cartera').select('*').ilike('nombre', nombre).limit(1);
  const row = (data && data[0]) || null;
  if (!row) return { row:null, cal:[] };
  const cal = await fetchCalendarioCliente(nombre);
  return { row, cal };
}

export async function fetchBancos() {
  const { data } = await db.from('bancos').select('cuenta').eq('activo', true).order('cuenta');
  return (data||[]).map(b => b.cuenta);
}

/** Registra el pago americano como PENDIENTE (se aplica al conciliar). */
export async function registrarPagoAmericano(record, perfil) {
  const { error } = await db.from('pagos_pendientes').insert(record);
  if (error) throw error;
  await logAudit(perfil, 'PAGO_AMERICANO', record.cliente, record.tipo+' '+record.monto);
  return { ok:true, msg:'Pago americano registrado. Queda PENDIENTE de conciliar.' };
}
