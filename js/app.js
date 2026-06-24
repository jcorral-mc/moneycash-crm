// Bootstrap y router de MoneyCash CRM v2
import { getSession, getPerfil, logout } from './services/auth.service.js';
import { renderLogin } from './views/login.view.js';
import { renderShell } from './components/shell.js';
import { renderDashboard } from './views/dashboard.view.js';
import { renderClientes } from './views/clientes.view.js';
import { renderCobranza } from './views/cobranza.view.js';

const app = document.getElementById('app-root');
let PERFIL = null, SHELL = null;

const NAV = [
  { id:'inicio',   label:'Inicio' },
  { id:'cartera',  label:'Cartera' },
  { id:'cobranza', label:'Cobranza' },
];

// Vistas registradas (se van agregando módulo por módulo)
const VIEWS = {
  inicio:   (p) => renderDashboard(p),
  cartera:  (p) => renderClientes(p),
  cobranza: (p) => renderCobranza(p),
};
function placeholder(t, m){ const d=document.createElement('div'); d.className='view'; d.innerHTML=`<div class="note"><b>${t}</b><br>${m}</div>`; return d; }

async function mountView(id, btn) {
  SHELL.setActive(id);
  SHELL.content.innerHTML = '<div class="loader">Cargando…</div>';
  const node = await VIEWS[id](PERFIL);
  SHELL.content.innerHTML = '';
  SHELL.content.appendChild(node);
}

async function startApp(session) {
  PERFIL = await getPerfil(session);
  app.innerHTML = '';
  SHELL = renderShell(PERFIL, NAV, {
    onNav:   (id, btn) => mountView(id, btn),
    onReload:() => mountView(currentView()),
    onLogout:async () => { await logout(); boot(); },
  });
  app.appendChild(SHELL.root);
  mountView('inicio');
}
let _cur='inicio';
function currentView(){ return _cur; }

async function boot() {
  const session = await getSession();
  if (session) { startApp(session); }
  else {
    app.innerHTML = '';
    app.appendChild(renderLogin((s) => startApp(s)));
  }
}
boot();
