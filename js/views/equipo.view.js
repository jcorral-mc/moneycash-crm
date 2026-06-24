// Vista Equipo/Usuarios — alta, edición, baja/reactivar de perfiles. Solo ADMIN.
import { el } from '../lib/dom.js';
import { construirLista, ROLES_LISTA, ROLES } from '../services/equipo.service.js';
import * as repo from '../repositories/equipo.repo.js';

export async function abrirEquipo(perfil) {
  if (perfil.rol !== 'ADMIN') { alert('Solo el administrador gestiona el equipo.'); return; }
  const ov = el(`<div class="overlay"><div class="ohead"><button class="back">←</button><div class="ot">Equipo</div></div><div class="ocontent"><div class="loader">Cargando…</div></div></div>`);
  document.body.appendChild(ov);
  const c = ov.querySelector('.ocontent');
  ov.querySelector('.back').addEventListener('click', () => ov.remove());

  async function cargar() {
    c.innerHTML = '<div class="loader">Cargando…</div>';
    const { perfiles, total, activos } = construirLista(await repo.fetchPerfiles());
    c.innerHTML = `
      <div class="kpis"><div class="kcard"><div class="klab">Usuarios</div><div class="kval num">${activos}</div><div class="kfoot">${total} en total</div></div></div>
      <button class="btn-primary" id="eq-nuevo" style="margin-bottom:8px">+ Nuevo usuario</button>
      <div class="note" style="margin-bottom:10px">El acceso (correo y contraseña) se crea en Supabase → Authentication. Aquí defines su rol y, si es ejecutivo, su cartera.</div>
      ${perfiles.map(p=>`<div class="cli" data-id="${p.id}" style="${p.activo?'':'opacity:.5'}">
        <div><div class="nm">${p.nombre}${p.activo?'':' · (baja)'}</div><div class="mt">${ROLES[p.rol]||p.rol}${p.ejecutivo?(' · '+p.ejecutivo):''} · ${p.email}</div></div>
        <div class="bc-n">›</div></div>`).join('')}`;
    c.querySelector('#eq-nuevo').addEventListener('click', () => formPerfil(null));
    c.querySelectorAll('.cli[data-id]').forEach(card => card.addEventListener('click', () => {
      const p = perfiles.find(x=>String(x.id)===card.dataset.id); if (p) formPerfil(p);
    }));
  }

  function formPerfil(p) {
    const ed = !!p;
    const sub = el(`<div class="overlay"><div class="ohead"><button class="back">←</button><div class="ot">${ed?'Editar usuario':'Nuevo usuario'}</div></div>
      <div class="ocontent">
        <label class="alab">Correo ${ed?'(no se cambia)':''}</label><input class="inp" id="p-mail" value="${p?p.email:''}" ${ed?'disabled':''}>
        <label class="alab">Nombre</label><input class="inp" id="p-nom" value="${p?p.nombre:''}">
        <label class="alab">Rol</label><select class="inp" id="p-rol">${ROLES_LISTA.map(r=>`<option value="${r}" ${p&&p.rol===r?'selected':''}>${ROLES[r]}</option>`).join('')}</select>
        <div id="p-eje-wrap" style="display:none"><label class="alab">Nombre de ejecutivo (para su cartera)</label><input class="inp" id="p-eje" value="${p?p.ejecutivo:''}"></div>
        <button class="btn-primary" id="p-go">${ed?'Guardar':'Dar de alta'}</button>
        ${ed?`<button class="mini-no" id="p-baja" style="width:100%;margin-top:10px">${p.activo?'Dar de baja':'Reactivar'}</button>`:''}
        <div class="login-err" id="p-e"></div></div></div>`);
    document.body.appendChild(sub);
    sub.querySelector('.back').addEventListener('click', ()=>sub.remove());
    const rolSel = sub.querySelector('#p-rol'), ejeWrap = sub.querySelector('#p-eje-wrap');
    const refrescar = () => { ejeWrap.style.display = rolSel.value==='EJECUTIVO' ? 'block' : 'none'; };
    rolSel.addEventListener('change', refrescar); refrescar();

    sub.querySelector('#p-go').addEventListener('click', async ()=>{
      const d = { id:p?p.id:null, email:ed?p.email:sub.querySelector('#p-mail').value, nombre:sub.querySelector('#p-nom').value, rol:rolSel.value, ejecutivo:sub.querySelector('#p-eje')?sub.querySelector('#p-eje').value:'' };
      try { const res = await repo.guardarPerfil(d, perfil); alert(res.msg); sub.remove(); cargar(); }
      catch(e){ const er=sub.querySelector('#p-e'); er.textContent=e.message; er.style.display='block'; }
    });
    if (ed) sub.querySelector('#p-baja').addEventListener('click', async ()=>{
      try { const res = await repo.cambiarActivo(p, !p.activo, perfil); alert(res.msg); sub.remove(); cargar(); }
      catch(e){ const er=sub.querySelector('#p-e'); er.textContent=e.message; er.style.display='block'; }
    });
  }

  cargar();
}
