// Repositorio de Movimientos — registra gasto/nómina/interés/diligencia/entrada y afecta banco.
import { db } from '../lib/supabase.js';
import { agregarMovimientoBanco } from './bancos.repo.js';
import { validarMovimiento, MOV_TIPOS } from '../services/movimientos.service.js';
import { logAudit } from '../lib/audit.js';

/** RÉPLICA de registrarMovimiento: valida, afecta banco (egreso/ingreso), audita. */
export async function registrarMovimiento(d, perfil) {
  const v = validarMovimiento(d);
  await agregarMovimientoBanco({
    tipo: v.efecto, cuenta: v.cuenta, monto: v.monto, concepto: v.concepto,
    subconcepto: v.subconcepto, origen: v.tipo, obs: d.descripcion||d.obs||'', fecha: v.fecha,
  }, perfil);
  await logAudit(perfil, 'MOVIMIENTO_'+v.tipo.replace(/ /g,'_'), v.cuenta, `${v.efecto} $${v.monto} · ${v.concepto}`);
  return { ok:true, msg:`✅ ${v.tipo} de $${v.monto.toLocaleString('es-MX')} registrado y aplicado a ${v.cuenta}.` };
}

/** Movimientos de gasto/operación (los 6 tipos), para el módulo Movimientos. */
export async function fetchMovimientos() {
  const tipos = MOV_TIPOS.map(t => t.tipo);
  let all=[], from=0, page=1000;
  for (let i=0;i<10;i++) {
    const { data } = await db.from('movimientos').select('*').in('origen', tipos).order('fecha',{ascending:false}).range(from, from+page-1);
    const d = data||[]; all = all.concat(d); if (d.length<page) break; from+=page;
  }
  return all;
}

/** Movimientos de un banco (reversables): para el flujo de reverso. */
export async function movListarPorBanco(banco, n=40) {
  const { data } = await db.from('movimientos').select('*')
    .ilike('cuenta', banco).order('fecha',{ascending:false}).limit(n);
  return (data||[]).filter(m => !m.reversado).map(m => ({
    id:m.id, fecha:String(m.fecha||'').slice(0,10), tipo:String(m.origen||m.tipo||''),
    subconcepto:String(m.subconcepto||''), concepto:String(m.concepto||''), monto:Number(m.monto)||0,
  }));
}

/** RÉPLICA de solicitarReversoMov: deja la solicitud de reverso para que el admin la autorice. */
export async function solicitarReversoMov({ movId, banco, fecha, concepto, monto, motivo }, perfil) {
  const solicita = (perfil && (perfil.email||perfil.nombre)) || '';
  const detalle = `${motivo||'Reverso solicitado'} · ${fecha} · ${concepto} · $${Number(monto)||0} [MOVID:${movId}]`;
  const { error } = await db.from('autorizaciones').insert({
    tipo:'REVERSO MOVIMIENTO', referencia: banco, solicita, detalle, estatus:'PENDIENTE',
  });
  if (error) throw error;
  await logAudit(perfil, 'REVERSO_SOLICITADO', banco, detalle);
  return { ok:true, msg:'Solicitud de reverso enviada al administrador.' };
}

/** Subconceptos (personas) ya usados por tipo — para autocompletar empleados/inversionistas. */
export async function personasUsadas(tipo) {
  const { data } = await db.from('movimientos').select('subconcepto').eq('origen', tipo).not('subconcepto','is',null);
  const set = new Set(); (data||[]).forEach(r => { const s=String(r.subconcepto||'').trim(); if (s) set.add(s); });
  return [...set].sort();
}
