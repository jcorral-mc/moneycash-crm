// Repositorio de Tubería — prospectos, avanzar etapa, enviar a cartera.
import { db } from '../lib/supabase.js';
import { logAudit } from '../lib/audit.js';
import { ETAPAS, siguienteEtapa, generarFolio } from '../services/tuberia.service.js';
import { construirAlta } from '../services/calendario.service.js';
import { crearAlta, existeCliente } from '../repositories/alta.repo.js';

export async function fetchProspectos() {
  let all=[], from=0, page=1000;
  for (let i=0;i<15;i++){ const { data } = await db.from('prospectos').select('*').order('fecha_creacion',{ascending:false}).range(from, from+page-1); const d=data||[]; all=all.concat(d); if(d.length<page) break; from+=page; }
  return all;
}

/** Crea un prospecto a partir de una cotización. */
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

export async function cambiarStatus(prospecto, nuevoStatus, perfil) {
  // Si pasa a Surtidos, primero mandamos a cartera
  if (nuevoStatus === 'Surtidos' && !prospecto.enviado_cartera) {
    await enviarACartera(prospecto, perfil);
  }
  await db.from('prospectos').update({ status:nuevoStatus }).eq('id', prospecto.id);
  await logAudit(perfil, 'TUB_STATUS', prospecto.nombre, nuevoStatus);
  return { ok:true, msg:'Estado → '+nuevoStatus };
}

export async function avanzar(prospecto, perfil) {
  const sig = siguienteEtapa(prospecto.status);
  if (!sig) throw new Error('El prospecto ya está en la última etapa.');
  return cambiarStatus(prospecto, sig, perfil);
}

export async function rechazar(prospecto, motivo, perfil) {
  await db.from('prospectos').update({ status:'Rechazado', notas:(prospecto.notas||'')+'\nRECHAZADO: '+(motivo||'') }).eq('id', prospecto.id);
  await logAudit(perfil, 'TUB_RECHAZADO', prospecto.nombre, motivo||'');
  return { ok:true, msg:'Prospecto rechazado.' };
}

/** Puente: crea el cliente en cartera + su calendario (reusa el alta). */
export async function enviarACartera(prospecto, perfil) {
  const nombre = String(prospecto.nombre||'').trim();
  if (await existeCliente(nombre)) throw new Error('Ya existe un cliente con ese nombre en cartera.');
  const d = {
    nombre, ejecutivo:prospecto.ejecutivo, monto:prospecto.monto, comision:prospecto.comision,
    plazo:prospecto.plazo, frecuencia:prospecto.frecuencia, tipo:prospecto.tipo,
    abonoPuntual:prospecto.abono_puntual, abonoImpuntual:prospecto.abono_impuntual,
    tipoComision: prospecto.financiar ? 'FINANCIADA' : 'DESCONTADA',
  };
  const { cartera, calendarioRows } = construirAlta(d);
  await crearAlta(cartera, calendarioRows);
  await db.from('prospectos').update({ enviado_cartera:true }).eq('id', prospecto.id);
  await logAudit(perfil, 'TUB_A_CARTERA', nombre, prospecto.tipo+' '+prospecto.monto);
  return { ok:true, msg:'✅ '+nombre+' enviado a cartera con su calendario.' };
}
