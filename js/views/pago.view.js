// Vista "Aplicar pago" (réplica de pagos.html). Crea el pago PENDIENTE de conciliar.
// Muestra y autocompleta el $ sugerido por tipo (réplica de infoClientePago).
import { el, money } from '../lib/dom.js';
import { fetchCartera, fetchCalendarioCliente } from '../repositories/clientes.repo.js';
import { fetchPendientesByCliente, fetchBancos, insertPendiente } from '../repositories/pagos.repo.js';
import { registrarPagoPendiente, infoPago } from '../services/pagos.service.js';

/** Abre el formulario de aplicar pago para un cliente (overlay). */
export async function abrirAplicarPago(nombre, perfil, onDone) {
  const [carteras, cal, pend, bancos] = await Promise.all([
    fetchCartera(), fetchCalendarioCliente(nombre), fetchPendientesByCliente(nombre), fetchBancos()
  ]);
  const cRow = carteras.find(c => (c.nombre||'').toUpperCase() === (nombre||'').toUpperCase()) || { nombre };
  const info = infoPago(cRow, cal, pend);

  const ov = el(`<div class="overlay">
    <div class="ohead"><button class="back">←</button><div class="ot">Aplicar pago</div></div>
    <div class="ocontent">
      <div class="fcard"><div class="fn">${nombre}</div><div class="fm">${cRow.ejecutivo||'—'} · saldo ${money(cRow.saldo)}</div></div>
      <label class="alab">Forma de pago</label>
      <select class="inp" id="p-forma"><option>TRANSFERENCIA</option><option>DEPOSITO</option><option>EFECTIVO</option></select>
      <label class="alab">Banco / cuenta</label>
      <select class="inp" id="p-cuenta">${bancos.map(b=>`<option value="${b.cuenta}">${b.cuenta}</option>`).join('')}</select>
      <label class="alab">Tipo de pago</label>
      <select class="inp" id="p-tipo">
        <option value="NORMAL">Normal (pago del periodo) — ${money(info.sugerido)}</option>
        <option value="MINIMO">Mínimo (solo interés) — ${money(info.montoMinimo)}</option>
        <option value="OTRO">Parcial / monto libre</option>
        <option value="LIQUIDAR">Liquidar HOY completo — ${money(info.liquidarCompleto)}</option>
      </select>
      <div class="hint" id="p-hint"></div>
      <label class="alab">Monto recibido</label>
      <input class="inp" id="p-monto" inputmode="decimal" placeholder="0">
      <label class="alab">Excedente va a…</label>
      <select class="inp" id="p-exc"><option value="SIGUIENTE">Siguiente pago</option><option value="ULTIMO">Último pago</option></select>
      <button class="btn-primary" id="p-guardar">Registrar pago (pendiente de conciliar)</button>
      <div class="login-err" id="p-err"></div>
      <div class="note" style="margin-top:12px">Liquidar al 50% de interés: <b>${money(info.liquidar50)}</b> <i>(previa autorización de gerencia)</i>.</div>
      <div class="note" style="margin-top:8px">El pago queda <b>PENDIENTE</b> y afecta saldo/banco solo al aprobarse en <b>Conciliación</b>.</div>
    </div></div>`);

  const err = ov.querySelector('#p-err');
  const tipoSel = ov.querySelector('#p-tipo');
  const montoInp = ov.querySelector('#p-monto');
  const hint = ov.querySelector('#p-hint');

  // Autocompletar el monto y la pista según el tipo elegido
  function aplicarTipo() {
    const t = tipoSel.value;
    if (t === 'NORMAL')      { montoInp.value = info.sugerido || ''; hint.textContent = `Sugerido del periodo: ${money(info.sugerido)}${info.multaPago>0?` (incluye multa ${money(info.multaPago)})`:''}`; }
    else if (t === 'MINIMO') { montoInp.value = info.montoMinimo || ''; hint.textContent = `Solo interés del próximo pago: ${money(info.montoMinimo)}. El capital se recorre al final.`; }
    else if (t === 'LIQUIDAR'){ montoInp.value = info.liquidarCompleto || ''; hint.textContent = `Liquidación COMPLETA hoy: ${money(info.liquidarCompleto)} (capital ${money(info.capPend)} + interés ${money(info.intPend)}).`; }
    else                     { montoInp.value = ''; hint.textContent = 'Monto libre: si no cubre el pago, queda como PARCIAL.'; }
  }
  tipoSel.addEventListener('change', aplicarTipo);
  aplicarTipo(); // estado inicial (NORMAL)

  ov.querySelector('.back').addEventListener('click', () => ov.remove());
  ov.querySelector('#p-guardar').addEventListener('click', async () => {
    err.style.display='none';
    const datos = {
      cliente: nombre,
      monto: montoInp.value,
      tipo: tipoSel.value,
      formaPago: ov.querySelector('#p-forma').value,
      cuenta: ov.querySelector('#p-cuenta').value,
      direccionExcedente: ov.querySelector('#p-exc').value,
    };
    try {
      const { record, msg } = registrarPagoPendiente(cRow, cal, pend, datos, perfil);
      await insertPendiente(record);
      alert(msg);
      ov.remove();
      if (onDone) onDone();
    } catch (e) {
      err.textContent = e.message || 'No se pudo registrar.'; err.style.display='block';
    }
  });
  document.body.appendChild(ov);
}
