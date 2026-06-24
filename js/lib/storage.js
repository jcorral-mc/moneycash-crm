// Helper de archivos sobre Supabase Storage. Buckets: 'documentos', 'evidencias'.
import { db } from './supabase.js';

const limpia = s => String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9._-]+/g,'_').slice(0,80);

/** Genera una ruta segura: carpeta/aaaammdd_hhmmss_archivo.ext */
export function rutaArchivo(carpeta, nombre) {
  const f = new Date();
  const ts = f.toISOString().slice(0,19).replace(/[-:T]/g,'');
  return `${limpia(carpeta)}/${ts}_${limpia(nombre)}`;
}

/** Sube un File/Blob. Devuelve { bucket, path }. */
export async function subirArchivo(bucket, path, file) {
  const { error } = await db.storage.from(bucket).upload(path, file, { upsert:false, cacheControl:'3600' });
  if (error) throw error;
  return { bucket, path };
}

/** URL temporal firmada (los buckets son privados). segundos por defecto 1 hora. */
export async function urlFirmada(bucket, path, segundos=3600) {
  const { data, error } = await db.storage.from(bucket).createSignedUrl(path, segundos);
  if (error) throw error;
  return data.signedUrl;
}

/** Lista archivos bajo un prefijo (carpeta). */
export async function listarArchivos(bucket, prefijo='') {
  const { data, error } = await db.storage.from(bucket).list(prefijo, { limit:100, sortBy:{ column:'created_at', order:'desc' } });
  if (error) throw error;
  return data || [];
}

/** Borra un archivo. */
export async function borrarArchivo(bucket, path) {
  const { error } = await db.storage.from(bucket).remove([path]);
  if (error) throw error;
  return { ok:true };
}

/** Sube varias imágenes (evidencias) a una carpeta y devuelve sus rutas. */
export async function subirEvidencias(carpeta, files) {
  const out = [];
  for (const file of (files||[])) {
    const path = rutaArchivo(carpeta, file.name||'foto.jpg');
    await subirArchivo('evidencias', path, file);
    out.push(path);
  }
  return out;
}
