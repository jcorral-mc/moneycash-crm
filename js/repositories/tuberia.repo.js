// Repositorio de Tubería — prospectos, etapas, evaluación y puente completo a cartera.
import { db } from '../lib/supabase.js';
import { logAudit } from '../lib/audit.js';
import { siguienteEtapa, generarFolio } from '../services/tuberia.service.js';
import { construirAlta } from '../services/calendario.service.js';
import { calcularSurtimiento, validarReparto } from '../services/surtir.service.js';
import { calcularScore } from '../services/evaluacion.service.js';
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

/** Guarda la evaluación de riesgo (score + respuestas). */
export async function guardarEvaluacion(prospecto, respuestas, perfil) {
  const score = calcularScore(respuestas);
  const cot = prospecto.cotizacion_json || {};
  cot.evaluacion = { respuestas, score, fecha: hoy() };
  await db.from('prospectos').update({ score_eval:score, cotizacion_json:cot }).eq('id', prospecto.id);
  await logAudit(perfil, 'TUB_EVALUACION', prospecto.nombre, 'score '+score);
  return { ok:true, score };
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
