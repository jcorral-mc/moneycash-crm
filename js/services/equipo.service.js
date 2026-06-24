// Lógica de Equipo/Usuarios — gestión de perfiles (rol, ejecutivo asignado).
import { ROLES } from '../config.js';

export const ROLES_LISTA = Object.keys(ROLES);   // ADMIN, GERENTE, EJECUTIVO, AUX_ADMIN, JURIDICO, VISITAS
export { ROLES };

const reEmail = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** Valida y normaliza un perfil. Lanza Error si algo falta. */
export function validarPerfil(d) {
  const email = String(d.email||'').trim().toLowerCase();
  if (!reEmail.test(email)) throw new Error('Correo inválido.');
  const nombre = String(d.nombre||'').trim();
  if (!nombre) throw new Error('Falta el nombre.');
  const rol = String(d.rol||'').toUpperCase();
  if (!ROLES_LISTA.includes(rol)) throw new Error('Rol inválido.');
  // El ejecutivo (nombre para filtrar cartera) solo aplica al rol EJECUTIVO
  let ejecutivo = String(d.ejecutivo||'').trim().toUpperCase();
  if (rol === 'EJECUTIVO') { if (!ejecutivo) throw new Error('Indica el nombre del ejecutivo (para filtrar su cartera).'); }
  else ejecutivo = '';
  return { email, nombre, rol, ejecutivo: ejecutivo || null };
}

/** Ordena/agrupa los perfiles para mostrarlos (activos primero, por rol). */
export function construirLista(perfiles) {
  const orden = { ADMIN:0, GERENTE:1, AUX_ADMIN:2, JURIDICO:3, VISITAS:4, EJECUTIVO:5 };
  const lista = (perfiles||[]).map(p => ({
    id:p.id, email:String(p.email||''), nombre:String(p.nombre||''), rol:String(p.rol||''),
    ejecutivo:String(p.ejecutivo||''), activo:p.activo!==false,
  })).sort((a,b)=> (a.activo===b.activo ? ((orden[a.rol]??9)-(orden[b.rol]??9) || a.nombre.localeCompare(b.nombre)) : (a.activo?-1:1)));
  const activos = lista.filter(p=>p.activo).length;
  return { perfiles:lista, total:lista.length, activos };
}
