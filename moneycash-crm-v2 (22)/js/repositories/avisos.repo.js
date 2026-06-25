// Repositorio de Avisos — teléfonos del equipo (avisos_contactos) y eventos (avisos_eventos).
import { db } from '../lib/supabase.js';
import { logAudit } from '../lib/audit.js';

/** Usuarios activos (para listar como contactos). */
export async function fetchPerfiles() {
  const { data } = await db.from('perfiles').select('email,nombre,rol,ejecutivo,activo').order('nombre');
  return (data || []).filter(p => p.activo !== false);
}

export async function fetchContactos() {
  const { data } = await db.from('avisos_contactos').select('persona,num,activo');
  return data || [];
}

export async function fetchEventos() {
  const { data } = await db.from('avisos_eventos').select('clave,dest,activo');
  return data || [];
}

/** Guarda teléfonos: upsert por persona (email). */
export async function guardarContactos(contactos, perfil) {
  const rows = (contactos || []).map(c => ({ persona: c.persona, num: String(c.num || '').trim(), activo: c.activo !== false }));
  if (rows.length) {
    const { error } = await db.from('avisos_contactos').upsert(rows, { onConflict: 'persona' });
    if (error) throw error;
  }
  await logAudit(perfil, 'AVISOS_CONTACTOS', '', rows.length + ' teléfono(s)');
  return { ok: true };
}

/** Guarda eventos: upsert por clave. */
export async function guardarEventos(eventos, perfil) {
  const rows = (eventos || []).map(e => ({ clave: e.clave, dest: Array.isArray(e.dest) ? e.dest : [], activo: e.activo !== false }));
  if (rows.length) {
    const { error } = await db.from('avisos_eventos').upsert(rows, { onConflict: 'clave' });
    if (error) throw error;
  }
  await logAudit(perfil, 'AVISOS_EVENTOS', '', rows.length + ' evento(s)');
  return { ok: true };
}
