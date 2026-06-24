-- ════════════════════════════════════════════════════════════════
-- FASE 2 · MÓDULO 3 — ACREEDORES (inversionistas)
-- Correr DESPUÉS de schema_fase1.sql y fase2_bancos.sql.
-- ACREEDORES: ID, NOMBRE, TIPO, MONTO_DEBO (capital invertido), PCT_INTERES,
--             FRECUENCIA, PROX_PAGO, SALDO (pendiente), NOTAS, ACTIVO.
-- ════════════════════════════════════════════════════════════════
drop table if exists acreedores cascade;
create table acreedores (
  id          bigint generated always as identity primary key,
  acreedor_id text unique,                   -- clave estable (= ID del Script)
  nombre      text not null,
  tipo        text,                           -- INVERSIONISTA / PROVEEDOR / OTRO
  monto_debo  numeric(14,2) default 0,        -- capital invertido / lo que se le debe original
  pct_interes numeric(8,4)  default 0,        -- interés pactado (%)
  frecuencia  text,                           -- MENSUAL / QUINCENAL / etc.
  prox_pago   date,
  saldo       numeric(14,2) default 0,        -- saldo pendiente actual
  notas       text,
  activo      boolean default true,
  created_at  timestamptz default now()
);
create index idx_acre_nombre on acreedores(nombre);

-- RLS: solo Admin/Aux (ejecutivos/gerente/jurídico/visitas SIN acceso de escritura;
-- gerente puede CONSULTAR como parte de su consulta financiera).
alter table acreedores enable row level security;
create policy acre_sel on acreedores for select to authenticated using (auth_rol() in ('ADMIN','GERENTE','AUX_ADMIN'));
create policy acre_ins on acreedores for insert to authenticated with check (auth_rol() in ('ADMIN','AUX_ADMIN'));
create policy acre_upd on acreedores for update to authenticated using (auth_rol() in ('ADMIN','AUX_ADMIN')) with check (true);

-- FIN fase2_acreedores.sql
