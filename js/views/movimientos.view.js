// Vista Movimientos — gastos, nómina, intereses, diligencias, entradas extraordinarias.
// Cada uno afecta el banco automáticamente. Admin/Aux.
import { el, money } from '../lib/dom.js';
import { construirResumen, MOV_TIPOS, tipoInfo } from '../services/movimientos.service.js';
import { registrarMovimiento, fetchMovimientos } from '../repositories/movimientos.repo.js';
import { fetchBancos } from '../repositories/bancos.repo.js';

export async function abrirMovimientos(perfil) {
  if (!['ADMIN','AUX_ADMIN'].includes(perfil.rol)) { alert('Solo administración puede registrar movimientos.'); return; }
  const ov = el(`<div class="overlay"><div class="ohead"><button class="back">←</button><div class="ot">Movimientos</div></div><div class="ocontent"><div class="loader">Cargando…</div></div></div>`);
  document.body.appendChild(ov);
  const c = ov.querySelector('.ocontent');
  ov.querySelector('.back').addEventListener('click', () => ov.remove());

  async function cargar() {
    c.innerHTML = '<div class="loader">Cargando…</div>';
    const [movs, bancos] = await Promise.all([fetchMovimientos(), fetchBancos()]);
    const r = construirResumen(movs, null, null);

    c.innerHTML = `
      <div class="kpis"><div class="kcard"><div class="klab">Gran total del mes</div><div class="kval num">${money(r.granTotal)}</div><div class="kfoot">${r.etiqueta}</div></div></div>
      <button class="btn-primary" id="m-nuevo" style="margin-bottom:6px">+ Registrar movimiento</button>
      <div class="sec-h"><span class="t">Por tipo (${r.etiqueta})</span><span class="ln"></span></div>
      ${r.resumen.map(t=>`<div class="cli" style="cursor:default">
        <div><div class="nm">${t.tipo}</div><div class="mt">${t.count} movimientos · ${t.efecto}</div></div>
        <div class="sal num" style="color:${t.efecto==='INGRESO'?'var(--green)':'var(--red)'}">${t.efecto==='INGRESO'?'+':'−'}${money(t.total)}</div></div>`).join('')}
      <div id="m-detalle"></div>`;

    c.querySelector('#m-nuevo').addEventListener('click', () => formNuevo(bancos));

    // Detalle: nómina/intereses agrupados por persona
    const det = c.querySelector('#m-detalle');
    let html = '';
    MOV_TIPOS.filter(t=>t.persona).forEach(t => {
      const grupos = r.agrupados[t.tipo]||[];
      if (!grupos.length) return;
      html += `<div class="sec-h"><span class="t">${t.tipo} por persona</span><span class="ln"></span></div>`;
      html += grupos.map(g=>`<div class="cli" style="cursor:default"><div><div class="nm">${g.persona}</div><div class="mt">${g.movs.length} pagos</div></div><div class="sal num">${money(g.total)}</div></div>`).join('');
    });
    det.innerHTML = html;
  }

  function formNuevo(bancos) {
    const tiposOpts = MOV_TIPOS.map(t=>`<option value="${t.tipo}">${t.tipo}</option>`).join('');
    const sub = el(`<div class="overlay"><div class="ohead"><button class="back">←</button><div class="ot">Registrar movimiento</div></div>
      <div class="ocontent">
        <label class="alab">Tipo</label><select class="inp" id="m-tipo">${tiposOpts}</select>
        <label class="alab">Banco afectado</label><select class="inp" id="m-cuenta">${bancos.map(b=>`<option>${b.cuenta}</option>`).join('')}</select>
        <div id="m-persona-wrap" style="display:none"><label class="alab" id="m-persona-lab">Persona</label><input class="inp" id="m-persona" placeholder="Nombre"></div>
        <label class="alab">Concepto</label><input class="inp" id="m-concepto">
        <label class="alab">Monto</label><input class="inp" id="m-monto" inputmode="decimal">
        <label class="alab">Fecha</label><input class="inp" id="m-fecha" type="date">
        <label class="alab">Observaciones (opcional)</label><input class="inp" id="m-obs">
        <button class="btn-primary" id="m-go">Registrar y afectar banco</button>
        <div class="login-err" id="m-e"></div>
        <div class="note" id="m-efecto" style="margin-top:10px"></div></div></div>`);
    document.body.appendChild(sub);
    sub.querySelector('.back').addEventListener('click', ()=>sub.remove());
    sub.querySelector('#m-fecha').value = new Date().toISOString().slice(0,10);

    const tipoSel = sub.querySelector('#m-tipo'), pw = sub.querySelector('#m-persona-wrap'), pl = sub.querySelector('#m-persona-lab'), efe = sub.querySelector('#m-efecto');
    function refresh() {
      const info = tipoInfo(tipoSel.value);
      pw.style.display = info.persona ? 'block' : 'none';
      pl.textContent = info.tipo==='NOMINA' ? 'Empleado' : (info.tipo==='INTERESES' ? 'Inversionista' : 'Persona');
      efe.innerHTML = info.efecto==='INGRESO' ? 'Este movimiento <b>suma</b> al banco (entrada).' : 'Este movimiento <b>resta</b> del banco (salida).';
    }
    tipoSel.addEventListener('change', refresh); refresh();

    sub.querySelector('#m-go').addEventListener('click', async ()=>{
      const d = { tipo:tipoSel.value, cuenta:sub.querySelector('#m-cuenta').value, subconcepto:sub.querySelector('#m-persona').value,
        concepto:sub.querySelector('#m-concepto').value, monto:sub.querySelector('#m-monto').value, fecha:sub.querySelector('#m-fecha').value, obs:sub.querySelector('#m-obs').value };
      try { const res = await registrarMovimiento(d, perfil); alert(res.msg); sub.remove(); cargar(); }
      catch(e){ const er=sub.querySelector('#m-e'); er.textContent=e.message; er.style.display='block'; }
    });
  }

  cargar();
}
