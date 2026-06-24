// Vista Cuentas — CxP (por pagar) y CxC (por cobrar, derivado de cartera). ADMIN/GERENTE/AUX.
import { el, money } from '../lib/dom.js';
import { construirCxP, construirCxC } from '../services/cuentas.service.js';
import * as repo from '../repositories/cuentas.repo.js';
import { fetchBancos } from '../repositories/bancos.repo.js';
import { fetchCartera, fetchAllCalendarios } from '../repositories/clientes.repo.js';
import { agruparCalendario } from '../services/clientes.service.js';

export async function abrirCuentas(perfil) {
  if (!['ADMIN','GERENTE','AUX_ADMIN'].includes(perfil.rol)) { alert('Solo administración.'); return; }
  const opera = ['ADMIN','AUX_ADMIN'].includes(perfil.rol);
  const ov = el(`<div class="overlay"><div class="ohead"><button class="back">←</button><div class="ot">Cuentas (CxP / CxC)</div></div><div class="ocontent"><div class="loader">Cargando…</div></div></div>`);
  document.body.appendChild(ov);
  const c = ov.querySelector('.ocontent');
  ov.querySelector('.back').addEventListener('click', () => ov.remove());
  let TAB = 'CXP';

  async function cargar() {
    c.innerHTML = '<div class="loader">Cargando…</div>';
    const [cxp, bancos, cartera, cals] = await Promise.all([repo.fetchCxP(), fetchBancos(), fetchCartera(), fetchAllCalendarios()]);
    const p = construirCxP(cxp);
    const calBy = agruparCalendario(cals);
    const x = construirCxC(cartera, calBy, perfil.rol, perfil.ejecutivo);

    c.innerHTML = `
      <div class="vtabs" style="display:flex;gap:6px;margin-bottom:12px">
        <button class="t-cxp" style="flex:1;padding:8px;border-radius:14px;border:1px solid var(--line);background:${TAB==='CXP'?'var(--navy)':'#fff'};color:${TAB==='CXP'?'#fff':'var(--navy)'};font-weight:700;cursor:pointer">Por pagar</button>
        <button class="t-cxc" style="flex:1;padding:8px;border-radius:14px;border:1px solid var(--line);background:${TAB==='CXC'?'var(--navy)':'#fff'};color:${TAB==='CXC'?'#fff':'var(--navy)'};font-weight:700;cursor:pointer">Por cobrar</button>
      </div>
      <div id="cx-body"></div>`;
    c.querySelector('.t-cxp').addEventListener('click', ()=>{ TAB='CXP'; cargar(); });
    c.querySelector('.t-cxc').addEventListener('click', ()=>{ TAB='CXC'; cargar(); });
    const body = c.querySelector('#cx-body');

    if (TAB==='CXP') {
      body.innerHTML = `
        <div class="kpis"><div class="kcard"><div class="klab">Por pagar</div><div class="kval num" style="color:var(--red)">${money(p.totalPendiente)}</div><div class="kfoot">${p.pendientes.length} cuentas</div></div>
          <div class="kcard"><div class="klab">Vencidas</div><div class="kval num">${money(p.totalVencido)}</div><div class="kfoot">${p.nVencidas} vencidas</div></div></div>
        ${opera?'<button class="btn-primary" id="cx-nueva" style="margin-bottom:8px">+ Nueva cuenta por pagar</button>':''}
        ${p.pendientes.map(it=>`<div class="cli" data-id="${it.id}" style="display:block">
          <div style="display:flex;justify-content:space-between"><div><div class="nm">${it.concepto}</div><div class="mt">${it.proveedor||'—'}${it.vencimiento?(' · vence '+it.vencimiento+(it.diasVenc<0?' (vencida)':'')):''}</div></div><div class="sal num">${money(it.monto)}</div></div>
          ${opera?`<div style="display:flex;gap:7px;margin-top:8px"><button class="mini-ok" data-pg="${it.id}" style="width:auto;padding:6px 12px">Pagar</button><button class="mini-no" data-del="${it.id}" style="width:auto;padding:6px 12px">Eliminar</button></div>`:''}
        </div>`).join('')||'<div class="note">Sin cuentas por pagar pendientes. 🎉</div>'}`;
      if (opera) {
        body.querySelector('#cx-nueva').addEventListener('click', ()=>formCxP(null));
        body.querySelectorAll('[data-pg]').forEach(b=>b.addEventListener('click', ()=>{ const it=p.pendientes.find(x=>String(x.id)===b.dataset.pg); formPagar(it, bancos); }));
        body.querySelectorAll('[data-del]').forEach(b=>b.addEventListener('click', async ()=>{ if(!confirm('¿Eliminar esta cuenta?'))return; await repo.bajaCxP(b.dataset.del, perfil); cargar(); }));
      }
    } else {
      body.innerHTML = `
        <div class="kpis"><div class="kcard"><div class="klab">Total por cobrar</div><div class="kval num">${money(x.total)}</div><div class="kfoot">saldo de cartera</div></div>
          <div class="kcard"><div class="klab">Vencido</div><div class="kval num" style="color:var(--red)">${money(x.vencido)}</div><div class="kfoot">vigente ${money(x.vigente)}</div></div></div>
        <div class="sec-h"><span class="t">Antigüedad (aging)</span><span class="ln"></span></div>
        <div class="fcard">
          <div class="liqrow"><span>Al corriente</span><b class="num">${money(x.buckets['0'])}</b></div>
          <div class="liqrow"><span>1–7 días</span><b class="num">${money(x.buckets['1-7'])}</b></div>
          <div class="liqrow"><span>8–15 días</span><b class="num">${money(x.buckets['8-15'])}</b></div>
          <div class="liqrow"><span>16–30 días</span><b class="num">${money(x.buckets['16-30'])}</b></div>
          <div class="liqrow hl"><span>+30 días</span><b class="num" style="color:var(--red)">${money(x.buckets['+30'])}</b></div>
        </div>
        <div class="note" style="margin-top:10px">Las cuentas por cobrar se calculan en vivo desde la cartera (saldo pendiente). Para gestionarlas usa Cobranza.</div>`;
    }
  }

  function formCxP(it) {
    const sub = el(`<div class="overlay"><div class="ohead"><button class="back">←</button><div class="ot">${it?'Editar':'Nueva'} cuenta por pagar</div></div>
      <div class="ocontent">
        <label class="alab">Concepto</label><input class="inp" id="x-con" value="${it?it.concepto:''}">
        <label class="alab">Proveedor</label><input class="inp" id="x-prov" value="${it?it.proveedor:''}">
        <label class="alab">Monto</label><input class="inp" id="x-monto" inputmode="decimal" value="${it?it.monto:''}">
        <label class="alab">Vence</label><input class="inp" id="x-venc" type="date" value="${it?it.vencimiento:''}">
        <label class="alab">Notas</label><input class="inp" id="x-notas">
        <button class="btn-primary" id="x-go">${it?'Guardar':'Registrar'}</button><div class="login-err" id="x-e"></div></div></div>`);
    document.body.appendChild(sub);
    sub.querySelector('.back').addEventListener('click', ()=>sub.remove());
    sub.querySelector('#x-go').addEventListener('click', async ()=>{
      const d={ id:it?it.id:null, concepto:sub.querySelector('#x-con').value, proveedor:sub.querySelector('#x-prov').value, monto:sub.querySelector('#x-monto').value, vencimiento:sub.querySelector('#x-venc').value, notas:sub.querySelector('#x-notas').value };
      try{ const res=await repo.guardarCxP(d, perfil); alert(res.msg); sub.remove(); cargar(); }catch(e){ const er=sub.querySelector('#x-e'); er.textContent=e.message; er.style.display='block'; }
    });
  }
  function formPagar(it, bancos) {
    const sub = el(`<div class="overlay"><div class="ohead"><button class="back">←</button><div class="ot">Pagar: ${it.concepto}</div></div>
      <div class="ocontent">
        <div class="note" style="margin-bottom:10px">Monto: <b>${money(it.monto)}</b></div>
        <label class="alab">Banco</label><select class="inp" id="pg-b">${bancos.map(b=>`<option>${b.cuenta}</option>`).join('')}</select>
        <button class="btn-primary" id="pg-go">Registrar pago</button><div class="login-err" id="pg-e"></div></div></div>`);
    document.body.appendChild(sub);
    sub.querySelector('.back').addEventListener('click', ()=>sub.remove());
    sub.querySelector('#pg-go').addEventListener('click', async ()=>{
      try{ const res=await repo.pagarCxP(it, sub.querySelector('#pg-b').value, perfil); alert(res.msg); sub.remove(); cargar(); }catch(e){ const er=sub.querySelector('#pg-e'); er.textContent=e.message; er.style.display='block'; }
    });
  }
  cargar();
}
