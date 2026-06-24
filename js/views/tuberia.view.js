// Vista Tubería — Cotizador + Pipeline de prospectos + ficha. Todo en el web.
import { el, money } from '../lib/dom.js';
import { cotizar, TIPOS_CREDITO, FRECUENCIAS } from '../services/cotizador.service.js';
import { construirPipeline, dashboardTuberia, ETAPAS, siguienteEtapa } from '../services/tuberia.service.js';
import * as repo from '../repositories/tuberia.repo.js';

export async function abrirTuberia(perfil) {
  const ov = el(`<div class="overlay"><div class="ohead"><button class="back">←</button><div class="ot">Tubería</div></div><div class="ocontent"><div class="loader">Cargando…</div></div></div>`);
  document.body.appendChild(ov);
  const c = ov.querySelector('.ocontent');
  ov.querySelector('.back').addEventListener('click', () => ov.remove());
  let TAB = 'PIPELINE', soloMios = perfil.rol === 'EJECUTIVO';
  let ultimaCot = null;

  function tabs() {
    return `<div class="vtabs" style="display:flex;gap:6px;margin-bottom:12px">
      <button class="t-pipe" style="flex:1;padding:8px;border-radius:14px;border:1px solid var(--line);background:${TAB==='PIPELINE'?'var(--navy)':'#fff'};color:${TAB==='PIPELINE'?'#fff':'var(--navy)'};font-weight:700;cursor:pointer">Pipeline</button>
      <button class="t-coti" style="flex:1;padding:8px;border-radius:14px;border:1px solid var(--line);background:${TAB==='COTIZA'?'var(--navy)':'#fff'};color:${TAB==='COTIZA'?'#fff':'var(--navy)'};font-weight:700;cursor:pointer">Cotizador</button>
    </div>`;
  }
  function wireTabs() {
    c.querySelector('.t-pipe').addEventListener('click', ()=>{ TAB='PIPELINE'; render(); });
    c.querySelector('.t-coti').addEventListener('click', ()=>{ TAB='COTIZA'; render(); });
  }

  async function render() {
    c.innerHTML = tabs() + '<div id="tb-body"><div class="loader">Cargando…</div></div>';
    wireTabs();
    const body = c.querySelector('#tb-body');
    if (TAB === 'COTIZA') return renderCotizador(body);
    return renderPipeline(body);
  }

  // ── COTIZADOR ──
  function renderCotizador(body) {
    body.innerHTML = `
      <label class="alab">Monto</label><input class="inp" id="co-monto" inputmode="decimal">
      <label class="alab">Tipo de crédito</label><select class="inp" id="co-tipo">${TIPOS_CREDITO.map(t=>`<option>${t}</option>`).join('')}</select>
      <label class="alab">Frecuencia</label><select class="inp" id="co-freq">${FRECUENCIAS.map(f=>`<option>${f}</option>`).join('')}</select>
      <label class="alab">Plazo (número de pagos)</label><input class="inp" id="co-plazo" inputmode="numeric" value="10">
      <label class="alab">Comisión</label>
      <div style="display:flex;gap:8px"><select class="inp" id="co-ctipo" style="flex:0 0 110px"><option value="PCT">%</option><option value="FIJO">$ fijo</option></select>
        <input class="inp" id="co-cval" inputmode="decimal" placeholder="valor" style="flex:1"></div>
      <label style="display:flex;align-items:center;gap:8px;font-size:.84em;margin:10px 0;cursor:pointer"><input type="checkbox" id="co-fin" style="width:16px;height:16px"> Comisión financiada (sumada al crédito)</label>
      <label style="display:flex;align-items:center;gap:8px;font-size:.84em;margin-bottom:10px;cursor:pointer"><input type="checkbox" id="co-reno" style="width:16px;height:16px"> Renovación (con adeudo)</label>
      <div id="co-renoWrap" style="display:none"><label class="alab">Adeudo actual</label><input class="inp" id="co-adeudo" inputmode="decimal"></div>
      <button class="btn-primary" id="co-calc">Calcular</button>
      <div id="co-result" style="margin-top:14px"></div>`;
    const reno = body.querySelector('#co-reno'), renoWrap = body.querySelector('#co-renoWrap');
    reno.addEventListener('change', ()=>{ renoWrap.style.display = reno.checked ? 'block':'none'; });
    body.querySelector('#co-calc').addEventListener('click', ()=>{
      try {
        const cot = cotizar({
          monto:body.querySelector('#co-monto').value, tipo:body.querySelector('#co-tipo').value,
          frecuencia:body.querySelector('#co-freq').value, plazo:body.querySelector('#co-plazo').value,
          comisionTipo:body.querySelector('#co-ctipo').value, comisionValor:body.querySelector('#co-cval').value,
          financiar:body.querySelector('#co-fin').checked, adeudo: reno.checked ? body.querySelector('#co-adeudo').value : 0,
        });
        ultimaCot = cot;
        body.querySelector('#co-result').innerHTML = `
          <div class="fcard">
            <div class="liqrow"><span>Comisión (${cot.isFixed?'fija':cot.pctComision+'%'} · ${cot.financiar?'sumada':'descontada'})</span><b class="num">${money(cot.comision)}</b></div>
            <div class="liqrow"><span>Base a financiar</span><b class="num">${money(cot.montoBaseDeuda)}</b></div>
            <div class="liqrow hl"><span>${reno.checked?'Recibe (depósito − adeudo)':'Depósito al cliente'}</span><b class="num" style="color:var(--green)">${money(reno.checked?cot.recibe:cot.deposito)}</b></div>
            <div class="liqrow"><span>Abono puntual</span><b class="num">${money(cot.abonoPuntual)}</b></div>
            <div class="liqrow"><span>Abono impuntual</span><b class="num" style="color:var(--gold)">${money(cot.abonoImpuntual)}</b></div>
          </div>
          <button class="btn-primary" id="co-guardar" style="margin-top:10px;background:var(--green)">Guardar como prospecto</button>`;
        body.querySelector('#co-guardar').addEventListener('click', ()=>formProspecto(cot));
      } catch(e){ body.querySelector('#co-result').innerHTML = `<div class="login-err" style="display:block">${e.message}</div>`; }
    });
  }

  function formProspecto(cot) {
    const sub = el(`<div class="overlay"><div class="ohead"><button class="back">←</button><div class="ot">Nuevo prospecto</div></div>
      <div class="ocontent">
        <div class="note" style="margin-bottom:10px">${cot.tipo} · ${money(cot.monto)} · ${cot.plazo} pagos ${cot.frecuencia} · abono ${money(cot.abonoPuntual)}</div>
        <label class="alab">Nombre *</label><input class="inp" id="p-nom">
        <label class="alab">Teléfono</label><input class="inp" id="p-tel" inputmode="tel">
        <label class="alab">Sucursal</label><input class="inp" id="p-suc" value="GDL">
        ${perfil.rol!=='EJECUTIVO'?`<label class="alab">Ejecutivo</label><input class="inp" id="p-ejec" placeholder="CESAR / LORENA">`:''}
        <label class="alab">Colonia</label><input class="inp" id="p-col">
        <label class="alab">Notas</label><input class="inp" id="p-notas">
        <button class="btn-primary" id="p-go">Crear prospecto</button><div class="login-err" id="p-e"></div></div></div>`);
    document.body.appendChild(sub);
    sub.querySelector('.back').addEventListener('click', ()=>sub.remove());
    sub.querySelector('#p-go').addEventListener('click', async ()=>{
      const d = { nombre:sub.querySelector('#p-nom').value, telefono:sub.querySelector('#p-tel').value, sucursal:sub.querySelector('#p-suc').value,
        ejecutivo: sub.querySelector('#p-ejec') ? sub.querySelector('#p-ejec').value : perfil.ejecutivo, colonia:sub.querySelector('#p-col').value, notas:sub.querySelector('#p-notas').value };
      try { const res = await repo.crearProspecto(d, cot, perfil); alert(res.msg); sub.remove(); TAB='PIPELINE'; render(); }
      catch(e){ const er=sub.querySelector('#p-e'); er.textContent=e.message; er.style.display='block'; }
    });
  }

  // ── PIPELINE ──
  async function renderPipeline(body) {
    const prospectos = await repo.fetchProspectos();
    const p = construirPipeline(prospectos, perfil.rol, perfil.ejecutivo, soloMios);
    const dash = dashboardTuberia(soloMios||perfil.rol==='EJECUTIVO' ? p.lista : prospectos);
    body.innerHTML = `
      <div class="kpis">
        <div class="kcard"><div class="klab">En pipeline</div><div class="kval num">${p.activos}</div><div class="kfoot">${money(p.montoEnPipeline)} en proceso</div></div>
        <div class="kcard"><div class="klab">Conversión</div><div class="kval num green">${dash.conversion}%</div><div class="kfoot">${dash.surtidos} surtidos</div></div>
      </div>
      ${perfil.rol!=='EJECUTIVO'?`<label style="display:flex;align-items:center;gap:8px;font-size:.84em;margin-bottom:10px;cursor:pointer"><input type="checkbox" id="tb-mios" ${soloMios?'checked':''} style="width:16px;height:16px"> Solo mis prospectos</label>`:''}
      ${ETAPAS.map(et=> p.porEtapa[et].length ? `
        <div class="sec-h"><span class="t">${et} (${p.porEtapa[et].length})</span><span class="ln"></span></div>
        ${p.porEtapa[et].map(x=>`<div class="cli" data-id="${x.id}">
          <div><div class="nm">${x.nombre}</div><div class="mt">${x.tipo} ${money(x.monto)} · ${x.plazo} ${x.frecuencia}${x.ejecutivo?(' · '+x.ejecutivo):''}</div></div>
          <div class="bc-n">›</div></div>`).join('')}` : '').join('')}
      ${(p.cerrados.Rechazado.length||p.cerrados.Cancelado.length)?`<div class="sec-h"><span class="t">Cerrados</span><span class="ln"></span></div>
        ${[...p.cerrados.Rechazado,...p.cerrados.Cancelado].map(x=>`<div class="cli" data-id="${x.id}" style="opacity:.55"><div><div class="nm">${x.nombre}</div><div class="mt">${x.status} · ${x.tipo} ${money(x.monto)}</div></div></div>`).join('')}`:''}
      ${!p.total?'<div class="note">No hay prospectos. Usa el Cotizador para crear uno.</div>':''}`;
    const mios = body.querySelector('#tb-mios');
    if (mios) mios.addEventListener('change', ()=>{ soloMios = mios.checked; render(); });
    body.querySelectorAll('.cli[data-id]').forEach(card => card.addEventListener('click', ()=>{
      const x = prospectos.find(z=>String(z.id)===card.dataset.id); if (x) verProspecto(x);
    }));
  }

  function verProspecto(pr) {
    const sig = siguienteEtapa(pr.status);
    const cerrado = ['Surtidos','Rechazado','Cancelado'].includes(pr.status);
    const sub = el(`<div class="overlay"><div class="ohead"><button class="back">←</button><div class="ot">${pr.nombre}</div></div>
      <div class="ocontent">
        <div class="fcard">
          <div class="liqrow"><span>Folio</span><b>${pr.prospect_id||'—'}</b></div>
          <div class="liqrow"><span>Estatus</span><b>${pr.status}</b></div>
          <div class="liqrow"><span>Tipo / monto</span><b class="num">${pr.tipo} · ${money(pr.monto)}</b></div>
          <div class="liqrow"><span>Plazo</span><b>${pr.plazo} ${pr.frecuencia}</b></div>
          <div class="liqrow"><span>Comisión</span><b class="num">${money(pr.comision)} ${pr.financiar?'(financiada)':'(descontada)'}</b></div>
          <div class="liqrow hl"><span>${pr.tipo_cliente==='RENOVACION'?'Recibe (− adeudo)':'Depósito'}</span><b class="num">${money(pr.tipo_cliente==='RENOVACION'?(pr.deposito-(pr.adeudo_actual||0)):pr.deposito)}</b></div>
          <div class="liqrow"><span>Abono puntual</span><b class="num">${money(pr.abono_puntual)}</b></div>
          ${pr.telefono?`<div class="liqrow"><span>Teléfono</span><b>${pr.telefono}</b></div>`:''}
          ${pr.ejecutivo?`<div class="liqrow"><span>Ejecutivo</span><b>${pr.ejecutivo}</b></div>`:''}
        </div>
        ${pr.enviado_cartera?'<div class="note" style="border-color:var(--green);margin-bottom:10px">✅ Ya está en cartera con su calendario.</div>':''}
        ${!cerrado?`<div style="display:flex;gap:8px;flex-wrap:wrap">
          ${sig?`<button class="btn-primary" id="pr-av" style="flex:1;min-width:130px">${sig==='Surtidos'?'Surtir → a cartera':'Avanzar: '+sig}</button>`:''}
          <button class="btn-primary" id="pr-rj" style="flex:1;min-width:120px;background:var(--red)">Rechazar</button>
        </div>`:''}
      </div></div>`);
    document.body.appendChild(sub);
    sub.querySelector('.back').addEventListener('click', ()=>sub.remove());
    const recargar = ()=>{ sub.remove(); render(); };
    const av = sub.querySelector('#pr-av');
    if (av) av.addEventListener('click', async ()=>{
      if (sig==='Surtidos' && !confirm('¿Surtir y enviar a cartera? Se creará el cliente con su calendario.')) return;
      try { const r = await repo.avanzar(pr, perfil); alert(r.msg); recargar(); } catch(e){ alert('❌ '+e.message); }
    });
    const rj = sub.querySelector('#pr-rj');
    if (rj) rj.addEventListener('click', async ()=>{
      const m = prompt('Motivo del rechazo:'); if (m===null) return;
      try { const r = await repo.rechazar(pr, m, perfil); alert(r.msg); recargar(); } catch(e){ alert('❌ '+e.message); }
    });
  }

  render();
}
