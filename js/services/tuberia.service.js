// Lógica de Tubería — pipeline de prospectos (etapas, mi tubería, folio, dashboard).
import { norm } from '../lib/dom.js';

export const ETAPAS = [
  'Prospecto / Nuevo',
  'En Contacto / Evaluación',
  'Checklist',
  'En Espera de Documentos',
  'Documentos Recibidos / Revisión',
  'Visita Domiciliaria',
  'Listo para Surtir',
  'Surtidos',
];
export const ETAPAS_CERRADAS = ['Surtidos','Rechazado','Cancelado'];

/** Siguiente etapa del pipeline (para el botón "Avanzar"). */
export function siguienteEtapa(status) {
  const i = ETAPAS.indexOf(status);
  if (i >= 0 && i < ETAPAS.length-1) return ETAPAS[i+1];
  return null;
}

/** Genera un folio legible NOMBRE-SUCURSAL-#### */
export function generarFolio(nombre, sucursal) {
  const ini = String(nombre||'').trim().split(/\s+/).map(w=>w[0]||'').join('').toUpperCase().slice(0,3) || 'XXX';
  const suc = String(sucursal||'GDL').trim().toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,3) || 'GDL';
  const n = String(Date.now()).slice(-4);
  return `${ini}-${suc}-${n}`;
}

/** Construye el pipeline agrupado por etapa, filtrando "mi tubería" para ejecutivos. */
export function construirPipeline(prospectos, rol, ejecutivo, soloMios) {
  const filtra = soloMios || rol === 'EJECUTIVO';
  const lista = (prospectos||[]).filter(p => {
    if (filtra && ejecutivo && norm(p.ejecutivo) !== norm(ejecutivo)) return false;
    return true;
  }).map(p => ({
    id:p.id, prospectId:String(p.prospect_id||''), nombre:String(p.nombre||''), telefono:String(p.telefono||''),
    sucursal:String(p.sucursal||''), ejecutivo:String(p.ejecutivo||''), status:String(p.status||'Prospecto / Nuevo'),
    monto:Number(p.monto)||0, plazo:Number(p.plazo)||0, frecuencia:String(p.frecuencia||''), tipo:String(p.tipo||''),
    deposito:Number(p.deposito)||0, abonoPuntual:Number(p.abono_puntual)||0, tipoCliente:String(p.tipo_cliente||''),
    enviadoCartera:!!p.enviado_cartera, score:p.score_eval,
  }));
  // Conteos por etapa
  const porEtapa = {}; ETAPAS.forEach(e=>porEtapa[e]=[]);
  const cerrados = { 'Rechazado':[], 'Cancelado':[] };
  for (const p of lista) {
    if (porEtapa[p.status]) porEtapa[p.status].push(p);
    else if (cerrados[p.status]) cerrados[p.status].push(p);
  }
  const activos = lista.filter(p => !ETAPAS_CERRADAS.includes(p.status));
  const montoEnPipeline = activos.reduce((s,p)=>s+p.monto, 0);
  return { lista, porEtapa, cerrados, total:lista.length, activos:activos.length, montoEnPipeline:Math.round(montoEnPipeline) };
}

// Estatus completos (incluye los finales) para el acordeón y el selector.
export const ETAPAS_TODAS = [
  'Prospecto / Nuevo',
  'En Contacto / Evaluación',
  'Checklist',
  'En Espera de Documentos',
  'Documentos Recibidos / Revisión',
  'Visita Domiciliaria',
  'Listo para Surtir',
  'Surtidos',
  'Rechazado',
  'Rechazado por Vigencia',
  'Cancelado',
];

// Color por estatus — SOLO paleta banco aprobada (sin colores del Script).
export const COLOR_ETAPA = {
  'Prospecto / Nuevo':              'var(--slate)',
  'En Contacto / Evaluación':       'var(--steel)',
  'Checklist':                      'var(--steel)',
  'En Espera de Documentos':        'var(--amber)',
  'Documentos Recibidos / Revisión':'var(--steel)',
  'Visita Domiciliaria':            'var(--navy)',
  'Listo para Surtir':              'var(--green)',
  'Surtidos':                       'var(--green)',
  'Rechazado':                      'var(--red)',
  'Rechazado por Vigencia':         'var(--red)',
  'Cancelado':                      'var(--slate)',
};

/** Días transcurridos desde el alta (fecha_creacion). */
export function diasDe(prospecto) {
  const raw = prospecto && (prospecto.fecha_creacion || prospecto.created_at);
  if (!raw) return 0;
  const f = new Date(raw);
  if (isNaN(f.getTime())) return 0;
  const d = Math.floor((Date.now() - f.getTime()) / 86400000);
  return d >= 0 ? d : 0;
}

/** Nivel de semáforo por días — verde 0-5, ámbar 6-7, rojo 8+. Finales → neutro. */
export function semaforo(prospecto) {
  if (ETAPAS_CERRADAS.includes(String(prospecto.status)) || String(prospecto.status).indexOf('Rechazado') >= 0)
    return { nivel: 'fin', color: 'var(--slate)' };
  const d = diasDe(prospecto);
  if (d <= 5) return { nivel: 'ok', color: 'var(--green)', dias: d };
  if (d <= 7) return { nivel: 'med', color: 'var(--amber)', dias: d };
  return { nivel: 'alto', color: 'var(--red)', dias: d };
}

/** Aplica filtros (búsqueda, ejecutivo, sucursal, tipo, fecha) a la lista cruda. */
export function filtrarProspectos(prospectos, f) {
  const q = norm(f.busca || '');
  let desde = null, hasta = null;
  const ahora = new Date(); ahora.setHours(23, 59, 59, 999);
  if (f.fecha === 'hoy') { desde = new Date(); desde.setHours(0, 0, 0, 0); hasta = ahora; }
  else if (['7', '15', '30'].includes(f.fecha)) { desde = new Date(); desde.setDate(desde.getDate() - parseInt(f.fecha)); desde.setHours(0, 0, 0, 0); hasta = ahora; }
  else if (f.fecha === 'custom') {
    if (f.desde) desde = new Date(f.desde + 'T00:00:00');
    if (f.hasta) hasta = new Date(f.hasta + 'T23:59:59');
  }
  return (prospectos || []).filter(p => {
    if (q) {
      const nom = norm(p.nombre), id = norm(p.prospect_id), tel = norm(p.telefono);
      if (!(nom.includes(q) || id.includes(q) || tel.includes(q))) return false;
    }
    if (f.ejecutivo && norm(p.ejecutivo) !== norm(f.ejecutivo)) return false;
    if (f.sucursal && norm(p.sucursal) !== norm(f.sucursal)) return false;
    if (f.tipo && norm(p.tipo) !== norm(f.tipo)) return false;
    if (desde || hasta) {
      const fp = p.fecha_creacion ? new Date(p.fecha_creacion) : null;
      if (!fp || isNaN(fp.getTime())) return true;
      if (desde && fp < desde) return false;
      if (hasta && fp > hasta) return false;
    }
    return true;
  });
}

/** Los 4 KPIs del tablero (sobre la lista ya filtrada). */
export function kpisPipeline(lista) {
  const finales = ['Surtidos', 'Rechazado', 'Rechazado por Vigencia', 'Cancelado'];
  const enProceso = (lista || []).filter(p => !finales.includes(String(p.status)));
  const monto = enProceso.reduce((s, p) => s + (Number(p.monto) || 0), 0);
  const listos = (lista || []).filter(p => String(p.status) === 'Listo para Surtir').length;
  const urgentes = enProceso.filter(p => diasDe(p) > 7).length;
  return { enProceso: enProceso.length, monto: Math.round(monto), listos, urgentes };
}

/** Agrupa la lista por estatus (incluyendo los finales) para el acordeón. */
export function agruparPorEstatus(lista) {
  const grupos = {}; ETAPAS_TODAS.forEach(e => grupos[e] = []);
  (lista || []).forEach(p => { const s = String(p.status || 'Prospecto / Nuevo'); if (grupos[s]) grupos[s].push(p); else (grupos['Prospecto / Nuevo'] = grupos['Prospecto / Nuevo'] || []).push(p); });
  return grupos;
}

/** Resumen para el dashboard de tubería (conteos + tasa de conversión). */
export function dashboardTuberia(prospectos) {
  const total = (prospectos||[]).length;
  const surtidos = (prospectos||[]).filter(p=>String(p.status)==='Surtidos').length;
  const rechazados = (prospectos||[]).filter(p=>['Rechazado','Cancelado'].includes(String(p.status))).length;
  const activos = total - surtidos - rechazados;
  const conversion = total>0 ? Math.round(surtidos/total*1000)/10 : 0;
  return { total, surtidos, rechazados, activos, conversion };
}
