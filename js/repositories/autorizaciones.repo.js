// Repositorio de Autorizaciones — bandeja unificada; aprobar/rechazar despacha por tipo.
import { db } from '../lib/supabase.js';
import { logAudit } from '../lib/audit.js';
import { aprobarAutorizacion as aprobarBanco, rechazarAutorizacion as rechazarBanco, reversarMovimiento } from './bancos.repo.js';
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
  // REVERSO DE MOVIMIENTO: ejecutar el reverso real (restituir banco)
  if (String(item.tipo).toUpperCase().indexOf('REVERSO') >= 0) {
    const mm = String(item.raw.detalle||'').match(/\[MOVID:([0-9]+)\]/);
    if (mm) {
      const { data:movs } = await db.from('movimientos').select('*').eq('id', parseInt(mm[1])).limit(1);
      if (movs && movs[0] && !movs[0].reversado) await reversarMovimiento(movs[0], perfil);
    }
    await db.from('autorizaciones').update({ estatus:'APROBADO', resuelto_por:(perfil&&perfil.email)||'' }).eq('id', item.id);
    await logAudit(perfil, 'REVERSO_APROBADO', item.descripcion, '');
    return { ok:true, msg:'✅ Reverso autorizado y aplicado. Banco restituido.' };
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

import { fetchCartera, fetchCalendarioCliente } from './clientes.repo.js';
import { construirFicha } from '../services/clientes.service.js';
import { norm, money } from '../lib/dom.js';

/** Saldo / capital / interés pendientes del cliente (para el % de condonación del descuento). */
export async function datosDescuento(cliente) {
  const [cartera, cal] = await Promise.all([fetchCartera(), fetchCalendarioCliente(cliente)]);
  const row = cartera.find(c => norm(c.nombre)===norm(cliente)) || { nombre:cliente, saldo:0 };
  const ficha = construirFicha(row, cal);
  return { saldo:ficha.saldo, capitalPend:ficha.capitalPend, interesPend:ficha.intPend };
}

/** RÉPLICA de resolverSolicitud (DESCUENTO): aprueba condonando pct% del interés.
 *  Deja la liquidación vigente HOY (descuentoVigente la detecta en Aplicar Pago). */
export async function aprobarDescuento(item, pct, datos, perfil) {
  const cond = Math.round((datos.interesPend||0) * (pct/100));
  const montoFinal = Math.max(0, Math.round((datos.saldo||0) - cond));
  const today = new Date().toISOString().slice(0,10);
  const detalle = `${item.motivo||''} [COND:${pct}%] [VIG:${today}]`.trim();
  const { error } = await db.from('autorizaciones')
    .update({ estatus:'APROBADO', monto:montoFinal, detalle, resuelto_por:(perfil&&perfil.email)||'' })
    .eq('id', item.id);
  if (error) throw error;
  await logAudit(perfil, 'DESCUENTO_APROBADO', item.cliente, `${pct}% → ${montoFinal}`);
  return { ok:true, msg:`Descuento aprobado. Liquidación de hoy: ${money(montoFinal)} (condona ${money(cond)}).` };
}
