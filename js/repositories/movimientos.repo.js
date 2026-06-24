// Repositorio de Movimientos — registra gasto/nómina/interés/diligencia/entrada y afecta banco.
import { db } from '../lib/supabase.js';
import { agregarMovimientoBanco } from './bancos.repo.js';
import { validarMovimiento, MOV_TIPOS } from '../services/movimientos.service.js';
import { logAudit } from '../lib/audit.js';

/** RÉPLICA de registrarMovimiento: valida, afecta banco (egreso/ingreso), audita. */
export async function registrarMovimiento(d, perfil) {
  const v = validarMovimiento(d);
  await agregarMovimientoBanco({
    tipo: v.efecto, cuenta: v.cuenta, monto: v.monto, concepto: v.concepto,
    subconcepto: v.subconcepto, origen: v.tipo, obs: d.descripcion||d.obs||'', fecha: v.fecha,
  }, perfil);
  await logAudit(perfil, 'MOVIMIENTO_'+v.tipo.replace(/ /g,'_'), v.cuenta, `${v.efecto} $${v.monto} · ${v.concepto}`);
  return { ok:true, msg:`✅ ${v.tipo} de $${v.monto.toLocaleString('es-MX')} registrado y aplicado a ${v.cuenta}.` };
}

/** Movimientos de gasto/operación (los 6 tipos), para el módulo Movimientos. */
export async function fetchMovimientos() {
  const tipos = MOV_TIPOS.map(t => t.tipo);
  let all=[], from=0, page=1000;
  for (let i=0;i<10;i++) {
    const { data } = await db.from('movimientos').select('*').in('origen', tipos).order('fecha',{ascending:false}).range(from, from+page-1);
    const d = data||[]; all = all.concat(d); if (d.length<page) break; from+=page;
  }
  return all;
}
