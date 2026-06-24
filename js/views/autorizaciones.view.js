// Vista Autorizaciones — bandeja unificada (banco/descuento + multas). Aprobar/rechazar. ADMIN/GERENTE.
import { el } from '../lib/dom.js';
import { construirBandeja } from '../services/autorizaciones.service.js';
import * as repo from '../repositories/autorizaciones.repo.js';

export async function abrirAutorizaciones(perfil, onChange) {
  if (!['ADMIN','GERENTE'].includes(perfil.rol)) { alert('Solo Admin/Gerente resuelven autorizaciones.'); return; }
  const ov = el(`<div class="overlay"><div class="ohead"><button class="back">←</button><div class="ot">Autorizaciones</div></div><div class="ocontent"><div class="loader">Cargando…</div></div></div>`);
  document.body.appendChild(ov);
  const c = ov.querySelector('.ocontent');
  ov.querySelector('.back').addEventListener('click', () => { ov.remove(); if (onChange) onChange(); });

  async function cargar() {
    c.innerHTML = '<div class="loader">Cargando…</div>';
    const { autorizaciones, solicitudesMulta } = await repo.fetchPendientes();
    const { items, total } = construirBandeja(autorizaciones, solicitudesMulta);
    c.innerHTML = `
      <div class="kpis"><div class="kcard"><div class="klab">Pendientes</div><div class="kval num">${total}</div><div class="kfoot">por resolver</div></div></div>
      ${items.map((it,i)=>`<div class="cli" style="display:block">
        <div><div class="nm">${it.tipo}</div><div class="mt">${it.descripcion}${it.quien?(' · pidió '+it.quien):''}${it.fecha?(' · '+it.fecha):''}</div></div>
        <div style="display:flex;gap:7px;margin-top:9px"><button class="mini-ok" data-ap="${i}">Aprobar</button><button class="mini-no" data-rj="${i}">Rechazar</button></div>
      </div>`).join('') || '<div class="note">No hay autorizaciones pendientes. 🎉</div>'}`;

    c.querySelectorAll('[data-ap]').forEach(b=>b.addEventListener('click', async ()=>{
      const it = items[parseInt(b.dataset.ap)];
      try { const res = await repo.aprobar(it, perfil); alert(res.msg); cargar(); } catch(e){ alert('❌ '+e.message); }
    }));
    c.querySelectorAll('[data-rj]').forEach(b=>b.addEventListener('click', async ()=>{
      const it = items[parseInt(b.dataset.rj)];
      if (!confirm('¿Rechazar esta solicitud?')) return;
      try { const res = await repo.rechazar(it, perfil); alert(res.msg); cargar(); } catch(e){ alert('❌ '+e.message); }
    }));
  }
  cargar();
}
