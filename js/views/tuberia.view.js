// Vista Tubería V2 — PIPELINE POR ETAPAS gobernado por el motor (tuberia_etapas.service).
// El usuario NO mueve la etapa: el sistema la deriva del avance del expediente.
// Cada pantalla se desbloquea solo cuando la anterior está completa.
import { el, money, norm } from '../lib/dom.js';
import { cotizar, FRECUENCIAS } from '../services/cotizador.service.js';
import {
  ETAPAS_V2, ETAPAS_CERRADAS_V2, MODULOS_CORRECCION,
  calcularEtapa, indiceEtapa, docsRequeridos,
} from '../services/tuberia_etapas.service.js';
import { getPreguntas, validarEvaluacion } from '../services/evaluacion.service.js';
import { calcularSurtimiento } from '../services/surtir.service.js';
import { linkWhatsApp } from '../services/notificaciones.service.js';
import * as repo from '../repositories/tuberia.repo.js';
import { fetchBancos } from '../repositories/bancos.repo.js';
import { subirFotos } from '../lib/storage.js';

const TIPOS = [['PERSONAL', 'Personal (10.7%)'], ['CONVENIO', 'Convenio (2.0%)'], ['GOBIERNO', 'Gobierno/Negocio (10%)'], ['AMERICANO', 'Americano (10-15%)']];
const PLAZOS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 20, 24];
const EJECUTIVOS = ['CESAR', 'LORENA', 'EDUARDO', 'PACO', 'TABATA', 'JORGE', 'HUGO', 'LAURA'];
const MUNICIPIOS = ['GUADALAJARA', 'ZAPOPAN', 'TLAQUEPAQUE', 'TONALA'];

// Catálogo de documentos (cada uno independiente). Vane elige cuáles solicitar.
const DOCS_CATALOGO = [
  { key: 'ine', nombre: 'Identificación Oficial Vigente' },
  { key: 'dom', nombre: 'Comprobante de Domicilio Reciente' },
  { key: 'arraigo', nombre: 'Comprobante de Arraigo (2 años)' },
  { key: 'predial', nombre: 'Predial o Boleta Registral' },
  { key: 'firma_fam', nombre: 'Firma de Familiar Directo o Cónyuge' },
  { key: 'firma_aval', nombre: 'Firma de Aval' },
  { key: 'licencia', nombre: 'Licencia Municipal del Negocio' },
  { key: 'tarjeton', nombre: 'Tarjetón IMSS / ISSSTE / SEP' },
  { key: 'nomina', nombre: 'Últimos 3 Recibos de Nómina' },
  { key: 'dom_titular', nombre: 'Comp. Domicilio a Nombre del Titular' },
  { key: 'pagare', nombre: 'Renovación de Pagaré' },
  { key: 'referencias', nombre: 'Documentos de Referencia' },
];

// Campos obligatorios del expediente (Etapa 5).
const EXP_CAMPOS = [
  { key: 'curp', label: 'CURP' },
  { key: 'rfc', label: 'RFC' },
  { key: 'nacimiento', label: 'Fecha de nacimiento', tipo: 'date' },
  { key: 'domicilio', label: 'Domicilio completo' },
  { key: 'colonia', label: 'Colonia' },
  { key: 'cp', label: 'Código postal' },
  { key: 'ocupacion', label: 'Ocupación / negocio' },
  { key: 'ingreso', label: 'Ingreso mensual aprox.' },
  { key: 'ref1_nombre', label: 'Referencia 1 — nombre' },
  { key: 'ref1_tel', label: 'Referencia 1 — teléfono' },
  { key: 'ref2_nombre', label: 'Referencia 2 — nombre' },
  { key: 'ref2_tel', label: 'Referencia 2 — teléfono' },
];

export async function abrirTuberia(perfil) {
  const rol = String((perfil && perfil.rol) || '').toUpperCase();
  const ov = el(`<div class="overlay"><div class="ohead"><button class="back">←</button><div class="ot">Tubería</div></div>
    <div class="otabs"><button class="tb-tab on" data-t="PIPE">Pipeline</button><button class="tb-tab" data-t="NUEVO">+ Nuevo</button></div>
    <div class="ocontent tv"></div></div>`);
  document.body.appendChild(ov);
  ov.querySelector('.back').addEventListener('click', () => ov.remove());
  const root = ov.querySelector('.ocontent');
  let TAB = 'PIPE', PROSPECTOS = null;

  async function cargar(force) {
    if (PROSPECTOS && !force) return PROSPECTOS;
    PROSPECTOS = await repo.fetchProspectos();
    return PROSPECTOS;
  }
  ov.querySelectorAll('.tb-tab').forEach(b => b.addEventListener('click', () => {
    TAB = b.dataset.t;
    ov.querySelectorAll('.tb-tab').forEach(x => x.classList.toggle('on', x === b));
    render();
  }));

  function render() {
    if (TAB === 'PIPE') renderPipeline();
    else renderNuevo();
  }

  // ─────────────────────────── PIPELINE (read-only, por etapa) ───────────────────────────
  async function renderPipeline() {
    root.innerHTML = '<div class="muted" style="padding:20px">Cargando…</div>';
    const data = await cargar();
    const soloMios = rol === 'EJECUTIVO';
    const lista = data
      .filter(p => !soloMios || norm(p.ejecutivo) === norm((perfil && perfil.ejecutivo) || ''))
      .map(p => ({ ...p, _etapa: calcularEtapa(p) }));

    const porEtapa = {}; ETAPAS_V2.forEach(e => porEtapa[e] = []); porEtapa['Rechazado'] = [];
    lista.forEach(p => { (porEtapa[p._etapa] || porEtapa['Rechazado']).push(p); });
    const activos = lista.filter(p => !ETAPAS_CERRADAS_V2.includes(p._etapa));
    const montoPipe = activos.reduce((s, p) => s + (Number(p.monto) || 0), 0);

    root.innerHTML = `
      <div class="kpis">
        <div class="kpi"><div class="kn">${activos.length}</div><div class="kl">En proceso</div></div>
        <div class="kpi"><div class="kn">${money(montoPipe)}</div><div class="kl">Monto en pipeline</div></div>
        <div class="kpi"><div class="kn">${porEtapa['Listo para Surtir'].length}</div><div class="kl">Listos para surtir</div></div>
        <div class="kpi"><div class="kn">${porEtapa['Surtido'].length}</div><div class="kl">Surtidos</div></div>
      </div>
      <div class="muted" style="padding:4px 2px 10px;font-size:12px">La etapa la determina el sistema según el avance del expediente. No es editable.</div>
      <div id="pipe-acc"></div>`;
    const acc = root.querySelector('#pipe-acc');
    [...ETAPAS_V2, 'Rechazado'].forEach(etapa => {
      const items = porEtapa[etapa] || [];
      if (!items.length) return;
      const idx = ETAPAS_V2.indexOf(etapa);
      const sec = el(`<div class="acc-sec">
        <div class="acc-head"><span class="acc-step">${idx >= 0 ? idx + 1 : '–'}</span> <b>${etapa}</b> <span class="acc-cnt">${items.length}</span></div>
        <div class="acc-body"></div></div>`);
      const body = sec.querySelector('.acc-body');
      items.forEach(p => {
        const row = el(`<div class="acc-row">
          <div><b>${p.nombre}</b> <span class="muted">· ${p.prospect_id || ''}</span><br>
          <span class="muted" style="font-size:12px">${p.ejecutivo || ''} · ${money(p.monto)} · ${p.frecuencia || ''}</span></div>
          <button class="mini">Abrir →</button></div>`);
        row.querySelector('button').addEventListener('click', () => abrirProspecto(p));
        body.appendChild(row);
      });
      sec.querySelector('.acc-head').addEventListener('click', () => sec.classList.toggle('open'));
      acc.appendChild(sec);
    });
    if (!acc.children.length) acc.innerHTML = '<div class="muted" style="padding:20px">Sin prospectos.</div>';
  }

  // ─────────────────────────── DETALLE DEL PROSPECTO (router por etapa) ───────────────────────────
  function abrirProspecto(pr) {
    const sub = el(`<div class="overlay"><div class="ohead"><button class="back">←</button><div class="ot">${pr.nombre}</div></div>
      <div class="ocontent tv"><div id="stepper"></div><div id="stage"></div></div></div>`);
    document.body.appendChild(sub);
    sub.querySelector('.back').addEventListener('click', () => sub.remove());
    const stepEl = sub.querySelector('#stepper');
    const stageEl = sub.querySelector('#stage');

    const recargar = async () => { await cargar(true); if (TAB === 'PIPE') renderPipeline(); };

    function pintar() {
      const etapa = calcularEtapa(pr);
      const idx = indiceEtapa(pr);
      stepEl.innerHTML = `<div class="stepper">${ETAPAS_V2.map((e, i) => {
        const st = i < idx ? 'done' : i === idx ? 'now' : 'todo';
        return `<div class="step ${st}" title="${e}"><span>${i + 1}</span></div>`;
      }).join('<i></i>')}</div><div class="step-label">Etapa actual: <b>${etapa}</b></div>`;
      stageEl.innerHTML = '';
      const r = (node) => stageEl.appendChild(node);
      if (etapa === 'Información') return stInformacion(pr, r, pintar);
      if (etapa === 'Evaluación') return stEvaluacion(pr, r, pintar);
      if (etapa === 'Expediente') return stExpediente(pr, r, pintar);
      if (etapa === 'Documentación') return stDocumentacion(pr, r, pintar, false);
      if (etapa === 'Esperando documentos') return stDocumentacion(pr, r, pintar, true);
      if (etapa === 'Validación Jurídica') return stValidacion(pr, r, pintar);
      if (etapa === 'Visita Domiciliaria') return stVisita(pr, r, pintar);
      if (etapa === 'Listo para Surtir') return stSurtir(pr, r, recargar, sub);
      if (etapa === 'Surtido') return r(el(`<div class="ok-box">✅ Cliente surtido. La operación continúa en el CRM.</div>`));
      if (etapa === 'Rechazado') return r(el(`<div class="err-box">⛔ Prospecto rechazado.<br><span class="muted">${(pr.cotizacion_json && ((pr.cotizacion_json.validacion && pr.cotizacion_json.validacion.nota) || (pr.cotizacion_json.visita && 'Visita rechazada'))) || ''}</span></div>`));
    }
    pintar();
  }

  // Etapa 3 — INFORMACIÓN
  function stInformacion(pr, r, refresh) {
    r(el(`<div class="card">
      <h4>Información de la cotización</h4>
      <div class="liqrow"><span>Cliente</span><b>${pr.nombre}</b></div>
      <div class="liqrow"><span>Ejecutivo</span><b>${pr.ejecutivo || ''}</b></div>
      <div class="liqrow"><span>Monto</span><b class="num">${money(pr.monto)}</b></div>
      <div class="liqrow"><span>Tipo</span><b>${pr.tipo || ''} · ${pr.tipo_cliente || ''}</b></div>
      <div class="liqrow"><span>Frecuencia / Plazo</span><b>${pr.frecuencia || ''} · ${pr.plazo || ''}</b></div>
      <div class="liqrow"><span>Comisión</span><b class="num">${money(pr.comision)}</b></div>
      <div class="liqrow"><span>Abono puntual</span><b class="num">${money(pr.abono_puntual)}</b></div>
    </div>`));
    const btn = el(`<button class="primary big">Empezar proceso</button>`);
    btn.addEventListener('click', async () => {
      btn.disabled = true;
      try { await repo.empezarProceso(pr, perfil); refresh(); } catch (e) { alert('❌ ' + e.message); btn.disabled = false; }
    });
    r(btn);
  }

  // Etapa 4 — EVALUACIÓN (sin score, todas obligatorias)
  function stEvaluacion(pr, r, refresh) {
    const preguntas = getPreguntas();
    const prev = (pr.cotizacion_json && pr.cotizacion_json.evaluacion && pr.cotizacion_json.evaluacion.respuestas) || {};
    const card = el(`<div class="card"><h4>Evaluación</h4>
      <div class="muted" style="font-size:12px;margin-bottom:8px">Todas las preguntas son obligatorias. No se guarda hasta completarlas.</div>
      <div id="ev-q"></div></div>`);
    const wrap = card.querySelector('#ev-q');
    preguntas.forEach(q => {
      let input;
      if (q.tipo === 'sino') input = `<select class="inp" data-k="${q.key}"><option value="">—</option><option ${prev[q.key] === 'SI' ? 'selected' : ''}>SI</option><option ${prev[q.key] === 'NO' ? 'selected' : ''}>NO</option></select>`;
      else if (q.tipo === 'select') input = `<select class="inp" data-k="${q.key}"><option value="">—</option>${(q.opciones || []).map(o => `<option ${prev[q.key] === o ? 'selected' : ''}>${o}</option>`).join('')}</select>`;
      else input = `<input class="inp" data-k="${q.key}" value="${prev[q.key] || ''}">`;
      wrap.appendChild(el(`<div class="ev-item"><label>${q.q}</label>${input}</div>`));
    });
    r(card);
    const leer = () => { const o = {}; wrap.querySelectorAll('[data-k]').forEach(i => o[i.dataset.k] = i.value.trim()); return o; };
    const btn = el(`<button class="primary big">Continuar a Expediente</button>`);
    btn.addEventListener('click', async () => {
      const resp = leer();
      const { completa, faltan } = validarEvaluacion(resp);
      wrap.querySelectorAll('[data-k]').forEach(i => i.classList.toggle('miss', faltan.includes(i.dataset.k)));
      if (!completa) { alert('❌ Faltan ' + faltan.length + ' pregunta(s) por contestar.'); return; }
      btn.disabled = true;
      try { await repo.guardarEvaluacion(pr, resp, perfil); refresh(); } catch (e) { alert('❌ ' + e.message); btn.disabled = false; }
    });
    r(btn);
  }

  // Etapa 5 — EXPEDIENTE (campos obligatorios)
  function stExpediente(pr, r, refresh) {
    const prev = (pr.cotizacion_json && pr.cotizacion_json.expediente) || {};
    const card = el(`<div class="card"><h4>Expediente</h4>
      <div class="muted" style="font-size:12px;margin-bottom:8px">Completa todos los campos para continuar.</div>
      <div id="exp-f"></div></div>`);
    const f = card.querySelector('#exp-f');
    EXP_CAMPOS.forEach(c => f.appendChild(el(`<div class="ev-item"><label>${c.label}</label><input class="inp" type="${c.tipo || 'text'}" data-k="${c.key}" value="${prev[c.key] || ''}"></div>`)));
    r(card);
    const leer = () => { const o = {}; f.querySelectorAll('[data-k]').forEach(i => o[i.dataset.k] = i.value.trim()); return o; };
    const btn = el(`<button class="primary big">Continuar a Documentación</button>`);
    btn.addEventListener('click', async () => {
      const exp = leer();
      const faltan = EXP_CAMPOS.filter(c => !String(exp[c.key] || '').trim()).map(c => c.key);
      f.querySelectorAll('[data-k]').forEach(i => i.classList.toggle('miss', faltan.includes(i.dataset.k)));
      if (faltan.length) { alert('❌ Faltan ' + faltan.length + ' campo(s).'); return; }
      btn.disabled = true;
      try { await repo.guardarKYC(pr, exp, perfil); refresh(); } catch (e) { alert('❌ ' + e.message); btn.disabled = false; }
    });
    r(btn);
  }

  // Etapa 6/7 — DOCUMENTACIÓN y ESPERANDO DOCUMENTOS
  function stDocumentacion(pr, r, refresh, esperando) {
    const c = pr.cotizacion_json || {};
    const guardados = (c.documentos && c.documentos.items) || [];
    const byKey = {}; guardados.forEach(d => byKey[d.key] = d);
    const items = DOCS_CATALOGO.map(d => ({ ...d, ...(byKey[d.key] || { solicitado: false, archivo: '', fecha: '', usuario: '' }) }));

    const card = el(`<div class="card"><h4>${esperando ? 'Esperando documentos' : 'Documentación'}</h4>
      <div class="muted" style="font-size:12px;margin-bottom:8px">${esperando ? 'Marca cada documento conforme se reciba.' : 'Selecciona qué documentos necesitas y solicítalos.'}</div>
      <div id="doc-l"></div></div>`);
    const list = card.querySelector('#doc-l');
    items.forEach(d => {
      const row = el(`<div class="doc-row">
        <label class="doc-chk"><input type="checkbox" data-k="${d.key}" ${d.solicitado ? 'checked' : ''} ${esperando ? 'disabled' : ''}> ${d.nombre}</label>
        <div class="doc-act">
          ${d.archivo ? `<a href="${d.archivo}" target="_blank" class="mini">Vista previa</a>` : '<span class="muted" style="font-size:12px">sin archivo</span>'}
          <button class="mini up" data-k="${d.key}" ${(!d.solicitado) ? 'disabled' : ''}>Subir</button>
        </div></div>`);
      list.appendChild(row);
    });
    r(card);

    const leer = () => items.map(d => {
      const chk = list.querySelector(`input[data-k="${d.key}"]`);
      return { key: d.key, nombre: d.nombre, solicitado: esperando ? d.solicitado : !!(chk && chk.checked), archivo: d.archivo || '', fecha: d.fecha || '', usuario: d.usuario || '' };
    });

    list.querySelectorAll('.up').forEach(b => b.addEventListener('click', () => {
      const inp = el('<input type="file" accept="image/*,application/pdf" style="display:none">');
      document.body.appendChild(inp); inp.click();
      inp.addEventListener('change', async () => {
        if (!inp.files || !inp.files.length) { inp.remove(); return; }
        b.disabled = true; b.textContent = 'Subiendo…';
        try {
          const urls = await subirFotos([inp.files[0]], 'docs/' + (pr.prospect_id || pr.id));
          const arr = leer(); const d = arr.find(x => x.key === b.dataset.k);
          d.archivo = urls[0]; d.fecha = new Date().toISOString().slice(0, 10); d.usuario = (perfil && perfil.email) || '';
          await repo.guardarDocumentos(pr, arr, perfil); refresh();
        } catch (e) { alert('❌ ' + e.message); b.disabled = false; b.textContent = 'Subir'; }
        inp.remove();
      });
    }));

    if (!esperando) {
      const btn = el(`<button class="primary big">Solicitar documentos</button>`);
      btn.addEventListener('click', async () => {
        const arr = leer();
        const sel = arr.filter(d => d.solicitado);
        if (!sel.length) { alert('Selecciona al menos un documento.'); return; }
        btn.disabled = true;
        try {
          await repo.solicitarDocumentos(pr, arr, perfil);
          const msg = 'Hola ' + pr.nombre + ', para continuar tu crédito necesitamos: ' + sel.map(d => d.nombre).join(', ') + '.';
          window.open(linkWhatsApp(pr.telefono, msg), '_blank');
          refresh();
        } catch (e) { alert('❌ ' + e.message); btn.disabled = false; }
      });
      r(btn);
    } else {
      const todos = docsRequeridos(pr).length > 0 && docsRequeridos(pr).every(d => d.archivo);
      const btn = el(`<button class="primary big" ${todos ? '' : 'disabled'}>Enviar a Validación Jurídica</button>`);
      btn.addEventListener('click', () => refresh());
      r(btn);
      if (!todos) r(el(`<div class="muted" style="font-size:12px;text-align:center">Faltan documentos por recibir.</div>`));
    }
  }

  // Etapa 8 — VALIDACIÓN JURÍDICA (Tabata): única revisión
  function stValidacion(pr, r, refresh) {
    const c = pr.cotizacion_json || {};
    const docs = docsRequeridos(pr);
    r(el(`<div class="card"><h4>Validación Jurídica</h4>
      <div class="muted" style="font-size:12px">Revisión única del expediente completo.</div>
      <div class="liqrow"><span>Evaluación</span><b>${c.evaluacion && c.evaluacion.completa ? '✅ completa' : '—'}</b></div>
      <div class="liqrow"><span>Expediente</span><b>${c.expediente && c.expediente.completo ? '✅ completo' : '—'}</b></div>
      <div class="liqrow"><span>Documentos</span><b>${docs.filter(d => d.archivo).length}/${docs.length} recibidos</b></div>
      <div style="margin-top:8px">${docs.map(d => `<div class="liqrow"><span>${d.nombre}</span>${d.archivo ? `<a href="${d.archivo}" target="_blank">ver</a>` : '<span class="muted">—</span>'}</div>`).join('')}</div>
    </div>`));
    const acc = el(`<div style="display:flex;gap:8px;flex-wrap:wrap">
      <button class="primary" id="v-ok">Aprobar</button>
      <button class="danger" id="v-no">Rechazar</button>
      <button class="ghost" id="v-cor">Solicitar correcciones</button></div>`);
    r(acc);
    acc.querySelector('#v-ok').addEventListener('click', async () => { try { await repo.validarJuridico(pr, 'APROBADO', null, '', perfil); refresh(); } catch (e) { alert('❌ ' + e.message); } });
    acc.querySelector('#v-no').addEventListener('click', async () => { const n = prompt('Motivo del rechazo:'); if (n === null) return; try { await repo.validarJuridico(pr, 'RECHAZADO', null, n, perfil); refresh(); } catch (e) { alert('❌ ' + e.message); } });
    acc.querySelector('#v-cor').addEventListener('click', async () => {
      const modulo = prompt('¿A qué módulo regresa? (' + MODULOS_CORRECCION.join(' / ') + ')', 'Expediente');
      if (modulo === null) return;
      if (!MODULOS_CORRECCION.includes(modulo)) { alert('Módulo inválido.'); return; }
      const n = prompt('¿Qué hay que corregir?') || '';
      try { await repo.validarJuridico(pr, 'CORRECCIONES', modulo, n, perfil); refresh(); } catch (e) { alert('❌ ' + e.message); }
    });
  }

  // Etapa 9 — VISITA DOMICILIARIA (Eduardo): aprobar / rechazar (sin "pendiente")
  function stVisita(pr, r, refresh) {
    const card = el(`<div class="card"><h4>Visita Domiciliaria</h4>
      <div class="ev-item"><label>Comentarios de la visita</label><textarea class="inp" id="vi-com" rows="3"></textarea></div>
      <div class="ev-item"><label>Fotografías</label><input type="file" id="vi-fotos" accept="image/*" multiple></div>
    </div>`);
    r(card);
    const subirYResolver = async (resultado) => {
      const files = card.querySelector('#vi-fotos').files;
      let fotos = [];
      try { if (files && files.length) fotos = await subirFotos([...files], 'visitas/' + (pr.prospect_id || pr.id)); } catch (e) { alert('❌ Error subiendo fotos: ' + e.message); return; }
      try { await repo.resolverVisita(pr, resultado, { comentarios: card.querySelector('#vi-com').value.trim(), fotos }, perfil); refresh(); }
      catch (e) { alert('❌ ' + e.message); }
    };
    const acc = el(`<div style="display:flex;gap:8px"><button class="primary" id="vi-ok">Aprobar visita</button><button class="danger" id="vi-no">Rechazar visita</button></div>`);
    r(acc);
    acc.querySelector('#vi-ok').addEventListener('click', () => subirYResolver('APROBADA'));
    acc.querySelector('#vi-no').addEventListener('click', () => { if (confirm('¿Rechazar la visita? El prospecto quedará Rechazado.')) subirYResolver('RECHAZADA'); });
  }

  // Etapa 10 — LISTO PARA SURTIR (reparto + enviar a cartera)
  async function stSurtir(pr, r, recargar, sub) {
    const sur = calcularSurtimiento(pr);
    const bancos = await fetchBancos().catch(() => []);
    const card = el(`<div class="card"><h4>Listo para Surtir</h4>
      <div class="liqrow"><span>Capital</span><b class="num">${money(sur.capital)}</b></div>
      <div class="liqrow"><span>Dispersión al cliente</span><b class="num">${money(sur.dispersion)}</b></div>
      ${sur.adeudoReno ? `<div class="liqrow"><span>Adeudo anterior (reno)</span><b class="num">-${money(sur.adeudoReno)}</b></div>` : ''}
      <div class="liqrow"><span>A repartir</span><b class="num">${money(sur.objetivoReparto)}</b></div>
      <div class="ev-item"><label>Banco de salida</label><select class="inp" id="su-banco">${bancos.map(b => `<option value="${b.nombre}">${b.nombre}</option>`).join('')}</select></div>
    </div>`);
    r(card);
    const btn = el(`<button class="primary big">Surtir → crear en CRM</button>`);
    btn.addEventListener('click', async () => {
      if (!confirm('¿Surtir a ' + pr.nombre + '? Se creará el cliente y saldrá de la Tubería.')) return;
      btn.disabled = true;
      try {
        const reparto = [{ cuenta: card.querySelector('#su-banco').value, monto: sur.objetivoReparto }];
        const res = await repo.enviarACartera(pr, reparto, perfil);
        alert((res && res.msg) || '✅ Surtido.'); sub.remove(); recargar();
      } catch (e) { alert('❌ ' + e.message); btn.disabled = false; }
    });
    r(btn);
  }

  // ─────────────────────────── NUEVO (cotizador → crear prospecto) ───────────────────────────
  function renderNuevo() {
    root.innerHTML = `<div class="card"><h4>Nueva cotización</h4>
      <div class="ev-item"><label>Nombre</label><input class="inp" id="n-nombre"></div>
      <div class="ev-item"><label>Teléfono</label><input class="inp" id="n-tel"></div>
      <div class="ev-item"><label>Ejecutivo</label><select class="inp" id="n-ej">${EJECUTIVOS.map(e => `<option>${e}</option>`).join('')}</select></div>
      <div class="ev-item"><label>Municipio</label><select class="inp" id="n-mun">${MUNICIPIOS.map(m => `<option>${m}</option>`).join('')}</select></div>
      <div class="ev-item"><label>Tipo</label><select class="inp" id="n-tipo">${TIPOS.map(t => `<option value="${t[0]}">${t[1]}</option>`).join('')}</select></div>
      <div class="ev-item"><label>Frecuencia</label><select class="inp" id="n-frec">${FRECUENCIAS.map(f => `<option>${f}</option>`).join('')}</select></div>
      <div class="ev-item"><label>Monto</label><input class="inp" id="n-monto" inputmode="decimal"></div>
      <div class="ev-item"><label>Plazo</label><select class="inp" id="n-plazo">${PLAZOS.map(p => `<option>${p}</option>`).join('')}</select></div>
      <label class="doc-chk"><input type="checkbox" id="n-fin"> Financiar comisión</label>
      <div id="n-prev" class="muted" style="margin:10px 0"></div>
      <button class="primary big" id="n-crear">Crear prospecto</button>
    </div>`;
    const val = () => ({
      nombre: root.querySelector('#n-nombre').value.trim(), telefono: root.querySelector('#n-tel').value.trim(),
      ejecutivo: root.querySelector('#n-ej').value, municipio: root.querySelector('#n-mun').value,
      tipo: root.querySelector('#n-tipo').value, frecuencia: root.querySelector('#n-frec').value,
      monto: parseFloat(root.querySelector('#n-monto').value) || 0, plazo: parseInt(root.querySelector('#n-plazo').value) || 0,
      financiar: root.querySelector('#n-fin').checked,
    });
    const prev = () => {
      const d = val(); if (!d.monto || !d.plazo) { root.querySelector('#n-prev').textContent = ''; return null; }
      try { const c = cotizar(d); root.querySelector('#n-prev').innerHTML = `Abono: <b>${money(c.abonoPuntual)}</b> · Depósito: <b>${money(c.deposito)}</b> · Comisión: <b>${money(c.comision)}</b>`; return c; }
      catch (e) { root.querySelector('#n-prev').textContent = e.message; return null; }
    };
    ['#n-tipo', '#n-frec', '#n-monto', '#n-plazo', '#n-fin'].forEach(s => root.querySelector(s).addEventListener('input', prev));
    prev();
    root.querySelector('#n-crear').addEventListener('click', async () => {
      const d = val(); const c = prev();
      if (!d.nombre) { alert('Falta el nombre.'); return; }
      if (!c) { alert('Revisa monto/plazo.'); return; }
      try {
        const res = await repo.crearProspecto(d, c, perfil);
        alert(res.msg); PROSPECTOS = null; TAB = 'PIPE';
        ov.querySelectorAll('.tb-tab').forEach(x => x.classList.toggle('on', x.dataset.t === 'PIPE'));
        render();
      } catch (e) { alert('❌ ' + e.message); }
    });
  }

  render();
}
