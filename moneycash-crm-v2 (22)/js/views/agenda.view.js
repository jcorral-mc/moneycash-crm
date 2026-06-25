// Vista Agenda — réplica del Script: próximos 3 días + alta de evento + lista con filtros.
import { el } from '../lib/dom.js';
import { construirAgenda, AGENDA_TIPOS } from '../services/agenda.service.js';
import * as repo from '../repositories/agenda.repo.js';

const COL = { 'DILIGENCIA':'var(--red)', 'CD JUDICIAL':'var(--navy)', 'VISITA':'var(--steel)', 'RECORDATORIO':'var(--amber)', 'MANUAL':'var(--slate)' };

export async function abrirAgenda(perfil) {
  const ov = el(`<div class="overlay"><div class="ohead"><button class="back">\u2190</button><div class="ot">Agenda</div></div><div class="ocontent"><div class="loader">Cargando agenda\u2026</div></div></div>`);
  document.body.appendChild(ov);
  const c = ov.querySelector('.ocontent');
  ov.querySelector('.back').addEventListener('click', () => ov.remove());

  let DATA=null, fTipo='', fEstado='';

  async function cargar() {
    DATA = construirAgenda(await repo.fetchAgenda());
    const prox = DATA.proximos3;
    c.innerHTML = `
      ${prox.length?`<div class="ag-prox"><div class="ag-prox-h">Próximos 3 días</div>
        ${prox.map(e=>{const col=COL[e.tipo]||'var(--slate)';const t=e.dias===0?'HOY':(e.dias===1?'MAÑANA':'en '+e.dias+'d');return `<div class="ag-card" style="border-left-color:${col}"><div style="display:flex;justify-content:space-between"><b>${e.titulo}</b><span style="color:${col};font-size:.78em;font-weight:600">${t}</span></div><div class="ag-meta">${e.fecha}${e.notas?(' · '+e.notas):''}</div></div>`;}).join('')}</div>`:''}
      <button class="btn-primary" id="ag-nuevo" style="margin:12px 0;background:var(--green)">+ Agregar evento</button>
      <div class="ag-filtros">
        <select class="inp" id="ag-ft" style="flex:1"><option value="">Todos los tipos</option>${AGENDA_TIPOS.map(t=>`<option ${t===fTipo?'selected':''}>${t}</option>`).join('')}</select>
        <select class="inp" id="ag-fe" style="flex:1"><option value="">Todos</option><option value="PEND" ${fEstado==='PEND'?'selected':''}>Pendientes</option><option value="COMP" ${fEstado==='COMP'?'selected':''}>Completados</option></select>
      </div>
      <div id="ag-lista"></div>`;

    c.querySelector('#ag-nuevo').addEventListener('click', formNuevo);
    c.querySelector('#ag-ft').addEventListener('change', e=>{ fTipo=e.target.value; render(); });
    c.querySelector('#ag-fe').addEventListener('change', e=>{ fEstado=e.target.value; render(); });
    render();
  }

  function render() {
    let evs = DATA.eventos.slice();
    if (fTipo) evs = evs.filter(e=>e.tipo===fTipo);
    if (fEstado==='PEND') evs = evs.filter(e=>!e.completado);
    if (fEstado==='COMP') evs = evs.filter(e=>e.completado);
    const box = c.querySelector('#ag-lista');
    if (!evs.length) { box.innerHTML = '<div class="note" style="text-align:center">Sin eventos.</div>'; return; }
    box.innerHTML = evs.map(e=>{
      const col=COL[e.tipo]||'var(--slate)';
      let urg='';
      if (!e.completado) {
        if (e.dias<0) urg=`<span style="color:var(--red);font-weight:600;font-size:.72em">PASADO (${-e.dias}d)</span>`;
        else if (e.dias===0) urg='<span style="color:var(--red);font-weight:600;font-size:.72em">HOY</span>';
        else if (e.dias<=3) urg=`<span style="color:var(--amber);font-weight:600;font-size:.72em">en ${e.dias}d</span>`;
        else urg=`<span style="color:var(--slate);font-size:.72em">en ${e.dias}d</span>`;
      }
      const check = e.completado ? '<span style="color:var(--green);font-weight:700">\u2713</span>' : `<button class="mini-ok" data-done="${e.id}" style="width:auto;padding:3px 9px">Hecho</button>`;
      return `<div class="ag-card" style="border-left-color:${col};${e.completado?'opacity:.6':''}">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <div><span class="ag-badge" style="background:${col}">${e.tipo}</span> <b style="font-size:.88em;margin-left:4px">${e.titulo}</b></div>
          <div style="text-align:right">${urg} ${check}</div></div>
        <div class="ag-meta">${e.fecha}${e.notas?(' · '+e.notas):''}${e.cliente?(' · '+e.cliente):''}</div>
      </div>`;
    }).join('');
    box.querySelectorAll('[data-done]').forEach(b=>b.addEventListener('click', async ()=>{
      if (!confirm('¿Marcar como completado?')) return;
      try { await repo.completarEvento(parseInt(b.dataset.done), perfil); cargar(); } catch(e){ alert(e.message); }
    }));
  }

  function formNuevo() {
    const m = el(`<div class="p-modal"><div class="p-mbox">
      <div class="p-mtit">Nuevo evento</div>
      <label class="alab">Título</label><input class="inp" id="ev-t" placeholder="Ej: Diligencia Juzgado 3\u2026">
      <label class="alab">Tipo</label><select class="inp" id="ev-tp">${AGENDA_TIPOS.map(t=>`<option>${t}</option>`).join('')}</select>
      <label class="alab">Fecha</label><input class="inp" id="ev-f" type="date">
      <label class="alab">Notas</label><textarea class="inp" id="ev-n" rows="2" placeholder="Detalles opcionales\u2026"></textarea>
      <div style="display:flex;gap:10px;margin-top:12px"><button class="p-sec" data-x style="flex:1">Cancelar</button><button class="btn-primary" data-ok style="flex:1;background:var(--green)">Guardar</button></div>
    </div></div>`);
    document.body.appendChild(m);
    m.querySelector('[data-x]').addEventListener('click',()=>m.remove());
    m.querySelector('[data-ok]').addEventListener('click', async ()=>{
      try { await repo.agregarEvento({ titulo:m.querySelector('#ev-t').value, tipo:m.querySelector('#ev-tp').value, fecha:m.querySelector('#ev-f').value, notas:m.querySelector('#ev-n').value }, perfil); m.remove(); cargar(); }
      catch(e){ alert(e.message); }
    });
  }

  cargar();
}
