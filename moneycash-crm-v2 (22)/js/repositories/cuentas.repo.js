// Repositorio de Cuentas — CxP (tabla cxp) + CxC (cartera/calendarios).
import { db } from '../lib/supabase.js';
import { logAudit } from '../lib/audit.js';
import { agregarMovimientoBanco } from './bancos.repo.js';

const money = n => '$'+Number(n||0).toLocaleString('es-MX',{maximumFractionDigits:0});

export async function fetchCxP() {
  const { data } = await db.from('cxp').select('*').order('vencimiento');
  return data || [];
}
export async function guardarCxP(d, perfil) {
  if (!String(d.concepto||'').trim()) throw new Error('Falta el concepto.');
  const monto = parseFloat(d.monto)||0; if (monto<=0) throw new Error('Monto inválido.');
  const fila = { concepto:String(d.concepto).trim(), proveedor:String(d.proveedor||''), monto, vencimiento:d.vencimiento||null, notas:String(d.notas||'') };
  if (d.id) { await db.from('cxp').update(fila).eq('id', d.id); await logAudit(perfil,'CXP_EDITAR',fila.concepto,money(monto)); return { ok:true, msg:'Cuenta actualizada.' }; }
  fila.estatus='PENDIENTE'; fila.registrado_por=(perfil&&perfil.email)||'';
  const { error } = await db.from('cxp').insert(fila); if (error) throw error;
  await logAudit(perfil,'CXP_ALTA',fila.concepto,money(monto));
  return { ok:true, msg:'✅ Cuenta por pagar registrada.' };
}
/** Pagar una CxP: marca PAGADO y saca el dinero del banco (EGRESO). */
export async function pagarCxP(cuenta, banco, perfil) {
  await db.from('cxp').update({ estatus:'PAGADO', pagado_fecha:new Date().toISOString().slice(0,10), banco }).eq('id', cuenta.id);
  if (banco) await agregarMovimientoBanco({ tipo:'EGRESO', cuenta:banco, monto:cuenta.monto, concepto:'CxP: '+cuenta.concepto, origen:'CXP', obs:cuenta.proveedor||'' }, perfil);
  await logAudit(perfil,'CXP_PAGADA',cuenta.concepto,money(cuenta.monto)+' · '+banco);
  return { ok:true, msg:'✅ Cuenta pagada: '+money(cuenta.monto) };
}
export async function bajaCxP(id, perfil) {
  await db.from('cxp').delete().eq('id', id);
  await logAudit(perfil,'CXP_BAJA',String(id),'');
  return { ok:true, msg:'Cuenta eliminada.' };
}
