// Dashboard operativo de Tubería — réplica de _aggregateDashboard() del Script.
// Toma la lista de prospectos y arma 4 tablas: tubería por sucursal, desglose
// surtido, intereses por sucursal y ventas por ejecutivo. Cálculo puro (sin DB).

const num = (v) => {
  if (typeof v === 'number') return isNaN(v) ? 0 : v;
  const n = parseFloat(String(v || '0').replace(/[^0-9.\-]/g, ''));
  return isNaN(n) ? 0 : n;
};

// Tasa: acepta 0.107 (fracción) o 10.7 (porcentaje) y devuelve siempre porcentaje.
const tasaPct = (v) => {
  const n = num(v);
  return n > 0 && n < 1 ? n * 100 : n;
};

/** Clasifica un estatus en una categoría del tablero. */
export function categoriaStatus(st) {
  const s = String(st || '').trim();
  if (!s) return 'PROCESO';
  if (s === 'Surtidos') return 'SURTIDO';
  if (s === 'Listo para Surtir') return 'POR_SURTIR';
  if (s.indexOf('Visita') >= 0) return 'VISITA';
  if (s === 'Rechazado' || s === 'Rechazado por Vigencia' || s === 'Cancelado') return 'RECHAZADO';
  return 'PROCESO';
}

/**
 * Agrega la lista de prospectos en las 4 tablas del dashboard.
 * @param {Array} prospectos filas crudas de la tabla `prospectos`
 * @returns {{tuberia:[], desglose:[], intereses:[], ejecutivos:[]}}
 */
export function agregarDashboard(prospectos) {
  const sucursales = {}, desglose = {}, intereses = {}, ejecutivos = {};

  const ensureSuc = (suc) => {
    if (!sucursales[suc]) sucursales[suc] = { SURTIDO: 0, POR_SURTIR: 0, VISITA: 0, PROCESO: 0, RECHAZADO: 0 };
    if (!desglose[suc]) desglose[suc] = { NUEVO: 0, REACTIVACION: 0, RENOVACION: 0 };
    if (!intereses[suc]) intereses[suc] = { montoInteres: 0, sumaTasa: 0, countTasa: 0 };
  };
  const ensureEje = (eje) => {
    if (!ejecutivos[eje]) ejecutivos[eje] = { surtido: 0, nuevos: 0, renovacion: 0, comision: 0 };
  };

  for (const p of (prospectos || [])) {
    const status = String(p.status || '').trim();
    const suc = String(p.sucursal || 'SIN SUCURSAL').trim().toUpperCase() || 'SIN SUCURSAL';
    const eje = String(p.ejecutivo || 'SIN EJECUTIVO').trim().toUpperCase() || 'SIN EJECUTIVO';
    const monto = num(p.monto);
    const tipo = String(p.tipo_cliente || '').trim().toUpperCase();
    const comision = num(p.comision);
    const cat = categoriaStatus(status);

    // Tasa e interés generado: preferimos el dato real de la cotización
    const cot = p.cotizacion_json || {};
    const tasa = cot.tasaPuntual != null ? tasaPct(cot.tasaPuntual) : tasaPct(p.interes_pct);
    const interesReal = num(cot.interesPuntual);

    ensureSuc(suc);
    ensureEje(eje);

    sucursales[suc][cat] += monto;

    if (cat === 'SURTIDO') {
      if (tipo === 'REACTIVACION' || tipo === 'REACTIVACIÓN') desglose[suc].REACTIVACION += monto;
      else if (tipo === 'RENOVACION' || tipo === 'RENOVACIÓN') desglose[suc].RENOVACION += monto;
      else desglose[suc].NUEVO += monto;

      if (monto > 0) {
        intereses[suc].montoInteres += interesReal > 0 ? interesReal : monto * (tasa / 100);
        intereses[suc].sumaTasa += tasa;
        intereses[suc].countTasa += 1;
      }

      ejecutivos[eje].surtido += monto;
      if (tipo === 'NUEVO' || tipo === '') ejecutivos[eje].nuevos += monto;
      if (tipo === 'RENOVACION' || tipo === 'RENOVACIÓN') ejecutivos[eje].renovacion += monto;
      ejecutivos[eje].comision += comision;
    }
  }

  const tablaTuberia = Object.keys(sucursales).sort().map(sk => {
    const d = sucursales[sk];
    return {
      sucursal: sk, surtido: d.SURTIDO, porSurtir: d.POR_SURTIR, visita: d.VISITA,
      proceso: d.PROCESO, rechazado: d.RECHAZADO,
      total: d.SURTIDO + d.POR_SURTIR + d.VISITA + d.PROCESO + d.RECHAZADO,
    };
  });

  const tablaDesglose = Object.keys(desglose).sort().map(sk => {
    const dd = desglose[sk];
    return { sucursal: sk, nuevos: dd.NUEVO, reactivacion: dd.REACTIVACION, renovacion: dd.RENOVACION };
  });

  const tablaIntereses = Object.keys(intereses).sort().map(sk => {
    const ii = intereses[sk];
    return { sucursal: sk, montoIntereses: ii.montoInteres, tasaPromedio: ii.countTasa > 0 ? ii.sumaTasa / ii.countTasa : 0 };
  });

  const tablaEjecutivos = Object.keys(ejecutivos).sort().map(ek => {
    const ed = ejecutivos[ek];
    return { ejecutivo: ek, surtido: ed.surtido, nuevos: ed.nuevos, renovacion: ed.renovacion, comision: ed.comision };
  });

  return { tuberia: tablaTuberia, desglose: tablaDesglose, intereses: tablaIntereses, ejecutivos: tablaEjecutivos };
}

/** Filtra prospectos por mes/año (sobre fecha_creacion). mes=0/anio=0 → todo. */
export function filtrarPorMes(prospectos, mes, anio) {
  if (!mes || !anio) return prospectos || [];
  return (prospectos || []).filter(p => {
    const f = p.fecha_creacion ? new Date(p.fecha_creacion) : null;
    if (!f || isNaN(f.getTime())) return false;
    return (f.getMonth() + 1) === mes && f.getFullYear() === anio;
  });
}

/** Años presentes en los datos (para el selector del dashboard). */
export function aniosDisponibles(prospectos) {
  const set = {};
  (prospectos || []).forEach(p => {
    const f = p.fecha_creacion ? new Date(p.fecha_creacion) : null;
    if (f && !isNaN(f.getTime())) set[f.getFullYear()] = true;
  });
  return Object.keys(set).map(Number).sort((a, b) => a - b);
}
