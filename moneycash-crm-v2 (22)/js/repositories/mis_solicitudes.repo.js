// Repositorio "Mis Solicitudes" — las que el propio usuario pidió (multas + descuentos).
import { db } from '../lib/supabase.js';

const norm = s => String(s||'').trim().toUpperCase();
const EST = e => { const u=norm(e); if (u==='APROBADO'||u==='APROBADA') return 'APROBADA'; if (u==='RECHAZADO'||u==='RECHAZADA') return 'RECHAZADA'; return 'PENDIENTE'; };
const pctDe = d => { const m=String(d||'').match(/\[COND:(\d+)/); return m?parseInt(m[1]):0; };

export async function fetchMisSolicitudes(perfil) {
  const ej = perfil.ejecutivo || '';
  const mail = perfil.email || '';
  const nom = perfil.nombre || '';
  const [{ data:multas }, { data:auts }] = await Promise.all([
    db.from('solicitudes_multa').select('*').order('created_at',{ascending:false}),
    db.from('autorizaciones').select('*').order('created_at',{ascending:false}),
  ]);
  const out = [];
  for (const m of (multas||[])) {
    // del ejecutivo (o, si no es ejecutivo, las que él haya pedido por nombre)
    if (ej && norm(m.ejecutivo)!==norm(ej)) { if (!ej) {} else continue; }
    if (!ej) continue;  // solo ejecutivos ven multas propias por ahora
    out.push({ tipo:'MULTA', cliente:m.cliente||'', estatus:EST(m.estatus), fecha:String(m.fecha||m.created_at||'').slice(0,10),
      motivo:m.motivo||'', montoAut:Number(m.monto_multa)||0, pct:0, resueltoPor:'' });
  }
  for (const a of (auts||[])) {
    const t = norm(a.tipo);
    if (t.indexOf('DESCUENTO')<0 && t.indexOf('LIQUIDA')<0) continue;
    if (norm(a.solicita)!==norm(mail) && norm(a.solicita)!==norm(nom)) continue;
    out.push({ tipo:'DESCUENTO', cliente:a.referencia||'', estatus:EST(a.estatus), fecha:String(a.fecha||a.created_at||'').slice(0,10),
      motivo:String(a.detalle||'').replace(/\s*\[(VIG|COND|MOVID):[^\]]*\]/g,'').trim(),
      montoAut:Number(a.monto)||0, pct:pctDe(a.detalle), resueltoPor:a.resuelto_por||'' });
  }
  out.sort((x,y)=> x.fecha<y.fecha?1:x.fecha>y.fecha?-1:0);
  return out;
}
