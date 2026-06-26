// Vista Reactivaciones — clientes en ceros candidatos a reactivación; se gestionan con comentarios.
import { el, money } from '../lib/dom.js';
import { construirReactivaciones } from '../services/reactivaciones.service.js';
import { cargarReactivaciones, fetchComentariosReactivacion, agregarComentarioReactivacion } from '../repositories/reactivaciones.repo.js';

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
    ${puedeReactivar?`<button class="mini-ok" data-react="${encodeURIComponent(cl.nombre)}" style="width:auto;padding:6px 12px;margin-top:8px">Gestionar reactivación</button>`:''}
  </div>`;

  // Panel de gestión: comentarios + opinión sobre reactivar (no manda a "nuevo cliente").
  async function abrirGestion(cl) {
    const sub = el(`<div class="overlay"><div class="ohead"><button class="back">←</button><div class="ot">${cl.nombre}</div></div>
      <div class="ocontent">
        <div class="note" style="margin-bottom:10px">Último préstamo ${money(cl.ultimoPrestamo)}${cl.fechaLiquido?(' · liquidó '+cl.fechaLiquido):''}${cl.ejecutivo?(' · '+cl.ejecutivo):''}</div>
        <label class="alab">¿Conviene reactivar?</label>
        <select class="inp" id="g-op"><option value="">— opinión —</option><option>Sí, buen cliente</option><option>Tal vez, con seguimiento</option><option>No por ahora</option></select>
        <label class="alab">Comentario</label><textarea class="inp" id="g-com" rows="3" placeholder="Qué opinas de reactivar con nosotros…"></textarea>
        <button class="btn-primary" id="g-go">Guardar comentario</button><div class="login-err" id="g-e"></div>
        <div class="dash-modtit" style="margin-top:16px">Historial</div>
        <div id="g-hist"><div class="loader">Cargando…</div></div>
      </div></div>`);
    document.body.appendChild(sub);
    sub.querySelector('.back').addEventListener('click', ()=>sub.remove());
    const hist = sub.querySelector('#g-hist');
    const pintarHist = async () => {
      const items = await fetchComentariosReactivacion(cl.nombre).catch(()=>[]);
      hist.innerHTML = items.length
        ? items.map(it=>`<div class="cli" style="display:block"><div class="nm" style="font-size:.92em">${it.opinion||'Comentario'}</div><div class="mt">${it.comentario}</div><div class="mt" style="opacity:.7">${it.por||''} · ${it.fecha||''}</div></div>`).join('')
        : '<div class="note" style="text-align:center">Sin comentarios todavía.</div>';
    };
    sub.querySelector('#g-go').addEventListener('click', async ()=>{
      const comentario = sub.querySelector('#g-com').value.trim();
      const opinion = sub.querySelector('#g-op').value;
      try {
        await agregarComentarioReactivacion({ cliente:cl.nombre, comentario, opinion }, perfil);
        sub.querySelector('#g-com').value=''; sub.querySelector('#g-op').value='';
        await pintarHist();
      } catch(e){ const er=sub.querySelector('#g-e'); er.textContent=e.message; er.style.display='block'; }
    });
    pintarHist();
  }

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
      let cl = null;
      r.porEjecutivo.forEach(g => { const f = g.clientes.find(x => x.nombre === nombre); if (f) cl = { ...f, ejecutivo: g.ejecutivo }; });
      if (cl) abrirGestion(cl);
    }));
  }
  c.querySelector('#re-busca').addEventListener('input', render);
  render();
}
