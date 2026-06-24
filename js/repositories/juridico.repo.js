// Repositorio de Jurídico — casos, abonos (40/60), convenios, bitácora, diligencias.
import { db } from '../lib/supabase.js';
import { logAudit } from '../lib/audit.js';
import { agregarMovimientoBanco } from './bancos.repo.js';
import { planAbono, planConvenio, JUR_ESTADOS } from '../services/juridico.service.js';

const money = n => '$'+Number(n||0).toLocaleString('es-MX',{maximumFractionDigits:0});

export async function fetchCarteraJuridico() {
  const { data } = await db.from('cartera_juridico').select('*').order('cliente');
  return data || [];
}
export async function fetchCaso(id) {
  const { data } = await db.from('cartera_juridico').select('*').eq('id', id).maybeSingle();
  return data;
}
export async function fetchBitacora(cliente) {
  const { data } = await db.from('cartera_juridico_bitacora').select('*').ilike('cliente', cliente).order('created_at',{ascending:false});
  return data || [];
}
export async function fetchConvenios(cliente) {
  const { data } = await db.from('convenios_juridico').select('*').ilike('cliente', cliente).order('created_at',{ascending:false});
  return data || [];
}
export async function fetchPagosConvenio(cliente) {
  const { data } = await db.from('pagos_convenio').select('*').ilike('cliente', cliente).order('n_pago');
  return data || [];
}

/** Mover un cliente a jurídico (alta de caso con saldo congelado). */
export async function agregarCaso(d, perfil) {
  const cliente = String(d.cliente||'').trim();
  if (!cliente) throw new Error('Falta el cliente.');
  const saldo = parseFloat(d.saldoMC)||0;
  const { error } = await db.from('cartera_juridico').insert({
    cliente, ejecutivo:String(d.ejecutivo||'JURIDICO'), frecuencia:String(d.frecuencia||''),
    capital_orig:parseFloat(d.capitalOrig)||0, saldo_mc:saldo, cap_pagado:0, int_pagado:0, n_abonos:0,
    saldo_demanda:saldo, estatus:'SIN PRESENTAR', fecha_ingreso:new Date().toISOString().slice(0,10), notas:String(d.notas||''),
  });
  if (error) throw error;
  await db.from('cartera_juridico_bitacora').insert({ cliente, autor:(perfil&&perfil.email)||'(sistema)', estatus:'SIN PRESENTAR', nota:'Caso recibido de cobranza. '+(d.nota||'') });
  await logAudit(perfil, 'JURIDICO_ALTA_CASO', cliente, 'saldo '+money(saldo));
  return { ok:true, msg:'✅ Caso agregado a jurídico.' };
}

/** Abono jurídico 40/60 (o liquidación). Reduce el saldo del caso y afecta el banco. */
export async function abonarJuridico(caso, d, perfil) {
  const plan = planAbono(caso, d.monto, d.liquidar);
  const { error } = await db.from('cartera_juridico').update({
    saldo_demanda: plan.nuevoSaldo,
    cap_pagado: (Number(caso.cap_pagado)||0) + plan.cap,
    int_pagado: (Number(caso.int_pagado)||0) + plan.int,
    n_abonos: (Number(caso.n_abonos)||0) + 1,
  }).eq('id', caso.id);
  if (error) throw error;
  if (d.cuenta) {
    await agregarMovimientoBanco({ tipo:'INGRESO', cuenta:d.cuenta, monto:plan.monto,
      concepto:'Abono jurídico '+caso.cliente, origen:'JURIDICO', obs:(plan.esLiquidar?'Liquidación':'Abono')+' jurídico' }, perfil);
  }
  const detalle = (plan.esLiquidar?'Liquidación':'Abono')+' jurídico: '+money(plan.monto)+' (cap '+money(plan.cap)+' + int '+money(plan.int)+')';
  await db.from('cartera_juridico_bitacora').insert({ cliente:caso.cliente, autor:(perfil&&perfil.email)||'', estatus:caso.estatus, nota:detalle });
  await logAudit(perfil, 'JURIDICO_ABONO', caso.cliente, detalle+' · saldo→'+plan.nuevoSaldo);
  return { ok:true, msg:'✅ '+detalle+'. Saldo: '+money(plan.nuevoSaldo) };
}

export async function agregarNota(cliente, nota, perfil) {
  if (!String(nota||'').trim()) throw new Error('Nota vacía.');
  await db.from('cartera_juridico_bitacora').insert({ cliente, autor:(perfil&&perfil.email)||'', estatus:'', nota:String(nota) });
  await logAudit(perfil, 'JURIDICO_NOTA', cliente, nota);
  return { ok:true, msg:'Nota agregada.' };
}

/** Actualizar estatus y/o próxima diligencia del caso. */
export async function actualizarCaso(caso, d, perfil) {
  const upd = {};
  if (d.estatus) { if (JUR_ESTADOS.indexOf(d.estatus)<0) throw new Error('Estatus inválido.'); upd.estatus = d.estatus; }
  if (d.proxDiligencia !== undefined) upd.prox_diligencia = d.proxDiligencia || null;
  if (!Object.keys(upd).length) return { ok:true };
  await db.from('cartera_juridico').update(upd).eq('id', caso.id);
  const detalle = (d.estatus?('Estatus → '+d.estatus):'') + (d.proxDiligencia?(' · Diligencia '+d.proxDiligencia):'');
  await db.from('cartera_juridico_bitacora').insert({ cliente:caso.cliente, autor:(perfil&&perfil.email)||'', estatus:d.estatus||caso.estatus, nota:detalle||'Actualización' });
  await logAudit(perfil, 'JURIDICO_ACTUALIZA', caso.cliente, detalle);
  return { ok:true, msg:'✅ Caso actualizado.' };
}

/** Crear convenio: cierra vigentes, genera mini calendario, pone estatus CONVENIO. */
export async function crearConvenio(caso, d, perfil) {
  const plan = planConvenio(d.monto, d.numPagos, d.fechaInicio);
  // cerrar convenios vigentes previos
  await db.from('convenios_juridico').update({ estatus:'REEMPLAZADO' }).ilike('cliente', caso.cliente).eq('estatus','VIGENTE');
  await db.from('convenios_juridico').insert({ cliente:caso.cliente, fecha:new Date().toISOString().slice(0,10), monto_acordado:parseFloat(d.monto)||0, num_pagos:parseInt(d.numPagos)||0, autor:(perfil&&perfil.email)||'', estatus:'VIGENTE' });
  // mini calendario
  const rows = plan.pagos.map(p => ({ cliente:caso.cliente, n_pago:p.nPago, fecha:p.fecha, monto:p.monto, pagado:0, estatus:'PENDIENTE' }));
  await db.from('pagos_convenio').insert(rows);
  // estatus caso + bitácora
  await db.from('cartera_juridico').update({ estatus:'CONVENIO' }).eq('id', caso.id);
  await db.from('cartera_juridico_bitacora').insert({ cliente:caso.cliente, autor:(perfil&&perfil.email)||'', estatus:'CONVENIO', nota:'Convenio creado: '+money(d.monto)+' en '+d.numPagos+' pagos de '+money(plan.montoPago) });
  await logAudit(perfil, 'JURIDICO_CONVENIO', caso.cliente, money(d.monto)+' en '+d.numPagos+' pagos');
  return { ok:true, msg:'✅ Convenio creado.' };
}

/** Registrar pago de un convenio + afectar banco. */
export async function pagarConvenioPago(cliente, pago, cuenta, perfil) {
  await db.from('pagos_convenio').update({ pagado:pago.monto, estatus:'PAGADO' }).eq('id', pago.id);
  if (cuenta) {
    await agregarMovimientoBanco({ tipo:'INGRESO', cuenta, monto:pago.monto, concepto:'Convenio '+cliente+' pago '+pago.nPago, origen:'JURIDICO', obs:'Pago de convenio' }, perfil);
  }
  await db.from('cartera_juridico_bitacora').insert({ cliente, autor:(perfil&&perfil.email)||'', estatus:'CONVENIO', nota:'Pago '+pago.nPago+' del convenio recibido: '+money(pago.monto) });
  await logAudit(perfil, 'JURIDICO_CONVENIO_PAGO', cliente, 'pago '+pago.nPago+' · '+money(pago.monto));
  return { ok:true, msg:'✅ Pago de convenio registrado.' };
}
