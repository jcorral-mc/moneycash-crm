// Vista Acreedores (inversionistas) — capital invertido, interés, próximo pago, saldo, estado de cuenta.
import { el, money } from '../lib/dom.js';
import { construirLista, estadoCuenta } from '../services/acreedores.service.js';
import * as repo from '../repositories/acreedores.repo.js';
import { fetchBancos } from '../repositories/bancos.repo.js';

export async function abrirAcreedores(perfil) {
  if (!['ADMIN','GERENTE','AUX_ADMIN'].includes(perfil.rol)) { alert('Solo administración puede ver Acreedores.'); return; }
  const opera = ['ADMIN','AUX_ADMIN'].includes(perfil.rol);
  const ov = el(`<div class="overlay"><div class="ohead"><button class="back">←</button><div class="ot">Acreedores / Inversionistas</div></div><div class="ocontent"><div class="loader">Cargando…</div></div></div>`);
  document.body.appendChild(ov);
  const c = ov.querySelector('.ocontent');
  ov.querySelector('.back').addEventListener('click', () => ov.remove());

  async function cargar() {
    c.innerHTML = '<div class="loader">Cargando…</div>';
    const [acs, bancos] = await Promise.all([repo.fetchAcreedores(), fetchBancos()]);
    const { acreedores, proximos, totalDeuda } = construirLista(acs);

    c.innerHTML = `
      <div class="kpis"><div class="kcard"><div class="klab">Deuda total a inversionistas</div><div class="kval num" style="color:var(--red)">${money(totalDeuda)}</div><div class="kfoot">${acreedores.length} acreedores</div></div></div>
      ${opera ? '<button class="btn-primary" id="ac-nuevo" style="margin-bottom:6px">+ Nuevo acreedor</button>' : ''}
      ${proximos.length ? `<div class="sec-h"><span class="t">Próximos a pagar</span><span class="ln"></span></div>
        ${proximos.slice(0,5).map(a=>`<div class="cli" data-id="${a.id}"><div><div class="nm">${a.nombre}</div><div class="mt">${a.proxPago} · ${a.diasParaPago<=0?'<b style="color:var(--red)">vencido/hoy</b>':('en '+a.diasParaPago+' días')}</div></div><div class="sal num">${money(a.saldo)}</div></div>`).join('')}` : ''}
      <div class="sec-h"><span class="t">Todos los acreedores</span><span class="ln"></span></div>
      ${acreedores.map(a=>`<div class="cli" data-id="${a.id}">
        <div><div class="nm">${a.nombre}</div><div class="mt">${a.tipo||'—'} · capital ${money(a.montoDebo)} · ${a.pctInteres}% · ${a.frecuencia||'—'}</div></div>
        <div class="sal num">${money(a.saldo)}</div></div>`).join('') || '<div class="note">Sin acreedores</div>'}`;

    if (opera) c.querySelector('#ac-nuevo').addEventListener('click', () => formAlta(null, bancos));
    c.querySelectorAll('.cli[data-id]').forEach(card => card.addEventListener('click', () => {
      const a = acs.find(x=>String(x.id)===card.dataset.id); if (a) verEstado(a, bancos);
    }));
  }

  async function verEstado(acRow, bancos) {
    const hist = await repo.fetchHistorico(acRow.nombre);
    const e = estadoCuenta(acRow, hist);
    const sub = el(`<div class="overlay"><div class="ohead"><button class="back">←</button><div class="ot">${e.nombre}</div></div>
      <div class="ocontent">
        <div class="fcard">
          <div class="liqrow"><span>Capital invertido</span><b class="num">${money(e.capitalInvertido)}</b></div>
          <div class="liqrow"><span>Interés pactado</span><b class="num">${e.pctInteres}%</b></div>
          <div class="liqrow"><span>Frecuencia</span><b>${e.frecuencia||'—'}</b></div>
          <div class="liqrow"><span>Próximo pago</span><b>${e.proxPago}</b></div>
          <div class="liqrow hl"><span>Saldo pendiente</span><b class="num">${money(e.saldoPendiente)}</b></div>
          <div class="liqrow"><span>Total pagado (histórico)</span><b class="num">${money(e.totalPagado)}</b></div>
        </div>
        ${opera ? `<div style="display:flex;gap:8px"><button class="btn-primary" id="e-pago" style="flex:1">Registrar pago</button>
          <button class="btn-primary" id="e-edit" style="flex:1;background:var(--steel)">Editar</button>
          <button class="mini-no" id="e-baja" style="flex:0 0 auto;width:auto;padding:0 14px">Baja</button></div>` : ''}
        <div class="sec-h"><span class="t">Histórico de pagos</span><span class="ln"></span></div>
        ${e.historico.map(h=>`<div class="pago"><div class="izq"><span class="chip ${h.tipo==='EGRESO'?'pag':'ven'}">${h.tipo==='EGRESO'?'pago':'ingreso'}</span><span>${h.fecha}</span></div><span class="num" style="font-weight:600">${money(h.monto)}</span></div>`).join('') || '<div class="note">Sin movimientos</div>'}
      </div></div>`);
    document.body.appendChild(sub);
    sub.querySelector('.back').addEventListener('click', ()=>sub.remove());
    if (opera) {
      sub.querySelector('#e-pago').addEventListener('click', ()=>formPago(acRow, bancos, ()=>{ sub.remove(); cargar(); }));
      sub.querySelector('#e-edit').addEventListener('click', ()=>{ sub.remove(); formAlta(acRow, bancos); });
      sub.querySelector('#e-baja').addEventListener('click', async ()=>{ if(!confirm('¿Dar de baja a '+acRow.nombre+'?'))return; await repo.bajaAcreedor(acRow.id, perfil); sub.remove(); cargar(); });
    }
  }

  function formPago(acRow, bancos, done) {
    const sub = el(`<div class="overlay"><div class="ohead"><button class="back">←</button><div class="ot">Pago a ${acRow.nombre}</div></div>
      <div class="ocontent">
        <label class="alab">Tipo</label><select class="inp" id="p-t"><option value="EGRESO">Pago (le pago — baja su saldo)</option><option value="INGRESO">Ingreso (me prestó más — sube su saldo)</option></select>
        <label class="alab">Banco</label><select class="inp" id="p-c">${bancos.map(b=>`<option>${b.cuenta}</option>`).join('')}</select>
        <label class="alab">Monto</label><input class="inp" id="p-m" inputmode="decimal">
        <button class="btn-primary" id="p-go">Registrar</button><div class="login-err" id="p-e"></div></div></div>`);
    document.body.appendChild(sub);
    sub.querySelector('.back').addEventListener('click', ()=>sub.remove());
    sub.querySelector('#p-go').addEventListener('click', async ()=>{
      try{ const res = await repo.pagarAcreedor({ id:acRow.id, monto:sub.querySelector('#p-m').value, tipoMov:sub.querySelector('#p-t').value, cuenta:sub.querySelector('#p-c').value }, perfil);
        alert(res.msg); sub.remove(); done(); }
      catch(e){ const er=sub.querySelector('#p-e'); er.textContent=e.message; er.style.display='block'; }
    });
  }

  function formAlta(acRow, bancos) {
    const a = acRow||{};
    const sub = el(`<div class="overlay"><div class="ohead"><button class="back">←</button><div class="ot">${acRow?'Editar':'Nuevo'} acreedor</div></div>
      <div class="ocontent">
        <label class="alab">Nombre</label><input class="inp" id="a-n" value="${a.nombre||''}">
        <label class="alab">Tipo</label><input class="inp" id="a-t" value="${a.tipo||'INVERSIONISTA'}">
        <label class="alab">Capital invertido</label><input class="inp" id="a-md" inputmode="decimal" value="${a.monto_debo||''}">
        <label class="alab">Interés pactado (%)</label><input class="inp" id="a-pi" inputmode="decimal" value="${a.pct_interes||''}">
        <label class="alab">Frecuencia</label><input class="inp" id="a-f" value="${a.frecuencia||'MENSUAL'}">
        <label class="alab">Próximo pago</label><input class="inp" id="a-pp" type="date" value="${a.prox_pago? String(a.prox_pago).slice(0,10):''}">
        <label class="alab">Saldo pendiente (vacío = capital)</label><input class="inp" id="a-s" inputmode="decimal" value="${a.saldo!=null?a.saldo:''}">
        <label class="alab">Notas</label><input class="inp" id="a-no" value="${a.notas||''}">
        <button class="btn-primary" id="a-go">${acRow?'Guardar':'Dar de alta'}</button><div class="login-err" id="a-e"></div></div></div>`);
    document.body.appendChild(sub);
    sub.querySelector('.back').addEventListener('click', ()=>sub.remove());
    sub.querySelector('#a-go').addEventListener('click', async ()=>{
      const d = { id:a.id, nombre:sub.querySelector('#a-n').value, tipo:sub.querySelector('#a-t').value, montoDebo:sub.querySelector('#a-md').value,
        pctInteres:sub.querySelector('#a-pi').value, frecuencia:sub.querySelector('#a-f').value, proxPago:sub.querySelector('#a-pp').value,
        saldo:sub.querySelector('#a-s').value, notas:sub.querySelector('#a-no').value };
      try{ const res = await repo.guardarAcreedor(d, perfil); alert(res.msg); sub.remove(); cargar(); }
      catch(e){ const er=sub.querySelector('#a-e'); er.textContent=e.message; er.style.display='block'; }
    });
  }

  cargar();
}
