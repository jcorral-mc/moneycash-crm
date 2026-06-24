// Repositorio de Conciliación — lee pendientes y EJECUTA el plan de aplicación.
import { db } from '../lib/supabase.js';
import { agregarMovimientoBanco } from './bancos.repo.js';

export async function fetchPendientes() {
  const { data } = await db.from('pagos_pendientes').select('*').eq('estatus','PENDIENTE').order('created_at',{ascending:true});
  return data || [];
}

export async function marcarPendiente(id, estatus, por) {
  const { error } = await db.from('pagos_pendientes').update({ estatus, conciliado_por: por||'' }).eq('id', id);
  if (error) throw error;
}

/** Ejecuta el plan calculado por planAplicarPago: calendario, saldo, banco, desglose, y marca APLICADO. */
export async function ejecutarPlan(plan, carteraId, pendienteId, por) {
  // 1) Actualizar pagos del calendario
  for (const u of plan.calUpdates) {
    const patch = { pagado: u.pagado };
    if (u.estatus) patch.estatus = u.estatus;
    const { error } = await db.from('calendarios').update(patch).eq('id', u.id);
    if (error) throw error;
  }
  // 2) Insertar pagos nuevos (EXT mínimo)
  if (plan.calInserts && plan.calInserts.length) {
    const { error } = await db.from('calendarios').insert(plan.calInserts);
    if (error) throw error;
  }
  // 3) Actualizar saldo del cliente
  if (carteraId) {
    const patch = { saldo: plan.saldo };
    if (plan.saldo_capital != null) patch.saldo_capital = plan.saldo_capital;
    if (plan.saldo_interes != null) patch.saldo_interes = plan.saldo_interes;
    const { error } = await db.from('cartera').update(patch).eq('id', carteraId);
    if (error) throw error;
  }
  // 4) Banco (ingreso por cobranza) → libro mayor de movimientos + saldo, y banco_id para el desglose
  let bancoId = null;
  if (plan.cuenta) {
    const { data: b0 } = await db.from('bancos').select('id').ilike('cuenta', plan.cuenta).maybeSingle();
    bancoId = b0 ? b0.id : null;
    if (plan.bancoIngreso > 0) {
      await agregarMovimientoBanco({ tipo:'INGRESO', cuenta:plan.cuenta, monto:plan.bancoIngreso,
        concepto:'Cobranza '+plan.cliente, origen:'COBRANZA', obs:plan.detalle||'' }, { email: por });
    }
  }
  // 5) Desglose (uno por concepto: abono y multa van separados)
  const hoy = new Date().toISOString().slice(0,10);
  for (const d of plan.desglose) {
    await db.from('desglose').insert({ cartera_id:carteraId, banco_id:bancoId, fecha:hoy, cliente:plan.cliente,
      ejecutivo:plan.ejecutivo, pago:d.pago, capital:d.capital, interes:d.interes, tipo:d.tipo, forma_pago:'' });
  }
  // 6) Marcar el pendiente como APLICADO
  await marcarPendiente(pendienteId, 'APLICADO', por);
  return { ok:true, detalle: plan.detalle };
}
