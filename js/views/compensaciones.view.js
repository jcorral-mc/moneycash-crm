// Vista Compensaciones — tabla (admin/gerente) o medidor propio (ejecutivo). Config + corte (admin).
import { el, money } from '../lib/dom.js';
import { siguienteEscalon } from '../services/compensaciones.service.js';
import * as repo from '../repositories/compensaciones.repo.js';

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

export async function abrirCompensaciones(perfil) {
  const ov = el(`<div class="overlay"><div class="ohead"><button class="back">←</button><div class="ot">Compensaciones</div></div><div class="ocontent"><div class="loader">Cargando…</div></div></div>`);
  document.body.appendChild(ov);
  const c = ov.querySelector('.ocontent');
  ov.querySelector('.back').addEventListener('click', () => ov.remove());
  const hoy = new Date(); let mes = hoy.getMonth()+1, anio = hoy.getFullYear();
  const esEjec = perfil.rol === 'EJECUTIVO';

  function selectorMesAnio() {
    const anios=[]; for (let y=anio+1; y>=2025; y--) anios.push(y);
    return `<div style="display:flex;gap:8px;margin-bottom:12px">
      <select class="inp" id="cm-mes" style="flex:1">${MESES.map((nm,i)=>`<option value="${i+1}" ${i+1===mes?'selected':''}>${nm}</option>`).join('')}</select>
      <select class="inp" id="cm-anio" style="flex:0 0 110px">${anios.map(a=>`<option ${a===anio?'selected':''}>${a}</option>`).join('')}</select></div>`;
  }
  function barra(pct) {
    const w = Math.min(100, Math.max(0, pct));
    const col = pct>=100 ? 'var(--green)' : pct>=80 ? 'var(--gold)' : 'var(--steel)';
    return `<div class="ejbar-t" style="height:14px"><div class="ejbar-f" style="width:${w}%;background:${col}"></div></div>`;
  }

  async function cargarEjec() {
    c.innerHTML = '<div class="loader">Cargando…</div>';
    const { calc, apertura } = await repo.calcularEjecutivo(perfil.ejecutivo, anio, mes);
    const sig = siguienteEscalon(calc.pct);
    c.innerHTML = selectorMesAnio() + `
      <div class="kcard" style="margin-bottom:12px">
        <div class="klab">Tu cumplimiento — ${MESES[mes-1]} ${anio}</div>
        <div class="kval num ${calc.pct>=100?'green':''}" style="${calc.pct<100&&calc.pct>=80?'color:var(--gold)':''}">${calc.pct}%</div>
        ${barra(calc.pct)}
        <div class="kfoot" style="margin-top:6px">Cobrado ${money(calc.cobrado)} de meta ${money(calc.meta)}</div>
      </div>
      <div class="fcard">
        <div class="liqrow"><span>Cartera base</span><b class="num">${money(calc.base)}</b></div>
        <div class="liqrow"><span>Meta (interés del mes)</span><b class="num">${money(calc.meta)}</b></div>
        <div class="liqrow"><span>Interés cobrado</span><b class="num">${money(calc.cobrado)}</b></div>
        <div class="liqrow hl"><span>Tu comisión (${calc.pctComision}%)</span><b class="num" style="color:var(--green)">${money(calc.comision)}</b></div>
        ${calc.bonoApertura?`<div class="liqrow"><span>Bono apertura</span><b class="num">${money(calc.bonoApertura)}</b></div>`:''}
      </div>
      ${sig?`<div class="note" style="margin-top:10px">Siguiente escalón: llega a <b>${sig.desde}%</b> para cobrar <b>${sig.pct}%</b>${sig.apertura?' + bono apertura':''}.</div>`:`<div class="note" style="margin-top:10px">¡Estás en el escalón más alto! 🎉</div>`}
      ${!calc.llegaAMeta?`<div class="note" style="margin-top:8px;border-color:var(--gold)">Recuerda: las comisiones se cobran solo al llegar al 100% de la meta.</div>`:''}`;
    wireSelector(cargarEjec);
  }

  async function cargarAdmin() {
    c.innerHTML = '<div class="loader">Cargando…</div>';
    const { filas, totales } = await repo.calcularMes(anio, mes);
    const esAdmin = perfil.rol === 'ADMIN';
    c.innerHTML = selectorMesAnio() + `
      <div class="kpis"><div class="kcard"><div class="klab">Comisiones del mes</div><div class="kval num gold">${money(totales.comision)}</div><div class="kfoot">cobrado ${money(totales.cobrado)} / meta ${money(totales.meta)}</div></div></div>
      ${esAdmin?`<div style="display:flex;gap:8px;margin-bottom:10px"><button class="btn-primary" id="cm-bases" style="flex:1;background:var(--steel)">Editar bases</button><button class="btn-primary" id="cm-corte" style="flex:1">Correr corte</button></div>`:''}
      ${filas.map(f=>`<div class="cli" style="display:block">
        <div style="display:flex;justify-content:space-between"><div class="nm">${f.ejecutivo}</div><b class="num ${f.pct>=100?'green':''}">${f.pct}%</b></div>
        ${barra(f.pct)}
        <div class="mt" style="margin-top:6px">Base ${money(f.base)} · meta ${money(f.meta)} · cobrado ${money(f.cobrado)} · comisión <b>${money(f.comision)}</b> (${f.pctComision}%)${f.bonoApertura?(' + apertura '+money(f.bonoApertura)):''}</div>
      </div>`).join('') || '<div class="note">No hay bases cargadas para este mes. Usa "Editar bases".</div>'}`;
    wireSelector(cargarAdmin);
    if (esAdmin) {
      c.querySelector('#cm-bases').addEventListener('click', editarBases);
      c.querySelector('#cm-corte').addEventListener('click', async ()=>{
        if(!confirm('¿Congelar la cartera actual como base del próximo mes?')) return;
        try{ const r=await repo.correrCorte(perfil); alert(r.msg); }catch(e){ alert('❌ '+e.message); }
      });
    }
  }

  function editarBases() {
    repo.fetchBases(anio, mes).then(bases => {
      const sub = el(`<div class="overlay"><div class="ohead"><button class="back">←</button><div class="ot">Bases ${MESES[mes-1]} ${anio}</div></div>
        <div class="ocontent">
          <div class="note" style="margin-bottom:10px">Cartera base por ejecutivo (la meta es ${'%'} de este monto).</div>
          <div id="b-list">${bases.map(b=>`<div style="display:flex;gap:8px;margin-bottom:8px;align-items:center"><span style="flex:1">${b.ejecutivo}</span><input class="inp" data-ej="${b.ejecutivo}" value="${b.cartera_base}" inputmode="decimal" style="flex:0 0 140px;margin:0"></div>`).join('')||'<div class="note">Sin bases. Agrega abajo.</div>'}</div>
          <div class="sec-h"><span class="t">Agregar ejecutivo</span><span class="ln"></span></div>
          <input class="inp" id="b-nej" placeholder="Nombre (ej. CESAR)"><input class="inp" id="b-nmonto" placeholder="Cartera base" inputmode="decimal">
          <button class="btn-primary" id="b-go">Guardar bases</button><div class="login-err" id="b-e"></div></div></div>`);
      document.body.appendChild(sub);
      sub.querySelector('.back').addEventListener('click', ()=>sub.remove());
      sub.querySelector('#b-go').addEventListener('click', async ()=>{
        try{
          for (const inp of sub.querySelectorAll('[data-ej]')) await repo.guardarBase(inp.dataset.ej, anio, mes, inp.value, perfil);
          const nej = sub.querySelector('#b-nej').value.trim(), nm = sub.querySelector('#b-nmonto').value;
          if (nej) await repo.guardarBase(nej, anio, mes, nm, perfil);
          alert('✅ Bases guardadas.'); sub.remove(); cargarAdmin();
        }catch(e){ const er=sub.querySelector('#b-e'); er.textContent=e.message; er.style.display='block'; }
      });
    });
  }

  function wireSelector(reload) {
    c.querySelector('#cm-mes').addEventListener('change', e=>{ mes=parseInt(e.target.value); reload(); });
    c.querySelector('#cm-anio').addEventListener('change', e=>{ anio=parseInt(e.target.value); reload(); });
  }

  if (esEjec) {
    if (!perfil.ejecutivo) { c.innerHTML = '<div class="note">Tu usuario no tiene cartera de ejecutivo asignada.</div>'; return; }
    cargarEjec();
  } else cargarAdmin();
}
