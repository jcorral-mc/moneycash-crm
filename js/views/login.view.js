// Vista de Login (réplica de login.html del Script, look bancario)
import { login } from '../services/auth.service.js';
import { el } from '../lib/dom.js';

export function renderLogin(onSuccess) {
  const root = el(`
    <div class="login-screen">
      <div class="login-box">
        <div class="login-mark">M</div>
        <div class="login-logo">MONEY<b>CASH</b></div>
        <div class="login-sub">Sistema de cartera</div>
        <label>Correo</label>
        <input type="email" id="lg-email" autocomplete="username">
        <label>Contraseña</label>
        <input type="password" id="lg-pass" autocomplete="current-password">
        <button id="lg-btn">Entrar</button>
        <div class="login-err" id="lg-err"></div>
      </div>
    </div>`);

  const email = root.querySelector('#lg-email');
  const pass  = root.querySelector('#lg-pass');
  const btn   = root.querySelector('#lg-btn');
  const err   = root.querySelector('#lg-err');

  async function submit() {
    err.style.display='none';
    if (!email.value.trim() || !pass.value) { err.textContent='Pon tu correo y contraseña.'; err.style.display='block'; return; }
    btn.textContent='Entrando…'; btn.disabled=true;
    try {
      const session = await login(email.value.trim(), pass.value);
      onSuccess(session);
    } catch (e) {
      btn.textContent='Entrar'; btn.disabled=false;
      err.textContent='Correo o contraseña incorrectos.'; err.style.display='block';
    }
  }
  btn.addEventListener('click', submit);
  pass.addEventListener('keydown', e => { if (e.key==='Enter') submit(); });
  return root;
}
