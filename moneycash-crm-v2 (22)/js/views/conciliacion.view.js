// Vista Conciliación (réplica de conciliarPago + monitor). Aprobar/Rechazar pagos pendientes.
import { el, money } from '../lib/dom.js';
import { fetchCartera, fetchCalendarioCliente } from '../repositories/clientes.repo.js';
import { fetchPendientes, marcarPendiente, ejecutarPlan } from '../repositories/conciliacion.repo.js';
import { planAplicarPago } from '../services/conciliacion.service.js';
import { logAudit } from '../lib/audit.js';

const norm = s => String(s||'').trim().toUpperCase();

export async function abrirConciliacion(perfil, onDone) {
  const ov = el(`<div class="overlay">
    <div class="ohead"><button class="back">←</button><div class="ot">Conciliación</div></div>
    <div class="ocontent"><div class="loader">Cargando pendientes…</div></div></div>`);
  document.body.appendChild(ov);
  const c = ov.querySelector('.ocontent');
  ov.querySelector('.back').addEventListener('click', () => { ov.remove(); if (onDone) onDone(); });

  async function pinta() {
    c.innerHTML = '<div class="loader">Cargando pendientes…</div>';
    const pend = await fetchPendientes();
    if (!pend.length) { c.innerHTML = '<div class="note">No hay pagos pendientes de conciliar. ✅</div>'; return; }
    c.innerHTML = `
      <div class="resumen">${pend.length} pendientes · ${money(pend.reduce((s,p)=>s+Number(p.monto||0),0))}</div>
      <button class="btn-primary" id="cc-todos" style="margin-bottom:12px">Aprobar todos</button>
      <div id="cc-list"></div>`;
    const list = c.querySelector('#cc-list');
    list.innerHTML = pend.map(p => `
      <div class="cli" style="display:block" data-id="${p.id}">
        <div style="display:flex;justify-content:space-between">
          <div><div class="nm">${p.cliente}</div><div class="mt">${p.tipo} · ${p.forma_pago||''} · ${p.cuenta||''}${p.multa>0?(' · multa '+money(p.multa)):''}</div></div>
          <div class="sal num">${money(p.monto)}</div>
        </div>
        <div style="display:flex;gap:7px;margin-top:9px">
          <button class="mini-ok" data-ap="${p.id}">Aprobar</button>
          <button class="mini-no" data-rj="${p.id}">Rechazar</button>
        </div>
      </div>`).join('');

    list.querySelectorAll('[data-ap]').forEach(b => b.addEventListener('click', () => aprobar(b.dataset.ap, pend)));
    list.querySelectorAll('[data-rj]').forEach(b => b.addEventListener('click', async () => { const pp=pend.find(x=>String(x.id)===String(b.dataset.rj)); await marcarPendiente(b.dataset.rj,'RECHAZADO',perfil.email); await logAudit(perfil,'CONCILIACION_RECHAZADA', pp?pp.cliente:b.dataset.rj, pp?`${pp.tipo} $${pp.monto}`:''); pinta(); }));
    c.querySelector('#cc-todos').addEventListener('click', async () => { for (const p of pend) { await aprobar(p.id, pend, true); } pinta(); });
  }

  async function aprobar(id, pend, masivo) {
    const p = pend.find(x => String(x.id) === String(id)); if (!p) return;
    try {
      const carteras = await fetchCartera();
      const cRow = carteras.find(x => norm(x.nombre) === norm(p.cliente));
      if (!cRow) throw new Error('Cliente no encontrado al aplicar.');
      const cal = await fetchCalendarioCliente(p.cliente);
      const plan = planAplicarPago(cRow, cal, p);
      await ejecutarPlan(plan, cRow.id, p.id, perfil.email);
      await logAudit(perfil, 'CONCILIACION_APLICADA', p.cliente, `${plan.detalle} · saldo→${plan.saldo}`);
      if (!masivo) { alert('✅ ' + plan.detalle); pinta(); }
    } catch (e) {
      if (!masivo) alert('❌ ' + (e.message||'No se pudo aplicar.'));
    }
  }
  pinta();
}
