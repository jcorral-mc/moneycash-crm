// Lógica de Autorizaciones — bandeja unificada (autorizaciones + solicitudes de multa).
const money = n => '$'+Number(n||0).toLocaleString('es-MX',{maximumFractionDigits:0});
export const TIPOS_BANCO = ['TRANSFERENCIA','INGRESO DIRECTO','SALIDA DIRECTA'];

/** Une autorizaciones y solicitudes de multa pendientes en una sola bandeja ordenada. */
export function construirBandeja(autorizaciones, solicitudesMulta) {
  const items = [];
  for (const a of (autorizaciones||[])) {
    if (String(a.estatus) !== 'PENDIENTE') continue;
    items.push({ kind:'aut', id:a.id, tipo:String(a.tipo||''), esBanco:TIPOS_BANCO.includes(String(a.tipo||'').toUpperCase()),
      descripcion:String(a.referencia||a.detalle||''), quien:String(a.solicita||''), fecha:String(a.fecha||a.created_at||'').slice(0,10), raw:a });
  }
  for (const m of (solicitudesMulta||[])) {
    if (String(m.estatus) !== 'PENDIENTE') continue;
    items.push({ kind:'multa', id:m.id, tipo:'MULTA', esBanco:false,
      descripcion:`${m.cliente} · ${money(m.monto_multa)}${m.motivo?(' · '+m.motivo):''}`, quien:String(m.ejecutivo||''), fecha:String(m.fecha||m.created_at||'').slice(0,10), raw:m });
  }
  items.sort((a,b)=> a.fecha<b.fecha?-1:a.fecha>b.fecha?1:0);
  return { items, total:items.length };
}
