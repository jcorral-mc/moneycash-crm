// Repositorio de Cobranza
import { db } from '../lib/supabase.js';

/** agregarComentarioCobranza: historial de gestión por cliente. */
export async function insertComentario(cliente, autor, rol, estado, texto) {
  const { error } = await db.from('comentarios_cobranza').insert({
    cliente, autor, rol, estado, comentario: texto, fecha: new Date().toISOString().slice(0,10)
  });
  if (error) throw error;
}
