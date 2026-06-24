-- ════════════════════════════════════════════════════════════════
-- FASE 2B · MÓDULO VISITAS  (correr DESPUÉS de schema_fase1.sql)
-- Réplica de la hoja VISITAS del Script. Tipos: VERIFICACION/COBRANZA/JURIDICO/MENSAJERIA.
-- ════════════════════════════════════════════════════════════════
drop table if exists visitas cascade;
create table visitas (
  id           bigint generated always as identity primary key,
  fecha        date,
  tipo         text,                 -- VERIFICACION / COBRANZA / JURIDICO / MENSAJERIA
  cliente      text,
  ref_id       text,
  telefono     text,
  direccion    text,
  referencias  text,                 -- ubicación / referencias
  horarios     text,                 -- '08:00-09:00' o 'Horario abierto'
  aval         text,
  asigna       text,                 -- quién la asignó
  estatus      text default 'PENDIENTE',   -- PENDIENTE / REALIZADA
  resultado    text,
  hora_visita  text,
  comentarios  text,
  resuelve     text,                 -- quién la resolvió
  created_at   timestamptz default now()
);
create index idx_vis_estatus on visitas(estatus);
create index idx_vis_tipo    on visitas(tipo);
create index idx_vis_cliente on visitas(cliente);

-- RLS: VISITAS (Eduardo) + ADMIN + GERENTE + AUX_ADMIN + JURIDICO ven/operan. Ejecutivos NO.
alter table visitas enable row level security;
create policy vis_sel on visitas for select to authenticated
  using (auth_rol() in ('ADMIN','GERENTE','AUX_ADMIN','JURIDICO','VISITAS'));
-- Asignar (insert): admin/gerente/aux (cobranza/mensajería) y jurídico/admin (jurídico)
create policy vis_ins on visitas for insert to authenticated
  with check (auth_rol() in ('ADMIN','GERENTE','AUX_ADMIN','JURIDICO'));
-- Resolver (update): el verificador (VISITAS), admin, gerente, jurídico
create policy vis_upd on visitas for update to authenticated
  using (auth_rol() in ('ADMIN','GERENTE','JURIDICO','VISITAS')) with check (true);

-- FIN fase2b_visitas.sql
