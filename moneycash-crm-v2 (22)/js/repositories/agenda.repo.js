// Repositorio de Agenda — eventos y recordatorios.
import { db } from '../lib/supabase.js';
import { logAudit } from '../lib/audit.js';

export async function fetchAgenda() {
  const { data } = await db.from('agenda').select('*').order('fecha',{ascending:true});
  return data||[];
}
export async function agregarEvento(d, perfil) {
  if (!d.titulo || !d.fecha) throw new Error('Falta título o fecha.');
  const { error } = await db.from('agenda').insert({
    titulo:String(d.titulo).trim(), tipo:d.tipo||'MANUAL', fecha:d.fecha, notas:d.notas||'', cliente:d.cliente||'',
    completado:false, creado_por:(perfil&&perfil.email)||'',
  });
  if (error) throw error;
  await logAudit(perfil, 'AGENDA_ALTA', d.tipo||'MANUAL', d.titulo);
  return { ok:true, msg:'Evento agregado.' };
}
export async function completarEvento(id, perfil) {
  await db.from('agenda').update({ completado:true }).eq('id', id);
  await logAudit(perfil, 'AGENDA_COMPLETA', String(id), '');
  return { ok:true, msg:'Evento completado.' };
}
