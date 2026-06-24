// Vista Jurídico — casos, estado de cuenta, abono 40/60, convenios, diligencias, bitácora.
import { el, money } from '../lib/dom.js';
import { construirCartera, construirCaso, JUR_ESTADOS } from '../services/juridico.service.js';
import * as repo from '../repositories/juridico.repo.js';
import { fetchBancos } from '../repositories/bancos.repo.js';

export async function abrirJuridico(perfil) {
  if (!['ADMIN','GERENTE','JURIDICO'].includes(perfil.rol)) { alert('Solo Jurídico/Admin/Gerente.'); return; }
  const opera = ['ADMIN','JURIDICO'].includes(perfil.rol);
  const ov = el(`<div class="overlay"><div class="ohead"><button class="back">←</button><div class="ot">Jurídico</div></div><div class="ocontent"><div class="loader">Cargando…</div></div></div>`);
  document.body.appendChild(ov);
  const c = ov.querySelector('.ocontent');
  ov.querySelector('.back').addEventListener('click', () => ov.remove());

  async function cargar() {
    c.innerHTML = '<div class="loader">Cargando…</div>';
    const [casos, bancos] = await Promise.all([repo.fetchCarteraJuridico(), fetchBancos()]);
    const r = construirCartera(casos);

    c.innerHTML = `
      <div class="kpis">
        <div class="kcard"><div class="klab">En demanda</div><div class="kval num" style="color:var(--red)">${money(r.deudaDemanda)}</div><div class="kfoot">${r.total} casos</div></div>
        <div class="kcard"><div class="klab">Próx. diligencia</div><div class="kval num">${r.proximasDiligencias.length?r.proximasDiligencias[0].cliente.split(' ')[0]:'—'}</div><div class="kfoot">${r.proximasDiligencias.length&&r.proximasDiligencias[0].diasDiligencia!=null?(r.proximasDiligencias[0].diasDiligencia<=0?'hoy/vencida':'en '+r.proximasDiligencias[0].diasDiligencia+'d'):'sin agendar'}</div></div>
      </div>
      <div class="note" style="margin-bottom:10px">${JUR_ESTADOS.map(e=>r.porEstatus[e]?`${e}: ${r.porEstatus[e]}`:'').filter(Boolean).join(' · ')||'Sin casos'}</div>
      <div class="sec-h"><span class="t">Casos</span><span class="ln"></span></div>
      ${r.casos.map(k=>`<div class="cli" data-id="${k.id}">
        <div><div class="nm">${k.cliente}</div><div class="mt">${k.estatus} · ${k.nAbonos} abonos${k.proxDiligencia?(' · diligencia '+k.proxDiligencia):''}</div></div>
        <div class="sal num">${money(k.saldoDemanda)}</div></div>`).join('') || '<div class="note">Sin casos en jurídico</div>'}`;

    c.querySelectorAll('.cli[data-id]').forEach(card => card.addEventListener('click', () => {
      const k = casos.find(x=>String(x.id)===card.dataset.id); if (k) verCaso(k, bancos);
    }));
  }

  async function verCaso(casoRow, bancos) {
    const [bit, conv, pagosConv] = await Promise.all([repo.fetchBitacora(casoRow.cliente), repo.fetchConvenios(casoRow.cliente), repo.fetchPagosConvenio(casoRow.cliente)]);
    const e = construirCaso(casoRow, bit, conv, pagosConv);
    const sub = el(`<div class="overlay"><div class="ohead"><button class="back">←</button><div class="ot">${casoRow.cliente}</div></div>
      <div class="ocontent">
        <div class="fcard">
          <div class="liqrow"><span>Estatus</span><b>${e.estatus}</b></div>
          <div class="liqrow"><span>Capital original</span><b class="num">${money(e.capitalOrig)}</b></div>
          <div class="liqrow"><span>Pagado (cap / int)</span><b class="num">${money(e.capPagado)} / ${money(e.intPagado)}</b></div>
          <div class="liqrow hl"><span>Saldo en demanda</span><b class="num">${money(e.saldoDemanda)}</b></div>
          <div class="liqrow"><span>Próxima diligencia</span><b>${e.proxDiligencia||'—'}</b></div>
        </div>
        ${opera?`<div style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn-primary" id="j-abono" style="flex:1;min-width:120px">Abono 40/60</button>
          <button class="btn-primary" id="j-conv" style="flex:1;min-width:120px;background:var(--steel)">Convenio</button>
          <button class="btn-primary" id="j-est" style="flex:1;min-width:120px;background:var(--steel)">Estatus / Diligencia</button>
          <button class="btn-primary" id="j-nota" style="flex:1;min-width:120px;background:var(--steel)">Nota</button>
        </div>`:''}
        ${e.convenio?`<div class="sec-h"><span class="t">Convenio vigente (${money(e.convenio.monto_acordado)} en ${e.convenio.num_pagos} pagos)</span><span class="ln"></span></div>
          ${e.pagosConvenio.map(p=>`<div class="pago"><div class="izq"><span class="chip ${p.estatus==='PAGADO'?'pag':'ven'}">${p.estatus==='PAGADO'?'pagado':'pago '+p.nPago}</span><span>${p.fecha}</span></div>
            <span class="num" style="font-weight:600">${money(p.monto)} ${(opera&&p.estatus!=='PAGADO')?`<button class="mini-ok" data-pc="${p.nPago}" style="width:auto;padding:3px 9px;margin-left:6px">Pagar</button>`:''}</span></div>`).join('')}`:''}
        <div class="sec-h"><span class="t">Bitácora</span><span class="ln"></span></div>
        ${e.bitacora.map(b=>`<div class="pago"><div class="izq"><span style="font-size:.72em;color:#9ab">${b.fecha}</span></div><div style="text-align:right;font-size:.85em">${b.nota}${b.autor?`<div class="mt">${b.autor}</div>`:''}</div></div>`).join('')||'<div class="note">Sin movimientos</div>'}
      </div></div>`);
    document.body.appendChild(sub);
    sub.querySelector('.back').addEventListener('click', ()=>sub.remove());
    const recargar = () => { sub.remove(); cargar(); };

    if (opera) {
      sub.querySelector('#j-abono').addEventListener('click', ()=>formAbono(casoRow, bancos, recargar));
      sub.querySelector('#j-conv').addEventListener('click', ()=>formConvenio(casoRow, recargar));
      sub.querySelector('#j-est').addEventListener('click', ()=>formEstatus(casoRow, recargar));
      sub.querySelector('#j-nota').addEventListener('click', ()=>formNota(casoRow, recargar));
      sub.querySelectorAll('[data-pc]').forEach(b=>b.addEventListener('click', async ()=>{
        const p = e.pagosConvenio.find(x=>String(x.nPago)===b.dataset.pc);
        const cuenta = bancos[0]?bancos[0].cuenta:'';
        if(!confirm('¿Registrar pago '+p.nPago+' de '+money(p.monto)+'?')) return;
        try{ const res=await repo.pagarConvenioPago(casoRow.cliente, {id:pagosConv.find(x=>x.n_pago===p.nPago).id, nPago:p.nPago, monto:p.monto}, cuenta, perfil); alert(res.msg); recargar(); }catch(err){ alert('❌ '+err.message); }
      }));
    }
  }

  function formAbono(caso, bancos, done) {
    const sub = el(`<div class="overlay"><div class="ohead"><button class="back">←</button><div class="ot">Abono jurídico</div></div>
      <div class="ocontent">
        <div class="note" style="margin-bottom:10px">Reparto: 40% interés / 60% capital. Si el monto cubre el saldo, liquida.</div>
        <label class="alab">Monto</label><input class="inp" id="ab-m" inputmode="decimal">
        <label class="alab">Banco</label><select class="inp" id="ab-c">${bancos.map(b=>`<option>${b.cuenta}</option>`).join('')}</select>
        <label style="display:flex;align-items:center;gap:8px;font-size:.84em;margin:10px 0;cursor:pointer"><input type="checkbox" id="ab-liq" style="width:16px;height:16px"> Liquidar el caso</label>
        <button class="btn-primary" id="ab-go">Registrar abono</button><div class="login-err" id="ab-e"></div></div></div>`);
    document.body.appendChild(sub);
    sub.querySelector('.back').addEventListener('click', ()=>sub.remove());
    sub.querySelector('#ab-go').addEventListener('click', async ()=>{
      try{ const res=await repo.abonarJuridico(caso,{monto:sub.querySelector('#ab-m').value,cuenta:sub.querySelector('#ab-c').value,liquidar:sub.querySelector('#ab-liq').checked},perfil); alert(res.msg); sub.remove(); done(); }
      catch(e){ const er=sub.querySelector('#ab-e'); er.textContent=e.message; er.style.display='block'; }
    });
  }

  function formConvenio(caso, done) {
    const sub = el(`<div class="overlay"><div class="ohead"><button class="back">←</button><div class="ot">Crear convenio</div></div>
      <div class="ocontent">
        <label class="alab">Monto acordado</label><input class="inp" id="cv-m" inputmode="decimal">
        <label class="alab">Número de pagos</label><input class="inp" id="cv-n" inputmode="numeric">
        <label class="alab">Fecha del primer pago</label><input class="inp" id="cv-f" type="date">
        <button class="btn-primary" id="cv-go">Crear convenio</button><div class="login-err" id="cv-e"></div></div></div>`);
    document.body.appendChild(sub);
    sub.querySelector('.back').addEventListener('click', ()=>sub.remove());
    sub.querySelector('#cv-f').value = new Date().toISOString().slice(0,10);
    sub.querySelector('#cv-go').addEventListener('click', async ()=>{
      try{ const res=await repo.crearConvenio(caso,{monto:sub.querySelector('#cv-m').value,numPagos:sub.querySelector('#cv-n').value,fechaInicio:sub.querySelector('#cv-f').value},perfil); alert(res.msg); sub.remove(); done(); }
      catch(e){ const er=sub.querySelector('#cv-e'); er.textContent=e.message; er.style.display='block'; }
    });
  }

  function formEstatus(caso, done) {
    const sub = el(`<div class="overlay"><div class="ohead"><button class="back">←</button><div class="ot">Estatus / Diligencia</div></div>
      <div class="ocontent">
        <label class="alab">Estatus</label><select class="inp" id="es-s">${JUR_ESTADOS.map(e=>`<option ${e===caso.estatus?'selected':''}>${e}</option>`).join('')}</select>
        <label class="alab">Próxima diligencia</label><input class="inp" id="es-d" type="date" value="${caso.prox_diligencia?String(caso.prox_diligencia).slice(0,10):''}">
        <button class="btn-primary" id="es-go">Guardar</button><div class="login-err" id="es-e"></div></div></div>`);
    document.body.appendChild(sub);
    sub.querySelector('.back').addEventListener('click', ()=>sub.remove());
    sub.querySelector('#es-go').addEventListener('click', async ()=>{
      try{ const res=await repo.actualizarCaso(caso,{estatus:sub.querySelector('#es-s').value,proxDiligencia:sub.querySelector('#es-d').value},perfil); alert(res.msg); sub.remove(); done(); }
      catch(e){ const er=sub.querySelector('#es-e'); er.textContent=e.message; er.style.display='block'; }
    });
  }

  function formNota(caso, done) {
    const sub = el(`<div class="overlay"><div class="ohead"><button class="back">←</button><div class="ot">Nota a bitácora</div></div>
      <div class="ocontent">
        <label class="alab">Nota</label><input class="inp" id="nt-n">
        <button class="btn-primary" id="nt-go">Agregar</button><div class="login-err" id="nt-e"></div></div></div>`);
    document.body.appendChild(sub);
    sub.querySelector('.back').addEventListener('click', ()=>sub.remove());
    sub.querySelector('#nt-go').addEventListener('click', async ()=>{
      try{ const res=await repo.agregarNota(caso.cliente, sub.querySelector('#nt-n').value, perfil); alert(res.msg); sub.remove(); done(); }
      catch(e){ const er=sub.querySelector('#nt-e'); er.textContent=e.message; er.style.display='block'; }
    });
  }

  cargar();
}
