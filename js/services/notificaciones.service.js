// Avisos de WhatsApp por etapa — mensajes idénticos a los eventos del Script.
// Números del equipo (formato +521XXXXXXXXXX). Completa CESAR/LORENA cuando los tengas.
export const WHATSAPP = {
  EDUARDO:'+5213326541986', HUGO:'+5213346498739', VANE:'+5218135085224',
  CESAR:'', LORENA:'', JORGE:'', TABATA:'',
};

const money = (n) => '$' + Number(n||0).toLocaleString('es-MX',{maximumFractionDigits:0});
export function telEjecutivo(ejecutivo) {
  const k = String(ejecutivo||'').toUpperCase().trim();
  for (const key in WHATSAPP) { if (k.indexOf(key)>=0 && WHATSAPP[key]) return WHATSAPP[key]; }
  return '';
}

/** Devuelve {para, tel, msg} para la etapa, o null si no hay aviso configurado. */
export function avisoPorEtapa(prospecto, etapa) {
  const nombre = String(prospecto.nombre||''), monto = money(prospecto.monto);
  const ejec = String(prospecto.ejecutivo||'');
  switch (etapa) {
    case 'Prospecto / Nuevo':
      return { para:'Vane', tel:WHATSAPP.VANE, msg:`📋 *Nuevo prospecto en Tubería*\n👤 ${nombre}\n💰 ${monto}\nEjecutivo: ${ejec}` };
    case 'Checklist':
      return { para:'Tabata', tel:WHATSAPP.TABATA, msg:`📋 *Checklist requerido*\n👤 ${nombre}\nDefine los documentos requeridos.` };
    case 'Documentos Recibidos / Revisión':
      return { para:'Revisión', tel:WHATSAPP.HUGO, msg:`📄 *Documentos recibidos*\n👤 ${nombre}\nListos para revisión.` };
    case 'Visita Domiciliaria':
      return { para:'Eduardo', tel:WHATSAPP.EDUARDO, msg:`🚗 *Nueva visita de verificación*\n👤 ${nombre}\n📍 ${prospecto.colonia||''}, ${prospecto.municipio||''}\n📞 ${prospecto.telefono||''}` };
    case 'Listo para Surtir':
      return { para:ejec||'Ejecutivo', tel:telEjecutivo(ejec)||WHATSAPP.VANE, msg:`✅ *Cliente listo para surtir*\n👤 ${nombre}\n💰 ${monto}\nYa quedó aprobado y listo para dispersión.` };
    case 'Surtidos':
      return { para:ejec||'Ejecutivo', tel:telEjecutivo(ejec), msg:`🎉 *Crédito surtido*\n👤 ${nombre}\n💰 ${monto}\nEnviado a cartera con su calendario.` };
    case 'Rechazado':
      return { para:ejec||'Ejecutivo', tel:telEjecutivo(ejec), msg:`❌ *Prospecto rechazado*\n👤 ${nombre}` };
    default:
      return null;
  }
}

/** Link wa.me para enviar el mensaje con un toque (click-to-send). */
export function linkWhatsApp(tel, msg) {
  const num = String(tel||'').replace(/[^\d]/g,'');
  if (!num) return '';
  return `https://wa.me/${num}?text=${encodeURIComponent(msg)}`;
}
