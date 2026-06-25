// Repositorio de Alta de cliente (escribe cartera + calendarios ligados por FK)
import { db } from '../lib/supabase.js';
import { agregarMovimientoBanco } from './bancos.repo.js';

export async function existeCliente(nombre) {
  const { data } = await db.from('cartera').select('id').ilike('nombre', nombre).maybeSingle();
  return !!data;
}

/** Lista de ejecutivos activos (para el selector del alta). */
export async function fetchEjecutivos() {
  const { data } = await db.from('perfiles').select('nombre,ejecutivo,rol,activo').order('ejecutivo');
  const set = new Set();
  for (const p of (data || [])) {
    if (p.activo === false) continue;
    if (String(p.rol || '').toUpperCase() !== 'EJECUTIVO') continue;
    const e = String(p.ejecutivo || p.nombre || '').trim();
    if (e) set.add(e);
  }
  return [...set].sort();
}

/** Réplica de altaEnviarACartera: inserta cartera y su calendario ligado por cartera_id.
 *  Si se indica `disp` { banco, monto }, descuenta la dispersión de ese banco (egreso). */
export async function crearAlta(cartera, calendarioRows, disp, perfil) {
  const { data, error } = await db.from('cartera').insert(cartera).select('id').single();
  if (error) throw error;
  const carteraId = data.id;
  const rows = calendarioRows.map(r => ({ ...r, cartera_id: carteraId }));
  const { error: e2 } = await db.from('calendarios').insert(rows);
  if (e2) throw e2;
  if (disp && disp.banco && Number(disp.monto) > 0) {
    await agregarMovimientoBanco({
      tipo: 'EGRESO', cuenta: disp.banco, monto: Number(disp.monto),
      concepto: 'Dispersión de crédito · ' + (cartera.nombre || ''), subconcepto: '',
      origen: 'DISPERSION', obs: '', fecha: new Date().toISOString().slice(0, 10),
    }, perfil);
  }
  return carteraId;
}
