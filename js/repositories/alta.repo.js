// Repositorio de Alta de cliente (escribe cartera + calendarios ligados por FK)
import { db } from '../lib/supabase.js';

export async function existeCliente(nombre) {
  const { data } = await db.from('cartera').select('id').ilike('nombre', nombre).maybeSingle();
  return !!data;
}

/** Réplica de altaEnviarACartera: inserta cartera y su calendario ligado por cartera_id. */
export async function crearAlta(cartera, calendarioRows) {
  const { data, error } = await db.from('cartera').insert(cartera).select('id').single();
  if (error) throw error;
  const carteraId = data.id;
  const rows = calendarioRows.map(r => ({ ...r, cartera_id: carteraId }));
  const { error: e2 } = await db.from('calendarios').insert(rows);
  if (e2) throw e2;
  return carteraId;
}
