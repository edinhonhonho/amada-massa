\set ON_ERROR_STOP 1
-- Roda sobre um banco com 0001..0005 aplicadas (e vazio de clientes).
insert into auth.users (id,email,raw_app_meta_data) values
  ('00000000-0000-0000-0000-0000000000a5','adm5@x','{"perfil":"admin"}'),
  ('00000000-0000-0000-0000-0000000000e5','ent5@x','{}');
set role authenticated;
set request.uid = '00000000-0000-0000-0000-0000000000a5';

insert into clientes (id, nome, sobrenome) values
  ('51111111-1111-1111-1111-111111111111','Ana','A'), ('52222222-2222-2222-2222-222222222222','Beto','B'), ('53333333-3333-3333-3333-333333333333','Carla','C');
insert into rotas (id, nome, entregador_id) values ('5aaaaaaa-0000-0000-0000-000000000001','Rota X','00000000-0000-0000-0000-0000000000e5');
insert into atribuicoes_rota (cliente_id, rota_id, ordem) values ('51111111-1111-1111-1111-111111111111','5aaaaaaa-0000-0000-0000-000000000001',1),('52222222-2222-2222-2222-222222222222','5aaaaaaa-0000-0000-0000-000000000001',2);
insert into planos (id, nome, modalidade, paes_por_semana, valor_centavos) values
  ('5e000000-0000-0000-0000-000000000001','E1','entrega',1,8000), ('5e000000-0000-0000-0000-000000000002','E2','entrega',2,11000), ('5e000000-0000-0000-0000-000000000003','E3','entrega',3,15000);
insert into assinaturas (cliente_id, plano_id, valor_centavos, dia_vencimento, inicio) values
  ('51111111-1111-1111-1111-111111111111','5e000000-0000-0000-0000-000000000001',8000,10,'2026-01-01'),
  ('52222222-2222-2222-2222-222222222222','5e000000-0000-0000-0000-000000000002',11000,10,'2026-01-01'),
  ('53333333-3333-3333-3333-333333333333','5e000000-0000-0000-0000-000000000003',15000,10,'2026-01-01');

insert into semanas (id, inicio, fim) values ('5b000000-0000-0000-0000-000000000001','2026-11-16','2026-11-22');
insert into paes (id, nome, alergenos) values ('5c000000-0000-0000-0000-000000000001','Rústico','glúten'), ('5c000000-0000-0000-0000-000000000002','Sementes','glúten, gergelim');
insert into paes_semana (semana_id, pao_id, ordem) values ('5b000000-0000-0000-0000-000000000001','5c000000-0000-0000-0000-000000000001',0), ('5b000000-0000-0000-0000-000000000001','5c000000-0000-0000-0000-000000000002',1);
select 'resumo da semana', sabor, alergenos from semanas where id = '5b000000-0000-0000-0000-000000000001';

select 'entregas novas', preparar_semana('5b000000-0000-0000-0000-000000000001');
select 'segunda chamada não recria', preparar_semana('5b000000-0000-0000-0000-000000000001');

create temp table q as
  select c.nome, p.nome as pao, ep.quantidade from entrega_paes ep join entregas e on e.id = ep.entrega_id join clientes c on c.id = e.cliente_id join paes p on p.id = ep.pao_id order by 1, 2;
select * from q;
-- Ana (1 pão): 1 Rústico; Beto (2): 1+1; Carla (3): 2 Rústico + 1 Sementes
select 'divisão padrão correta', (select count(*) from q) = 5
  and exists (select 1 from q where nome='Carla' and pao='Rústico' and quantidade=2)
  and exists (select 1 from q where nome='Beto' and pao='Sementes' and quantidade=1);

-- equipe muda as quantidades da Ana: 3 Sementes
select set_config('t.ana', (select id::text from entregas where cliente_id = '51111111-1111-1111-1111-111111111111'), false);
delete from entrega_paes where entrega_id = current_setting('t.ana')::uuid;
insert into entrega_paes values (current_setting('t.ana')::uuid, '5c000000-0000-0000-0000-000000000002', 3);
update entregas set paes_manual = true where id = current_setting('t.ana')::uuid;
select sincronizar_quantidades('5b000000-0000-0000-0000-000000000001');
select 'Ana manual = 3 pães', qtd_prevista from entregas where id = current_setting('t.ana')::uuid;

-- novo pão na semana: o manual da Ana fica, os automáticos são refeitos
insert into paes (id, nome) values ('5c000000-0000-0000-0000-000000000003','Integral');
insert into paes_semana (semana_id, pao_id, ordem) values ('5b000000-0000-0000-0000-000000000001','5c000000-0000-0000-0000-000000000003',2);
select distribuir_paes('5b000000-0000-0000-0000-000000000001');
select 'Ana segue manual', pao_id::text like '5c%2', quantidade from entrega_paes where entrega_id = current_setting('t.ana')::uuid;
select 'Carla (3 pães, 3 sabores) = 1 de cada', count(*) from entrega_paes ep join entregas e on e.id = ep.entrega_id where e.cliente_id = '53333333-3333-3333-3333-333333333333' and ep.quantidade = 1;

select restaurar_distribuicao('5b000000-0000-0000-0000-000000000001');
select 'restaurado: Ana volta a 1 pão', qtd_prevista, paes_manual from entregas where id = current_setting('t.ana')::uuid;

-- renomear o pão no catálogo atualiza o resumo
update paes set nome = 'Rústico de centeio' where id = '5c000000-0000-0000-0000-000000000001';
select 'resumo após renomear', sabor from semanas where id = '5b000000-0000-0000-0000-000000000001';

-- o entregador vê os pães de cada parada
set request.uid = '00000000-0000-0000-0000-0000000000e5';
select nome, qtd, paes from entregas_da_rota('5b000000-0000-0000-0000-000000000001','5aaaaaaa-0000-0000-0000-000000000001') order by ordem;
-- lista fechada: nada muda
set request.uid = '00000000-0000-0000-0000-0000000000a5';
update semanas set lista_fechada = true where id = '5b000000-0000-0000-0000-000000000001';
select 'fechada: preparar não faz nada', preparar_semana('5b000000-0000-0000-0000-000000000001');
select 'ok5';
