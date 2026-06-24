// Repositorio de Compensaciones — config, bases, cálculo por mes, corte mensual.
import { db } from '../lib/supabase.js';
import { logAudit } from '../lib/audit.js';
import { COMP_DEFAULT, calcular, interesCobrado, aperturaCobrada, carteraActualCapital } from '../services/compensaciones.service.js';

async function todo(tabla, cols) {
  let all=[], from=0, page=1000;
  for (let i=0;i<15;i++){ const { data } = await db.from(tabla).select(cols).range(from, from+page-1); const d=data||[]; all=all.concat(d); if(d.length<page) break; from+=page; }
  return all;
}

export async function fetchConfig() {
  const { data } = await db.from('comp_config').select('config').eq('id',1).maybeSingle();
  return (data && data.config) || COMP_DEFAULT;
}
export async function guardarConfig(cfg, perfil) {
  if (!cfg || !cfg.pctMeta || !Array.isArray(cfg.escalones)) throw new Error('Configuración inválida.');
  await db.from('comp_config').upsert({ id:1, config:cfg });
  await logAudit(perfil, 'COMP_CONFIG', 'escalones', 'pctMeta '+cfg.pctMeta);
  return { ok:true, msg:'✅ Configuración guardada.' };
}
export async function fetchBases(anio, mes) {
  const { data } = await db.from('comp_bases').select('*').eq('anio',anio).eq('mes',mes).order('ejecutivo');
  return data || [];
}
export async function guardarBase(ejecutivo, anio, mes, monto, perfil) {
  await db.from('comp_bases').upsert({ ejecutivo:String(ejecutivo).toUpperCase(), anio, mes, cartera_base:parseFloat(monto)||0 }, { onConflict:'ejecutivo,anio,mes' });
  await logAudit(perfil, 'COMP_BASE', ejecutivo, anio+'-'+mes+' · '+monto);
  return { ok:true, msg:'✅ Base guardada.' };
}

/** Calcula la compensación de todos los ejecutivos con base en el mes dado. */
export async function calcularMes(anio, mes) {
  const yyMM = `${anio}-${String(mes).padStart(2,'0')}`;
  const [bases, cfg, desglose, cartera] = await Promise.all([
    fetchBases(anio, mes), fetchConfig(), todo('desglose','fecha,ejecutivo,interes,tipo,cliente'), todo('cartera','ejecutivo,capital,saldo'),
  ]);
  const filas = bases.map(b => {
    const cobrado = interesCobrado(desglose, b.ejecutivo, yyMM);
    const apertura = aperturaCobrada(desglose, b.ejecutivo, yyMM);
    const carteraAct = carteraActualCapital(cartera, b.ejecutivo);
    return calcular(b.ejecutivo, b.cartera_base, cobrado, carteraAct, apertura, cfg);
  }).sort((a,b)=>b.pct-a.pct);
  const totales = filas.reduce((t,f)=>({ meta:t.meta+f.meta, cobrado:t.cobrado+f.cobrado, comision:t.comision+f.comision }), {meta:0,cobrado:0,comision:0});
  return { filas, totales, cfg };
}

/** Compensación de un solo ejecutivo (su medidor). */
export async function calcularEjecutivo(ejecutivo, anio, mes) {
  const yyMM = `${anio}-${String(mes).padStart(2,'0')}`;
  const [bases, cfg, desglose, cartera] = await Promise.all([
    fetchBases(anio, mes), fetchConfig(), todo('desglose','fecha,ejecutivo,interes,tipo,cliente'), todo('cartera','ejecutivo,capital,saldo'),
  ]);
  const base = (bases.find(b => String(b.ejecutivo).toUpperCase()===String(ejecutivo).toUpperCase())||{}).cartera_base || 0;
  const cobrado = interesCobrado(desglose, ejecutivo, yyMM);
  const apertura = aperturaCobrada(desglose, ejecutivo, yyMM);
  const carteraAct = carteraActualCapital(cartera, ejecutivo);
  return { calc: calcular(ejecutivo, base, cobrado, carteraAct, apertura, cfg), cfg, apertura };
}

/** Corte mensual: congela la cartera actual de cada ejecutivo como base del mes siguiente. */
export async function correrCorte(perfil) {
  const hoy = new Date();
  let m = hoy.getMonth()+2, a = hoy.getFullYear();
  if (m>12) { m=1; a++; }
  const cartera = await todo('cartera','ejecutivo,capital,saldo');
  const porEjec = {};
  for (const c of cartera) { const e=String(c.ejecutivo||'').toUpperCase(); if(!e||e==='JURIDICO') continue; porEjec[e]=(porEjec[e]||0)+(Number(c.capital)||0); }
  const rows = Object.keys(porEjec).map(e => ({ ejecutivo:e, anio:a, mes:m, cartera_base:Math.round(porEjec[e]) }));
  if (rows.length) await db.from('comp_bases').upsert(rows, { onConflict:'ejecutivo,anio,mes' });
  await logAudit(perfil, 'COMP_CORTE', a+'-'+m, rows.length+' ejecutivos');
  return { ok:true, mes:m, anio:a, ejecutivos:rows.length, msg:`✅ Corte hecho: ${rows.length} bases congeladas para ${m}/${a}.` };
}
