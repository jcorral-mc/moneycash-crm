// Vista Pago Americano — réplica del Script. Interés del periodo, abono a capital, ambos, liquidar, pago final.
import { el, money, norm } from '../lib/dom.js';
import { infoAmericano, recalcAbono, construirPagoAmericano } from '../services/pago_americano.service.js';
import { fetchClientesAmericanos, fetchAmericano, fetchBancos, registrarPagoAmericano } from '../repositories/pago_americano.repo.js';
import { solicitarQuitarMulta } from '../repositories/pagos.repo.js';

export async function abrirPagoAmericano(nombre, perfil, onDone) {
  const ov = el(`<div class="overlay"><div class="ohead"><button class="back">\u2190</button><div class="ot">Pago americano</div></div><div class="ocontent">
    <label class="alab">Buscar cliente (solo americanos)</label>
    <input class="inp" id="am-busca" placeholder="Escribe el nombre\u2026" autocomplete="off">
    <div id="am-lista" class="p-lista" style="display:none"></div>

    <div id="am-info" style="display:none">
      <div class="fcard" style="border-left:4px solid var(--gold)">
        <div class="fn" id="am-nom"></div>
        <div id="am-banner" class="p-banner"></div>
        <div class="p-cont">
          <div><div class="p-cl">CAPITAL</div><div class="p-cv num" id="am-cap">$0</div></div>
          <div><div class="p-cl">TASA</div><div class="p-cv" id="am-tasa" style="color:var(--gold)">0%</div></div>
          <div><div class="p-cl">INTERÉS/MES</div><div class="p-cv num" id="am-int">$0</div></div>
          <div><div class="p-cl">PAGO</div><div class="p-cv" id="am-pago">0/0</div></div>
        </div>
      </div>
    </div>

    <div id="am-form" style="display:none">
      <label class="alab">Tipo de pago</label>
      <div class="p-tipos">
        <button type="button" class="p-tp on" data-t="INTERES"><span>Interés del periodo</span><b id="am-vint"></b></button>
        <button type="button" class="p-tp" data-t="CAPITAL"><span id="am-lblcap">Abono a capital</span><b></b></button>
        <button type="button" class="p-tp" data-t="AMBOS"><span>Interés + capital</span><b></b></button>
        <button type="button" class="p-tp" data-t="LIQUIDAR"><span>Liquidar a la fecha</span><b id="am-vliq"></b></button>
      </div>
      <div id="am-box-int" style="display:none;margin-bottom:12px">
        <label class="alab">Monto de interés a aplicar</label>
        <input class="inp" type="number" id="am-montoint" placeholder="0" min="0">
        <div id="am-prev-int" class="am-prev" style="display:none"></div>
      </div>
      <div id="am-box-ab" style="display:none;margin-bottom:12px">
        <label class="alab">Monto a abonar a capital</label>
        <input class="inp" type="number" id="am-abono" placeholder="0" min="0">
        <div id="am-prev-ab" class="am-prev" style="display:none"></div>
      </div>
      <label class="alab">Cuenta / Banco</label><select class="inp" id="am-cuenta"></select>
      <label class="alab">Forma de pago</label>
      <div class="p-fp" id="am-fps">
        <button type="button" class="p-fpb on" data-fp="TRANSFERENCIA">Transferencia</button>
        <button type="button" class="p-fpb" data-fp="EFECTIVO">Efectivo</button>
        <button type="button" class="p-fpb" data-fp="DEPOSITO">Depósito</button>
      </div>
      <button class="btn-primary" id="am-go" style="margin-top:12px;background:var(--gold)">Revisar y registrar</button>
      <button type="button" id="am-multa" class="p-sec" style="width:100%;margin-top:10px;border-color:var(--amber);color:var(--amber)">Solicitar quitar multa</button>
      <div class="login-err" id="am-err"></div>
    </div>

    <div id="am-final" style="display:none">
      <div class="fcard" style="border:2px solid var(--gold);text-align:center;padding:20px">
        <div style="font-weight:600;color:var(--gold);margin-bottom:6px">Pago final único</div>
        <div class="num" id="am-fmonto" style="font-size:1.9em;font-weight:700">$0</div>
        <div class="note" id="am-fdet" style="margin-top:4px"></div>
      </div>
      <div class="note" style="background:#FAF6EC;border-color:#EAD9A8;color:var(--amber);margin:12px 0">No hay pago parcial. Si no se cubre completo, el crédito queda VENCIDO hasta liquidar.</div>
      <label class="alab">Cuenta / Banco</label><select class="inp" id="am-cuenta-f"></select>
      <label class="alab">Forma de pago</label>
      <div class="p-fp" id="am-fps-f">
        <button type="button" class="p-fpb on" data-fp="TRANSFERENCIA">Transferencia</button>
        <button type="button" class="p-fpb" data-fp="EFECTIVO">Efectivo</button>
        <button type="button" class="p-fpb" data-fp="DEPOSITO">Depósito</button>
      </div>
      <button class="btn-primary" id="am-go-f" style="margin-top:12px;background:var(--gold)">Revisar pago final</button>
      <div class="login-err" id="am-err-f"></div>
    </div>
  </div></div>`);
  document.body.appendChild(ov);
  const c = ov.querySelector('.ocontent');
  ov.querySelector('.back').addEventListener('click', () => ov.remove());
  const $ = s => c.querySelector(s);

  const [clientes, bancos] = await Promise.all([fetchClientesAmericanos(perfil), fetchBancos()]);
  const nombres = clientes.map(c=>c.nombre).filter(Boolean).sort();
  const opts = '<option value="">--</option>' + bancos.map(b=>`<option>${b}</option>`).join('');
  $('#am-cuenta').innerHTML = opts; $('#am-cuenta-f').innerHTML = opts;

  let INFO=null, SEL=null, TIPO='INTERES', FORMA='TRANSFERENCIA', FORMAF='TRANSFERENCIA';

  const busca=$('#am-busca'), lista=$('#am-lista');
  busca.addEventListener('input', () => {
    const q=busca.value.trim().toLowerCase();
    const m = q ? nombres.filter(n=>n.toLowerCase().includes(q)).slice(0,30) : [];
    if (!m.length) { lista.style.display='none'; return; }
    lista.innerHTML = m.map(n=>`<div class="p-li" data-n="${encodeURIComponent(n)}">${n}</div>`).join('');
    lista.style.display='block';
    lista.querySelectorAll('.p-li').forEach(d=>d.addEventListener('click', ()=>elegir(decodeURIComponent(d.dataset.n))));
  });

  async function elegir(nom) {
    busca.value=nom; lista.style.display='none'; $('#am-err').style.display='none';
    const { row, cal } = await fetchAmericano(nom);
    if (!row) { return; }
    const info = infoAmericano(row, cal);
    if (info.sinPendientes) { $('#am-info').style.display='none'; $('#am-form').style.display='none'; $('#am-final').style.display='none'; alert(info.msg); return; }
    INFO = info; SEL = { row, cal, nombre:nom };
    $('#am-nom').textContent = nom;
    $('#am-cap').textContent = money(info.capitalActual);
    $('#am-tasa').textContent = info.tasa+'%';
    $('#am-int').textContent = money(info.interesPeriodo);
    $('#am-pago').textContent = info.nPago+'/'+info.totalPagos;
    const b=$('#am-banner');
    if (info.esImpuntual) { b.className='p-banner naranja'; b.innerHTML=`<b>Pago IMPUNTUAL</b> · vence ${info.fechaPago} · impuntual ${money(info.impuntualPeriodo)} (multa ${money(info.multaPeriodo)})`; }
    else { b.className='p-banner verde'; b.innerHTML=`<b>En gracia</b> · vence ${info.fechaPago} · interés del periodo ${money(info.interesPeriodo)}`; }
    if (info.yaPagadoPeriodo>0) b.innerHTML += ` · ya abonado ${money(info.yaPagadoPeriodo)} (faltan ${money(info.faltaInteres)})`;
    $('#am-info').style.display='block';

    if (info.esFinal) {
      $('#am-form').style.display='none'; $('#am-final').style.display='block';
      $('#am-fmonto').textContent = money(info.montoFinal);
      $('#am-fdet').textContent = `capital ${money(info.capitalActual)} + interés ${money(info.faltaInteres)}`;
    } else {
      $('#am-final').style.display='none'; $('#am-form').style.display='block';
      $('#am-vint').textContent = money(info.montoInteres);
      $('#am-vliq').textContent = money(info.montoLiquidar);
      $('#am-montoint').value = info.montoInteres||'';
      // bloqueo de capital/ambos fuera de gracia
      ['CAPITAL','AMBOS'].forEach(t => {
        const btn = c.querySelector(`.p-tp[data-t="${t}"]`);
        const span = btn.querySelector('span');
        if (!info.enGracia) { btn.style.opacity='.45'; btn.style.pointerEvents='none'; span.textContent=(t==='CAPITAL'?'Abono a capital':'Interés + capital')+' (solo en gracia)'; }
        else { btn.style.opacity='1'; btn.style.pointerEvents='auto'; span.textContent=(t==='CAPITAL'?'Abono a capital':'Interés + capital'); }
      });
      TIPO='INTERES'; setTipoUI();
    }
  }

  function setTipoUI() {
    c.querySelectorAll('.p-tp').forEach(x=>x.classList.toggle('on', x.dataset.t===TIPO));
    $('#am-box-int').style.display = (TIPO==='INTERES')?'block':'none';
    $('#am-box-ab').style.display = (TIPO==='CAPITAL'||TIPO==='AMBOS')?'block':'none';
    recalcInt(); recalcAb();
  }
  c.querySelectorAll('.p-tp').forEach(b => b.addEventListener('click', () => { TIPO=b.dataset.t; setTipoUI(); }));
  c.querySelectorAll('#am-fps .p-fpb').forEach(b => b.addEventListener('click', () => { FORMA=b.dataset.fp; c.querySelectorAll('#am-fps .p-fpb').forEach(x=>x.classList.toggle('on',x===b)); }));
  c.querySelectorAll('#am-fps-f .p-fpb').forEach(b => b.addEventListener('click', () => { FORMAF=b.dataset.fp; c.querySelectorAll('#am-fps-f .p-fpb').forEach(x=>x.classList.toggle('on',x===b)); }));

  $('#am-montoint').addEventListener('input', recalcInt);
  function recalcInt() {
    if (!INFO || TIPO!=='INTERES') return;
    const v=parseFloat($('#am-montoint').value)||0, prev=$('#am-prev-int');
    if (v<=0) { prev.style.display='none'; return; }
    prev.style.display='block';
    const tope=INFO.montoInteres||0;
    if (v>tope+1) { prev.className='am-prev err'; prev.textContent=`Excede lo que falta del periodo (${money(tope)}). Para bajar capital usa "Abono a capital".`; return; }
    const falta=Math.max(0, INFO.faltaInteres - v);
    prev.className='am-prev ok';
    prev.textContent = falta>0 ? `Pago PARCIAL: faltarán ${money(falta)} del interés. El pago queda pendiente.` : 'Cubre el interés del periodo completo.';
  }
  $('#am-abono').addEventListener('input', recalcAb);
  function recalcAb() {
    if (!INFO || (TIPO!=='CAPITAL'&&TIPO!=='AMBOS')) return;
    const ab=parseFloat($('#am-abono').value)||0, prev=$('#am-prev-ab');
    if (ab<=0) { prev.style.display='none'; return; }
    prev.style.display='block';
    if (ab>INFO.capitalActual) { prev.className='am-prev err'; prev.textContent=`El abono no puede ser mayor al capital (${money(INFO.capitalActual)}).`; return; }
    const { capNuevo, intNuevo, impNuevo } = recalcAbono(INFO, ab);
    prev.className='am-prev ok';
    prev.innerHTML = `Tras abonar ${money(ab)}: capital ${money(capNuevo)} · nuevo interés/mes ${money(intNuevo)} · impuntual ${money(impNuevo)}<br><span style="color:var(--gold)">Se respeta la tasa pactada (${INFO.tasa}%), por eso el interés baja.</span>`;
  }

  $('#am-go').addEventListener('click', () => registrar(false));
  $('#am-go-f').addEventListener('click', () => registrar(true));
  function registrar(final) {
    const err = final ? $('#am-err-f') : $('#am-err'); err.style.display='none';
    if (!SEL) { err.textContent='Selecciona un cliente.'; err.style.display='block'; return; }
    const cuenta = final ? $('#am-cuenta-f').value : $('#am-cuenta').value;
    if (!cuenta) { err.textContent='Selecciona la cuenta.'; err.style.display='block'; return; }
    const datos = { cliente:SEL.nombre, ejecutivo:SEL.row.ejecutivo||'', cuenta, formaPago: final?FORMAF:FORMA,
      opcion: final?'FINAL':TIPO,
      montoInteres: parseFloat($('#am-montoint').value)||0, abonoCapital: parseFloat($('#am-abono').value)||0 };
    if (!final && TIPO==='INTERES' && datos.montoInteres<=0) { err.textContent='Indica el monto de interés.'; err.style.display='block'; return; }
    if (!final && (TIPO==='CAPITAL'||TIPO==='AMBOS') && datos.abonoCapital<=0) { err.textContent='Indica el monto a abonar a capital.'; err.style.display='block'; return; }
    confirmar(datos, final);
  }

  function confirmar(datos, final) {
    let det = '';
    const op = datos.opcion;
    if (op==='INTERES') det = `Interés: ${money(datos.montoInteres)}`;
    else if (op==='CAPITAL') det = `Abono a capital: ${money(datos.abonoCapital)}`;
    else if (op==='AMBOS') det = `Interés ${money(INFO.faltaInteres)} + capital ${money(datos.abonoCapital)} = ${money(INFO.faltaInteres+datos.abonoCapital)}`;
    else if (op==='LIQUIDAR') det = `Liquidación a la fecha: ${money(INFO.montoLiquidar)}`;
    else if (op==='FINAL') det = `Pago final único: ${money(INFO.montoFinal)}`;
    const m = el(`<div class="p-modal"><div class="p-mbox" style="max-width:380px">
      <div class="p-mtit">Confirmar pago</div>
      <div class="p-mtxt">${SEL.nombre}<br>${det}<br><span style="color:var(--slate);font-size:.9em">Forma: ${final?FORMAF:FORMA} · Cuenta: ${final?$('#am-cuenta-f').value:$('#am-cuenta').value}</span></div>
      <div style="display:flex;gap:10px"><button class="p-sec" data-x style="flex:1">Cancelar</button><button class="btn-primary" data-ok style="flex:1;background:var(--gold)">Confirmar y enviar</button></div>
    </div></div>`);
    document.body.appendChild(m);
    m.querySelector('[data-x]').addEventListener('click', ()=>m.remove());
    m.querySelector('[data-ok]').addEventListener('click', async () => {
      m.remove();
      try {
        const record = construirPagoAmericano(INFO, datos, perfil);
        const res = await registrarPagoAmericano(record, perfil);
        alert(res.msg);
        $('#am-info').style.display='none'; $('#am-form').style.display='none'; $('#am-final').style.display='none';
        busca.value=''; SEL=null; INFO=null; onDone && onDone();
      } catch(e){ alert(e.message); }
    });
  }

  $('#am-multa').addEventListener('click', async () => {
    if (!SEL) return;
    const motivo = prompt('Motivo para quitar la multa:'); if (motivo===null) return;
    try { const r = await solicitarQuitarMulta({ cliente:SEL.nombre, ejecutivo:SEL.row.ejecutivo||'', montoMulta:INFO.multaPeriodo, motivo }, perfil); alert(r.msg); }
    catch(e){ alert(e.message); }
  });

  if (nombre) elegir(nombre);
}
