// Vista Tubería — flujo completo: cotizador en vivo, WhatsApp, reno/react con solicitud,
// evaluación de riesgo, pipeline, surtir con reparto de bancos, avisos por etapa.
import { el, money } from '../lib/dom.js';
import { cotizar, FRECUENCIAS } from '../services/cotizador.service.js';
import { construirPipeline, dashboardTuberia, ETAPAS, siguienteEtapa } from '../services/tuberia.service.js';
import { PREGUNTAS, calcularScore, clasificar } from '../services/evaluacion.service.js';
import { calcularSurtimiento } from '../services/surtir.service.js';
import { candidatosReno } from '../services/reno.service.js';
import { avisoPorEtapa, linkWhatsApp } from '../services/notificaciones.service.js';
import * as repo from '../repositories/tuberia.repo.js';
import * as reno from '../repositories/reno.repo.js';
import { fetchBancos } from '../repositories/bancos.repo.js';

const TIPOS = [['PERSONAL','Personal (10.7%)'],['CONVENIO','Convenio (2.0%)'],['GOBIERNO','Gobierno/Negocio (10%)'],['AMERICANO','Americano (10-15%)']];
const PLAZOS = [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,20,24];
const EJECUTIVOS = ['CESAR','LORENA','EDUARDO','PACO','TABATA','JORGE','HUGO','LAURA'];
const MUNICIPIOS = ['GUADALAJARA','ZAPOPAN','TLAQUEPAQUE','TONALA'];

export async function abrirTuberia(perfil) {
  const esGerencia = ['ADMIN','GERENTE'].includes(perfil.rol);
  const ov = el(`<div class="overlay"><div class="ohead"><button class="back">←</button><div class="ot">Tubería</div></div><div class="ocontent"></div></div>`);
  document.body.appendChild(ov);
  const root = ov.querySelector('.ocontent');
  ov.querySelector('.back').addEventListener('click', () => ov.remove());

  let TAB='COTIZA', soloMios = perfil.rol==='EJECUTIVO', cot=null;

  function render() {
    root.innerHTML = `
      <div style="display:flex;gap:6px;margin-bottom:14px;flex-wrap:wrap">
        ${[['COTIZA','Cotizador'],['PIPE','Pipeline'],...(esGerencia?[['SOL','Solicitudes']]:[])].map(([k,t])=>
          `<button class="tb-tab" data-t="${k}" style="flex:1;min-width:90px;padding:9px;border-radius:14px;border:1px solid var(--line);background:${TAB===k?'var(--navy)':'#fff'};color:${TAB===k?'#fff':'var(--navy)'};font-weight:700;cursor:pointer">${t}</button>`).join('')}
      </div><div id="tb-body"></div>`;
    root.querySelectorAll('.tb-tab').forEach(b=>b.addEventListener('click',()=>{ TAB=b.dataset.t; render(); }));
    if (TAB==='COTIZA') renderCotizador();
    else if (TAB==='PIPE') renderPipeline();
    else renderSolicitudes();
  }

  // ═══════════ COTIZADOR (en vivo) ═══════════
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
        const ct=$('#c-ctipo').value;
        cot = cotizar({ monto:$('#c-monto').value, tipo:$('#c-tipo').value, frecuencia:$('#c-freq').value, plazo:$('#c-plazo').value, comisionTipo:ct, comisionValor:$('#c-cval').value, financiar:$('#c-fin').checked });
        $('#c-res').innerHTML = `
          <div class="fcard" style="margin-top:12px">
            <div style="text-align:center;margin-bottom:10px"><div style="font-size:.7em;color:var(--steel);text-transform:uppercase;letter-spacing:1px">Abono puntual</div><div class="num" style="font-size:2.4em;font-weight:800;color:var(--navy)">${money(cot.abonoPuntual)}</div></div>
            <div class="liqrow"><span>Comisión ${cot.isFixed?'(fija)':'('+cot.pctComision+'%)'}</span><b class="num">${money(cot.comision)}</b></div>
            <div class="liqrow"><span>Interés generado</span><b class="num">${money(cot.interesPuntual)}</b></div>
            <div class="liqrow hl"><span>Depósito al cliente</span><b class="num" style="color:var(--green)">${money(cot.deposito)}</b></div>
            <div class="liqrow"><span>Total deuda puntual</span><b class="num">${money(cot.totalPuntual)}</b></div>
            <div class="liqrow"><span>Total deuda impuntual</span><b class="num" style="color:var(--red)">${money(cot.totalImpuntual)}</b></div>
            <div class="liqrow"><span>Abono si paga tarde</span><b class="num" style="color:var(--gold)">${money(cot.abonoImpuntual)}</b></div>
          </div>
          <div style="display:flex;gap:8px;margin-top:10px">
            <button class="btn-primary" id="c-wa" style="flex:1;background:#25D366">Compartir WhatsApp</button>
            <button class="btn-primary" id="c-cont" style="flex:1">Continuar →</button>
          </div>`;
        $('#c-wa').addEventListener('click',()=>compartirWhatsApp(cot));
        $('#c-cont').addEventListener('click',()=>renderProspecto());
      } catch(e){ $('#c-res').innerHTML = `<div class="note" style="margin-top:12px;border-color:var(--red);color:var(--red)">${e.message}</div>`; }
    };
    ['#c-monto','#c-tipo','#c-freq','#c-plazo','#c-ctipo','#c-cval','#c-fin'].forEach(s=>{ const e=$(s); e.addEventListener('input',recalc); e.addEventListener('change',recalc); });
  }

  function compartirWhatsApp(c) {
    const txt = `*COTIZACIÓN MONEYCASH* 💰\n\n📋 *CRÉDITO*\nTipo: ${c.tipo}\nMonto: ${money(c.monto)}\nPlazo: ${c.plazo} ${c.frecuencia.toLowerCase()}\nTasa: ${(c.tasaPuntual*100).toFixed(1)}%\n\n💰 *DETALLE*\nComisión: ${money(c.comision)} ${c.financiar?'(sumada)':'(descontada)'}\nRecibe el cliente: ${money(c.deposito)}\n\n📅 *ABONOS*\n✅ Puntual: ${money(c.abonoPuntual)}\n⚠️ Impuntual: ${money(c.abonoImpuntual)}\n\n📊 Total puntual: ${money(c.totalPuntual)}\n\n⏰ Válida por 7 días`;
    const url = linkWhatsApp('+52', txt).replace('wa.me/52?','wa.me/?'); // wa.me sin número abre selector de contacto
    window.open('https://wa.me/?text='+encodeURIComponent(txt), '_blank');
  }

  // ═══════════ PÁGINA 2: DATOS / SOLICITUD ═══════════
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
    const tc=$('#p-tc');
    tc.addEventListener('change',()=>pintarForm(tc.value));
    pintarForm('NUEVO');

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
      try {
        const d = { tipo, cliente:cliente.nombre, ejecutivo:ejec, saldo:cliente.saldo, capital:cliente.capital };
        const r = await reno.crearSolicitudReno(d, cot, perfil);
        alert(r.msg); TAB='PIPE'; render();
      } catch(e){ err(f, e.message); }
    }
    async function crearNuevo() {
      const nombre=$('#p-nom').value.trim(), ejec=$('#p-ejec').value;
      if (!nombre) return err($('#p-form'),'Indica el nombre.');
      if (!ejec) return err($('#p-form'),'Selecciona el ejecutivo.');
      const d={ nombre, telefono:$('#p-tel').value, sucursal:$('#p-suc').value, ejecutivo:ejec, colonia:$('#p-col').value, municipio:$('#p-muni').value };
      try { const r=await repo.crearProspecto(d, cot, perfil); alert(r.msg); TAB='PIPE'; render(); } catch(e){ err($('#p-form'), e.message); }
    }
    function err(scope, msg){ const e=scope.querySelector('#p-err'); if(e){ e.innerHTML=`<div class="note" style="border-color:var(--red);color:var(--red);margin-top:8px">${msg}</div>`; } else alert(msg); }
  }

  // ═══════════ PIPELINE ═══════════
  async function renderPipeline() {
    const body = root.querySelector('#tb-body');
    body.innerHTML = '<div class="loader">Cargando…</div>';
    const prospectos = await repo.fetchProspectos();
    const p = construirPipeline(prospectos, perfil.rol, perfil.ejecutivo, soloMios);
    const dash = dashboardTuberia((soloMios||perfil.rol==='EJECUTIVO')?p.lista:prospectos);
    body.innerHTML = `
      <div class="kpis">
        <div class="kcard"><div class="klab">En pipeline</div><div class="kval num">${p.activos}</div><div class="kfoot">${money(p.montoEnPipeline)} en proceso</div></div>
        <div class="kcard"><div class="klab">Conversión</div><div class="kval num green">${dash.conversion}%</div><div class="kfoot">${dash.surtidos} surtidos</div></div>
      </div>
      ${perfil.rol!=='EJECUTIVO'?`<label style="display:flex;align-items:center;gap:8px;font-size:.84em;margin-bottom:10px;cursor:pointer"><input type="checkbox" id="tb-mios" ${soloMios?'checked':''} style="width:16px;height:16px"> Solo mis prospectos</label>`:''}
      ${ETAPAS.map(et=> p.porEtapa[et].length?`<div class="sec-h"><span class="t">${et} (${p.porEtapa[et].length})</span><span class="ln"></span></div>${p.porEtapa[et].map(x=>cardP(x)).join('')}`:'').join('')}
      ${(p.cerrados.Rechazado.length||p.cerrados.Cancelado.length)?`<div class="sec-h"><span class="t">Cerrados</span><span class="ln"></span></div>${[...p.cerrados.Rechazado,...p.cerrados.Cancelado].map(x=>cardP(x,true)).join('')}`:''}
      ${!p.total?'<div class="note">No hay prospectos. Usa el Cotizador para crear uno.</div>':''}`;
    const mios=body.querySelector('#tb-mios');
    if (mios) mios.addEventListener('change',()=>{ soloMios=mios.checked; render(); });
    body.querySelectorAll('.cli[data-id]').forEach(card=>card.addEventListener('click',()=>{ const x=prospectos.find(z=>String(z.id)===card.dataset.id); if(x) verProspecto(x); }));
  }
  function cardP(x, cerrado){ return `<div class="cli" data-id="${x.id}" ${cerrado?'style="opacity:.55"':''}><div><div class="nm">${x.nombre}</div><div class="mt">${cerrado?x.status+' · ':''}${x.tipo} ${money(x.monto)}${!cerrado?' · '+x.plazo+' '+x.frecuencia.toLowerCase():''}${x.ejecutivo?(' · '+x.ejecutivo):''}${x.score!=null?' · score '+x.score:''}</div></div>${!cerrado?'<div class="bc-n">›</div>':''}</div>`; }

  function verProspecto(pr) {
    const sig = siguienteEtapa(pr.status);
    const puedeSurtir = pr.status==='Listo para Surtir' && !pr.enviado_cartera;
    const puedeEval = !['Surtidos','Rechazado','Cancelado'].includes(pr.status);
    const recibe = pr.tipo_cliente==='RENOVACION' ? (pr.deposito-(pr.adeudo_actual||0)) : pr.deposito;
    const sub = el(`<div class="overlay"><div class="ohead"><button class="back">←</button><div class="ot">${pr.nombre}</div></div><div class="ocontent">
      <div class="fcard">
        <div class="liqrow"><span>Folio</span><b>${pr.prospect_id||'—'}</b></div>
        <div class="liqrow"><span>Estatus</span><b>${pr.status}</b></div>
        <div class="liqrow"><span>Tipo / monto</span><b class="num">${pr.tipo} · ${money(pr.monto)}</b></div>
        <div class="liqrow"><span>Plazo</span><b>${pr.plazo} ${pr.frecuencia.toLowerCase()} · ${pr.financiar?'financiada':'descontada'}</b></div>
        <div class="liqrow"><span>Comisión</span><b class="num">${money(pr.comision)}</b></div>
        <div class="liqrow hl"><span>${pr.tipo_cliente==='RENOVACION'?'Recibe (− saldo)':'Depósito'}</span><b class="num" style="color:var(--green)">${money(recibe)}</b></div>
        <div class="liqrow"><span>Abono puntual</span><b class="num">${money(pr.abono_puntual)}</b></div>
        ${pr.score_eval!=null?`<div class="liqrow"><span>Score evaluación</span><b class="num">${pr.score_eval} · ${clasificar(pr.score_eval).riesgo}</b></div>`:''}
        ${pr.telefono?`<div class="liqrow"><span>Teléfono</span><b>${pr.telefono}</b></div>`:''}
        ${pr.ejecutivo?`<div class="liqrow"><span>Ejecutivo</span><b>${pr.ejecutivo}</b></div>`:''}
      </div>
      ${pr.enviado_cartera?'<div class="note" style="border-color:var(--green)">✅ Ya está en cartera con su calendario.</div>':''}
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        ${puedeEval?`<button class="btn-primary" id="b-eval" style="flex:1;min-width:130px;background:#fff;color:var(--navy);border:1px solid var(--line)">Evaluación de riesgo</button>`:''}
        ${sig&&sig!=='Surtidos'?`<button class="btn-primary" id="b-av" style="flex:1;min-width:120px">Avanzar: ${sig}</button>`:''}
        ${puedeSurtir?`<button class="btn-primary" id="b-surt" style="flex:1;min-width:140px;background:var(--green)">Surtir → cartera</button>`:''}
        ${puedeEval?`<button class="btn-primary" id="b-rj" style="flex:1;min-width:110px;background:var(--red)">Rechazar</button>`:''}
      </div>
    </div></div>`);
    document.body.appendChild(sub);
    sub.querySelector('.back').addEventListener('click',()=>sub.remove());
    const recargar=()=>{ sub.remove(); render(); };
    const av=sub.querySelector('#b-av');
    if (av) av.addEventListener('click', async ()=>{ try{ const r=await repo.avanzar(pr, perfil); avisarWA(pr, siguienteEtapa(pr.status)); alert(r.msg); recargar(); }catch(e){ alert('❌ '+e.message); } });
    const ev=sub.querySelector('#b-eval'); if (ev) ev.addEventListener('click',()=>evaluacion(pr, recargar));
    const su=sub.querySelector('#b-surt'); if (su) su.addEventListener('click',()=>surtir(pr, recargar));
    const rj=sub.querySelector('#b-rj'); if (rj) rj.addEventListener('click', async ()=>{ const m=prompt('Motivo del rechazo:'); if(m===null) return; try{ const r=await repo.rechazar(pr,m,perfil); avisarWA(pr,'Rechazado'); alert(r.msg); recargar(); }catch(e){ alert('❌ '+e.message); } });
  }

  // Aviso WhatsApp opcional al avanzar de etapa
  function avisarWA(pr, etapa) {
    const a = avisoPorEtapa(pr, etapa); if (!a || !a.tel) return;
    if (confirm(`¿Avisar por WhatsApp a ${a.para}?`)) { const url=linkWhatsApp(a.tel, a.msg); if (url) window.open(url,'_blank'); }
  }

  // ── Evaluación de riesgo (cuestionario) ──
  function evaluacion(pr, recargar) {
    const prev = (pr.cotizacion_json&&pr.cotizacion_json.evaluacion&&pr.cotizacion_json.evaluacion.respuestas)||[];
    const sub = el(`<div class="overlay"><div class="ohead"><button class="back">←</button><div class="ot">Evaluación · ${pr.nombre}</div></div><div class="ocontent">
      <div id="ev-score" class="fcard" style="text-align:center"><div style="font-size:.7em;color:var(--steel);text-transform:uppercase">Score</div><div class="num" id="ev-n" style="font-size:2.2em;font-weight:800">0</div><div id="ev-cls"></div></div>
      <div id="ev-q"></div>
      <button class="btn-primary" id="ev-save" style="margin-top:12px;background:var(--green)">Guardar evaluación</button></div></div>`);
    document.body.appendChild(sub);
    sub.querySelector('.back').addEventListener('click',()=>sub.remove());
    const qWrap=sub.querySelector('#ev-q');
    qWrap.innerHTML = PREGUNTAS.map((q,i)=>{
      const a=(prev[i]&&prev[i].a)||'';
      if (q.tipo==='sino') return `<div style="margin-bottom:8px"><div style="font-size:.85em;margin-bottom:4px">${i+1}. ${q.q}${q.pts?` <span style="color:var(--steel)">(${q.pts}pts)</span>`:''}</div><select class="inp ev-i" data-i="${i}"><option value="">—</option><option ${a==='SI'?'selected':''}>SI</option><option ${a==='NO'?'selected':''}>NO</option></select></div>`;
      if (q.tipo==='select') return `<div style="margin-bottom:8px"><div style="font-size:.85em;margin-bottom:4px">${i+1}. ${q.q}</div><select class="inp ev-i" data-i="${i}"><option value="">—</option>${q.opciones.map(o=>`<option ${a===o?'selected':''}>${o}</option>`).join('')}</select></div>`;
      return `<div style="margin-bottom:8px"><div style="font-size:.85em;margin-bottom:4px">${i+1}. ${q.q}</div><input class="inp ev-i" data-i="${i}" value="${a}"></div>`;
    }).join('');
    const recompute=()=>{
      const resp=[]; sub.querySelectorAll('.ev-i').forEach(e=>{ resp[parseInt(e.dataset.i)]={a:e.value}; });
      for(let i=0;i<PREGUNTAS.length;i++) if(!resp[i]) resp[i]={a:''};
      const sc=calcularScore(resp), cl=clasificar(sc);
      sub.querySelector('#ev-n').textContent=sc;
      sub.querySelector('#ev-cls').innerHTML=`<span style="color:${cl.color};font-weight:700">${cl.nivel} · ${cl.riesgo}</span>`;
      return resp;
    };
    sub.querySelectorAll('.ev-i').forEach(e=>e.addEventListener('change',recompute));
    recompute();
    sub.querySelector('#ev-save').addEventListener('click', async ()=>{
      const resp=recompute();
      try { const r=await repo.guardarEvaluacion(pr, resp, perfil); alert('✅ Evaluación guardada. Score: '+r.score); sub.remove(); recargar(); }
      catch(e){ alert('❌ '+e.message); }
    });
  }

  // ── Surtir → reparto de bancos ──
  async function surtir(pr, recargar) {
    const sur = calcularSurtimiento(pr);
    const bancos = await fetchBancos();
    const opts = bancos.map(b=>`<option>${b.cuenta}</option>`).join('');
    const sub = el(`<div class="overlay"><div class="ohead"><button class="back">←</button><div class="ot">Surtir · ${pr.nombre}</div></div><div class="ocontent">
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
    document.body.appendChild(sub);
    sub.querySelector('.back').addEventListener('click',()=>sub.remove());
    const rows=sub.querySelector('#rep-rows');
    const addRow=(monto)=>{ const r=el(`<div style="display:flex;gap:8px;margin-bottom:8px"><select class="inp rep-c" style="flex:1">${opts}</select><input class="inp rep-m" inputmode="decimal" placeholder="monto" value="${monto||''}" style="flex:0 0 110px"><button class="rep-x" style="flex:0 0 36px;border:1px solid var(--line);background:#fff;border-radius:10px;cursor:pointer">✕</button></div>`); rows.appendChild(r); r.querySelector('.rep-x').addEventListener('click',()=>{ r.remove(); sum(); }); r.querySelector('.rep-m').addEventListener('input',sum); };
    const sum=()=>{ let s=0; rows.querySelectorAll('.rep-m').forEach(m=>s+=parseFloat(m.value)||0); sub.querySelector('#rep-sum').textContent=money(s); };
    sub.querySelector('#rep-add').addEventListener('click',()=>addRow());
    addRow(sur.objetivoReparto); sum();
    sub.querySelector('#rep-go').addEventListener('click', async ()=>{
      const reparto=[]; rows.querySelectorAll('div').forEach(()=>{}); 
      rows.querySelectorAll('.rep-c').forEach((c,i)=>{ const m=rows.querySelectorAll('.rep-m')[i]; reparto.push({ cuenta:c.value, monto:m.value }); });
      if (!confirm('¿Confirmar surtimiento? Se creará el cliente en cartera con su calendario y saldrá el dinero de los bancos.')) return;
      try { const r=await repo.enviarACartera(pr, reparto, perfil); avisarWA(pr,'Surtidos'); alert(r.msg); sub.remove(); recargar(); }
      catch(e){ alert('❌ '+e.message); }
    });
  }

  // ═══════════ SOLICITUDES DE RENO (gerente) ═══════════
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
        <div style="display:flex;gap:8px;margin-top:8px"><button class="btn-primary s-ap" style="flex:1;background:var(--green)">Autorizar</button><button class="btn-primary s-rj" style="flex:1;background:var(--red)">Rechazar</button></div>
      </div>`).join('') : '<div class="note">No hay solicitudes pendientes.</div>';
    sols.forEach(s=>{
      const card=body.querySelector(`[data-id="${s.id}"]`); if(!card) return;
      card.querySelector('.s-ap').addEventListener('click', async ()=>{ if(!confirm('¿Autorizar '+s.tipo.toLowerCase()+' de '+s.cliente+'? Entrará a Tubería como "Listo para Surtir".')) return; try{ const r=await reno.aprobarSolicitudReno(s,perfil); alert(r.msg); renderSolicitudes(); }catch(e){ alert('❌ '+e.message); } });
      card.querySelector('.s-rj').addEventListener('click', async ()=>{ const m=prompt('Motivo:'); if(m===null) return; try{ const r=await reno.rechazarSolicitudReno(s,m,perfil); alert(r.msg); renderSolicitudes(); }catch(e){ alert('❌ '+e.message); } });
    });
  }

  render();
}
