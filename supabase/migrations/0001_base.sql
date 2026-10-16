-- Amada Massa — Fase 1 (base): usuários, clientes, contatos, planos,
-- pontos de coleta, assinaturas e auditoria. Valores em centavos (inteiros).

create type perfil_usuario as enum ('admin', 'operacao', 'entregador');
create type modalidade as enum ('coleta_padaria', 'coleta_ponto', 'entrega');
create type status_cliente as enum ('ativo', 'pausado', 'cancelado');
create type status_assinatura as enum ('ativa', 'pausada', 'cancelada', 'encerrada');
create type canal_contato as enum ('whatsapp', 'email', 'presencial', 'outro');

-- ---------------------------------------------------------------- usuarios
create table usuarios (
  id uuid primary key references auth.users (id) on delete cascade,
  nome text not null default '',
  perfil perfil_usuario not null default 'entregador',
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);

-- Cria a linha em "usuarios" quando o admin cria a conta no Supabase Auth.
-- O perfil vem de app_metadata (não editável pelo próprio usuário).
create function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into usuarios (id, nome, perfil)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'nome', split_part(new.email, '@', 1)),
    coalesce((new.raw_app_meta_data ->> 'perfil')::perfil_usuario, 'entregador')
  );
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- Helpers de autorização (security definer evita recursão de RLS).
create function perfil_atual() returns perfil_usuario
language sql stable security definer set search_path = public as $$
  select perfil from usuarios where id = auth.uid() and ativo
$$;

create function is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(perfil_atual() = 'admin', false)
$$;

create function is_equipe() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(perfil_atual() in ('admin', 'operacao'), false)
$$;

-- ---------------------------------------------------------------- clientes
create table clientes (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  sobrenome text not null default '',
  email text,
  whatsapp text,                 -- somente dígitos, com DDD
  cpf text,
  logradouro text,
  numero text,
  complemento text,
  bairro text,
  cidade text not null default 'Porto Alegre',
  cep text,
  referencia_portaria text,
  instrucoes_entrega text,
  origem text,                   -- site, instagram, indicacao, feira, outro
  confirmado_em date,
  restricoes_alimentares text,
  observacoes text,
  status status_cliente not null default 'ativo',
  pausa_retorno_previsto date,
  cancelado_em date,
  motivo_cancelamento text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index clientes_nome_idx on clientes (lower(nome), lower(sobrenome));
create index clientes_status_idx on clientes (status);
create index clientes_whatsapp_idx on clientes (whatsapp);
create index clientes_email_idx on clientes (lower(email));

-- ---------------------------------------------------------------- contatos
create table contatos (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references clientes (id) on delete cascade,
  usuario_id uuid references usuarios (id),
  data date not null default current_date,
  canal canal_contato not null default 'whatsapp',
  resumo text not null,
  proximo_passo text,
  proximo_passo_em date,
  concluido boolean not null default false,
  criado_em timestamptz not null default now()
);
create index contatos_cliente_idx on contatos (cliente_id, data desc);

-- ------------------------------------------------------------------ planos
create table planos (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  modalidade modalidade not null,
  paes_por_semana smallint not null check (paes_por_semana in (1, 2)),
  valor_centavos integer not null check (valor_centavos >= 0),
  vigencia_inicio date not null default current_date,
  ativo boolean not null default true,
  unique (modalidade, paes_por_semana, vigencia_inicio)
);

-- ----------------------------------------------------------- pontos_coleta
create table pontos_coleta (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  endereco text not null,
  dia_semana smallint check (dia_semana between 0 and 6), -- 0=domingo
  horario_texto text,            -- ex.: "Ter 11h–14h e 16h30–18h30; Qua 11h–18h30"
  responsavel text,
  telefone text,
  ativo boolean not null default true
);

-- -------------------------------------------------------------- assinaturas
create table assinaturas (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references clientes (id) on delete cascade,
  plano_id uuid not null references planos (id),
  valor_centavos integer not null check (valor_centavos >= 0), -- valor contratado (congelado)
  justificativa_valor text,      -- obrigatória quando difere do plano (checado no app)
  dia_vencimento smallint not null check (dia_vencimento between 1 and 28),
  ponto_coleta_id uuid references pontos_coleta (id),
  inicio date not null default current_date,
  fim date,
  status status_assinatura not null default 'ativa',
  motivo_cancelamento text,
  criado_em timestamptz not null default now()
);
create index assinaturas_cliente_idx on assinaturas (cliente_id);
-- Um cliente pode ter mais de uma assinatura ativa (spec 5), então sem unique parcial.

-- ---------------------------------------------------------- log_auditoria
create table log_auditoria (
  id bigint generated always as identity primary key,
  usuario_id uuid,
  entidade text not null,
  entidade_id text,
  acao text not null,
  antes jsonb,
  depois jsonb,
  em timestamptz not null default now()
);
create index log_auditoria_entidade_idx on log_auditoria (entidade, entidade_id, em desc);

create function auditar() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_id text;
begin
  v_id := coalesce((to_jsonb(new) ->> 'id'), (to_jsonb(old) ->> 'id'));
  insert into log_auditoria (usuario_id, entidade, entidade_id, acao, antes, depois)
  values (
    auth.uid(), tg_table_name, v_id, lower(tg_op),
    case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end,
    case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end
  );
  return coalesce(new, old);
end $$;

create trigger auditar_clientes after insert or update or delete on clientes
  for each row execute function auditar();
create trigger auditar_assinaturas after insert or update or delete on assinaturas
  for each row execute function auditar();
create trigger auditar_planos after insert or update or delete on planos
  for each row execute function auditar();
create trigger auditar_usuarios after update or delete on usuarios
  for each row execute function auditar();

create function toca_atualizado_em() returns trigger language plpgsql as $$
begin new.atualizado_em := now(); return new; end $$;
create trigger clientes_atualizado before update on clientes
  for each row execute function toca_atualizado_em();

-- --------------------------------------------------------------------- RLS
alter table usuarios enable row level security;
alter table clientes enable row level security;
alter table contatos enable row level security;
alter table planos enable row level security;
alter table pontos_coleta enable row level security;
alter table assinaturas enable row level security;
alter table log_auditoria enable row level security;

-- usuarios: cada um lê o próprio registro; admin gerencia todos.
create policy usuarios_ler_proprio on usuarios for select
  using (id = auth.uid() or is_admin());
create policy usuarios_admin_escreve on usuarios for all
  using (is_admin()) with check (is_admin());

-- clientes / contatos / assinaturas: equipe (admin e operação). Entregador não vê dados financeiros.
create policy contatos_equipe on contatos for all
  using (is_equipe()) with check (is_equipe());
create policy assinaturas_equipe on assinaturas for all
  using (is_equipe()) with check (is_equipe());

-- Exclusão definitiva de cliente (LGPD) é só do admin; cancelar não apaga (spec 4).
create policy clientes_ler on clientes for select using (is_equipe());
create policy clientes_inserir on clientes for insert with check (is_equipe());
create policy clientes_editar on clientes for update using (is_equipe()) with check (is_equipe());
create policy clientes_apagar on clientes for delete using (is_admin());

-- planos: equipe lê, admin edita preços.
create policy planos_ler on planos for select using (is_equipe());
create policy planos_admin on planos for all using (is_admin()) with check (is_admin());

-- pontos de coleta: equipe lê e edita (entregador lê, precisa saber onde entregar).
create policy pontos_ler on pontos_coleta for select
  using (perfil_atual() is not null);
create policy pontos_equipe on pontos_coleta for all
  using (is_equipe()) with check (is_equipe());

-- auditoria: só admin lê; escrita apenas via trigger (security definer).
create policy auditoria_admin_ler on log_auditoria for select using (is_admin());

-- ------------------------------------------------------------------- seeds
insert into planos (nome, modalidade, paes_por_semana, valor_centavos) values
  ('Coleta na padaria · 1 pão/semana', 'coleta_padaria', 1, 6000),
  ('Coleta na padaria · 2 pães/semana', 'coleta_padaria', 2, 9000),
  ('Ponto de coleta · 1 pão/semana', 'coleta_ponto', 1, 7500),
  ('Ponto de coleta · 2 pães/semana', 'coleta_ponto', 2, 10500),
  ('Entrega em casa · 1 pão/semana', 'entrega', 1, 8000),
  ('Entrega em casa · 2 pães/semana', 'entrega', 2, 11000);

insert into pontos_coleta (nome, endereco, horario_texto) values
  ('Padaria', 'Rua Doutor Sebastião Leão, 90 (Cidade Baixa)', 'Terça 11h–14h e 16h30–18h30; quarta 11h–18h30'),
  ('Zona Sul — Loja Residence Prime', 'Av. Wenceslau Escobar, 1766', 'Quarta 11h30–18h'),
  ('Bom Fim — Escola de Yoga Umåna', 'Av. Ramiro Barcelos, 1800', 'Terça 11h–19h');
