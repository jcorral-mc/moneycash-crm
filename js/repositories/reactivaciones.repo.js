// Repositorio de Reactivaciones — lee cartera + desglose.
import { db } from '../lib/supabase.js';
import { logAudit } from '../lib/audit.js';
async function todo(tabla, cols) {
  let all=[], from=0, page=1000;
  for (let i=0;i<15;i++){ const { data } = await db.from(tabla).select(cols).range(from, from+page-1); const d=data||[]; all=all.concat(d); if(d.length<page) break; from+=page; }
  return all;
}
export async function cargarReactivaciones() {
  const [cartera, desglose] = await Promise.all([
    todo('cartera','nombre,ejecutivo,capital,saldo,vencimiento,frecuencia'),
    todo('desglose','cliente,fecha'),
  ]);
  return { cartera, desglose };
}

/** Gestión de reactivación: comentarios y opinión sobre reactivar a un cliente. */
export async function fetchComentariosReactivacion(cliente) {
  const { data } = await db.from('reactivaciones').select('*').ilike('cliente', cliente).order('created_at', { ascending:false });
  return data || [];
}
export async function agregarComentarioReactivacion({ cliente, comentario, opinion }, perfil) {
  if (!String(cliente||'').trim()) throw new Error('Falta el cliente.');
  if (!String(comentario||'').trim()) throw new Error('Escribe un comentario.');
  const { error } = await db.from('reactivaciones').insert({
    cliente:String(cliente).trim(), comentario:String(comentario).trim(), opinion:opinion||'',
    por:(perfil&&perfil.email)||'', fecha:new Date().toISOString().slice(0,10),
  });
  if (error) throw error;
  await logAudit(perfil, 'REACTIVACION_GESTION', cliente, opinion||'');
  return { ok:true, msg:'Comentario guardado.' };
}
