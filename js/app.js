// Bootstrap de MoneyCash CRM v2 — pantalla única (inicio agrupado por tipo).
import { getSession, getPerfil, logout } from './services/auth.service.js';
import { renderLogin } from './views/login.view.js';
import { renderShell } from './components/shell.js';
import { renderDashboard } from './views/dashboard.view.js';

const app = document.getElementById('app-root');
let PERFIL = null, SHELL = null;

async function mountInicio() {
  SHELL.content.innerHTML = '<div class="loader">Cargando…</div>';
  const node = await renderDashboard(PERFIL);
  SHELL.content.innerHTML = '';
  SHELL.content.appendChild(node);
}

async function startApp(session) {
  PERFIL = await getPerfil(session);
  app.innerHTML = '';
  SHELL = renderShell(PERFIL, {
    onReload: () => mountInicio(),
    onLogout: async () => { await logout(); boot(); },
  });
  app.appendChild(SHELL.root);
  mountInicio();
}

async function boot() {
  const session = await getSession();
  if (session) { startApp(session); }
  else { app.innerHTML = ''; app.appendChild(renderLogin((s) => startApp(s))); }
}
boot();
