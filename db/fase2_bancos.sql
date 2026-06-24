-- ════════════════════════════════════════════════════════════════
-- FASE 2 · MÓDULO 1 — BANCOS  (correr DESPUÉS de schema_fase1.sql)
-- Libro mayor de movimientos por cuenta + RLS (ejecutivos SIN acceso).
-- ════════════════════════════════════════════════════════════════

-- ── MOVIMIENTOS: libro mayor de banco (ingresos/egresos por cuenta) ──
-- Sirve para Bancos (transferencias, entradas, salidas, reversos, cobranza)
-- y para Módulo 2 (gastos/nómina/intereses), distinguidos por `origen`.
drop table if exists movimientos cascade;
create table movimientos (
  id             bigint generated always as identity primary key,
  fecha          date default current_date,
  tipo           text,                      -- INGRESO / EGRESO
  banco_id       bigint references bancos(id) on delete set null,
  cuenta         text,                      -- nombre de la cuenta (redundante para lectura rápida)
  monto          numeric(14,2) default 0,
  concepto       text,
  subconcepto    text,                      -- empleado (nómina) / inversionista (intereses)
  origen         text,                      -- TRANSFERENCIA/INGRESO DIRECTO/SALIDA DIRECTA/COBRANZA/SURTIMIENTO/GASTOS FIJOS/GASTOS VARIOS/NOMINA/INTERESES/REVERSO
  obs            text,
  registrado_por text,
  reversado      boolean default false,     -- marca si ya fue reversado
  reversa_de     bigint,                    -- id del movimiento que reversa (si aplica)
  created_at     timestamptz default now()
);
create index idx_mov_fecha  on movimientos(fecha);
create index idx_mov_cuenta on movimientos(cuenta);
create index idx_mov_origen on movimientos(origen);

-- ── AUTORIZACIONES: agregar quién resolvió ──
alter table autorizaciones add column if not exists resuelto_por text;
alter table autorizaciones add column if not exists nota text;   -- datos para ejecutar (origen|destino|monto|concepto)

-- ════════════ RLS — BANCOS y MOVIMIENTOS (ejecutivos/jurídico/visitas SIN acceso) ════════════
alter table movimientos enable row level security;

-- BANCOS: leer = Admin/Gerente/Aux ; escribir = Admin/Aux
drop policy if exists bancos_sel on bancos;
drop policy if exists bancos_ins on bancos;
drop policy if exists bancos_upd on bancos;
create policy bancos_sel on bancos for select to authenticated using (auth_rol() in ('ADMIN','GERENTE','AUX_ADMIN'));
create policy bancos_ins on bancos for insert to authenticated with check (auth_rol() in ('ADMIN','AUX_ADMIN'));
create policy bancos_upd on bancos for update to authenticated using (auth_rol() in ('ADMIN','GERENTE','AUX_ADMIN')) with check (true);

-- MOVIMIENTOS: leer = Admin/Gerente/Aux ; escribir = Admin/Aux ; borrar (reverso) = Admin
create policy mov_sel on movimientos for select to authenticated using (auth_rol() in ('ADMIN','GERENTE','AUX_ADMIN'));
create policy mov_ins on movimientos for insert to authenticated with check (auth_rol() in ('ADMIN','AUX_ADMIN'));
create policy mov_upd on movimientos for update to authenticated using (auth_rol() in ('ADMIN','AUX_ADMIN')) with check (true);

-- AUTORIZACIONES: solicitar = Admin/Aux ; aprobar/rechazar (update) = Admin/Gerente
drop policy if exists autorizaciones_ins on autorizaciones;
drop policy if exists autorizaciones_upd on autorizaciones;
create policy autorizaciones_ins on autorizaciones for insert to authenticated with check (auth_rol() in ('ADMIN','AUX_ADMIN'));
create policy autorizaciones_upd on autorizaciones for update to authenticated using (auth_rol() in ('ADMIN','GERENTE')) with check (true);

-- FIN fase2_bancos.sql
