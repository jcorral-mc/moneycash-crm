// Helpers de UI y formato
export const $  = (sel, root=document) => root.querySelector(sel);
export const $$ = (sel, root=document) => [...root.querySelectorAll(sel)];
export const el = (html) => { const t=document.createElement('template'); t.innerHTML=html.trim(); return t.content.firstElementChild; };
export const money = (n) => '$' + Number(n||0).toLocaleString('es-MX',{maximumFractionDigits:0});
export const norm  = (s) => (s||'').toString().trim().toUpperCase();
export const iniciales = (s) => { const p=(s||'').trim().split(/\s+/); return ((p[0]||'')[0]||'')+((p[1]||'')[0]||''); };
export const saludo = () => { const h=new Date().getHours(); return h<12?'Buenos días':h<19?'Buenas tardes':'Buenas noches'; };
