// Lógica de surtimiento — réplica de frontendEnviarACartera del Script.
// Calcula capital, dispersión y valida el reparto de bancos.

/** Capital que queda en cartera y dispersión (dinero que sale de bancos). */
export function calcularSurtimiento(prospecto) {
  const monto = parseFloat(prospecto.monto) || 0;
  const comision = parseFloat(prospecto.comision) || 0;
  const esFinanciada = !!prospecto.financiar;
  const capital = esFinanciada ? monto + comision : monto;     // queda en cartera
  const dispersion = esFinanciada ? monto : (monto - comision); // sale de bancos
  const esReno = String(prospecto.tipo_cliente||'').toUpperCase() === 'RENOVACION';
  const adeudoReno = esReno ? Math.round(parseFloat(prospecto.adeudo_actual)||0) : 0;
  const objetivoReparto = dispersion - adeudoReno;             // lo que realmente se deposita
  return { monto, comision, esFinanciada, capital, dispersion, esReno, adeudoReno, objetivoReparto };
}

/** Valida que el reparto de bancos cuadre con lo que se le deposita al cliente. */
export function validarReparto(reparto, objetivoReparto) {
  const lista = (reparto||[]).filter(r => r && String(r.cuenta||'').trim() && (parseFloat(r.monto)||0) > 0);
  if (!lista.length) throw new Error('Indica de qué cuenta(s) sale el dinero.');
  const suma = lista.reduce((s,r)=>s+(parseFloat(r.monto)||0), 0);
  if (Math.abs(suma - objetivoReparto) > 1) {
    throw new Error(`El reparto ($${Math.round(suma).toLocaleString('es-MX')}) no cuadra con lo que se deposita al cliente ($${Math.round(objetivoReparto).toLocaleString('es-MX')}).`);
  }
  return lista.map(r => ({ cuenta:String(r.cuenta).trim(), monto:Math.round(parseFloat(r.monto)) }));
}
