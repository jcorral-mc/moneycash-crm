// Vista Usuarios / Equipo — réplica del Script (form arriba + lista abajo, editar carga el form).
// Gestiona perfiles (rol, ejecutivo, alta/baja). Solo ADMIN. Estilo CRM nuevo.
import { el } from '../lib/dom.js';
import { construirLista, ROLES_LISTA, ROLES } from '../services/equipo.service.js';
import * as repo from '../repositories/equipo.repo.js';

export async function abrirEquipo(perfil) {
  if (perfil.rol !== 'ADMIN') { alert('Solo el administrador gestiona el equipo.'); return; }
  const ov = el(`<div class="overlay"><div class="ohead"><button class="back">\u2190</button><div class="ot">Usuarios</div></div><div class="ocontent"><div class="loader">Cargando\u2026</div></div></div>`);
  document.body.appendChild(ov);
  const c = ov.querySelector('.ocontent');
  ov.querySelector('.back').addEventListener('click', () => ov.remove());

  let editId = null;

  c.innerHTML = `
    <div class="fcard" style="margin-bottom:16px">
      <div style="font-weight:600;margin-bottom:12px" id="eq-formtit">Crear usuario</div>
      <label class="alab">Correo</label><input class="inp" id="eq-mail" placeholder="ej. jorge@moneycash.mx">
      <label class="alab">Nombre</label><input class="inp" id="eq-nom" placeholder="Nombre y apellido">
      <label class="alab">Rol</label>
      <div class="usr-roles">
        ${ROLES_LISTA.map(r=>`<label class="usr-rol"><input type="radio" name="eq-rol" value="${r}"> ${ROLES[r]}</label>`).join('')}
      </div>
      <div id="eq-eje-wrap" style="display:none"><label class="alab">Ejecutivo (cartera propia)</label><input class="inp" id="eq-eje" placeholder="Nombre del ejecutivo"></div>
      <button class="btn-primary" id="eq-go">GUARDAR USUARIO</button>
      <button class="p-sec" id="eq-cancel" style="width:100%;margin-top:8px;display:none">Cancelar edición</button>
      <div class="login-err" id="eq-err"></div>
      <div class="note" style="margin-top:10px">El acceso (correo y contraseña) se crea en Supabase \u2192 Authentication. Aquí defines su rol y, si es ejecutivo, su cartera.</div>
    </div>
    <div class="dash-modtit">Usuarios del sistema</div>
    <div id="eq-lista"><div class="loader">Cargando\u2026</div></div>`;

  const $ = s => c.querySelector(s);
  const mail=$('#eq-mail'), nom=$('#eq-nom'), ejeWrap=$('#eq-eje-wrap'), eje=$('#eq-eje'), err=$('#eq-err');

  // Mostrar/ocultar ejecutivo según rol
  c.querySelectorAll('input[name="eq-rol"]').forEach(r => r.addEventListener('change', () => {
    ejeWrap.style.display = (rolSel()==='EJECUTIVO') ? 'block' : 'none';
  }));
  function rolSel(){ const r=c.querySelector('input[name="eq-rol"]:checked'); return r?r.value:''; }
  function setRol(v){ c.querySelectorAll('input[name="eq-rol"]').forEach(r=>r.checked=(r.value===v)); ejeWrap.style.display=(v==='EJECUTIVO')?'block':'none'; }

  function resetForm(){
    editId=null; $('#eq-formtit').textContent='Crear usuario';
    mail.value=''; mail.disabled=false; nom.value=''; eje.value='';
    c.querySelectorAll('input[name="eq-rol"]').forEach(r=>r.checked=false); ejeWrap.style.display='none';
    $('#eq-cancel').style.display='none'; err.style.display='none';
  }
  function llenarForm(p){
    editId=p.id; $('#eq-formtit').textContent='Editar: '+p.nombre;
    mail.value=p.email; mail.disabled=true; nom.value=p.nombre; setRol(p.rol); eje.value=p.ejecutivo||'';
    $('#eq-cancel').style.display='block'; err.style.display='none';
    c.scrollTop=0;
  }
  $('#eq-cancel').addEventListener('click', resetForm);

  $('#eq-go').addEventListener('click', async () => {
    err.style.display='none';
    const d = { id:editId, email:editId?mail.value:mail.value.trim(), nombre:nom.value, rol:rolSel(), ejecutivo:eje.value };
    if (!rolSel()) { err.textContent='Selecciona un rol.'; err.style.display='block'; return; }
    try { const res = await repo.guardarPerfil(d, perfil); alert(res.msg); resetForm(); cargarLista(); }
    catch(e){ err.textContent=e.message; err.style.display='block'; }
  });

  async function cargarLista() {
    const { perfiles, total, activos } = construirLista(await repo.fetchPerfiles());
    const cont = $('#eq-lista');
    cont.innerHTML = `<div class="note" style="margin-bottom:8px">${activos} activos \u00b7 ${total} en total</div>` +
      perfiles.map(p=>`<div class="usr-row" data-id="${p.id}" style="${p.activo?'':'opacity:.55'}">
        <div style="flex:1;min-width:0" data-edit="${p.id}">
          <div class="nm">${p.nombre}</div>
          <div class="mt">${ROLES[p.rol]||p.rol}${p.ejecutivo?(' \u00b7 '+p.ejecutivo):''} \u00b7 ${p.email}</div>
        </div>
        <span class="usr-estado ${p.activo?'on':'off'}">${p.activo?'ACTIVO':'INACTIVO'}</span>
        <button class="usr-baja" data-baja="${p.id}">${p.activo?'Baja':'Reactivar'}</button>
      </div>`).join('');

    cont.querySelectorAll('[data-edit]').forEach(d => d.addEventListener('click', () => {
      const p = perfiles.find(x=>String(x.id)===d.dataset.edit); if (p) llenarForm(p);
    }));
    cont.querySelectorAll('[data-baja]').forEach(b => b.addEventListener('click', async (ev) => {
      ev.stopPropagation();
      const p = perfiles.find(x=>String(x.id)===b.dataset.baja); if (!p) return;
      if (p.activo && !confirm(`¿Dar de baja a ${p.nombre}?`)) return;
      try { const res = await repo.cambiarActivo(p, !p.activo, perfil); alert(res.msg); if (editId===p.id) resetForm(); cargarLista(); }
      catch(e){ alert(e.message); }
    }));
  }

  cargarLista();
}
