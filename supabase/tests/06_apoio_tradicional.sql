\set ON_ERROR_STOP 1
-- Roda sobre um banco com 0001..0006 aplicadas (o `rodar.sh` cuida da ordem).
insert into auth.users (id,email,raw_app_meta_data) values ('00000000-0000-0000-0000-0000000000a6','adm6@x','{"perfil":"admin"}');
set role authenticated;
set request.uid = '00000000-0000-0000-0000-0000000000a6';

insert into clientes (id, nome) values ('61111111-1111-1111-1111-111111111111','Ana'), ('62222222-2222-2222-2222-222222222222','Beto'), ('63333333-3333-3333-3333-333333333333','Apoia');
insert into planos (id, nome, modalidade, paes_por_semana, valor_centavos) values
  ('6e000000-0000-0000-0000-000000000001','Entrega 2','entrega',2,11000),
  ('6e000000-0000-0000-0000-000000000002','Entrega 3','entrega',3,15000),
  ('6e000000-0000-0000-0000-000000000003','Apoio','apoio',0,5000);
insert into assinaturas (cliente_id, plano_id, valor_centavos, dia_vencimento, inicio, paes_tradicionais) values
  ('61111111-1111-1111-1111-111111111111','6e000000-0000-0000-0000-000000000001',11000,10,'2026-01-01',1),   -- 2 pães: 1 tradicional + 1 da semana
  ('62222222-2222-2222-2222-222222222222','6e000000-0000-0000-0000-000000000002',15000,10,'2026-01-01',0),   -- 3 pães, nenhum tradicional
  ('63333333-3333-3333-3333-333333333333','6e000000-0000-0000-0000-000000000003',5000,10,'2026-01-01',0);    -- apoio: sem pão

insert into paes (id, nome, tradicional) values ('6c000000-0000-0000-0000-000000000001','Tradicional',true), ('6c000000-0000-0000-0000-000000000002','Sementes',false), ('6c000000-0000-0000-0000-000000000003','Integral',false);
insert into semanas (id, inicio, fim) values ('6b000000-0000-0000-0000-000000000001','2026-11-23','2026-11-29');
insert into paes_semana (semana_id, pao_id, ordem) values
  ('6b000000-0000-0000-0000-000000000001','6c000000-0000-0000-0000-000000000001',0),
  ('6b000000-0000-0000-0000-000000000001','6c000000-0000-0000-0000-000000000002',1),
  ('6b000000-0000-0000-0000-000000000001','6c000000-0000-0000-0000-000000000003',2);

select 'entregas geradas (apoio fora)', preparar_semana('6b000000-0000-0000-0000-000000000001');
create temp table q as select c.nome, p.nome as pao, ep.quantidade from entrega_paes ep join entregas e on e.id = ep.entrega_id join clientes c on c.id = e.cliente_id join paes p on p.id = ep.pao_id order by 1, 2;
select * from q;
select 'Ana: 1 tradicional + 1 da semana', exists (select 1 from q where nome='Ana' and pao='Tradicional' and quantidade=1) and exists (select 1 from q where nome='Ana' and pao='Sementes' and quantidade=1) and (select count(*) from q where nome='Ana') = 2;
select 'Beto: 3 pães em rodízio entre os 2 da semana (2+1), sem tradicional', (select sum(quantidade) from q where nome='Beto') = 3 and not exists (select 1 from q where nome='Beto' and pao='Tradicional');
select 'apoio nunca entra', not exists (select 1 from entregas where cliente_id = '63333333-3333-3333-3333-333333333333');

-- semana só com o tradicional: tudo vai nele
delete from paes_semana where semana_id = '6b000000-0000-0000-0000-000000000001' and pao_id <> '6c000000-0000-0000-0000-000000000001';
select distribuir_paes('6b000000-0000-0000-0000-000000000001');
select 'só tradicional: Beto recebe os 3 nele', (select quantidade from entrega_paes ep join entregas e on e.id = ep.entrega_id where e.cliente_id = '62222222-2222-2222-2222-222222222222') = 3;
-- apoio não aceita ponto de coleta
select set_config('t.padaria', (select id::text from pontos_coleta where tipo = 'padaria' limit 1), false);
insert into clientes (id, nome) values ('64444444-4444-4444-4444-444444444444','Apoia2');
insert into assinaturas (cliente_id, plano_id, valor_centavos, dia_vencimento, ponto_coleta_id) values ('64444444-4444-4444-4444-444444444444','6e000000-0000-0000-0000-000000000003',5000,10,current_setting('t.padaria')::uuid);
select 'apoio descarta o ponto', ponto_coleta_id is null from assinaturas where cliente_id = '64444444-4444-4444-4444-444444444444';
select 'ok6';
