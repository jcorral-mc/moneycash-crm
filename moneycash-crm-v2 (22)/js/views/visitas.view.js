// Vista Visitas — pestañas por tipo, urgencia por días, asignar (con horario abierto) y resolver.
import { el } from '../lib/dom.js';
import { construirLista, VIS_TIPOS, tipoAsignable, colorUrgencia } from '../services/visitas.service.js';
import { fetchVisitas, asignarVisita, resolverVisita, resolverVerificacion, guardarAvanceTitular, reprogramarVisita } from '../repositories/visitas.repo.js';

const PUNTOS_VERIF = ['Identificación vigente y en físico','Comprobante de domicilio reciente (≤3 meses)','Fachada que coincida','Garantías del interior','Colonia o calle viable'];

const URG = { red:'#c0392b', amber:'#C9A227', blue:'#103A63', green:'#1E7A52' };

export async function abrirVisitas(perfil) {
  if (!['ADMIN','GERENTE','AUX_ADMIN','JURIDICO','VISITAS'].includes(perfil.rol)) { alert('No autorizado para Visitas.'); return; }
  const ov = el(`<div class="overlay"><div class="ohead"><button class="back">←</button><div class="ot">Visitas</div></div><div class="ocontent"><div class="loader">Cargando…</div></div></div>`);
  document.body.appendChild(ov);
  const c = ov.querySelector('.ocontent');
  ov.querySelector('.back').addEventListener('click', () => ov.remove());

  // Pestaña inicial según rol
  let TAB = perfil.rol === 'JURIDICO' ? 'JURIDICO' : (perfil.rol === 'VISITAS' ? 'VERIFICACION' : 'COBRANZA');

  async function cargar() {
    c.innerHTML = '<div class="loader">Cargando…</div>';
    const todas = await fetchVisitas();
    const { visitas, conteos, urgencia, total } = construirLista(todas, TAB);
    const puedeAsignar = !!tipoAsignable(TAB, perfil.rol);
    const puedeResolver = ['ADMIN','GERENTE','JURIDICO','VISITAS'].includes(perfil.rol);

    c.innerHTML = `
      <div class="vtabs" style="display:flex;gap:6px;overflow-x:auto;margin-bottom:12px">
        ${VIS_TIPOS.map(t=>`<button class="vtab ${t.tipo===TAB?'on':''}" data-tab="${t.tipo}"
          style="flex:0 0 auto;padding:7px 13px;border-radius:18px;border:1px solid var(--line);background:${t.tipo===TAB?'var(--navy)':'#fff'};color:${t.tipo===TAB?'#fff':'var(--navy)'};font-weight:700;font-size:.82em;cursor:pointer">
          ${t.etiqueta}${conteos[t.tipo]?` (${conteos[t.tipo]})`:''}</button>`).join('')}
      </div>
      ${(urgencia.urgente||urgencia.medio||urgencia.atencion) ? `<div class="note" style="margin-bottom:10px">
        ${urgencia.urgente?`<b style="color:${URG.red}">${urgencia.urgente} urgentes</b> · `:''}${urgencia.medio?`${urgencia.medio} medias · `:''}${urgencia.atencion?`${urgencia.atencion} atención`:''}</div>` : ''}
      ${puedeAsignar ? `<button class="btn-primary" id="v-nueva" style="margin-bottom:10px">+ Asignar visita</button>` : ''}
      <div id="v-lista"></div>`;

    c.querySelectorAll('.vtab').forEach(b => b.addEventListener('click', () => { TAB = b.dataset.tab; cargar(); }));
    if (puedeAsignar) c.querySelector('#v-nueva').addEventListener('click', () => formAsignar());

    const lista = c.querySelector('#v-lista');
    lista.innerHTML = visitas.map(v => {
      const col = URG[colorUrgencia(v.dias)];
      const dtxt = v.dias<=0 ? 'hoy' : (v.dias+'d');
      return `<div class="cli" data-id="${v.id}" style="display:block;border-left:4px solid ${col}">
        <div style="display:flex;justify-content:space-between;align-items:flex-start">
          <div><div class="nm">${v.cliente}</div><div class="mt">${v.refId?v.refId+' · ':''}${v.direccion||'sin dirección'}</div>
            <div class="mt">🕐 ${v.horarios||'sin hora'}${v.asigna?(' · asignó '+v.asigna):''}</div>
            ${v.comentarios?`<div class="mt">📝 ${v.comentarios}</div>`:''}</div>
          <span style="font-size:.62em;font-weight:800;color:#fff;background:${col};padding:3px 9px;border-radius:9px;white-space:nowrap">${dtxt}${v.dias>=3?' ⚠️':''}</span>
        </div>
        ${puedeResolver?`<button class="mini-ok" data-rv="${v.id}" style="margin-top:8px;width:auto;padding:6px 12px">Marcar realizada</button>`:''}
      </div>`;
    }).join('') || '<div class="note">No hay visitas pendientes en este tipo.</div>';

    if (puedeResolver) lista.querySelectorAll('[data-rv]').forEach(b => b.addEventListener('click', (e) => {
      e.stopPropagation(); const v = visitas.find(x=>String(x.id)===b.dataset.rv); formResolver(v);
    }));
  }

  function formAsignar() {
    const sub = el(`<div class="overlay"><div class="ohead"><button class="back">←</button><div class="ot">Asignar visita (${TAB})</div></div>
      <div class="ocontent">
        <label class="alab">Cliente *</label><input class="inp" id="a-cli">
        <label class="alab">Teléfono</label><input class="inp" id="a-tel" inputmode="tel">
        <label class="alab">Dirección</label><input class="inp" id="a-dir">
        <label class="alab">Referencias</label><input class="inp" id="a-ref">
        <label class="alab">Fecha</label><input class="inp" id="a-fec" type="date">
        <label class="alab">Hora</label><input class="inp" id="a-hora" type="time">
        <label style="display:flex;align-items:center;gap:8px;font-size:.84em;color:#5a7384;margin:10px 0;cursor:pointer">
          <input type="checkbox" id="a-abierto" style="width:16px;height:16px"> Horario abierto (sin hora fija)</label>
        <label class="alab">Motivo / comentario</label><input class="inp" id="a-mot">
        <button class="btn-primary" id="a-go">Asignar</button><div class="login-err" id="a-e"></div></div></div>`);
    document.body.appendChild(sub);
    sub.querySelector('.back').addEventListener('click', ()=>sub.remove());
    sub.querySelector('#a-fec').value = new Date().toISOString().slice(0,10);
    const ab = sub.querySelector('#a-abierto'), hr = sub.querySelector('#a-hora');
    ab.addEventListener('change', ()=>{ hr.disabled = ab.checked; });
    sub.querySelector('#a-go').addEventListener('click', async ()=>{
      const horaVal = sub.querySelector('#a-hora').value;
      const d = { tipo:TAB, cliente:sub.querySelector('#a-cli').value, telefono:sub.querySelector('#a-tel').value,
        direccion:sub.querySelector('#a-dir').value, referencias:sub.querySelector('#a-ref').value,
        fecha:sub.querySelector('#a-fec').value, horario: horaVal ? (horaVal+'-'+_masUnaHora(horaVal)) : '',
        horarioAbierto: ab.checked, comentario:sub.querySelector('#a-mot').value };
      try { const res = await asignarVisita(d, perfil); alert(res.msg); sub.remove(); cargar(); }
      catch(e){ const er=sub.querySelector('#a-e'); er.textContent=e.message; er.style.display='block'; }
    });
  }

  // Campo de foto (cámara + galería) — comparten estado
  function campoFoto(id, titulo) {
    return `<div class="vf-foto"><div class="vf-foto-t">${titulo}</div>
      <div style="display:flex;gap:6px">
        <label class="vf-btn cam">Cámara<input type="file" accept="image/*" capture="environment" id="${id}" style="display:none"></label>
        <label class="vf-btn gal">Galería<input type="file" accept="image/*" id="${id}_g" style="display:none"></label>
      </div><div class="vf-lbl" id="${id}_l"></div></div>`;
  }
  function wireFoto(sub, id) {
    const cam=sub.querySelector('#'+id), gal=sub.querySelector('#'+id+'_g'), lbl=sub.querySelector('#'+id+'_l');
    const mark = inp => { const otra = inp===cam?gal:cam; if (otra) otra.value=''; const f=inp.files&&inp.files[0]; if (lbl) lbl.textContent = f?('✓ '+String(f.name||'foto').slice(0,26)):''; };
    cam.addEventListener('change', ()=>mark(cam)); gal.addEventListener('change', ()=>mark(gal));
  }
  function leerFotos(sub, ids) {
    return ids.map(id => { const c=sub.querySelector('#'+id), g=sub.querySelector('#'+id+'_g');
      return (c&&c.files&&c.files[0]) || (g&&g.files&&g.files[0]) || null; }).filter(Boolean);
  }

  function formResolver(v) {
    const esVerif = v.tipo === 'VERIFICACION';
    const tieneAval = v.aval && String(v.aval).trim() !== '';
    const sub = el(`<div class="overlay"><div class="ohead"><button class="back">\u2190</button><div class="ot">${v.cliente}</div></div><div class="ocontent"></div></div>`);
    document.body.appendChild(sub);
    sub.querySelector('.back').addEventListener('click', ()=>sub.remove());
    const oc = sub.querySelector('.ocontent');

    let h = `<div class="note" style="margin-bottom:10px">${v.tipo} · ${v.direccion||'sin dirección'}${v.horarios?(' · '+v.horarios):''}</div>`;
    if (v.comentarios) h += `<div class="vf-ctx">Contexto: ${v.comentarios}</div>`;

    if (esVerif) {
      h += `<div class="vf-sech">Estudio del cliente${v.titular_listo?' (guardado)':''}</div>`;
      h += `<div class="vf-chk">${PUNTOS_VERIF.map((t,i)=>`<label class="vf-item"><input type="checkbox" class="chk-cli" data-l="${t}"> ${t}</label>`).join('')}</div>`;
      h += `<label class="alab">Comentarios del cliente</label><textarea class="inp" id="v-com" rows="2"></textarea>`;
      if (tieneAval) {
        h += `<div class="vf-sech" style="color:var(--steel)">Estudio del aval — ${v.aval}</div>`;
        h += `<div class="vf-chk">${PUNTOS_VERIF.map((t)=>`<label class="vf-item"><input type="checkbox" class="chk-aval" data-l="${t}"> ${t}</label>`).join('')}</div>`;
        h += `<label class="alab">Comentarios del aval</label><textarea class="inp" id="v-com-aval" rows="2"></textarea>`;
      }
      h += `<div class="vf-sech">Evidencias (mín. 1)</div>`;
      h += campoFoto('vf1','Foto 1 (obligatoria)')+campoFoto('vf2','Foto 2')+campoFoto('vf3','Foto 3');
      if (!v.titular_listo) h += `<button class="p-sec" id="v-avance" style="width:100%;margin-top:10px">Guardar avance del titular (retomar aval después)</button>`;
      h += `<div style="display:flex;gap:8px;margin-top:10px"><button class="aut-ok" id="v-ap" style="flex:1">Aprobar</button><button class="aut-no" id="v-rj" style="flex:1">Rechazar</button></div>`;
      h += `<div class="note" style="margin-top:8px">Si apruebas, el crédito pasa a Listo para Surtir.</div>`;
    } else {
      h += `<label class="alab">Resultado *</label><select class="inp" id="v-res"><option value="">Selecciona\u2026</option><option>Localizado - promesa de pago</option><option>Localizado - se niega</option><option>No localizado</option><option>Domicilio incorrecto</option><option>Se localiza familia</option><option>Cambio de domicilio</option></select>`;
      h += `<label class="alab">Hora real de la visita</label><input class="inp" id="v-hora" type="time">`;
      h += `<div class="vf-sech">Evidencias (mín. 1)</div>`+campoFoto('vf1','Evidencia 1')+campoFoto('vf2','Evidencia 2')+campoFoto('vf3','Evidencia 3');
      h += `<label class="alab">Comentarios</label><textarea class="inp" id="v-com" rows="2"></textarea>`;
      h += `<button class="btn-primary" id="v-go" style="margin-top:6px">Guardar resultado</button>`;
    }
    // Reprogramar (común)
    h += `<div class="vf-div"></div><div class="vf-sech">¿No estaba? Reprograma con evidencia</div>`;
    h += `<label class="alab">Nueva fecha</label><input class="inp" id="v-refecha" type="date">`;
    h += `<label class="alab">Nuevo horario (opcional)</label><input class="inp" id="v-rehora" placeholder="Ej: 6:00 pm">`;
    h += `<label class="alab">Motivo</label><textarea class="inp" id="v-remotivo" rows="2" placeholder="Cliente no estaba\u2026"></textarea>`;
    h += `<button class="btn-primary" id="v-reprog" style="margin-top:6px;background:var(--amber)">Enviar evidencia y reprogramar</button>`;
    h += `<div class="note" style="margin-top:6px">Usa las mismas fotos de arriba como evidencia.</div>`;
    oc.innerHTML = h;

    ['vf1','vf2','vf3'].forEach(id=>wireFoto(sub, id));
    const close = () => { sub.remove(); cargar(); };

    if (esVerif) {
      const avance = sub.querySelector('#v-avance');
      if (avance) avance.addEventListener('click', async ()=>{
        const chk = [...sub.querySelectorAll('.chk-cli')].filter(x=>x.checked).map(x=>x.dataset.l).join(', ');
        if (!confirm('¿Guardar avance del titular de '+v.cliente+'?')) return;
        avance.disabled=true; avance.textContent='Subiendo\u2026';
        try { const r=await guardarAvanceTitular(v, { checklist:chk, comentarios:sub.querySelector('#v-com').value, fotos:leerFotos(sub,['vf1','vf2','vf3']) }, perfil); alert(r.msg); close(); }
        catch(e){ alert(e.message); avance.disabled=false; avance.textContent='Guardar avance del titular (retomar aval después)'; }
      });
      const resolver = async (aprobado) => {
        const fotos = leerFotos(sub, ['vf1','vf2','vf3']);
        if (!fotos.length) { alert('Sube al menos 1 foto de evidencia.'); return; }
        if (!confirm('¿Confirmas '+(aprobado?'APROBAR':'RECHAZAR')+' la verificación de '+v.cliente+'?')) return;
        const chkCli = [...sub.querySelectorAll('.chk-cli')].filter(x=>x.checked).map(x=>x.dataset.l);
        const chkAval = [...sub.querySelectorAll('.chk-aval')].filter(x=>x.checked).map(x=>x.dataset.l);
        let checklist = 'Cliente: '+(chkCli.join(', ')||'ninguno'); if (tieneAval) checklist += ' | Aval: '+(chkAval.join(', ')||'ninguno');
        let com = sub.querySelector('#v-com').value; const ca=sub.querySelector('#v-com-aval'); if (ca&&ca.value) com += (com?' | ':'')+'Aval: '+ca.value;
        sub.querySelectorAll('button').forEach(b=>b.disabled=true);
        try { const r=await resolverVerificacion(v, { resultado:aprobado?'APROBADO':'RECHAZADO', checklist, comentarios:com, fotos }, perfil); alert(r.msg); close(); }
        catch(e){ alert(e.message); sub.querySelectorAll('button').forEach(b=>b.disabled=false); }
      };
      sub.querySelector('#v-ap').addEventListener('click', ()=>resolver(true));
      sub.querySelector('#v-rj').addEventListener('click', ()=>resolver(false));
      // precargar avance del titular
      if (v.titular_listo && v.avance_cli) { const m=v.avance_cli.split(', '); sub.querySelectorAll('.chk-cli').forEach(c=>{ if(m.indexOf(c.dataset.l)>=0) c.checked=true; }); }
      if (v.titular_listo && v.avance_com_cli) sub.querySelector('#v-com').value = v.avance_com_cli;
    } else {
      sub.querySelector('#v-go').addEventListener('click', async ()=>{
        const res = sub.querySelector('#v-res').value; if (!res) { alert('Selecciona el resultado.'); return; }
        const fotos = leerFotos(sub, ['vf1','vf2','vf3']); if (!fotos.length) { alert('Sube al menos 1 foto de evidencia.'); return; }
        const btn=sub.querySelector('#v-go'); btn.disabled=true; btn.textContent='Subiendo fotos\u2026';
        try { const r=await resolverVisita(v, { resultado:res, horaVisita:sub.querySelector('#v-hora').value, comentarios:sub.querySelector('#v-com').value, fotos }, perfil); alert(r.msg); close(); }
        catch(e){ alert(e.message); btn.disabled=false; btn.textContent='Guardar resultado'; }
      });
    }

    sub.querySelector('#v-reprog').addEventListener('click', async ()=>{
      const nf = sub.querySelector('#v-refecha').value; if (!nf) { alert('Elige la nueva fecha.'); return; }
      const fotos = leerFotos(sub, ['vf1','vf2','vf3']); if (!fotos.length) { alert('Sube al menos 1 foto de evidencia de que no estaba.'); return; }
      const btn=sub.querySelector('#v-reprog'); btn.disabled=true; btn.textContent='Subiendo evidencia\u2026';
      try { const r=await reprogramarVisita(v, { nuevaFecha:nf, nuevoHorario:sub.querySelector('#v-rehora').value, motivo:sub.querySelector('#v-remotivo').value, fotos }, perfil); alert(r.msg); close(); }
      catch(e){ alert(e.message); btn.disabled=false; btn.textContent='Enviar evidencia y reprogramar'; }
    });
  }

  cargar();
}

function _masUnaHora(hhmm) {
  const m = String(hhmm).split(':'); if (m.length<2) return hhmm;
  return String((parseInt(m[0],10)+1)%24).padStart(2,'0')+':'+m[1];
}
