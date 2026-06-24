-- ════════════════════════════════════════════════════════════════
-- FASE 3 · MÓDULO CUENTAS POR PAGAR (CxP)  — proveedores/obligaciones
-- CxC (por cobrar) se deriva de la cartera, no necesita tabla.
-- Correr DESPUÉS de schema_fase1.sql y fase2_bancos.sql.
-- ════════════════════════════════════════════════════════════════
drop table if exists cxp cascade;
create table cxp (
  id            bigint generated always as identity primary key,
  concepto      text not null,
  proveedor     text,
  monto         numeric(14,2) default 0,
  fecha         date default current_date,    -- fecha de registro
  vencimiento   date,
  estatus       text default 'PENDIENTE',     -- PENDIENTE / PAGADO
  pagado_fecha  date,
  banco         text,                          -- banco con el que se pagó
  notas         text,
  registrado_por text,
  created_at    timestamptz default now()
);
create index idx_cxp_estatus on cxp(estatus);
create index idx_cxp_venc on cxp(vencimiento);

-- RLS: leer admin/gerente/aux; escribir admin/aux. Ejecutivos/jurídico/visitas NO.
alter table cxp enable row level security;
create policy cxp_sel on cxp for select to authenticated using (auth_rol() in ('ADMIN','GERENTE','AUX_ADMIN'));
create policy cxp_ins on cxp for insert to authenticated with check (auth_rol() in ('ADMIN','AUX_ADMIN'));
create policy cxp_upd on cxp for update to authenticated using (auth_rol() in ('ADMIN','AUX_ADMIN')) with check (true);

-- FIN fase3_cxp.sql
