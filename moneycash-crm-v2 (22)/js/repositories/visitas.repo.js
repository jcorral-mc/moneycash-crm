// Repositorio de Visitas — asignar, resolver, historial. RÉPLICA de asignarVisita/resolverVisita.
import { db } from '../lib/supabase.js';
import { logAudit } from '../lib/audit.js';
import { validarAsignacion } from '../services/visitas.service.js';
import { subirFotos } from '../lib/storage.js';

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

/** RÉPLICA de resolverVisita: marca REALIZADA + sube evidencias + deja comentario en la bitácora. */
export async function resolverVisita(visita, d, perfil) {
  let urls = [];
  if (d.fotos && d.fotos.length) urls = await subirFotos(d.fotos, 'visitas');
  const { error } = await db.from('visitas').update({
    estatus:'REALIZADA', resultado:String(d.resultado||''), hora_visita:String(d.horaVisita||''),
    comentarios:String(d.comentarios||''), fotos:urls.join(','), resuelve:(perfil&&perfil.email)||'',
  }).eq('id', visita.id);
  if (error) throw error;

  const resV = (d.resultado||'') + (d.comentarios ? (' — '+d.comentarios) : '');
  if (visita.tipo === 'COBRANZA' && visita.cliente) {
    try { await db.from('comentarios_cobranza').insert({ cliente:visita.cliente, autor:(perfil&&perfil.email)||'', estado:'VISITA', comentario:resV }); } catch(e){}
  } else if (visita.tipo === 'JURIDICO' && visita.cliente) {
    try { await db.from('cartera_juridico_bitacora').insert({ cliente:visita.cliente, autor:((perfil&&perfil.email)||'')+' (visita)', nota:resV + (d.horaVisita?(' · '+d.horaVisita):'') }); } catch(e){}
  }
  await logAudit(perfil, 'VISITA_REALIZADA', visita.cliente, `${visita.tipo} · ${d.resultado||''}`);
  return { ok:true, msg:`✅ Visita marcada como realizada${urls.length?(' ('+urls.length+' foto'+(urls.length>1?'s':'')+')'):''}.` };
}

/** Verificación domiciliaria: aprueba/rechaza con checklist (cliente+aval) y evidencias. */
export async function resolverVerificacion(visita, d, perfil) {
  let urls = [];
  if (d.fotos && d.fotos.length) urls = await subirFotos(d.fotos, 'verificacion');
  const { error } = await db.from('visitas').update({
    estatus:'REALIZADA', resultado:String(d.resultado||''), checklist:String(d.checklist||''),
    comentarios:String(d.comentarios||''), fotos:urls.join(','), resuelve:(perfil&&perfil.email)||'',
  }).eq('id', visita.id);
  if (error) throw error;
  await logAudit(perfil, 'VERIFICACION_RESUELTA', visita.cliente, `${d.resultado||''} · ${urls.length} foto(s)`);
  return { ok:true, msg: d.resultado==='APROBADO' ? '✅ Verificación APROBADA. El crédito pasa a Listo para Surtir.' : 'Verificación rechazada.' };
}

/** Guarda el avance del titular sin cerrar (para retomar el aval después). */
export async function guardarAvanceTitular(visita, d, perfil) {
  let urls = [];
  if (d.fotos && d.fotos.length) urls = await subirFotos(d.fotos, 'verificacion');
  const { error } = await db.from('visitas').update({
    titular_listo:true, avance_cli:String(d.checklist||''), avance_com_cli:String(d.comentarios||''), fotos:urls.join(','),
  }).eq('id', visita.id);
  if (error) throw error;
  await logAudit(perfil, 'VERIFICACION_AVANCE', visita.cliente, 'titular guardado');
  return { ok:true, msg:'Avance del titular guardado. Retoma el aval después.' };
}

/** Reprograma una visita con evidencia (sigue PENDIENTE en otra fecha). */
export async function reprogramarVisita(visita, d, perfil) {
  if (!d.nuevaFecha) throw new Error('Elige la nueva fecha.');
  let urls = [];
  if (d.fotos && d.fotos.length) urls = await subirFotos(d.fotos, 'reprog');
  const { error } = await db.from('visitas').update({
    fecha:d.nuevaFecha, horarios:d.nuevoHorario||visita.horarios, fotos:urls.join(','),
  }).eq('id', visita.id);
  if (error) throw error;
  const nota = 'Reprogramada para '+d.nuevaFecha+(d.motivo?(' · '+d.motivo):'');
  if (visita.tipo === 'COBRANZA' && visita.cliente) { try { await db.from('comentarios_cobranza').insert({ cliente:visita.cliente, autor:(perfil&&perfil.email)||'', estado:'REPROGRAMADA', comentario:nota }); } catch(e){} }
  await logAudit(perfil, 'VISITA_REPROGRAMADA', visita.cliente, nota);
  return { ok:true, msg:'Visita reprogramada con evidencia.' };
}
