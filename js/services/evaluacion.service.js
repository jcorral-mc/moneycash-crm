// Evaluación de Tubería V2 — MISMAS preguntas que el Script, pero SIN score.
// Filosofía nueva: la evaluación es el filtro real. Todas las preguntas son obligatorias;
// no se puede guardar mientras exista una pregunta sin contestar.
//
// ▼ EDITA AQUÍ las preguntas (esta es la fuente única; el front lee de aquí).
//   tipo: 'sino' | 'text' | 'select'  ·  opciones: solo para 'select'
//   obligatoria: por defecto TRUE (todas). Pon obligatoria:false para hacerla opcional.
export const PREGUNTAS_DEFAULT = [
  { key:'frecuencia',   q:'¿Cuál es la frecuencia que prefiere en su crédito?', tipo:'select', opciones:['Semanal','Quincenal','Mensual'] },
  { key:'monto_max',    q:'¿Cuál es el monto máximo que podría destinar?', tipo:'text' },
  { key:'casa_propia',  q:'¿Vive en casa propia a su nombre?', tipo:'sino' },
  { key:'colonia',      q:'¿Cuál es la colonia donde vive actualmente?', tipo:'text' },
  { key:'doc_acredita', q:'¿Cuenta con un documento que lo acredite?', tipo:'sino' },
  { key:'casa_familiar',q:'¿Vive en casa de un familiar?', tipo:'sino' },
  { key:'familiar_obligado', q:'¿Su familiar podría firmar como obligado solidario?', tipo:'sino' },
  { key:'renta_2anios', q:'En caso de rentar ¿tiene más de 2 años en domicilio?', tipo:'sino' },
  { key:'contrato_renta', q:'¿Cuenta con contrato de renta?', tipo:'sino' },
  { key:'aval_casa',    q:'¿Cuenta con un aval con casa propia?', tipo:'sino' },
  { key:'negocio_licencia', q:'¿Tiene negocio propio con licencia municipal?', tipo:'sino' },
  { key:'recibos_nomina', q:'¿Cuenta con recibos de nómina?', tipo:'sino' },
  { key:'ocupacion',    q:'¿A qué se dedica actualmente?', tipo:'select', opciones:['Estudiante','Negocio Propio','Comerciante','Ama de Casa','Pensionado','Enfermera','Empleado','No trabaja'] },
  { key:'inst_publica', q:'¿Es trabajador de institución pública (IMSS/ISSSTE)?', tipo:'sino' },
  { key:'comprobante_dom', q:'¿Cuenta con comprobante de domicilio a su nombre?', tipo:'sino' },
  { key:'firma_pagare', q:'¿Está dispuesto a firmar pagaré?', tipo:'sino' },
  { key:'referencias',  q:'¿Cuenta con 2 referencias personales con INE?', tipo:'sino' },
  { key:'permite_visita', q:'¿Permite visitas domiciliarias para verificación?', tipo:'sino' },
  { key:'familiar_mc',  q:'¿Algún familiar cuenta con crédito en MONEY CASH?', tipo:'sino' },
  { key:'autorizacion', q:'AUTORIZACIÓN ESPECIAL DE ADMINISTRACIÓN', tipo:'sino' },
];

/** Lista de preguntas vigente. Si en el futuro se guardan preguntas editadas (config),
 *  se pasan aquí; sin config, usa las de arriba. */
export function getPreguntas(cfg) {
  const lista = cfg && Array.isArray(cfg.preguntas) && cfg.preguntas.length ? cfg.preguntas : PREGUNTAS_DEFAULT;
  return lista.map(p => ({ obligatoria: true, ...p }));
}

/** ¿Está contestada una respuesta? (no vacía) */
function contestada(v) {
  return v !== undefined && v !== null && String(v).trim() !== '';
}

/** Valida que TODAS las preguntas obligatorias estén contestadas. Devuelve {completa, faltan:[keys]}. */
export function validarEvaluacion(respuestas, cfg) {
  const preguntas = getPreguntas(cfg);
  const faltan = [];
  for (const p of preguntas) {
    if (p.obligatoria === false) continue;
    if (!contestada(respuestas && respuestas[p.key])) faltan.push(p.key);
  }
  return { completa: faltan.length === 0, faltan };
}
