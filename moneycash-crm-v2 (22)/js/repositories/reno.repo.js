// Repositorio de Renovación/Reactivación — solicitudes que aprueba el gerente.
import { db } from '../lib/supabase.js';
import { logAudit } from '../lib/audit.js';
import { generarFolio } from '../services/tuberia.service.js';

/** Clientes de cartera (para el buscador de reno/react). */
export async function fetchCarteraReno() {
  let all=[], from=0, page=1000;
  for (let i=0;i<10;i++){ const { data } = await db.from('cartera').select('id,nombre,ejecutivo,saldo,capital').range(from, from+page-1); const d=data||[]; all=all.concat(d); if(d.length<page) break; from+=page; }
  return all;
}

/** Crea una solicitud de reno/react (la autoriza el gerente; NO crea prospecto aún). */
export async function crearSolicitudReno(d, cot, perfil) {
  const fila = {
    tipo:d.tipo||'RENOVACION', cliente:String(d.cliente||'').trim(), ejecutivo:String(d.ejecutivo||'').toUpperCase(),
    saldo_actual:d.saldo||0, capital:d.capital||0, monto_nuevo:cot.monto, plazo:cot.plazo, frecuencia:cot.frecuencia,
    tipo_cred:cot.tipo, comision:cot.comision, financiar:cot.financiar, abono_puntual:cot.abonoPuntual,
    abono_impuntual:cot.abonoImpuntual, deposito:cot.deposito, solicitante:(perfil&&perfil.nombre)||(perfil&&perfil.email)||d.ejecutivo,
    cotizacion_json:cot, estatus:'PENDIENTE',
  };
  const { error } = await db.from('solicitudes_reno').insert(fila);
  if (error) throw error;
  await logAudit(perfil, 'RENO_SOLICITUD', fila.cliente, fila.tipo+' '+cot.monto);
  return { ok:true, msg:'✅ Solicitud de '+fila.tipo.toLowerCase()+' enviada al gerente para autorizar.' };
}

export async function fetchSolicitudesReno(estatus) {
  let q = db.from('solicitudes_reno').select('*').order('fecha',{ascending:false});
  if (estatus) q = q.eq('estatus', estatus);
  const { data } = await q;
  return data||[];
}

/** El gerente aprueba → crea el prospecto en Tubería "Listo para Surtir". */
export async function aprobarSolicitudReno(sol, perfil) {
  const folio = generarFolio(sol.cliente, 'GDL');
  const cot = sol.cotizacion_json || {};
  const prospecto = {
    prospect_id:folio, nombre:String(sol.cliente).trim(), ejecutivo:String(sol.ejecutivo||'').toUpperCase(),
    status:'Listo para Surtir', monto:sol.monto_nuevo, plazo:sol.plazo, frecuencia:sol.frecuencia, tipo:sol.tipo_cred,
    comision:sol.comision, financiar:sol.financiar, deposito:sol.deposito, abono_puntual:sol.abono_puntual,
    abono_impuntual:sol.abono_impuntual, base_deuda:cot.montoBaseDeuda||0,
    adeudo_actual: sol.tipo==='RENOVACION' ? sol.saldo_actual : 0,
    tipo_cliente: sol.tipo, cotizacion_json:cot, notas:'Autorizado por gerente ('+sol.tipo+').',
  };
  const { error } = await db.from('prospectos').insert(prospecto);
  if (error) throw error;
  await db.from('solicitudes_reno').update({ estatus:'APROBADO', resuelto_por:(perfil&&perfil.email)||'' }).eq('id', sol.id);
  await logAudit(perfil, 'RENO_APROBADA', sol.cliente, folio);
  return { ok:true, msg:'✅ '+sol.cliente+' autorizado. Entró a Tubería como "Listo para Surtir".' };
}

export async function rechazarSolicitudReno(sol, motivo, perfil) {
  await db.from('solicitudes_reno').update({ estatus:'RECHAZADO', resuelto_por:(perfil&&perfil.email)||'', notas:(motivo||'') }).eq('id', sol.id);
  await logAudit(perfil, 'RENO_RECHAZADA', sol.cliente, motivo||'');
  return { ok:true, msg:'Solicitud rechazada.' };
}

export async function contarSolicitudesReno() {
  const { count } = await db.from('solicitudes_reno').select('id',{count:'exact',head:true}).eq('estatus','PENDIENTE');
  return count||0;
}
