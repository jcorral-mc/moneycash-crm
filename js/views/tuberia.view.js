// Vista Tubería — pipeline tipo Script (KPIs + filtros + acordeón con semáforo),
// expediente con pestañas (Info / Evaluación+KYC / Documentos / Bitácora),
// dashboard operativo (4 tablas), cotizador en vivo, reno/react y surtir con reparto.
import { el, money, norm } from '../lib/dom.js';
import { cotizar, FRECUENCIAS } from '../services/cotizador.service.js';
import {
  ETAPAS_TODAS, COLOR_ETAPA, siguienteEtapa, diasDe, semaforo,
  filtrarProspectos, kpisPipeline, agruparPorEstatus,
} from '../services/tuberia.service.js';
import { PREGUNTAS, calcularScore, clasificar } from '../services/evaluacion.service.js';
import { calcularSurtimiento } from '../services/surtir.service.js';
import { candidatosReno } from '../services/reno.service.js';
import { avisoPorEtapa, linkWhatsApp } from '../services/notificaciones.service.js';
import { agregarDashboard, filtrarPorMes, aniosDisponibles } from '../services/dashboard_tuberia.service.js';
import * as repo from '../repositories/tuberia.repo.js';
import * as reno from '../repositories/reno.repo.js';
import { fetchBancos } from '../repositories/bancos.repo.js';
import { subirFotos } from '../lib/storage.js';

const TIPOS = [['PERSONAL','Personal (10.7%)'],['CONVENIO','Convenio (2.0%)'],['GOBIERNO','Gobierno/Negocio (10%)'],['AMERICANO','Americano (10-15%)']];
const PLAZOS = [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,20,24];
const EJECUTIVOS = ['CESAR','LORENA','EDUARDO','PACO','TABATA','JORGE','HUGO','LAURA'];
const MUNICIPIOS = ['GUADALAJARA','ZAPOPAN','TLAQUEPAQUE','TONALA'];
const DOCS_REQ = [
  'Identificación Oficial Vigente','Comprobante de Domicilio Reciente','Comprobante de Arraigo (2 años)',
  'Predial o Boleta Registral','Firma de Familiar Directo o Cónyuge','Firma de Aval',
  'Licencia Municipal del Negocio','Tarjetón IMSS / ISSSTE / SEP','Últimos 3 Recibos de Nómina',
  'Comp. Domicilio a Nombre Titular','Renovación de Pagaré','Documentos de Referencia',
];

export async function abrirTuberia(perfil) {
  const esGerencia = ['ADMIN','GERENTE'].includes(perfil.rol);
  const ov = el(`<div class="overlay"><div class="ohead"><button class="back">←</button><div class="ot">Tubería</div></div><div class="ocontent"></div></div>`);
  document.body.appendChild(ov);
  const root = ov.querySelector('.ocontent');
  ov.querySelector('.back').addEventListener('click', () => ov.remove());

  let TAB='PIPE', cot=null;
  let PROSPECTOS=null;                 // caché de la lista (se recarga al volver de acciones)
  const FILTROS = { busca:'', ejecutivo:'', sucursal:'', tipo:'', fecha:'', desde:'', hasta:'' };
  let soloMios = perfil.rol==='EJECUTIVO';

  const TABS = [['PIPE','Pipeline'],['DASH','Dashboard'],...(esGerencia?[['SOL','Solicitudes']]:[]),['COTIZA','Cotizador']];

  function render() {
    root.innerHTML = `
      <div class="tb-tabs">
        ${TABS.map(([k,t])=>`<button class="tb-tab${TAB===k?' on':''}" data-t="${k}">${t}</button>`).join('')}
      </div><div id="tb-body"></div>`;
    root.querySelectorAll('.tb-tab').forEach(b=>b.addEventListener('click',()=>{ TAB=b.dataset.t; render(); }));
    if (TAB==='PIPE') renderPipeline();
    else if (TAB==='DASH') renderDashboard();
    else if (TAB==='SOL') renderSolicitudes();
    else renderCotizador();
  }

  async function cargarProspectos(force) {
    if (PROSPECTOS && !force) return PROSPECTOS;
    PROSPECTOS = await repo.fetchProspectos();
    return PROSPECTOS;
  }
  // Para ejecutivos: solo su tubería
  function visibles(lista) {
    if (perfil.rol==='EJECUTIVO' || soloMios) return (lista||[]).filter(p=>!perfil.ejecutivo || norm(p.ejecutivo)===norm(perfil.ejecutivo));
    return lista||[];
  }

  // ═══════════════════════ PIPELINE ═══════════════════════
  async function renderPipeline() {
    const body = root.querySelector('#tb-body');
    body.innerHTML = '<div class="loader">Cargando…</div>';
    await cargarProspectos();
    body.innerHTML = `
      <div id="tb-kpis"></div>
      <div class="tb-filtros">
        <input class="inp" id="f-busca" placeholder="Buscar por nombre, teléfono o folio…" value="${FILTROS.busca}" style="margin-bottom:8px">
        <div class="tb-frow">
          <select class="inp" id="f-ejec"><option value="">Todos los ejecutivos</option>${EJECUTIVOS.map(e=>`<option ${FILTROS.ejecutivo===e?'selected':''}>${e}</option>`).join('')}</select>
          <select class="inp" id="f-suc"><option value="">Todas las sucursales</option><option value="GDL" ${FILTROS.sucursal==='GDL'?'selected':''}>GDL</option><option value="ARENAL" ${FILTROS.sucursal==='ARENAL'?'selected':''}>Guadalajara 2</option></select>
        </div>
        <div class="tb-frow">
          <select class="inp" id="f-tipo"><option value="">Todos los tipos</option>${['PERSONAL','CONVENIO','GOBIERNO','AMERICANO'].map(t=>`<option ${FILTROS.tipo===t?'selected':''}>${t}</option>`).join('')}</select>
          <select class="inp" id="f-fecha">
            <option value="">Todas las fechas</option>
            ${[['hoy','Hoy'],['7','Últimos 7 días'],['15','Últimos 15 días'],['30','Últimos 30 días'],['custom','Rango…']].map(([v,t])=>`<option value="${v}" ${FILTROS.fecha===v?'selected':''}>${t}</option>`).join('')}
          </select>
        </div>
        <div class="tb-frow" id="f-rango" style="display:${FILTROS.fecha==='custom'?'flex':'none'}">
          <input class="inp" type="date" id="f-desde" value="${FILTROS.desde}">
          <input class="inp" type="date" id="f-hasta" value="${FILTROS.hasta}">
        </div>
        <div style="display:flex;gap:8px;align-items:center;margin-top:2px">
          ${perfil.rol!=='EJECUTIVO'?`<label style="display:flex;align-items:center;gap:6px;font-size:.8em;cursor:pointer;color:var(--slate)"><input type="checkbox" id="f-mios" ${soloMios?'checked':''}> Solo míos</label>`:''}
          <button class="tb-mini" id="f-clear">Limpiar</button>
          <span style="flex:1"></span>
          <button class="tb-mini" id="f-exp">Expandir todo</button>
          <button class="tb-mini" id="f-col">Plegar todo</button>
        </div>
      </div>
      <div id="tb-acc"></div>`;

    const $=(s)=>body.querySelector(s);
    const sync=()=>{ FILTROS.busca=$('#f-busca').value; FILTROS.ejecutivo=$('#f-ejec').value; FILTROS.sucursal=$('#f-suc').value; FILTROS.tipo=$('#f-tipo').value; FILTROS.fecha=$('#f-fecha').value; FILTROS.desde=$('#f-desde')?$('#f-desde').value:''; FILTROS.hasta=$('#f-hasta')?$('#f-hasta').value:''; };
    const repintar=()=>{ sync(); pintarAcc(); };
    $('#f-busca').addEventListener('input',repintar);
    ['#f-ejec','#f-suc','#f-tipo'].forEach(s=>$(s).addEventListener('change',repintar));
    $('#f-fecha').addEventListener('change',()=>{ sync(); $('#f-rango').style.display = FILTROS.fecha==='custom'?'flex':'none'; pintarAcc(); });
    if ($('#f-desde')) $('#f-desde').addEventListener('change',repintar);
    if ($('#f-hasta')) $('#f-hasta').addEventListener('change',repintar);
    const mios=$('#f-mios'); if (mios) mios.addEventListener('change',()=>{ soloMios=mios.checked; pintarAcc(); });
    $('#f-clear').addEventListener('click',()=>{ FILTROS.busca=FILTROS.ejecutivo=FILTROS.sucursal=FILTROS.tipo=FILTROS.fecha=FILTROS.desde=FILTROS.hasta=''; renderPipeline(); });
    $('#f-exp').addEventListener('click',()=>toggleTodo(true));
    $('#f-col').addEventListener('click',()=>toggleTodo(false));

    function pintarAcc() {
      const base = visibles(PROSPECTOS);
      const lista = filtrarProspectos(base, FILTROS);
      // KPIs
      const k = kpisPipeline(lista);
      $('#tb-kpis').innerHTML = `
        <div class="kpis4">
          <div class="kcard"><div class="klab">En proceso</div><div class="kval num">${k.enProceso}</div><div class="kfoot">prospectos en curso</div></div>
          <div class="kcard"><div class="klab">Monto en proceso</div><div class="kval num">${money(k.monto)}</div><div class="kfoot">a colocar</div></div>
          <div class="kcard k-cob"><div class="klab">Listo para surtir</div><div class="kval num green">${k.listos}</div><div class="kfoot">esperan surtido</div></div>
          <div class="kcard"><div class="klab">Requieren atención</div><div class="kval num" style="color:var(--red)">${k.urgentes}</div><div class="kfoot">activos +7 días</div></div>
        </div>`;
      // Acordeón
      const buscando = !!(FILTROS.busca||FILTROS.ejecutivo||FILTROS.sucursal||FILTROS.tipo||FILTROS.fecha);
      const grupos = agruparPorEstatus(lista);
      const acc = $('#tb-acc');
      const secs = ETAPAS_TODAS.filter(s => grupos[s].length>0);
      if (!secs.length) { acc.innerHTML = '<div class="note">No hay prospectos con esos filtros.</div>'; return; }
      acc.innerHTML = secs.map((status,idx)=>{
        const arr = grupos[status];
        const montoCol = arr.reduce((s,p)=>s+(Number(p.monto)||0),0);
        const color = COLOR_ETAPA[status] || 'var(--slate)';
        const abierta = buscando;
        const cards = arr.map(p=>cardP(p)).join('');
        return `<div class="tub-acc">
          <div class="tub-head" data-sec="s${idx}" style="border-left:4px solid ${color}">
            <div style="display:flex;align-items:center;gap:9px;min-width:0">
              <span class="tub-fl" id="fl-s${idx}" style="${abierta?'':'transform:rotate(-90deg)'}">⌄</span>
              <b style="font-size:.86em">${status}</b>
              <span class="tub-chip" style="background:${color}">${arr.length}</span>
            </div>
            <span style="color:var(--slate);font-size:.74em;white-space:nowrap">${money(montoCol)}</span>
          </div>
          <div class="tub-body" id="s${idx}" style="display:${abierta?'block':'none'}">${cards}</div>
        </div>`;
      }).join('');
      acc.querySelectorAll('.tub-head').forEach(h=>h.addEventListener('click',()=>toggleSec(h.dataset.sec)));
      acc.querySelectorAll('.tub-card[data-id]').forEach(c=>c.addEventListener('click',()=>{ const x=PROSPECTOS.find(z=>String(z.id)===c.dataset.id); if(x) verExpediente(x); }));
    }
    function toggleSec(id){ const b=body.querySelector('#'+id), fl=body.querySelector('#fl-'+id); if(!b)return; const open=b.style.display!=='none'; b.style.display=open?'none':'block'; if(fl) fl.style.transform=open?'rotate(-90deg)':'rotate(0deg)'; }
    function toggleTodo(abrir){ body.querySelectorAll('.tub-body').forEach(b=>b.style.display=abrir?'block':'none'); body.querySelectorAll('.tub-fl').forEach(f=>f.style.transform=abrir?'rotate(0deg)':'rotate(-90deg)'); }

    pintarAcc();
  }

  function cardP(p) {
    const dias = diasDe(p), sem = semaforo(p);
    const diasTxt = sem.nivel==='fin' ? '' : `<span class="tub-dias"><span class="sd" style="background:${sem.color}"></span>${dias} días</span>`;
    return `<div class="tub-card" data-id="${p.id}" style="border-left:3px solid ${sem.color}">
      <div class="tub-c-top"><span class="tub-c-id">${p.prospect_id||'—'}</span></div>
      <div class="tub-c-nm">${p.nombre||'Sin nombre'}</div>
      <div class="tub-c-meta"><span class="num" style="color:var(--green);font-weight:700">${money(p.monto)}</span>${diasTxt}</div>
      <div class="tub-c-foot"><span>${p.tipo||'—'}</span><span>${p.sucursal||'—'}</span></div>
    </div>`;
  }

  // ═══════════════════════ EXPEDIENTE (pestañas) ═══════════════════════
  function verExpediente(pr) {
    let SUB='INFO';
    const sub = el(`<div class="overlay"><div class="ohead"><button class="back">←</button><div class="ot">${pr.nombre}</div></div><div class="ocontent">
      <div class="ex-head">
        <div style="flex:1;min-width:0"><div class="ex-folio">${pr.prospect_id||'—'}</div><div class="ex-sub">${pr.tipo} · ${money(pr.monto)} · ${pr.ejecutivo||'—'}</div></div>
        <select class="inp ex-status" id="ex-st" style="margin:0;flex:0 0 auto;width:auto">${ETAPAS_TODAS.map(s=>`<option ${pr.status===s?'selected':''}>${s}</option>`).join('')}</select>
      </div>
      <div id="ex-acciones"></div>
      <div class="ex-tabs">${[['INFO','Información'],['EVAL','Evaluación'],['DOCS','Documentos'],['BIT','Bitácora']].map(([k,t])=>`<button class="ex-tab" data-s="${k}">${t}</button>`).join('')}</div>
      <div id="ex-body"></div>
    </div></div>`);
    document.body.appendChild(sub);
    sub.querySelector('.back').addEventListener('click',()=>sub.remove());
    const recargar = async ()=>{ sub.remove(); await cargarProspectos(true); if(TAB==='PIPE') renderPipeline(); else render(); };

    // Selector de estatus
    const stSel = sub.querySelector('#ex-st');
    stSel.addEventListener('change', async ()=>{
      const nuevo = stSel.value;
      if (nuevo===pr.status){ return; }
      if (nuevo==='Surtidos'){ alert('Para surtir usa el botón "Surtir → cartera".'); stSel.value=pr.status; return; }
      if (nuevo==='Visita Domiciliaria'){ abrirModalVisita(pr, stSel); return; }
      if (!confirm('¿Cambiar estatus a: '+nuevo+'?')){ stSel.value=pr.status; return; }
      try { await repo.cambiarStatus(pr, nuevo, perfil); pr.status=nuevo; avisarWA(pr,nuevo); pintarAcciones(); }
      catch(e){ alert('❌ '+e.message); stSel.value=pr.status; }
    });

    // Modal: enviar a verificación domiciliaria (dispara visita PENDIENTE a la cola de Visitas)
    function abrirModalVisita(pr, stSel){
      const kyc = (pr.cotizacion_json&&pr.cotizacion_json.expediente)||{};
      const dom = kyc.domicilio||{};
      const dir = [dom.calle, dom.colonia||pr.colonia, [dom.ciudad||pr.municipio, dom.cp].filter(Boolean).join(' ').trim()].filter(Boolean).join(', ');
      const av = kyc.aval ? [kyc.aval.nombre, kyc.aval.tel].filter(Boolean).join(' · ') : '';
      const m = el(`<div class="p-modal"><div class="p-mbox">
        <div class="sec-h"><span class="t">Enviar a verificación domiciliaria</span><span class="ln"></span></div>
        <div class="note" style="margin:0 0 8px">Se cambia el estatus y se crea una visita PENDIENTE en el módulo de Visitas.</div>
        <label class="alab">Teléfono</label><input class="inp" id="mv-tel" value="${pr.telefono||dom.celular||''}">
        <label class="alab">Dirección</label><input class="inp" id="mv-dir" value="${dir}">
        <label class="alab">Aval / referencia</label><input class="inp" id="mv-av" value="${av}">
        <label class="alab">Horario de visita</label><input class="inp" id="mv-hor" placeholder="Ej. Lun a Vie 9-18h / Horario abierto">
        <label class="alab">Nota para el verificador</label><textarea class="inp" id="mv-nota" rows="2" style="resize:vertical"></textarea>
        <div style="display:flex;gap:8px;margin-top:10px">
          <button class="btn-primary" id="mv-ok" style="flex:1;margin:0">Enviar visita</button>
          <button class="btn-primary" id="mv-cx" style="flex:0 0 auto;margin:0;background:var(--slate)">Cancelar</button>
        </div></div></div>`);
      document.body.appendChild(m);
      const cerrar=(revert)=>{ m.remove(); if(revert) stSel.value=pr.status; };
      m.querySelector('#mv-cx').onclick=()=>cerrar(true);
      m.addEventListener('click',e=>{ if(e.target===m) cerrar(true); });
      m.querySelector('#mv-ok').onclick=async()=>{
        const datos={ telefono:m.querySelector('#mv-tel').value.trim(), direccion:m.querySelector('#mv-dir').value.trim(),
          aval:m.querySelector('#mv-av').value.trim(), horarios:m.querySelector('#mv-hor').value.trim(), nota:m.querySelector('#mv-nota').value.trim() };
        const btn=m.querySelector('#mv-ok'); btn.disabled=true; btn.textContent='Enviando…';
        try{
          await repo.cambiarStatus(pr,'Visita Domiciliaria',perfil);
          await repo.dispararVisitaVerificacion(pr, datos, perfil);
          pr.status='Visita Domiciliaria'; avisarWA(pr,'Visita Domiciliaria'); pintarAcciones();
          m.remove(); alert('✅ Estatus actualizado y visita enviada a la cola de Visitas.');
        }catch(e){ alert('❌ '+e.message); btn.disabled=false; btn.textContent='Enviar visita'; }
      };
    }

    // Tabs
    const tabs = sub.querySelectorAll('.ex-tab');
    tabs.forEach(t=>t.addEventListener('click',()=>{ SUB=t.dataset.s; tabs.forEach(x=>x.classList.toggle('on',x.dataset.s===SUB)); pintarBody(); }));
    tabs[0].classList.add('on');

    pintarAcciones(); pintarBody();

    function pintarAcciones() {
      const cont = sub.querySelector('#ex-acciones');
      const sig = siguienteEtapa(pr.status);
      const puedeSurtir = pr.status==='Listo para Surtir' && !pr.enviado_cartera;
      const puedeEval = !['Surtidos','Rechazado','Rechazado por Vigencia','Cancelado'].includes(pr.status);
      cont.innerHTML = `
        ${pr.enviado_cartera?'<div class="note" style="border-color:var(--green);margin-bottom:8px">✅ Ya está en cartera con su calendario.</div>':''}
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:6px">
          ${sig&&sig!=='Surtidos'?`<button class="btn-primary mini" id="a-av" style="flex:1;min-width:120px;margin:0">Avanzar: ${sig}</button>`:''}
          ${puedeSurtir?`<button class="btn-primary mini" id="a-surt" style="flex:1;min-width:140px;margin:0;background:var(--green)">Surtir → cartera</button>`:''}
          ${puedeEval?`<button class="btn-primary mini" id="a-rj" style="flex:1;min-width:110px;margin:0;background:var(--red)">Rechazar</button>`:''}
        </div>`;
      const av=cont.querySelector('#a-av'); if(av) av.addEventListener('click', async ()=>{ try{ const r=await repo.avanzar(pr,perfil); pr.status=siguienteEtapa(pr.status)||pr.status; avisarWA(pr,pr.status); alert(r.msg); stSel.value=pr.status; pintarAcciones(); }catch(e){ alert('❌ '+e.message); } });
      const su=cont.querySelector('#a-surt'); if(su) su.addEventListener('click',()=>surtir(pr, recargar));
      const rj=cont.querySelector('#a-rj'); if(rj) rj.addEventListener('click', async ()=>{ const m=prompt('Motivo del rechazo:'); if(m===null) return; try{ await repo.rechazar(pr,m,perfil); pr.status='Rechazado'; avisarWA(pr,'Rechazado'); stSel.value='Rechazado'; pintarAcciones(); }catch(e){ alert('❌ '+e.message); } });
    }

    function pintarBody() {
      const b = sub.querySelector('#ex-body');
      if (SUB==='INFO') pintarInfo(b);
      else if (SUB==='EVAL') pintarEval(b);
      else if (SUB==='DOCS') pintarDocs(b);
      else pintarBit(b);
    }

    // ── TAB INFORMACIÓN ──
    function pintarInfo(b) {
      const recibe = pr.tipo_cliente==='RENOVACION' ? (pr.deposito-(pr.adeudo_actual||0)) : pr.deposito;
      const sem = semaforo(pr);
      b.innerHTML = `
        <div class="fcard">
          <div class="liqrow"><span>Estatus</span><b>${pr.status}</b></div>
          <div class="liqrow"><span>Días en pipeline</span><b><span class="sd" style="background:${sem.color};vertical-align:middle"></span> ${diasDe(pr)}</b></div>
          <div class="liqrow"><span>Tipo / monto</span><b class="num">${pr.tipo} · ${money(pr.monto)}</b></div>
          <div class="liqrow"><span>Plazo</span><b>${pr.plazo} ${String(pr.frecuencia||'').toLowerCase()} · ${pr.financiar?'financiada':'descontada'}</b></div>
          <div class="liqrow"><span>Comisión</span><b class="num">${money(pr.comision)}</b></div>
          <div class="liqrow hl"><span>${pr.tipo_cliente==='RENOVACION'?'Recibe (− saldo)':'Depósito'}</span><b class="num" style="color:var(--green)">${money(recibe)}</b></div>
          <div class="liqrow"><span>Abono puntual</span><b class="num">${money(pr.abono_puntual)}</b></div>
          <div class="liqrow"><span>Abono impuntual</span><b class="num" style="color:var(--gold)">${money(pr.abono_impuntual)}</b></div>
          ${pr.score_eval!=null?`<div class="liqrow"><span>Score evaluación</span><b class="num">${pr.score_eval} · ${clasificar(pr.score_eval).riesgo}</b></div>`:''}
        </div>
        <div class="fcard">
          <div class="sec-h" style="margin-top:0"><span class="t">Contacto</span><span class="ln"></span></div>
          <label class="alab">Nombre completo</label><input class="inp" id="i-nom" value="${pr.nombre||''}">
          <label class="alab">Teléfono</label><input class="inp" id="i-tel" value="${pr.telefono||''}">
          <div style="display:flex;gap:8px"><div style="flex:1"><label class="alab">Colonia</label><input class="inp" id="i-col" value="${pr.colonia||''}"></div><div style="flex:1"><label class="alab">Municipio</label><input class="inp" id="i-muni" value="${pr.municipio||''}"></div></div>
          ${pr.tipo_cliente==='RENOVACION'?`<label class="alab">Adeudo actual</label><input class="inp" id="i-adeudo" inputmode="decimal" value="${pr.adeudo_actual||0}">`:''}
          <button class="btn-primary" id="i-save" style="background:var(--green)">Guardar cambios</button>
        </div>`;
      b.querySelector('#i-save').addEventListener('click', async ()=>{
        const up = { nombre:b.querySelector('#i-nom').value.trim(), telefono:b.querySelector('#i-tel').value.trim(), colonia:b.querySelector('#i-col').value.trim(), municipio:b.querySelector('#i-muni').value.trim() };
        const ad=b.querySelector('#i-adeudo'); if(ad) up.adeudo_actual=parseFloat(ad.value)||0;
        try{ await repo.actualizarProspecto(pr.id, up, perfil); Object.assign(pr, up); sub.querySelector('.ot').textContent=pr.nombre; alert('✅ Guardado.'); }
        catch(e){ alert('❌ '+e.message); }
      });
    }

    // ── TAB EVALUACIÓN + KYC ──
    function pintarEval(b) {
      const ev = (pr.cotizacion_json&&pr.cotizacion_json.evaluacion)||{};
      const prev = ev.respuestas||[];
      const kyc = (pr.cotizacion_json&&pr.cotizacion_json.expediente)||{};
      b.innerHTML = `
        <div class="fcard" id="ev-sc" style="text-align:center"><div class="klab">Score de riesgo</div><div class="num" id="ev-n" style="font-size:2.1em;font-weight:800;color:var(--navy)">0</div><div id="ev-cls"></div></div>
        <div class="sec-h"><span class="t">Cuestionario</span><span class="ln"></span></div>
        <div id="ev-q"></div>
        <button class="btn-primary" id="ev-save" style="background:var(--green)">Guardar evaluación</button>
        <div class="sec-h"><span class="t">Expediente del cliente (KYC)</span><span class="ln"></span></div>
        <div class="fcard">
          <label class="alab">Nombre completo</label><input class="inp k" id="k-nombre" value="${kyc.nombre||pr.nombre||''}">
          <div style="display:flex;gap:8px"><div style="flex:1"><label class="alab">CURP</label><input class="inp k" id="k-curp" value="${kyc.curp||''}"></div><div style="flex:1"><label class="alab">RFC</label><input class="inp k" id="k-rfc" value="${kyc.rfc||''}"></div></div>
          <div style="display:flex;gap:8px"><div style="flex:1"><label class="alab">Estado civil</label><input class="inp k" id="k-civil" value="${kyc.estado_civil||''}"></div><div style="flex:1"><label class="alab">Cónyuge</label><input class="inp k" id="k-conyuge" value="${kyc.conyuge||''}"></div></div>
          <div class="sec-h" style="margin-top:8px"><span class="t">Domicilio</span><span class="ln"></span></div>
          <label class="alab">Calle y número</label><input class="inp k" id="k-calle" value="${(kyc.domicilio&&kyc.domicilio.calle)||''}">
          <div style="display:flex;gap:8px"><div style="flex:1"><label class="alab">Colonia</label><input class="inp k" id="k-colonia" value="${(kyc.domicilio&&kyc.domicilio.colonia)||pr.colonia||''}"></div><div style="flex:1"><label class="alab">CP</label><input class="inp k" id="k-cp" value="${(kyc.domicilio&&kyc.domicilio.cp)||''}"></div></div>
          <div style="display:flex;gap:8px"><div style="flex:1"><label class="alab">Ciudad</label><input class="inp k" id="k-ciudad" value="${(kyc.domicilio&&kyc.domicilio.ciudad)||pr.municipio||''}"></div><div style="flex:1"><label class="alab">Celular</label><input class="inp k" id="k-cel" value="${(kyc.domicilio&&kyc.domicilio.celular)||pr.telefono||''}"></div></div>
          <div class="sec-h" style="margin-top:8px"><span class="t">Laboral</span><span class="ln"></span></div>
          <div style="display:flex;gap:8px"><div style="flex:1"><label class="alab">Empresa</label><input class="inp k" id="k-empresa" value="${(kyc.laboral&&kyc.laboral.empresa)||''}"></div><div style="flex:1"><label class="alab">Puesto</label><input class="inp k" id="k-puesto" value="${(kyc.laboral&&kyc.laboral.puesto)||''}"></div></div>
          <label class="alab">Ingreso mensual</label><input class="inp k" id="k-ingreso" value="${(kyc.laboral&&kyc.laboral.ingreso)||''}">
          <div class="sec-h" style="margin-top:8px"><span class="t">Aval</span><span class="ln"></span></div>
          <label class="alab">Nombre del aval</label><input class="inp k" id="k-aval" value="${(kyc.aval&&kyc.aval.nombre)||''}">
          <div style="display:flex;gap:8px"><div style="flex:1"><label class="alab">Teléfono aval</label><input class="inp k" id="k-aval-tel" value="${(kyc.aval&&kyc.aval.tel)||''}"></div><div style="flex:1"><label class="alab">Parentesco</label><input class="inp k" id="k-aval-par" value="${(kyc.aval&&kyc.aval.parentesco)||''}"></div></div>
          <div class="sec-h" style="margin-top:8px"><span class="t">Referencias</span><span class="ln"></span></div>
          ${[0,1,2].map(i=>{ const r=(kyc.referencias&&kyc.referencias[i])||{}; return `<div style="display:flex;gap:8px"><input class="inp k" id="k-ref${i}-nom" placeholder="Ref ${i+1}: nombre" value="${r.nombre||''}" style="flex:2"><input class="inp k" id="k-ref${i}-tel" placeholder="teléfono" value="${r.tel||''}" style="flex:1"></div>`; }).join('')}
          <button class="btn-primary" id="k-save">Guardar expediente</button>
        </div>`;
      // Cuestionario
      const qWrap=b.querySelector('#ev-q');
      qWrap.innerHTML = PREGUNTAS.map((q,i)=>{
        const a=(prev[i]&&prev[i].a)||'';
        if (q.tipo==='sino') return `<div style="margin-bottom:7px"><div style="font-size:.82em;margin-bottom:3px">${i+1}. ${q.q}${q.pts?` <span style="color:var(--slate)">(${q.pts}pts)</span>`:''}</div><select class="inp ev-i" data-i="${i}" style="margin-bottom:0"><option value="">—</option><option ${a==='SI'?'selected':''}>SI</option><option ${a==='NO'?'selected':''}>NO</option></select></div>`;
        if (q.tipo==='select') return `<div style="margin-bottom:7px"><div style="font-size:.82em;margin-bottom:3px">${i+1}. ${q.q}</div><select class="inp ev-i" data-i="${i}" style="margin-bottom:0"><option value="">—</option>${q.opciones.map(o=>`<option ${a===o?'selected':''}>${o}</option>`).join('')}</select></div>`;
        return `<div style="margin-bottom:7px"><div style="font-size:.82em;margin-bottom:3px">${i+1}. ${q.q}</div><input class="inp ev-i" data-i="${i}" value="${a}" style="margin-bottom:0"></div>`;
      }).join('');
      const recompute=()=>{
        const resp=[]; b.querySelectorAll('.ev-i').forEach(e=>{ resp[parseInt(e.dataset.i)]={a:e.value}; });
        for(let i=0;i<PREGUNTAS.length;i++) if(!resp[i]) resp[i]={a:''};
        const sc=calcularScore(resp), cl=clasificar(sc);
        b.querySelector('#ev-n').textContent=sc;
        b.querySelector('#ev-cls').innerHTML=`<span style="color:${cl.color};font-weight:700">${cl.nivel} · ${cl.riesgo}</span>`;
        return resp;
      };
      b.querySelectorAll('.ev-i').forEach(e=>e.addEventListener('change',recompute));
      recompute();
      b.querySelector('#ev-save').addEventListener('click', async ()=>{ const resp=recompute(); try{ const r=await repo.guardarEvaluacion(pr,resp,perfil); pr.score_eval=r.score; alert('✅ Evaluación guardada. Score: '+r.score); }catch(e){ alert('❌ '+e.message); } });
      // KYC
      b.querySelector('#k-save').addEventListener('click', async ()=>{
        const g=id=>{ const e=b.querySelector('#'+id); return e?e.value.trim():''; };
        const exp = {
          nombre:g('k-nombre'), curp:g('k-curp'), rfc:g('k-rfc'), estado_civil:g('k-civil'), conyuge:g('k-conyuge'),
          domicilio:{ calle:g('k-calle'), colonia:g('k-colonia'), cp:g('k-cp'), ciudad:g('k-ciudad'), celular:g('k-cel') },
          laboral:{ empresa:g('k-empresa'), puesto:g('k-puesto'), ingreso:g('k-ingreso') },
          aval:{ nombre:g('k-aval'), tel:g('k-aval-tel'), parentesco:g('k-aval-par') },
          referencias:[0,1,2].map(i=>({ nombre:g('k-ref'+i+'-nom'), tel:g('k-ref'+i+'-tel') })),
        };
        try{ await repo.guardarKYC(pr, exp, perfil); alert('✅ Expediente guardado.'); }catch(e){ alert('❌ '+e.message); }
      });
    }

    // ── TAB DOCUMENTOS (checklist) ──
    function pintarDocs(b) {
      const saved = (pr.cotizacion_json&&pr.cotizacion_json.checklist)||[];
      const fotos = (pr.cotizacion_json&&pr.cotizacion_json.fotos)||[];
      const grid = (arr)=> arr.length ? arr.map(u=>`<a href="${u}" target="_blank" rel="noopener" class="ft-thumb"><img src="${u}" loading="lazy" alt="evidencia"></a>`).join('') : '<div class="dempty">Sin fotos aún.</div>';
      b.innerHTML = `
        <div class="note" style="margin-bottom:10px">Marca los documentos que debe entregar este cliente. Luego puedes copiar la lista para WhatsApp.</div>
        <div id="dk-list">${DOCS_REQ.map((d,i)=>`<label class="dk-item"><input type="checkbox" class="dk" data-d="${i}" ${saved.includes(d)?'checked':''}> <span>${d}</span></label>`).join('')}</div>
        <div style="display:flex;gap:8px;margin-top:10px">
          <button class="btn-primary" id="dk-save" style="margin:0;flex:1">Guardar checklist</button>
          <button class="btn-primary" id="dk-wa" style="margin:0;flex:1;background:#25D366">Copiar para WhatsApp</button>
        </div>
        <div class="sec-h" style="margin-top:16px"><span class="t">Evidencias / Fotos</span><span class="ln"></span></div>
        <input type="file" id="ft-in" accept="image/*" multiple style="font-size:.85em;width:100%">
        <button class="btn-primary" id="ft-up" style="margin:8px 0 0;width:100%">Subir fotos</button>
        <div id="ft-grid" class="ft-grid">${grid(fotos)}</div>`;
      const leer=()=>[...b.querySelectorAll('.dk:checked')].map(c=>DOCS_REQ[parseInt(c.dataset.d)]);
      b.querySelector('#dk-save').addEventListener('click', async ()=>{ try{ await repo.guardarChecklist(pr, leer(), perfil); alert('✅ Checklist guardado ('+leer().length+' docs).'); }catch(e){ alert('❌ '+e.message); } });
      b.querySelector('#dk-wa').addEventListener('click', ()=>{
        const docs=leer(); if(!docs.length) return alert('Marca al menos un documento.');
        const msg = `¡Buen día! 🙋\nSu crédito ha sido pre-autorizado. Le pedimos enviar la documentación clara, completa y legible:\n\n`+docs.map(d=>'• '+d).join('\n')+`\n\nQuedamos en espera para continuar su proceso. ¡Gracias! ✅`;
        navigator.clipboard.writeText(msg).then(()=>alert('✅ Lista copiada al portapapeles.')).catch(()=>{ window.open('https://wa.me/?text='+encodeURIComponent(msg),'_blank'); });
      });
      b.querySelector('#ft-up').addEventListener('click', async ()=>{
        const inp=b.querySelector('#ft-in'); const files=[...(inp.files||[])];
        if(!files.length) return alert('Selecciona al menos una foto.');
        const btn=b.querySelector('#ft-up'); btn.disabled=true; btn.textContent='Subiendo…';
        try{
          const urls=await subirFotos(files,'tuberia');
          if(!urls.length) throw new Error('No se pudo subir ninguna foto.');
          const r=await repo.guardarFotos(pr, urls, perfil);
          b.querySelector('#ft-grid').innerHTML=grid(r.fotos); inp.value='';
          alert('✅ '+urls.length+' foto(s) subida(s).');
        }catch(e){ alert('❌ '+e.message); }
        finally{ btn.disabled=false; btn.textContent='Subir fotos'; }
      });
    }

    // ── TAB BITÁCORA ──
    function pintarBit(b) {
      b.innerHTML = `
        <div style="display:flex;gap:8px"><input class="inp" id="bt-new" placeholder="Escribe una nota…" style="flex:1;margin:0"><button class="btn-primary" id="bt-add" style="margin:0;flex:0 0 90px">Agregar</button></div>
        <div class="fcard" id="bt-log" style="white-space:pre-wrap;font-size:.82em;line-height:1.6;margin-top:10px;min-height:120px">${pr.notas||'Sin notas registradas.'}</div>`;
      b.querySelector('#bt-add').addEventListener('click', async ()=>{
        const t=b.querySelector('#bt-new').value.trim(); if(!t) return;
        try{ const r=await repo.agregarNota(pr,t,perfil); b.querySelector('#bt-log').textContent=r.notas; b.querySelector('#bt-new').value=''; }catch(e){ alert('❌ '+e.message); }
      });
    }
  }

  // Aviso WhatsApp opcional al cambiar de etapa
  function avisarWA(pr, etapa) {
    const a = avisoPorEtapa(pr, etapa); if (!a || !a.tel) return;
    if (confirm(`¿Avisar por WhatsApp a ${a.para}?`)) { const url=linkWhatsApp(a.tel, a.msg); if (url) window.open(url,'_blank'); }
  }

  // ── Surtir → reparto de bancos ──
  async function surtir(pr, recargar) {
    const sur = calcularSurtimiento(pr);
    const bancos = await fetchBancos();
    const opts = bancos.map(bk=>`<option>${bk.cuenta}</option>`).join('');
    const s2 = el(`<div class="overlay"><div class="ohead"><button class="back">←</button><div class="ot">Surtir · ${pr.nombre}</div></div><div class="ocontent">
      <div class="fcard">
        <div class="liqrow"><span>Capital en cartera</span><b class="num">${money(sur.capital)}</b></div>
        ${sur.esReno?`<div class="liqrow"><span>Saldo a liquidar</span><b class="num" style="color:var(--red)">${money(sur.adeudoReno)}</b></div>`:''}
        <div class="liqrow hl"><span>Se deposita al cliente</span><b class="num" style="color:var(--green)">${money(sur.objetivoReparto)}</b></div>
      </div>
      <div class="note" style="margin:8px 0">Indica de qué cuenta(s) sale el dinero. Debe sumar ${money(sur.objetivoReparto)}.</div>
      <div id="rep-rows"></div>
      <button class="btn-primary" id="rep-add" style="background:#fff;color:var(--navy);border:1px solid var(--line);margin-bottom:8px">+ Otra cuenta</button>
      <div class="liqrow" style="font-weight:700"><span>Suma del reparto</span><b class="num" id="rep-sum">$0</b></div>
      <button class="btn-primary" id="rep-go" style="margin-top:10px;background:var(--green)">Confirmar y surtir</button></div></div>`);
    document.body.appendChild(s2);
    s2.querySelector('.back').addEventListener('click',()=>s2.remove());
    const rows=s2.querySelector('#rep-rows');
    const addRow=(monto)=>{ const r=el(`<div style="display:flex;gap:8px;margin-bottom:8px"><select class="inp rep-c" style="flex:1;margin:0">${opts}</select><input class="inp rep-m" inputmode="decimal" placeholder="monto" value="${monto||''}" style="flex:0 0 110px;margin:0"><button class="rep-x" style="flex:0 0 36px;border:1px solid var(--line);background:#fff;border-radius:10px;cursor:pointer">✕</button></div>`); rows.appendChild(r); r.querySelector('.rep-x').addEventListener('click',()=>{ r.remove(); sum(); }); r.querySelector('.rep-m').addEventListener('input',sum); };
    const sum=()=>{ let s=0; rows.querySelectorAll('.rep-m').forEach(m=>s+=parseFloat(m.value)||0); s2.querySelector('#rep-sum').textContent=money(s); };
    s2.querySelector('#rep-add').addEventListener('click',()=>addRow());
    addRow(sur.objetivoReparto); sum();
    s2.querySelector('#rep-go').addEventListener('click', async ()=>{
      const reparto=[]; rows.querySelectorAll('.rep-c').forEach((c,i)=>{ const m=rows.querySelectorAll('.rep-m')[i]; reparto.push({ cuenta:c.value, monto:m.value }); });
      if (!confirm('¿Confirmar surtimiento? Se creará el cliente en cartera con su calendario y saldrá el dinero de los bancos.')) return;
      try { const r=await repo.enviarACartera(pr, reparto, perfil); avisarWA(pr,'Surtidos'); alert(r.msg); s2.remove(); recargar(); }
      catch(e){ alert('❌ '+e.message); }
    });
  }

  // ═══════════════════════ DASHBOARD OPERATIVO ═══════════════════════
  async function renderDashboard() {
    const body = root.querySelector('#tb-body');
    body.innerHTML = '<div class="loader">Cargando dashboard…</div>';
    await cargarProspectos();
    const base = visibles(PROSPECTOS);
    const hoy = new Date();
    let mes = hoy.getMonth()+1, anio = hoy.getFullYear();
    const anios = aniosDisponibles(base); if (anios.length && !anios.includes(anio)) anio = anios[anios.length-1];
    const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

    body.innerHTML = `
      <div class="tb-filtros">
        <div class="tb-frow">
          <select class="inp" id="d-mes">${MESES.map((m,i)=>`<option value="${i+1}" ${i+1===mes?'selected':''}>${m}</option>`).join('')}</select>
          <select class="inp" id="d-anio">${(anios.length?anios:[anio]).map(a=>`<option ${a===anio?'selected':''}>${a}</option>`).join('')}</select>
        </div>
        <div style="display:flex;gap:8px">
          <button class="btn-primary" id="d-aplica" style="margin:0;flex:1">Aplicar filtro</button>
          <button class="tb-mini" id="d-todo">Histórico total</button>
        </div>
      </div>
      <div id="d-tablas"></div>`;
    const pinta=(m,a)=>{
      const lista = (m&&a) ? filtrarPorMes(base, m, a) : base;
      const d = agregarDashboard(lista);
      const cell=(v)=>money(v);
      const cont = body.querySelector('#d-tablas');
      cont.innerHTML = `
        <div class="dash-sec"><div class="dash-tit">Tubería por sucursal</div>
          <div class="dash-wrap"><table class="dash-tbl">
            <thead><tr><th>Sucursal</th><th>Surtido</th><th>Por surtir</th><th>Visita</th><th>Proceso</th><th>Rechazado</th><th>Total</th></tr></thead>
            <tbody>${d.tuberia.length?d.tuberia.map(r=>`<tr><td class="dl">${r.sucursal}</td><td style="color:var(--green)">${cell(r.surtido)}</td><td style="color:var(--amber)">${cell(r.porSurtir)}</td><td style="color:var(--steel)">${cell(r.visita)}</td><td>${cell(r.proceso)}</td><td style="color:var(--red)">${cell(r.rechazado)}</td><td class="dl">${cell(r.total)}</td></tr>`).join(''):'<tr><td colspan="7" class="dempty">Sin datos</td></tr>'}</tbody>
          </table></div></div>
        <div class="dash-sec"><div class="dash-tit">Desglose surtido</div>
          <div class="dash-wrap"><table class="dash-tbl">
            <thead><tr><th>Sucursal</th><th>Nuevos</th><th>React.</th><th>Renov.</th></tr></thead>
            <tbody>${d.desglose.length?d.desglose.map(r=>`<tr><td class="dl">${r.sucursal}</td><td style="color:var(--green)">${cell(r.nuevos)}</td><td>${cell(r.reactivacion)}</td><td style="color:var(--amber)">${cell(r.renovacion)}</td></tr>`).join(''):'<tr><td colspan="4" class="dempty">Sin datos</td></tr>'}</tbody>
          </table></div></div>
        <div class="dash-sec"><div class="dash-tit">Intereses por sucursal</div>
          <div class="dash-wrap"><table class="dash-tbl">
            <thead><tr><th>Sucursal</th><th>Interés generado</th><th>Tasa prom.</th></tr></thead>
            <tbody>${d.intereses.length?d.intereses.map(r=>`<tr><td class="dl">${r.sucursal}</td><td style="color:var(--steel)">${cell(r.montoIntereses)}</td><td>${(r.tasaPromedio||0).toFixed(1)}%</td></tr>`).join(''):'<tr><td colspan="3" class="dempty">Sin datos</td></tr>'}</tbody>
          </table></div></div>
        <div class="dash-sec"><div class="dash-tit">Ventas por ejecutivo</div>
          <div class="dash-wrap"><table class="dash-tbl">
            <thead><tr><th>Ejecutivo</th><th>Surtido</th><th>Nuevos</th><th>Renov.</th><th>Comisión</th></tr></thead>
            <tbody>${d.ejecutivos.length?d.ejecutivos.map(r=>`<tr><td class="dl">${r.ejecutivo}</td><td style="color:var(--green)">${cell(r.surtido)}</td><td>${cell(r.nuevos)}</td><td style="color:var(--amber)">${cell(r.renovacion)}</td><td style="color:var(--green)">${cell(r.comision)}</td></tr>`).join(''):'<tr><td colspan="5" class="dempty">Sin datos</td></tr>'}</tbody>
          </table></div></div>`;
    };
    body.querySelector('#d-aplica').addEventListener('click',()=>{ mes=parseInt(body.querySelector('#d-mes').value); anio=parseInt(body.querySelector('#d-anio').value); pinta(mes,anio); });
    body.querySelector('#d-todo').addEventListener('click',()=>pinta(0,0));
    pinta(mes,anio);
  }

  // ═══════════════════════ COTIZADOR (en vivo) ═══════════════════════
  function renderCotizador() {
    const body = root.querySelector('#tb-body');
    body.innerHTML = `
      <label class="alab">Monto solicitado</label><input class="inp" id="c-monto" inputmode="decimal" placeholder="Ej. 10000">
      <label class="alab">Tipo de crédito</label><select class="inp" id="c-tipo">${TIPOS.map(([v,t])=>`<option value="${v}">${t}</option>`).join('')}</select>
      <div style="display:flex;gap:8px">
        <div style="flex:1"><label class="alab">Frecuencia</label><select class="inp" id="c-freq">${FRECUENCIAS.map(f=>`<option value="${f}">${f[0]+f.slice(1).toLowerCase()}</option>`).join('')}</select></div>
        <div style="flex:1"><label class="alab">Plazo</label><select class="inp" id="c-plazo">${PLAZOS.map(p=>`<option ${p===12?'selected':''}>${p}</option>`).join('')}</select></div>
      </div>
      <label class="alab">Comisión</label>
      <div style="display:flex;gap:8px"><select class="inp" id="c-ctipo" style="flex:0 0 100px"><option value="PCT">%</option><option value="FIJO">$ fijo</option></select><input class="inp" id="c-cval" inputmode="decimal" value="5" style="flex:1"></div>
      <label style="display:flex;align-items:center;gap:8px;font-size:.84em;margin:10px 0;cursor:pointer"><input type="checkbox" id="c-fin" style="width:16px;height:16px"> Financiar comisión (sumarla al crédito)</label>
      <div id="c-res"></div>`;
    const $=(s)=>body.querySelector(s);
    const recalc=()=>{
      try {
        cot = cotizar({ monto:$('#c-monto').value, tipo:$('#c-tipo').value, frecuencia:$('#c-freq').value, plazo:$('#c-plazo').value, comisionTipo:$('#c-ctipo').value, comisionValor:$('#c-cval').value, financiar:$('#c-fin').checked });
        $('#c-res').innerHTML = `
          <div class="fcard" style="margin-top:12px">
            <div style="text-align:center;margin-bottom:10px"><div class="klab">Abono puntual</div><div class="num" style="font-size:2.4em;font-weight:800;color:var(--navy)">${money(cot.abonoPuntual)}</div></div>
            <div class="liqrow"><span>Comisión ${cot.isFixed?'(fija)':'('+cot.pctComision+'%)'}</span><b class="num">${money(cot.comision)}</b></div>
            <div class="liqrow"><span>Interés generado</span><b class="num">${money(cot.interesPuntual)}</b></div>
            <div class="liqrow hl"><span>Depósito al cliente</span><b class="num" style="color:var(--green)">${money(cot.deposito)}</b></div>
            <div class="liqrow"><span>Total deuda puntual</span><b class="num">${money(cot.totalPuntual)}</b></div>
            <div class="liqrow"><span>Total deuda impuntual</span><b class="num" style="color:var(--red)">${money(cot.totalImpuntual)}</b></div>
            <div class="liqrow"><span>Abono si paga tarde</span><b class="num" style="color:var(--gold)">${money(cot.abonoImpuntual)}</b></div>
          </div>
          <div style="display:flex;gap:8px;margin-top:10px">
            <button class="btn-primary" id="c-wa" style="flex:1;background:#25D366;margin:0">Compartir WhatsApp</button>
            <button class="btn-primary" id="c-cont" style="flex:1;margin:0">Continuar →</button>
          </div>`;
        $('#c-wa').addEventListener('click',()=>compartirWhatsApp(cot));
        $('#c-cont').addEventListener('click',()=>renderProspecto());
      } catch(e){ $('#c-res').innerHTML = `<div class="note" style="margin-top:12px;border-color:var(--red);color:var(--red)">${e.message}</div>`; }
    };
    ['#c-monto','#c-tipo','#c-freq','#c-plazo','#c-ctipo','#c-cval','#c-fin'].forEach(s=>{ const e=$(s); e.addEventListener('input',recalc); e.addEventListener('change',recalc); });
  }

  function compartirWhatsApp(c) {
    const txt = `*COTIZACIÓN MONEYCASH* 💰\n\n📋 *CRÉDITO*\nTipo: ${c.tipo}\nMonto: ${money(c.monto)}\nPlazo: ${c.plazo} ${c.frecuencia.toLowerCase()}\nTasa: ${(c.tasaPuntual*100).toFixed(1)}%\n\n💰 *DETALLE*\nComisión: ${money(c.comision)} ${c.financiar?'(sumada)':'(descontada)'}\nRecibe el cliente: ${money(c.deposito)}\n\n📅 *ABONOS*\n✅ Puntual: ${money(c.abonoPuntual)}\n⚠️ Impuntual: ${money(c.abonoImpuntual)}\n\n📊 Total puntual: ${money(c.totalPuntual)}\n\n⏰ Válida por 7 días`;
    window.open('https://wa.me/?text='+encodeURIComponent(txt), '_blank');
  }

  // ── Página 2: datos / solicitud (igual que antes) ──
  function renderProspecto() {
    const body = root.querySelector('#tb-body');
    const esEjec = perfil.rol==='EJECUTIVO';
    body.innerHTML = `
      <div class="note" style="margin-bottom:10px">${cot.tipo} · ${money(cot.monto)} · ${cot.plazo} ${cot.frecuencia.toLowerCase()} · abono ${money(cot.abonoPuntual)}</div>
      <label class="alab">Tipo de cliente</label>
      <select class="inp" id="p-tc"><option value="NUEVO">Cliente nuevo</option><option value="RENOVACION">Renovación</option><option value="REACTIVACION">Reactivación</option></select>
      <div id="p-form"></div>
      <button class="btn-primary" id="p-back" style="background:#fff;color:var(--navy);border:1px solid var(--line);margin-top:10px">← Regresar al cotizador</button>`;
    const $=(s)=>body.querySelector(s);
    $('#p-back').addEventListener('click',()=>renderCotizador());
    const tc=$('#p-tc'); tc.addEventListener('change',()=>pintarForm(tc.value)); pintarForm('NUEVO');

    function pintarForm(tipo) {
      const f=$('#p-form');
      if (tipo==='NUEVO') {
        f.innerHTML = `
          <label class="alab">Nombre completo *</label><input class="inp" id="p-nom" placeholder="Nombre Apellido">
          <label class="alab">Teléfono (WhatsApp)</label><input class="inp" id="p-tel" inputmode="tel" maxlength="10">
          <div style="display:flex;gap:8px"><div style="flex:1"><label class="alab">Municipio</label><select class="inp" id="p-muni"><option value="">—</option>${MUNICIPIOS.map(m=>`<option>${m}</option>`).join('')}</select></div><div style="flex:1"><label class="alab">Colonia</label><input class="inp" id="p-col"></div></div>
          <div style="display:flex;gap:8px"><div style="flex:1"><label class="alab">Sucursal</label><select class="inp" id="p-suc"><option value="GDL">Guadalajara</option><option value="ARENAL">Guadalajara 2</option></select></div>
          <div style="flex:1"><label class="alab">Ejecutivo *</label>${esEjec?`<input class="inp" id="p-ejec" value="${(perfil.ejecutivo||'').toUpperCase()}" readonly>`:`<select class="inp" id="p-ejec"><option value="">—</option>${EJECUTIVOS.map(e=>`<option>${e}</option>`).join('')}</select>`}</div></div>
          <button class="btn-primary" id="p-go" style="margin-top:12px;background:var(--green)">Crear prospecto</button><div id="p-err"></div>`;
        f.querySelector('#p-go').addEventListener('click', crearNuevo);
      } else {
        f.innerHTML = `
          <div class="note" style="margin:10px 0">${tipo==='RENOVACION'?'Se liquidará el saldo actual del cliente al surtir.':'Cliente con crédito liquidado que vuelve a entrar.'} Esta solicitud va al gerente para autorizar.</div>
          <label class="alab">Ejecutivo *</label>${esEjec?`<input class="inp" id="p-ejec" value="${(perfil.ejecutivo||'').toUpperCase()}" readonly>`:`<select class="inp" id="p-ejec"><option value="">—</option>${EJECUTIVOS.map(e=>`<option>${e}</option>`).join('')}</select>`}
          <label class="alab">Buscar cliente en cartera</label><input class="inp" id="p-busca" placeholder="Escribe el nombre…">
          <div id="p-lista" style="max-height:240px;overflow-y:auto;margin-top:6px"></div>
          <div id="p-sel"></div>`;
        cargarCandidatos(tipo, f);
      }
    }
    async function cargarCandidatos(tipo, f) {
      const cartera = await reno.fetchCarteraReno();
      const cands = candidatosReno(cartera, tipo);
      const lista=f.querySelector('#p-lista'), busca=f.querySelector('#p-busca');
      let elegido=null;
      const pintar=()=>{
        const q=(busca.value||'').toUpperCase();
        const fil=cands.filter(c=>!q||c.nombre.toUpperCase().includes(q)).slice(0,40);
        lista.innerHTML = fil.length ? fil.map(c=>`<div class="cli" data-id="${c.id}"><div><div class="nm">${c.nombre}</div><div class="mt">${c.ejecutivo} · ${tipo==='RENOVACION'?'saldo '+money(c.saldo):'capital '+money(c.capital)}</div></div></div>`).join('') : '<div class="note">Sin coincidencias.</div>';
        lista.querySelectorAll('.cli').forEach(card=>card.addEventListener('click',()=>{
          elegido = cands.find(c=>String(c.id)===card.dataset.id);
          busca.value = elegido.nombre; lista.innerHTML='';
          f.querySelector('#p-sel').innerHTML = `
            <div class="fcard" style="margin-top:10px"><div class="liqrow"><span>Cliente</span><b>${elegido.nombre}</b></div>
            <div class="liqrow"><span>${tipo==='RENOVACION'?'Saldo a liquidar':'Capital previo'}</span><b class="num">${money(tipo==='RENOVACION'?elegido.saldo:elegido.capital)}</b></div>
            ${tipo==='RENOVACION'?`<div class="liqrow hl"><span>Recibe (depósito − saldo)</span><b class="num" style="color:var(--green)">${money(cot.deposito-elegido.saldo)}</b></div>`:''}</div>
            <button class="btn-primary" id="p-sol" style="margin-top:10px;background:var(--green)">Enviar solicitud al gerente</button><div id="p-err"></div>`;
          f.querySelector('#p-sol').addEventListener('click',()=>enviarSolicitud(tipo, elegido, f));
        }));
      };
      busca.addEventListener('input',pintar); pintar();
    }
    async function enviarSolicitud(tipo, cliente, f) {
      const ejec = (f.querySelector('#p-ejec').value||'').trim();
      if (!ejec){ return err(f,'Selecciona el ejecutivo.'); }
      try { const d = { tipo, cliente:cliente.nombre, ejecutivo:ejec, saldo:cliente.saldo, capital:cliente.capital };
        const r = await reno.crearSolicitudReno(d, cot, perfil); alert(r.msg); TAB='SOL'; render(); }
      catch(e){ err(f, e.message); }
    }
    async function crearNuevo() {
      const nombre=$('#p-nom').value.trim(), ejec=$('#p-ejec').value;
      if (!nombre) return err($('#p-form'),'Indica el nombre.');
      if (!ejec) return err($('#p-form'),'Selecciona el ejecutivo.');
      const d={ nombre, telefono:$('#p-tel').value, sucursal:$('#p-suc').value, ejecutivo:ejec, colonia:$('#p-col').value, municipio:$('#p-muni').value };
      try { const r=await repo.crearProspecto(d, cot, perfil); alert(r.msg); PROSPECTOS=null; TAB='PIPE'; render(); } catch(e){ err($('#p-form'), e.message); }
    }
    function err(scope, msg){ const e=scope.querySelector('#p-err'); if(e){ e.innerHTML=`<div class="note" style="border-color:var(--red);color:var(--red);margin-top:8px">${msg}</div>`; } else alert(msg); }
  }

  // ═══════════════════════ SOLICITUDES (gerente) ═══════════════════════
  async function renderSolicitudes() {
    const body = root.querySelector('#tb-body');
    body.innerHTML = '<div class="loader">Cargando…</div>';
    const sols = await reno.fetchSolicitudesReno('PENDIENTE');
    body.innerHTML = sols.length ? sols.map(s=>`
      <div class="fcard" style="margin-bottom:10px" data-id="${s.id}">
        <div class="liqrow"><span><b>${s.cliente}</b></span><b>${s.tipo}</b></div>
        <div class="liqrow"><span>Ejecutivo</span><b>${s.ejecutivo||'—'}</b></div>
        <div class="liqrow"><span>Saldo actual</span><b class="num">${money(s.saldo_actual)}</b></div>
        <div class="liqrow"><span>Monto nuevo</span><b class="num">${money(s.monto_nuevo)} · ${s.plazo} ${String(s.frecuencia||'').toLowerCase()}</b></div>
        <div class="liqrow hl"><span>Abono</span><b class="num">${money(s.abono_puntual)}</b></div>
        <div style="display:flex;gap:8px;margin-top:8px"><button class="btn-primary s-ap" style="flex:1;background:var(--green);margin:0">Autorizar</button><button class="btn-primary s-rj" style="flex:1;background:var(--red);margin:0">Rechazar</button></div>
      </div>`).join('') : '<div class="note">No hay solicitudes pendientes.</div>';
    sols.forEach(s=>{
      const card=body.querySelector(`[data-id="${s.id}"]`); if(!card) return;
      card.querySelector('.s-ap').addEventListener('click', async ()=>{ if(!confirm('¿Autorizar '+s.tipo.toLowerCase()+' de '+s.cliente+'? Entrará a Tubería como "Listo para Surtir".')) return; try{ const r=await reno.aprobarSolicitudReno(s,perfil); PROSPECTOS=null; alert(r.msg); renderSolicitudes(); }catch(e){ alert('❌ '+e.message); } });
      card.querySelector('.s-rj').addEventListener('click', async ()=>{ const m=prompt('Motivo:'); if(m===null) return; try{ const r=await reno.rechazarSolicitudReno(s,m,perfil); alert(r.msg); renderSolicitudes(); }catch(e){ alert('❌ '+e.message); } });
    });
  }

  render();
}
