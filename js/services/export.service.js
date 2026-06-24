// Exportación / backup — convierte filas a CSV (escapando comillas y comas).
export function toCSV(rows) {
  if (!rows || !rows.length) return '';
  const cols = Object.keys(rows[0]);
  const esc = v => { if (v==null) return ''; const s=String(v); return /[",\n]/.test(s) ? '"'+s.replace(/"/g,'""')+'"' : s; };
  const head = cols.join(',');
  const body = rows.map(r => cols.map(c => esc(r[c])).join(',')).join('\n');
  return head + '\n' + body;
}
