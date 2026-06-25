// Shell de la app: header + navegación inferior. Réplica del tablero del Script.
import { el, saludo } from '../lib/dom.js';
import { ROLES } from '../config.js';
import { db } from '../lib/supabase.js';

const ICONS = {
  inicio:'<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="11" width="7" height="10" rx="1.5"/><rect x="3" y="15" width="7" height="6" rx="1.5"/>',
  cartera:'<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  cobranza:'<path d="M3 17l5-5 4 3 7-8"/><path d="M16 4h5v5"/>',
};

/** Monta el shell y devuelve { root, content, setActive } */
export function renderShell(perfil, handlers) {
  const root = el(`
    <div class="app">
      <header class="hdr">
        <div class="hdr-top">
          <div class="brand"><img class="brand-logo" src="img/logo.png" alt="MoneyCash"><div class="brand-wm">MONEY<b>CASH</b></div></div>
          <div class="hdr-icons">
            <button class="hbtn" data-act="reload" title="Actualizar"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M21 12a9 9 0 1 1-3-6.7"/><path d="M21 4v4h-4"/></svg></button>
            <button class="hbtn" data-act="pass" title="Cambiar contraseña"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg></button>
            <button class="hbtn" data-act="logout" title="Salir"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/></svg></button>
          </div>
        </div>
        <div class="hdr-hello">
          <div class="hello-g">${saludo()}, ${perfil.nombre}</div>
          <div class="hello-sub">${ROLES[perfil.rol]||perfil.rol}${perfil.ejecutivo?(' · '+perfil.ejecutivo):''}</div>
        </div>
      </header>
      <main class="content" id="content"></main>
    </div>`);

  root.querySelector('[data-act="reload"]').addEventListener('click', handlers.onReload);
  root.querySelector('[data-act="logout"]').addEventListener('click', handlers.onLogout);
  root.querySelector('[data-act="pass"]').addEventListener('click', abrirCambiarPass);

  return { root, content: root.querySelector('#content') };
}

const PASS_OK = p => p.length>=8 && /[A-Z]/.test(p) && /[a-z]/.test(p) && /[!@#$%&*.\-_?]/.test(p);

function abrirCambiarPass() {
  const m = el(`<div class="p-modal"><div class="p-mbox" style="max-width:380px">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px"><b>Cambiar contraseña</b><span data-x style="cursor:pointer;font-size:1.2em">\u2715</span></div>
    <div class="note" style="margin-bottom:12px">Mínimo 8 caracteres, una mayúscula, una minúscula y un carácter especial (! @ # $ % & * ...).</div>
    <label class="alab">Nueva contraseña</label><input class="inp" type="password" id="pw-n">
    <label class="alab">Repite la nueva contraseña</label><input class="inp" type="password" id="pw-n2">
    <button class="btn-primary" id="pw-go" style="margin-top:12px">Actualizar contraseña</button>
    <div class="login-err" id="pw-msg"></div>
  </div></div>`);
  document.body.appendChild(m);
  m.querySelector('[data-x]').addEventListener('click', ()=>m.remove());
  m.querySelector('#pw-go').addEventListener('click', async () => {
    const n=m.querySelector('#pw-n').value, n2=m.querySelector('#pw-n2').value, msg=m.querySelector('#pw-msg');
    msg.style.display='none';
    if (!n||!n2) { return showp(msg,'Llena ambos campos.'); }
    if (n!==n2) { return showp(msg,'Las contraseñas no coinciden.'); }
    if (!PASS_OK(n)) { return showp(msg,'No cumple los requisitos de seguridad.'); }
    const btn=m.querySelector('#pw-go'); btn.disabled=true; btn.textContent='Guardando…';
    try {
      const { error } = await db.auth.updateUser({ password:n });
      if (error) throw error;
      alert('Contraseña actualizada.'); m.remove();
    } catch(e) { btn.disabled=false; btn.textContent='Actualizar contraseña'; showp(msg, e.message||'No se pudo actualizar.'); }
  });
}
function showp(el, t){ el.textContent=t; el.style.display='block'; }
