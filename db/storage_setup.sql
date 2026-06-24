-- ════════════════════════════════════════════════════════════════
-- STORAGE · MoneyCash CRM  (correr DESPUÉS de schema_fase1.sql)
-- Crea los buckets para respaldar documentos y sus permisos por rol.
-- Buckets: documentos (PDFs cotización/jurídico), evidencias (fotos de visitas).
-- ════════════════════════════════════════════════════════════════

-- Crear buckets (privados). Si ya existen, no hace nada.
insert into storage.buckets (id, name, public)
values ('documentos','documentos', false), ('evidencias','evidencias', false)
on conflict (id) do nothing;

-- Permisos: cualquier usuario autenticado (no anónimo) puede leer/subir.
-- (El control fino por rol se hace en la app; aquí cerramos a anónimos.)
drop policy if exists "mc_storage_select" on storage.objects;
drop policy if exists "mc_storage_insert" on storage.objects;
drop policy if exists "mc_storage_update" on storage.objects;
drop policy if exists "mc_storage_delete" on storage.objects;

create policy "mc_storage_select" on storage.objects for select to authenticated
  using (bucket_id in ('documentos','evidencias'));
create policy "mc_storage_insert" on storage.objects for insert to authenticated
  with check (bucket_id in ('documentos','evidencias'));
create policy "mc_storage_update" on storage.objects for update to authenticated
  using (bucket_id in ('documentos','evidencias'));
-- Borrar: solo admin/gerente/jurídico (vía función de rol).
create policy "mc_storage_delete" on storage.objects for delete to authenticated
  using (bucket_id in ('documentos','evidencias') and auth_rol() in ('ADMIN','GERENTE','JURIDICO'));

-- FIN storage_setup.sql
