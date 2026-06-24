-- ════════════════════════════════════════════════════════════════
-- FASE 2B · MÓDULO JURÍDICO  (correr DESPUÉS de schema_fase1.sql)
-- Cartera jurídica + bitácora + convenios + pagos de convenio.
-- Abono jurídico 40% interés / 60% capital.
-- ════════════════════════════════════════════════════════════════

drop table if exists pagos_convenio        cascade;
drop table if exists convenios_juridico     cascade;
drop table if exists cartera_juridico_bitacora cascade;
drop table if exists cartera_juridico        cascade;

create table cartera_juridico (
  id             bigint generated always as identity primary key,
  cliente        text,
  ejecutivo      text,
  frecuencia     text,
  capital_orig   numeric(14,2) default 0,
  saldo_mc       numeric(14,2) default 0,   -- saldo congelado al entrar a jurídico
  cap_pagado     numeric(14,2) default 0,
  int_pagado     numeric(14,2) default 0,
  n_abonos       int default 0,
  saldo_demanda  numeric(14,2) default 0,   -- saldo pendiente vigente
  estatus        text default 'SIN PRESENTAR',
  prox_diligencia date,
  fecha_ingreso  date default current_date,
  notas          text,
  created_at     timestamptz default now()
);
create index idx_jur_cliente on cartera_juridico(cliente);
create index idx_jur_estatus on cartera_juridico(estatus);

create table cartera_juridico_bitacora (
  id         bigint generated always as identity primary key,
  cliente    text,
  autor      text,
  estatus    text,
  nota       text,
  created_at timestamptz default now()
);
create index idx_jurbit_cliente on cartera_juridico_bitacora(cliente);

create table convenios_juridico (
  id             bigint generated always as identity primary key,
  cliente        text,
  fecha          date default current_date,
  monto_acordado numeric(14,2) default 0,
  num_pagos      int default 0,
  autor          text,
  estatus        text default 'VIGENTE',   -- VIGENTE / REEMPLAZADO / CUMPLIDO
  created_at     timestamptz default now()
);
create index idx_conv_cliente on convenios_juridico(cliente);

create table pagos_convenio (
  id         bigint generated always as identity primary key,
  cliente    text,
  n_pago     int,
  fecha      date,
  monto      numeric(14,2) default 0,
  pagado     numeric(14,2) default 0,
  estatus    text default 'PENDIENTE',     -- PENDIENTE / PAGADO
  created_at timestamptz default now()
);
create index idx_pconv_cliente on pagos_convenio(cliente);

-- RLS: JURIDICO (Tabata) + ADMIN + GERENTE consultan; JURIDICO + ADMIN escriben. Ejecutivos NO.
do $$
declare t text;
begin
  foreach t in array array['cartera_juridico','cartera_juridico_bitacora','convenios_juridico','pagos_convenio'] loop
    execute format('alter table %I enable row level security', t);
    execute format($p$create policy %1$s_sel on %1$I for select to authenticated using (auth_rol() in ('ADMIN','GERENTE','JURIDICO'))$p$, t);
    execute format($p$create policy %1$s_ins on %1$I for insert to authenticated with check (auth_rol() in ('ADMIN','JURIDICO'))$p$, t);
    execute format($p$create policy %1$s_upd on %1$I for update to authenticated using (auth_rol() in ('ADMIN','JURIDICO')) with check (true)$p$, t);
  end loop;
end $$;

-- FIN fase2b_juridico.sql
