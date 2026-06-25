// Repositorio de Cobranza
import { db } from '../lib/supabase.js';

/** agregarComentarioCobranza: historial de gestión por cliente. */
export async function insertComentario(cliente, autor, rol, estado, texto) {
  const { error } = await db.from('comentarios_cobranza').insert({
    cliente, autor, rol, estado, comentario: texto, fecha: new Date().toISOString().slice(0,10)
  });
  if (error) throw error;
}

import { logAudit } from '../lib/audit.js';
import { validarEscalamiento, validarResolucion, COB_SALIDA_LABEL, filtrarComentarios } from '../services/cobranza.service.js';

const N = s => (s||'').toString().trim().toUpperCase();

/** Historial de comentarios de un cliente (filtrado por rol) + revisión vigente. */
export async function fetchGestionCliente(cliente, rol, email) {
  const [com, rev] = await Promise.all([
    db.from('comentarios_cobranza').select('*').eq('cliente', cliente).order('created_at', { ascending: false }),
    db.from('revision_cobranza').select('*').eq('cliente', cliente).eq('estatus', 'EN REVISION').order('created_at', { ascending: false }).limit(1),
  ]);
  const comentarios = filtrarComentarios(com.data || [], rol, email);
  const revision = (rev.data && rev.data[0]) || null;
  return { comentarios, revision };
}

/** Historial de visitas de un cliente (réplica de obtenerHistorialVisitas). */
export async function fetchHistorialVisitas(cliente) {
  const { data } = await db.from('visitas').select('*').eq('cliente', cliente).order('fecha', { ascending: false });
  return data || [];
}

/** RÉPLICA de escalarRevision: exige checklist de 3 puntos. Crea registro + comentario. */
export async function escalarRevision(cliente, perfil, checklist, nota) {
  validarEscalamiento(checklist);
  // ¿Ya está en revisión? evitar duplicado
  const { data: ya } = await db.from('revision_cobranza').select('id').eq('cliente', cliente).eq('estatus', 'EN REVISION').limit(1);
  if (ya && ya.length) throw new Error('Este cliente ya está en revisión con gerencia.');
  // Ejecutivo dueño (desde cartera)
  const { data: cart } = await db.from('cartera').select('ejecutivo').eq('nombre', cliente).limit(1);
  const ejec = (cart && cart[0] && cart[0].ejecutivo) || '';
  const autor = (perfil && perfil.email) || (perfil && perfil.nombre) || '';
  const { error } = await db.from('revision_cobranza').insert({
    cliente, ejecutivo: ejec, escalo: autor,
    llamo_cliente: true, llamo_ref: true, visito_dom: true,
    estatus: 'EN REVISION', nota: nota || '',
  });
  if (error) throw error;
  // Comentario en el historial
  try {
    await db.from('comentarios_cobranza').insert({
      cliente, autor, rol: perfil.rol, estado: 'REVISION CON GERENCIA',
      comentario: nota || 'Escalado a revisión: llamó cliente ✓, llamó referencias ✓, visitó domicilio ✓',
    });
  } catch (e) {}
  await logAudit(perfil, 'COBRANZA_ESCALAR', cliente, 'Revisión con gerencia');
  return { ok: true, msg: '✅ Cliente escalado a REVISIÓN CON GERENCIA.' };
}

/** Casos EN REVISION (réplica de obtenerCasosRevision). Ejecutivo no ve esta sección. */
export async function fetchCasosRevision(rol) {
  if (rol === 'EJECUTIVO') return [];
  const { data } = await db.from('revision_cobranza').select('*').eq('estatus', 'EN REVISION').order('created_at', { ascending: false });
  return data || [];
}

/**
 * RÉPLICA de resolverRevision (gerente/admin): REGULARIZADO / JURIDICO / RESUELTO.
 *  - JURIDICO exige checklist (visito2Horarios + agotoNegociacion) y crea autorización para el admin.
 *  - Admin cierra directo; gerente manda a autorización del admin.
 */
export async function resolverRevision(caso, salida, detalle, perfil) {
  validarResolucion(salida, detalle);
  const sal = N(salida);
  const cliente = caso.cliente;
  const autor = (perfil && perfil.email) || (perfil && perfil.nombre) || '';
  const notaTxt = (detalle && detalle.notaContacto) || '';

  // JURÍDICO: siempre va a autorización del admin
  if (sal === 'JURIDICO') {
    await db.from('revision_cobranza').update({ estatus: 'EN AUTORIZACION', resuelto_por: autor }).eq('id', caso.id);
    const contacto = detalle.tuvoContacto === true ? 'SÍ' : 'NO';
    const notaJur = 'Visitó 2 horarios ✓ · Agotó negociación ✓ · Contacto directo: ' + contacto + (notaTxt ? (' — ' + notaTxt) : '');
    await db.from('autorizaciones').insert({ tipo: 'JURIDICO', referencia: cliente, solicita: autor, detalle: notaJur, estatus: 'PENDIENTE' });
    await logAudit(perfil, 'COBRANZA_RESOLVER', cliente, 'Solicitud jurídico → autorización');
    return { ok: true, msg: '✅ Solicitud de jurídico enviada a autorización del admin.' };
  }

  // REGULARIZADO / RESUELTO
  if (perfil.rol === 'ADMIN') {
    await db.from('revision_cobranza').update({ estatus: COB_SALIDA_LABEL[sal], resuelto_por: autor }).eq('id', caso.id);
    try {
      await db.from('comentarios_cobranza').insert({
        cliente, autor, rol: perfil.rol, estado: 'REVISION CON GERENCIA',
        comentario: 'Cerrado: ' + COB_SALIDA_LABEL[sal] + (notaTxt ? (' — ' + notaTxt) : ''),
      });
    } catch (e) {}
    await logAudit(perfil, 'COBRANZA_RESOLVER', cliente, 'Cerrado: ' + COB_SALIDA_LABEL[sal]);
    return { ok: true, msg: '✅ Caso ' + COB_SALIDA_LABEL[sal].toLowerCase() + '.' };
  }
  // GERENTE → autorización del admin
  await db.from('revision_cobranza').update({ estatus: 'EN AUTORIZACION', resuelto_por: autor }).eq('id', caso.id);
  await db.from('autorizaciones').insert({
    tipo: 'CIERRE CASO (' + COB_SALIDA_LABEL[sal] + ')', referencia: cliente, solicita: autor,
    detalle: notaTxt || ('Cierre solicitado: ' + COB_SALIDA_LABEL[sal]), estatus: 'PENDIENTE',
  });
  await logAudit(perfil, 'COBRANZA_RESOLVER', cliente, 'Cierre → autorización');
  return { ok: true, msg: '✅ Solicitud de cierre enviada a autorización del admin.' };
}
