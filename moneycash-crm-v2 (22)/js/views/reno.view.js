// Vista Renovaciones / Reactivaciones — bandeja de solicitudes pendientes (aprobar/rechazar). ADMIN/GERENTE.
import { el, money } from '../lib/dom.js';
import { fetchSolicitudesReno, aprobarSolicitudReno, rechazarSolicitudReno } from '../repositories/reno.repo.js';

export async function abrirReno(perfil, onChange) {
  if (!['ADMIN','GERENTE'].includes(perfil.rol)) { alert('Solo Admin/Gerente resuelven solicitudes.'); return; }
  const ov = el(`<div class="overlay"><div class="ohead"><button class="back">\u2190</button><div class="ot">Renovaciones</div></div><div class="ocontent"><div class="loader">Cargando solicitudes\u2026</div></div></div>`);
  document.body.appendChild(ov);
  const c = ov.querySelector('.ocontent');
  ov.querySelector('.back').addEventListener('click', () => { ov.remove(); if (onChange) onChange(); });

  async function cargar() {
    c.innerHTML = '<div class="loader">Cargando solicitudes\u2026</div>';
    const sols = await fetchSolicitudesReno('PENDIENTE');
    if (!sols.length) { c.innerHTML = '<div class="note" style="text-align:center;color:var(--green);font-weight:600;padding:20px">Sin solicitudes pendientes.</div>'; return; }

    c.innerHTML = sols.map((s,i)=>{
      const reno = String(s.tipo).toUpperCase()==='RENOVACION';
      const col = reno ? 'var(--amber)' : 'var(--steel)';
      return `<div class="reno-card" data-i="${i}" style="border-left-color:${col}">
        <div class="reno-tag" style="color:${col}">${s.tipo}</div>
        <div class="reno-cli">${s.cliente}</div>
        <div class="reno-meta">Ejecutivo: ${s.ejecutivo||'—'} · ${String(s.fecha||'').slice(0,10)}</div>
        ${reno?`<div class="reno-line">Saldo actual: <b style="color:var(--red)">${money(s.saldo_actual)}</b></div>`:''}
        <div class="reno-line">Nuevo crédito: <b>${money(s.monto_nuevo)}</b> · ${s.plazo} pagos ${s.frecuencia||''}</div>
        <div class="reno-fin">
          <div>Abono puntual: <b>${money(s.abono_puntual)}</b> · Impuntual: <b>${money(s.abono_impuntual)}</b></div>
          <div>Comisión: ${money(s.comision)} · Depósito: <b>${money(s.deposito)}</b></div>
          <div>${s.tipo_cred||'PERSONAL'}${s.financiar?' · comisión financiada':''}</div>
        </div>
        <div class="reno-btns"><button class="aut-ok" data-ap>Aprobar</button><button class="aut-no" data-rj>Rechazar</button></div>
      </div>`;
    }).join('');

    sols.forEach((s,i)=>{
      const card = c.querySelector(`[data-i="${i}"]`);
      card.querySelector('[data-ap]').addEventListener('click', async ()=>{
        if (!confirm('¿Aprobar la solicitud de '+s.cliente+'? Entrará a Tubería como "Listo para Surtir".')) return;
        try { const r = await aprobarSolicitudReno(s, perfil); alert(r.msg); cargar(); } catch(e){ alert(e.message); }
      });
      card.querySelector('[data-rj]').addEventListener('click', async ()=>{
        const motivo = prompt('Motivo del rechazo:'); if (motivo===null) return;
        try { const r = await rechazarSolicitudReno(s, motivo, perfil); alert(r.msg); cargar(); } catch(e){ alert(e.message); }
      });
    });
  }
  cargar();
}
