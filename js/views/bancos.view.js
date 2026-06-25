// Vista Bancos — réplica de la pantalla del Script (banca digital + detalle por cuenta).
import { el, money } from '../lib/dom.js';
import { construirResumen, filtrarMovimientos } from '../services/bancos.service.js';
import * as repo from '../repositories/bancos.repo.js';

export async function abrirBancos(perfil) {
  if (!['ADMIN','GERENTE','AUX_ADMIN'].includes(perfil.rol)) { alert('Solo administración puede ver Bancos.'); return; }
  const ov = el(`<div class="overlay"><div class="ohead"><button class="back">\u2190</button><div class="ot">\ud83c\udfe6 Bancos</div></div><div class="ocontent"><div class="loader">Cargando bancos\u2026</div></div></div>`);
  document.body.appendChild(ov);
  const c = ov.querySelector('.ocontent');
  ov.querySelector('.back').addEventListener('click', () => ov.remove());

  const esAdmin = perfil.rol==='ADMIN';
  const opera = ['ADMIN','AUX_ADMIN'].includes(perfil.rol);
  let R=null, FILTRO='todos', VERMAS=false, HIDE=false, MOVS=[];

  async function cargar() {
    c.innerHTML = '<div class="loader">Cargando bancos\u2026</div>';
    const [bancos, movs] = await Promise.all([repo.fetchBancos(), repo.fetchMovimientos()]);
    R = construirResumen(bancos, movs, null, null); MOVS = movs;
    pintarCuentas();
  }

  // ───────────── VISTA 1: dashboard ─────────────
  function pintarCuentas() {
    c.innerHTML = `
      <div class="bk-hero">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <span style="font-size:.78em;opacity:.85">Saldo total \u00b7 ${R.cuentas.length} cuentas</span>
          <span id="bk-eye" style="cursor:pointer;font-size:1.05em">\ud83d\udc41\ufe0f</span>
        </div>
        <div class="bk-saldo num" id="bk-total">${HIDE?'\u2022\u2022\u2022\u2022\u2022\u2022':money(R.saldoTotal)}</div>
        <div style="font-size:.72em;opacity:.85;margin-top:2px;text-transform:capitalize">${R.mesVista}</div>
      </div>

      <div class="bk-mes">
        <div><div class="bk-ml">Entr\u00f3</div><div class="num" style="font-weight:700;color:var(--green)">${money(R.mesIngresos)}</div></div>
        <div style="border-left:1px solid var(--line);border-right:1px solid var(--line)"><div class="bk-ml">Sali\u00f3</div><div class="num" style="font-weight:700;color:var(--red)">${money(R.mesEgresos)}</div></div>
        <div><div class="bk-ml">Neto</div><div class="num" style="font-weight:700;color:var(--ink)">${money(R.mesNeto)}</div></div>
      </div>

      ${opera ? `<div class="bk-acc">
        <button id="bk-tr">\ud83d\udd04<br>Transferir</button>
        <button id="bk-in" style="background:var(--green)">\u2198<br>Entrada</button>
        <button id="bk-out" style="background:var(--red)">\u2197<br>Salida</button>
      </div>` : ''}

      <input class="inp" id="bk-q" placeholder="\ud83d\udd0d Buscar en todos los bancos\u2026" style="margin-top:12px">
      <div class="bk-chips">
        <button class="bk-chip on" data-f="todos">Todos</button>
        <button class="bk-chip" data-f="ingreso">Dep\u00f3sitos</button>
        <button class="bk-chip" data-f="egreso">Salidas</button>
        <button class="bk-chip" data-f="transfer">Transferencias</button>
      </div>

      <div style="display:flex;justify-content:space-between;align-items:baseline;margin:16px 0 4px">
        <span style="font-weight:700;font-size:.95em">Movimientos</span>
        <span style="font-size:.72em;color:var(--slate)" id="bk-count"></span>
      </div>
      <div id="bk-movs"></div>
      <button id="bk-vermas" class="p-sec" style="display:none;width:100%;margin-top:8px">Ver m\u00e1s movimientos</button>

      <div class="sec-h" style="margin-top:18px"><span class="t">Cuentas \u2014 toca para ver detalle</span><span class="ln"></span></div>
      <div class="bk-cuentas" id="bk-cuentas"></div>`;

    c.querySelector('#bk-eye').addEventListener('click', () => { HIDE=!HIDE; c.querySelector('#bk-eye').textContent=HIDE?'\ud83d\ude48':'\ud83d\udc41\ufe0f'; c.querySelector('#bk-total').textContent=HIDE?'\u2022\u2022\u2022\u2022\u2022\u2022':money(R.saldoTotal); });
    const q=c.querySelector('#bk-q'); q.addEventListener('input', renderMovs);
    c.querySelectorAll('.bk-chip').forEach(ch => ch.addEventListener('click', () => {
      FILTRO=ch.dataset.f; VERMAS=false; c.querySelectorAll('.bk-chip').forEach(x=>x.classList.toggle('on', x===ch)); renderMovs();
    }));
    c.querySelector('#bk-vermas').addEventListener('click', () => { VERMAS=true; renderMovs(); });
    if (opera) {
      c.querySelector('#bk-tr').addEventListener('click', () => modalTransfer());
      c.querySelector('#bk-in').addEventListener('click', () => modalDirecto('INGRESO'));
      c.querySelector('#bk-out').addEventListener('click', () => modalDirecto('SALIDA'));
    }
    c.querySelector('#bk-cuentas').innerHTML = R.cuentas.map(ct=>`<div class="bk-cta" data-c="${encodeURIComponent(ct.cuenta)}"><div style="font-weight:600;font-size:.86em">\ud83c\udfe6 ${ct.cuenta}</div><div class="num" style="font-size:.9em;color:var(--ink);font-weight:700;margin-top:2px">${money(ct.saldo)}</div></div>`).join('') || '<div class="note">Sin cuentas</div>';
    c.querySelectorAll('.bk-cta').forEach(d => d.addEventListener('click', () => pintarDetalle(decodeURIComponent(d.dataset.c))));
    renderMovs();
  }

  function renderMovs() {
    const q = (c.querySelector('#bk-q').value||'').toLowerCase();
    const rows = R.movimientos.filter(m => {
      if (FILTRO==='ingreso' && !(m.tipo==='INGRESO'&&!m.transfer)) return false;
      if (FILTRO==='egreso' && !(m.tipo==='EGRESO'&&!m.transfer)) return false;
      if (FILTRO==='transfer' && !m.transfer) return false;
      if (q && ((m.concepto||'')+' '+(m.cuenta||'')+' '+(m.obs||'')).toLowerCase().indexOf(q)<0) return false;
      return true;
    });
    const shown = VERMAS ? rows : rows.slice(0,15);
    c.querySelector('#bk-count').textContent = rows.length+' movimiento'+(rows.length===1?'':'s');
    c.querySelector('#bk-vermas').style.display = (!VERMAS && rows.length>15) ? 'block' : 'none';
    const box = c.querySelector('#bk-movs');
    if (!shown.length) { box.innerHTML='<div class="note" style="text-align:center;padding:16px">Sin movimientos con ese filtro.</div>'; return; }
    box.innerHTML = shown.map(m => {
      const tr=m.transfer, ing=m.tipo==='INGRESO';
      const cls = tr?'tr':(ing?'in':'out'); const ic = tr?'\ud83d\udd04':(ing?'\u2198':'\u2197'); const signo = ing?'+':'\u2212';
      return `<div class="bk-mov">
        <div class="bk-ic ${cls}">${ic}</div>
        <div style="flex:1;min-width:0"><div class="bk-cpt">${m.concepto||'(sin concepto)'}</div>
          <div class="bk-meta"><span class="bk-tag">${m.cuenta}</span>${m.fecha}${m.hora?(' '+m.hora):''}</div></div>
        <div class="bk-amt ${cls}">${signo}${money(m.monto)}</div>
      </div>`;
    }).join('');
  }

  // ───────────── VISTA 2: detalle por cuenta ─────────────
  function pintarDetalle(cuenta) {
    c.innerHTML = `
      <button class="p-sec" id="bk-volver" style="width:auto;margin-bottom:10px">\u2190 Cuentas</button>
      <div class="fcard" style="border-left:4px solid var(--ink)">
        <div class="fn">\ud83c\udfe6 ${cuenta}</div>
        <div style="display:flex;justify-content:space-between;margin-top:8px;font-size:.85em">
          <div style="text-align:center;flex:1"><div class="bk-ml">INGRESOS</div><div class="num" id="dt-ing" style="font-weight:700;color:var(--green)">$0</div></div>
          <div style="text-align:center;flex:1"><div class="bk-ml">EGRESOS</div><div class="num" id="dt-egr" style="font-weight:700;color:var(--red)">$0</div></div>
          <div style="text-align:center;flex:1"><div class="bk-ml">NETO</div><div class="num" id="dt-neto" style="font-weight:700;color:var(--ink)">$0</div></div>
        </div>
      </div>
      <div class="fcard">
        <div class="bk-ml" style="margin-bottom:8px">FILTROS</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
          <div><label class="alab">Tipo</label><select class="inp" id="ft-tipo"><option value="">Todos</option><option value="INGRESO">Ingresos</option><option value="EGRESO">Egresos</option></select></div>
          <div><label class="alab">Mes</label><input class="inp" type="month" id="ft-mes"></div>
          <div><label class="alab">Desde</label><input class="inp" type="date" id="ft-desde"></div>
          <div><label class="alab">Hasta</label><input class="inp" type="date" id="ft-hasta"></div>
          <div><label class="alab">Monto m\u00edn</label><input class="inp" type="number" id="ft-min" placeholder="0"></div>
          <div><label class="alab">Monto m\u00e1x</label><input class="inp" type="number" id="ft-max"></div>
        </div>
        <label class="alab">Buscar en concepto</label>
        <input class="inp" id="ft-texto" placeholder="Ej: nombre, multa, abono\u2026">
        <button class="p-sec" id="ft-limpiar" style="margin-top:10px;width:100%">Limpiar filtros</button>
      </div>
      <button class="btn-primary" id="dt-export" style="background:var(--green);margin-bottom:8px">\ud83d\udce4 Exportar movimientos (seg\u00fan filtros)</button>
      <div id="dt-count" class="note" style="font-weight:600;margin:8px 0"></div>
      <div id="dt-movs"></div>`;

    c.querySelector('#bk-volver').addEventListener('click', pintarCuentas);
    const ids=['ft-tipo','ft-mes','ft-desde','ft-hasta','ft-min','ft-max','ft-texto'];
    ids.forEach(id => c.querySelector('#'+id).addEventListener('input', aplicar));
    c.querySelector('#ft-limpiar').addEventListener('click', () => { ids.forEach(id=>c.querySelector('#'+id).value=''); aplicar(); });

    let ULT=[];
    function aplicar() {
      const filtros = { tipo:c.querySelector('#ft-tipo').value, mes:c.querySelector('#ft-mes').value,
        desde:c.querySelector('#ft-desde').value, hasta:c.querySelector('#ft-hasta').value,
        montoMin:c.querySelector('#ft-min').value, montoMax:c.querySelector('#ft-max').value, texto:c.querySelector('#ft-texto').value };
      const r = filtrarMovimientos(R.movimientos, cuenta, filtros);
      ULT = r.movimientos;
      c.querySelector('#dt-ing').textContent = money(r.totalIngresos);
      c.querySelector('#dt-egr').textContent = money(r.totalEgresos);
      c.querySelector('#dt-neto').textContent = money(r.neto);
      c.querySelector('#dt-count').textContent = r.count+' movimiento(s)';
      c.querySelector('#dt-movs').innerHTML = r.movimientos.length ? r.movimientos.map(m=>{
        const ing=m.tipo==='INGRESO'; const col=ing?'var(--green)':'var(--red)'; const signo=ing?'+':'\u2212';
        return `<div class="cli" style="display:block;border-left:4px solid ${col}">
          <div style="display:flex;justify-content:space-between;gap:10px">
            <div><div class="nm">${m.fecha} \u00b7 <span style="font-weight:400;color:var(--slate);font-size:.85em">${m.tipo}</span></div>
              <div class="mt">${m.concepto||'(sin concepto)'}${m.obs?(' \u00b7 '+m.obs):''}</div></div>
            <div class="num" style="font-weight:700;color:${col};white-space:nowrap">${signo}${money(m.monto)}</div>
          </div></div>`;
      }).join('') : '<div class="note" style="text-align:center">Sin movimientos con esos filtros.</div>';
    }
    c.querySelector('#dt-export').addEventListener('click', () => {
      const cab=['Fecha','Tipo','Concepto','Obs','Monto'];
      const csv=[cab.join(',')].concat(ULT.map(m=>[m.fecha,m.tipo,`"${(m.concepto||'').replace(/"/g,'')}"`,`"${(m.obs||'').replace(/"/g,'')}"`,m.monto].join(','))).join('\n');
      const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv'})); a.download=`movs_${cuenta}.csv`; a.click();
    });
    aplicar();
  }

  // ───────────── Modales ─────────────
  function modalTransfer() {
    const ops = R.cuentas.map(c=>`<option>${c.cuenta}</option>`).join('');
    const m = el(`<div class="p-modal"><div class="p-mbox" style="max-width:400px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px"><b>\ud83d\udd04 Transferir entre bancos</b><span data-x style="cursor:pointer;font-size:1.2em">\u2715</span></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
        <div><label class="alab">De</label><select class="inp" id="t-o">${ops}</select></div>
        <div><label class="alab">A</label><select class="inp" id="t-d">${ops}</select></div>
      </div>
      <label class="alab">Monto</label><input class="inp" type="number" id="t-m" placeholder="0.00">
      <label class="alab">Concepto</label><input class="inp" id="t-c" placeholder="Motivo de la transferencia">
      <button class="btn-primary" id="t-go" style="margin-top:12px;background:${esAdmin?'var(--steel)':'var(--navy)'}">${esAdmin?'Ejecutar transferencia':'Enviar a autorizaci\u00f3n'}</button>
      <div class="login-err" id="t-e"></div>
    </div></div>`);
    document.body.appendChild(m);
    m.querySelector('[data-x]').addEventListener('click', ()=>m.remove());
    m.querySelector('#t-go').addEventListener('click', async () => {
      const d={ origen:m.querySelector('#t-o').value, destino:m.querySelector('#t-d').value, monto:parseFloat(m.querySelector('#t-m').value)||0, concepto:m.querySelector('#t-c').value };
      const e=m.querySelector('#t-e'); e.style.display='none';
      if (d.origen===d.destino) { e.textContent='El origen y el destino no pueden ser el mismo.'; e.style.display='block'; return; }
      if (d.monto<=0) { e.textContent='Escribe un monto v\u00e1lido.'; e.style.display='block'; return; }
      try { const res = esAdmin ? await repo.ejecutarTransferencia(d, perfil) : await repo.solicitarTransferencia(d, perfil); alert(res.msg); m.remove(); cargar(); }
      catch(err){ e.textContent=err.message; e.style.display='block'; }
    });
  }

  function modalDirecto(tipo) {
    const ing = tipo==='INGRESO';
    const m = el(`<div class="p-modal"><div class="p-mbox" style="max-width:400px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px"><b>${ing?'\u2198 Entrada directa':'\u2197 Salida directa'}</b><span data-x style="cursor:pointer;font-size:1.2em">\u2715</span></div>
      <label class="alab">Cuenta</label><select class="inp" id="d-c">${R.cuentas.map(c=>`<option>${c.cuenta}</option>`).join('')}</select>
      <label class="alab">Monto</label><input class="inp" type="number" id="d-m" placeholder="0.00">
      <label class="alab">Concepto</label><input class="inp" id="d-co" placeholder="Ej. pr\u00e9stamo temporal de\u2026">
      <button class="btn-primary" id="d-go" style="margin-top:12px;background:${ing?'var(--green)':'var(--red)'}">${esAdmin?'Ejecutar':'Enviar a autorizaci\u00f3n'}</button>
      <div class="login-err" id="d-e"></div>
    </div></div>`);
    document.body.appendChild(m);
    m.querySelector('[data-x]').addEventListener('click', ()=>m.remove());
    m.querySelector('#d-go').addEventListener('click', async () => {
      const d={ cuenta:m.querySelector('#d-c').value, monto:parseFloat(m.querySelector('#d-m').value)||0, concepto:m.querySelector('#d-co').value, tipo };
      const e=m.querySelector('#d-e'); e.style.display='none';
      if (d.monto<=0) { e.textContent='Escribe un monto v\u00e1lido.'; e.style.display='block'; return; }
      if (!d.concepto.trim()) { e.textContent='Escribe el concepto.'; e.style.display='block'; return; }
      try { const res = esAdmin ? await repo.ejecutarMovimientoDirecto(d, perfil) : await repo.solicitarMovimientoDirecto(d, perfil); alert(res.msg); m.remove(); cargar(); }
      catch(err){ e.textContent=err.message; e.style.display='block'; }
    });
  }

  cargar();
}
