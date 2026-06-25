// Vista Solicitudes / Autorizaciones — réplica del Script (UI por tipo: Multa, Descuento %, Combinación).
// Admin/Gerente aprueban/rechazan. Estilo CRM nuevo.
import { el, money } from '../lib/dom.js';
import { construirBandeja } from '../services/autorizaciones.service.js';
import * as repo from '../repositories/autorizaciones.repo.js';

const BADGE = {
  multa:['QUITAR MULTA','am'], descuento:['LIQUIDAR C/DESCUENTO','go'],
  combinacion:['COMBINACIÓN · PONER AL CORRIENTE','st'], banco:['MOVIMIENTO DE BANCO','nv'], otro:['SOLICITUD','sl'],
};

export async function abrirAutorizaciones(perfil, onChange) {
  if (!['ADMIN','GERENTE'].includes(perfil.rol)) { alert('Solo Admin/Gerente resuelven solicitudes.'); return; }
  const ov = el(`<div class="overlay"><div class="ohead"><button class="back">\u2190</button><div class="ot">Solicitudes</div></div><div class="ocontent"><div class="loader">Cargando solicitudes\u2026</div></div></div>`);
  document.body.appendChild(ov);
  const c = ov.querySelector('.ocontent');
  ov.querySelector('.back').addEventListener('click', () => { ov.remove(); if (onChange) onChange(); });

  async function cargar() {
    c.innerHTML = '<div class="loader">Cargando solicitudes\u2026</div>';
    const { autorizaciones, solicitudesMulta } = await repo.fetchPendientes();
    const { items, total } = construirBandeja(autorizaciones, solicitudesMulta);
    if (!total) { c.innerHTML = '<div class="note" style="text-align:center;color:var(--green);font-weight:600;padding:20px">No hay solicitudes pendientes.</div>'; return; }

    // Datos del cliente para los descuentos (saldo/capital/interés)
    const descs = items.filter(it=>it.clase==='descuento');
    await Promise.all(descs.map(async it => { try { it.datos = await repo.datosDescuento(it.cliente); } catch(e){ it.datos = {saldo:0,capitalPend:0,interesPend:0}; } }));

    c.innerHTML = `<div class="note" style="margin-bottom:10px">${total} solicitud${total===1?'':'es'} pendiente${total===1?'':'s'}</div>` +
      items.map((it,i)=>tarjeta(it,i)).join('');

    items.forEach((it,i) => {
      const card = c.querySelector(`[data-i="${i}"]`); if (!card) return;
      const apr = card.querySelector('[data-ap]'), rej = card.querySelector('[data-rj]');
      if (rej) rej.addEventListener('click', async () => { if(!confirm('¿Rechazar esta solicitud?'))return; try{ const r=await repo.rechazar(it,perfil); alert(r.msg); cargar(); }catch(e){ alert(e.message);} });

      if (it.clase==='descuento') {
        const inp = card.querySelector('.desc-pct'), prev = card.querySelector('.desc-prev');
        const calc = () => { const p=parseFloat(inp.value)||0; const cond=Math.round((it.datos.interesPend||0)*(p/100)); const fin=Math.max(0,Math.round((it.datos.saldo||0)-cond)); prev.textContent = p>0?`Condona ${money(cond)} \u2192 cobrar ${money(fin)}`:''; };
        card.querySelectorAll('.desc-q').forEach(b => b.addEventListener('click', () => { inp.value=b.dataset.p; calc(); card.querySelectorAll('.desc-q').forEach(x=>x.classList.toggle('on',x===b)); }));
        inp.addEventListener('input', () => { card.querySelectorAll('.desc-q').forEach(x=>x.classList.remove('on')); calc(); });
        apr.addEventListener('click', async () => {
          const p = parseFloat(inp.value);
          if (isNaN(p)||p<0||p>100) { alert('Pon un % válido (0-100).'); return; }
          try { const r = await repo.aprobarDescuento(it, p, it.datos, perfil); alert(r.msg); cargar(); } catch(e){ alert(e.message); }
        });
      } else if (apr) {
        apr.addEventListener('click', async () => { try{ const r=await repo.aprobar(it,perfil); alert(r.msg); cargar(); }catch(e){ alert(e.message);} });
      }
    });
  }

  function tarjeta(it, i) {
    const [lab, col] = BADGE[it.clase] || BADGE.otro;
    const head = `<div class="aut-badge ${col}">${lab}</div>
      <div class="aut-cli">${it.cliente||it.descripcion}</div>
      <div class="aut-meta">${it.quien||''}${it.fecha?(' \u00b7 '+it.fecha):''}</div>
      ${it.motivo?`<div class="aut-motivo">${it.motivo}</div>`:''}`;

    if (it.clase==='descuento') {
      const d = it.datos||{saldo:0,capitalPend:0,interesPend:0};
      return `<div class="aut-card go" data-i="${i}">${head}
        <div class="aut-nums">
          <span>Saldo <b>${money(d.saldo)}</b></span><span>Capital <b>${money(d.capitalPend)}</b></span><span style="color:var(--gold)">Interés <b>${money(d.interesPend)}</b></span>
        </div>
        <div class="aut-lab">% de interés a condonar</div>
        <div class="desc-pcts">${[10,20,30,50,90].map(p=>`<button class="desc-q" data-p="${p}">${p}%</button>`).join('')}</div>
        <input class="inp desc-pct" type="number" placeholder="% libre" style="margin:6px 0">
        <div class="desc-prev"></div>
        <div class="aut-btns"><button class="aut-ok" data-ap>Aprobar descuento</button><button class="aut-no" data-rj>Rechazar</button></div>
      </div>`;
    }
    if (it.clase==='combinacion') {
      return `<div class="aut-card st" data-i="${i}">${head}
        <div class="aut-total"><span>Total a cobrar</span><b>${money(it.montoRef)}</b></div>
        <div class="aut-btns"><button class="aut-ok" data-ap>Autorizar combinación</button><button class="aut-no" data-rj>Rechazar</button></div>
      </div>`;
    }
    if (it.clase==='multa') {
      return `<div class="aut-card am" data-i="${i}">${head}
        <div class="aut-total"><span>Multa</span><b style="color:var(--amber)">${money(it.montoRef)}</b></div>
        <div class="aut-btns"><button class="aut-ok" data-ap>Aprobar</button><button class="aut-no" data-rj>Rechazar</button></div>
      </div>`;
    }
    // banco / otro
    return `<div class="aut-card ${col}" data-i="${i}">${head}
      <div class="aut-btns"><button class="aut-ok" data-ap>Aprobar</button><button class="aut-no" data-rj>Rechazar</button></div>
    </div>`;
  }

  cargar();
}
