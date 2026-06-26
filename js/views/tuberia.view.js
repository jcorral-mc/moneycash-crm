// Vista Tubería V2 — PIPELINE POR ETAPAS gobernado por el motor (tuberia_etapas.service).
// El usuario NO mueve la etapa: el sistema la deriva del avance del expediente.
// Cada pantalla se desbloquea solo cuando la anterior está completa.
import { el, money, norm } from '../lib/dom.js';
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
    <div class="ocontent tv"></div></div>`);
  document.body.appendChild(ov);
  ov.querySelector('.back').addEventListener('click', () => ov.remove());
  const root = ov.querySelector('.ocontent');
  let PROSPECTOS = null;

  async function cargar(force) {
    if (PROSPECTOS && !force) return PROSPECTOS;
    PROSPECTOS = await repo.fetchProspectos();
    return PROSPECTOS;
  }

  function render() {
    renderPipeline();
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

    const recargar = async () => { await cargar(true); renderPipeline(); };

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

    // #8 — Omitir evaluación SOLO con autorización de Jurídico.
    const ev = (pr.cotizacion_json && pr.cotizacion_json.evaluacion) || {};
    const puedeAutorizar = ['JURIDICO', 'ADMIN'].includes(rol);
    const om = el(`<div class="card" style="margin-top:6px"><h4>¿Omitir evaluación?</h4>
      <div class="muted" style="font-size:12px">La evaluación solo puede omitirse con autorización de Jurídico.</div>
      ${ev.solicitudOmision ? `<div class="liqrow"><span>Solicitud de omisión</span><b>${ev.solicitudOmision.por || ''}</b></div><div class="muted" style="font-size:12px">Motivo: ${ev.solicitudOmision.motivo || '—'}</div>` : ''}
    </div>`);
    if (puedeAutorizar) {
      const b2 = el(`<button class="ghost big">Autorizar omisión (Jurídico)</button>`);
      b2.addEventListener('click', async () => {
        const motivo = prompt('Motivo de la omisión:') || '';
        if (motivo === null) return;
        b2.disabled = true;
        try { await repo.omitirEvaluacion(pr, motivo, perfil); refresh(); } catch (e) { alert('❌ ' + e.message); b2.disabled = false; }
      });
      om.appendChild(b2);
    } else {
      const b2 = el(`<button class="ghost big">Solicitar a Jurídico omitir</button>`);
      b2.addEventListener('click', async () => {
        const motivo = prompt('¿Por qué pedir omitir la evaluación?') || '';
        if (motivo === null) return;
        b2.disabled = true;
        try { await repo.solicitarOmisionEval(pr, motivo, perfil); alert('✅ Solicitud enviada a Jurídico.'); refresh(); } catch (e) { alert('❌ ' + e.message); b2.disabled = false; }
      });
      om.appendChild(b2);
    }
    r(om);
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

  // Etapa 8 — VALIDACIÓN JURÍDICA: revisión única CON fotos + encuesta + datos capturados.
  function stValidacion(pr, r, refresh) {
    const c = pr.cotizacion_json || {};
    const docs = docsRequeridos(pr);
    const preguntas = getPreguntas();
    const ev = c.evaluacion || {};
    const exp = c.expediente || {};
    const vis = c.visita || {};
    const thumb = (url) => `<a href="${url}" target="_blank"><img src="${url}" loading="lazy" style="max-width:110px;max-height:110px;border-radius:8px;border:1px solid var(--line);object-fit:cover;margin:4px"></a>`;

    // Encabezado de estado
    r(el(`<div class="card"><h4>Validación Jurídica</h4>
      <div class="muted" style="font-size:12px">Revisión única del expediente completo.</div>
      <div class="liqrow"><span>Evaluación</span><b>${ev.omitida ? '⚠️ omitida (autorizada)' : ev.completa ? '✅ completa' : '—'}</b></div>
      <div class="liqrow"><span>Expediente</span><b>${exp.completo ? '✅ completo' : '—'}</b></div>
      <div class="liqrow"><span>Documentos</span><b>${docs.filter(d => d.archivo).length}/${docs.length} recibidos</b></div>
    </div>`));

    // Encuesta de evaluación (respuestas)
    if (ev.omitida) {
      r(el(`<div class="card"><h4>Encuesta de evaluación</h4><div class="ok-box" style="background:#FFF7ED;border-color:#F2C9C2;color:var(--amber)">Omitida con autorización de ${ev.autorizadaPor || 'Jurídico'}.<br><span class="muted">${ev.motivoOmision || ''}</span></div></div>`));
    } else {
      const resp = ev.respuestas || {};
      const filas = preguntas.map(q => `<div class="liqrow"><span>${q.q}</span><b>${resp[q.key] || '—'}</b></div>`).join('');
      r(el(`<div class="card"><h4>Encuesta de evaluación</h4>${filas}</div>`));
    }

    // Datos capturados del expediente
    const expFilas = EXP_CAMPOS.map(cmp => `<div class="liqrow"><span>${cmp.label}</span><b>${exp[cmp.key] || '—'}</b></div>`).join('');
    r(el(`<div class="card"><h4>Datos capturados</h4>${expFilas}</div>`));

    // Documentos con vista previa de imágenes
    const docCard = el(`<div class="card"><h4>Documentos</h4></div>`);
    docs.forEach(d => {
      const row = el(`<div class="doc-row"><span style="flex:1">${d.nombre}</span></div>`);
      if (d.archivo) row.appendChild(el(thumb(d.archivo))); else row.appendChild(el('<span class="muted" style="font-size:12px">sin archivo</span>'));
      docCard.appendChild(row);
    });
    if (!docs.length) docCard.appendChild(el('<div class="muted" style="font-size:12px">Sin documentos solicitados.</div>'));
    r(docCard);

    // Fotos de visita (si ya hubo)
    if (vis.fotos && vis.fotos.length) {
      r(el(`<div class="card"><h4>Fotos de visita</h4><div>${vis.fotos.map(thumb).join('')}</div></div>`));
    }

    // Acciones: solo Jurídico/Admin
    if (['JURIDICO', 'ADMIN'].includes(rol)) {
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
    } else {
      r(el(`<div class="muted" style="font-size:12px;text-align:center">Solo Jurídico puede aprobar, rechazar o pedir correcciones.</div>`));
    }
  }

  // Etapa 9 — VISITA DOMICILIARIA: Vane DISPARA a Eduardo; queda parada hasta que él resuelve.
  function stVisita(pr, r, refresh) {
    const c = pr.cotizacion_json || {};
    const vis = c.visita || {};
    const exp = c.expediente || {};
    const asig = vis.asignada;
    const puedeAsignar = ['AUX_ADMIN', 'ADMIN', 'GERENTE'].includes(rol);
    const puedeResolver = ['VISITAS', 'ADMIN'].includes(rol);

    if (!asig) {
      // Aún no se dispara: Vane confirma datos y la asigna a Eduardo.
      const dirAuto = [exp.domicilio, exp.colonia, exp.cp ? ('CP ' + exp.cp) : ''].filter(x => x).join(', ');
      const card = el(`<div class="card"><h4>Asignar visita a Eduardo</h4>
        <div class="muted" style="font-size:12px;margin-bottom:8px">Confirma los datos. La visita se asigna a Eduardo y queda parada hasta que él la resuelva en Visitas.</div>
        <div class="ev-item"><label>Teléfono</label><input class="inp" id="va-tel" value="${pr.telefono || ''}"></div>
        <div class="ev-item"><label>Domicilio</label><input class="inp" id="va-dir" value="${dirAuto}"></div>
        <div class="ev-item"><label>Aval (nombre y domicilio)</label><input class="inp" id="va-aval" value="${exp.ref1_nombre || ''}"></div>
        <div class="ev-item"><label>Horario sugerido</label><input class="inp" id="va-hor" placeholder="Ej. 10am a 2pm"></div>
        <div class="ev-item"><label>Indicaciones para Eduardo</label><textarea class="inp" id="va-nota" rows="2"></textarea></div>
      </div>`);
      r(card);
      if (!puedeAsignar) { r(el(`<div class="muted" style="font-size:12px;text-align:center">Esperando que se asigne la visita a Eduardo.</div>`)); return; }
      const btn = el(`<button class="primary big">Disparar visita a Eduardo</button>`);
      btn.addEventListener('click', async () => {
        btn.disabled = true;
        const datos = {
          telefono: card.querySelector('#va-tel').value.trim(),
          direccion: card.querySelector('#va-dir').value.trim(),
          aval: card.querySelector('#va-aval').value.trim(),
          horario: card.querySelector('#va-hor').value.trim(),
          nota: card.querySelector('#va-nota').value.trim(),
        };
        try { await repo.asignarVisita(pr, datos, perfil); alert('✅ Visita asignada a Eduardo.'); refresh(); } catch (e) { alert('❌ ' + e.message); btn.disabled = false; }
      });
      r(btn);
      return;
    }

    // Ya asignada: parada hasta que Eduardo resuelva.
    r(el(`<div class="card"><h4>Visita asignada a Eduardo</h4>
      <div class="ok-box" style="background:#EFF6FF;border-color:#BcD6F2;color:var(--steel)">⏳ Esperando que Eduardo resuelva la visita (asignada el ${asig.fecha || ''}).</div>
      <div class="liqrow"><span>Teléfono</span><b>${asig.telefono || '—'}</b></div>
      <div class="liqrow"><span>Domicilio</span><b>${asig.direccion || '—'}</b></div>
      <div class="liqrow"><span>Aval</span><b>${asig.aval || '—'}</b></div>
      <div class="liqrow"><span>Horario</span><b>${asig.horario || '—'}</b></div>
      ${asig.nota ? `<div class="muted" style="font-size:12px;margin-top:6px">Indicaciones: ${asig.nota}</div>` : ''}
    </div>`));

    if (!puedeResolver) { r(el(`<div class="muted" style="font-size:12px;text-align:center">Solo Eduardo (Visitas) puede aprobar o rechazar.</div>`)); return; }

    // Eduardo: formato + fotos + resolver.
    const card = el(`<div class="card"><h4>Resolver visita (Eduardo)</h4>
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
      <div class="liqrow"><span>Comisión</span><b class="num">${money(sur.comision)} ${sur.esFinanciada ? '(financiada)' : '(descontada)'}</b></div>
      <div class="ev-item"><label>Banco de salida</label><select class="inp" id="su-banco"><option value="">— elige banco —</option>${bancos.map(b => `<option value="${b.cuenta}">${b.cuenta}</option>`).join('')}</select></div>
    </div>`);
    r(card);
    if (!bancos.length) r(el(`<div class="err-box">No hay bancos cargados. Agrega cuentas en el módulo Bancos antes de surtir.</div>`));
    const btn = el(`<button class="primary big">Surtir → crear en CRM</button>`);
    btn.addEventListener('click', async () => {
      const cuenta = card.querySelector('#su-banco').value;
      if (!cuenta) { alert('Elige el banco de salida antes de surtir.'); return; }
      if (!confirm('¿Surtir a ' + pr.nombre + ' por ' + money(sur.objetivoReparto) + ' desde ' + cuenta + '? Se creará el cliente y saldrá de la Tubería.')) return;
      btn.disabled = true;
      try {
        const reparto = [{ cuenta, monto: sur.objetivoReparto }];
        const res = await repo.enviarACartera(pr, reparto, perfil);
        alert((res && res.msg) || '✅ Surtido.'); sub.remove(); recargar();
      } catch (e) { alert('❌ ' + e.message); btn.disabled = false; }
    });
    r(btn);
  }

  render();
}
