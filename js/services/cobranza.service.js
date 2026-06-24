// Lógica de Cobranza — RÉPLICA de obtenerCobranza (Apps Script).
// Prioridad por días vencidos + preventivos (próximos 3 días). Buckets y KPIs.
import { GRACIA_DIAS } from '../config.js';
import { norm } from '../lib/dom.js';

const U = s => String(s||'').toUpperCase();
const fdate = d => d ? new Date(d).toLocaleDateString('es-MX',{day:'2-digit',month:'2-digit',year:'numeric'}) : '';

export const COB_ESTADOS = ['CONTACTADO','PROMESA','NO CONTESTA','ILOCALIZABLE','REVISION CON GERENCIA'];

/** _diasVencido: días pasados tras (fecha + gracia). 0 si aún no pasa gracia. */
function diasVencido(fecha, hoy) {
  if (!fecha) return 0;
  const lim = new Date(fecha); lim.setHours(0,0,0,0); lim.setDate(lim.getDate()+GRACIA_DIAS);
  const h = new Date(hoy); h.setHours(0,0,0,0);
  const ms = h - lim; return ms<=0 ? 0 : Math.floor(ms/86400000);
}
function bucketDias(d) { if(d<=0)return'prox'; if(d<=7)return'7'; if(d<=15)return'15'; if(d<=30)return'30'; if(d<=45)return'45'; return'45+'; }

/** color del cliente para el front (azul→rojo). prox=azul, 1-7 amarillo, 8-15 ámbar, 16+ rojo, 45+ crítico */
export function colorBucket(bucket) {
  return { 'prox':'blue', '7':'amber', '15':'amber', '30':'red', '45':'red', '45+':'crit' }[bucket] || 'blue';
}

/** RÉPLICA de obtenerCobranza. Devuelve { kpis, ejecutivos:[{ejecutivo,totalVencido,nClientes,clientes,buckets}] }. */
export function construirCobranza(carteraRows, calByCliente, rol, ejecutivo) {
  const filtra = (rol === 'EJECUTIVO') || (rol === 'JURIDICO');
  const miEjec = (rol === 'JURIDICO') ? 'JURIDICO' : ejecutivo;
  const hoy = new Date(); hoy.setHours(0,0,0,0);
  const porEjec = {};

  for (const row of carteraRows) {
    const nombre = row.nombre; if (!nombre) continue;
    const ejec = String(row.ejecutivo||'').trim() || '(sin ejecutivo)';
    if (filtra && norm(ejec) !== norm(miEjec)) continue;

    const pagos = (calByCliente[norm(nombre)]||[]).slice().sort((a,b)=>(a.n_pago||0)-(b.n_pago||0));
    let vencido=0, maxDias=0, proxFecha='', porVencer=0, pasoGracia=false, proxPend=null, diasProx=999;
    for (const p of pagos) {
      if (U(p.estatus).indexOf('PAGADO') >= 0) continue;
      const fecha = p.fecha ? new Date(p.fecha) : null;
      if (!proxPend && fecha) proxPend = p;
      if (!fecha) continue;
      const d = diasVencido(fecha, hoy);
      const fRaw = new Date(fecha); fRaw.setHours(0,0,0,0);
      const diasCrudos = Math.floor((hoy - fRaw)/86400000);
      if (d > 0) {
        const falta = Math.max(0, (Number(p.monto_impuntual)||Number(p.monto_puntual)||0) - (Number(p.pagado)||0));
        vencido += falta; pasoGracia = true; if (d > maxDias) maxDias = d;
      } else if (diasCrudos >= 1) {
        const falta = Math.max(0, (Number(p.monto_puntual)||0) - (Number(p.pagado)||0));
        vencido += falta; if (diasCrudos > maxDias) maxDias = diasCrudos;
      } else if (diasCrudos >= -3 && diasCrudos <= 0) {
        const falta = Math.max(0, (Number(p.monto_puntual)||0) - (Number(p.pagado)||0));
        porVencer += falta; if (diasCrudos < diasProx) diasProx = diasCrudos;
      }
    }
    if (vencido <= 0 && porVencer <= 0) continue;
    if (proxPend && proxPend.fecha) proxFecha = fdate(new Date(proxPend.fecha));
    const bucket = maxDias > 0 ? bucketDias(maxDias) : 'prox';

    if (!porEjec[ejec]) porEjec[ejec] = { ejecutivo:ejec, totalVencido:0, nClientes:0, clientes:[], buckets:{'prox':0,'7':0,'15':0,'30':0,'45':0,'45+':0} };
    porEjec[ejec].totalVencido += vencido + porVencer;
    porEjec[ejec].nClientes++;
    porEjec[ejec].buckets[bucket]++;
    porEjec[ejec].clientes.push({ nombre, vencido:Math.round(vencido), porVencer:Math.round(porVencer),
      dias: maxDias>0?maxDias:diasProx, bucket, proxPago:proxFecha, esPreventivo:(maxDias<=0&&porVencer>0), pasoGracia });
  }

  const ejecutivos = Object.keys(porEjec).map(k => {
    const e = porEjec[k]; e.totalVencido = Math.round(e.totalVencido);
    e.clientes.sort((a,b) => { const da=a.esPreventivo?a.dias-100:a.dias, db=b.esPreventivo?b.dias-100:b.dias; return da-db; });
    return e;
  }).sort((a,b) => b.totalVencido - a.totalVencido);

  let totalVencido=0, totalClientes=0, critico45=0;
  ejecutivos.forEach(e => { totalVencido+=e.totalVencido; totalClientes+=e.nClientes; e.clientes.forEach(cl=>{ if(cl.dias>45) critico45+=cl.vencido; }); });

  return { kpis:{ totalVencido, totalClientes, critico45:Math.round(critico45), nEjecutivos:ejecutivos.length }, ejecutivos };
}
