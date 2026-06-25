// Repositorio de Aplicación de Pagos
import { db } from '../lib/supabase.js';
import { logAudit } from '../lib/audit.js';

export async function fetchPendientesByCliente(cliente) {
  const { data } = await db.from('pagos_pendientes').select('*').ilike('cliente', cliente).eq('estatus','PENDIENTE');
  return data || [];
}
export async function fetchBancos() {
  const { data } = await db.from('bancos').select('id,cuenta').eq('activo', true).order('cuenta');
  return data || [];
}
export async function insertPendiente(record) {
  const { error } = await db.from('pagos_pendientes').insert(record);
  if (error) throw error;
  return true;
}

/** Últimos pagos del cliente (desde desglose) para el resumen de la ficha de pago. */
export async function fetchUltimosPagos(cliente, n=5) {
  const { data } = await db.from('desglose').select('fecha,pago')
    .ilike('cliente', cliente).order('fecha',{ascending:false}).limit(n);
  return (data||[]).map(r => ({ fecha: fdate(r.fecha), monto: Number(r.pago)||0 }));
}

/** RÉPLICA de _descuentoVigente: liquidación con descuento autorizada HOY (lee autorizaciones). */
export async function descuentoVigente(cliente) {
  const hoy = new Date().toISOString().slice(0,10);
  const { data } = await db.from('autorizaciones')
    .select('tipo,referencia,estatus,detalle,monto,fecha')
    .ilike('referencia', '%'+cliente+'%').eq('estatus','APROBADO')
    .order('fecha', { ascending:false });
  for (const r of (data||[])) {
    const t = String(r.tipo||'').toUpperCase();
    if (t.indexOf('DESCUENTO')<0 && t.indexOf('LIQUIDA')<0) continue;
    if (String(r.detalle||'').indexOf('[VIG:'+hoy+']') >= 0) return parseFloat(r.monto)||0;
  }
  return null;
}

/** ¿Hay perdón de multa autorizado HOY para el cliente? (solicitudes_multa APROBADO con fecha de hoy) */
export async function perdonMultaVigente(cliente) {
  const hoy = new Date().toISOString().slice(0,10);
  const { data } = await db.from('solicitudes_multa').select('estatus,fecha')
    .ilike('cliente', cliente).eq('estatus','APROBADO').eq('fecha', hoy).limit(1);
  return !!(data && data.length);
}

/** RÉPLICA de solicitarQuitarMulta: registra solicitud para que gerencia la apruebe. */
export async function solicitarQuitarMulta({ cliente, ejecutivo, montoMulta, motivo }, perfil) {
  const { error } = await db.from('solicitudes_multa').insert({
    cliente, ejecutivo: ejecutivo||'', monto_multa: Number(montoMulta)||0,
    motivo: motivo||'', estatus:'PENDIENTE',
  });
  if (error) throw error;
  await logAudit(perfil, 'MULTA_SOLICITADA', cliente, motivo||'');
  return { ok:true, msg:'✅ Solicitud para quitar la multa enviada a gerencia.' };
}

/** RÉPLICA de solicitarDescuento: deja la solicitud de liquidación con descuento en la bandeja del admin. */
export async function solicitarDescuento({ cliente, motivo }, perfil) {
  const solicita = (perfil && (perfil.email||perfil.nombre)) || '';
  const { error } = await db.from('autorizaciones').insert({
    tipo:'DESCUENTO', referencia: cliente, solicita,
    detalle: motivo||'Solicitud de liquidación con descuento', estatus:'PENDIENTE',
  });
  if (error) throw error;
  await logAudit(perfil, 'DESCUENTO_SOLICITADO', cliente, motivo||'');
  return { ok:true, msg:'✅ Solicitud de descuento enviada al administrador.' };
}

function fdate(d) { return d ? new Date(d).toLocaleDateString('es-MX',{day:'2-digit',month:'2-digit',year:'2-digit'}) : ''; }
