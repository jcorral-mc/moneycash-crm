// Vista Compensación — réplica del Script: selector mes/año + pestañas Medidor/Equipo/Ajustes.
import { el, money } from '../lib/dom.js';
import { siguienteEscalon } from '../services/compensaciones.service.js';
import * as repo from '../repositories/compensaciones.repo.js';

const MESES=['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const colPct = p => p>=95?'var(--green)':(p>=80?'var(--gold)':'var(--red)');

export async function abrirCompensaciones(perfil) {
  const admin = ['ADMIN','GERENTE'].includes(perfil.rol);
  const ov = el(`<div class="overlay"><div class="ohead"><button class="back">\u2190</button><div class="ot">Compensación</div></div><div class="ocontent"><div class="loader">Calculando\u2026</div></div></div>`);
  document.body.appendChild(ov);
  const c = ov.querySelector('.ocontent');
  ov.querySelector('.back').addEventListener('click', () => ov.remove());

  const hoy = new Date();
  let anio = hoy.getFullYear(), mes = hoy.getMonth()+1, tab = 'mia';

  const aniosOpt = []; for (let y=hoy.getFullYear(); y>=hoy.getFullYear()-2; y--) aniosOpt.push(y);

  c.innerHTML = `
    <div class="comp-sel">
      <select class="inp" id="cp-mes" style="width:auto">${MESES.map((m,i)=>`<option value="${i+1}" ${i+1===mes?'selected':''}>${m}</option>`).join('')}</select>
      <select class="inp" id="cp-anio" style="width:auto">${aniosOpt.map(y=>`<option ${y===anio?'selected':''}>${y}</option>`).join('')}</select>
    </div>
    ${admin?`<div class="comp-tabs">
      <button class="comp-tab on" data-t="mia">Mi medidor</button>
      <button class="comp-tab" data-t="todos">Equipo</button>
      ${perfil.rol==='ADMIN'?`<button class="comp-tab" data-t="config">Ajustes</button>`:''}
    </div>`:''}
    <div id="cp-cont"><div class="loader">Calculando\u2026</div></div>`;

  const $ = s => c.querySelector(s);
  $('#cp-mes').addEventListener('change', ()=>{ mes=+$('#cp-mes').value; recargar(); });
  $('#cp-anio').addEventListener('change', ()=>{ anio=+$('#cp-anio').value; recargar(); });
  c.querySelectorAll('.comp-tab').forEach(b=>b.addEventListener('click',()=>{ tab=b.dataset.t; c.querySelectorAll('.comp-tab').forEach(x=>x.classList.toggle('on',x===b)); recargar(); }));

  async function recargar() {
    const cont = $('#cp-cont'); cont.innerHTML = '<div class="loader">Calculando\u2026</div>';
    if (tab==='mia') await medidor(cont);
    else if (tab==='todos') await equipo(cont);
    else await ajustes(cont);
  }

  function barra(pct) {
    const w = Math.min(100, Math.max(0, pct));
    return `<div class="comp-barra"><div class="comp-fill" style="width:${w}%;background:${colPct(pct)}"></div>
      <span class="comp-mark" style="left:80%"></span><span class="comp-mark" style="left:85%"></span><span class="comp-mark" style="left:95%"></span><span class="comp-mark fuerte" style="left:100%"></span></div>
      <div class="comp-marks"><span>80%</span><span>85%</span><span>95%</span><span>100%</span><span>110%</span></div>`;
  }

  async function medidor(cont) {
    const { calc, cfg } = await repo.calcularEjecutivo(perfil.ejecutivo||perfil.nombre, anio, mes);
    const sig = siguienteEscalon(calc.pct, cfg);
    cont.innerHTML = `
      <div class="comp-medidor">
        <div class="comp-med-top"><div><div class="comp-lab">Voy en</div><div class="comp-pct">${calc.pct}%</div></div>
          <div style="text-align:right"><div class="comp-lab">de mi meta</div><div style="font-weight:700">${money(calc.cobrado)} / ${money(calc.meta)}</div></div></div>
        ${barra(calc.pct)}
      </div>
      <div class="comp-cards">
        <div class="fcard" style="border-left:4px solid var(--green)"><div class="p-cl">Interés cobrado</div><div class="num" style="font-size:1.4em;font-weight:700;color:var(--green)">${money(calc.cobrado)}</div><div class="mt">este mes</div></div>
        <div class="fcard" style="border-left:4px solid var(--gold)"><div class="p-cl">Voy ganando</div><div class="num" style="font-size:1.4em;font-weight:700;color:var(--gold)">${money(calc.comision)}</div><div class="mt">comisión ${calc.pctComision}%${calc.bonoApertura>0?(' + '+money(calc.bonoApertura)+' apertura'):''}</div></div>
      </div>
      ${calc.aperturaTotal>0?`<div class="fcard" style="border-left:4px solid var(--steel)"><div style="display:flex;justify-content:space-between;align-items:center"><div><div class="p-cl">Comisiones por apertura</div><div class="num" style="font-size:1.1em;font-weight:700;color:var(--steel)">${money(calc.aperturaTotal)}</div></div><div class="mt" style="text-align:right">${calc.incluyeApertura&&calc.pct>=100?'Incluida en tu pago':'Solo aplica al 100%'}</div></div></div>`:''}
      ${sig?`<div class="note" style="border-color:var(--gold)">Te faltan <b>${money(Math.max(0,Math.ceil((sig.desde/100)*calc.meta - calc.cobrado)))}</b> para llegar al <b>${sig.desde}%</b> y subir tu comisión a <b>${sig.pct}%${sig.apertura?' + apertura':''}</b>.</div>`:`<div class="note" style="border-color:var(--green)">¡Estás en el escalón máximo! Excelente.</div>`}
      <div class="fcard" style="border-left:4px solid var(--steel)"><div class="p-cl">Crecimiento de cartera vs. base</div>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-top:4px"><div><span style="font-size:1.2em;font-weight:700;color:var(--steel)">${calc.crecimiento>=0?'+':''}${calc.crecimiento}%</span> <span class="mt">(${money(calc.base)} \u2192 ${money(calc.carteraActual)})</span></div><div class="mt" style="text-align:right">Para el bono<br>necesitas +5%</div></div></div>
      <div class="comp-esc-tit">Mis escalones</div>
      <div class="fcard" style="padding:6px 14px">${cfg.escalones.map(e=>{
        const aqui=calc.pct>=e.desde && (e.hasta>=99999||calc.pct<=e.hasta);
        const lbl=e.hasta>=99999?(e.desde+'%+'):(e.desde+'% – '+Math.floor(e.hasta)+'%');
        const val=e.pct===0?'Sin comisión':(e.pct+'%'+(e.apertura?' + apertura':''));
        return `<div class="comp-esc ${aqui?'aqui':''} ${e.pct===0?'cero':''}"><span>${lbl}${aqui?' \u2190 aquí':''}</span><span>${val}</span></div>`;
      }).join('')}</div>
      <div class="mt" style="text-align:center;margin-top:10px">Base: ${money(calc.base)} · Meta = ${money(calc.meta)}</div>`;
  }

  async function equipo(cont) {
    const { filas, totales } = await repo.calcularMes(anio, mes);
    cont.innerHTML = `
      <div class="kpis kpis-3">
        <div class="kcard"><div class="klab">Meta total</div><div class="kval num">${money(totales.meta)}</div></div>
        <div class="kcard"><div class="klab">Cobrado</div><div class="kval num" style="color:var(--green)">${money(totales.cobrado)}</div></div>
        <div class="kcard"><div class="klab">Comisiones</div><div class="kval num" style="color:var(--gold)">${money(totales.comision)}</div></div>
      </div>
      ${filas.map(f=>`<div class="fcard" style="border-left:4px solid ${colPct(f.pct)}">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px"><b>${f.ejecutivo}</b><span style="font-weight:700;color:${colPct(f.pct)}">${f.pct}%</span></div>
        <div class="comp-barra mini"><div class="comp-fill" style="width:${Math.min(100,f.pct)}%;background:${colPct(f.pct)}"></div></div>
        <div style="display:flex;justify-content:space-between;font-size:.72em;color:var(--slate);margin-top:6px"><span>Cobrado ${money(f.cobrado)} / ${money(f.meta)}</span><span>Comisión <b style="color:var(--ink)">${money(f.comision)}</b></span></div>
      </div>`).join('')||'<div class="note">Sin bases configuradas para este mes.</div>'}`;
  }

  async function ajustes(cont) {
    const cfg = await repo.fetchConfig();
    cont.innerHTML = `<div class="fcard"><div class="fn">Ajustes de compensación</div>
      <label class="alab">Meta = % de la cartera base</label><input class="inp" id="cf-meta" type="number" step="0.5" value="${cfg.pctMeta}">
      <div class="p-cl" style="margin:10px 0 6px">Escalones (desde % → comisión %)</div>
      ${cfg.escalones.map((e,i)=>`<div class="comp-cf">
        <span class="mt">desde</span><input class="inp cf-d" data-i="${i}" type="number" value="${e.desde}" style="width:64px">
        <span class="mt">\u2192</span><input class="inp cf-p" data-i="${i}" type="number" step="0.5" value="${e.pct}" style="width:64px"><span class="mt">% com</span>
        <label class="mt" style="display:flex;align-items:center;gap:4px"><input type="checkbox" class="cf-a" data-i="${i}" ${e.apertura?'checked':''}>apertura</label>
      </div>`).join('')}
      <button class="btn-primary" id="cf-go" style="margin-top:10px">Guardar ajustes</button>
      ${perfil.rol==='ADMIN'?`<button class="p-sec" id="cf-corte" style="width:100%;margin-top:8px">Correr corte mensual (congela bases)</button>`:''}
    </div>`;
    cont.querySelector('#cf-go').addEventListener('click', async ()=>{
      const nc = JSON.parse(JSON.stringify(cfg));
      nc.pctMeta = parseFloat(cont.querySelector('#cf-meta').value)||10;
      cont.querySelectorAll('.cf-d').forEach(el=>nc.escalones[+el.dataset.i].desde=parseFloat(el.value)||0);
      cont.querySelectorAll('.cf-p').forEach(el=>nc.escalones[+el.dataset.i].pct=parseFloat(el.value)||0);
      cont.querySelectorAll('.cf-a').forEach(el=>nc.escalones[+el.dataset.i].apertura=el.checked);
      try { await repo.guardarConfig(nc, perfil); alert('Ajustes guardados.'); } catch(e){ alert(e.message); }
    });
    const corte = cont.querySelector('#cf-corte');
    if (corte) corte.addEventListener('click', async ()=>{ if(!confirm('¿Correr el corte mensual? Congela la cartera actual como base del próximo mes.'))return; try{ const r=await repo.correrCorte(perfil); alert(r.msg); }catch(e){ alert(e.message); } });
  }

  recargar();
}
