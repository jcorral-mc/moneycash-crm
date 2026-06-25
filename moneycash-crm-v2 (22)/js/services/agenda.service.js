// Lógica de Agenda — calcula días restantes y próximos 3 días.
export const AGENDA_TIPOS = ['DILIGENCIA','CD JUDICIAL','VISITA','RECORDATORIO','MANUAL'];

export function construirAgenda(eventos) {
  const hoy = new Date(); hoy.setHours(0,0,0,0);
  const lista = (eventos||[]).map(e=>{
    const f = new Date(String(e.fecha)+'T12:00:00'); f.setHours(0,0,0,0);
    const dias = Math.round((f-hoy)/86400000);
    return { id:e.id, titulo:e.titulo||'', tipo:String(e.tipo||'MANUAL'), fecha:String(e.fecha||'').slice(0,10),
      notas:e.notas||'', cliente:e.cliente||'', completado:!!e.completado, dias };
  });
  const proximos3 = lista.filter(e=>!e.completado && e.dias>=0 && e.dias<=3).sort((a,b)=>a.dias-b.dias);
  return { eventos:lista, proximos3 };
}
