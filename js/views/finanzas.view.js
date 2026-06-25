// Vista Finanzas — Estado de resultados (P&L) con selector de mes/año. ADMIN/GERENTE.
import { el, money } from '../lib/dom.js';
import { construirBalance } from '../services/finanzas.service.js';
import { cargarBalance } from '../repositories/finanzas.repo.js';

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

export async function abrirFinanzas(perfil) {
  if (!['ADMIN','GERENTE'].includes(perfil.rol)) { alert('Solo Admin/Gerente ven Finanzas.'); return; }
  const ov = el(`<div class="overlay"><div class="ohead"><button class="back">←</button><div class="ot">Finanzas · Estado de resultados</div></div><div class="ocontent"><div class="loader">Cargando…</div></div></div>`);
  document.body.appendChild(ov);
  const c = ov.querySelector('.ocontent');
  ov.querySelector('.back').addEventListener('click', () => ov.remove());

  const datos = await cargarBalance();
  const hoy = new Date();
  let mes = hoy.getMonth(), anio = hoy.getFullYear();

  function row(lbl, val, opts={}) {
    const col = opts.col || '';
    return `<div class="liqrow ${opts.hl?'hl':''}"><span>${lbl}</span><b class="num" style="${col?('color:'+col):''}">${opts.signo||''}${money(val)}</b></div>`;
  }

  function pinta() {
    const b = construirBalance(datos.desglose, datos.movimientos, datos.cartera, datos.bancos, mes, anio);
    const aniosSel = [];
    for (let a=anio+1; a>=2024; a--) aniosSel.push(a);
    c.innerHTML = `
      <div style="display:flex;gap:8px;margin-bottom:12px">
        <select class="inp" id="f-mes" style="flex:1">${MESES.map((nm,i)=>`<option value="${i}" ${i===mes?'selected':''}>${nm}</option>`).join('')}</select>
        <select class="inp" id="f-anio" style="flex:0 0 110px">${aniosSel.map(a=>`<option ${a===anio?'selected':''}>${a}</option>`).join('')}</select>
      </div>
      <div class="kpis"><div class="kcard ${b.ganancia>=0?'':''}"><div class="klab">Ganancia del mes</div><div class="kval num ${b.ganancia>=0?'green':''}" style="${b.ganancia<0?'color:var(--red)':''}">${money(b.ganancia)}</div><div class="kfoot">ingresos − gastos</div></div>
        <div class="kcard"><div class="klab">Saldos en bancos</div><div class="kval num">${money(b.saldosBancarios)}</div><div class="kfoot">hoy</div></div></div>

      <div class="sec-h"><span class="t">Ingresos</span><span class="ln"></span></div>
      <div class="fcard">
        ${row('Intereses cobrados', b.ingresos.intereses)}
        ${row('Multas cobradas', b.ingresos.multas)}
        ${row('Comisión por apertura', b.ingresos.comision)}
        ${b.ingresos.otros?row('Entradas extraordinarias', b.ingresos.otros):''}
        ${row('Total ingresos', b.ingresos.total, {hl:true, col:'var(--green)'})}
      </div>

      <div class="sec-h"><span class="t">Gastos</span><span class="ln"></span></div>
      <div class="fcard">
        ${row('Gastos fijos', b.egresos.gastosFijos, {signo:'−'})}
        ${row('Gastos varios', b.egresos.gastosVarios, {signo:'−'})}
        ${row('Nómina', b.egresos.nomina, {signo:'−'})}
        ${row('Intereses a inversionistas', b.egresos.interesesInversionistas, {signo:'−'})}
        ${row('Diligencias', b.egresos.diligencias, {signo:'−'})}
        ${row('Total gastos', b.egresos.total, {hl:true, col:'var(--red)', signo:'−'})}
      </div>

      <div class="sec-h"><span class="t">Informativo</span><span class="ln"></span></div>
      <div class="fcard">
        <div class="note">El capital cobrado no es ingreso: regresa a los inversionistas. La ganancia sale solo de intereses, multas y comisiones.</div>
      </div>`;
    c.querySelector('#f-mes').addEventListener('change', e=>{ mes=parseInt(e.target.value); pinta(); });
    c.querySelector('#f-anio').addEventListener('change', e=>{ anio=parseInt(e.target.value); pinta(); });
  }
  pinta();
}
