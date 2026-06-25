-- ════════════════════════════════════════════════════════════════
-- SEED DE DATOS DE PRUEBA · MoneyCash CRM v2
-- 5 clientes (semanal, quincenal, mensual, atrasado, liquidado).
-- Los usuarios/perfiles ya vienen en schema_fase1.sql (admin, gerente, ejecutivos, aux).
-- Correr DESPUÉS de schema_fase1.sql. Es seguro re-correrlo (borra antes los de prueba).
-- ════════════════════════════════════════════════════════════════

-- Limpia clientes de prueba previos (por nombre)
delete from cartera where nombre in ('JUAN SEMANAL','MARIA QUINCENAL','PEDRO MENSUAL','LUIS ATRASADO','ANA LIQUIDADA');

-- SEMANAL (JUAN SEMANAL)
insert into cartera (credito_id,nombre,ejecutivo,frecuencia,tipo_credito,capital,pg_cap,pg_int,pct_cap,pct_int,pagos,abono,impuntual,comision_apertura,saldo,saldo_capital,saldo_interes,tasa,surtimiento,vencimiento,estatus) values
  ('SEED-SEMANAL-1','JUAN SEMANAL','CESAR','SEMANAL','SIMPLE',10000,1000,200,0.8333,0.1667,10,1200,1300,0,12000,10000,2000,0,'2026-06-25','2026-07-05','ACTIVO');
insert into calendarios (cartera_id,id_credito,cliente,n_pago,fecha,monto_puntual,monto_impuntual,capital,interes,pagado,estatus) values
  ((select id from cartera where credito_id='SEED-SEMANAL-1'),'SEED-SEMANAL-1','JUAN SEMANAL',1,'2026-07-05',1200,1300,1000,200,0,'PENDIENTE'),
  ((select id from cartera where credito_id='SEED-SEMANAL-1'),'SEED-SEMANAL-1','JUAN SEMANAL',2,'2026-07-12',1200,1300,1000,200,0,'PENDIENTE'),
  ((select id from cartera where credito_id='SEED-SEMANAL-1'),'SEED-SEMANAL-1','JUAN SEMANAL',3,'2026-07-19',1200,1300,1000,200,0,'PENDIENTE'),
  ((select id from cartera where credito_id='SEED-SEMANAL-1'),'SEED-SEMANAL-1','JUAN SEMANAL',4,'2026-07-26',1200,1300,1000,200,0,'PENDIENTE'),
  ((select id from cartera where credito_id='SEED-SEMANAL-1'),'SEED-SEMANAL-1','JUAN SEMANAL',5,'2026-08-02',1200,1300,1000,200,0,'PENDIENTE'),
  ((select id from cartera where credito_id='SEED-SEMANAL-1'),'SEED-SEMANAL-1','JUAN SEMANAL',6,'2026-08-09',1200,1300,1000,200,0,'PENDIENTE'),
  ((select id from cartera where credito_id='SEED-SEMANAL-1'),'SEED-SEMANAL-1','JUAN SEMANAL',7,'2026-08-16',1200,1300,1000,200,0,'PENDIENTE'),
  ((select id from cartera where credito_id='SEED-SEMANAL-1'),'SEED-SEMANAL-1','JUAN SEMANAL',8,'2026-08-23',1200,1300,1000,200,0,'PENDIENTE'),
  ((select id from cartera where credito_id='SEED-SEMANAL-1'),'SEED-SEMANAL-1','JUAN SEMANAL',9,'2026-08-30',1200,1300,1000,200,0,'PENDIENTE'),
  ((select id from cartera where credito_id='SEED-SEMANAL-1'),'SEED-SEMANAL-1','JUAN SEMANAL',10,'2026-09-06',1200,1300,1000,200,0,'PENDIENTE');

-- QUINCENAL (MARIA QUINCENAL)
insert into cartera (credito_id,nombre,ejecutivo,frecuencia,tipo_credito,capital,pg_cap,pg_int,pct_cap,pct_int,pagos,abono,impuntual,comision_apertura,saldo,saldo_capital,saldo_interes,tasa,surtimiento,vencimiento,estatus) values
  ('SEED-QUINCENAL-2','MARIA QUINCENAL','LORENA','QUINCENAL','SIMPLE',12000,2000,300,0.8696,0.1304,6,2300,2500,0,13800,12000,1800,0,'2026-06-25','2026-07-15','ACTIVO');
insert into calendarios (cartera_id,id_credito,cliente,n_pago,fecha,monto_puntual,monto_impuntual,capital,interes,pagado,estatus) values
  ((select id from cartera where credito_id='SEED-QUINCENAL-2'),'SEED-QUINCENAL-2','MARIA QUINCENAL',1,'2026-07-15',2300,2500,2000,300,0,'PENDIENTE'),
  ((select id from cartera where credito_id='SEED-QUINCENAL-2'),'SEED-QUINCENAL-2','MARIA QUINCENAL',2,'2026-07-31',2300,2500,2000,300,0,'PENDIENTE'),
  ((select id from cartera where credito_id='SEED-QUINCENAL-2'),'SEED-QUINCENAL-2','MARIA QUINCENAL',3,'2026-08-15',2300,2500,2000,300,0,'PENDIENTE'),
  ((select id from cartera where credito_id='SEED-QUINCENAL-2'),'SEED-QUINCENAL-2','MARIA QUINCENAL',4,'2026-08-31',2300,2500,2000,300,0,'PENDIENTE'),
  ((select id from cartera where credito_id='SEED-QUINCENAL-2'),'SEED-QUINCENAL-2','MARIA QUINCENAL',5,'2026-09-15',2300,2500,2000,300,0,'PENDIENTE'),
  ((select id from cartera where credito_id='SEED-QUINCENAL-2'),'SEED-QUINCENAL-2','MARIA QUINCENAL',6,'2026-09-30',2300,2500,2000,300,0,'PENDIENTE');

-- MENSUAL (PEDRO MENSUAL)
insert into cartera (credito_id,nombre,ejecutivo,frecuencia,tipo_credito,capital,pg_cap,pg_int,pct_cap,pct_int,pagos,abono,impuntual,comision_apertura,saldo,saldo_capital,saldo_interes,tasa,surtimiento,vencimiento,estatus) values
  ('SEED-MENSUAL-3','PEDRO MENSUAL','CESAR','MENSUAL','SIMPLE',15000,3000,600,0.8333,0.1667,5,3600,3800,1000,18000,15000,3000,0,'2026-06-25','2026-07-25','ACTIVO');
insert into calendarios (cartera_id,id_credito,cliente,n_pago,fecha,monto_puntual,monto_impuntual,capital,interes,pagado,estatus) values
  ((select id from cartera where credito_id='SEED-MENSUAL-3'),'SEED-MENSUAL-3','PEDRO MENSUAL',1,'2026-07-25',3600,3800,3000,600,0,'PENDIENTE'),
  ((select id from cartera where credito_id='SEED-MENSUAL-3'),'SEED-MENSUAL-3','PEDRO MENSUAL',2,'2026-08-25',3600,3800,3000,600,0,'PENDIENTE'),
  ((select id from cartera where credito_id='SEED-MENSUAL-3'),'SEED-MENSUAL-3','PEDRO MENSUAL',3,'2026-09-25',3600,3800,3000,600,0,'PENDIENTE'),
  ((select id from cartera where credito_id='SEED-MENSUAL-3'),'SEED-MENSUAL-3','PEDRO MENSUAL',4,'2026-10-25',3600,3800,3000,600,0,'PENDIENTE'),
  ((select id from cartera where credito_id='SEED-MENSUAL-3'),'SEED-MENSUAL-3','PEDRO MENSUAL',5,'2026-11-25',3600,3800,3000,600,0,'PENDIENTE');

-- ATRASADO (LUIS ATRASADO)
insert into cartera (credito_id,nombre,ejecutivo,frecuencia,tipo_credito,capital,pg_cap,pg_int,pct_cap,pct_int,pagos,abono,impuntual,comision_apertura,saldo,saldo_capital,saldo_interes,tasa,surtimiento,vencimiento,estatus) values
  ('SEED-ATRASADO-4','LUIS ATRASADO','LORENA','SEMANAL','SIMPLE',8000,1000,100,0.9091,0.0909,8,1100,1250,0,8800,8000,800,0,'2026-06-25','2026-05-10','ACTIVO');
insert into calendarios (cartera_id,id_credito,cliente,n_pago,fecha,monto_puntual,monto_impuntual,capital,interes,pagado,estatus) values
  ((select id from cartera where credito_id='SEED-ATRASADO-4'),'SEED-ATRASADO-4','LUIS ATRASADO',1,'2026-05-10',1100,1250,1000,100,0,'PENDIENTE'),
  ((select id from cartera where credito_id='SEED-ATRASADO-4'),'SEED-ATRASADO-4','LUIS ATRASADO',2,'2026-05-17',1100,1250,1000,100,0,'PENDIENTE'),
  ((select id from cartera where credito_id='SEED-ATRASADO-4'),'SEED-ATRASADO-4','LUIS ATRASADO',3,'2026-05-24',1100,1250,1000,100,0,'PENDIENTE'),
  ((select id from cartera where credito_id='SEED-ATRASADO-4'),'SEED-ATRASADO-4','LUIS ATRASADO',4,'2026-05-31',1100,1250,1000,100,0,'PENDIENTE'),
  ((select id from cartera where credito_id='SEED-ATRASADO-4'),'SEED-ATRASADO-4','LUIS ATRASADO',5,'2026-06-07',1100,1250,1000,100,0,'PENDIENTE'),
  ((select id from cartera where credito_id='SEED-ATRASADO-4'),'SEED-ATRASADO-4','LUIS ATRASADO',6,'2026-06-14',1100,1250,1000,100,0,'PENDIENTE'),
  ((select id from cartera where credito_id='SEED-ATRASADO-4'),'SEED-ATRASADO-4','LUIS ATRASADO',7,'2026-06-21',1100,1250,1000,100,0,'PENDIENTE'),
  ((select id from cartera where credito_id='SEED-ATRASADO-4'),'SEED-ATRASADO-4','LUIS ATRASADO',8,'2026-06-28',1100,1250,1000,100,0,'PENDIENTE');

-- LIQUIDADO (ANA LIQUIDADA)
insert into cartera (credito_id,nombre,ejecutivo,frecuencia,tipo_credito,capital,pg_cap,pg_int,pct_cap,pct_int,pagos,abono,impuntual,comision_apertura,saldo,saldo_capital,saldo_interes,tasa,surtimiento,vencimiento,estatus) values
  ('SEED-LIQUIDADO-5','ANA LIQUIDADA','CESAR','MENSUAL','SIMPLE',9000,3000,300,0.9091,0.0909,3,3300,3500,0,0,0,0,0,'2026-06-25','2026-03-25','LIQUIDADO');
insert into calendarios (cartera_id,id_credito,cliente,n_pago,fecha,monto_puntual,monto_impuntual,capital,interes,pagado,estatus) values
  ((select id from cartera where credito_id='SEED-LIQUIDADO-5'),'SEED-LIQUIDADO-5','ANA LIQUIDADA',1,'2026-03-25',3300,3500,3000,300,3300,'PAGADO'),
  ((select id from cartera where credito_id='SEED-LIQUIDADO-5'),'SEED-LIQUIDADO-5','ANA LIQUIDADA',2,'2026-04-25',3300,3500,3000,300,3300,'PAGADO'),
  ((select id from cartera where credito_id='SEED-LIQUIDADO-5'),'SEED-LIQUIDADO-5','ANA LIQUIDADA',3,'2026-05-25',3300,3500,3000,300,3300,'PAGADO');

-- FIN seed_pruebas.sql
