// Vista "Avisos" — teléfonos del equipo y quién recibe cada notificación de WhatsApp.
// Solo ADMIN. La web no envía por servidor: "Probar" abre wa.me para mandarlo a mano.
import { el } from '../lib/dom.js';
import { fetchPerfiles, fetchContactos, fetchEventos, guardarContactos, guardarEventos } from '../repositories/avisos.repo.js';
import { mezclarEventos, mezclarContactos, numeroValido } from '../services/avisos.service.js';

export async function abrirAvisos(perfil) {
  if (perfil.rol !== 'ADMIN') { alert('Solo el administrador configura avisos.'); return; }
  const ov = el(`<div class="overlay"><div class="ohead"><button class="back">←</button><div class="ot">Avisos</div></div><div class="ocontent"><div class="loader">Cargando…</div></div></div>`);
  document.body.appendChild(ov);
  const c = ov.querySelector('.ocontent');
  ov.querySelector('.back').addEventListener('click', () => ov.remove());

  const [perfiles, contactosSaved, eventosSaved] = await Promise.all([fetchPerfiles(), fetchContactos(), fetchEventos()]);
  let CONTACTOS = mezclarContactos(perfiles, contactosSaved);
  let EVENTOS = mezclarEventos(eventosSaved);

  function render() {
    const personas = CONTACTOS.map(x => x.persona);
    c.innerHTML = `
      <div class="note" style="margin-bottom:14px">Aquí editas los números del equipo y quién recibe cada notificación de WhatsApp. Aplica a Cobranza y Tubería.</div>

      <div class="sec-h"><span class="t">Teléfonos del equipo</span><span class="ln"></span></div>
      <div style="font-size:.74em;color:var(--slate);margin-bottom:8px">Formato <b>+521</b> y 10 dígitos. Los usuarios se dan de alta en la pantalla de Equipo.</div>
      <div id="av-contactos">${CONTACTOS.map((ct, i) => `
        <div class="fcard" style="margin-bottom:8px">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px"><b style="color:var(--navy)">${ct.nombre}</b><span style="font-size:.66em;color:var(--slate)">${ct.rol || 'usuario'}</span></div>
          <input class="inp av-num" data-i="${i}" value="${ct.num || ''}" placeholder="+521..." style="margin:0">
          <div style="display:flex;justify-content:flex-end;margin-top:6px"><span class="av-probar" data-i="${i}" style="font-size:.74em;color:var(--steel);cursor:pointer;font-weight:700">Probar (WhatsApp)</span></div>
        </div>`).join('') || '<div class="note">No hay usuarios todavía.</div>'}</div>

      <div class="sec-h" style="margin-top:18px"><span class="t">Notificaciones</span><span class="ln"></span></div>
      <div style="font-size:.74em;color:var(--slate);margin-bottom:8px">Toca a las personas que deben recibir cada aviso. Apaga el switch para silenciar un evento.</div>
      <div id="av-eventos">${EVENTOS.map((ev, i) => `
        <div class="fcard" style="margin-bottom:8px;${ev.activo ? '' : 'opacity:.55'}" data-ev="${i}">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
            <div style="font-weight:700;font-size:.86em">${ev.desc} <span class="bk-chip" style="font-size:.62em">${ev.proy}</span></div>
            <label style="display:flex;align-items:center;gap:6px;font-size:.72em;color:var(--slate);margin:0;cursor:pointer"><input type="checkbox" class="av-on" data-i="${i}" ${ev.activo ? 'checked' : ''}> on</label>
          </div>
          <div class="bk-chips">${personas.map(p => {
            const ct = CONTACTOS.find(x => x.persona === p);
            const on = ev.dest.indexOf(p) >= 0;
            return `<span class="av-dest chip" data-ev="${i}" data-p="${p}" style="cursor:pointer;${on ? 'background:var(--green);color:#fff;border-color:var(--green)' : ''}">${ct ? ct.nombre : p}</span>`;
          }).join('')}</div>
        </div>`).join('')}</div>

      <div style="height:70px"></div>
      <div style="position:sticky;bottom:0;background:var(--bg);padding:10px 0;display:flex;gap:10px">
        <button class="btn-primary" id="av-descartar" style="flex:0 0 auto;background:var(--slate);margin:0">Descartar</button>
        <button class="btn-primary" id="av-guardar" style="flex:1;margin:0">Guardar cambios</button>
      </div>`;

    c.querySelectorAll('.av-num').forEach(inp => inp.addEventListener('change', () => { CONTACTOS[+inp.dataset.i].num = inp.value.trim(); }));
    c.querySelectorAll('.av-probar').forEach(b => b.addEventListener('click', () => probar(CONTACTOS[+b.dataset.i])));
    c.querySelectorAll('.av-on').forEach(chk => chk.addEventListener('change', () => { EVENTOS[+chk.dataset.i].activo = chk.checked; render(); }));
    c.querySelectorAll('.av-dest').forEach(chip => chip.addEventListener('click', () => {
      const ev = EVENTOS[+chip.dataset.ev]; const p = chip.dataset.p;
      const ix = ev.dest.indexOf(p); if (ix >= 0) ev.dest.splice(ix, 1); else ev.dest.push(p);
      render();
    }));
    c.querySelector('#av-descartar').addEventListener('click', async () => {
      const [cs, es] = await Promise.all([fetchContactos(), fetchEventos()]);
      CONTACTOS = mezclarContactos(perfiles, cs); EVENTOS = mezclarEventos(es); render();
    });
    c.querySelector('#av-guardar').addEventListener('click', guardar);
  }

  function probar(ct) {
    if (!ct.num) return alert('Pon el teléfono de ' + ct.nombre + ' primero.');
    if (!numeroValido(ct.num)) return alert('Número inválido: usa +521 y 10 dígitos.');
    const msg = 'Prueba MoneyCash CRM: si recibes esto, tu WhatsApp quedó bien configurado.';
    const tel = ct.num.replace(/[^0-9]/g, '');
    window.open('https://wa.me/' + tel + '?text=' + encodeURIComponent(msg), '_blank');
  }

  async function guardar() {
    for (const ct of CONTACTOS) {
      if (!numeroValido(ct.num)) { alert('Número inválido en ' + ct.nombre + ': usa +521 y dígitos.'); return; }
    }
    const btn = c.querySelector('#av-guardar'); btn.disabled = true; btn.textContent = 'Guardando…';
    try {
      await guardarContactos(CONTACTOS, perfil);
      await guardarEventos(EVENTOS, perfil);
      alert('✅ Configuración guardada.');
    } catch (e) { alert('❌ ' + e.message); }
    finally { btn.disabled = false; btn.textContent = 'Guardar cambios'; }
  }

  render();
}
