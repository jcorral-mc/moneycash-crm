// Lógica de Avisos — catálogo de eventos de WhatsApp y mezcla con la config guardada.
// La web no envía WhatsApp por servidor: "Probar" abre un link wa.me para mandarlo a mano.
export const CATALOGO_EVENTOS = [
  { clave: 'VISITA_ASIGNADA', desc: 'Visita asignada (cobranza/verificación)', proy: 'CRM' },
  { clave: 'PAGO_REGISTRADO', desc: 'Pago registrado', proy: 'CRM' },
  { clave: 'PAGO_AMERICANO', desc: 'Pago americano registrado', proy: 'CRM' },
  { clave: 'QUITAR_MULTA', desc: 'Solicitud para quitar multa', proy: 'CRM' },
  { clave: 'SOLICITUD_DESCUENTO', desc: 'Solicitud de descuento / liquidación', proy: 'CRM' },
  { clave: 'ESCALAMIENTO_GERENCIA', desc: 'Escalamiento a gerencia', proy: 'CRM' },
  { clave: 'CLIENTE_EN_CEROS', desc: 'Cliente liquidado (saldo en ceros)', proy: 'CRM' },
  { clave: 'CLIENTE_JURIDICO', desc: 'Cliente enviado a jurídico', proy: 'CRM' },
  { clave: 'CREDITO_SURTIDO', desc: 'Crédito surtido', proy: 'CRM' },
  { clave: 'SOLICITUD_REVERSO', desc: 'Solicitud de reverso', proy: 'CRM' },
  { clave: 'AUTORIZACION_PENDIENTE', desc: 'Pendiente por autorizar (al admin)', proy: 'CRM' },
  { clave: 'VISITA_VERIFICACION', desc: 'Visita de verificación', proy: 'TUBERIA' },
  { clave: 'LISTO_PARA_SURTIR', desc: 'Cliente listo para surtir', proy: 'TUBERIA' },
  { clave: 'NUEVO_PROSPECTO', desc: 'Nuevo prospecto en pipeline', proy: 'TUBERIA' },
  { clave: 'SOLICITUD_RENO', desc: 'Solicitud de renovación/reactivación', proy: 'TUBERIA' },
];

/** Mezcla el catálogo fijo con los overrides guardados (dest/activo por clave). */
export function mezclarEventos(guardados) {
  const byClave = {};
  for (const g of (guardados || [])) byClave[g.clave] = g;
  return CATALOGO_EVENTOS.map(e => {
    const g = byClave[e.clave] || {};
    return {
      clave: e.clave, desc: e.desc, proy: e.proy,
      dest: Array.isArray(g.dest) ? g.dest : [],
      activo: g.activo === undefined ? true : !!g.activo,
    };
  });
}

/** Une perfiles (usuarios) con sus teléfonos guardados. persona = email. */
export function mezclarContactos(perfiles, guardados) {
  const tel = {}; const act = {};
  for (const g of (guardados || [])) { tel[g.persona] = g.num || ''; if (g.activo !== undefined) act[g.persona] = !!g.activo; }
  return (perfiles || []).map(p => ({
    persona: p.email, nombre: p.nombre || p.email, rol: p.rol || '',
    num: tel[p.email] || '', activo: act[p.email] === undefined ? true : act[p.email],
  }));
}

/** Valida un número estilo +52 con 11–15 dígitos (igual que el Script). */
export function numeroValido(num) {
  const n = String(num || '').trim();
  return !n || /^\+\d{11,15}$/.test(n);
}
