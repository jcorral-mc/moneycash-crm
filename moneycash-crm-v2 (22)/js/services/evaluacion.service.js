// Evaluación de riesgo — réplica de CONFIG.EVALUACION del Script.
// Cada pregunta SI/NO suma sus puntos si la respuesta es "SI" (la de autorización suma con "SI").
export const PREGUNTAS = [
  { q:'¿Cuál es la frecuencia que prefiere en su crédito?', tipo:'select', opciones:['Semanal','Quincenal','Mensual'], pts:0 },
  { q:'¿Cuál es el monto máximo que podría destinar?', tipo:'text', pts:0 },
  { q:'¿Vive en casa propia a su nombre?', tipo:'sino', pts:5 },
  { q:'¿Cuál es la colonia donde vive actualmente?', tipo:'text', pts:0 },
  { q:'¿Cuenta con un documento que lo acredite?', tipo:'sino', pts:2 },
  { q:'¿Vive en casa de un familiar?', tipo:'sino', pts:0 },
  { q:'¿Su familiar podría firmar como obligado solidario?', tipo:'sino', pts:2 },
  { q:'En caso de rentar ¿tiene más de 2 años en domicilio?', tipo:'sino', pts:0 },
  { q:'¿Cuenta con contrato de renta?', tipo:'sino', pts:2 },
  { q:'¿Cuenta con un aval con casa propia?', tipo:'sino', pts:5 },
  { q:'¿Tiene negocio propio con licencia municipal?', tipo:'sino', pts:5 },
  { q:'¿Cuenta con recibos de nómina?', tipo:'sino', pts:2 },
  { q:'¿A qué se dedica actualmente?', tipo:'select', opciones:['Estudiante','Negocio Propio','Comerciante','Ama de Casa','Pensionado','Enfermera','Empleado','No trabaja'], pts:0 },
  { q:'¿Es trabajador de institución pública (IMSS/ISSSTE)?', tipo:'sino', pts:5 },
  { q:'¿Cuenta con comprobante de domicilio a su nombre?', tipo:'sino', pts:2 },
  { q:'¿Está dispuesto a firmar pagaré?', tipo:'sino', pts:0 },
  { q:'¿Cuenta con 2 referencias personales con INE?', tipo:'sino', pts:3 },
  { q:'¿Permite visitas domiciliarias para verificación?', tipo:'sino', pts:0 },
  { q:'¿Algún familiar cuenta con crédito en MONEY CASH?', tipo:'sino', pts:1 },
  { q:'AUTORIZACIÓN ESPECIAL DE ADMINISTRACIÓN', tipo:'sino', pts:50 },
];

/** Suma el score de las respuestas. respuestas = [{q, a}] (a = 'SI'/'NO'/texto). */
export function calcularScore(respuestas) {
  let score = 0;
  (respuestas||[]).forEach((r, i) => {
    const def = PREGUNTAS[i];
    if (!def || !def.pts) return;
    if (String(r && r.a).toUpperCase() === 'SI') score += def.pts;
  });
  return score;
}

/** Clasificación de riesgo según el score (igual al PDF del Script). */
export function clasificar(score) {
  if (score >= 50) return { nivel:'APROBADO', riesgo:'Bajo Riesgo', color:'#166534' };
  if (score >= 30) return { nivel:'CONDICIONADO', riesgo:'Riesgo Medio', color:'#b45309' };
  return { nivel:'RECHAZADO', riesgo:'Alto Riesgo', color:'#991b1b' };
}

export function scoreMaximo() {
  return PREGUNTAS.reduce((s,p)=>s+(p.pts||0), 0);
}
