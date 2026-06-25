// Lógica de Desglose — réplica de la pantalla del Script (obtenerDesglose + filtros).
// Carga del mes (rol/ejecutivo) + filtros (ejecutivo/banco/periodo/cliente) + agrupado por día.
import { norm } from '../lib/dom.js';

const enMes = (fecha, yyMM) => !yyMM || String(fecha||'').slice(0,7) === yyMM;
const MES_NOM = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];

function hoyISO() { const h=new Date(); return h.getFullYear()+'-'+String(h.getMonth()+1).padStart(2,'0')+'-'+String(h.getDate()).padStart(2,'0'); }

/**
 * RÉPLICA de obtenerDesglose + aplicar(): filtra por mes, rol y los filtros de la UI.
 * filtros: { yyMM, ejecutivo, banco, periodo:'mes'|'hoy'|'sem', cliente }
 */
export function construirDesglose(desglose, filtros={}, rol, ejecutivoSesion) {
  const { yyMM='', ejecutivo='', banco='', periodo='mes', cliente='' } = filtros;
  const forzarEjec = (rol==='EJECUTIVO') ? ejecutivoSesion : null;
  const lista = [];
  let tMonto=0, tCap=0, tInt=0, tMulta=0;
  const ejecsSet = new Set(), bancosSet = new Set();
  const hISO = hoyISO();

  for (const r of (desglose||[])) {
    if (!enMes(r.fecha, yyMM)) continue;
    // Catálogos del mes (para los selects), antes de aplicar filtros de ejecutivo/banco
    if (r.ejecutivo) ejecsSet.add(String(r.ejecutivo));
    if (r.cuenta) bancosSet.add(String(r.cuenta));
    // Rol: ejecutivo solo lo suyo
    if (forzarEjec && norm(r.ejecutivo)!==norm(forzarEjec)) continue;
    // Filtros de la UI
    if (ejecutivo && norm(r.ejecutivo)!==norm(ejecutivo)) continue;
    if (banco && norm(r.cuenta)!==norm(banco)) continue;
    if (cliente && norm(r.cliente).indexOf(norm(cliente))<0) continue;
    const fISO = String(r.fecha||'').slice(0,10);
    if (periodo==='hoy' && fISO!==hISO) continue;
    if (periodo==='sem') { const d=(new Date(hISO)-new Date(fISO))/86400000; if (d<0||d>7) continue; }

    const monto=Number(r.pago)||0, cap=Number(r.capital)||0, int=Number(r.interes)||0, multa=Number(r.multa)||0;
    tMonto+=monto; tCap+=cap; tInt+=int; tMulta+=multa;
    lista.push({
      fecha: fdate(fISO), fechaISO: fISO,
      cliente:String(r.cliente||''), ejecutivo:String(r.ejecutivo||''), cuenta:String(r.cuenta||''),
      monto:Math.round(monto), capital:Math.round(cap), interes:Math.round(int), multa:Math.round(multa),
      tipo:String(r.tipo||''), formaPago:String(r.forma_pago||''),
    });
  }
  lista.sort((a,b)=> a.fechaISO<b.fechaISO?1:a.fechaISO>b.fechaISO?-1:0);
  const mes = parseInt((yyMM||'').slice(5,7))||0;
  const anio = (yyMM||'').slice(0,4);
  return {
    lista, total:lista.length,
    totales:{ monto:Math.round(tMonto), pago:Math.round(tMonto), capital:Math.round(tCap), interes:Math.round(tInt), multa:Math.round(tMulta) },
    ejecutivos:[...ejecsSet].sort(), bancos:[...bancosSet].sort(),
    mesVista: mes ? (MES_NOM[mes-1]+' '+anio) : '',
  };
}

/** Agrupa la lista por día (fechaISO desc), con total por día. */
export function agruparPorDia(lista) {
  const dias = {};
  for (const x of lista) { (dias[x.fechaISO] = dias[x.fechaISO] || []).push(x); }
  return Object.keys(dias).sort().reverse().map(iso => {
    const abonos = dias[iso];
    let total=0; abonos.forEach(a=>total+=a.monto);
    return { fechaISO:iso, label:etiquetaDia(iso), abonos, total:Math.round(total) };
  });
}

/** Etiqueta de día "lun 5 jun". */
const DIA = ['dom','lun','mar','mié','jue','vie','sáb'];
const MES3 = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
export function etiquetaDia(iso) {
  const p = String(iso).split('-'); if (p.length<3) return iso;
  const d = new Date(+p[0], +p[1]-1, +p[2]);
  return DIA[d.getDay()] + ' ' + (+p[2]) + ' ' + MES3[+p[1]-1];
}

/** Color del chip por ejecutivo [bg, fg] — réplica del Script. */
const COLORS = { CESAR:['#E8EFF6','#103A63'], LORENA:['#FAF1DA','#8A6D14'], JURIDICO:['#EAEFF4','#3F4F5C'], RENOVACION:['#E7F3EC','#1E7A52'], APERTURA:['#E3ECF5','#2E6FB0'] };
const PAL = [['#E8EFF6','#103A63'],['#EAEFF4','#3F4F5C'],['#FAF1DA','#8A6D14'],['#E7F3EC','#1E7A52'],['#FBEAE7','#9A3327']];
export function colorEjecutivo(ej) {
  const e = String(ej||'').toUpperCase();
  if (COLORS[e]) return COLORS[e];
  let h=0; for (let i=0;i<e.length;i++) h=(h*31+e.charCodeAt(i))%PAL.length;
  return PAL[h] || PAL[0];
}

function fdate(iso) { const p=String(iso).split('-'); return p.length===3 ? `${p[2]}/${p[1]}/${p[0]}` : iso; }
