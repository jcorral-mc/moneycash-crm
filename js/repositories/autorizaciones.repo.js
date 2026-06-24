// Repositorio de Autorizaciones — bandeja unificada; aprobar/rechazar despacha por tipo.
import { db } from '../lib/supabase.js';
import { logAudit } from '../lib/audit.js';
import { aprobarAutorizacion as aprobarBanco, rechazarAutorizacion as rechazarBanco } from './bancos.repo.js';
import { TIPOS_BANCO } from '../services/autorizaciones.service.js';

export async function fetchPendientes() {
  const [{ data:auts }, { data:multas }] = await Promise.all([
    db.from('autorizaciones').select('*').eq('estatus','PENDIENTE').order('created_at',{ascending:true}),
    db.from('solicitudes_multa').select('*').eq('estatus','PENDIENTE').order('created_at',{ascending:true}),
  ]);
  return { autorizaciones: auts||[], solicitudesMulta: multas||[] };
}

export async function aprobar(item, perfil) {
  if (item.kind === 'multa') {
    await db.from('solicitudes_multa').update({ estatus:'APROBADO' }).eq('id', item.id);
    await logAudit(perfil, 'MULTA_APROBADA', item.raw.cliente||'', item.descripcion);
    return { ok:true, msg:'✅ Multa autorizada. Se cobrará al conciliar el pago.' };
  }
  // autorización: banco → ejecuta; otras → marca aprobada
  if (item.esBanco || TIPOS_BANCO.includes(String(item.tipo).toUpperCase())) {
    await aprobarBanco(item.raw, perfil);
    return { ok:true, msg:'✅ Autorización aprobada y ejecutada.' };
  }
  await db.from('autorizaciones').update({ estatus:'APROBADO', resuelto_por:(perfil&&perfil.email)||'' }).eq('id', item.id);
  await logAudit(perfil, 'AUTORIZACION_APROBADA', item.tipo, item.descripcion);
  return { ok:true, msg:'✅ Autorización aprobada.' };
}

export async function rechazar(item, perfil) {
  if (item.kind === 'multa') {
    await db.from('solicitudes_multa').update({ estatus:'RECHAZADO' }).eq('id', item.id);
    await logAudit(perfil, 'MULTA_RECHAZADA', item.raw.cliente||'', item.descripcion);
    return { ok:true, msg:'Multa rechazada.' };
  }
  if (item.esBanco || TIPOS_BANCO.includes(String(item.tipo).toUpperCase())) { await rechazarBanco(item.id, perfil); return { ok:true, msg:'Autorización rechazada.' }; }
  await db.from('autorizaciones').update({ estatus:'RECHAZADO', resuelto_por:(perfil&&perfil.email)||'' }).eq('id', item.id);
  await logAudit(perfil, 'AUTORIZACION_RECHAZADA', item.tipo, item.descripcion);
  return { ok:true, msg:'Autorización rechazada.' };
}

/** Conteo total de pendientes (autorizaciones + multas), para el badge del inicio. */
export async function contarPendientes() {
  const [{ count:a }, { count:m }] = await Promise.all([
    db.from('autorizaciones').select('*',{count:'exact',head:true}).eq('estatus','PENDIENTE'),
    db.from('solicitudes_multa').select('*',{count:'exact',head:true}).eq('estatus','PENDIENTE'),
  ]);
  return (a||0) + (m||0);
}
