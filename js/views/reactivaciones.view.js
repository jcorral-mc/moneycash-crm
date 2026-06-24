// Vista Reactivaciones — clientes en ceros candidatos a nuevo crédito (mercado abierto).
import { el, money } from '../lib/dom.js';
import { construirReactivaciones } from '../services/reactivaciones.service.js';
import { cargarReactivaciones } from '../repositories/reactivaciones.repo.js';
import { abrirAlta } from './alta.view.js';

export async function abrirReactivaciones(perfil) {
  const ov = el(`<div class="overlay"><div class="ohead"><button class="back">←</button><div class="ot">Reactivaciones</div></div><div class="ocontent"><div class="loader">Cargando…</div></div></div>`);
  document.body.appendChild(ov);
  const c = ov.querySelector('.ocontent');
  ov.querySelector('.back').addEventListener('click', () => ov.remove());

  const { cartera, desglose } = await cargarReactivaciones();
  const r = construirReactivaciones(cartera, desglose);
  const puedeReactivar = ['ADMIN','GERENTE','EJECUTIVO','AUX_ADMIN'].includes(perfil.rol);

  c.innerHTML = `
    <div class="kpis"><div class="kcard"><div class="klab">Candidatos</div><div class="kval num">${r.total}</div><div class="kfoot">clientes liquidados · mercado abierto</div></div></div>
    <div class="note" style="margin-bottom:10px">Clientes que ya liquidaron y pueden tomar un nuevo crédito. Cualquier ejecutivo puede reactivarlos.</div>
    ${r.porEjecutivo.map(g=>`
      <div class="sec-h"><span class="t">${g.ejecutivo} (${g.n})</span><span class="ln"></span></div>
      ${g.clientes.map(cl=>`<div class="cli" style="display:block">
        <div style="display:flex;justify-content:space-between"><div><div class="nm">${cl.nombre}</div><div class="mt">Último préstamo ${money(cl.ultimoPrestamo)}${cl.fechaLiquido?(' · liquidó '+cl.fechaLiquido):''}${cl.frecuencia?(' · '+cl.frecuencia):''}</div></div></div>
        ${puedeReactivar?`<button class="mini-ok" data-react="${encodeURIComponent(cl.nombre)}" style="width:auto;padding:6px 12px;margin-top:8px">Reactivar (nuevo crédito)</button>`:''}
      </div>`).join('')}`).join('') || '<div class="note">No hay clientes candidatos a reactivación.</div>'}`;

  if (puedeReactivar) c.querySelectorAll('[data-react]').forEach(b => b.addEventListener('click', () => {
    const nombre = decodeURIComponent(b.dataset.react);
    try { navigator.clipboard && navigator.clipboard.writeText(nombre); } catch(e){}
    alert('Reactivando a ' + nombre + '.\nCaptura el nuevo crédito en el alta (nombre copiado).');
    ov.remove();
    abrirAlta(perfil);
  }));
}
