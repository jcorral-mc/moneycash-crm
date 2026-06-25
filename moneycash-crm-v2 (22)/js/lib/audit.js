// Bitácora de auditoría — registra acciones críticas. Nunca rompe el flujo si falla.
import { db } from './supabase.js';

export async function logAudit(perfil, accion, entidad, detalle) {
  try {
    await db.from('auditoria').insert({
      usuario: (perfil && (perfil.email || perfil.nombre)) || '',
      rol: (perfil && perfil.rol) || '',
      accion, entidad: String(entidad||''), detalle: String(detalle||''),
    });
  } catch (e) { /* no-op: la auditoría no debe bloquear la operación */ }
}
