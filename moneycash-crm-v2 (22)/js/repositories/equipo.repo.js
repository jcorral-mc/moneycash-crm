// Repositorio de Equipo/Usuarios — gestiona la tabla perfiles.
import { db } from '../lib/supabase.js';
import { logAudit } from '../lib/audit.js';
import { validarPerfil } from '../services/equipo.service.js';

export async function fetchPerfiles() {
  const { data } = await db.from('perfiles').select('*').order('nombre');
  return data || [];
}

/** Alta o edición de un perfil (upsert por email). */
export async function guardarPerfil(d, perfil) {
  const v = validarPerfil(d);
  if (d.id) {
    const { error } = await db.from('perfiles').update({ nombre:v.nombre, rol:v.rol, ejecutivo:v.ejecutivo }).eq('id', d.id);
    if (error) throw error;
    await logAudit(perfil, 'EQUIPO_EDITAR', v.email, `${v.rol}${v.ejecutivo?(' · '+v.ejecutivo):''}`);
    return { ok:true, msg:'✅ Usuario actualizado.' };
  }
  // alta: insertar; si el email ya existe, avisar
  const { error } = await db.from('perfiles').insert({ email:v.email, nombre:v.nombre, rol:v.rol, ejecutivo:v.ejecutivo, activo:true });
  if (error) {
    if (String(error.message||'').toLowerCase().includes('duplicate')) throw new Error('Ya existe un usuario con ese correo.');
    throw error;
  }
  await logAudit(perfil, 'EQUIPO_ALTA', v.email, `${v.rol}${v.ejecutivo?(' · '+v.ejecutivo):''}`);
  return { ok:true, msg:'✅ Usuario dado de alta. Recuerda crear su acceso (login) en Supabase → Authentication.', recordarAuth:true };
}

export async function cambiarActivo(perfilRow, activo, admin) {
  const { error } = await db.from('perfiles').update({ activo }).eq('id', perfilRow.id);
  if (error) throw error;
  await logAudit(admin, activo?'EQUIPO_REACTIVAR':'EQUIPO_BAJA', perfilRow.email, '');
  return { ok:true, msg: activo ? 'Usuario reactivado.' : 'Usuario dado de baja.' };
}
