-- ════════════════════════════════════════════════════════════════
-- MoneyCash CRM · Esquema Fase 1 (Supabase / Postgres)
-- Login·Roles · Clientes · Calendario · Pagos · Conciliación · Cobranza · Dashboard
-- Réplica funcional del CRM Apps Script. Relaciones + índices + FKs + RLS + seeds.
-- NOTA: Este es el esquema DESTINO limpio. Correrlo RESETEA la estructura;
--       los datos se recargan al final (carga final planeada). Tu app actual
--       sigue viva hasta que decidas correr esto.
-- ════════════════════════════════════════════════════════════════

-- ───────────── LIMPIEZA (orden por dependencias) ─────────────
drop table if exists comentarios_cobranza cascade;
drop table if exists desglose            cascade;
drop table if exists pagos_pendientes    cascade;
drop table if exists solicitudes_multa   cascade;
drop table if exists calendarios         cascade;
drop table if exists movimientos         cascade;
drop table if exists autorizaciones      cascade;
drop table if exists auditoria           cascade;
drop table if exists accesos             cascade;
drop table if exists perfiles            cascade;
drop table if exists cartera             cascade;
drop table if exists bancos              cascade;
drop table if exists perfiles            cascade;

-- ═════════════════ 1. PERFILES (roles) ═════════════════
-- Liga con Supabase Auth por email. Rol y ejecutivo definen accesos.
create table perfiles (
  id         uuid primary key default gen_random_uuid(),
  email      text unique not null,
  nombre     text,
  rol        text not null default 'EJECUTIVO'
             check (rol in ('ADMIN','GERENTE','EJECUTIVO','AUX_ADMIN','JURIDICO','VISITAS')),
  ejecutivo  text,                 -- nombre del ejecutivo (para filtrar su cartera)
  activo     boolean not null default true,
  created_at timestamptz default now()
);
create index ix_perfiles_email on perfiles(email);

-- ═════════════════ 2. BANCOS ═════════════════
create table bancos (
  id            bigint generated always as identity primary key,
  cuenta        text not null unique,
  saldo_inicial numeric(14,2) default 0,
  ingresos      numeric(14,2) default 0,
  egresos       numeric(14,2) default 0,
  saldo_sistema numeric(14,2) default 0,
  activo        boolean default true
);

-- ═════════════════ 3. CARTERA (créditos activos) ═════════════════
-- Spine del cliente activo. Un renglón por crédito activo (como en el Script).
create table cartera (
  id            bigint generated always as identity primary key,
  credito_id    text unique,                 -- clave de crédito (= ID_CREDITO del Script)
  nombre        text not null,
  ejecutivo     text,
  frecuencia    text,                         -- SEMANAL/QUINCENAL/MENSUAL/AMERICANO
  tipo_credito  text default 'SIMPLE'         -- SIMPLE / AMERICANO
                check (tipo_credito in ('SIMPLE','AMERICANO','LINEA')),
  capital       numeric(14,2) default 0,      -- capital original colocado
  saldo         numeric(14,2) default 0,      -- saldo total que debe hoy
  saldo_capital numeric(14,2) default 0,
  saldo_interes numeric(14,2) default 0,
  tasa          numeric(8,4)  default 0,
  pct_cap       numeric(8,4)  default 0,      -- % capital por pago (reparto) — col I del Script
  pct_int       numeric(8,4)  default 0,      -- % interés por pago (reparto) — col H del Script
  pg_cap        numeric(14,2) default 0,      -- capital por pago (capital/plazo)
  pg_int        numeric(14,2) default 0,      -- interés del periodo (fallback para pago mínimo)
  pagos         int           default 0,      -- plazo (número de pagos)
  abono         numeric(14,2) default 0,      -- abono por periodo (puntual)
  impuntual     numeric(14,2) default 0,      -- abono impuntual (con recargo)
  comision_apertura numeric(14,2) default 0,
  surtimiento   date,
  vencimiento   date,
  estatus       text default 'ACTIVO'         -- ACTIVO / LIQUIDADO / JURIDICO
                check (estatus in ('ACTIVO','LIQUIDADO','JURIDICO')),
  created_at    timestamptz default now()
);
create index ix_cartera_nombre    on cartera(lower(nombre));
create index ix_cartera_ejecutivo on cartera(ejecutivo);
create index ix_cartera_estatus   on cartera(estatus);

-- ═════════════════ 4. CALENDARIOS (calendario de pagos) ═════════════════
create table calendarios (
  id              bigint generated always as identity primary key,
  cartera_id      bigint references cartera(id) on delete cascade,
  id_credito      text,
  cliente         text,
  n_pago          int,
  fecha           date,
  monto_puntual   numeric(14,2) default 0,
  monto_impuntual numeric(14,2) default 0,
  capital         numeric(14,2) default 0,
  interes         numeric(14,2) default 0,
  multa           numeric(14,2) default 0,
  pagado          numeric(14,2) default 0,
  estatus         text default 'PENDIENTE',   -- PENDIENTE / PAGADO / PAGADO (MÍNIMO) / PENDIENTE (EXT MÍNIMO)
  created_at      timestamptz default now()
);
create index ix_cal_cartera on calendarios(cartera_id);
create index ix_cal_fecha   on calendarios(fecha);
create index ix_cal_estatus on calendarios(estatus);
create index ix_cal_cliente on calendarios(lower(cliente));

-- ═════════════════ 5. DESGLOSE (pagos aplicados / reparto) ═════════════════
create table desglose (
  id          bigint generated always as identity primary key,
  cartera_id  bigint references cartera(id) on delete set null,
  banco_id    bigint references bancos(id)  on delete set null,
  fecha       date,
  cliente     text,
  ejecutivo   text,
  pago        numeric(14,2) default 0,
  capital     numeric(14,2) default 0,
  interes     numeric(14,2) default 0,
  multa       numeric(14,2) default 0,
  tipo        text,                            -- NORMAL/MINIMO/PARCIAL/LIQUIDACION/AMERICANO/ABONO
  forma_pago  text,                            -- DEPOSITO/TRANSFERENCIA/EFECTIVO
  created_at  timestamptz default now()
);
create index ix_desg_cartera on desglose(cartera_id);
create index ix_desg_fecha   on desglose(fecha);

-- ═════════════════ 6. PAGOS_PENDIENTES (conciliación) ═════════════════
create table pagos_pendientes (
  id           bigint generated always as identity primary key,
  cartera_id   bigint references cartera(id) on delete cascade,
  banco_id     bigint references bancos(id)  on delete set null,
  cuenta       text,
  cliente      text,
  ejecutivo    text,
  fecha        date,
  monto        numeric(14,2) default 0,
  n_pago       int,                            -- pago del calendario al que aplica
  capital      numeric(14,2) default 0,        -- reparto calculado al registrar
  interes      numeric(14,2) default 0,
  multa        numeric(14,2) default 0,
  tipo         text,                           -- NORMAL/MINIMO/PARCIAL/LIQUIDAR
  forma_pago   text,                           -- DEPOSITO/TRANSFERENCIA/EFECTIVO
  excedente_a  text default 'SIGUIENTE',       -- SIGUIENTE / ULTIMO
  estatus      text default 'PENDIENTE'        -- PENDIENTE/APLICADO/RECHAZADO
               check (estatus in ('PENDIENTE','APLICADO','RECHAZADO')),
  capturado_por text,
  conciliado_por text,
  created_at   timestamptz default now()
);
create index ix_pp_estatus on pagos_pendientes(estatus);
create index ix_pp_cartera on pagos_pendientes(cartera_id);

-- ═════════════════ 7. COMENTARIOS_COBRANZA (gestión) ═════════════════
create table comentarios_cobranza (
  id          bigint generated always as identity primary key,
  cartera_id  bigint references cartera(id) on delete cascade,
  cliente     text,
  autor       text,
  rol         text,
  estado      text,                            -- SEGUIMIENTO/PROMESA/SIN CONTACTO/...
  comentario  text,
  fecha       date default current_date,
  created_at  timestamptz default now()
);
create index ix_com_cartera on comentarios_cobranza(cartera_id);

-- ═════════════════ 8. SOLICITUDES_MULTA (quitar multa → autoriza Hugo) ═════════════════
create table solicitudes_multa (
  id          bigint generated always as identity primary key,
  cartera_id  bigint references cartera(id) on delete cascade,
  cliente     text,
  ejecutivo   text,
  monto_multa numeric(14,2) default 0,
  motivo      text,
  estatus     text default 'PENDIENTE'
              check (estatus in ('PENDIENTE','APROBADO','RECHAZADO')),
  fecha       date default current_date,
  created_at  timestamptz default now()
);

-- ═════════════════ 9. MOVIMIENTOS (entradas/salidas de banco) ═════════════════
create table movimientos (
  id          bigint generated always as identity primary key,
  banco_id    bigint references bancos(id) on delete set null,
  fecha       date,
  tipo        text,                            -- INGRESO/EGRESO
  concepto    text,
  subconcepto text,
  monto       numeric(14,2) default 0,
  descripcion text,
  created_at  timestamptz default now()
);
create index ix_mov_fecha on movimientos(fecha);
create index ix_mov_banco on movimientos(banco_id);

-- ═════════════════ 10. AUTORIZACIONES (reversos, transferencias, descuentos) ═════════════════
create table autorizaciones (
  id          bigint generated always as identity primary key,
  tipo        text,                            -- REVERSO/TRANSFERENCIA/DESCUENTO
  referencia  text,
  solicita    text,
  detalle     text,
  estatus     text default 'PENDIENTE'
              check (estatus in ('PENDIENTE','APROBADO','RECHAZADO')),
  fecha       date default current_date,
  created_at  timestamptz default now()
);

-- ═════════════════ 11. ACCESOS (bitácora de login) ═════════════════
create table accesos (
  id         bigint generated always as identity primary key,
  fecha      timestamptz default now(),
  usuario    text,
  resultado  text,                             -- OK / FALLO
  detalle    text
);

-- ════════════════════════════════════════════════════════════════
-- FUNCIONES DE ROL (para RLS por ejecutivo, a nivel base de datos)
-- ════════════════════════════════════════════════════════════════
-- ───────────── AUDITORÍA (bitácora de acciones críticas) ─────────────
create table auditoria (
  id        bigint generated always as identity primary key,
  fecha     timestamptz default now(),
  usuario   text,
  rol       text,
  accion    text,    -- ALTA_CLIENTE / PAGO_REGISTRADO / CONCILIACION_APLICADA / CONCILIACION_RECHAZADA / CAMBIO_SALDO
  entidad   text,    -- cliente / crédito / id de pago
  detalle   text
);
create index idx_audit_fecha on auditoria(fecha);

create or replace function auth_rol() returns text
  language sql security definer stable as $$
  select coalesce((select rol from perfiles where email = auth.jwt()->>'email' and activo limit 1),'ADMIN')
$$;
create or replace function auth_ejecutivo() returns text
  language sql security definer stable as $$
  select (select ejecutivo from perfiles where email = auth.jwt()->>'email' and activo limit 1)
$$;

-- ════════════════════════════════════════════════════════════════
-- RLS (Row Level Security)
-- Lectura: autenticados. El EJECUTIVO solo ve SU cartera (a nivel DB).
-- Escritura: autenticados (el front limita por rol; reglas finas por módulo).
-- ════════════════════════════════════════════════════════════════
alter table perfiles             enable row level security;
alter table bancos               enable row level security;
alter table cartera              enable row level security;
alter table calendarios          enable row level security;
alter table desglose             enable row level security;
alter table pagos_pendientes     enable row level security;
alter table comentarios_cobranza enable row level security;
alter table solicitudes_multa    enable row level security;
alter table movimientos          enable row level security;
alter table autorizaciones       enable row level security;
alter table accesos              enable row level security;

-- Perfiles: cada quien lee; admin/gerente escriben (se valida también en front)
create policy perf_sel on perfiles for select to authenticated using (true);
create policy perf_ins on perfiles for insert to authenticated with check (auth_rol() in ('ADMIN','GERENTE'));
create policy perf_upd on perfiles for update to authenticated using (auth_rol() in ('ADMIN','GERENTE')) with check (true);

-- Cartera: EJECUTIVO solo ve la suya
create policy cart_sel on cartera for select to authenticated using (
  auth_rol() <> 'EJECUTIVO' or ejecutivo = auth_ejecutivo()
);
create policy cart_ins on cartera for insert to authenticated with check (true);
create policy cart_upd on cartera for update to authenticated using (true) with check (true);

-- Calendarios: EJECUTIVO solo los de su cartera
create policy cal_sel on calendarios for select to authenticated using (
  auth_rol() <> 'EJECUTIVO'
  or cartera_id in (select id from cartera where ejecutivo = auth_ejecutivo())
);
create policy cal_ins on calendarios for insert to authenticated with check (true);
create policy cal_upd on calendarios for update to authenticated using (true) with check (true);

-- Tablas operativas: lectura autenticada + escritura autenticada
do $$
declare t text;
begin
  foreach t in array array['desglose','pagos_pendientes','comentarios_cobranza','solicitudes_multa','movimientos','autorizaciones','bancos','accesos']
  loop
    execute format('create policy %1$s_sel on %1$s for select to authenticated using (true);', t);
    execute format('create policy %1$s_ins on %1$s for insert to authenticated with check (true);', t);
    execute format('create policy %1$s_upd on %1$s for update to authenticated using (true) with check (true);', t);
  end loop;
end $$;
-- Desglose: permitir borrar (reverso de abono)
create policy desglose_del on desglose for delete to authenticated using (true);

-- ════════════════════════════════════════════════════════════════
-- SEEDS (roles del equipo MoneyCash)
-- Auditoría: cualquiera autenticado puede escribir; solo admin/gerente leer.
alter table auditoria enable row level security;
create policy aud_ins on auditoria for insert to authenticated with check (true);
create policy aud_sel on auditoria for select to authenticated using (auth_rol() in ('ADMIN','GERENTE'));

-- Sustituye los correos por los reales al crear los usuarios en Auth.
-- Jorge sin perfil = ADMIN por defecto (fallback en el front).
-- ════════════════════════════════════════════════════════════════
insert into perfiles (email, nombre, rol, ejecutivo) values
  ('jorge@moneycash.mx',  'Jorge',  'ADMIN',     null),
  ('hugo@moneycash.mx',   'Hugo',   'GERENTE',   null),
  ('cesar@moneycash.mx',  'César',  'EJECUTIVO', 'CESAR'),
  ('lorena@moneycash.mx', 'Lorena', 'EJECUTIVO', 'LORENA'),
  ('vane@moneycash.mx',   'Vane',   'AUX_ADMIN', null),
  ('tabata@moneycash.mx', 'Tabata', 'JURIDICO',  null),
  ('eduardo@moneycash.mx','Eduardo','VISITAS',   null)
on conflict (email) do nothing;

-- ───────────── BANCOS de arranque (para poder cobrar/conciliar en pruebas) ─────────────
-- Sustitúyelos por tus cuentas reales cuando hagas la carga final.
insert into bancos (cuenta, saldo_inicial, saldo_sistema, activo) values
  ('BBVA PRINCIPAL', 0, 0, true),
  ('BANORTE',        0, 0, true),
  ('EFECTIVO',       0, 0, true)
on conflict (cuenta) do nothing;

-- FIN schema_fase1.sql
