// Lógica de Movimientos — RÉPLICA de registrarMovimiento + obtenerMovimientos (Apps Script),
// extendida con DILIGENCIAS y ENTRADAS EXTRAORDINARIAS (solicitadas por el negocio).
const U = s => String(s||'').toUpperCase();
const MESES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];

// Tipos de movimiento y su efecto en banco. EGRESO = sale dinero; INGRESO = entra.
export const MOV_TIPOS = [
  { tipo:'GASTOS FIJOS',           efecto:'EGRESO',  persona:false },
  { tipo:'GASTOS VARIOS',          efecto:'EGRESO',  persona:false },
  { tipo:'NOMINA',                 efecto:'EGRESO',  persona:true  },   // subconcepto = empleado
  { tipo:'INTERESES',              efecto:'EGRESO',  persona:true  },   // subconcepto = inversionista
  { tipo:'DILIGENCIAS',            efecto:'EGRESO',  persona:false },
  { tipo:'ENTRADAS EXTRAORDINARIAS', efecto:'INGRESO', persona:false },
];
export const tipoInfo = t => MOV_TIPOS.find(x => x.tipo === U(t)) || null;

/** Validación de registrarMovimiento. Devuelve datos normalizados o lanza Error. */
export function validarMovimiento(d) {
  const info = tipoInfo(d.tipo);
  if (!info) throw new Error('Tipo de movimiento inválido.');
  const cuenta = String(d.cuenta||'').trim();
  if (!cuenta) throw new Error('Indica el banco de afectación.');
  const monto = Math.round((parseFloat(d.monto)||0)*100)/100;
  if (monto <= 0) throw new Error('El monto debe ser mayor a 0.');
  const subconcepto = String(d.subconcepto||'').trim();
  let concepto = String(d.concepto||'').trim();
  if (info.persona) {
    if (!subconcepto) throw new Error('Selecciona ' + (info.tipo==='NOMINA'?'el empleado':'el inversionista') + '.');
    if (!concepto) concepto = subconcepto;
  } else {
    if (!concepto) throw new Error('Escribe el concepto.');
  }
  return { tipo:info.tipo, efecto:info.efecto, cuenta, monto, concepto, subconcepto,
           fecha: d.fecha || new Date().toISOString().slice(0,10) };
}

/** RÉPLICA de obtenerMovimientos: totales por tipo + detalle + agrupado por persona + gran total (del mes). */
export function construirResumen(movimientos, mes, anio) {
  const hoy = new Date();
  const m = (mes!=null && mes!=='') ? parseInt(mes) : hoy.getMonth();
  const y = (anio!=null && anio!=='') ? parseInt(anio) : hoy.getFullYear();
  const yyMM = `${y}-${String(m+1).padStart(2,'0')}`;

  const totales = {}; MOV_TIPOS.forEach(t => totales[t.tipo] = { total:0, items:[] });
  let granTotal = 0;
  for (const r of (movimientos||[])) {
    if (!r.fecha) continue;
    const tipo = U(r.origen);                  // en v2 el "tipo de movimiento" viaja en `origen`
    if (!totales[tipo]) continue;
    if (String(r.fecha).slice(0,7) !== yyMM) continue;
    const monto = Number(r.monto)||0;
    totales[tipo].total += monto; granTotal += monto;
    totales[tipo].items.push({ fecha:String(r.fecha).slice(0,10), cuenta:r.cuenta, monto, concepto:r.concepto||'', subconcepto:r.subconcepto||'' });
  }

  const agrupados = {};
  MOV_TIPOS.forEach(t => {
    totales[t.tipo].items.sort((a,b)=> b.fecha<a.fecha?-1:b.fecha>a.fecha?1:0);
    if (t.persona) {
      const porPersona = {};
      totales[t.tipo].items.forEach(it => {
        const k = it.subconcepto || '(sin nombre)';
        if (!porPersona[k]) porPersona[k] = { persona:k, total:0, movs:[] };
        porPersona[k].total += it.monto; porPersona[k].movs.push(it);
      });
      agrupados[t.tipo] = Object.values(porPersona).sort((a,b)=>b.total-a.total);
    }
  });

  return { mes:m, anio:y, etiqueta:MESES[m]+' '+y,
    resumen: MOV_TIPOS.map(t => ({ tipo:t.tipo, efecto:t.efecto, total:totales[t.tipo].total, count:totales[t.tipo].items.length })),
    detalle: totales, agrupados, granTotal };
}
