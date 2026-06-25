// Vista Cobranza (réplica de la pantalla del Script).
// KPIs + casos en revisión (gerente/admin) + lista por ejecutivo.
// Por cliente: panel de gestión (comentarios+estado, escalar con checklist, visita, historial).
import { el, money } from '../lib/dom.js';
import { fetchCartera, fetchAllCalendarios } from '../repositories/clientes.repo.js';
import { agruparCalendario } from '../services/clientes.service.js';
import { construirCobranza, colorBucket, COB_ESTADOS, COB_SALIDAS, COB_SALIDA_LABEL } from '../services/cobranza.service.js';
import { construirCxC } from '../services/cuentas.service.js';
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
  const cxc = construirCxC(cartera, calBy, perfil.rol, perfil.ejecutivo);

  function reload(){ renderCobranza(perfil).then(n => { const v = root.parentNode; if (v) v.replaceChild(n, root); }); }

  // ── Colores y etiquetas estilo Script (paleta banco) ──
  const COLOR = { 'prox':'var(--steel)', '7':'var(--green)', '15':'var(--amber)', '30':'var(--amber)', '45':'var(--red)', '45+':'var(--red)' };
  const ETIQ  = { '7':'1-7d', '15':'8-15d', '30':'16-30d', '45':'31-45d', '45+':'45+d' };
  function colCli(c){ if (c.esPreventivo) return 'var(--steel)'; if (!c.pasoGracia) return 'var(--green)'; if (c.bucket==='45'||c.bucket==='45+') return 'var(--red)'; return 'var(--amber)'; }
  const dot = col => `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${col};vertical-align:middle"></span>`;

  let EJEC_SEL = null, BUSCA = '', BUCKET = '', ORDEN = 'bucket';

  const revisionHTML = (casos && casos.length) ? `
    <div class="rev-banner" style="margin-bottom:12px"><b>En revisión con gerencia · ${casos.length}</b>
      ${casos.map(c => `<div style="display:flex;justify-content:space-between;align-items:center;padding:7px 0;border-top:1px solid rgba(0,0,0,.08)"><div style="min-width:0"><b>${c.cliente}</b><div style="font-size:.72em;color:var(--slate)">${c.ejecutivo||'(sin ejec.)'} · escaló ${c.escalo||''}</div></div>${['ADMIN','GERENTE'].includes(perfil.rol)?`<button class="btn-mini-resolver" data-rev="${c.id}">Resolver</button>`:''}</div>`).join('')}
    </div>` : '';

  const porCobrarHTML = `
    <div class="sec-h"><span class="t">Por cobrar (cartera)</span><span class="ln"></span></div>
    <div class="fcard">
      <div class="liqrow"><span>Total por cobrar</span><b class="num">${money(cxc.total)}</b></div>
      <div class="liqrow"><span>Vigente</span><b class="num">${money(cxc.vigente)}</b></div>
      <div class="liqrow"><span>1–7 días</span><b class="num">${money(cxc.buckets['1-7'])}</b></div>
      <div class="liqrow"><span>8–15 días</span><b class="num">${money(cxc.buckets['8-15'])}</b></div>
      <div class="liqrow"><span>16–30 días</span><b class="num">${money(cxc.buckets['16-30'])}</b></div>
      <div class="liqrow hl"><span>+30 días</span><b class="num" style="color:var(--red)">${money(cxc.buckets['+30'])}</b></div>
    </div>`;

  const BUCKETS_OPT = [['','Antigüedad: todas'],['prox','Próximos (3 días)'],['7','1-7 días'],['15','8-15 días'],['30','16-30 días'],['45','31-45 días'],['45+','45+ días']];
  const ORDEN_OPT = [['bucket','Próximos primero'],['monto-desc','Monto ↓'],['monto-asc','Monto ↑'],['dias-desc','Días ↓']];

  root.innerHTML = `
    <div id="cob-esc">${revisionHTML}</div>
    <div style="display:flex;gap:7px;flex-wrap:wrap;margin-bottom:12px">
      <input class="inp" id="cob-busca" placeholder="Buscar cliente" style="flex:1;min-width:130px;margin:0">
      <select class="inp" id="cob-bucket" style="width:auto;margin:0">${BUCKETS_OPT.map(([v,t])=>`<option value="${v}">${t}</option>`).join('')}</select>
      <select class="inp" id="cob-orden" style="width:auto;margin:0">${ORDEN_OPT.map(([v,t])=>`<option value="${v}">${t}</option>`).join('')}</select>
    </div>
    <div class="kpis" style="grid-template-columns:1fr 1fr;margin-bottom:14px">
      <div class="kcard"><div class="klab">Vencido total</div><div class="kval num" style="color:var(--red)">${money(kpis.totalVencido)}</div></div>
      <div class="kcard"><div class="klab">Clientes vencidos</div><div class="kval num">${kpis.totalClientes}</div></div>
      <div class="kcard"><div class="klab">Crítico 45+</div><div class="kval num" style="color:var(--red)">${money(kpis.critico45)}</div></div>
      <div class="kcard"><div class="klab">Ejecutivos</div><div class="kval num">${kpis.nEjecutivos}</div></div>
    </div>
    <div id="cob-body"></div>
    <div style="margin-top:16px">${porCobrarHTML}</div>`;

  const body = root.querySelector('#cob-body');

  function pintar(){
    if (EJEC_SEL) return pintarDetalle();
    const q = BUSCA.toLowerCase();
    let html = '';
    ejecutivos.forEach(e => {
      let cls = e.clientes;
      if (q) cls = cls.filter(c => c.nombre.toLowerCase().includes(q));
      if (BUCKET) cls = cls.filter(c => c.bucket === BUCKET);
      if ((q || BUCKET) && !cls.length) return;
      const esJur = e.ejecutivo.toUpperCase() === 'JURIDICO' && perfil.rol !== 'JURIDICO';
      const max = Object.values(e.buckets).reduce((a,b)=>a+b,0) || 1;
      let barra=''; ['7','15','30','45','45+'].forEach(b=>{ const w=e.buckets[b]/max*100; if(w>0) barra+=`<div style="width:${w}%;background:${COLOR[b]}"></div>`; });
      let chips=''; ['7','15','30','45','45+'].forEach(b=>{ if(e.buckets[b]>0) chips+=`<span style="margin-right:10px;white-space:nowrap">${dot(COLOR[b])} ${ETIQ[b]}: ${e.buckets[b]}</span>`; });
      html += `<div class="fcard cob-ejec" data-ej="${enc(e.ejecutivo)}" style="cursor:${esJur?'default':'pointer'};margin-bottom:10px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:9px">
          <div style="display:flex;align-items:center;gap:9px"><div style="width:34px;height:34px;border-radius:50%;background:var(--bg);display:flex;align-items:center;justify-content:center;font-weight:800;font-size:.8em;color:var(--navy)">${esJur?'JU':e.ejecutivo.slice(0,2).toUpperCase()}</div>
            <div><div style="font-weight:800">${e.ejecutivo}</div><div style="font-size:.72em;color:var(--slate)">${e.nClientes} clientes vencidos</div></div></div>
          <div style="text-align:right"><div class="num" style="font-size:1.1em;font-weight:800">${money(e.totalVencido)}</div><div style="font-size:.68em;color:var(--slate)">vencido</div></div>
        </div>
        <div style="display:flex;height:8px;border-radius:4px;overflow:hidden;margin-bottom:6px;background:var(--bg)">${barra}</div>
        <div style="font-size:.72em;color:var(--slate)">${chips}<span style="float:right;color:${esJur?'var(--slate)':'var(--steel)'};font-weight:700">${esJur?'Ver en Jurídico':'Ver clientes ▾'}</span></div>
      </div>`;
    });
    body.innerHTML = html || '<div class="note">No hay clientes en cobranza con ese filtro.</div>';
    body.querySelectorAll('.cob-ejec').forEach(card => card.addEventListener('click', () => {
      const ej = dec(card.dataset.ej);
      if (ej.toUpperCase() === 'JURIDICO' && perfil.rol !== 'JURIDICO') return;
      EJEC_SEL = ej; pintar();
    }));
  }

  function pintarDetalle(){
    const e = ejecutivos.find(x => x.ejecutivo === EJEC_SEL);
    if (!e) { EJEC_SEL = null; return pintar(); }
    const q = BUSCA.toLowerCase();
    let cls = e.clientes.slice();
    if (q) cls = cls.filter(c => c.nombre.toLowerCase().includes(q));
    if (BUCKET) cls = cls.filter(c => c.bucket === BUCKET);
    if (ORDEN === 'monto-asc') cls.sort((a,b)=>a.vencido-b.vencido);
    else if (ORDEN === 'monto-desc') cls.sort((a,b)=>b.vencido-a.vencido);
    else if (ORDEN === 'dias-desc') cls.sort((a,b)=>b.dias-a.dias);
    else cls.sort((a,b)=>{ const da=a.esPreventivo?a.dias-100:a.dias, db=b.esPreventivo?b.dias-100:b.dias; return da-db; });
    let html = `<div style="display:flex;align-items:center;gap:8px;margin-bottom:12px"><button id="cob-volver" style="background:var(--bg);border:none;border-radius:8px;padding:6px 12px;font-weight:700;cursor:pointer;color:var(--navy)">← Ejecutivos</button><div style="font-weight:800">${e.ejecutivo}</div><div class="num" style="margin-left:auto;font-weight:800;color:var(--red)">${money(e.totalVencido)}</div></div>`;
    html += cls.map(c => {
      const col = colCli(c);
      const etiqueta = c.esPreventivo ? `Vence en ${Math.abs(c.dias)}d${c.proxPago?(' · '+c.proxPago):''}` : `${c.dias} días de atraso`;
      const monto = c.esPreventivo ? (c.porVencer||0) : c.vencido;
      return `<div class="fcard cob-cli" data-n="${enc(c.nombre)}" data-m="${monto}" style="border-left:4px solid ${col};cursor:pointer;margin-bottom:8px">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <div style="min-width:0"><div style="font-weight:800">${c.nombre}</div><div style="font-size:.72em;color:var(--slate)">${etiqueta} · comentarios</div></div>
          <div class="num" style="font-weight:800;color:${col}">${money(monto)}</div>
        </div></div>`;
    }).join('') || '<div class="note">Sin clientes con ese filtro.</div>';
    body.innerHTML = html;
    body.querySelector('#cob-volver').addEventListener('click', () => { EJEC_SEL = null; pintar(); });
    body.querySelectorAll('.cob-cli').forEach(card => card.addEventListener('click', () =>
      abrirGestion(dec(card.dataset.n), Number(card.dataset.m)||0, perfil, reload)));
  }

  root.querySelector('#cob-busca').addEventListener('input', ev => { BUSCA = ev.target.value.trim(); pintar(); });
  root.querySelector('#cob-bucket').addEventListener('change', ev => { BUCKET = ev.target.value; pintar(); });
  root.querySelector('#cob-orden').addEventListener('change', ev => { ORDEN = ev.target.value; pintar(); });
  root.querySelectorAll('.btn-mini-resolver').forEach(b => b.addEventListener('click', ev => {
    ev.stopPropagation();
    const caso = casos.find(c => String(c.id) === b.dataset.rev);
    if (caso) abrirResolver(caso, perfil, reload);
  }));

  pintar();
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
