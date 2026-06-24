-- ════════════════════════════════════════════════════════════════
-- FASE 3 · MÓDULO COMPENSACIONES (comisiones a ejecutivos)
-- Meta = pctMeta% de la cartera base (congelada al inicio del mes).
-- Comisión por escalón de cumplimiento. Bono de apertura al llegar al 100%.
-- Correr DESPUÉS de schema_fase1.sql.
-- ════════════════════════════════════════════════════════════════

drop table if exists comp_bases  cascade;
drop table if exists comp_config cascade;

-- Configuración de escalones (una sola fila con el JSON).
create table comp_config (
  id     int primary key default 1,
  config jsonb not null,
  created_at timestamptz default now()
);
insert into comp_config (id, config) values (1, '{
  "pctMeta": 10,
  "escalones": [
    {"desde":0,   "hasta":79.99,  "pct":0,   "apertura":false},
    {"desde":80,  "hasta":84.99,  "pct":1,   "apertura":false},
    {"desde":85,  "hasta":94.99,  "pct":1.5, "apertura":false},
    {"desde":95,  "hasta":99.99,  "pct":2,   "apertura":false},
    {"desde":100, "hasta":109.99, "pct":2,   "apertura":true},
    {"desde":110, "hasta":99999,  "pct":2.5, "apertura":true, "crecimiento":5}
  ]
}'::jsonb)
on conflict (id) do nothing;

-- Bases: cartera congelada por ejecutivo / año / mes.
create table comp_bases (
  id           bigint generated always as identity primary key,
  ejecutivo    text not null,
  anio         int not null,
  mes          int not null,            -- 1-12
  cartera_base numeric(14,2) default 0,
  created_at   timestamptz default now(),
  unique (ejecutivo, anio, mes)
);
-- Precarga junio 2026 (cierre de mayo)
insert into comp_bases (ejecutivo, anio, mes, cartera_base) values
  ('HUGO',2026,6,1093323), ('CESAR',2026,6,1113983), ('EDUARDO',2026,6,762390), ('LORENA',2026,6,85250)
on conflict (ejecutivo, anio, mes) do nothing;

-- RLS: lectura a cualquier autenticado (el ejecutivo ve su propio medidor); escritura solo ADMIN.
alter table comp_config enable row level security;
alter table comp_bases  enable row level security;
create policy compcfg_sel on comp_config for select to authenticated using (true);
create policy compcfg_wr  on comp_config for all to authenticated using (auth_rol()='ADMIN') with check (auth_rol()='ADMIN');
create policy compbas_sel on comp_bases for select to authenticated using (true);
create policy compbas_wr  on comp_bases for all to authenticated using (auth_rol()='ADMIN') with check (auth_rol()='ADMIN');

-- FIN fase3_compensaciones.sql
