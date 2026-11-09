\set ON_ERROR_STOP 1
insert into auth.users (id,email,raw_app_meta_data) values ('00000000-0000-0000-0000-0000000000a9','adm9@x','{"perfil":"admin"}');
set role authenticated;
set request.uid = '00000000-0000-0000-0000-0000000000a9';

insert into rotas (id, nome, bairros) values
  ('9a000000-0000-0000-0000-000000000001','Rota Centro', array['Centro Histórico','Bom Fim']),
  ('9a000000-0000-0000-0000-000000000002','Rota Sul', array['Tristeza']);
insert into clientes (id, nome, bairro) values
  ('91111111-1111-1111-1111-111111111111','Ana','centro historico'),   -- acento e caixa diferentes
  ('92222222-2222-2222-2222-222222222222','Beto','Tristeza'),
  ('93333333-3333-3333-3333-333333333333','Caio','Lugar Nenhum'),
  ('94444444-4444-4444-4444-444444444444','Dani','Bom Fim');
insert into planos (id, nome, modalidade, paes_por_semana, valor_centavos) values ('9e000000-0000-0000-0000-000000000001','Entrega 4','entrega',4,20000);
insert into assinaturas (cliente_id, plano_id, valor_centavos, dia_vencimento, inicio, paes_tradicionais)
select id, '9e000000-0000-0000-0000-000000000001', 20000, 10, '2026-01-01', case when nome = 'Dani' then 1 else 0 end from clientes where nome in ('Ana','Beto','Caio','Dani');

select 'rota por bairro, sem acento nem caixa', rota_do_cliente('91111111-1111-1111-1111-111111111111') = '9a000000-0000-0000-0000-000000000001';
select 'bairro sem rota fica sem rota', rota_do_cliente('93333333-3333-3333-3333-333333333333') is null;

insert into paes (id, nome, tradicional) values ('9c000000-0000-0000-0000-000000000001','Tradicional 9',true), ('9c000000-0000-0000-0000-000000000002','Sementes 9',false);
insert into semanas (id, inicio, fim) values ('9b000000-0000-0000-0000-000000000001','2027-03-01','2027-03-07');
-- semana sem pães: nenhum pão entra sozinho
select 'tradicional não entra sozinho', (select count(*) from paes_semana where semana_id = '9b000000-0000-0000-0000-000000000001') = 0;
insert into paes_semana (semana_id, pao_id, ordem) values ('9b000000-0000-0000-0000-000000000001','9c000000-0000-0000-0000-000000000001',0), ('9b000000-0000-0000-0000-000000000001','9c000000-0000-0000-0000-000000000002',1);
select 'entregas geradas', preparar_semana('9b000000-0000-0000-0000-000000000001');
select 'Ana e Dani na Rota Centro, Beto na Sul, Caio sem rota',
  (select count(*) from entregas where cliente_id in ('91111111-1111-1111-1111-111111111111','94444444-4444-4444-4444-444444444444') and rota_nome = 'Rota Centro') = 2
  and (select rota_nome from entregas where cliente_id = '92222222-2222-2222-2222-222222222222') = 'Rota Sul'
  and (select rota_id from entregas where cliente_id = '93333333-3333-3333-3333-333333333333') is null;
-- divisão: 4 pães, 2 pães na semana (um deles tradicional) -> 2 + 2 para quem não tem quantidade fixa
select 'Ana: 2 tradicional + 2 sementes', (select quantidade from entrega_paes ep join entregas e on e.id=ep.entrega_id where e.cliente_id='91111111-1111-1111-1111-111111111111' and ep.pao_id='9c000000-0000-0000-0000-000000000001') = 2
  and (select quantidade from entrega_paes ep join entregas e on e.id=ep.entrega_id where e.cliente_id='91111111-1111-1111-1111-111111111111' and ep.pao_id='9c000000-0000-0000-0000-000000000002') = 2;
-- Dani tem 1 tradicional fixo; os outros 3 se dividem entre os dois pães (2 e 1) -> tradicional 1+2=3 ou 1+1=2, total 4
select 'Dani: total 4 e ao menos 1 tradicional', (select sum(quantidade) from entrega_paes ep join entregas e on e.id=ep.entrega_id where e.cliente_id='94444444-4444-4444-4444-444444444444') = 4
  and (select quantidade from entrega_paes ep join entregas e on e.id=ep.entrega_id where e.cliente_id='94444444-4444-4444-4444-444444444444' and ep.pao_id='9c000000-0000-0000-0000-000000000001') >= 1;

-- mudar os bairros e realocar
update rotas set bairros = array['Tristeza','Bom Fim'] where id = '9a000000-0000-0000-0000-000000000002';
update rotas set bairros = array['Centro Histórico'] where id = '9a000000-0000-0000-0000-000000000001';
select 'realoca', realocar_rotas_abertas();
select 'Dani foi para a Rota Sul', (select rota_nome from entregas where cliente_id='94444444-4444-4444-4444-444444444444') = 'Rota Sul';
-- excluir rota com atribuição histórica
insert into atribuicoes_rota (cliente_id, rota_id, ordem, inicio, fim) values ('91111111-1111-1111-1111-111111111111','9a000000-0000-0000-0000-000000000001',1,'2026-01-01','2026-02-01');
delete from rotas where id = '9a000000-0000-0000-0000-000000000001';
select 'rota excluída; entregas ficam sem rota', (select count(*) from entregas where cliente_id='91111111-1111-1111-1111-111111111111' and rota_id is null) = 1;
select 'ok9';
