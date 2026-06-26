// Cotizador — MÓDULO INDEPENDIENTE (para todos). Es el inicio real del proceso:
// al "Crear prospecto" entra a la Tubería ya con el proceso iniciado (sin pasar por "Empezar proceso").
import { el, money } from '../lib/dom.js';
import { cotizar, FRECUENCIAS } from '../services/cotizador.service.js';
import * as repo from '../repositories/tuberia.repo.js';

const TIPOS = [['PERSONAL', 'Personal (10.7%)'], ['CONVENIO', 'Convenio (2.0%)'], ['GOBIERNO', 'Gobierno/Negocio (10%)'], ['AMERICANO', 'Americano (10-15%)']];
const PLAZOS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 20, 24];
const EJECUTIVOS = ['CESAR', 'LORENA', 'EDUARDO', 'PACO', 'TABATA', 'JORGE', 'HUGO', 'LAURA'];
const MUNICIPIOS = ['GUADALAJARA', 'ZAPOPAN', 'TLAQUEPAQUE', 'TONALA'];
const SUCURSALES = [['GDL', 'Guadalajara'], ['ARENAL', 'Guadalajara 2']];

export async function abrirCotizador(perfil) {
  const ov = el(`<div class="overlay"><div class="ohead"><button class="back">←</button><div class="ot">Cotizador</div></div>
    <div class="ocontent tv"></div></div>`);
  document.body.appendChild(ov);
  ov.querySelector('.back').addEventListener('click', () => ov.remove());
  const root = ov.querySelector('.ocontent');

  root.innerHTML = `<div class="card"><h4>Nueva cotización</h4>
    <div class="ev-item"><label>Monto</label><input class="inp" id="c-monto" inputmode="decimal" placeholder="Ej. 10000"></div>
    <div class="ev-item"><label>Tipo de crédito</label><select class="inp" id="c-tipo">${TIPOS.map(t => `<option value="${t[0]}">${t[1]}</option>`).join('')}</select></div>
    <div class="ev-item"><label>Frecuencia</label><select class="inp" id="c-frec">${FRECUENCIAS.map(f => `<option>${f}</option>`).join('')}</select></div>
    <div class="ev-item"><label>Plazo</label><select class="inp" id="c-plazo">${PLAZOS.map(p => `<option ${p === 12 ? 'selected' : ''}>${p}</option>`).join('')}</select></div>
    <div class="ev-item"><label>Comisión (%)</label><input class="inp" id="c-com" inputmode="decimal" value="5"></div>
    <label class="doc-chk" style="margin-bottom:10px"><input type="checkbox" id="c-fin"> Financiar comisión (sumar al crédito)</label>
    <div id="c-prev"></div>
  </div>
  <div class="card"><h4>Datos del prospecto</h4>
    <div class="ev-item"><label>Nombre completo</label><input class="inp" id="c-nombre"></div>
    <div class="ev-item"><label>Teléfono (WhatsApp)</label><input class="inp" id="c-tel" inputmode="numeric" maxlength="10"></div>
    <div class="ev-item"><label>Ejecutivo</label><select class="inp" id="c-ej"><option value="">— elige —</option>${EJECUTIVOS.map(e => `<option>${e}</option>`).join('')}</select></div>
    <div class="ev-item"><label>Sucursal</label><select class="inp" id="c-suc">${SUCURSALES.map(s => `<option value="${s[0]}">${s[1]}</option>`).join('')}</select></div>
    <div class="ev-item"><label>Municipio</label><select class="inp" id="c-mun">${MUNICIPIOS.map(m => `<option>${m}</option>`).join('')}</select></div>
    <div class="ev-item"><label>Colonia</label><input class="inp" id="c-col"></div>
  </div>
  <button class="primary big" id="c-crear">Crear prospecto → Tubería</button>`;

  const val = () => {
    const com = parseFloat(root.querySelector('#c-com').value) || 0;
    const monto = parseFloat(root.querySelector('#c-monto').value) || 0;
    return {
      monto, plazo: parseInt(root.querySelector('#c-plazo').value) || 0,
      tipo: root.querySelector('#c-tipo').value, frecuencia: root.querySelector('#c-frec').value,
      financiar: root.querySelector('#c-fin').checked,
      comisionPct: com, comision: Math.round(monto * com / 100),
      nombre: root.querySelector('#c-nombre').value.trim(), telefono: root.querySelector('#c-tel').value.trim(),
      ejecutivo: root.querySelector('#c-ej').value, sucursal: root.querySelector('#c-suc').value,
      municipio: root.querySelector('#c-mun').value, colonia: root.querySelector('#c-col').value.trim(),
    };
  };

  const prev = () => {
    const d = val();
    const box = root.querySelector('#c-prev');
    if (!d.monto || !d.plazo) { box.innerHTML = ''; return null; }
    try {
      const c = cotizar(d);
      box.innerHTML = `<div class="liqrow"><span>Abono puntual</span><b class="num">${money(c.abonoPuntual)}</b></div>
        <div class="liqrow"><span>Comisión</span><b class="num">${money(c.comision)} ${d.financiar ? '(financiada)' : '(descontada)'}</b></div>
        <div class="liqrow"><span>Depósito al cliente</span><b class="num">${money(c.deposito)}</b></div>
        <div class="liqrow"><span>Total a pagar</span><b class="num">${money(c.totalPuntual)}</b></div>`;
      return c;
    } catch (e) { box.innerHTML = `<div class="err-box">${e.message}</div>`; return null; }
  };
  ['#c-monto', '#c-tipo', '#c-frec', '#c-plazo', '#c-com', '#c-fin'].forEach(s => {
    const el2 = root.querySelector(s); el2.addEventListener('input', prev); el2.addEventListener('change', prev);
  });

  root.querySelector('#c-crear').addEventListener('click', async () => {
    const d = val(); const c = prev();
    if (!c) { alert('Revisa monto y plazo.'); return; }
    if (!d.nombre) { alert('Falta el nombre.'); return; }
    if (!d.ejecutivo) { alert('Elige el ejecutivo.'); return; }
    const btn = root.querySelector('#c-crear'); btn.disabled = true;
    try {
      // El cotizador es el inicio: el prospecto entra a la Tubería con el proceso ya iniciado.
      c.proceso = { iniciado: true, fecha: new Date().toISOString().slice(0, 10), por: (perfil && perfil.email) || '' };
      const res = await repo.crearProspecto(d, c, perfil);
      alert(res.msg + '\nYa está en la Tubería, en Evaluación.');
      ov.remove();
    } catch (e) { alert('❌ ' + e.message); btn.disabled = false; }
  });

  prev();
}
