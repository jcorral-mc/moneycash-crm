// Lógica de Visitas — RÉPLICA de obtenerVisitas / asignarVisita (Apps Script).
import { norm } from '../lib/dom.js';
const U = s => String(s||'').toUpperCase();

// Tipos y quién puede asignarlos
export const VIS_TIPOS = [
  { tipo:'VERIFICACION', etiqueta:'Verificación', asigna:['ADMIN'] },   // normalmente viene de Tubería
  { tipo:'COBRANZA',     etiqueta:'Cobranza',     asigna:['GERENTE','ADMIN','AUX_ADMIN'] },
  { tipo:'JURIDICO',     etiqueta:'Jurídico',     asigna:['JURIDICO','ADMIN'] },
  { tipo:'MENSAJERIA',   etiqueta:'Mensajería',   asigna:['GERENTE','ADMIN','AUX_ADMIN'] },
];

/** Resuelve el tipo de visita que un rol puede asignar (réplica de la lógica de asignarVisita). */
export function tipoAsignable(tipoPedido, rol) {
  const t = U(tipoPedido);
  if (t === 'MENSAJERIA') return ['GERENTE','ADMIN','AUX_ADMIN'].includes(rol) ? 'MENSAJERIA' : '';
  if (t === 'JURIDICO')   return ['JURIDICO','ADMIN'].includes(rol) ? 'JURIDICO' : '';
  if (t === 'VERIFICACION') return ['ADMIN'].includes(rol) ? 'VERIFICACION' : '';
  return ['GERENTE','ADMIN','AUX_ADMIN'].includes(rol) ? 'COBRANZA' : '';
}

/** Validación de asignación. Devuelve datos normalizados o lanza Error. */
export function validarAsignacion(d, rol) {
  const tipo = tipoAsignable(d.tipo, rol);
  if (!tipo) throw new Error('No autorizado para asignar este tipo de visita.');
  if (!d.cliente || !String(d.cliente).trim()) throw new Error('Nombre/cliente requerido.');
  const horario = String(d.horarioAbierto ? 'Horario abierto' : (d.horario || d.horarios || '')).trim();
  return {
    tipo, cliente:String(d.cliente).trim(), refId:String(d.refId||''), telefono:String(d.telefono||''),
    direccion:String(d.direccion||''), referencias:String(d.referencias||''), horarios:horario,
    aval:String(d.aval||''), comentarios:String(d.comentario||d.motivo||d.comentarios||''),
    fecha: d.fecha || new Date().toISOString().slice(0,10),
  };
}

/** RÉPLICA de obtenerVisitas: pendientes por tipo + días + conteos + urgencia. */
export function construirLista(visitas, tipo) {
  const hoy = new Date(); hoy.setHours(0,0,0,0);
  const out = [];
  const conteos = { VERIFICACION:0, COBRANZA:0, JURIDICO:0, MENSAJERIA:0 };
  for (const r of (visitas||[])) {
    const t = U(r.tipo);
    if (U(r.estatus) === 'PENDIENTE' && conteos[t] !== undefined) conteos[t]++;
  }
  for (const r of (visitas||[])) {
    if (U(r.estatus) !== 'PENDIENTE') continue;
    if (tipo && norm(r.tipo) !== norm(tipo)) continue;
    let dias = 0;
    if (r.fecha) { const fc = new Date(r.fecha); fc.setHours(0,0,0,0); dias = Math.floor((hoy - fc)/86400000); }
    out.push({
      id:r.id, fecha:String(r.fecha||'').slice(0,10), tipo:U(r.tipo), cliente:String(r.cliente||''),
      refId:String(r.ref_id||''), telefono:String(r.telefono||''), direccion:String(r.direccion||''),
      referencias:String(r.referencias||''), horarios:String(r.horarios||''), aval:String(r.aval||''),
      asigna:String(r.asigna||''), comentarios:String(r.comentarios||''), dias,
      titular_listo:!!r.titular_listo, avance_cli:String(r.avance_cli||''), avance_com_cli:String(r.avance_com_cli||''),
    });
  }
  out.sort((a,b)=> b.dias - a.dias);   // más viejas (urgentes) primero
  // Urgencia: 3+ días urgente, 2 medio, 1 atención
  const urgencia = { atencion:0, medio:0, urgente:0 };
  for (const v of out) { if (v.dias>=3) urgencia.urgente++; else if (v.dias>=2) urgencia.medio++; else if (v.dias>=1) urgencia.atencion++; }
  return { visitas:out, conteos, urgencia, total:out.length };
}

/** Historial de visitas de un cliente. */
export function construirHistorial(visitas, cliente) {
  return (visitas||[])
    .filter(r => norm(r.cliente) === norm(cliente))
    .map(r => ({ fecha:String(r.fecha||'').slice(0,10), tipo:U(r.tipo), estatus:U(r.estatus),
      resultado:String(r.resultado||''), horaVisita:String(r.hora_visita||''), comentarios:String(r.comentarios||''), resuelve:String(r.resuelve||'') }))
    .sort((a,b)=> b.fecha<a.fecha?-1:b.fecha>a.fecha?1:0);
}

export function colorUrgencia(dias) {
  if (dias>=3) return 'red';
  if (dias>=2) return 'amber';
  if (dias>=1) return 'blue';
  return 'green';
}
