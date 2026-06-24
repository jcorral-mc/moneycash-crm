// Shell de la app: header + navegación inferior. Réplica del tablero del Script.
import { el, saludo } from '../lib/dom.js';
import { ROLES } from '../config.js';

const ICONS = {
  inicio:'<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="11" width="7" height="10" rx="1.5"/><rect x="3" y="15" width="7" height="6" rx="1.5"/>',
  cartera:'<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  cobranza:'<path d="M3 17l5-5 4 3 7-8"/><path d="M16 4h5v5"/>',
};

/** Monta el shell y devuelve { root, content, setActive } */
export function renderShell(perfil, nav, handlers) {
  const root = el(`
    <div class="app">
      <header class="hdr">
        <div class="hdr-top">
          <div class="brand"><div class="brand-mark">M</div><div class="brand-wm">MONEY<b>CASH</b></div></div>
          <div class="hdr-icons">
            <button class="hbtn" data-act="reload" title="Actualizar"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M21 12a9 9 0 1 1-3-6.7"/><path d="M21 4v4h-4"/></svg></button>
            <button class="hbtn" data-act="logout" title="Salir"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/></svg></button>
          </div>
        </div>
        <div class="hdr-hello">
          <div class="hello-g">${saludo()}, ${perfil.nombre}</div>
          <div class="hello-sub">${ROLES[perfil.rol]||perfil.rol}${perfil.ejecutivo?(' · '+perfil.ejecutivo):''}</div>
        </div>
      </header>
      <main class="content" id="content"></main>
      <nav class="nav"></nav>
    </div>`);

  const navEl = root.querySelector('.nav');
  nav.forEach((item,i) => {
    const b = el(`<button data-view="${item.id}" class="${i===0?'on':''}">
      ${i===0?'<span class="dot"></span>':''}
      <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7">${ICONS[item.id]||''}</svg>
      <span class="lb">${item.label}</span></button>`);
    b.addEventListener('click', () => handlers.onNav(item.id, b));
    navEl.appendChild(b);
  });

  root.querySelector('[data-act="reload"]').addEventListener('click', handlers.onReload);
  root.querySelector('[data-act="logout"]').addEventListener('click', handlers.onLogout);

  const setActive = (id) => {
    [...navEl.children].forEach(b => { b.className=''; const d=b.querySelector('.dot'); if(d)d.remove(); });
    const act = navEl.querySelector(`[data-view="${id}"]`);
    if (act){ act.className='on'; const dot=document.createElement('span'); dot.className='dot'; act.prepend(dot); }
  };

  return { root, content: root.querySelector('#content'), setActive };
}
