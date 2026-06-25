// Vista Jurídico — réplica del Script: KPIs + casos agrupados por estatus (acordeón) + detalle.
import { el, money, norm } from '../lib/dom.js';
import { construirCartera, construirCaso, JUR_ESTADOS } from '../services/juridico.service.js';
import * as repo from '../repositories/juridico.repo.js';
import { fetchBancos } from '../repositories/bancos.repo.js';
import { asignarVisita } from '../repositories/visitas.repo.js';

// Color por estatus con la paleta aprobada (sin colores del Script)
const COL = {
  'SIN PRESENTAR':'var(--red)', 'DEMANDA PRESENTADA':'var(--amber)', 'CONVENIO':'var(--green)',
  'ESPERANDO FECHA':'var(--steel)', 'JUICIO':'var(--navy)', 'NO LOCALIZADO':'var(--slate)',
  'BUSQUEDA':'var(--slate)', 'DILIGENCIA PROXIMA':'var(--gold)',
};
const colDe = e => COL[e] || 'var(--slate)';

export async function abrirJuridico(perfil) {
  if (!['ADMIN','GERENTE','JURIDICO'].includes(perfil.rol)) { alert('Solo Jurídico/Admin/Gerente.'); return; }
  const opera = ['ADMIN','JURIDICO'].includes(perfil.rol);
  const ov = el(`<div class="overlay"><div class="ohead"><button class="back">\u2190</button><div class="ot">Jurídico</div></div><div class="ocontent"><div class="loader">Cargando cartera jurídica\u2026</div></div></div>`);
  document.body.appendChild(ov);
  const c = ov.querySelector('.ocontent');
  ov.querySelector('.back').addEventListener('click', () => ov.remove());

  let DATA=null, BANCOS=[];

  async function cargar() {
    c.innerHTML = '<div class="loader">Cargando cartera jurídica\u2026</div>';
    const [casos, bancos] = await Promise.all([repo.fetchCarteraJuridico(), fetchBancos()]);
    BANCOS = (bancos||[]).map(b=>b.cuenta||b);
    DATA = construirCartera(casos); DATA.raw = casos;
    const totalMC = DATA.casos.reduce((s,k)=>s+k.saldoMC,0);
    const prox = DATA.proximasDiligencias.filter(d=>d.diasDiligencia!=null && d.diasDiligencia<=8);

    c.innerHTML = `
      ${prox.length?`<div class="jur-dilig"><div class="jur-dilig-h"><span>Diligencias próximas (8 días)</span><span class="jur-badge">${prox.length}</span></div>
        ${prox.map(d=>{const t=d.diasDiligencia<=0?'hoy/vencida':(d.diasDiligencia===1?'mañana':'en '+d.diasDiligencia+'d');return `<div class="jur-dilig-row"><span><b>${d.cliente}</b> · ${d.estatus}</span><span><b>${t}</b> · ${d.proxDiligencia}</span></div>`;}).join('')}</div>`:''}
      <div class="kpis kpis-3">
        <div class="kcard"><div class="klab">Casos</div><div class="kval num">${DATA.total}</div></div>
        <div class="kcard"><div class="klab">Saldo MC</div><div class="kval num">${money(totalMC)}</div></div>
        <div class="kcard"><div class="klab">Saldo demanda</div><div class="kval num" style="color:var(--red)">${money(DATA.deudaDemanda)}</div></div>
      </div>
      <div class="jur-filtros">
        <input class="inp" id="jur-busca" placeholder="Buscar cliente" style="flex:1;min-width:140px">
        <select class="inp" id="jur-est" style="width:auto"><option value="">Todos los estatus</option>${JUR_ESTADOS.map(e=>`<option>${e}</option>`).join('')}</select>
      </div>
      <div id="jur-casos"></div>`;

    const busca=$('#jur-busca'), fest=$('#jur-est');
    busca.addEventListener('input', render); fest.addEventListener('change', render);
    render();
  }

  const $ = s => c.querySelector(s);

  function render() {
    const q = ($('#jur-busca').value||'').trim().toLowerCase();
    const fe = $('#jur-est').value;
    let cs = DATA.casos.slice();
    if (q) cs = cs.filter(k=>k.cliente.toLowerCase().includes(q));
    if (fe) cs = cs.filter(k=>k.estatus===fe);
    const box = $('#jur-casos');
    if (!cs.length) { box.innerHTML = '<div class="note" style="text-align:center">Sin casos con ese filtro.</div>'; return; }

    const grupos = {};
    cs.forEach(k=>{ const st=k.estatus||'SIN PRESENTAR'; (grupos[st]=grupos[st]||[]).push(k); });
    const keys = Object.keys(grupos).sort((a,b)=>JUR_ESTADOS.indexOf(a)-JUR_ESTADOS.indexOf(b));

    box.innerHTML = keys.map((st,gi)=>{
      const arr=grupos[st], col=colDe(st);
      return `<div class="jur-grupo">
        <div class="jur-gh" data-g="${gi}" style="background:${col}"><span><b>${st}</b> <span style="opacity:.85;font-size:.82em">(${arr.length})</span></span><span class="jur-fl" data-fl="${gi}">\u25B8</span></div>
        <div class="jur-gb" data-gb="${gi}" style="display:none">
          ${arr.map(k=>`<div class="jur-caso" data-id="${k.id}" style="border-left-color:${col}">
            <div><div class="nm">${k.cliente}</div><div class="mt">${k.proxDiligencia?('dilig. '+k.proxDiligencia):'sin diligencia'}</div></div>
            <div style="text-align:right"><div class="mt">MC ${money(k.saldoMC)}</div><div class="mt">Dda ${money(k.saldoDemanda)}</div></div>
          </div>`).join('')}
        </div></div>`;
    }).join('');

    box.querySelectorAll('[data-g]').forEach(h=>h.addEventListener('click',()=>{
      const gi=h.dataset.g, b=box.querySelector(`[data-gb="${gi}"]`), fl=box.querySelector(`[data-fl="${gi}"]`);
      const open=b.style.display!=='none'; b.style.display=open?'none':'block'; fl.textContent=open?'\u25B8':'\u25BE';
    }));
    box.querySelectorAll('.jur-caso[data-id]').forEach(card=>card.addEventListener('click',()=>{
      const k=DATA.raw.find(x=>String(x.id)===card.dataset.id); if(k) verCaso(k);
    }));
  }

  async function verCaso(casoRow) {
    const [bit, conv, pagosConv] = await Promise.all([repo.fetchBitacora(casoRow.cliente), repo.fetchConvenios(casoRow.cliente), repo.fetchPagosConvenio(casoRow.cliente)]);
    const e = construirCaso(casoRow, bit, conv, pagosConv);
    const col = colDe(e.estatus);
    const sub = el(`<div class="overlay"><div class="ohead"><button class="back">\u2190</button><div class="ot">${casoRow.cliente}</div></div><div class="ocontent">
      <div class="jur-saldos">
        <div class="fcard" style="border-left:4px solid var(--steel)"><div class="p-cl">SALDO MONEYCASH</div><div class="num" style="font-size:1.2em;font-weight:700">${money(e.saldoMC)}</div></div>
        <div class="fcard" style="border-left:4px solid var(--red)"><div class="p-cl">SALDO DEMANDA</div><div class="num" style="font-size:1.2em;font-weight:700">${money(e.saldoDemanda)}</div></div>
      </div>
      <div class="fcard"><div class="fn">Actualizar caso</div>
        <label class="alab">Estatus</label><select class="inp" id="j-est">${JUR_ESTADOS.map(x=>`<option ${x===e.estatus?'selected':''}>${x}</option>`).join('')}</select>
        <label class="alab">Saldo demanda</label><input class="inp" id="j-dda" type="number" value="${e.saldoDemanda}">
        <label class="alab">Próxima diligencia</label><input class="inp" id="j-dil" type="date" value="${e.proxDiligencia}">
        <label class="alab">Comentario (bitácora)</label><textarea class="inp" id="j-com" rows="2" placeholder="Nota de la gestión\u2026"></textarea>
        ${opera?`<button class="btn-primary" id="j-save">Guardar</button>
        <button class="btn-primary" id="j-visita" style="margin-top:6px;background:var(--steel)">Asignar visita</button>`:''}
      </div>
      ${opera?`<div class="fcard" style="border-left:4px solid var(--gold)"><div class="fn">Aplicar abono (40% interés / 60% capital)</div>
        <div style="display:flex;gap:8px">
          <input class="inp" id="j-abm" type="number" placeholder="Monto" style="flex:1">
          <select class="inp" id="j-abc" style="flex:1"><option value="">Cuenta</option>${BANCOS.map(b=>`<option>${b}</option>`).join('')}</select>
        </div>
        <div style="display:flex;gap:8px;margin-top:8px"><button class="btn-primary" id="j-ab" style="flex:1;background:var(--gold)">Abonar</button><button class="btn-primary" id="j-liq" style="flex:1;background:var(--red)">Liquidar</button></div>
      </div>`:''}
      ${e.convenio?`<div class="fcard" style="border-left:4px solid var(--green)"><div class="fn">Convenio vigente · ${money(e.convenio.monto_acordado)} en ${e.convenio.num_pagos} pagos</div>
        ${e.pagosConvenio.map(p=>`<div class="liqrow"><span>Pago ${p.nPago} · ${p.fecha}</span><span class="num">${money(p.monto)} ${p.estatus==='PAGADO'?'<b style="color:var(--green)">\u2713</b>':(opera?`<button class="mini-ok" data-pc="${p.nPago}" style="width:auto;padding:3px 9px">Pagar</button>`:'')}</span></div>`).join('')}
      </div>`:(opera?`<button class="btn-primary" id="j-conv" style="width:100%;background:var(--green)">Crear convenio</button>`:'')}
      <div class="jur-sec"><div class="jur-sec-h" data-s="sDat">Datos del cliente <span>\u203A</span></div><div class="jur-sec-b" data-sb="sDat" style="display:none">
        <div style="font-size:.85em;line-height:1.8">Ejecutivo: ${casoRow.ejecutivo||'—'}<br>Capital original: ${money(e.capitalOrig)}<br>Pagado: cap ${money(e.capPagado)} / int ${money(e.intPagado)}<br>Abonos: ${e.nAbonos}</div></div></div>
      <div class="jur-sec"><div class="jur-sec-h" data-s="sBit">Gestión jurídico (${e.bitacora.length}) <span>\u203A</span></div><div class="jur-sec-b" data-sb="sBit" style="display:none">
        ${e.bitacora.map(b=>`<div class="liqrow"><span style="font-size:.72em;color:var(--slate)">${b.fecha}</span><span style="text-align:right;font-size:.85em">${b.nota}${b.autor?`<div class="mt">${b.autor}</div>`:''}</span></div>`).join('')||'<div class="note">Sin gestiones aún.</div>'}</div></div>
    </div></div>`);
    document.body.appendChild(sub);
    sub.querySelector('.back').addEventListener('click', ()=>sub.remove());
    const recargar = () => { sub.remove(); cargar(); };
    const q = s => sub.querySelector(s);

    sub.querySelectorAll('.jur-sec-h').forEach(h=>h.addEventListener('click',()=>{
      const b=sub.querySelector(`[data-sb="${h.dataset.s}"]`), open=b.style.display!=='none';
      b.style.display=open?'none':'block'; h.querySelector('span').textContent=open?'\u203A':'\u02C5';
    }));

    if (opera) {
      q('#j-save').addEventListener('click', async ()=>{
        try {
          await repo.actualizarCaso(casoRow, { estatus:q('#j-est').value, saldoDemanda:q('#j-dda').value, proxDiligencia:q('#j-dil').value }, perfil);
          const com=q('#j-com').value.trim(); if (com) await repo.agregarNota(casoRow.cliente, com, perfil);
          alert('Caso actualizado.'); recargar();
        } catch(err){ alert(err.message); }
      });
      q('#j-visita').addEventListener('click', ()=>formVisita(casoRow));
      q('#j-ab').addEventListener('click', ()=>abonar(casoRow, q, false, recargar));
      q('#j-liq').addEventListener('click', ()=>abonar(casoRow, q, true, recargar));
      const conv=q('#j-conv'); if (conv) conv.addEventListener('click', ()=>formConvenio(casoRow, recargar));
      sub.querySelectorAll('[data-pc]').forEach(b=>b.addEventListener('click', async ()=>{
        const p=e.pagosConvenio.find(x=>String(x.nPago)===b.dataset.pc);
        const cuenta=BANCOS[0]||''; if(!confirm(`¿Registrar pago ${p.nPago} de ${money(p.monto)}?`))return;
        try{ await repo.pagarConvenioPago(casoRow.cliente, {id:pagosConv.find(x=>x.n_pago===p.nPago).id, nPago:p.nPago, monto:p.monto}, cuenta, perfil); alert('Pago registrado.'); recargar(); }catch(err){ alert(err.message); }
      }));
    }
  }

  async function abonar(caso, q, liquidar, done) {
    const monto=parseFloat(q('#j-abm').value)||0, cuenta=q('#j-abc').value;
    if (monto<=0) { alert('Monto inválido.'); return; }
    if (!cuenta) { alert('Selecciona cuenta.'); return; }
    if (!confirm(`${liquidar?'LIQUIDAR':'Abonar'} ${money(monto)} a ${caso.cliente}?`)) return;
    try { const r=await repo.abonarJuridico(caso, { monto, cuenta, liquidar }, perfil); alert(r.msg); done(); } catch(e){ alert(e.message); }
  }

  function formConvenio(caso, done) {
    const m = el(`<div class="p-modal"><div class="p-mbox">
      <div class="p-mtit">Nuevo convenio — ${caso.cliente}</div>
      <label class="alab">Monto total</label><input class="inp" id="cv-m" type="number" placeholder="0">
      <label class="alab">Número de pagos</label><input class="inp" id="cv-n" type="number" placeholder="6">
      <label class="alab">Fecha primer pago</label><input class="inp" id="cv-f" type="date">
      <div style="display:flex;gap:10px;margin-top:12px"><button class="p-sec" data-x style="flex:1">Cancelar</button><button class="btn-primary" data-ok style="flex:1;background:var(--green)">Crear convenio</button></div>
    </div></div>`);
    document.body.appendChild(m);
    m.querySelector('[data-x]').addEventListener('click',()=>m.remove());
    m.querySelector('[data-ok]').addEventListener('click', async ()=>{
      const monto=parseFloat(m.querySelector('#cv-m').value)||0, num=parseInt(m.querySelector('#cv-n').value)||0, fecha=m.querySelector('#cv-f').value;
      if (monto<=0||num<=0||!fecha) { alert('Llena monto, número de pagos y fecha.'); return; }
      try { const r=await repo.crearConvenio(caso, {monto, numPagos:num, fechaInicio:fecha}, perfil); alert(r.msg); m.remove(); done(); } catch(e){ alert(e.message); }
    });
  }

  function formVisita(caso) {
    const m = el(`<div class="p-modal"><div class="p-mbox">
      <div class="p-mtit">Asignar visita — ${caso.cliente}</div>
      <label class="alab">Horario (obligatorio)</label><input class="inp" id="v-h" placeholder="Ej: 9am a 12pm">
      <label class="alab">Dirección</label><input class="inp" id="v-d" placeholder="Calle, colonia, referencia">
      <label class="alab">Teléfono</label><input class="inp" id="v-t" placeholder="Opcional">
      <label class="alab">Comentarios</label><textarea class="inp" id="v-c" rows="2" placeholder="Motivo de la visita\u2026"></textarea>
      <div style="display:flex;gap:10px;margin-top:12px"><button class="p-sec" data-x style="flex:1">Cancelar</button><button class="btn-primary" data-ok style="flex:1;background:var(--steel)">Asignar</button></div>
    </div></div>`);
    document.body.appendChild(m);
    m.querySelector('[data-x]').addEventListener('click',()=>m.remove());
    m.querySelector('[data-ok]').addEventListener('click', async ()=>{
      const horario=m.querySelector('#v-h').value.trim(); if(!horario){ alert('El horario es obligatorio.'); return; }
      try { const r=await asignarVisita({ cliente:caso.cliente, tipo:'JURIDICO', horario, direccion:m.querySelector('#v-d').value.trim(), telefono:m.querySelector('#v-t').value.trim(), comentarios:m.querySelector('#v-c').value.trim() }, perfil); alert(r.msg); m.remove(); } catch(e){ alert(e.message); }
    });
  }

  cargar();
}
