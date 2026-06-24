// Vista Bancos — resumen, movimientos, transferencias, entradas/salidas, autorizaciones, reversos.
// Admin: opera directo + aprueba + reversa. Aux: solicita. Gerente: consulta + aprueba.
import { el, money } from '../lib/dom.js';
import { construirResumen, filtrarMovimientos } from '../services/bancos.service.js';
import * as repo from '../repositories/bancos.repo.js';

export async function abrirBancos(perfil) {
  if (!['ADMIN','GERENTE','AUX_ADMIN'].includes(perfil.rol)) { alert('Solo administración puede ver Bancos.'); return; }
  const ov = el(`<div class="overlay"><div class="ohead"><button class="back">←</button><div class="ot">Bancos</div></div><div class="ocontent"><div class="loader">Cargando bancos…</div></div></div>`);
  document.body.appendChild(ov);
  const c = ov.querySelector('.ocontent');
  ov.querySelector('.back').addEventListener('click', () => ov.remove());

  const esAdmin = perfil.rol==='ADMIN';
  const opera = ['ADMIN','AUX_ADMIN'].includes(perfil.rol);   // puede iniciar transfer/entradas/salidas
  const aprueba = ['ADMIN','GERENTE'].includes(perfil.rol);

  async function cargar() {
    c.innerHTML = '<div class="loader">Cargando bancos…</div>';
    const [bancos, movs, auts] = await Promise.all([repo.fetchBancos(), repo.fetchMovimientos(), repo.fetchAutorizaciones()]);
    const r = construirResumen(bancos, movs, null, null);

    c.innerHTML = `
      <div class="kpis"><div class="kcard"><div class="klab">Saldo total</div><div class="kval num">${money(r.saldoTotal)}</div><div class="kfoot">${r.cuentas.length} cuentas</div></div>
        <div class="kcard"><div class="klab">Neto del mes</div><div class="kval num ${r.mesNeto>=0?'green':''}">${money(r.mesNeto)}</div><div class="kfoot">+${money(r.mesIngresos)} / −${money(r.mesEgresos)}</div></div></div>

      <div class="sec-h"><span class="t">Cuentas</span><span class="ln"></span></div>
      ${r.cuentas.map(ct=>`<div class="cli" style="cursor:default"><div><div class="nm">${ct.cuenta}</div></div><div class="sal num">${money(ct.saldo)}</div></div>`).join('') || '<div class="note">Sin cuentas</div>'}

      ${opera ? `<div class="sec-h"><span class="t">Operar</span><span class="ln"></span></div>
        <div style="display:flex;gap:8px"><button class="btn-primary" id="b-tr" style="flex:1">Transferir</button>
          <button class="btn-primary" id="b-in" style="flex:1;background:var(--green)">Entrada</button>
          <button class="btn-primary" id="b-out" style="flex:1;background:var(--red)">Salida</button></div>` : ''}

      ${auts.length ? `<div class="sec-h"><span class="t">Autorizaciones pendientes (${auts.length})</span><span class="ln"></span></div>
        ${auts.map(a=>`<div class="cli" style="display:block">
          <div><div class="nm">${a.tipo}</div><div class="mt">${a.referencia||''} · pidió ${a.solicita||''}</div></div>
          ${aprueba ? `<div style="display:flex;gap:7px;margin-top:8px"><button class="mini-ok" data-ap="${a.id}">Aprobar</button><button class="mini-no" data-rj="${a.id}">Rechazar</button></div>` : '<div class="mt">Esperando admin/gerente</div>'}
        </div>`).join('')}` : ''}

      <div class="sec-h"><span class="t">Movimientos recientes</span><span class="ln"></span></div>
      <div id="b-movs"></div>`;

    // KPIs verde
    const movDiv = c.querySelector('#b-movs');
    const recientes = r.movimientos.slice(0,40);
    movDiv.innerHTML = recientes.map(m=>`
      <div class="pago"><div class="izq"><span class="chip ${m.tipo==='INGRESO'?'pag':'ven'}">${m.tipo==='INGRESO'?'+':'−'}</span>
        <div><div style="font-weight:600;font-size:.92em">${m.cuenta} · ${money(m.monto)}</div><div class="mt">${m.fecha} · ${m.concepto}${m.reversado?' · REVERSADO':''}</div></div></div>
      ${(esAdmin && !m.reversado && m.origen!=='REVERSO') ? `<button class="mini-no" data-rev="${m.id}" style="flex:0 0 auto;width:auto;padding:6px 10px">Reversar</button>` : ''}
    </div>`).join('') || '<div class="note">Sin movimientos</div>';

    // handlers
    if (opera) {
      c.querySelector('#b-tr').addEventListener('click', () => formTransfer(r.cuentas));
      c.querySelector('#b-in').addEventListener('click', () => formDirecto(r.cuentas, 'INGRESO'));
      c.querySelector('#b-out').addEventListener('click', () => formDirecto(r.cuentas, 'SALIDA'));
    }
    if (aprueba) {
      c.querySelectorAll('[data-ap]').forEach(b=>b.addEventListener('click', async ()=>{ const a=auts.find(x=>String(x.id)===b.dataset.ap); try{ await repo.aprobarAutorizacion(a, perfil); alert('✅ Aprobada y ejecutada.'); cargar(); }catch(e){ alert('❌ '+e.message);} }));
      c.querySelectorAll('[data-rj]').forEach(b=>b.addEventListener('click', async ()=>{ await repo.rechazarAutorizacion(b.dataset.rj, perfil); cargar(); }));
    }
    if (esAdmin) {
      c.querySelectorAll('[data-rev]').forEach(b=>b.addEventListener('click', async ()=>{ const m=recientes.find(x=>String(x.id)===b.dataset.rev); if(!confirm('¿Reversar este movimiento? Se restituye el banco.')) return; try{ const res=await repo.reversarMovimiento(m, perfil); alert(res.msg); cargar(); }catch(e){ alert('❌ '+e.message);} }));
    }
  }

  function formTransfer(cuentas) {
    const opts = cuentas.map(c=>`<option>${c.cuenta}</option>`).join('');
    const sub = el(`<div class="overlay"><div class="ohead"><button class="back">←</button><div class="ot">Transferir entre bancos</div></div>
      <div class="ocontent">
        <label class="alab">De</label><select class="inp" id="t-o">${opts}</select>
        <label class="alab">A</label><select class="inp" id="t-d">${opts}</select>
        <label class="alab">Monto</label><input class="inp" id="t-m" inputmode="decimal">
        <label class="alab">Concepto</label><input class="inp" id="t-c" value="Transferencia entre bancos">
        <button class="btn-primary" id="t-go">${esAdmin?'Ejecutar transferencia':'Solicitar (autorización)'}</button>
        <div class="login-err" id="t-e"></div></div></div>`);
    document.body.appendChild(sub);
    sub.querySelector('.back').addEventListener('click', ()=>sub.remove());
    sub.querySelector('#t-go').addEventListener('click', async ()=>{
      const d={ origen:sub.querySelector('#t-o').value, destino:sub.querySelector('#t-d').value, monto:sub.querySelector('#t-m').value, concepto:sub.querySelector('#t-c').value };
      try{ const res = esAdmin ? await repo.ejecutarTransferencia(d, perfil) : await repo.solicitarTransferencia(d, perfil); alert(res.msg); sub.remove(); cargar(); }
      catch(e){ const er=sub.querySelector('#t-e'); er.textContent=e.message; er.style.display='block'; }
    });
  }

  function formDirecto(cuentas, tipo) {
    const sub = el(`<div class="overlay"><div class="ohead"><button class="back">←</button><div class="ot">${tipo==='INGRESO'?'Entrada':'Salida'} directa</div></div>
      <div class="ocontent">
        <label class="alab">Cuenta</label><select class="inp" id="d-c">${cuentas.map(c=>`<option>${c.cuenta}</option>`).join('')}</select>
        <label class="alab">Monto</label><input class="inp" id="d-m" inputmode="decimal">
        <label class="alab">Concepto</label><input class="inp" id="d-co">
        <button class="btn-primary" id="d-go" style="background:${tipo==='INGRESO'?'var(--green)':'var(--red)'}">${esAdmin?'Ejecutar':'Solicitar (autorización)'}</button>
        <div class="login-err" id="d-e"></div></div></div>`);
    document.body.appendChild(sub);
    sub.querySelector('.back').addEventListener('click', ()=>sub.remove());
    sub.querySelector('#d-go').addEventListener('click', async ()=>{
      const d={ cuenta:sub.querySelector('#d-c').value, monto:sub.querySelector('#d-m').value, concepto:sub.querySelector('#d-co').value, tipo };
      try{ const res = esAdmin ? await repo.ejecutarMovimientoDirecto(d, perfil) : await repo.solicitarMovimientoDirecto(d, perfil); alert(res.msg); sub.remove(); cargar(); }
      catch(e){ const er=sub.querySelector('#d-e'); er.textContent=e.message; er.style.display='block'; }
    });
  }

  cargar();
}
