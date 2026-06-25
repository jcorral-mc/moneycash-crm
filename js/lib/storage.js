// Subida de evidencias a Supabase Storage (bucket "evidencias") con resize + compresión.
import { db } from './supabase.js';
const BUCKET = 'evidencias';

/** Redimensiona a máx 1024px y comprime a JPEG 0.7 (réplica del Script). */
function resize(file) {
  return new Promise((res, rej) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const MAX = 1024; let w = img.width, h = img.height;
        if (w > MAX || h > MAX) { if (w > h) { h = Math.round(h*(MAX/w)); w = MAX; } else { w = Math.round(w*(MAX/h)); h = MAX; } }
        const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
        cv.getContext('2d').drawImage(img, 0, 0, w, h);
        cv.toBlob(b => b ? res(b) : rej(new Error('No se pudo procesar la imagen')), 'image/jpeg', 0.7);
      };
      img.onerror = () => rej(new Error('Imagen inválida'));
      img.src = reader.result;
    };
    reader.onerror = () => rej(new Error('No se pudo leer el archivo'));
    reader.readAsDataURL(file);
  });
}

/** Sube una foto y devuelve su URL pública. */
export async function subirFoto(file, carpeta) {
  const blob = await resize(file);
  const path = `${carpeta||'visitas'}/${Date.now()}_${Math.random().toString(36).slice(2,8)}.jpg`;
  const { error } = await db.storage.from(BUCKET).upload(path, blob, { contentType:'image/jpeg', upsert:false });
  if (error) throw error;
  const { data } = db.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

/** Sube varias fotos (ignora nulos/errores). Devuelve array de URLs. */
export async function subirFotos(files, carpeta) {
  const out = [];
  for (const f of (files||[])) { if (!f) continue; try { out.push(await subirFoto(f, carpeta)); } catch(e){ /* omitir la que falle */ } }
  return out;
}
