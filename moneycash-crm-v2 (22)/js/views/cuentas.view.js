// Vista Cuentas por pagar (CxP). ADMIN/GERENTE/AUX. (El "Por cobrar" vive en Cobranza.)
import { el, money } from '../lib/dom.js';
import { construirCxP } from '../services/cuentas.service.js';
import * as repo from '../repositories/cuentas.repo.js';
import { fetchBancos } from '../repositories/bancos.repo.js';

export async function abrirCuentas(perfil) {
  if (!['ADMIN','GERENTE','AUX_ADMIN'].includes(perfil.rol)) { alert('Solo administración.'); return; }
  const opera = ['ADMIN','AUX_ADMIN'].includes(perfil.rol);
  const ov = el(`<div class="overlay"><div class="ohead"><button class="back">←</button><div class="ot">Cuentas por pagar</div></div><div class="ocontent"><div class="loader">Cargando…</div></div></div>`);
  document.body.appendChild(ov);
  const c = ov.querySelector('.ocontent');
  ov.querySelector('.back').addEventListener('click', () => ov.remove());

  async function cargar() {
    c.innerHTML = '<div class="loader">Cargando…</div>';
    const [cxp, bancos] = await Promise.all([repo.fetchCxP(), fetchBancos()]);
    const p = construirCxP(cxp);

    c.innerHTML = `
      <div class="kpis"><div class="kcard"><div class="klab">Por pagar</div><div class="kval num" style="color:var(--red)">${money(p.totalPendiente)}</div><div class="kfoot">${p.pendientes.length} cuentas</div></div>
        <div class="kcard"><div class="klab">Vencidas</div><div class="kval num">${money(p.totalVencido)}</div><div class="kfoot">${p.nVencidas} vencidas</div></div></div>
      ${opera?'<button class="btn-primary" id="cx-nueva" style="margin-bottom:8px">+ Nueva cuenta por pagar</button>':''}
      ${p.pendientes.map(it=>`<div class="cli" data-id="${it.id}" style="display:block">
        <div style="display:flex;justify-content:space-between"><div><div class="nm">${it.concepto}</div><div class="mt">${it.proveedor||'—'}${it.vencimiento?(' · vence '+it.vencimiento+(it.diasVenc<0?' (vencida)':'')):''}</div></div><div class="sal num">${money(it.monto)}</div></div>
        ${opera?`<div style="display:flex;gap:7px;margin-top:8px"><button class="mini-ok" data-pg="${it.id}" style="width:auto;padding:6px 12px">Pagar</button><button class="mini-no" data-del="${it.id}" style="width:auto;padding:6px 12px">Eliminar</button></div>`:''}
      </div>`).join('')||'<div class="note">Sin cuentas por pagar pendientes.</div>'}`;
    if (opera) {
      c.querySelector('#cx-nueva').addEventListener('click', ()=>formCxP(null));
      c.querySelectorAll('[data-pg]').forEach(b=>b.addEventListener('click', ()=>{ const it=p.pendientes.find(x=>String(x.id)===b.dataset.pg); formPagar(it, bancos); }));
      c.querySelectorAll('[data-del]').forEach(b=>b.addEventListener('click', async ()=>{ if(!confirm('¿Eliminar esta cuenta?'))return; await repo.bajaCxP(b.dataset.del, perfil); cargar(); }));
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
