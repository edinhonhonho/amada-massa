#!/usr/bin/env bash
# Roda todas as migrações e os testes de banco num Postgres local (sem Supabase).
# Uso: PGHOST=/tmp PGPORT=54329 PGUSER=postgres supabase/tests/rodar.sh
set -euo pipefail
cd "$(dirname "$0")/.."
P="psql -q -v ON_ERROR_STOP=1 -d teste_amada"
psql -q -d postgres -c "drop database if exists teste_amada" -c "create database teste_amada"
$P -c "do \$\$ begin if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if; end \$\$;"
$P -c "grant usage on schema public to authenticated; alter default privileges in schema public grant all on tables to authenticated; alter default privileges in schema public grant execute on functions to authenticated;"
$P -f tests/00_stub_supabase.sql
$P -f migrations/0001_base.sql -f migrations/0002_financeiro_rotas_semanas.sql -f migrations/0003_apps_entregador_membro.sql
$P -f tests/01_negocio.sql >/dev/null; $P -f tests/02_permissoes_carencia.sql >/dev/null; $P -f tests/03_apps.sql >/dev/null
$P -f migrations/0004_planos_pontos_paes_mapa.sql
$P -f tests/04_planos_pontos_paes.sql | grep -q ok4
$P -f migrations/0005_catalogo_paes_quantidades.sql
$P -c "delete from semanas; delete from paes;" >/dev/null
$P -c "delete from entregas; delete from assinaturas; delete from atribuicoes_rota; delete from clientes; delete from rotas;" >/dev/null 2>&1 || true
$P -f tests/05_catalogo_quantidades.sql | grep -q ok5
# a 0006 adiciona um valor ao enum: roda sozinha, antes dos testes que o usam
$P -c "delete from semanas; delete from paes; delete from entregas; delete from assinaturas; delete from clientes;" >/dev/null 2>&1 || true
$P -f migrations/0006_apoio_e_paes_tradicionais.sql
$P -f tests/06_apoio_tradicional.sql | grep -q ok6
$P -f migrations/0007_central_de_avisos.sql
$P -f tests/07_central_de_avisos.sql | tee /tmp/saida07.txt | grep -q ok7
! grep -E "^ *(.*)\| f$" /tmp/saida07.txt || { echo "teste 07 com verificação falsa"; cat /tmp/saida07.txt; exit 1; }
$P -f migrations/0008_modelos_de_aviso.sql
$P -f tests/08_modelos_aviso.sql | grep -q ok8
$P -f migrations/0009_rotas_por_bairro.sql
$P -f tests/09_rotas_bairro_tradicional.sql | tee /tmp/saida09.txt | grep -q ok9
! grep -E "\| f$" /tmp/saida09.txt || { echo "teste 09 com verificação falsa"; cat /tmp/saida09.txt; exit 1; }
echo "OK: migrações 0001-0009 e testes 01-09 passaram."
