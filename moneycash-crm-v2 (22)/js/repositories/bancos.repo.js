// Repositorio de Bancos — movimientos afectan saldos automáticamente. RÉPLICA de las
// funciones del Script: _bancosAgregarMovimiento, ejecutarTransferencia/MovimientoDirecto,
// solicitar*, aprobar autorización, reversarMovimiento.
import { db } from '../lib/supabase.js';
import { logAudit } from '../lib/audit.js';

const hoy = () => new Date().toISOString().slice(0,10);
const money = n => '$'+Number(n||0).toLocaleString('es-MX',{maximumFractionDigits:0});

export async function fetchBancos() {
  const { data } = await db.from('bancos').select('*').order('cuenta');
  return data || [];
}
export async function fetchMovimientos() {
  let all=[], from=0, page=1000;
  for (let i=0;i<10;i++){
    const { data } = await db.from('movimientos').select('*').order('fecha',{ascending:false}).range(from, from+page-1);
    const d=data||[]; all=all.concat(d); if(d.length<page) break; from+=page;
  }
  return all;
}
export async function fetchAutorizaciones() {
  const { data } = await db.from('autorizaciones').select('*').eq('estatus','PENDIENTE').order('created_at',{ascending:true});
  return data || [];
}

/** _bancosAgregarMovimiento + actualización de saldo. Núcleo: TODO movimiento pasa por aquí. */
export async function agregarMovimientoBanco({ tipo, cuenta, monto, concepto, origen, obs, subconcepto, fecha }, perfil) {
  const { data: b } = await db.from('bancos').select('id,ingresos,egresos,saldo_sistema').ilike('cuenta', cuenta).maybeSingle();
  const banco_id = b ? b.id : null;
  const { error } = await db.from('movimientos').insert({
    fecha: fecha || hoy(), tipo, banco_id, cuenta, monto: Number(monto)||0,
    concepto: concepto||'', subconcepto: subconcepto||'', origen: origen||'', obs: obs||'',
    registrado_por: (perfil && perfil.email) || '',
  });
  if (error) throw error;
  if (b) {
    const ing = (Number(b.ingresos)||0) + (tipo==='INGRESO' ? Number(monto)||0 : 0);
    const egr = (Number(b.egresos)||0)  + (tipo==='EGRESO'  ? Number(monto)||0 : 0);
    const saldo = (Number(b.saldo_sistema)||0) + (tipo==='INGRESO' ? (Number(monto)||0) : -(Number(monto)||0));
    await db.from('bancos').update({ ingresos:ing, egresos:egr, saldo_sistema:saldo }).eq('id', b.id);
  }
  return banco_id;
}

/** Transferencia INMEDIATA (admin): EGRESO origen + INGRESO destino. */
export async function ejecutarTransferencia({ origen, destino, monto, concepto }, perfil) {
  origen=String(origen||'').trim(); destino=String(destino||'').trim(); monto=parseFloat(monto)||0;
  concepto=String(concepto||'Transferencia entre bancos').trim();
  if (!origen || !destino) throw new Error('Elige banco origen y destino.');
  if (origen===destino) throw new Error('Origen y destino no pueden ser el mismo banco.');
  if (monto<=0) throw new Error('Monto inválido.');
  await agregarMovimientoBanco({ tipo:'EGRESO', cuenta:origen, monto, concepto:'Transferencia a '+destino, origen:'TRANSFERENCIA', obs:concepto }, perfil);
  await agregarMovimientoBanco({ tipo:'INGRESO', cuenta:destino, monto, concepto:'Transferencia de '+origen, origen:'TRANSFERENCIA', obs:concepto }, perfil);
  await db.from('autorizaciones').insert({ tipo:'TRANSFERENCIA', referencia:origen+' → '+destino+' · '+money(monto), solicita:(perfil&&perfil.email)||'', estatus:'APROBADO', resuelto_por:(perfil&&perfil.email)||'', detalle:'EJECUTADA CON CLAVE', fecha:hoy() });
  await logAudit(perfil, 'TRANSFERENCIA', origen+'→'+destino, money(monto)+' · '+concepto);
  return { ok:true, msg:'✅ Transferencia de '+money(monto)+' ejecutada: '+origen+' → '+destino+'.' };
}

/** Entrada/Salida directa INMEDIATA (admin). tipo: 'INGRESO' | 'SALIDA'. */
export async function ejecutarMovimientoDirecto({ cuenta, monto, concepto, tipo }, perfil) {
  cuenta=String(cuenta||'').trim(); monto=parseFloat(monto)||0; concepto=String(concepto||'').trim();
  const esIngreso = U(tipo)==='INGRESO';
  if (!cuenta) throw new Error('Elige la cuenta.');
  if (monto<=0) throw new Error('Monto inválido.');
  if (!concepto) throw new Error('Escribe el concepto.');
  await agregarMovimientoBanco({ tipo: esIngreso?'INGRESO':'EGRESO', cuenta, monto, concepto, origen: esIngreso?'INGRESO DIRECTO':'SALIDA DIRECTA', obs:concepto }, perfil);
  await db.from('autorizaciones').insert({ tipo: esIngreso?'INGRESO DIRECTO':'SALIDA DIRECTA', referencia:(esIngreso?'↘ entra a ':'↗ sale de ')+cuenta+' · '+money(monto)+' — '+concepto, solicita:(perfil&&perfil.email)||'', estatus:'APROBADO', resuelto_por:(perfil&&perfil.email)||'', detalle:'EJECUTADA CON CLAVE', fecha:hoy() });
  await logAudit(perfil, esIngreso?'INGRESO DIRECTO':'SALIDA DIRECTA', cuenta, money(monto)+' · '+concepto);
  return { ok:true, msg:'✅ '+(esIngreso?'Entrada':'Salida')+' de '+money(monto)+' aplicada a '+cuenta+'.' };
}

/** Solicitar transferencia (Aux) → autorización del admin. nota = origen|destino|monto|concepto. */
export async function solicitarTransferencia({ origen, destino, monto, concepto }, perfil) {
  origen=String(origen||'').trim(); destino=String(destino||'').trim(); monto=parseFloat(monto)||0;
  concepto=String(concepto||'Transferencia entre bancos').trim();
  if (!origen || !destino) throw new Error('Elige banco origen y destino.');
  if (origen===destino) throw new Error('Origen y destino no pueden ser el mismo banco.');
  if (monto<=0) throw new Error('Monto inválido.');
  await db.from('autorizaciones').insert({ tipo:'TRANSFERENCIA', referencia:origen+' → '+destino+' · '+money(monto),
    solicita:(perfil&&perfil.email)||'', estatus:'PENDIENTE', nota:[origen,destino,monto,concepto].join('|'), fecha:hoy() });
  return { ok:true, msg:'✅ Transferencia enviada a autorización del admin.' };
}

/** Solicitar entrada/salida directa (Aux) → autorización. nota = cuenta|monto|concepto. tipo INGRESO/SALIDA */
export async function solicitarMovimientoDirecto({ cuenta, monto, concepto, tipo }, perfil) {
  cuenta=String(cuenta||'').trim(); monto=parseFloat(monto)||0; concepto=String(concepto||'').trim();
  const t = U(tipo)==='INGRESO' ? 'INGRESO DIRECTO' : 'SALIDA DIRECTA';
  if (!cuenta) throw new Error('Elige la cuenta.');
  if (monto<=0) throw new Error('Monto inválido.');
  if (!concepto) throw new Error('Escribe el concepto.');
  const flecha = t==='INGRESO DIRECTO' ? '↘ entra a ' : '↗ sale de ';
  await db.from('autorizaciones').insert({ tipo:t, referencia:flecha+cuenta+' · '+money(monto)+' — '+concepto,
    solicita:(perfil&&perfil.email)||'', estatus:'PENDIENTE', nota:[cuenta,monto,concepto].join('|'), fecha:hoy() });
  return { ok:true, msg:'✅ '+(t==='INGRESO DIRECTO'?'Ingreso':'Salida')+' enviado a autorización del admin.' };
}

/** Aprobar una autorización pendiente: ejecuta el movimiento según su tipo/nota. */
export async function aprobarAutorizacion(aut, perfil) {
  const partes = String(aut.nota||'').split('|');
  if (aut.tipo==='TRANSFERENCIA') {
    const [origen,destino,monto,concepto] = partes;
    await ejecutarTransferencia({ origen, destino, monto, concepto }, perfil);
  } else if (aut.tipo==='INGRESO DIRECTO' || aut.tipo==='SALIDA DIRECTA') {
    const [cuenta,monto,concepto] = partes;
    await ejecutarMovimientoDirecto({ cuenta, monto, concepto, tipo: aut.tipo==='INGRESO DIRECTO'?'INGRESO':'SALIDA' }, perfil);
  }
  await db.from('autorizaciones').update({ estatus:'APROBADO', resuelto_por:(perfil&&perfil.email)||'' }).eq('id', aut.id);
  await logAudit(perfil, 'AUTORIZACION_APROBADA', aut.tipo, aut.referencia||'');
  return { ok:true };
}
export async function rechazarAutorizacion(autId, perfil) {
  await db.from('autorizaciones').update({ estatus:'RECHAZADO', resuelto_por:(perfil&&perfil.email)||'' }).eq('id', autId);
  await logAudit(perfil, 'AUTORIZACION_RECHAZADA', String(autId), '');
  return { ok:true };
}

/** Reversar un movimiento (admin): mete el movimiento opuesto y marca el original. */
export async function reversarMovimiento(mov, perfil) {
  const opuesto = mov.tipo==='INGRESO' ? 'EGRESO' : 'INGRESO';
  await agregarMovimientoBanco({ tipo:opuesto, cuenta:mov.cuenta, monto:mov.monto,
    concepto:'REVERSO: '+(mov.origen||mov.concepto||''), origen:'REVERSO', obs:'reversa del mov #'+mov.id }, perfil);
  await db.from('movimientos').update({ reversado:true }).eq('id', mov.id);
  await logAudit(perfil, 'REVERSO_MOVIMIENTO', mov.cuenta, mov.tipo+' '+money(mov.monto)+' (#'+mov.id+')');
  return { ok:true, msg:'✅ Movimiento reversado: '+mov.tipo+' de '+money(mov.monto)+' en '+mov.cuenta+'. Banco restituido.' };
}

const U2 = s => String(s||'').toUpperCase();
function U(s){ return U2(s); }
