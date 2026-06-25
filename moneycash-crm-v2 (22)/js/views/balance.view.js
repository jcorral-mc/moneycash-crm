// Vista "Balance del mes" — cómo vamos: ganancia, ingresos por tipo y gastos por categoría.
// Navega por mes (anterior/siguiente). ADMIN / GERENTE / AUX_ADMIN.
import { el, money } from '../lib/dom.js';
import { cargarBalanceMes } from '../repositories/balance.repo.js';
import { construirBalanceMes } from '../services/balance.service.js';

export async function abrirBalance(perfil) {
  if (!['ADMIN', 'GERENTE', 'AUX_ADMIN'].includes(perfil.rol)) { alert('Solo administración.'); return; }
  const ov = el(`<div class="overlay"><div class="ohead"><button class="back">←</button><div class="ot">Balance del mes</div></div><div class="ocontent"><div class="loader">Calculando balance…</div></div></div>`);
  document.body.appendChild(ov);
  const c = ov.querySelector('.ocontent');
  ov.querySelector('.back').addEventListener('click', () => ov.remove());

  const data = await cargarBalanceMes();
  const hoy = new Date();
  let mes = hoy.getMonth(), anio = hoy.getFullYear();

  // Tarjeta colapsable (categoría → partidas)
  function grupo(titulo, sub, monto, items, signo = '') {
    if ((monto || 0) <= 0 && (!items || !items.length)) return '';
    const rows = (items || []).map(x =>
      `<div class="bal-it"><span>${x.label}${x.sub ? ` <span style="color:var(--slate)">· ${x.sub}</span>` : ''}${x.fecha ? ` <span style="color:var(--line2,#b9c6d4)">${x.fecha}</span>` : ''}</span><b class="num">${money(x.monto)}</b></div>`
    ).join('') || '<div class="bal-it" style="color:var(--slate)">Sin partidas</div>';
    return `<div class="bal-grp">
      <div class="bal-hd"><div style="flex:1;min-width:0"><div class="bal-tt">${titulo}</div>${sub ? `<div class="bal-sub">${sub}</div>` : ''}</div><b class="num">${signo}${money(monto)}</b><span class="bal-chev">▾</span></div>
      <div class="bal-body">${rows}</div></div>`;
  }

  function pinta() {
    const b = construirBalanceMes(data, mes, anio);
    const ing = ''
      + grupo('Interés cobrado', 'por ejecutivo', b.interes, b.interesPorEjecutivo.map(e => ({ label: e.ejecutivo, monto: e.monto })))
      + grupo('Multas', b.itemsMulta.length + ' cobro(s)', b.multas, b.itemsMulta.map(x => ({ label: x.cliente, sub: x.ejecutivo, fecha: x.fecha, monto: x.monto })))
      + grupo('Comisiones de apertura', b.itemsApertura.length + ' crédito(s)', b.apertura, b.itemsApertura.map(x => ({ label: x.cliente, sub: x.ejecutivo, monto: x.monto })));
    const gas = b.gastosPorTipo.map(g =>
      grupo(g.nombre, g.items.length + ' partida(s)', g.total, g.items.map(x => ({ label: x.concepto, fecha: x.fecha, monto: x.monto })))
    ).join('');

    c.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
        <button class="back" id="b-prev" style="padding:6px 12px">‹</button>
        <span style="font-weight:800;text-transform:capitalize">${b.etiqueta}</span>
        <button class="back" id="b-next" style="padding:6px 12px">›</button>
      </div>

      <div class="bal-hero">
        <div class="bal-hero-lab">Ganancia del mes</div>
        <div class="bal-hero-val">${money(b.ganancia)}</div>
        <div class="bal-hero-row">
          <div class="bal-hero-box"><div class="bal-hero-blab">Ingresos</div><div>${money(b.ingresos)}</div></div>
          <div class="bal-hero-box"><div class="bal-hero-blab">Gastos</div><div>${money(b.gastos)}</div></div>
          <div class="bal-hero-box"><div class="bal-hero-blab">Margen</div><div>${b.margen}%</div></div>
        </div>
      </div>

      <div class="sec-h"><span class="t">Ingresos</span><span class="ln"></span><b class="num" style="color:var(--green)">${money(b.ingresos)}</b></div>
      ${ing || '<div class="note">Sin ingresos este mes.</div>'}

      <div class="sec-h" style="margin-top:14px"><span class="t">Gastos</span><span class="ln"></span><b class="num" style="color:var(--red)">${money(b.gastos)}</b></div>
      ${gas || '<div class="note">Sin gastos este mes.</div>'}`;

    c.querySelector('#b-prev').addEventListener('click', () => { mes--; if (mes < 0) { mes = 11; anio--; } pinta(); });
    c.querySelector('#b-next').addEventListener('click', () => { mes++; if (mes > 11) { mes = 0; anio++; } pinta(); });
    c.querySelectorAll('.bal-hd').forEach(h => h.addEventListener('click', () => {
      const body = h.parentNode.querySelector('.bal-body'); const chev = h.querySelector('.bal-chev');
      const open = body.style.display !== 'none';
      body.style.display = open ? 'none' : 'block';
      chev.style.transform = open ? '' : 'rotate(180deg)';
    }));
  }

  pinta();
}
