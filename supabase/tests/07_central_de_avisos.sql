\set ON_ERROR_STOP 1
-- Roda sobre um banco com 0001..0007 aplicadas.
insert into auth.users (id,email,raw_app_meta_data) values
  ('00000000-0000-0000-0000-0000000000a7','adm7@x','{"perfil":"admin"}'),
  ('00000000-0000-0000-0000-0000000000b7','membro7@x','{"membro":true}');
insert into clientes (id, nome, email, whatsapp) values
  ('71111111-1111-1111-1111-111111111111','Ana','ana@x','51999998888'),
  ('72222222-2222-2222-2222-222222222222','Beto','beto@x','51988887777');
insert into membros (user_id, cliente_id) values ('00000000-0000-0000-0000-0000000000b7','71111111-1111-1111-1111-111111111111');
insert into usuarios (id, nome, perfil) values ('00000000-0000-0000-0000-0000000000a7','Adm7','admin') on conflict (id) do nothing;

-- o servidor (service role) grava o aviso e as notificações; aqui simulamos como superusuário
insert into avisos (id, titulo, corpo, segmento, segmento_rotulo, destinatarios, pushes, enviado_por)
values ('7a000000-0000-0000-0000-000000000001','Pão novo','Oi!','todos','Todos os clientes',2,1,'00000000-0000-0000-0000-0000000000a7');
insert into notificacoes (cliente_id, tipo, titulo, corpo, ref, aviso_id) values
  ('71111111-1111-1111-1111-111111111111','aviso','Pão novo','Oi, Ana!','aviso:1','7a000000-0000-0000-0000-000000000001'),
  ('72222222-2222-2222-2222-222222222222','aviso','Pão novo','Oi, Beto!','aviso:1','7a000000-0000-0000-0000-000000000001');
-- segundo envio ao mesmo cliente com o mesmo ref é barrado (não avisa duas vezes)
do $$ begin
  begin
    insert into notificacoes (cliente_id, tipo, titulo, corpo, ref) values ('71111111-1111-1111-1111-111111111111','aviso','x','x','aviso:1');
    raise exception 'deveria barrar duplicado';
  exception when unique_violation then null; end;
end $$;

-- membro lê só a própria caixa e marca como lida
set role authenticated;
set request.uid = '00000000-0000-0000-0000-0000000000b7';
select 'membro vê só a sua notificação', (select count(*) from notificacoes) = 1;
update notificacoes set lida_em = now();
select 'membro não vê o histórico de avisos da equipe', (select count(*) from avisos) = 0;
select 'membro não toca nas tentativas de login', not has_table_privilege('authenticated', 'tentativas_login', 'insert') or (select count(*) from tentativas_login) = 0;

-- equipe vê o resumo com leitura
set request.uid = '00000000-0000-0000-0000-0000000000a7';
select 'resumo: 2 gravados, 1 lido', (select gravados from avisos_resumo) = 2 and (select lidos from avisos_resumo) = 1;

-- resumo mensal de cobranças (para o gráfico de Pagamentos)
reset role;
insert into planos (id, nome, modalidade, paes_por_semana, valor_centavos) values ('7e000000-0000-0000-0000-000000000001','Entrega 2','entrega',2,10000);
insert into assinaturas (id, cliente_id, plano_id, valor_centavos, dia_vencimento, inicio) values ('7f000000-0000-0000-0000-000000000001','71111111-1111-1111-1111-111111111111','7e000000-0000-0000-0000-000000000001',10000,10,'2026-01-01');
insert into cobrancas (id, assinatura_id, competencia, valor_centavos, vencimento) values
  ('7c000000-0000-0000-0000-000000000001','7f000000-0000-0000-0000-000000000001','2026-10-01',10000,'2026-10-10'),
  ('7c000000-0000-0000-0000-000000000002','7f000000-0000-0000-0000-000000000001','2026-11-01',10000,'2026-11-10');
insert into pagamentos (cobranca_id, valor_centavos, data, forma) values ('7c000000-0000-0000-0000-000000000001',10000,'2026-10-09','pix');
update cobrancas set status = 'paga' where id = '7c000000-0000-0000-0000-000000000001';
set role authenticated;
set request.uid = '00000000-0000-0000-0000-0000000000a7';
select 'resumo_cobrancas: outubro recebido, novembro em aberto',
  (select recebido from resumo_cobrancas('2026-06-01','2026-11-01') where competencia = '2026-10-01') = 10000
  and (select esperado from resumo_cobrancas('2026-06-01','2026-11-01') where competencia = '2026-11-01') = 10000
  and (select recebido from resumo_cobrancas('2026-06-01','2026-11-01') where competencia = '2026-11-01') = 0;
select 'ok7';
