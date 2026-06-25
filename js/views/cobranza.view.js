// Vista Cobranza (réplica de la pantalla del Script).
// KPIs + casos en revisión (gerente/admin) + lista por ejecutivo.
// Por cliente: panel de gestión (comentarios+estado, escalar con checklist, visita, historial).
import { el, money } from '../lib/dom.js';
import { fetchCartera, fetchAllCalendarios } from '../repositories/clientes.repo.js';
import { agruparCalendario } from '../services/clientes.service.js';
import { construirCobranza, colorBucket, COB_ESTADOS, COB_SALIDAS, COB_SALIDA_LABEL } from '../services/cobranza.service.js';
import { insertComentario, fetchGestionCliente, fetchHistorialVisitas, escalarRevision, fetchCasosRevision, resolverRevision } from '../repositories/cobranza.repo.js';
import { asignarVisita } from '../repositories/visitas.repo.js';
import { abrirFicha } from './clientes.view.js';

const enc = s => encodeURIComponent(s);
const dec = s => decodeURIComponent(s);
const fmt = d => { if (!d) return ''; try { return new Date(d).toLocaleDateString('es-MX',{day:'2-digit',month:'2-digit',year:'numeric'}); } catch(e){ return String(d); } };

export async function renderCobranza(perfil) {
  const root = el('<div class="view"><div class="loader">Cargando cobranza…</div></div>');
  const [cartera, cals, casos] = await Promise.all([
    fetchCartera(), fetchAllCalendarios(), fetchCasosRevision(perfil.rol),
  ]);
  const calBy = agruparCalendario(cals);
  const { kpis, ejecutivos } = construirCobranza(cartera, calBy, perfil.rol, perfil.ejecutivo);

  function reload(){ renderCobranza(perfil).then(n => { const v = root.parentNode; if (v) v.replaceChild(n, root); }); }

  const revisionHTML = (casos && casos.length) ? `
    <div class="sec-h"><span class="t">⚖️ En revisión con gerencia · ${casos.length}</span><span class="ln"></span></div>
    ${casos.map(c => `
      <div class="cobcard crit" data-rev="${c.id}">
        <div style="min-width:0"><div class="nm">${c.cliente}</div><div class="mt">${c.ejecutivo||'(sin ejec.)'} · escaló ${c.escalo||''}</div></div>
        ${['ADMIN','GERENTE'].includes(perfil.rol) ? `<button class="btn-mini-resolver" data-rev="${c.id}">Resolver</button>` : ''}
      </div>`).join('')}` : '';

  root.innerHTML = `
    <div class="kpis kpis3">
      <div class="kcard"><div class="klab">Vencido total</div><div class="kval num" style="font-size:1.25em;color:var(--red)">${money(kpis.totalVencido)}</div></div>
      <div class="kcard"><div class="klab">En mora</div><div class="kval num" style="font-size:1.25em">${kpis.totalClientes}</div></div>
      <div class="kcard"><div class="klab">Crítico +45d</div><div class="kval num" style="font-size:1.25em;color:var(--red)">${money(kpis.critico45)}</div></div>
    </div>
    ${revisionHTML}
    ${ejecutivos.map(e => `
      <div class="sec-h"><span class="t">${e.ejecutivo} · ${money(e.totalVencido)} · ${e.nClientes}</span><span class="ln"></span></div>
      ${e.clientes.map(c => {
        const col = colorBucket(c.bucket);
        const etiqueta = c.esPreventivo ? `Por vencer · ${c.proxPago}` : `${c.dias} días vencido`;
        const monto = c.esPreventivo ? c.porVencer : c.vencido;
        return `<div class="cobcard ${col}" data-n="${enc(c.nombre)}" data-m="${monto}">
          <div style="min-width:0"><div class="nm">${c.nombre}</div><div class="mt">${etiqueta}</div></div>
          <div class="sal num" style="color:var(--${col==='blue'?'navy':'red'})">${money(monto)}</div>
        </div>`;
      }).join('')}
    `).join('') || (revisionHTML ? '' : '<div class="note">No hay clientes en cobranza.</div>')}`;

  root.querySelectorAll('.cobcard[data-n]').forEach(card => card.addEventListener('click', () =>
    abrirGestion(dec(card.dataset.n), Number(card.dataset.m)||0, perfil, reload)));
  root.querySelectorAll('.btn-mini-resolver').forEach(b => b.addEventListener('click', (ev) => {
    ev.stopPropagation();
    const caso = casos.find(c => String(c.id) === b.dataset.rev);
    if (caso) abrirResolver(caso, perfil, reload);
  }));
  return root;
}

// ── Panel de gestión de un cliente en cobranza ──
async function abrirGestion(cliente, montoVencido, perfil, reload) {
  const puedeVisita = ['ADMIN','GERENTE','AUX_ADMIN'].includes(perfil.rol);
  const ov = el(`<div class="overlay">
    <div class="ohead"><button class="back">\u2190</button><div class="ot">${cliente}</div></div>
    <div class="ocontent"><div class="loader">Cargando gesti\u00f3n\u2026</div></div></div>`);
  document.body.appendChild(ov);
  ov.querySelector('.back').addEventListener('click', () => ov.remove());

  const { comentarios, revision } = await fetchGestionCliente(cliente, perfil.rol, perfil.email);
  const visitas = await fetchHistorialVisitas(cliente);
  const c = ov.querySelector('.ocontent');

  const bannerRev = revision ? `<div class="rev-banner">EN REVISI\u00d3N CON GERENCIA desde ${fmt(revision.fecha_escalado)} \u00b7 escal\u00f3 ${revision.escalo||''}</div>` : '';
  const histCom = comentarios.length
    ? comentarios.map(x => `<div class="coment"><div style="display:flex;justify-content:space-between;gap:8px"><b>${x.estado||''}</b><span style="color:var(--slate);font-size:.82em">${fmt(x.created_at||x.fecha)} \u00b7 ${x.autor||''}</span></div><div>${x.comentario||''}</div></div>`).join('')
    : '<div class="note">Sin comentarios a\u00fan.</div>';
  const histVis = visitas.length
    ? visitas.map(v => `<div class="coment"><div style="display:flex;justify-content:space-between;gap:8px"><b>${v.tipo||'VISITA'} \u00b7 ${v.estatus||''}</b><span style="color:var(--slate);font-size:.82em">${fmt(v.fecha)}</span></div><div>${v.resultado||''}${v.comentarios?(' \u2014 '+v.comentarios):''}</div></div>`).join('')
    : '<div class="note">Sin visitas registradas.</div>';

  c.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
      <div class="sal num" style="color:var(--red)">Vencido ${money(montoVencido)}</div>
      <button id="g-ficha" class="btn-link">Ficha y calendario \u2192</button>
    </div>
    ${bannerRev}

    <div class="sec-h"><span class="t">Comentario de gesti\u00f3n</span><span class="ln"></span></div>
    <select class="inp" id="g-estado">${COB_ESTADOS.map(e=>`<option>${e}</option>`).join('')}</select>
    <textarea class="inp" id="g-texto" style="min-height:72px;margin-top:8px" placeholder="Qu\u00e9 dijo, qu\u00e9 se acord\u00f3\u2026"></textarea>
    <button class="btn-primary" id="g-coment" style="margin-top:8px">Guardar comentario</button>
    <div class="login-err" id="g-err"></div>

    ${(!revision && perfil.rol!=='VISITAS') ? `
    <div class="sec-h"><span class="t">Escalar a revisi\u00f3n con gerencia</span><span class="ln"></span></div>
    <div class="note" style="margin-bottom:6px">Confirma las 3 gestiones antes de escalar a Hugo:</div>
    <label class="chk"><input type="checkbox" id="g-c1"> Llam\u00e9 al cliente</label>
    <label class="chk"><input type="checkbox" id="g-c2"> Llam\u00e9 a las referencias</label>
    <label class="chk"><input type="checkbox" id="g-c3"> Visit\u00e9 el domicilio</label>
    <textarea class="inp" id="g-nota" style="min-height:54px;margin-top:8px" placeholder="Nota del escalamiento (opcional)"></textarea>
    <button class="btn-primary" id="g-escalar" style="margin-top:8px;background:var(--amber)">Escalar a gerencia</button>
    <div class="login-err" id="g-err2"></div>` : ''}

    ${puedeVisita ? `
    <div class="sec-h"><span class="t">Asignar visita de cobranza</span><span class="ln"></span></div>
    <input class="inp" id="v-dir" placeholder="Direcci\u00f3n (opcional)">
    <input class="inp" id="v-hor" placeholder="Horario (ej. 4-6pm)" style="margin-top:8px">
    <input class="inp" id="v-com" placeholder="Instrucci\u00f3n para el verificador" style="margin-top:8px">
    <button class="btn-primary" id="g-visita" style="margin-top:8px">Asignar a verificador</button>
    <div class="login-err" id="g-err3"></div>` : ''}

    <div class="sec-h"><span class="t">Historial de visitas</span><span class="ln"></span></div>
    ${histVis}

    <div class="sec-h"><span class="t">Historial de comentarios</span><span class="ln"></span></div>
    ${histCom}`;

  c.querySelector('#g-ficha').addEventListener('click', () => abrirFicha(cliente, perfil));

  c.querySelector('#g-coment').addEventListener('click', async () => {
    const estado = c.querySelector('#g-estado').value;
    const texto = c.querySelector('#g-texto').value.trim();
    const err = c.querySelector('#g-err');
    if (!texto) { err.textContent='Escribe el comentario.'; err.style.display='block'; return; }
    try {
      await insertComentario(cliente, perfil.email||perfil.nombre, perfil.rol, estado, texto);
      ov.remove(); reload && reload();
    } catch (e) { err.textContent = e.message||'No se pudo guardar.'; err.style.display='block'; }
  });

  const btnEsc = c.querySelector('#g-escalar');
  if (btnEsc) btnEsc.addEventListener('click', async () => {
    const err = c.querySelector('#g-err2');
    const checklist = { llamoCliente: c.querySelector('#g-c1').checked, llamoRef: c.querySelector('#g-c2').checked, visitoDom: c.querySelector('#g-c3').checked };
    try {
      const r = await escalarRevision(cliente, perfil, checklist, c.querySelector('#g-nota').value.trim());
      alert(r.msg); ov.remove(); reload && reload();
    } catch (e) { err.textContent = e.message; err.style.display='block'; }
  });

  const btnVis = c.querySelector('#g-visita');
  if (btnVis) btnVis.addEventListener('click', async () => {
    const err = c.querySelector('#g-err3');
    try {
      const r = await asignarVisita({ tipo:'COBRANZA', cliente, direccion:c.querySelector('#v-dir').value.trim(),
        horario:c.querySelector('#v-hor').value.trim(), comentario:c.querySelector('#v-com').value.trim() }, perfil);
      alert(r.msg); ov.remove(); reload && reload();
    } catch (e) { err.textContent = e.message; err.style.display='block'; }
  });
}

// ── Resolver un caso en revisión (gerente/admin) ──
function abrirResolver(caso, perfil, reload) {
  const ov = el(`<div class="overlay">
    <div class="ohead"><button class="back">\u2190</button><div class="ot">Resolver \u00b7 ${caso.cliente}</div></div>
    <div class="ocontent">
      <div class="note" style="margin-bottom:8px">Ejecutivo: ${caso.ejecutivo||'\u2014'} \u00b7 escal\u00f3 ${caso.escalo||''}</div>
      <label class="alab">Salida del caso</label>
      <select class="inp" id="r-salida">${COB_SALIDAS.map(s=>`<option value="${s}">${COB_SALIDA_LABEL[s]}</option>`).join('')}</select>
      <div id="r-jur" style="display:none;margin-top:10px">
        <div class="note" style="margin-bottom:6px">Para jur\u00eddico confirma:</div>
        <label class="chk"><input type="checkbox" id="r-h2"> Visit\u00e9 en 2 horarios distintos</label>
        <label class="chk"><input type="checkbox" id="r-neg"> Agot\u00e9 la negociaci\u00f3n / convenio</label>
        <label class="chk"><input type="checkbox" id="r-con"> Tuve contacto directo con el cliente</label>
      </div>
      <textarea class="inp" id="r-nota" style="min-height:60px;margin-top:10px" placeholder="Nota de cierre / contacto (opcional)"></textarea>
      <button class="btn-primary" id="r-ok" style="margin-top:10px">Resolver caso</button>
      <div class="login-err" id="r-err"></div>
    </div></div>`);
  document.body.appendChild(ov);
  ov.querySelector('.back').addEventListener('click', () => ov.remove());
  const sel = ov.querySelector('#r-salida'), jur = ov.querySelector('#r-jur');
  sel.addEventListener('change', () => { jur.style.display = sel.value==='JURIDICO' ? 'block' : 'none'; });
  ov.querySelector('#r-ok').addEventListener('click', async () => {
    const err = ov.querySelector('#r-err');
    const salida = sel.value;
    const detalle = { notaContacto: ov.querySelector('#r-nota').value.trim() };
    if (salida === 'JURIDICO') {
      detalle.visito2Horarios = ov.querySelector('#r-h2').checked;
      detalle.agotoNegociacion = ov.querySelector('#r-neg').checked;
      detalle.tuvoContacto = ov.querySelector('#r-con').checked;
    }
    try {
      const r = await resolverRevision(caso, salida, detalle, perfil);
      alert(r.msg); ov.remove(); reload && reload();
    } catch (e) { err.textContent = e.message; err.style.display='block'; }
  });
}

// Abre Cobranza como overlay (desde el inicio agrupado).
export async function abrirCobranza(perfil) {
  const ov = el(`<div class="overlay"><div class="ohead"><button class="back">\u2190</button><div class="ot">Cobranza</div></div><div class="ocontent"><div class="loader">Cargando\u2026</div></div></div>`);
  document.body.appendChild(ov);
  ov.querySelector('.back').addEventListener('click', () => ov.remove());
  const node = await renderCobranza(perfil);
  const c = ov.querySelector('.ocontent'); c.innerHTML=''; c.appendChild(node);
}
