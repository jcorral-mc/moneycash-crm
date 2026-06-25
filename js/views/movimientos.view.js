// Vista Movimientos — registro de gastos/nómina/intereses/etc. Cada uno afecta el banco.
// Réplica del Script (selector mes, form por tipo, resumen acordeón, gran total, reverso). Estilo CRM nuevo.
import { el, money } from '../lib/dom.js';
import { construirResumen, MOV_TIPOS, tipoInfo } from '../services/movimientos.service.js';
import { registrarMovimiento, fetchMovimientos, movListarPorBanco, solicitarReversoMov, personasUsadas } from '../repositories/movimientos.repo.js';
import { fetchBancos } from '../repositories/bancos.repo.js';

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
// Acento por tipo (paleta del estilo nuevo)
const ACENTO = {
  'GASTOS FIJOS':'var(--red)', 'GASTOS VARIOS':'var(--amber)', 'NOMINA':'var(--steel)',
  'INTERESES':'var(--gold)', 'DILIGENCIAS':'var(--slate)', 'ENTRADAS EXTRAORDINARIAS':'var(--green)',
};

export async function abrirMovimientos(perfil) {
  if (!['ADMIN','AUX_ADMIN'].includes(perfil.rol)) { alert('Solo administración puede registrar movimientos.'); return; }
  const ov = el(`<div class="overlay"><div class="ohead"><button class="back">\u2190</button><div class="ot">Movimientos</div></div><div class="ocontent"><div class="loader">Cargando\u2026</div></div></div>`);
  document.body.appendChild(ov);
  const c = ov.querySelector('.ocontent');
  ov.querySelector('.back').addEventListener('click', () => ov.remove());

  let MOVS=[], BANCOS=[], R=null, abiertos={};
  const hoy = new Date();
  let mes = hoy.getMonth(), anio = hoy.getFullYear();
  let TIPO='', PERSONA_OPTS={};

  async function cargar() {
    [MOVS, BANCOS] = await Promise.all([fetchMovimientos(), fetchBancos()]);
    R = construirResumen(MOVS, mes, anio);
    // personas ya usadas (para autocompletar)
    PERSONA_OPTS.NOMINA = [...new Set(MOVS.filter(m=>String(m.origen||'')==='NOMINA').map(m=>String(m.subconcepto||'').trim()).filter(Boolean))].sort();
    PERSONA_OPTS.INTERESES = [...new Set(MOVS.filter(m=>String(m.origen||'')==='INTERESES').map(m=>String(m.subconcepto||'').trim()).filter(Boolean))].sort();
    pintar();
  }

  function pintar() {
    const anios=[]; for (let y=anio; y>=anio-3; y--) anios.push(y);
    c.innerHTML = `
      <div class="note" style="background:var(--bg);border:1px solid var(--line);color:var(--ink2);margin-bottom:12px">Cada movimiento afecta directo al banco.</div>

      <div class="dg-mesbar">
        <span class="dg-meslab">Periodo</span>
        <select class="inp" id="mv-mes" style="flex:1;margin:0">${MESES.map((nm,i)=>`<option value="${i}" ${i===mes?'selected':''}>${nm}</option>`).join('')}</select>
        <select class="inp" id="mv-anio" style="flex:0 0 92px;margin:0">${anios.map(a=>`<option ${a===anio?'selected':''}>${a}</option>`).join('')}</select>
      </div>

      <div class="fcard" style="margin-bottom:14px">
        <div style="font-weight:600;font-size:.9em;margin-bottom:10px">Registrar movimiento</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
          <div><label class="alab">Banco</label><select class="inp" id="mv-banco">${BANCOS.map(b=>`<option>${b.cuenta}</option>`).join('')}</select></div>
          <div><label class="alab">Fecha</label><input class="inp" type="date" id="mv-fecha"></div>
        </div>
        <label class="alab">Tipo</label>
        <div id="mv-tipos" class="mv-tipos">
          ${MOV_TIPOS.map(t=>`<button type="button" class="mv-tp" data-t="${t.tipo}">${cap(t.tipo)}</button>`).join('')}
        </div>
        <div id="mv-persona-wrap" style="display:none;margin-top:10px">
          <label class="alab" id="mv-persona-lab">Persona</label>
          <input class="inp" id="mv-persona" list="mv-persona-list" placeholder="Nombre" autocomplete="off">
          <datalist id="mv-persona-list"></datalist>
        </div>
        <div id="mv-concepto-wrap" style="margin-top:10px">
          <label class="alab">Concepto</label><input class="inp" id="mv-concepto" placeholder="Ej. Pago contadora">
        </div>
        <label class="alab">Monto ($)</label><input class="inp" type="number" id="mv-monto" placeholder="0" inputmode="decimal">
        <label class="alab">Observaciones (opcional)</label><input class="inp" id="mv-obs">
        <button class="btn-primary" id="mv-go" style="margin-top:12px">Registrar y afectar banco</button>
        <div class="note" id="mv-efecto" style="margin-top:10px;display:none"></div>
        <div class="login-err" id="mv-err"></div>
      </div>

      <div style="font-weight:600;font-size:.9em;margin-bottom:8px">Resumen de ${R.etiqueta} \u2014 toca para ver detalle</div>
      <div id="mv-cuadros"></div>

      <div class="mv-grantot">
        <span style="font-size:.82em">Total gastos del mes</span>
        <span class="num" style="font-size:1.3em;font-weight:700">${money(R.granTotal)}</span>
      </div>

      <div class="fcard" style="margin-top:16px;border-style:dashed">
        <div style="font-size:.84em;font-weight:600;color:var(--ink2);margin-bottom:4px">Reversar un movimiento</div>
        <div class="note" style="margin-bottom:8px">Elige el banco, selecciona el movimiento y manda la solicitud. El admin la autoriza y se restituye al banco.</div>
        <div style="display:flex;gap:6px;margin-bottom:8px">
          <select class="inp" id="rv-banco" style="flex:1;margin:0">${BANCOS.map(b=>`<option>${b.cuenta}</option>`).join('')}</select>
          <button class="btn-primary" id="rv-buscar" style="flex:0 0 auto;width:auto;padding:0 16px">Buscar</button>
        </div>
        <div id="rv-lista"></div>
        <div id="rv-form" style="display:none;margin-top:8px">
          <div id="rv-sel" class="note" style="background:var(--bg)"></div>
          <textarea class="inp" id="rv-motivo" placeholder="Motivo del reverso" style="min-height:54px;margin-top:6px"></textarea>
          <button class="btn-primary" id="rv-enviar" style="margin-top:6px;background:var(--slate)">Solicitar reverso</button>
        </div>
      </div>`;

    c.querySelector('#mv-fecha').value = new Date().toISOString().slice(0,10);
    c.querySelector('#mv-mes').addEventListener('change', e=>{ mes=parseInt(e.target.value); R=construirResumen(MOVS,mes,anio); abiertos={}; pintar(); });
    c.querySelector('#mv-anio').addEventListener('change', e=>{ anio=parseInt(e.target.value); R=construirResumen(MOVS,mes,anio); abiertos={}; pintar(); });

    // Tipos (botones)
    c.querySelectorAll('.mv-tp').forEach(b => b.addEventListener('click', () => {
      TIPO = b.dataset.t; c.querySelectorAll('.mv-tp').forEach(x=>x.classList.toggle('on', x===b));
      const info = tipoInfo(TIPO);
      const pw=c.querySelector('#mv-persona-wrap'), cw=c.querySelector('#mv-concepto-wrap');
      if (info.persona) {
        pw.style.display='block'; cw.style.display='none';
        c.querySelector('#mv-persona-lab').textContent = TIPO==='NOMINA'?'Empleado':'Inversionista';
        c.querySelector('#mv-persona-list').innerHTML = (PERSONA_OPTS[TIPO]||[]).map(p=>`<option value="${p}">`).join('');
      } else { pw.style.display='none'; cw.style.display='block'; }
      const efe=c.querySelector('#mv-efecto'); efe.style.display='block';
      efe.innerHTML = info.efecto==='INGRESO' ? 'Este movimiento <b>suma</b> al banco (entrada).' : 'Este movimiento <b>resta</b> del banco (salida).';
    }));

    c.querySelector('#mv-go').addEventListener('click', registrar);

    pintarCuadros();

    // Reverso
    c.querySelector('#rv-buscar').addEventListener('click', buscarRev);
    c.querySelector('#rv-enviar').addEventListener('click', enviarRev);
  }

  function pintarCuadros() {
    const cont = c.querySelector('#mv-cuadros');
    cont.innerHTML = R.resumen.filter(t=>t.count>0 || ['GASTOS FIJOS','GASTOS VARIOS','NOMINA','INTERESES'].includes(t.tipo)).map(t => {
      const ac = ACENTO[t.tipo]||'var(--slate)';
      const open = !!abiertos[t.tipo];
      const persona = tipoInfo(t.tipo).persona;
      const sub = persona ? `${t.count} mov \u00b7 por persona` : `${t.count} movimiento${t.count===1?'':'s'}`;
      let det='';
      if (open) det = persona ? detallePersona(t.tipo, ac) : detalleSimple(t.tipo, ac);
      return `<div class="mv-card" style="border-left:4px solid ${ac}">
        <div class="mv-head" data-t="${t.tipo}">
          <div><div class="mv-tlab">${t.tipo}</div><div class="num" style="font-size:1.2em;font-weight:700;color:${ac}">${money(t.total)}</div><div class="mv-sub">${sub} ${open?'\u25be':'\u25b8'}</div></div>
        </div>${det}</div>`;
    }).join('');
    cont.querySelectorAll('.mv-head').forEach(h => h.addEventListener('click', () => {
      const t=h.dataset.t; abiertos[t]=!abiertos[t]; pintarCuadros();
    }));
  }

  function detalleSimple(tipo, ac) {
    const items = (R.detalle[tipo] && R.detalle[tipo].items) || [];
    if (!items.length) return '<div class="note" style="padding:8px 12px">Sin movimientos.</div>';
    return '<div class="mv-det">' + items.map(it =>
      `<div class="mv-row"><span>${it.fecha} \u00b7 ${it.concepto||'(sin concepto)'} \u00b7 ${it.cuenta}</span><span class="num" style="font-weight:600">${money(it.monto)}</span></div>`).join('') + '</div>';
  }
  function detallePersona(tipo, ac) {
    const grupos = R.agrupados[tipo] || [];
    if (!grupos.length) return '<div class="note" style="padding:8px 12px">Sin movimientos.</div>';
    return '<div class="mv-det">' + grupos.map(g =>
      `<div class="mv-prow"><span style="font-weight:600">${g.persona}</span><span class="num" style="font-weight:700;color:${ac}">${money(g.total)} \u00b7 ${g.movs.length}</span></div>`).join('') + '</div>';
  }

  async function registrar() {
    const err = c.querySelector('#mv-err'); err.style.display='none';
    if (!TIPO) { err.textContent='Selecciona el tipo de movimiento.'; err.style.display='block'; return; }
    const info = tipoInfo(TIPO);
    const d = { tipo:TIPO, cuenta:c.querySelector('#mv-banco').value, fecha:c.querySelector('#mv-fecha').value,
      monto:c.querySelector('#mv-monto').value, obs:c.querySelector('#mv-obs').value,
      subconcepto: info.persona ? c.querySelector('#mv-persona').value : '',
      concepto: info.persona ? '' : c.querySelector('#mv-concepto').value };
    try { const res = await registrarMovimiento(d, perfil); alert(res.msg); await cargar(); }
    catch(e){ err.textContent=e.message; err.style.display='block'; }
  }

  let RV_SEL=null;
  async function buscarRev() {
    const banco = c.querySelector('#rv-banco').value;
    const cont = c.querySelector('#rv-lista'); cont.innerHTML='<div class="note">Cargando\u2026</div>';
    c.querySelector('#rv-form').style.display='none';
    const movs = await movListarPorBanco(banco);
    if (!movs.length) { cont.innerHTML='<div class="note">Sin movimientos en este banco.</div>'; return; }
    cont.innerHTML = movs.map(m=>`<div class="rv-row" data-id="${m.id}">
      <span style="flex:1;min-width:0">${m.fecha} \u00b7 ${m.tipo}${m.subconcepto?(' \u00b7 '+m.subconcepto):''} \u00b7 ${m.concepto||''}</span>
      <span class="num" style="font-weight:600;color:var(--red)">${money(m.monto)}</span></div>`).join('');
    cont.querySelectorAll('.rv-row').forEach(row => row.addEventListener('click', () => {
      const m = movs.find(x=>String(x.id)===row.dataset.id);
      RV_SEL = { ...m, banco };
      c.querySelector('#rv-sel').textContent = `Reversar: ${m.fecha} \u00b7 ${m.tipo} \u00b7 ${money(m.monto)} \u00b7 ${m.concepto||''}`;
      c.querySelector('#rv-form').style.display='block';
    }));
  }
  async function enviarRev() {
    if (!RV_SEL) return;
    const motivo = c.querySelector('#rv-motivo').value.trim();
    if (!confirm('Se enviará una solicitud para revertir el movimiento. ¿Continuar?')) return;
    try {
      const res = await solicitarReversoMov({ movId:RV_SEL.id, banco:RV_SEL.banco, fecha:RV_SEL.fecha, concepto:RV_SEL.concepto, monto:RV_SEL.monto, motivo }, perfil);
      alert(res.msg); c.querySelector('#rv-form').style.display='none'; c.querySelector('#rv-motivo').value=''; RV_SEL=null;
    } catch(e){ alert(e.message); }
  }

  cargar();
}

function cap(t){ return t.split(' ').map(w=>w.charAt(0)+w.slice(1).toLowerCase()).join(' '); }
