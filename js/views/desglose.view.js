// Vista Desglose de cobros — réplica de la pantalla del Script.
// Selector mes/año · resumen · capital/interés · filtros (ejec/banco/periodo/cliente) · lista por día (acordeón).
import { el, money } from '../lib/dom.js';
import { construirDesglose, agruparPorDia, colorEjecutivo } from '../services/desglose.service.js';
import { fetchDesglose } from '../repositories/desglose.repo.js';

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

export async function abrirDesglose(perfil) {
  const ov = el(`<div class="overlay"><div class="ohead"><button class="back">\u2190</button><div class="ot">\ud83d\udcca Desglose de cobros</div></div><div class="ocontent"><div class="loader">Cargando\u2026</div></div></div>`);
  document.body.appendChild(ov);
  const c = ov.querySelector('.ocontent');
  ov.querySelector('.back').addEventListener('click', () => ov.remove());

  const rows = await fetchDesglose();
  const hoy = new Date();
  const esEjec = perfil.rol === 'EJECUTIVO';
  let mes = hoy.getMonth()+1, anio = hoy.getFullYear();
  let abiertos = {};

  const anios = []; for (let y=anio; y>=anio-2; y--) anios.push(y);

  // Estructura fija (los controles no se re-crean → el buscador no pierde foco)
  c.innerHTML = `
    <div class="dg-mesbar">
      <span class="dg-meslab">Mes</span>
      <select class="inp" id="d-mes" style="flex:1;margin:0">${MESES.map((nm,i)=>`<option value="${i+1}" ${i+1===mes?'selected':''}>${nm}</option>`).join('')}</select>
      <select class="inp" id="d-anio" style="flex:0 0 92px;margin:0">${anios.map(a=>`<option ${a===anio?'selected':''}>${a}</option>`).join('')}</select>
    </div>

    <div class="dg-banner">
      <div class="dg-banner-lab">Total cobrado <span id="d-mesv"></span></div>
      <div class="dg-banner-val num" id="d-total">$0</div>
    </div>
    <div class="kpis" style="grid-template-columns:1fr 1fr;margin-bottom:14px">
      <div class="kcard"><div class="klab">Capital recuperado</div><div class="kval num" id="d-cap">$0</div></div>
      <div class="kcard"><div class="klab">Inter\u00e9s (ganancia)</div><div class="kval num" id="d-int" style="color:var(--green)">$0</div></div>
    </div>

    <div class="fcard" style="margin-bottom:14px">
      <div style="display:flex;align-items:center;margin-bottom:10px">
        <span style="font-weight:600;font-size:.85em">\ud83d\udd0e Filtros</span>
        <span id="d-limpiar" style="margin-left:auto;font-size:.78em;color:var(--steel);cursor:pointer;font-weight:600">Limpiar</span>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:9px">
        ${!esEjec?`<div><label class="alab">Ejecutivo</label><select class="inp" id="d-ejec"></select></div>`:''}
        <div><label class="alab">Banco</label><select class="inp" id="d-banco"></select></div>
        <div style="grid-column:1 / -1"><label class="alab">Periodo</label>
          <select class="inp" id="d-per"><option value="mes">Todo el mes</option><option value="hoy">Hoy</option><option value="sem">\u00daltimos 7 d\u00edas</option></select>
        </div>
      </div>
      <input class="inp" id="d-cli" placeholder="\ud83d\udd0d Buscar cliente\u2026" style="margin-top:9px">
    </div>

    <div id="d-lista"></div>
    <div id="d-foot" class="note" style="text-align:center;margin-top:10px"></div>`;

  const $ = sel => c.querySelector(sel);
  const selMes=$('#d-mes'), selAnio=$('#d-anio'), selEjec=$('#d-ejec'), selBanco=$('#d-banco'),
        selPer=$('#d-per'), inpCli=$('#d-cli');

  function fillSel(sel, todos, arr) {
    if (!sel) return; const cur = sel.value;
    sel.innerHTML = `<option value="">${todos}</option>` + arr.map(v=>`<option>${v}</option>`).join('');
    if (cur) sel.value = cur;
  }

  // Cargar el mes: repuebla selects de ejecutivo/banco y pinta
  function cargar() {
    mes = parseInt(selMes.value); anio = parseInt(selAnio.value);
    abiertos = {};
    const yyMM = `${anio}-${String(mes).padStart(2,'0')}`;
    const base = construirDesglose(rows, { yyMM }, perfil.rol, perfil.ejecutivo);
    fillSel(selEjec, 'Todos', base.ejecutivos);
    fillSel(selBanco, 'Todos', base.bancos);
    render();
  }

  // Pintar resumen + lista según los filtros (NO toca los controles)
  function render() {
    const yyMM = `${anio}-${String(mes).padStart(2,'0')}`;
    const r = construirDesglose(rows, {
      yyMM, ejecutivo: selEjec?selEjec.value:'', banco: selBanco.value,
      periodo: selPer.value, cliente: inpCli.value.trim(),
    }, perfil.rol, perfil.ejecutivo);

    $('#d-mesv').textContent = r.mesVista ? ('\u00b7 ' + r.mesVista) : '';
    $('#d-total').textContent = money(r.totales.monto);
    $('#d-cap').textContent = money(r.totales.capital);
    $('#d-int').textContent = money(r.totales.interes);

    const grupos = agruparPorDia(r.lista);
    const cont = $('#d-lista');
    if (!grupos.length) { cont.innerHTML = '<div class="note" style="text-align:center;padding:18px">Sin abonos con estos filtros.</div>'; $('#d-foot').textContent=''; return; }

    cont.innerHTML = grupos.map((g, i) => {
      if (abiertos[g.fechaISO] === undefined) abiertos[g.fechaISO] = (i === 0);
      const open = abiertos[g.fechaISO];
      const filas = open ? g.abonos.map(x => {
        const cp = colorEjecutivo(x.ejecutivo);
        return `<div class="dg-row">
          <div style="flex:1;min-width:0">
            <div class="dg-cli">${x.cliente||'\u2014'}</div>
            <div style="margin-top:3px;display:flex;align-items:center;gap:6px">
              <span class="dg-chip" style="background:${cp[0]};color:${cp[1]}">${x.ejecutivo||'\u2014'}</span>
              <span class="dg-bank">\ud83c\udfe6 ${x.cuenta||'\u2014'}</span>
            </div>
          </div>
          <div style="text-align:right;flex-shrink:0">
            <div class="dg-monto num">${money(x.monto)}</div>
            <div class="dg-ci">cap ${money(x.capital)} \u00b7 int ${money(x.interes)}</div>
          </div>
        </div>`;
      }).join('') : '';
      return `<div class="dg-card">
        <div class="dg-head" data-k="${g.fechaISO}">
          <span class="dg-arrow">${open?'\u25be':'\u25b8'}</span>
          <span class="dg-dia">${g.label}</span>
          <span class="dg-n">\u00b7 ${g.abonos.length} abono${g.abonos.length>1?'s':''}</span>
          <span class="dg-dtot num">${money(g.total)}</span>
        </div>${filas}</div>`;
    }).join('');

    cont.querySelectorAll('.dg-head').forEach(h => h.addEventListener('click', () => {
      const k = h.dataset.k; abiertos[k] = !abiertos[k]; render();
    }));
    $('#d-foot').textContent = `${r.total} abono${r.total>1?'s':''} \u00b7 ${money(r.totales.monto)} cobrado`;
  }

  selMes.addEventListener('change', cargar);
  selAnio.addEventListener('change', cargar);
  if (selEjec) selEjec.addEventListener('change', render);
  selBanco.addEventListener('change', render);
  selPer.addEventListener('change', render);
  inpCli.addEventListener('input', render);
  $('#d-limpiar').addEventListener('click', () => {
    if (selEjec) selEjec.value=''; selBanco.value=''; selPer.value='mes'; inpCli.value=''; render();
  });

  cargar();
}
