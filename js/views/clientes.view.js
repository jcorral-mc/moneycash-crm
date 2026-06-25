// Vista Clientes — réplica EXACTA de clientes.html del Script (funciones/flujo/campos).
import { el, money, norm } from '../lib/dom.js';
import { fetchCartera, fetchAllCalendarios, fetchCalendarioCliente, fetchComentarios, descuentoVigente } from '../repositories/clientes.repo.js';
import { agruparCalendario, construirCartera, ordenarCartera, construirFicha } from '../services/clientes.service.js';
import { abrirAplicarPago } from './pago.view.js';
import { abrirAlta } from './alta.view.js';

const CHIP = {
  PAGADO:['pag','PAGADO'], PAGO_MINIMO:['min','PAGO MÍNIMO'], PAGADO_TARDE:['tar','PAGÓ TARDE'],
  EXT_MINIMO:['ext','EXT MÍNIMO'], PARCIAL:['par','PARCIAL'], VENCIDO:['ven','VENCIDO'], PENDIENTE:['pen','PENDIENTE'],
};
const TIPOS = ['SEMANAL','QUINCENAL','MENSUAL','AMERICANO'];

export async function renderClientes(perfil) {
  const root = el('<div class="view"><div class="loader">Cargando clientes…</div></div>');
  const [cartera, cals] = await Promise.all([fetchCartera(), fetchAllCalendarios()]);
  const calBy = agruparCalendario(cals);
  const lista = construirCartera(cartera, calBy, perfil.rol, perfil.ejecutivo);
  const ejecutivos = [...new Set(lista.map(c=>c.ejecutivo).filter(Boolean))].sort();
  const puedeAlta = ['ADMIN','AUX_ADMIN'].includes(perfil.rol);

  root.innerHTML = `
    ${puedeAlta ? `<div style="display:flex;justify-content:flex-end;margin-bottom:4px">
      <button id="cl-nuevo" style="background:none;border:none;color:var(--steel);font-size:.82em;font-weight:600;cursor:pointer;padding:2px 0;display:inline-flex;align-items:center;gap:3px">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>Nuevo cliente
      </button>
    </div>` : ''}
    <input class="inp" id="cl-q" placeholder="Buscar cliente…">
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:8px 0">
      <select class="inp" id="cl-ej"><option value="">Todos los ejecutivos</option>${ejecutivos.map(e=>`<option>${e}</option>`).join('')}</select>
      <select class="inp" id="cl-tipo"><option value="">Todos los tipos</option>${TIPOS.map(t=>`<option>${t}</option>`).join('')}</select>
      <select class="inp" id="cl-est"><option value="">Todos los estados</option><option value="VENCIDO">Vencidos</option><option value="AL DIA">Al día</option></select>
      <select class="inp" id="cl-ord"><option value="venc">Ordenar: + vencido</option><option value="nombre">Nombre A-Z</option><option value="surt">Fecha surtimiento</option><option value="vencim">Fecha vencimiento</option><option value="saldo">Mayor saldo</option></select>
    </div>
    <div class="resumen" id="cl-res"></div>
    <div id="cl-list"></div>`;

  const btnNuevo = root.querySelector('#cl-nuevo');
  if (btnNuevo) btnNuevo.addEventListener('click', () => abrirAlta(perfil, () => recargar()));
  function recargar(){ renderClientes(perfil).then(n => { const v = root.parentNode; if (v){ v.replaceChild(n, root); } }); }

  const q = root.querySelector('#cl-q'), ej = root.querySelector('#cl-ej'), tipo = root.querySelector('#cl-tipo'),
        est = root.querySelector('#cl-est'), ord = root.querySelector('#cl-ord'),
        res = root.querySelector('#cl-res'), list = root.querySelector('#cl-list');

  function pinta() {
    const texto=(q.value||'').trim().toLowerCase();
    let l = lista.filter(c => c.nombre.toLowerCase().includes(texto));
    if (ej.value)   l = l.filter(c => c.ejecutivo === ej.value);
    if (tipo.value) l = l.filter(c => String(c.frecuencia||'').toUpperCase() === tipo.value);
    if (est.value)  l = l.filter(c => c.estado === est.value);
    l = ordenarCartera(l, ord.value);
    res.textContent = `${l.length} clientes · cartera ${money(l.reduce((s,c)=>s+c.saldo,0))}`;
    list.innerHTML = l.map(c => {
      const amer = String(c.frecuencia||'').toUpperCase().indexOf('AMERICANO') >= 0;
      const n = encodeURIComponent(c.nombre);
      return `<div class="cli ${c.estado==='VENCIDO'?'mora':''}" style="display:block">
        <div class="cli-row" data-n="${n}" style="display:flex;justify-content:space-between;align-items:center;cursor:pointer">
          <div style="min-width:0"><div class="nm">${c.nombre}</div><div class="mt">${c.ejecutivo||'—'} · ${c.frecuencia||'—'}</div></div>
          <div style="text-align:right"><div class="sal num ${c.estado==='VENCIDO'?'r':''}">${money(c.saldo)}</div>
            <div style="margin-top:4px"><span class="pill ${c.estado==='VENCIDO'?'mora':'ok'}">${c.estado==='VENCIDO'?'VENCIDO':'AL DÍA'}</span></div></div>
        </div>
        <button class="btn-primary cl-pagar" data-n="${n}" style="width:100%;margin-top:9px;background:var(--gold);color:var(--navy)">Pagar${amer?' (Americano)':''}</button>
      </div>`;
    }).join('') || '<div class="loader">Sin resultados</div>';
    list.querySelectorAll('.cli-row').forEach(r => r.addEventListener('click', () => abrirFicha(decodeURIComponent(r.dataset.n), perfil)));
    list.querySelectorAll('.cl-pagar').forEach(b => b.addEventListener('click', (e) => { e.stopPropagation(); abrirAplicarPago(decodeURIComponent(b.dataset.n), perfil, () => {}); }));
  }
  [q].forEach(e=>e.addEventListener('input', pinta));
  [ej,tipo,est,ord].forEach(e=>e.addEventListener('change', pinta));
  pinta();
  return root;
}

export async function abrirFicha(nombre, perfil) {
  const carteraRows = await fetchCartera();
  const cRow = carteraRows.find(x => norm(x.nombre) === norm(nombre)) || { nombre };
  const [cal, coments, descAut] = await Promise.all([fetchCalendarioCliente(nombre), fetchComentarios(nombre), descuentoVigente(nombre)]);
  const f = construirFicha(cRow, cal);
  f.descuentoAutorizado = descAut;

  const cajaDesc = (f.descuentoAutorizado != null)
    ? `<div style="background:rgba(124,92,255,.08);padding:10px;border-radius:10px;text-align:center;margin-top:8px">
         <div style="font-size:.68em;color:#7c5cff;font-weight:800">LIQUIDACIÓN AUTORIZADA HOY</div>
         <div class="num" style="font-size:1.3em;font-weight:800;color:#7c5cff">${money(f.descuentoAutorizado)}</div></div>`
    : `<div style="background:rgba(124,92,255,.06);padding:10px;border-radius:10px;text-align:center;margin-top:8px">
         <div style="font-size:.68em;color:#7c5cff;font-weight:800">DESCUENTO SUGERIDO (condona ${f.pctCondonaInteres}% interés)</div>
         <div class="num" style="font-size:1.3em;font-weight:800;color:#7c5cff">${money(f.descuentoSugerido)}</div>
         <div style="font-size:.64em;color:var(--slate);margin-top:2px">Liquidar al 50% interés: ${money(f.liquidar50)}</div></div>`;

  const ov = el(`<div class="overlay" id="ficha-ov">
    <div class="ohead"><button class="back">←</button><div class="ot">${f.nombre||nombre}</div></div>
    <div class="ocontent"></div></div>`);
  const c = ov.querySelector('.ocontent');
  c.innerHTML = `
    <div class="fcard">
      <div class="fn">${f.nombre||nombre}</div>
      <div class="fm">${f.ejecutivo||'—'} · ${f.frecuencia||'—'}</div>
      <div class="ftrip">
        <div class="fc"><div class="l">SURTIDO</div><div class="v" style="font-size:.85em">${f.surtimiento}</div></div>
        <div class="fc"><div class="l">VENCE</div><div class="v" style="font-size:.85em">${f.vencimiento}</div></div>
        <div class="fc"><div class="l">SALDO HOY</div><div class="v num" style="color:var(--navy)">${money(f.saldo)}</div></div>
      </div>
    </div>
    <div class="cnt4">
      <div class="cnt"><div class="n num" style="color:var(--green)">${f.pagadosATiempo}</div><div class="l">A TIEMPO</div></div>
      <div class="cnt"><div class="n num" style="color:var(--amber)">${f.pagadosTarde}</div><div class="l">TARDE</div></div>
      <div class="cnt"><div class="n num" style="color:var(--slate)">${f.pendientes}</div><div class="l">PENDIENTES</div></div>
      <div class="cnt"><div class="n num" style="color:var(--red)">${f.vencidos}</div><div class="l">VENCIDOS</div></div>
    </div>
    <div class="sec-h"><span class="t">Capital y liquidación</span><span class="ln"></span></div>
    <div class="fcard">
      <div class="liqrow"><span>Capital original</span><b class="num">${money(f.capitalOriginal)}</b></div>
      <div class="liqrow"><span>Capital pagado (${f.pctCapitalPagado}%)</span><b class="num" style="color:var(--green)">${money(f.capitalPagado)}</b></div>
      <div class="liqrow"><span>Capital pendiente</span><b class="num">${money(f.capitalPend)}</b></div>
      <div class="liqrow"><span>Interés pendiente</span><b class="num" style="color:var(--amber)">${money(f.intPend)}</b></div>
      ${cajaDesc}
    </div>
    <button class="btn-primary" id="f-pago" style="margin-top:12px">Aplicar pago</button>
    <div class="sec-h"><span class="t">Calendario de pagos</span><span class="ln"></span></div>
    <div class="fcard" style="padding:4px">
      ${f.calendario.map(p=>{const ch=CHIP[p.estado]||CHIP.PENDIENTE; const monto=p.estado==='PAGADO_TARDE'?p.montoImpuntual:p.montoPuntual;
        const sub = p.estado==='PARCIAL' ? `<div style="font-size:.8em;color:var(--amber);margin-top:2px">Abonado ${money(p.pagado)} · faltan ${money(p.falta)}</div>` : '';
        return `<div class="pago"><div style="width:100%"><div style="display:flex;justify-content:space-between;align-items:center">
          <div class="izq"><span class="np">#${p.nPago||''}</span><span>${p.fecha}</span></div>
          <div style="display:flex;align-items:center;gap:8px"><span class="num" style="font-weight:600">${money(monto)}</span><span class="chip ${ch[0]}">${ch[1]}</span></div>
        </div>${sub}</div></div>`;}).join('') || '<div class="loader">Sin calendario</div>'}
    </div>
    <div class="sec-h"><span class="t">Comentarios de cobranza</span><span class="ln"></span></div>
    ${coments.map(cm=>`<div class="coment"><div class="ch"><span>${cm.autor||'—'}${cm.estado?(' · '+cm.estado):''}</span><span>${cm.fecha||''}</span></div><div class="ct">${cm.comentario||''}</div></div>`).join('') || '<div class="loader">Sin comentarios</div>'}
  `;
  ov.querySelector('.back').addEventListener('click', () => ov.remove());
  const btnPago = ov.querySelector('#f-pago');
  if (btnPago) btnPago.addEventListener('click', () => abrirAplicarPago(nombre, perfil, () => { ov.remove(); abrirFicha(nombre, perfil); }));
  document.body.appendChild(ov);
}

// Abre Cartera/Clientes como overlay (desde el inicio agrupado).
export async function abrirClientes(perfil) {
  const ov = el(`<div class="overlay"><div class="ohead"><button class="back">←</button><div class="ot">Cartera / Clientes</div></div><div class="ocontent"><div class="loader">Cargando…</div></div></div>`);
  document.body.appendChild(ov);
  ov.querySelector('.back').addEventListener('click', () => ov.remove());
  const node = await renderClientes(perfil);
  const c = ov.querySelector('.ocontent'); c.innerHTML=''; c.appendChild(node);
}
