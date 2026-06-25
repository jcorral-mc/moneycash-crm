// Vista "Aplicar Pago" — réplica de pagos.html del Script.
// Buscar cliente · banner de estado · contadores · 4 tipos · forma de pago · modales · quitar multa / descuento.
import { el, money, norm } from '../lib/dom.js';
import { fetchCartera, fetchCalendarioCliente } from '../repositories/clientes.repo.js';
import { fetchPendientesByCliente, fetchBancos, insertPendiente, fetchUltimosPagos,
         descuentoVigente, perdonMultaVigente, solicitarQuitarMulta, solicitarDescuento } from '../repositories/pagos.repo.js';
import { registrarPagoPendiente, infoPago } from '../services/pagos.service.js';

const U = s => String(s||'').toUpperCase();

export async function abrirAplicarPago(nombre, perfil, onDone) {
  const ov = el(`<div class="overlay">
    <div class="ohead"><button class="back">\u2190</button><div class="ot">Aplicar pago</div></div>
    <div class="ocontent">
      <label class="alab">Buscar cliente</label>
      <input class="inp" id="p-busca" placeholder="Escribe el nombre\u2026" autocomplete="off">
      <div id="p-lista" class="p-lista" style="display:none"></div>

      <div id="p-info" style="display:none">
        <div class="fcard" style="border-left:4px solid var(--steel)">
          <div class="fn" id="i-nom"></div>
          <div id="i-banner" class="p-banner"></div>
          <div class="p-cont">
            <div><div class="p-cl">SALDO</div><div class="p-cv num" id="i-saldo">$0</div></div>
            <div><div class="p-cl">A TIEMPO</div><div class="p-cv" id="i-ati" style="color:var(--green)">0</div></div>
            <div><div class="p-cl">TARDE</div><div class="p-cv" id="i-tar" style="color:var(--amber)">0</div></div>
            <div><div class="p-cl">VENCIDOS</div><div class="p-cv" id="i-venc" style="color:var(--red)">0</div></div>
            <div><div class="p-cl">MULTAS</div><div class="p-cv num" id="i-multa" style="color:var(--amber)">$0</div></div>
          </div>
          <div id="i-ultimos" class="p-ultimos"></div>
        </div>
      </div>

      <div id="p-form" style="display:none">
        <label class="alab">Tipo de pago</label>
        <div class="p-tipos">
          <button type="button" class="p-tp on" data-t="NORMAL"><span id="lbl-normal">Pago del periodo</span><b id="v-sug"></b></button>
          <button type="button" class="p-tp" data-t="LIQUIDAR"><span id="lbl-liq">Liquidar (50% inter\u00e9s)</span><b id="v-liq"></b></button>
          <button type="button" class="p-tp" data-t="MINIMO"><span>M\u00ednimo (solo inter\u00e9s)</span><b id="v-min"></b></button>
          <button type="button" class="p-tp" data-t="OTRO"><span>Otro (monto libre)</span><b></b></button>
        </div>
        <div style="display:grid;grid-template-columns:1.2fr 1fr;gap:11px">
          <div><label class="alab">Monto ($)</label><input class="inp" type="number" id="p-monto" placeholder="0.00" inputmode="decimal"></div>
          <div><label class="alab">Cuenta</label><select class="inp" id="p-cuenta"></select></div>
        </div>
        <label class="alab">Forma de pago</label>
        <div class="p-fp">
          <button type="button" class="p-fpb on" data-fp="DEPOSITO">Dep\u00f3sito</button>
          <button type="button" class="p-fpb" data-fp="TRANSFERENCIA">Transferencia</button>
          <button type="button" class="p-fpb" data-fp="EFECTIVO">Efectivo</button>
        </div>
        <button class="btn-primary" id="p-aplicar" style="margin-top:12px">APLICAR PAGO</button>
        <div style="display:flex;gap:8px;margin-top:10px">
          <button type="button" id="p-desc" class="p-sec" style="border-color:var(--gold);color:var(--amber)">Solicitar descuento</button>
          <button type="button" id="p-multa" class="p-sec" style="border-color:var(--amber);color:var(--amber)">Quitar multa</button>
        </div>
        <div class="login-err" id="p-err"></div>
      </div>
    </div>
  </div>`);
  document.body.appendChild(ov);
  ov.querySelector('.back').addEventListener('click', () => ov.remove());
  const $ = s => ov.querySelector(s);

  // ── Datos base
  const [cartera, bancos] = await Promise.all([ fetchCartera(), fetchBancos() ]);
  const activos = cartera
    .filter(c => (perfil.rol!=='EJECUTIVO') || norm(c.ejecutivo)===norm(perfil.ejecutivo))
    .filter(c => (Number(c.saldo)||0) > 0)
    .map(c => c.nombre).filter(Boolean).sort();
  $('#p-cuenta').innerHTML = '<option value="">--</option>' + bancos.map(b=>`<option>${b.cuenta}</option>`).join('');

  let SEL = null, INFO = null, TIPO='NORMAL', FORMA='DEPOSITO', PEND=null;

  // ── Buscador
  const busca = $('#p-busca'), lista = $('#p-lista');
  function pintarLista(arr){
    if (!arr.length) { lista.style.display='none'; return; }
    lista.innerHTML = arr.slice(0,200).map(n=>`<div class="p-li" data-n="${encodeURIComponent(n)}">${n}</div>`).join('');
    lista.style.display='block';
    lista.querySelectorAll('.p-li').forEach(d => d.addEventListener('click', () => elegir(decodeURIComponent(d.dataset.n))));
  }
  busca.addEventListener('input', () => {
    const q = busca.value.trim().toLowerCase();
    pintarLista(!q ? activos : activos.filter(n => n.toLowerCase().includes(q)));
  });
  busca.addEventListener('focus', () => { if (!SEL) pintarLista(activos); });

  // ── Elegir cliente
  async function elegir(nom) {
    busca.value = nom; lista.style.display='none';
    const cRow = cartera.find(c => norm(c.nombre)===norm(nom)) || { nombre:nom };
    const [cal, pend, ultimos, descAut, perdon] = await Promise.all([
      fetchCalendarioCliente(nom), fetchPendientesByCliente(nom),
      fetchUltimosPagos(nom), descuentoVigente(nom), perdonMultaVigente(nom),
    ]);
    const info = infoPago(cRow, cal, pend, { descuentoAutorizado:descAut, perdonVigente:perdon, ultimos });
    SEL = { nombre:nom, cRow, cal, pend }; INFO = info;
    pintarInfo(nom, info);
  }

  function pintarInfo(nom, r) {
    $('#i-nom').textContent = nom;
    $('#i-saldo').textContent = money(r.saldo);
    $('#i-ati').textContent = r.pagadosATiempo||0;
    $('#i-tar').textContent = r.pagadosTarde||0;
    $('#i-venc').textContent = r.vencidos||0;
    $('#i-multa').textContent = money(r.multasAcum);

    const b = $('#i-banner');
    if (r.descuentoAutorizado!=null) { b.className='p-banner morado'; b.innerHTML=`<b>Liquidaci\u00f3n autorizada HOY:</b> ${money(r.descuentoAutorizado)} (vence a medianoche)`; }
    else if (r.esImpuntual) { b.className='p-banner naranja'; b.innerHTML=`<b>Pago #${r.nPagoCobrar} IMPUNTUAL</b> \u00b7 Cobrar ${money(r.montoACobrar)} (incluye multa ${money(r.multaPago)})`; }
    else if (r.perdonVigente) { b.className='p-banner verde'; b.innerHTML=`<b>Multa perdonada HOY</b> \u00b7 Pago #${r.nPagoCobrar} cobrar ${money(r.montoACobrar)} (sin multa)`; }
    else if (r.nPagoCobrar>0) { b.className='p-banner azul'; b.innerHTML=`<b>Pago #${r.nPagoCobrar} puntual</b> \u00b7 Cobrar ${money(r.montoACobrar)}`; }
    else { b.className='p-banner verde'; b.innerHTML='Sin pagos pendientes'; }
    if (r.desglose && r.desglose.length>1) {
      const lin = r.desglose.map(d=>`#${d.nPago} ${d.fecha} ${d.tipo} ${money(d.monto)}${d.multa>0?(' +multa '+money(d.multa)):''}`).join('  \u00b7  ');
      b.innerHTML += `<div class="p-acum">Acumula ${r.desglose.length} pagos:  ${lin}</div>`;
    }

    $('#v-sug').textContent = money(r.montoACobrar);
    $('#v-min').textContent = money(r.montoMinimo);
    $('#v-liq').textContent = money(r.descuentoAutorizado!=null ? r.descuentoAutorizado : r.liquidar50);
    $('#lbl-liq').textContent = r.descuentoAutorizado!=null ? 'Liquidar (autorizado hoy)' : 'Liquidar (50% inter\u00e9s)';
    $('#i-ultimos').innerHTML = (r.ultimos&&r.ultimos.length) ? 'Últimos pagos: '+r.ultimos.map(u=>`${u.fecha} (${money(u.monto)})`).join(' \u00b7 ') : 'Sin pagos previos';

    $('#p-info').style.display='block'; $('#p-form').style.display='block';
    // reset tipo a NORMAL
    TIPO='NORMAL'; setTipoUI('NORMAL');
    $('#p-monto').value = r.montoACobrar>0 ? r.montoACobrar : '';
  }

  // ── Botones de tipo
  function setTipoUI(t){ ov.querySelectorAll('.p-tp').forEach(x=>x.classList.toggle('on', x.dataset.t===t)); }
  ov.querySelectorAll('.p-tp').forEach(btn => btn.addEventListener('click', () => {
    TIPO = btn.dataset.t; setTipoUI(TIPO);
    if (!INFO) return;
    if (TIPO==='NORMAL') $('#p-monto').value = INFO.montoACobrar>0?INFO.montoACobrar:'';
    else if (TIPO==='LIQUIDAR') $('#p-monto').value = (INFO.descuentoAutorizado!=null?INFO.descuentoAutorizado:INFO.liquidar50)||'';
    else if (TIPO==='MINIMO') $('#p-monto').value = INFO.montoMinimo>0?INFO.montoMinimo:'';
    else $('#p-monto').value='';
  }));
  // ── Forma de pago
  ov.querySelectorAll('.p-fpb').forEach(btn => btn.addEventListener('click', () => {
    FORMA = btn.dataset.fp; ov.querySelectorAll('.p-fpb').forEach(x=>x.classList.toggle('on', x===btn));
  }));

  // ── Aplicar
  $('#p-aplicar').addEventListener('click', () => {
    const err=$('#p-err'); err.style.display='none';
    if (!SEL) { return fail('Selecciona un cliente.'); }
    const monto = parseFloat($('#p-monto').value);
    const cuenta = $('#p-cuenta').value;
    if (!monto || monto<=0) return fail('Monto inválido.');
    if (!cuenta) return fail('Selecciona cuenta.');
    PEND = { cliente:SEL.nombre, monto, cuenta, tipo:TIPO, formaPago:FORMA, direccionExcedente:'SIGUIENTE' };
    const sug = INFO ? INFO.sugerido : 0;
    if (monto>sug && sug>0 && TIPO!=='LIQUIDAR' && TIPO!=='MINIMO') {
      const exc = Math.round(monto - sug);
      abrirExcedente(monto, sug, exc);
    } else confirmar();
  });
  function fail(t){ const e=$('#p-err'); e.textContent=t; e.style.display='block'; }

  // ── Modal excedente
  function abrirExcedente(monto, sug, exc) {
    const m = el(`<div class="p-modal"><div class="p-mbox">
      <div class="p-mtit">Excedente de pago</div>
      <div class="p-mtxt">El cliente paga <b>${money(monto)}</b> pero el sugerido es <b>${money(sug)}</b>. Hay un excedente de <b>${money(exc)}</b>. ¿Dónde lo aplico?</div>
      <button class="btn-primary" data-d="SIGUIENTE" style="margin-bottom:8px">Aplicar al SIGUIENTE pago</button>
      <button class="btn-primary" data-d="ULTIMO" style="background:var(--navy);margin-bottom:8px">Aplicar al \u00daLTIMO pago</button>
      <button class="p-sec" data-d="">Cancelar</button>
    </div></div>`);
    ov.appendChild(m);
    m.querySelectorAll('[data-d]').forEach(b => b.addEventListener('click', () => {
      const d=b.dataset.d; m.remove();
      if (d) { PEND.direccionExcedente=d; confirmar(); }
    }));
  }

  // ── Modal confirmación
  function confirmar() {
    let extra='';
    if (PEND.tipo==='NORMAL' && INFO && INFO.esImpuntual && INFO.multaPago>0) extra=`Incluye multa de ${money(INFO.multaPago)}`;
    if (PEND.direccionExcedente==='ULTIMO') extra += (extra?' | ':'')+'Excedente \u2192 último pago';
    else if (INFO && PEND.monto>INFO.sugerido && INFO.sugerido>0) extra += (extra?' | ':'')+'Excedente \u2192 siguiente pago';
    const m = el(`<div class="p-modal"><div class="p-mbox" style="text-align:center">
      
      <div class="p-mtit">Confirmar pago</div>
      <div class="p-mtxt" style="margin-bottom:4px">${PEND.cliente}</div>
      <div class="num" style="font-size:1.5em;font-weight:700;color:var(--steel);margin-bottom:6px">${money(PEND.monto)}</div>
      <div style="font-size:.82em;color:var(--amber);font-weight:600;margin-bottom:16px">${extra}</div>
      <div style="display:flex;gap:10px">
        <button class="p-sec" data-ok="0" style="flex:1">Cancelar</button>
        <button class="btn-primary" data-ok="1" style="flex:1;background:var(--green)">Aceptar</button>
      </div>
    </div></div>`);
    ov.appendChild(m);
    m.querySelector('[data-ok="0"]').addEventListener('click', () => { m.remove(); PEND=null; });
    m.querySelector('[data-ok="1"]').addEventListener('click', async () => {
      m.remove();
      try {
        const { record, msg } = registrarPagoPendiente(SEL.cRow, SEL.cal, SEL.pend, PEND, perfil);
        await insertPendiente(record);
        alert(msg);
        limpiar(); onDone && onDone();
      } catch(e) { fail(e.message||'No se pudo registrar el pago.'); }
      PEND=null;
    });
  }

  function limpiar(){ SEL=null; INFO=null; busca.value=''; $('#p-monto').value=''; $('#p-info').style.display='none'; $('#p-form').style.display='none'; pintarLista(activos); }

  // ── Quitar multa / Solicitar descuento
  $('#p-multa').addEventListener('click', async () => {
    if (!SEL) return fail('Selecciona un cliente.');
    const motivo = prompt('Motivo para quitar la multa:'); if (motivo===null) return;
    try { const r = await solicitarQuitarMulta({ cliente:SEL.nombre, ejecutivo:SEL.cRow.ejecutivo||'', montoMulta:(INFO&&INFO.multasAcum)||0, motivo }, perfil); alert(r.msg); }
    catch(e){ fail(e.message); }
  });
  $('#p-desc').addEventListener('click', async () => {
    if (!SEL) return fail('Selecciona un cliente.');
    const motivo = prompt('Motivo para solicitar liquidación con descuento:'); if (motivo===null) return;
    try { const r = await solicitarDescuento({ cliente:SEL.nombre, motivo }, perfil); alert(r.msg); }
    catch(e){ fail(e.message); }
  });

  // Si llega con cliente preseleccionado, cárgalo
  if (nombre) elegir(nombre);
}
