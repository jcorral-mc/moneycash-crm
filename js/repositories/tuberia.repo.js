// Repositorio de Tubería — prospectos, etapas, evaluación y puente completo a cartera.
import { db } from '../lib/supabase.js';
import { logAudit } from '../lib/audit.js';
import { siguienteEtapa, generarFolio } from '../services/tuberia.service.js';
import { construirAlta } from '../services/calendario.service.js';
import { calcularSurtimiento, validarReparto } from '../services/surtir.service.js';
import { calcularEtapa } from '../services/tuberia_etapas.service.js';
import { validarEvaluacion } from '../services/evaluacion.service.js';
import { crearAlta, existeCliente } from '../repositories/alta.repo.js';
import { agregarMovimientoBanco } from '../repositories/bancos.repo.js';

const hoy = () => new Date().toISOString().slice(0,10);

export async function fetchProspectos() {
  let all=[], from=0, page=1000;
  for (let i=0;i<15;i++){ const { data } = await db.from('prospectos').select('*').order('fecha_creacion',{ascending:false}).range(from, from+page-1); const d=data||[]; all=all.concat(d); if(d.length<page) break; from+=page; }
  return all;
}

export async function crearProspecto(d, cot, perfil) {
  if (!String(d.nombre||'').trim()) throw new Error('Falta el nombre.');
  const folio = generarFolio(d.nombre, d.sucursal);
  const fila = {
    prospect_id:folio, nombre:String(d.nombre).trim(), telefono:String(d.telefono||''), sucursal:String(d.sucursal||''),
    ejecutivo:String(d.ejecutivo||(perfil&&perfil.ejecutivo)||'').toUpperCase(), status:'Prospecto / Nuevo',
    monto:cot.monto, plazo:cot.plazo, frecuencia:cot.frecuencia, tipo:cot.tipo, comision:cot.comision, financiar:cot.financiar,
    deposito:cot.deposito, abono_puntual:cot.abonoPuntual, abono_impuntual:cot.abonoImpuntual, base_deuda:cot.montoBaseDeuda,
    interes_pct:(cot.pctComision||0)+'%', adeudo_actual:cot.adeudo||0, tipo_cliente:(cot.adeudo>0?'RENOVACION':'NUEVO'),
    colonia:String(d.colonia||''), municipio:String(d.municipio||''), cotizacion_json:cot, notas:String(d.notas||''),
  };
  const { data, error } = await db.from('prospectos').insert(fila).select('id,prospect_id').single();
  if (error) throw error;
  await logAudit(perfil, 'TUB_PROSPECTO_ALTA', fila.nombre, folio+' · '+cot.tipo+' '+cot.monto);
  return { ok:true, msg:'✅ Prospecto creado: '+folio, id:data.id, folio };
}

export async function actualizarProspecto(id, updates, perfil) {
  await db.from('prospectos').update(updates).eq('id', id);
  await logAudit(perfil, 'TUB_PROSPECTO_EDIT', String(id), JSON.stringify(updates).slice(0,80));
  return { ok:true };
}

/** Refleja en `status` la etapa que CALCULA el motor (status deja de ser editable por el usuario). */
async function sincronizarEtapa(prospecto, perfil, extra) {
  const etapa = calcularEtapa(prospecto);
  await db.from('prospectos').update({ status: etapa, ...(extra || {}) }).eq('id', prospecto.id);
  prospecto.status = etapa;
  return etapa;
}

/** Información → "Empezar proceso": abre el avance del expediente. */
export async function empezarProceso(prospecto, perfil) {
  const cot = prospecto.cotizacion_json || {};
  cot.proceso = { iniciado: true, fecha: hoy(), por: (perfil && perfil.email) || '' };
  prospecto.cotizacion_json = cot;
  await db.from('prospectos').update({ cotizacion_json: cot }).eq('id', prospecto.id);
  const etapa = await sincronizarEtapa(prospecto, perfil);
  await logAudit(perfil, 'TUB_EMPEZAR', prospecto.nombre, 'proceso iniciado');
  return { ok: true, etapa };
}

/** Evaluación V2 (SIN score): exige todas las preguntas; marca `completa`. */
export async function guardarEvaluacion(prospecto, respuestas, perfil) {
  const { completa, faltan } = validarEvaluacion(respuestas);
  if (!completa) throw new Error('Faltan ' + faltan.length + ' pregunta(s) por contestar. Todas son obligatorias.');
  const cot = prospecto.cotizacion_json || {};
  cot.evaluacion = { respuestas, completa: true, fecha: hoy(), por: (perfil && perfil.email) || '' };
  prospecto.cotizacion_json = cot;
  await db.from('prospectos').update({ cotizacion_json: cot }).eq('id', prospecto.id);
  const etapa = await sincronizarEtapa(prospecto, perfil);
  await logAudit(perfil, 'TUB_EVALUACION', prospecto.nombre, 'evaluación completa');
  return { ok: true, etapa };
}

/** Expediente V2: guarda KYC y marca `completo` (la vista valida los obligatorios antes de llamar). */
export async function guardarKYC(prospecto, expediente, perfil) {
  const cot = prospecto.cotizacion_json || {};
  cot.expediente = { ...expediente, completo: true, fecha: hoy() };
  prospecto.cotizacion_json = cot;
  await db.from('prospectos').update({ cotizacion_json: cot }).eq('id', prospecto.id);
  const etapa = await sincronizarEtapa(prospecto, perfil);
  await logAudit(perfil, 'TUB_KYC', prospecto.nombre, 'expediente completo');
  return { ok: true, etapa };
}

/** Documentación: guarda la selección/subida de documentos (uno por uno). */
export async function guardarDocumentos(prospecto, items, perfil) {
  const cot = prospecto.cotizacion_json || {};
  cot.documentos = { ...(cot.documentos || {}), items };
  prospecto.cotizacion_json = cot;
  await db.from('prospectos').update({ cotizacion_json: cot }).eq('id', prospecto.id);
  await sincronizarEtapa(prospecto, perfil);
  return { ok: true };
}

/** "Solicitar documentos": marca solicitados, fija fecha y pasa a Esperando documentos (+WhatsApp). */
export async function solicitarDocumentos(prospecto, items, perfil) {
  const cot = prospecto.cotizacion_json || {};
  cot.documentos = { items, solicitadosFecha: hoy(), por: (perfil && perfil.email) || '' };
  prospecto.cotizacion_json = cot;
  await db.from('prospectos').update({ cotizacion_json: cot }).eq('id', prospecto.id);
  const etapa = await sincronizarEtapa(prospecto, perfil);
  await logAudit(perfil, 'TUB_SOLICITAR_DOCS', prospecto.nombre, items.filter(d => d.solicitado).length + ' documentos');
  return { ok: true, etapa };
}

/** Validación Jurídica (Tabata): APROBADO | RECHAZADO | CORRECCIONES (regresa al módulo). */
export async function validarJuridico(prospecto, decision, modulo, nota, perfil) {
  const cot = prospecto.cotizacion_json || {};
  cot.validacion = { decision, modulo: modulo || null, nota: nota || '', por: (perfil && perfil.email) || '', fecha: hoy() };
  // Si se piden correcciones, se limpia el flag del módulo a corregir para que regrese ahí.
  if (decision === 'CORRECCIONES') {
    if (modulo === 'Evaluación' && cot.evaluacion) cot.evaluacion.completa = false;
    if (modulo === 'Expediente' && cot.expediente) cot.expediente.completo = false;
    if (modulo === 'Documentación' && cot.documentos) cot.documentos.solicitadosFecha = null;
  }
  prospecto.cotizacion_json = cot;
  await db.from('prospectos').update({ cotizacion_json: cot }).eq('id', prospecto.id);
  const etapa = await sincronizarEtapa(prospecto, perfil);
  await logAudit(perfil, 'TUB_VALIDACION', prospecto.nombre, decision + (modulo ? (' → ' + modulo) : ''));
  return { ok: true, etapa };
}

/** El ejecutivo SOLICITA a Jurídico omitir la evaluación (queda pendiente de autorización). */
export async function solicitarOmisionEval(prospecto, motivo, perfil) {
  const cot = prospecto.cotizacion_json || {};
  cot.evaluacion = { ...(cot.evaluacion || {}), solicitudOmision: { motivo: motivo || '', por: (perfil && perfil.email) || '', fecha: hoy() } };
  prospecto.cotizacion_json = cot;
  await db.from('prospectos').update({ cotizacion_json: cot }).eq('id', prospecto.id);
  await logAudit(perfil, 'TUB_EVAL_SOLIC_OMISION', prospecto.nombre, motivo || '');
  return { ok: true };
}

/** Jurídico/Admin AUTORIZA omitir la evaluación → la etapa avanza a Expediente. */
export async function omitirEvaluacion(prospecto, motivo, perfil) {
  const cot = prospecto.cotizacion_json || {};
  cot.evaluacion = { ...(cot.evaluacion || {}), omitida: true, completa: false,
    autorizadaPor: (perfil && perfil.email) || '', motivoOmision: motivo || '', fecha: hoy() };
  prospecto.cotizacion_json = cot;
  await db.from('prospectos').update({ cotizacion_json: cot }).eq('id', prospecto.id);
  const etapa = await sincronizarEtapa(prospecto, perfil);
  await logAudit(perfil, 'TUB_EVAL_OMITIDA', prospecto.nombre, motivo || '');
  return { ok: true, etapa };
}

/** Visita: Vane DISPARA/asigna la visita a Eduardo. Queda parada hasta que él la resuelva. */
export async function asignarVisita(prospecto, datos, perfil) {
  const cot = prospecto.cotizacion_json || {};
  cot.visita = { ...(cot.visita || {}), asignada: { ...datos, por: (perfil && perfil.email) || '', fecha: hoy() } };
  prospecto.cotizacion_json = cot;
  await db.from('prospectos').update({ cotizacion_json: cot }).eq('id', prospecto.id);
  await sincronizarEtapa(prospecto, perfil);
  await logAudit(perfil, 'TUB_VISITA_ASIGNADA', prospecto.nombre, (datos && datos.direccion) || '');
  return { ok: true };
}

/** Visita: resultado APROBADA | RECHAZADA (nunca "pendiente"). */
export async function resolverVisita(prospecto, resultado, datos, perfil) {
  const cot = prospecto.cotizacion_json || {};
  cot.visita = { resultado, comentarios: (datos && datos.comentarios) || '', fotos: (datos && datos.fotos) || [],
    por: (perfil && perfil.email) || '', fecha: hoy() };
  prospecto.cotizacion_json = cot;
  await db.from('prospectos').update({ cotizacion_json: cot }).eq('id', prospecto.id);
  const etapa = await sincronizarEtapa(prospecto, perfil);
  await logAudit(perfil, 'TUB_VISITA', prospecto.nombre, resultado);
  return { ok: true, etapa };
}

/** Guarda el checklist de documentos dentro de cotizacion_json.checklist. */
export async function guardarChecklist(prospecto, checklist, perfil) {
  const cot = prospecto.cotizacion_json || {};
  cot.checklist = checklist;
  await db.from('prospectos').update({ cotizacion_json: cot }).eq('id', prospecto.id);
  prospecto.cotizacion_json = cot;
  await logAudit(perfil, 'TUB_CHECKLIST', prospecto.nombre, (checklist || []).length + ' docs');
  return { ok: true };
}

/** Agrega una nota a la bitácora (prepende con timestamp, igual que el Script). */
export async function agregarNota(prospecto, texto, perfil) {
  const t = String(texto || '').trim();
  if (!t) throw new Error('Escribe una nota.');
  const ts = new Date().toLocaleString('es-MX', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  const quien = (perfil && perfil.nombre) ? (' — ' + perfil.nombre) : '';
  const nuevas = `[${ts}] ${t}${quien}\n${prospecto.notas || ''}`.trim();
  await db.from('prospectos').update({ notas: nuevas }).eq('id', prospecto.id);
  prospecto.notas = nuevas;
  await logAudit(perfil, 'TUB_NOTA', prospecto.nombre, t.slice(0, 60));
  return { ok: true, notas: nuevas };
}

/** Dispara una visita de VERIFICACIÓN a la cola del módulo Visitas (estatus PENDIENTE).
 *  Réplica de _crmCrearVerificacion del Script. Escribe directo a `visitas` para no
 *  pasar por el candado de rol de asignarVisita (es una acción automática del pipeline). */
export async function dispararVisitaVerificacion(prospecto, datos, perfil) {
  const fila = {
    fecha: hoy(),
    tipo: 'VERIFICACION',
    cliente: String(prospecto.nombre || '').trim(),
    ref_id: String(prospecto.prospect_id || prospecto.id || ''),
    telefono: String((datos && datos.telefono) || prospecto.telefono || ''),
    direccion: String((datos && datos.direccion) || ''),
    aval: String((datos && datos.aval) || ''),
    horarios: String((datos && datos.horarios) || ''),
    comentarios: String((datos && datos.nota) || ''),
    asigna: (perfil && perfil.email) || '',
    estatus: 'PENDIENTE',
  };
  const { error } = await db.from('visitas').insert(fila);
  if (error) throw error;
  await logAudit(perfil, 'TUB_VISITA_VERIFICACION', fila.cliente, 'visita domiciliaria → cola de verificación');
  return { ok: true, msg: '✅ Visita de verificación enviada a la cola de Visitas.' };
}

/** Guarda/acumula URLs de fotos (evidencias) en cotizacion_json.fotos. */
export async function guardarFotos(prospecto, urls, perfil) {
  const cot = prospecto.cotizacion_json || {};
  cot.fotos = [...(cot.fotos || []), ...(urls || [])];
  await db.from('prospectos').update({ cotizacion_json: cot }).eq('id', prospecto.id);
  prospecto.cotizacion_json = cot;
  await logAudit(perfil, 'TUB_FOTOS', prospecto.nombre, (urls || []).length + ' foto(s)');
  return { ok: true, fotos: cot.fotos };
}

export async function cambiarStatus(prospecto, nuevoStatus, perfil) {
  await db.from('prospectos').update({ status:nuevoStatus }).eq('id', prospecto.id);
  await logAudit(perfil, 'TUB_STATUS', prospecto.nombre, nuevoStatus);
  return { ok:true, msg:'Estado → '+nuevoStatus };
}

export async function avanzar(prospecto, perfil) {
  const sig = siguienteEtapa(prospecto.status);
  if (!sig) throw new Error('El prospecto ya está en la última etapa.');
  if (sig === 'Surtidos') throw new Error('Para surtir usa el botón "Surtir → cartera" (requiere reparto de bancos).');
  return cambiarStatus(prospecto, sig, perfil);
}

export async function rechazar(prospecto, motivo, perfil) {
  await db.from('prospectos').update({ status:'Rechazado', notas:(prospecto.notas||'')+'\nRECHAZADO: '+(motivo||'') }).eq('id', prospecto.id);
  await logAudit(perfil, 'TUB_RECHAZADO', prospecto.nombre, motivo||'');
  return { ok:true, msg:'Prospecto rechazado.' };
}

/** Liquida el crédito anterior en cartera (renovación): desglose, bancos netea, borra calendario y fila. */
async function liquidarCreditoAnterior(prospecto, sur, perfil) {
  const nombre = String(prospecto.nombre||'').trim();
  const { data: viejos } = await db.from('cartera').select('id,nombre,saldo,saldo_capital,saldo_interes').ilike('nombre', nombre).gt('saldo', 0.5);
  if (!viejos || !viejos.length) throw new Error('No encontré un crédito anterior activo de "'+nombre+'" en cartera para liquidar.');
  if (viejos.length > 1) throw new Error('"'+nombre+'" tiene varios créditos activos. Revísalo con Admin antes de renovar.');
  const v = viejos[0];
  const realSaldo = Math.round(parseFloat(v.saldo)||0);
  if (Math.abs(realSaldo - sur.adeudoReno) > 1) {
    throw new Error('El saldo de "'+nombre+'" cambió: hoy debe $'+realSaldo.toLocaleString('es-MX')+' y al cotizar eran $'+sur.adeudoReno.toLocaleString('es-MX')+'. Consúltalo con Admin antes de surtir.');
  }
  const saldoCapV = Math.round(parseFloat(v.saldo_capital)||0), saldoIntV = Math.round(parseFloat(v.saldo_interes)||0);
  // Desglose de la liquidación (interés = ingreso, capital = retorno)
  await db.from('desglose').insert({ fecha:hoy(), cliente:nombre, ejecutivo:String(prospecto.ejecutivo||'').toUpperCase(), pago:sur.adeudoReno, capital:saldoCapV, interes:saldoIntV, tipo:'LIQUIDACION' });
  // Bancos: INGRESO (cobro) + EGRESO (surtimiento) en RENOVACION → netea a cero
  await agregarMovimientoBanco({ tipo:'INGRESO', cuenta:'RENOVACION', monto:sur.adeudoReno, concepto:'LIQUIDACION '+nombre, origen:'LIQUIDACION', obs:'reno' }, perfil);
  await agregarMovimientoBanco({ tipo:'EGRESO', cuenta:'RENOVACION', monto:sur.adeudoReno, concepto:'SURTIMIENTO RENOVACION '+nombre, origen:'SURTIMIENTO', obs:'reno' }, perfil);
  // Borrar calendario anterior + fila de cartera vieja
  await db.from('calendarios').delete().eq('cartera_id', v.id);
  await db.from('cartera').delete().eq('id', v.id);
}

/** Puente completo: crea cliente+calendario, reparte bancos, comisión y desglose. */
export async function enviarACartera(prospecto, reparto, perfil) {
  const sur = calcularSurtimiento(prospecto);
  const cuentas = validarReparto(reparto, sur.objetivoReparto);  // valida que cuadre
  const nombre = String(prospecto.nombre||'').trim();

  if (sur.esReno) {
    await liquidarCreditoAnterior(prospecto, sur, perfil);
  } else if (await existeCliente(nombre)) {
    throw new Error('Ya existe un cliente con ese nombre en cartera.');
  }

  // Crear cliente + calendario (reusa el motor de alta)
  const d = {
    nombre, ejecutivo:prospecto.ejecutivo, monto:prospecto.monto, comision:prospecto.comision,
    plazo:prospecto.plazo, frecuencia:prospecto.frecuencia, tipo:prospecto.tipo,
    abonoPuntual:prospecto.abono_puntual, abonoImpuntual:prospecto.abono_impuntual,
    tipoComision: prospecto.financiar ? 'FINANCIADA' : 'DESCONTADA',
  };
  const { cartera, calendarioRows } = construirAlta(d);
  await crearAlta(cartera, calendarioRows);

  // EGRESO de banco por cada cuenta del reparto (lo que se le deposita al cliente)
  for (const c of cuentas) {
    await agregarMovimientoBanco({ tipo:'EGRESO', cuenta:c.cuenta, monto:c.monto, concepto:'SURTIMIENTO '+nombre, origen:'SURTIMIENTO', obs:prospecto.prospect_id||'' }, perfil);
  }

  // Comisión por apertura → desglose (ingreso realizado, alimenta P&L y compensaciones)
  if (sur.comision > 0) {
    await db.from('desglose').insert({ fecha:hoy(), cliente:nombre, ejecutivo:String(prospecto.ejecutivo||'').toUpperCase(), pago:sur.comision, capital:0, interes:sur.comision, tipo:'APERTURA' });
  }

  await db.from('prospectos').update({ enviado_cartera:true, status:'Surtidos' }).eq('id', prospecto.id);
  await logAudit(perfil, 'TUB_A_CARTERA', nombre, prospecto.tipo+' '+prospecto.monto+(sur.esReno?' (RENO)':''));
  return { ok:true, msg:'✅ '+nombre+' enviado a cartera con su calendario'+(sur.esReno?' (crédito anterior liquidado).':'.') };
}
