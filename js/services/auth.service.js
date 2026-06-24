// Servicio de autenticación y roles (módulo Login)
// Réplica de: login(usuario,password,deviceId) + lectura de rol del Script.
import { db } from '../lib/supabase.js';

export async function getSession() {
  const { data:{ session } } = await db.auth.getSession();
  return session;
}

export async function login(email, password) {
  const { data, error } = await db.auth.signInWithPassword({ email, password });
  // Bitácora de acceso (hoja ACCESOS del Script)
  try { await db.from('accesos').insert({ usuario: email, resultado: error?'FALLO':'OK', detalle: error?error.message:'' }); } catch(_) {}
  if (error) throw error;
  return data.session;
}

export async function logout() { await db.auth.signOut(); }

/** Devuelve { rol, ejecutivo, nombre, email }. Sin perfil => ADMIN (Jorge). */
export async function getPerfil(session) {
  const email = session?.user?.email || '';
  try {
    const { data } = await db.from('perfiles').select('*').eq('email', email).maybeSingle();
    if (data) return { rol:(data.rol||'EJECUTIVO').toUpperCase(), ejecutivo:data.ejecutivo||'', nombre:data.nombre||email.split('@')[0], email };
  } catch(_) {}
  return { rol:'ADMIN', ejecutivo:'', nombre:email.split('@')[0], email };
}
