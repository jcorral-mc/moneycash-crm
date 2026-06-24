// Repositorio de Visitas — asignar, resolver, historial. RÉPLICA de asignarVisita/resolverVisita.
import { db } from '../lib/supabase.js';
import { logAudit } from '../lib/audit.js';
import { validarAsignacion } from '../services/visitas.service.js';

export async function fetchVisitas() {
  let all=[], from=0, page=1000;
  for (let i=0;i<10;i++) {
    const { data } = await db.from('visitas').select('*').order('fecha',{ascending:false}).range(from, from+page-1);
    const d = data||[]; all = all.concat(d); if (d.length<page) break; from+=page;
  }
  return all;
}

/** RÉPLICA de asignarVisita: crea la visita PENDIENTE. */
export async function asignarVisita(d, perfil) {
  const v = validarAsignacion(d, perfil.rol);
  const { error } = await db.from('visitas').insert({
    fecha:v.fecha, tipo:v.tipo, cliente:v.cliente, ref_id:v.refId, telefono:v.telefono,
    direccion:v.direccion, referencias:v.referencias, horarios:v.horarios, aval:v.aval,
    asigna:(perfil&&perfil.email)||'', estatus:'PENDIENTE', comentarios:v.comentarios,
  });
  if (error) throw error;
  await logAudit(perfil, 'VISITA_ASIGNADA', v.cliente, `${v.tipo}${v.horarios?(' · '+v.horarios):''}`);
  return { ok:true, msg:'✅ Visita asignada al verificador.' };
}

/** RÉPLICA de resolverVisita: marca REALIZADA + deja comentario en la bitácora correspondiente. */
export async function resolverVisita(visita, d, perfil) {
  const { error } = await db.from('visitas').update({
    estatus:'REALIZADA', resultado:String(d.resultado||''), hora_visita:String(d.horaVisita||''),
    comentarios:String(d.comentarios||''), resuelve:(perfil&&perfil.email)||'',
  }).eq('id', visita.id);
  if (error) throw error;

  const resV = (d.resultado||'') + (d.comentarios ? (' — '+d.comentarios) : '');
  // Cobranza → bitácora de cobranza ; Jurídico → bitácora jurídica
  if (visita.tipo === 'COBRANZA' && visita.cliente) {
    try { await db.from('comentarios_cobranza').insert({ cliente:visita.cliente, autor:(perfil&&perfil.email)||'', estado:'VISITA', comentario:resV }); } catch(e){}
  } else if (visita.tipo === 'JURIDICO' && visita.cliente) {
    try { await db.from('cartera_juridico_bitacora').insert({ cliente:visita.cliente, autor:((perfil&&perfil.email)||'')+' (visita)', nota:resV + (d.horaVisita?(' · '+d.horaVisita):'') }); } catch(e){}
  }
  await logAudit(perfil, 'VISITA_REALIZADA', visita.cliente, `${visita.tipo} · ${d.resultado||''}`);
  return { ok:true, msg:'✅ Visita marcada como realizada.' };
}
