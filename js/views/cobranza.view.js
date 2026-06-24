// Vista Cobranza (réplica de cobranza.html). Lista por prioridad/color + comentarios + escalar.
import { el, money } from '../lib/dom.js';
import { fetchCartera, fetchAllCalendarios } from '../repositories/clientes.repo.js';
import { agruparCalendario } from '../services/clientes.service.js';
import { construirCobranza, colorBucket, COB_ESTADOS } from '../services/cobranza.service.js';
import { insertComentario } from '../repositories/cobranza.repo.js';
import { abrirFicha } from './clientes.view.js';

export async function renderCobranza(perfil) {
  const root = el('<div class="view"><div class="loader">Cargando cobranza…</div></div>');
  const [cartera, cals] = await Promise.all([fetchCartera(), fetchAllCalendarios()]);
  const calBy = agruparCalendario(cals);
  const { kpis, ejecutivos } = construirCobranza(cartera, calBy, perfil.rol, perfil.ejecutivo);

  root.innerHTML = `
    <div class="kpis kpis3">
      <div class="kcard"><div class="klab">Vencido total</div><div class="kval num" style="font-size:1.25em;color:var(--red)">${money(kpis.totalVencido)}</div></div>
      <div class="kcard"><div class="klab">En mora</div><div class="kval num" style="font-size:1.25em">${kpis.totalClientes}</div></div>
      <div class="kcard"><div class="klab">Crítico +45d</div><div class="kval num" style="font-size:1.25em;color:var(--red)">${money(kpis.critico45)}</div></div>
    </div>
    ${ejecutivos.map(e => `
      <div class="sec-h"><span class="t">${e.ejecutivo} · ${money(e.totalVencido)} · ${e.nClientes}</span><span class="ln"></span></div>
      ${e.clientes.map(c => {
        const col = colorBucket(c.bucket);
        const etiqueta = c.esPreventivo ? `Por vencer · ${c.proxPago}` : `${c.dias} días vencido`;
        const monto = c.esPreventivo ? c.porVencer : c.vencido;
        return `<div class="cobcard ${col}" data-n="${encodeURIComponent(c.nombre)}">
          <div style="min-width:0"><div class="nm">${c.nombre}</div><div class="mt">${etiqueta}</div></div>
          <div style="display:flex;align-items:center;gap:8px">
            <div class="sal num" style="color:var(--${col==='blue'?'navy':'red'})">${money(monto)}</div>
            <button class="cob-com" data-c="${encodeURIComponent(c.nombre)}" title="Comentario">💬</button>
          </div>
        </div>`;
      }).join('')}
    `).join('') || '<div class="note">No hay clientes en cobranza. ✅</div>'}`;

  root.querySelectorAll('.cobcard').forEach(card => card.addEventListener('click', (ev) => {
    if (ev.target.closest('.cob-com')) return;
    abrirFicha(decodeURIComponent(card.dataset.n), perfil);
  }));
  root.querySelectorAll('.cob-com').forEach(b => b.addEventListener('click', () => abrirComentario(decodeURIComponent(b.dataset.c), perfil)));
  return root;
}

function abrirComentario(cliente, perfil) {
  const ov = el(`<div class="overlay">
    <div class="ohead"><button class="back">←</button><div class="ot">Comentario · ${cliente}</div></div>
    <div class="ocontent">
      <label class="alab">Estado de gestión</label>
      <select class="inp" id="co-estado">${COB_ESTADOS.map(e=>`<option>${e}</option>`).join('')}</select>
      <label class="alab">Comentario</label>
      <textarea class="inp" id="co-texto" style="min-height:90px" placeholder="Qué dijo, qué se acordó…"></textarea>
      <button class="btn-primary" id="co-guardar">Guardar comentario</button>
      <div class="login-err" id="co-err"></div>
      <div class="note" style="margin-top:10px">Elige <b>REVISION CON GERENCIA</b> para escalar el caso a Hugo.</div>
    </div></div>`);
  document.body.appendChild(ov);
  ov.querySelector('.back').addEventListener('click', () => ov.remove());
  ov.querySelector('#co-guardar').addEventListener('click', async () => {
    const estado = ov.querySelector('#co-estado').value;
    const texto = ov.querySelector('#co-texto').value.trim();
    const err = ov.querySelector('#co-err');
    if (!texto) { err.textContent='Escribe el comentario.'; err.style.display='block'; return; }
    try {
      await insertComentario(cliente, perfil.email||perfil.nombre, perfil.rol, estado, texto);
      alert('✅ Comentario guardado.'); ov.remove();
    } catch (e) { err.textContent = e.message||'No se pudo guardar.'; err.style.display='block'; }
  });
}
