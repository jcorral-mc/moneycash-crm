// Vista Clientes — lista + ficha. Réplica de clientes.html del Script (look bancario).
import { el, money, norm, iniciales } from '../lib/dom.js';
import { fetchCartera, fetchAllCalendarios, fetchCalendarioCliente, fetchComentarios } from '../repositories/clientes.repo.js';
import { agruparCalendario, construirCartera, construirFicha } from '../services/clientes.service.js';
import { abrirAplicarPago } from './pago.view.js';
import { abrirAlta } from './alta.view.js';

const CHIP = {
  PAGADO:['pag','PAGADO'], PAGO_MINIMO:['min','MÍNIMO'], PAGADO_TARDE:['tar','PAGÓ TARDE'],
  EXT_MINIMO:['ext','EXT MÍN'], PARCIAL:['par','PARCIAL'], VENCIDO:['ven','VENCIDO'], PENDIENTE:['pen','PENDIENTE'],
};

export async function renderClientes(perfil) {
  const root = el('<div class="view"><div class="loader">Cargando clientes…</div></div>');
  const [cartera, cals] = await Promise.all([fetchCartera(), fetchAllCalendarios()]);
  const calBy = agruparCalendario(cals);
  const lista = construirCartera(cartera, calBy, perfil.rol, perfil.ejecutivo);
  const ejecutivos = [...new Set(lista.map(c=>c.ejecutivo).filter(Boolean))].sort();

  const puedeAlta = ['ADMIN','AUX_ADMIN'].includes(perfil.rol);
  root.innerHTML = `
    ${puedeAlta ? '<button class="btn-primary" id="cl-nuevo" style="margin-bottom:10px">+ Nuevo cliente</button>' : ''}
    <input class="inp" id="cl-q" placeholder="Buscar cliente…">
    <select class="inp" id="cl-ej"><option value="">Todos los ejecutivos</option>${ejecutivos.map(e=>`<option>${e}</option>`).join('')}</select>
    <div class="resumen" id="cl-res"></div>
    <div id="cl-list"></div>`;

  const btnNuevo = root.querySelector('#cl-nuevo');
  if (btnNuevo) btnNuevo.addEventListener('click', () => abrirAlta(perfil, () => renderClientes(perfil).then(n => {
    const v = document.querySelector('.content'); if (v) { v.innerHTML=''; v.appendChild(n); }
  })));

  const q = root.querySelector('#cl-q'), ej = root.querySelector('#cl-ej');
  const res = root.querySelector('#cl-res'), list = root.querySelector('#cl-list');

  function pinta() {
    const texto = (q.value||'').trim().toLowerCase(), fe = ej.value;
    let l = lista.filter(c => c.nombre.toLowerCase().includes(texto));
    if (fe) l = l.filter(c => c.ejecutivo === fe);
    res.textContent = `${l.length} clientes · capital ${money(l.reduce((s,c)=>s+c.capital,0))} · por cobrar ${money(l.reduce((s,c)=>s+c.saldo,0))}`;
    list.innerHTML = l.map(c => `
      <div class="cli ${c.estado==='VENCIDO'?'mora':''}" data-n="${encodeURIComponent(c.nombre)}">
        <div style="min-width:0">
          <div class="nm">${c.nombre}</div>
          <div class="mt">${c.ejecutivo||'—'} · ${c.frecuencia||'—'} · cap ${money(c.capital)}</div>
          <div class="mt">Próximo: ${c.proxPago} · Vence: ${c.vencimiento}</div>
        </div>
        <div style="text-align:right">
          <div class="sal num ${c.estado==='VENCIDO'?'r':''}">${money(c.saldo)}</div>
          <div style="margin-top:4px"><span class="pill ${c.estado==='VENCIDO'?'mora':'ok'}">${c.estado==='VENCIDO'?'VENCIDO '+money(c.vencido):'AL DÍA'}</span></div>
        </div>
      </div>`).join('') || '<div class="loader">Sin resultados</div>';
    list.querySelectorAll('.cli').forEach(card => card.addEventListener('click', () => abrirFicha(decodeURIComponent(card.dataset.n), perfil)));
  }
  q.addEventListener('input', pinta); ej.addEventListener('change', pinta);
  pinta();
  return root;
}

export async function abrirFicha(nombre, perfil) {
  const carteraRows = await fetchCartera();
  const cRow = carteraRows.find(x => norm(x.nombre) === norm(nombre)) || { nombre };
  const [cal, coments] = await Promise.all([fetchCalendarioCliente(nombre), fetchComentarios(nombre)]);
  const f = construirFicha(cRow, cal);

  const ov = el(`<div class="overlay" id="ficha-ov">
    <div class="ohead"><button class="back">←</button><div class="ot">${f.nombre||nombre}</div></div>
    <div class="ocontent"></div></div>`);
  const c = ov.querySelector('.ocontent');
  c.innerHTML = `
    <div class="fcard">
      <div class="fn">${f.nombre||nombre}</div>
      <div class="fm">${f.ejecutivo||'—'} · ${f.frecuencia||'—'}</div>
      <div class="ftrip">
        <div class="fc"><div class="l">SALDO</div><div class="v num" style="color:var(--navy)">${money(f.saldo)}</div></div>
        <div class="fc"><div class="l">SURTIDO</div><div class="v" style="font-size:.8em">${f.surtimiento}</div></div>
        <div class="fc"><div class="l">VENCE</div><div class="v" style="font-size:.8em">${f.vencimiento}</div></div>
      </div>
    </div>
    <button class="btn-primary" id="f-pago">Aplicar pago</button>
    <div class="cnt4">
      <div class="cnt"><div class="n num" style="color:var(--green)">${f.pagadosATiempo}</div><div class="l">A TIEMPO</div></div>
      <div class="cnt"><div class="n num" style="color:var(--amber)">${f.pagadosTarde}</div><div class="l">TARDE</div></div>
      <div class="cnt"><div class="n num" style="color:var(--slate)">${f.pendientes}</div><div class="l">PENDIENTES</div></div>
      <div class="cnt"><div class="n num" style="color:var(--red)">${f.vencidos}</div><div class="l">VENCIDOS</div></div>
    </div>
    <div class="sec-h"><span class="t">Capital y liquidación</span><span class="ln"></span></div>
    <div class="fcard">
      <div class="liqrow"><span>Capital original</span><b class="num">${money(f.capitalOriginal)}</b></div>
      <div class="liqrow"><span>Capital pagado</span><b class="num">${money(f.capitalPagado)} · ${f.pctCapitalPagado}%</b></div>
      <div class="liqrow"><span>Capital pendiente</span><b class="num">${money(f.capitalPend)}</b></div>
      <div class="liqrow"><span>Interés pendiente</span><b class="num">${money(f.intPend)}</b></div>
      <div class="liqrow hl"><span>Liquidar HOY (completo)</span><b class="num">${money(f.capitalPend + f.intPend)}</b></div>
      <div class="liqrow"><span>Liquidar al 50% interés <i style="color:var(--slate);font-weight:400">(previa autorización)</i></span><b class="num">${money(f.liquidar50)}</b></div>
    </div>
    <div class="sec-h"><span class="t">Calendario de pagos</span><span class="ln"></span></div>
    <div class="fcard" style="padding:4px">
      ${f.calendario.map(p=>{const ch=CHIP[p.estado]||CHIP.PENDIENTE; const monto=p.estado.indexOf('PAGADO')>=0||p.estado==='PAGO_MINIMO'?(p.pagado||p.montoPuntual):p.montoPuntual;
        return `<div class="pago"><div class="izq"><span class="np">#${p.nPago||''}</span><span>${p.fecha}</span></div>
        <div style="display:flex;align-items:center;gap:8px"><span class="num" style="font-weight:600">${money(monto)}</span><span class="chip ${ch[0]}">${ch[1]}</span></div></div>`;}).join('') || '<div class="loader">Sin calendario</div>'}
    </div>
    <div class="sec-h"><span class="t">Comentarios de cobranza</span><span class="ln"></span></div>
    ${coments.map(cm=>`<div class="coment"><div class="ch"><span>${cm.autor||'—'}${cm.estado?(' · '+cm.estado):''}</span><span>${cm.fecha||''}</span></div><div class="ct">${cm.comentario||''}</div></div>`).join('') || '<div class="loader">Sin comentarios</div>'}
  `;
  ov.querySelector('.back').addEventListener('click', () => ov.remove());
  const btnPago = ov.querySelector('#f-pago');
  if (btnPago) btnPago.addEventListener('click', () => abrirAplicarPago(nombre, perfil, () => { ov.remove(); abrirFicha(nombre, perfil); }));
  document.body.appendChild(ov);
}
