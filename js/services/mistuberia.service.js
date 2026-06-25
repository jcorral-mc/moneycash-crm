// Lógica de "Mi Tubería" — visualizador read-only del pipeline (ejecutivos y gerencia).
// Réplica de pipelineTuberia del Script, leyendo de la tabla prospectos.
import { ETAPAS_TODAS, diasDe } from './tuberia.service.js';
import { norm } from '../lib/dom.js';

// Grupo por etapa: activo = en proceso · ganado = surtido · cerrado = rechazos/cancelado
const GRUPO = {
  'Prospecto / Nuevo':'activo', 'En Contacto / Evaluación':'activo', 'Checklist':'activo',
  'En Espera de Documentos':'activo', 'Documentos Recibidos / Revisión':'activo',
  'Visita Domiciliaria':'activo', 'Listo para Surtir':'activo',
  'Surtidos':'ganado',
  'Rechazado':'cerrado', 'Rechazado por Vigencia':'cerrado', 'Cancelado':'cerrado',
};
export function grupoEtapa(status) { return GRUPO[status] || 'activo'; }

// Color de borde por grupo (paleta banco).
export function colorGrupo(g) {
  return g === 'ganado' ? 'var(--green)' : (g === 'cerrado' ? 'var(--slate)' : 'var(--steel)');
}

function mesDe(p) {
  const raw = p && (p.fecha_creacion || p.created_at);
  if (!raw) return '';
  const f = new Date(raw); if (isNaN(f.getTime())) return '';
  return f.getFullYear() + '-' + String(f.getMonth() + 1).padStart(2, '0');
}

/** Lista de meses con prospectos (yyyy-MM), más reciente primero. */
export function mesesDisponibles(prospectos) {
  const set = new Set();
  for (const p of (prospectos || [])) { const m = mesDe(p); if (m) set.add(m); }
  return [...set].sort().reverse();
}

/** Lista de ejecutivos presentes (para el filtro de gerencia). */
export function ejecutivosDe(prospectos) {
  const set = new Set();
  for (const p of (prospectos || [])) { const e = String(p.ejecutivo || '').trim(); if (e) set.add(e); }
  return [...set].sort();
}

// scope: 'mes' filtra por yyMM · 'todos' = sin filtro de mes.
export function construirPipeline(prospectos, { ejecutivo = '', mes = '', scope = 'mes', busca = '' } = {}) {
  const q = norm(busca || '');
  const lista = (prospectos || []).filter(p => {
    if (ejecutivo && String(p.ejecutivo || '').toUpperCase() !== String(ejecutivo).toUpperCase()) return false;
    if (scope === 'mes' && mes && mesDe(p) !== mes) return false;
    if (q && norm(p.nombre).indexOf(q) < 0) return false;
    return true;
  });
  const grupos = {}; ETAPAS_TODAS.forEach(e => grupos[e] = []);
  for (const p of lista) { if (grupos[p.status]) grupos[p.status].push(p); }

  let enProceso = 0, montoProceso = 0, ganados = 0;
  const etapas = ETAPAS_TODAS.map(e => {
    const arr = grupos[e].slice().sort((a, b) => diasDe(b) - diasDe(a));
    const monto = arr.reduce((s, p) => s + (Number(p.monto) || 0), 0);
    const g = grupoEtapa(e);
    if (g === 'activo') { enProceso += arr.length; montoProceso += monto; }
    if (g === 'ganado') ganados += arr.length;
    return { etapa: e, grupo: g, count: arr.length, monto: Math.round(monto), prospectos: arr };
  });
  return { etapas, resumen: { enProceso, montoProceso: Math.round(montoProceso), ganados } };
}
