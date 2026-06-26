// Tubería V2 — MOTOR DE ETAPAS basado en avance del expediente (no en status manual).
// Filosofía: el usuario NO mueve la etapa; el sistema la DERIVA del progreso real del prospecto.
// El `status` persistido pasa a ser solo un reflejo de lo que calcula este motor.
//
// Toda la data del avance vive en prospecto.cotizacion_json (no requiere migración de BD):
//   c.proceso      = { iniciado:true }                         (botón "Empezar proceso")
//   c.evaluacion   = { respuestas:{}, completa:true }          (todas las preguntas contestadas)
//   c.expediente   = { ...campos, completo:true }              (todos los campos obligatorios)
//   c.documentos   = { items:[{key,nombre,solicitado,archivo,fecha,usuario}], solicitadosFecha }
//   c.validacion   = { decision:'APROBADO'|'RECHAZADO'|'CORRECCIONES', modulo, por, fecha, nota }
//   c.visita       = { resultado:'APROBADA'|'RECHAZADA', por, fecha, comentarios, fotos:[] }
//
// `prospecto.enviado_cartera` = true cuando ya se surtió (terminal).

export const ETAPAS_V2 = [
  'Información',
  'Evaluación',
  'Expediente',
  'Documentación',
  'Esperando documentos',
  'Validación Jurídica',
  'Visita Domiciliaria',
  'Listo para Surtir',
  'Surtido',
];
export const ETAPAS_CERRADAS_V2 = ['Surtido', 'Rechazado'];

// Módulos a los que la Validación Jurídica puede devolver por "Solicitar correcciones".
export const MODULOS_CORRECCION = ['Evaluación', 'Expediente', 'Documentación'];

const cot = p => (p && p.cotizacion_json) || {};

/** Documentos requeridos = los que Vane marcó como "solicitado". Completo = tiene archivo. */
export function docsRequeridos(p) {
  const items = (cot(p).documentos && cot(p).documentos.items) || [];
  return items.filter(d => d && d.solicitado);
}
export function docsCompletos(p) {
  const req = docsRequeridos(p);
  return req.length > 0 && req.every(d => !!d.archivo);
}

/** Compuertas: qué hitos del expediente están cumplidos. Cada etapa se desbloquea con la anterior. */
export function gates(p) {
  const c = cot(p);
  const val = c.validacion || {};
  const vis = c.visita || {};
  return {
    procesoIniciado:    !!(c.proceso && c.proceso.iniciado),
    evaluacionCompleta: !!(c.evaluacion && (c.evaluacion.completa || c.evaluacion.omitida)),
    expedienteCompleto: !!(c.expediente && c.expediente.completo),
    docsSolicitados:    !!(c.documentos && c.documentos.solicitadosFecha),
    docsCompletos:      docsCompletos(p),
    correcciones:       val.decision === 'CORRECCIONES' ? (val.modulo || 'Expediente') : null,
    validacionAprobada: val.decision === 'APROBADO',
    validacionRechazada: val.decision === 'RECHAZADO',
    visitaAprobada:     vis.resultado === 'APROBADA',
    visitaRechazada:    vis.resultado === 'RECHAZADA',
    surtido:            !!p.enviado_cartera,
  };
}

/** Etapa ACTUAL derivada del avance. Es la primera etapa cuya compuerta de salida no se cumple. */
export function calcularEtapa(p) {
  const g = gates(p);
  if (g.surtido) return 'Surtido';
  if (g.validacionRechazada || g.visitaRechazada) return 'Rechazado';
  if (!g.procesoIniciado) return 'Información';
  if (!g.evaluacionCompleta) return 'Evaluación';
  if (!g.expedienteCompleto) return 'Expediente';
  // Si Tabata pidió correcciones, el prospecto regresa EXACTAMENTE al módulo del problema.
  if (g.correcciones) return g.correcciones;
  if (!g.docsSolicitados) return 'Documentación';
  if (!g.docsCompletos) return 'Esperando documentos';
  if (!g.validacionAprobada) return 'Validación Jurídica';
  if (!g.visitaAprobada) return 'Visita Domiciliaria';
  return 'Listo para Surtir';
}

/** ¿Está cerrado el prospecto (surtido o rechazado)? */
export function estaCerrado(p) {
  return ETAPAS_CERRADAS_V2.includes(calcularEtapa(p)) || gates(p).validacionRechazada || gates(p).visitaRechazada;
}

/** Acción principal disponible en la etapa actual + quién la ejecuta (para gobernar la UI). */
export function accionEtapa(p) {
  const etapa = calcularEtapa(p);
  switch (etapa) {
    case 'Información':           return { etapa, accion: 'EMPEZAR',        label: 'Empezar proceso',           rol: ['EJECUTIVO', 'ADMIN', 'GERENTE'] };
    case 'Evaluación':            return { etapa, accion: 'EVALUAR',        label: 'Continuar a Expediente',    rol: ['EJECUTIVO', 'ADMIN', 'GERENTE'] };
    case 'Expediente':            return { etapa, accion: 'EXPEDIENTE',     label: 'Continuar a Documentación', rol: ['EJECUTIVO', 'ADMIN', 'GERENTE', 'AUX_ADMIN'] };
    case 'Documentación':         return { etapa, accion: 'SOLICITAR_DOCS', label: 'Solicitar documentos',      rol: ['AUX_ADMIN', 'ADMIN', 'GERENTE'] };
    case 'Esperando documentos':  return { etapa, accion: 'ENVIAR_JURIDICO',label: 'Enviar a Validación Jurídica', rol: ['AUX_ADMIN', 'ADMIN', 'GERENTE'], habilitado: docsCompletos(p) };
    case 'Validación Jurídica':   return { etapa, accion: 'VALIDAR',        label: 'Revisar expediente',        rol: ['JURIDICO', 'ADMIN'] };
    case 'Visita Domiciliaria':   return { etapa, accion: 'RESOLVER_VISITA',label: 'Resolver visita',           rol: ['VISITAS', 'ADMIN', 'AUX_ADMIN'] };
    case 'Listo para Surtir':     return { etapa, accion: 'SURTIR',         label: 'Surtir → cartera',          rol: ['AUX_ADMIN', 'ADMIN'] };
    default:                      return { etapa, accion: null,            label: '',                          rol: [] };
  }
}

/** Índice de la etapa (para pintar el pipeline y el % de avance). */
export function indiceEtapa(p) {
  const e = calcularEtapa(p);
  const i = ETAPAS_V2.indexOf(e);
  return i >= 0 ? i : -1;
}
