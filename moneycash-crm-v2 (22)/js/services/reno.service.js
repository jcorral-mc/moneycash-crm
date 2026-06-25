// Lógica de renovación/reactivación — candidatos desde cartera.
import { norm } from '../lib/dom.js';

/** Filtra clientes de cartera para reno (saldo>0) o react (saldo<=0 con capital>0). Jurídico fuera. */
export function candidatosReno(cartera, tipo) {
  const t = String(tipo||'RENOVACION').toUpperCase();
  return (cartera||[]).filter(c => {
    const saldo = parseFloat(c.saldo)||0, capital = parseFloat(c.capital)||0;
    if (norm(c.ejecutivo) === 'JURIDICO') return false;
    if (t === 'RENOVACION') return saldo > 0;
    if (t === 'REACTIVACION') return saldo <= 0 && capital > 0;
    return false;
  }).map(c => ({ id:c.id, nombre:String(c.nombre||''), ejecutivo:String(c.ejecutivo||''), saldo:Math.round(parseFloat(c.saldo)||0), capital:Math.round(parseFloat(c.capital)||0) }));
}
