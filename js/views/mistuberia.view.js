// Vista "Mi Tubería" — visualizador read-only del pipeline. Ejecutivo ve lo suyo;
// gerencia (ADMIN/GERENTE) ve todo con filtro por ejecutivo. Mes + alcance + búsqueda.
import { el, money } from '../lib/dom.js';
import { fetchProspectos } from '../repositories/tuberia.repo.js';
import { semaforo, diasDe } from '../services/tuberia.service.js';
import { construirPipeline, mesesDisponibles, ejecutivosDe, colorGrupo } from '../services/mistuberia.service.js';

const norm = s => (s || '').toString().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

export async function abrirMisTuberia(perfil) {
  if (!['ADMIN', 'GERENTE', 'EJECUTIVO'].includes(perfil.rol)) { alert('Este módulo no está disponible para tu rol.'); return; }
  const verTodos = ['ADMIN', 'GERENTE'].includes(perfil.rol);

  const ov = el(`<div class="overlay"><div class="ohead"><button class="back">←</button><div class="ot">Mi Tubería</div></div><div class="ocontent"><div class="loader">Cargando prospectos…</div></div></div>`);
  document.body.appendChild(ov);
  const c = ov.querySelector('.ocontent');
  ov.querySelector('.back').addEventListener('click', () => ov.remove());

  const PROSPECTOS = await fetchProspectos();
  const hoyMes = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); };

  const meses = mesesDisponibles(PROSPECTOS);
  let MES = meses.includes(hoyMes()) || !meses.length ? hoyMes() : meses[0];
  let SCOPE = 'mes';            // 'mes' | 'todos'
  let EJEC = '';               // '' = todos (solo gerencia)
  let QUERY = '';
  const ABIERTO = {};

  const ejecutivos = verTodos ? ejecutivosDe(PROSPECTOS) : [];

  function render() {
    const { etapas, resumen } = construirPipeline(PROSPECTOS, {
      ejecutivo: verTodos ? EJEC : perfil.ejecutivo,
      mes: MES, scope: SCOPE, busca: QUERY,
    });

    c.innerHTML = `
      ${verTodos ? `<label class="alab">Ejecutivo</label>
      <select class="inp" id="mt-ej"><option value="">Todos los ejecutivos</option>${ejecutivos.map(e => `<option ${e === EJEC ? 'selected' : ''}>${e}</option>`).join('')}</select>` : ''}

      <label class="alab">Mes</label>
      <input class="inp" id="mt-mes" type="month" value="${MES}">

      <div class="kpis kpis3" style="margin-top:10px">
        <div class="kcard"><div class="klab">En proceso</div><div class="kval num" style="font-size:1.2em">${resumen.enProceso}</div></div>
        <div class="kcard"><div class="klab">Monto en proceso</div><div class="kval num" style="font-size:1.2em">${money(resumen.montoProceso)}</div></div>
        <div class="kcard"><div class="klab">Surtidos</div><div class="kval num green" style="font-size:1.2em">${resumen.ganados}</div></div>
      </div>
      <div style="text-align:center;font-size:.7em;color:var(--slate);margin:2px 0 10px">${SCOPE === 'todos' && QUERY ? 'la búsqueda abarca todos los meses' : 'del mes seleccionado'}</div>

      <input class="inp" id="mt-busca" placeholder="Buscar prospecto por nombre…" value="${QUERY}">
      <div class="tb-tabs" style="margin:8px 0 12px">
        <button class="tb-tab${SCOPE === 'mes' ? ' on' : ''}" data-sc="mes">En este mes</button>
        <button class="tb-tab${SCOPE === 'todos' ? ' on' : ''}" data-sc="todos">En todos los meses</button>
      </div>

      <div id="mt-lista"></div>`;

    if (verTodos) c.querySelector('#mt-ej').addEventListener('change', e => { EJEC = e.target.value; render(); });
    c.querySelector('#mt-mes').addEventListener('change', e => { MES = e.target.value || hoyMes(); render(); });
    c.querySelectorAll('.tb-tab').forEach(b => b.addEventListener('click', () => { SCOPE = b.dataset.sc; render(); }));
    const busca = c.querySelector('#mt-busca');
    busca.addEventListener('input', () => { QUERY = busca.value.trim(); render(); setTimeout(() => { const i = c.querySelector('#mt-busca'); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); } }, 0); });

    pintarLista(etapas);
  }

  function pintarLista(etapas) {
    const cont = c.querySelector('#mt-lista');
    const q = norm(QUERY);
    let html = '';
    etapas.forEach((e, idx) => {
      // Ocultar etapas vacías; al buscar, mostrar solo las que tienen coincidencias.
      if (e.count === 0 && (e.grupo !== 'activo' || q)) return;
      if (q) ABIERTO[idx] = true; else if (!(idx in ABIERTO)) ABIERTO[idx] = (e.grupo === 'activo' && e.count > 0);
      const col = colorGrupo(e.grupo);
      const open = ABIERTO[idx];
      html += `<div class="tub-acc" style="border-left:4px solid ${col}">
        <div class="tub-head" data-idx="${idx}">
          <div class="tub-fl"><div class="tub-id">${e.etapa}</div>${e.monto > 0 ? `<div class="tub-c-meta">${money(e.monto)}</div>` : ''}</div>
          <span class="tub-chip" style="background:${col}">${e.count}</span>
          <span style="color:var(--slate);margin-left:6px">${open ? '▾' : '▸'}</span>
        </div>
        ${open ? `<div class="tub-body">${e.prospectos.length ? e.prospectos.map(card).join('') : '<div class="dempty">Sin prospectos.</div>'}</div>` : ''}
      </div>`;
    });
    cont.innerHTML = html || `<div class="note">${QUERY ? 'Sin coincidencias.' : 'No hay prospectos para este mes.'}</div>`;
    cont.querySelectorAll('.tub-head').forEach(h => h.addEventListener('click', () => {
      const i = parseInt(h.dataset.idx); ABIERTO[i] = !ABIERTO[i]; pintarLista(etapas);
    }));
  }

  function card(p) {
    const sem = semaforo(p);
    const dias = diasDe(p);
    const tipo = p.tipo_cliente || p.tipo || '';
    const tel = p.telefono ? `<a href="tel:${p.telefono}" class="tub-c-meta" style="color:var(--steel);text-decoration:none">${p.telefono}</a>` : '';
    const ejec = (perfil.rol !== 'EJECUTIVO' && p.ejecutivo) ? `<span class="tub-c-meta">· ${p.ejecutivo}</span>` : '';
    return `<div class="tub-card">
      <div class="tub-c-top">
        <div style="min-width:0"><div class="tub-c-nm"><span class="sd" style="background:${sem.color}"></span>${p.nombre}${tipo ? ` <span class="chip">${tipo}</span>` : ''}</div>
          <div class="tub-c-meta">${tel} ${ejec}</div></div>
        <div style="text-align:right"><div class="tub-c-id" style="color:var(--navy)">${money(p.monto)}</div><div class="tub-dias">${dias} d en proceso</div></div>
      </div>
    </div>`;
  }

  render();
}
