// Vista "Aplicar pago" (réplica de pagos.html). Crea el pago PENDIENTE de conciliar.
import { el, money } from '../lib/dom.js';
import { fetchCartera, fetchCalendarioCliente } from '../repositories/clientes.repo.js';
import { fetchPendientesByCliente, fetchBancos, insertPendiente } from '../repositories/pagos.repo.js';
import { registrarPagoPendiente } from '../services/pagos.service.js';

/** Abre el formulario de aplicar pago para un cliente (overlay). */
export async function abrirAplicarPago(nombre, perfil, onDone) {
  const [carteras, cal, pend, bancos] = await Promise.all([
    fetchCartera(), fetchCalendarioCliente(nombre), fetchPendientesByCliente(nombre), fetchBancos()
  ]);
  const cRow = carteras.find(c => (c.nombre||'').toUpperCase() === (nombre||'').toUpperCase()) || { nombre };

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
        <option value="NORMAL">Normal (pago del periodo)</option>
        <option value="MINIMO">Mínimo (solo interés)</option>
        <option value="OTRO">Parcial / monto libre</option>
        <option value="LIQUIDAR">Liquidación</option>
      </select>
      <label class="alab">Monto recibido</label>
      <input class="inp" id="p-monto" inputmode="decimal" placeholder="0">
      <label class="alab">Excedente va a…</label>
      <select class="inp" id="p-exc"><option value="SIGUIENTE">Siguiente pago</option><option value="ULTIMO">Último pago</option></select>
      <button class="btn-primary" id="p-guardar">Registrar pago (pendiente de conciliar)</button>
      <div class="login-err" id="p-err"></div>
      <div class="note" style="margin-top:12px">El pago queda <b>PENDIENTE</b> y afecta saldo/banco solo cuando se aprueba en <b>Conciliación</b> — igual que el sistema actual.</div>
    </div></div>`);

  const err = ov.querySelector('#p-err');
  ov.querySelector('.back').addEventListener('click', () => ov.remove());
  ov.querySelector('#p-guardar').addEventListener('click', async () => {
    err.style.display='none';
    const datos = {
      cliente: nombre,
      monto: ov.querySelector('#p-monto').value,
      tipo: ov.querySelector('#p-tipo').value,
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
