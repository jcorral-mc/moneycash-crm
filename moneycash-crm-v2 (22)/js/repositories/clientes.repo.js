// Repositorio de datos para Clientes (acceso a Supabase)
import { db } from '../lib/supabase.js';

/** Toda la cartera (RLS filtra por ejecutivo a nivel DB; el service replica además la regla del Script). */
export async function fetchCartera() {
  const { data } = await db.from('cartera').select('*').order('saldo', { ascending:false });
  return data || [];
}

/** Todo CALENDARIOS una sola vez (como el Script pre-carga). Paginado. */
export async function fetchAllCalendarios() {
  let all = [], from = 0, page = 1000;
  for (let i=0;i<8;i++) {
    const { data } = await db.from('calendarios')
      .select('cartera_id,id_credito,cliente,n_pago,fecha,monto_puntual,monto_impuntual,capital,interes,pagado,estatus,multa')
      .range(from, from+page-1);
    const d = data || [];
    all = all.concat(d);
    if (d.length < page) break;
    from += page;
  }
  return all;
}

export async function fetchCalendarioCliente(cliente) {
  const { data } = await db.from('calendarios').select('*').ilike('cliente', cliente).order('n_pago', { ascending:true });
  return data || [];
}

export async function fetchComentarios(cliente) {
  const { data } = await db.from('comentarios_cobranza').select('*').ilike('cliente', cliente).order('fecha', { ascending:false });
  return data || [];
}

/** Réplica de _descuentoVigente: descuento de liquidación autorizado HOY para el cliente. */
export async function descuentoVigente(cliente) {
  const hoy = new Date().toISOString().slice(0,10);
  const { data } = await db.from('autorizaciones')
    .select('tipo,referencia,estatus,detalle,monto,fecha')
    .ilike('referencia', '%'+cliente+'%').eq('estatus','APROBADO')
    .order('fecha', { ascending:false });
  for (const r of (data||[])) {
    if (String(r.tipo||'').toUpperCase().indexOf('DESCUENTO') < 0 && String(r.tipo||'').toUpperCase().indexOf('LIQUIDA') < 0) continue;
    if (String(r.detalle||'').indexOf('[VIG:'+hoy+']') >= 0) return parseFloat(r.monto)||0;
  }
  return null;
}
