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
    <input class="inp" id="re-busca" placeholder="Buscar cliente" style="margin-bottom:10px">
    <div id="re-lista"></div>`;

  const tarjeta = cl => `<div class="cli" style="display:block">
    <div style="display:flex;justify-content:space-between"><div><div class="nm">${cl.nombre}</div><div class="mt">Último préstamo ${money(cl.ultimoPrestamo)}${cl.fechaLiquido?(' · liquidó '+cl.fechaLiquido):''}${cl.frecuencia?(' · '+cl.frecuencia):''}</div></div></div>
    ${puedeReactivar?`<button class="mini-ok" data-react="${encodeURIComponent(cl.nombre)}" style="width:auto;padding:6px 12px;margin-top:8px">Reactivar (nuevo crédito)</button>`:''}
  </div>`;

  function render() {
    const q = (c.querySelector('#re-busca').value||'').trim().toLowerCase();
    const box = c.querySelector('#re-lista');
    const grupos = r.porEjecutivo.map(g=>({ ...g, clientes:g.clientes.filter(cl=>!q||cl.nombre.toLowerCase().includes(q)) })).filter(g=>g.clientes.length);
    if (!grupos.length) { box.innerHTML = '<div class="note" style="text-align:center">No hay clientes candidatos a reactivación.</div>'; return; }
    box.innerHTML = grupos.map((g,gi)=>`<div class="re-grupo">
      <div class="re-gh" data-g="${gi}"><span><b>${g.ejecutivo}</b> <span style="opacity:.85;font-size:.82em">(${g.clientes.length})</span></span><span class="re-fl" data-fl="${gi}">\u25B8</span></div>
      <div class="re-gb" data-gb="${gi}" style="display:none">${g.clientes.map(tarjeta).join('')}</div>
    </div>`).join('');
    box.querySelectorAll('[data-g]').forEach(h=>h.addEventListener('click',()=>{
      const gi=h.dataset.g, b=box.querySelector(`[data-gb="${gi}"]`), fl=box.querySelector(`[data-fl="${gi}"]`);
      const open=b.style.display!=='none'; b.style.display=open?'none':'block'; fl.textContent=open?'\u25B8':'\u25BE';
    }));
    if (puedeReactivar) box.querySelectorAll('[data-react]').forEach(b => b.addEventListener('click', () => {
      const nombre = decodeURIComponent(b.dataset.react);
      try { navigator.clipboard && navigator.clipboard.writeText(nombre); } catch(e){}
      alert('Reactivando a ' + nombre + '.\nCaptura el nuevo crédito en el alta (nombre copiado).');
      ov.remove(); abrirAlta(perfil);
    }));
  }
  c.querySelector('#re-busca').addEventListener('input', render);
  render();
}
