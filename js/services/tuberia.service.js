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

/** Resumen para el dashboard de tubería (conteos + tasa de conversión). */
export function dashboardTuberia(prospectos) {
  const total = (prospectos||[]).length;
  const surtidos = (prospectos||[]).filter(p=>String(p.status)==='Surtidos').length;
  const rechazados = (prospectos||[]).filter(p=>['Rechazado','Cancelado'].includes(String(p.status))).length;
  const activos = total - surtidos - rechazados;
  const conversion = total>0 ? Math.round(surtidos/total*1000)/10 : 0;
  return { total, surtidos, rechazados, activos, conversion };
}
