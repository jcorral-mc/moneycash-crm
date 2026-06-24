// Vista Desglose — consulta de cobros con filtros (mes, ejecutivo, cliente). Export CSV.
import { el, money } from '../lib/dom.js';
import { construirDesglose } from '../services/desglose.service.js';
import { fetchDesglose } from '../repositories/desglose.repo.js';

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

export async function abrirDesglose(perfil) {
  const ov = el(`<div class="overlay"><div class="ohead"><button class="back">←</button><div class="ot">Desglose de cobros</div></div><div class="ocontent"><div class="loader">Cargando…</div></div></div>`);
  document.body.appendChild(ov);
  const c = ov.querySelector('.ocontent');
  ov.querySelector('.back').addEventListener('click', () => ov.remove());

  const rows = await fetchDesglose();
  const hoy = new Date();
  let mes = hoy.getMonth()+1, anio = hoy.getFullYear(), fEjec = '', fCli = '';
  const esEjec = perfil.rol === 'EJECUTIVO';

  function pinta() {
    const yyMM = `${anio}-${String(mes).padStart(2,'0')}`;
    const r = construirDesglose(rows, { yyMM, ejecutivo:fEjec, cliente:fCli }, perfil.rol, perfil.ejecutivo);
    const anios=[]; for (let y=anio+1; y>=2024; y--) anios.push(y);
    c.innerHTML = `
      <div style="display:flex;gap:8px;margin-bottom:8px">
        <select class="inp" id="d-mes" style="flex:1">${MESES.map((nm,i)=>`<option value="${i+1}" ${i+1===mes?'selected':''}>${nm}</option>`).join('')}</select>
        <select class="inp" id="d-anio" style="flex:0 0 100px">${anios.map(a=>`<option ${a===anio?'selected':''}>${a}</option>`).join('')}</select>
      </div>
      <div style="display:flex;gap:8px;margin-bottom:10px">
        ${!esEjec?`<select class="inp" id="d-ejec" style="flex:1"><option value="">Todos los ejecutivos</option>${r.ejecutivos.map(e=>`<option ${e===fEjec?'selected':''}>${e}</option>`).join('')}</select>`:''}
        <input class="inp" id="d-cli" placeholder="Buscar cliente" value="${fCli}" style="flex:1;margin:0">
      </div>
      <div class="fcard" style="margin-bottom:10px">
        <div class="liqrow"><span>Cobros</span><b class="num">${r.total}</b></div>
        <div class="liqrow"><span>Total cobrado</span><b class="num">${money(r.totales.pago)}</b></div>
        <div class="liqrow"><span>Capital</span><b class="num">${money(r.totales.capital)}</b></div>
        <div class="liqrow"><span>Interés</span><b class="num gold">${money(r.totales.interes)}</b></div>
        <div class="liqrow"><span>Multas</span><b class="num">${money(r.totales.multa)}</b></div>
      </div>
      <button class="btn-primary" id="d-csv" style="margin-bottom:10px;background:var(--steel)">Exportar CSV</button>
      ${r.lista.slice(0,300).map(x=>`<div class="cli" style="display:block">
        <div style="display:flex;justify-content:space-between"><div><div class="nm">${x.cliente}</div><div class="mt">${x.fecha} · ${x.ejecutivo}${x.tipo?(' · '+x.tipo):''}</div></div>
        <div style="text-align:right"><div class="sal num">${money(x.pago)}</div><div class="mt">int ${money(x.interes)}${x.multa?(' · multa '+money(x.multa)):''}</div></div></div>
      </div>`).join('') || '<div class="note">Sin cobros con esos filtros.</div>'}
      ${r.lista.length>300?`<div class="note" style="margin-top:8px">Mostrando 300 de ${r.lista.length}. Afina los filtros o exporta el CSV.</div>`:''}`;

    c.querySelector('#d-mes').addEventListener('change', e=>{ mes=parseInt(e.target.value); pinta(); });
    c.querySelector('#d-anio').addEventListener('change', e=>{ anio=parseInt(e.target.value); pinta(); });
    const se=c.querySelector('#d-ejec'); if(se) se.addEventListener('change', e=>{ fEjec=e.target.value; pinta(); });
    const sc=c.querySelector('#d-cli'); sc.addEventListener('input', e=>{ fCli=e.target.value; pinta(); setTimeout(()=>{ const n=c.querySelector('#d-cli'); if(n){n.focus(); n.setSelectionRange(n.value.length,n.value.length);} },0); });
    c.querySelector('#d-csv').addEventListener('click', ()=>exportar(r.lista, yyMM));
  }

  function exportar(lista, yyMM) {
    const cab = ['Fecha','Cliente','Ejecutivo','Pago','Capital','Interes','Multa','Tipo','FormaPago'];
    const csv = [cab.join(',')].concat(lista.map(x=>[x.fecha,`"${x.cliente}"`,x.ejecutivo,x.pago,x.capital,x.interes,x.multa,x.tipo,x.formaPago].join(','))).join('\n');
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv],{type:'text/csv'})); a.download = `desglose_${yyMM}.csv`; a.click();
  }
  pinta();
}
