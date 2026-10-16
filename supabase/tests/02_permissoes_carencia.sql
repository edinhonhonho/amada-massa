\set ON_ERROR_STOP 1
-- operação: lista usuários, não altera configurações, pausa remove entrega
insert into auth.users (id,email,raw_app_meta_data) values ('00000000-0000-0000-0000-0000000000b0','op@x','{"perfil":"operacao"}');
set role authenticated;
set request.uid = '00000000-0000-0000-0000-0000000000b0';
select 'operacao vê usuarios', count(*) > 1 from usuarios;
select 'operacao vê cobrancas', count(*) from cobrancas;
update configuracoes set valor = 99 where chave='carencia_dias';
select 'config alterada por operacao?', valor from configuracoes where chave='carencia_dias';
update assinaturas set status='pausada' where cliente_id=(select id from clientes where nome='Ana');
select reavaliar_entregas();
select c.nome, e.status, e.observacao from entregas e join clientes c on c.id=e.cliente_id order by 1;
-- carência
set request.uid = '00000000-0000-0000-0000-00000000000a';
update configuracoes set valor = 3 where chave='carencia_dias';
update assinaturas set status='ativa';
update cobrancas set status='pendente', vencimento = hoje_br() - 2;
select 'em atraso c/ carencia 3 e venc -2 dias?', assinatura_em_atraso(id) from assinaturas limit 1;
update cobrancas set vencimento = hoje_br() - 4;
select 'em atraso c/ carencia 3 e venc -4 dias?', assinatura_em_atraso(id) from assinaturas limit 1;
