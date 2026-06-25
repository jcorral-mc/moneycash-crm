// Vista Alta de cliente / Alta manual (réplica de altaVistaPrevia + altaEnviarACartera).
// Solo ADMIN / AUX_ADMIN. Genera el calendario con las reglas del Script.
import { el, money } from '../lib/dom.js';
import { vistaPrevia, construirAlta } from '../services/calendario.service.js';
import { existeCliente, crearAlta, fetchEjecutivos } from '../repositories/alta.repo.js';
import { fetchBancos } from '../repositories/bancos.repo.js';
import { logAudit } from '../lib/audit.js';

export function abrirAlta(perfil, onDone) {
  if (!['ADMIN','AUX_ADMIN'].includes(perfil.rol)) { alert('Solo administración puede dar de alta clientes.'); return; }
  const ov = el(`<div class="overlay">
    <div class="ohead"><button class="back">←</button><div class="ot">Nuevo cliente (alta manual)</div></div>
    <div class="ocontent">
      <label class="alab">Nombre</label><input class="inp" id="a-nombre" style="text-transform:uppercase" autocapitalize="characters">
      <label class="alab">Ejecutivo</label><select class="inp" id="a-ejec"><option value="">Cargando…</option></select>
      <label class="alab">Frecuencia</label>
      <select class="inp" id="a-freq"><option>SEMANAL</option><option>QUINCENAL</option><option>MENSUAL</option><option>AMERICANO</option></select>
      <label class="alab">Monto del crédito</label><input class="inp" id="a-monto" inputmode="decimal">
      <label class="alab">Plazo (número de pagos)</label><input class="inp" id="a-plazo" inputmode="numeric">
      <label class="alab">Abono puntual (por pago)</label><input class="inp" id="a-abp" inputmode="decimal">
      <label class="alab">Abono impuntual (por pago)</label><input class="inp" id="a-abi" inputmode="decimal">
      <label class="alab">Comisión por apertura</label><input class="inp" id="a-com" inputmode="decimal" value="0">
      <label class="alab">Tipo de comisión</label>
      <select class="inp" id="a-tcom"><option value="DESCONTADA">Descontada (sale monto − comisión)</option><option value="FINANCIADA">Financiada (se suma al crédito)</option></select>
      <label class="alab">Fecha de surtido</label><input class="inp" id="a-fecha" type="date">
      <label class="alab">Banco de salida (de dónde sale el dinero)</label><select class="inp" id="a-banco"><option value="">Cargando…</option></select>
      <button class="btn-primary" id="a-prev">Ver calendario (vista previa)</button>
      <div id="a-preview"></div>
      <div class="login-err" id="a-err"></div>
    </div></div>`);
  document.body.appendChild(ov);
  ov.querySelector('.back').addEventListener('click', () => ov.remove());
  ov.querySelector('#a-fecha').value = new Date().toISOString().slice(0,10);

  // Cargar ejecutivos y bancos en sus selectores
  (async () => {
    const [ejs, bancos] = await Promise.all([fetchEjecutivos(), fetchBancos()]);
    const selE = ov.querySelector('#a-ejec');
    selE.innerHTML = '<option value="">Selecciona ejecutivo</option>' + ejs.map(e => `<option>${e}</option>`).join('');
    const selB = ov.querySelector('#a-banco');
    selB.innerHTML = '<option value="">Selecciona banco</option>' + bancos.map(b => `<option value="${b.cuenta}">${b.cuenta} · ${money(b.saldo_sistema || 0)}</option>`).join('');
  })();

  const datos = () => ({
    nombre: ov.querySelector('#a-nombre').value.trim().toUpperCase(), ejecutivo: ov.querySelector('#a-ejec').value,
    frecuencia: ov.querySelector('#a-freq').value, tipo: ov.querySelector('#a-freq').value==='AMERICANO'?'AMERICANO':'PERSONAL',
    monto: ov.querySelector('#a-monto').value, plazo: ov.querySelector('#a-plazo').value,
    abonoPuntual: ov.querySelector('#a-abp').value, abonoImpuntual: ov.querySelector('#a-abi').value,
    comision: ov.querySelector('#a-com').value, tipoComision: ov.querySelector('#a-tcom').value,
    fechaSurtido: ov.querySelector('#a-fecha').value, banco: ov.querySelector('#a-banco').value,
  });

  ov.querySelector('#a-prev').addEventListener('click', () => {
    const err = ov.querySelector('#a-err'); err.style.display='none';
    try {
      const p = vistaPrevia(datos());
      ov.querySelector('#a-preview').innerHTML = `
        <div class="fcard" style="margin-top:12px">
          <div class="liqrow"><span>Capital</span><b class="num">${money(p.capital)}</b></div>
          <div class="liqrow"><span>Se entrega (dispersión)</span><b class="num">${money(p.dispersion)}</b></div>
          <div class="liqrow"><span>Interés total</span><b class="num">${money(p.interesTotal)}</b></div>
          <div class="liqrow hl"><span>Saldo total</span><b class="num">${money(p.saldoTotal)}</b></div>
          <div class="liqrow"><span>% capital / % interés</span><b class="num">${p.pctCap}% / ${p.pctInt}%</b></div>
        </div>
        <div class="sec-h"><span class="t">Calendario (${p.calendario.length} pagos)</span><span class="ln"></span></div>
        <div class="fcard" style="padding:4px">
          ${p.calendario.map(f=>`<div class="pago"><div class="izq"><span class="np">#${f.nPago}</span><span>${f.fecha}</span></div><span class="num" style="font-weight:600">${money(f.montoPuntual)}</span></div>`).join('')}
        </div>
        <button class="btn-primary" id="a-guardar" style="background:var(--green)">Dar de alta y generar calendario</button>`;
      ov.querySelector('#a-guardar').addEventListener('click', guardar);
    } catch (e) { err.textContent = e.message; err.style.display='block'; }
  });

  async function guardar() {
    const err = ov.querySelector('#a-err'); err.style.display='none';
    const d = datos();
    try {
      if (!d.ejecutivo) throw new Error('Selecciona el ejecutivo.');
      if (!d.banco) throw new Error('Selecciona el banco de salida.');
      if (await existeCliente(d.nombre.trim())) { if (!confirm('Ese cliente ya existe en cartera. ¿Crear de todos modos? (puede duplicar)')) return; }
      const { cartera, calendarioRows, resumen } = construirAlta(d);
      await crearAlta(cartera, calendarioRows, { banco: d.banco, monto: resumen.dispersion }, perfil);
      await logAudit(perfil, 'ALTA_CLIENTE', cartera.nombre, `capital ${resumen.capital}, ${resumen.nPagos} pagos, ${cartera.frecuencia}, banco ${d.banco}`);
      alert(`✅ ${cartera.nombre} dado de alta. Capital ${money(resumen.capital)}, ${resumen.nPagos} pagos. Se descontaron ${money(resumen.dispersion)} de ${d.banco}.`);
      ov.remove(); if (onDone) onDone();
    } catch (e) { err.textContent = e.message||'No se pudo dar de alta.'; err.style.display='block'; }
  }
}
