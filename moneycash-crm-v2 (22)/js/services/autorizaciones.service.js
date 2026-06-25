// Lógica de Autorizaciones — bandeja unificada (autorizaciones + solicitudes de multa).
const money = n => '$'+Number(n||0).toLocaleString('es-MX',{maximumFractionDigits:0});
export const TIPOS_BANCO = ['TRANSFERENCIA','INGRESO DIRECTO','SALIDA DIRECTA'];

const U = s => String(s||'').toUpperCase();
const limpiar = s => String(s||'').replace(/\[(VIG|COND|MOVID):[^\]]*\]/g,'').trim();

function claseDe(tipo, esBanco) {
  const t = U(tipo);
  if (t.indexOf('DESCUENTO')>=0 || t.indexOf('LIQUIDA')>=0) return 'descuento';
  if (t.indexOf('COMBINAC')>=0) return 'combinacion';
  if (esBanco) return 'banco';
  return 'otro';
}

/** Une autorizaciones y solicitudes de multa pendientes en una sola bandeja ordenada. */
export function construirBandeja(autorizaciones, solicitudesMulta) {
  const items = [];
  for (const a of (autorizaciones||[])) {
    if (String(a.estatus) !== 'PENDIENTE') continue;
    const esBanco = TIPOS_BANCO.includes(U(a.tipo));
    items.push({ kind:'aut', id:a.id, tipo:String(a.tipo||''), esBanco, clase:claseDe(a.tipo, esBanco),
      cliente:String(a.referencia||''), motivo:limpiar(a.detalle), montoRef:Number(a.monto)||0,
      descripcion:String(a.referencia||a.detalle||''), quien:String(a.solicita||''),
      fecha:String(a.fecha||a.created_at||'').slice(0,10), raw:a });
  }
  for (const m of (solicitudesMulta||[])) {
    if (String(m.estatus) !== 'PENDIENTE') continue;
    items.push({ kind:'multa', id:m.id, tipo:'MULTA', esBanco:false, clase:'multa',
      cliente:String(m.cliente||''), motivo:String(m.motivo||''), montoRef:Number(m.monto_multa)||0,
      descripcion:`${m.cliente} · ${money(m.monto_multa)}${m.motivo?(' · '+m.motivo):''}`, quien:String(m.ejecutivo||''),
      fecha:String(m.fecha||m.created_at||'').slice(0,10), raw:m });
  }
  items.sort((a,b)=> a.fecha<b.fecha?-1:a.fecha>b.fecha?1:0);
  return { items, total:items.length };
}
