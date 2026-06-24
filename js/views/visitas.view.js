// Vista Visitas — pestañas por tipo, urgencia por días, asignar (con horario abierto) y resolver.
import { el } from '../lib/dom.js';
import { construirLista, VIS_TIPOS, tipoAsignable, colorUrgencia } from '../services/visitas.service.js';
import { fetchVisitas, asignarVisita, resolverVisita } from '../repositories/visitas.repo.js';

const URG = { red:'#c0392b', amber:'#C9A227', blue:'#103A63', green:'#0f6e56' };

export async function abrirVisitas(perfil) {
  if (!['ADMIN','GERENTE','AUX_ADMIN','JURIDICO','VISITAS'].includes(perfil.rol)) { alert('No autorizado para Visitas.'); return; }
  const ov = el(`<div class="overlay"><div class="ohead"><button class="back">←</button><div class="ot">Visitas</div></div><div class="ocontent"><div class="loader">Cargando…</div></div></div>`);
  document.body.appendChild(ov);
  const c = ov.querySelector('.ocontent');
  ov.querySelector('.back').addEventListener('click', () => ov.remove());

  // Pestaña inicial según rol
  let TAB = perfil.rol === 'JURIDICO' ? 'JURIDICO' : (perfil.rol === 'VISITAS' ? 'VERIFICACION' : 'COBRANZA');

  async function cargar() {
    c.innerHTML = '<div class="loader">Cargando…</div>';
    const todas = await fetchVisitas();
    const { visitas, conteos, urgencia, total } = construirLista(todas, TAB);
    const puedeAsignar = !!tipoAsignable(TAB, perfil.rol);
    const puedeResolver = ['ADMIN','GERENTE','JURIDICO','VISITAS'].includes(perfil.rol);

    c.innerHTML = `
      <div class="vtabs" style="display:flex;gap:6px;overflow-x:auto;margin-bottom:12px">
        ${VIS_TIPOS.map(t=>`<button class="vtab ${t.tipo===TAB?'on':''}" data-tab="${t.tipo}"
          style="flex:0 0 auto;padding:7px 13px;border-radius:18px;border:1px solid var(--line);background:${t.tipo===TAB?'var(--navy)':'#fff'};color:${t.tipo===TAB?'#fff':'var(--navy)'};font-weight:700;font-size:.82em;cursor:pointer">
          ${t.etiqueta}${conteos[t.tipo]?` (${conteos[t.tipo]})`:''}</button>`).join('')}
      </div>
      ${(urgencia.urgente||urgencia.medio||urgencia.atencion) ? `<div class="note" style="margin-bottom:10px">
        ${urgencia.urgente?`<b style="color:${URG.red}">${urgencia.urgente} urgentes</b> · `:''}${urgencia.medio?`${urgencia.medio} medias · `:''}${urgencia.atencion?`${urgencia.atencion} atención`:''}</div>` : ''}
      ${puedeAsignar ? `<button class="btn-primary" id="v-nueva" style="margin-bottom:10px">+ Asignar visita</button>` : ''}
      <div id="v-lista"></div>`;

    c.querySelectorAll('.vtab').forEach(b => b.addEventListener('click', () => { TAB = b.dataset.tab; cargar(); }));
    if (puedeAsignar) c.querySelector('#v-nueva').addEventListener('click', () => formAsignar());

    const lista = c.querySelector('#v-lista');
    lista.innerHTML = visitas.map(v => {
      const col = URG[colorUrgencia(v.dias)];
      const dtxt = v.dias<=0 ? 'hoy' : (v.dias+'d');
      return `<div class="cli" data-id="${v.id}" style="display:block;border-left:4px solid ${col}">
        <div style="display:flex;justify-content:space-between;align-items:flex-start">
          <div><div class="nm">${v.cliente}</div><div class="mt">${v.refId?v.refId+' · ':''}${v.direccion||'sin dirección'}</div>
            <div class="mt">🕐 ${v.horarios||'sin hora'}${v.asigna?(' · asignó '+v.asigna):''}</div>
            ${v.comentarios?`<div class="mt">📝 ${v.comentarios}</div>`:''}</div>
          <span style="font-size:.62em;font-weight:800;color:#fff;background:${col};padding:3px 9px;border-radius:9px;white-space:nowrap">${dtxt}${v.dias>=3?' ⚠️':''}</span>
        </div>
        ${puedeResolver?`<button class="mini-ok" data-rv="${v.id}" style="margin-top:8px;width:auto;padding:6px 12px">Marcar realizada</button>`:''}
      </div>`;
    }).join('') || '<div class="note">No hay visitas pendientes en este tipo.</div>';

    if (puedeResolver) lista.querySelectorAll('[data-rv]').forEach(b => b.addEventListener('click', (e) => {
      e.stopPropagation(); const v = visitas.find(x=>String(x.id)===b.dataset.rv); formResolver(v);
    }));
  }

  function formAsignar() {
    const sub = el(`<div class="overlay"><div class="ohead"><button class="back">←</button><div class="ot">Asignar visita (${TAB})</div></div>
      <div class="ocontent">
        <label class="alab">Cliente *</label><input class="inp" id="a-cli">
        <label class="alab">Teléfono</label><input class="inp" id="a-tel" inputmode="tel">
        <label class="alab">Dirección</label><input class="inp" id="a-dir">
        <label class="alab">Referencias</label><input class="inp" id="a-ref">
        <label class="alab">Fecha</label><input class="inp" id="a-fec" type="date">
        <label class="alab">Hora</label><input class="inp" id="a-hora" type="time">
        <label style="display:flex;align-items:center;gap:8px;font-size:.84em;color:#5a7384;margin:10px 0;cursor:pointer">
          <input type="checkbox" id="a-abierto" style="width:16px;height:16px"> Horario abierto (sin hora fija)</label>
        <label class="alab">Motivo / comentario</label><input class="inp" id="a-mot">
        <button class="btn-primary" id="a-go">Asignar</button><div class="login-err" id="a-e"></div></div></div>`);
    document.body.appendChild(sub);
    sub.querySelector('.back').addEventListener('click', ()=>sub.remove());
    sub.querySelector('#a-fec').value = new Date().toISOString().slice(0,10);
    const ab = sub.querySelector('#a-abierto'), hr = sub.querySelector('#a-hora');
    ab.addEventListener('change', ()=>{ hr.disabled = ab.checked; });
    sub.querySelector('#a-go').addEventListener('click', async ()=>{
      const horaVal = sub.querySelector('#a-hora').value;
      const d = { tipo:TAB, cliente:sub.querySelector('#a-cli').value, telefono:sub.querySelector('#a-tel').value,
        direccion:sub.querySelector('#a-dir').value, referencias:sub.querySelector('#a-ref').value,
        fecha:sub.querySelector('#a-fec').value, horario: horaVal ? (horaVal+'-'+_masUnaHora(horaVal)) : '',
        horarioAbierto: ab.checked, comentario:sub.querySelector('#a-mot').value };
      try { const res = await asignarVisita(d, perfil); alert(res.msg); sub.remove(); cargar(); }
      catch(e){ const er=sub.querySelector('#a-e'); er.textContent=e.message; er.style.display='block'; }
    });
  }

  function formResolver(v) {
    const sub = el(`<div class="overlay"><div class="ohead"><button class="back">←</button><div class="ot">Resolver: ${v.cliente}</div></div>
      <div class="ocontent">
        <div class="note" style="margin-bottom:10px">${v.tipo} · ${v.direccion||'sin dirección'} · 🕐 ${v.horarios||'sin hora'}</div>
        <label class="alab">Resultado *</label>
        <select class="inp" id="r-res"><option>CONTACTADO</option><option>NO ESTABA</option><option>SE COMPROMETIÓ A PAGAR</option><option>DOMICILIO INCORRECTO</option><option>OTRO</option></select>
        <label class="alab">Hora real de la visita</label><input class="inp" id="r-hora" type="time">
        <label class="alab">Comentarios</label><input class="inp" id="r-com">
        <button class="btn-primary" id="r-go">Marcar realizada</button><div class="login-err" id="r-e"></div></div></div>`);
    document.body.appendChild(sub);
    sub.querySelector('.back').addEventListener('click', ()=>sub.remove());
    sub.querySelector('#r-go').addEventListener('click', async ()=>{
      const d = { resultado:sub.querySelector('#r-res').value, horaVisita:sub.querySelector('#r-hora').value, comentarios:sub.querySelector('#r-com').value };
      try { const res = await resolverVisita(v, d, perfil); alert(res.msg); sub.remove(); cargar(); }
      catch(e){ const er=sub.querySelector('#r-e'); er.textContent=e.message; er.style.display='block'; }
    });
  }

  cargar();
}

function _masUnaHora(hhmm) {
  const m = String(hhmm).split(':'); if (m.length<2) return hhmm;
  return String((parseInt(m[0],10)+1)%24).padStart(2,'0')+':'+m[1];
}
