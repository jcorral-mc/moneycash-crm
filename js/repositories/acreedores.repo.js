// Repositorio de Acreedores (inversionistas) — RÉPLICA de guardar/baja/pagarAcreedor.
import { db } from '../lib/supabase.js';
import { agregarMovimientoBanco } from './bancos.repo.js';
import { logAudit } from '../lib/audit.js';

const money = n => '$'+Number(n||0).toLocaleString('es-MX',{maximumFractionDigits:0});

export async function fetchAcreedores() {
  const { data } = await db.from('acreedores').select('*').order('nombre');
  return data || [];
}

/** Histórico de pagos del acreedor: movimientos ligados por concepto o por intereses (subconcepto). */
export async function fetchHistorico(nombre) {
  const n = String(nombre||'');
  const { data: a } = await db.from('movimientos').select('*').ilike('concepto', 'ACREEDOR: '+n+'%').order('fecha',{ascending:false});
  const { data: b } = await db.from('movimientos').select('*').eq('origen','INTERESES').ilike('subconcepto', n).order('fecha',{ascending:false});
  return [ ...(a||[]), ...(b||[]) ];
}

/** RÉPLICA de guardarAcreedor: alta o edición. */
export async function guardarAcreedor(d, perfil) {
  if (!d.nombre || !String(d.nombre).trim()) throw new Error('Falta el nombre del acreedor.');
  const fila = {
    nombre: String(d.nombre).trim().toUpperCase(), tipo: String(d.tipo||'INVERSIONISTA').toUpperCase(),
    monto_debo: parseFloat(d.montoDebo)||0, pct_interes: parseFloat(d.pctInteres)||0,
    frecuencia: String(d.frecuencia||'').toUpperCase(), prox_pago: d.proxPago||null,
    saldo: parseFloat(d.saldo!=null && d.saldo!=='' ? d.saldo : d.montoDebo)||0,
    notas: String(d.notas||''), activo: true,
  };
  if (d.id) {
    const { error } = await db.from('acreedores').update(fila).eq('id', d.id);
    if (error) throw error;
    await logAudit(perfil, 'ACREEDOR_EDITADO', fila.nombre, '');
    return { ok:true, msg:'Acreedor actualizado.' };
  }
  fila.acreedor_id = 'AC'+Date.now();
  const { error } = await db.from('acreedores').insert(fila);
  if (error) throw error;
  await logAudit(perfil, 'ACREEDOR_ALTA', fila.nombre, 'capital '+money(fila.monto_debo));
  return { ok:true, msg:'Acreedor dado de alta.' };
}

export async function bajaAcreedor(id, perfil) {
  const { error } = await db.from('acreedores').update({ activo:false }).eq('id', id);
  if (error) throw error;
  await logAudit(perfil, 'ACREEDOR_BAJA', String(id), '');
  return { ok:true, msg:'Acreedor dado de baja.' };
}

/** RÉPLICA de pagarAcreedor: EGRESO (le pago → baja saldo) / INGRESO (me prestó más → sube saldo). Afecta banco. */
export async function pagarAcreedor(d, perfil) {
  const monto = parseFloat(d.monto)||0;
  if (monto<=0) throw new Error('Monto inválido.');
  const { data: ac } = await db.from('acreedores').select('*').eq('id', d.id).maybeSingle();
  if (!ac) throw new Error('Acreedor no encontrado.');
  const esEgreso = String(d.tipoMov||'EGRESO').toUpperCase()==='EGRESO';
  const saldoActual = Number(ac.saldo)||0;
  const nuevoSaldo = esEgreso ? Math.max(0, saldoActual-monto) : saldoActual+monto;
  await db.from('acreedores').update({ saldo: nuevoSaldo }).eq('id', ac.id);
  if (d.cuenta) {
    await agregarMovimientoBanco({ tipo: esEgreso?'EGRESO':'INGRESO', cuenta:d.cuenta, monto,
      concepto:'ACREEDOR: '+ac.nombre, origen:'ACREEDOR', obs: esEgreso?'Pago a acreedor':'Préstamo recibido' }, perfil);
  }
  await logAudit(perfil, esEgreso?'ACREEDOR_PAGO':'ACREEDOR_INGRESO', ac.nombre, money(monto)+' · saldo→'+nuevoSaldo);
  return { ok:true, msg:(esEgreso?'Pago':'Ingreso')+' registrado. Nuevo saldo: '+money(nuevoSaldo) };
}
