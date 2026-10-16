# Amada Massa — gestão do Clube do Pão

Sistema interno (Next.js + TypeScript + Tailwind) hospedado na **Vercel**, com **Supabase** (PostgreSQL + Auth) e código no **GitHub**, tudo em planos gratuitos. Especificação completa: seções 1–15 do documento do projeto.

## Estado atual: Fases 1 a 6

| Fase | O que há |
| --- | --- |
| 1 Base | Login, perfis com RLS, clientes (status, linha do tempo, contatos), planos, assinaturas, pontos de coleta, auditoria, LGPD |
| 2 Dinheiro | Cobrança mensal automática (mês atual e próximo), baixa parcial/total, ajuste/isenção com justificativa, estorno (admin), situação calculada (em dia, a vencer, vence hoje, atrasado, crítico), painel de pagamentos e grade clientes × meses |
| 3 Rotas | Rotas com entregador e capacidade, atribuição com histórico (uma ativa por cliente), ordem de parada, resumo, alertas (sem rota, bairro fora da bike) |
| 4 Semana | Semanas e sabores, pular cliente, semana sem produção, entregas geradas com suspensão por atraso (volta ao pagar), listas de produção, entrega e coleta para imprimir |
| 5 Entregas | Tela do entregador no celular (PWA, fila offline, sem dados financeiros), ocorrências, pendências, histórico por semana/rota |
| 6 Comunicação e painel | Modelos de WhatsApp editáveis, envio em lote por segmento, painel inicial, 7 relatórios, CSV, configurações |

Também: backup automático do banco (`.github/workflows/backup.yml`, ver `docs/backup.md`).
Fase 7 (mapa, conciliação de extrato, WhatsApp automático, formulário do Wix, portal do cliente) não foi feita, como previsto na especificação.

### Regras assumidas (decisões em aberto da especificação)
- Mês cheio no mês de início; vencimento = dia combinado (1–28), ou o dia do início se for posterior.
- Suspensão da entrega no dia seguinte ao vencimento; **carência configurável** em Configurações (padrão 0). Vale também para coleta.
- A entrega volta ao pagar, desde que a lista da semana não esteja fechada.
- Pausa/cancelamento cancelam cobranças ainda não vencidas; troca de plano substitui as cobranças pendentes do mês em diante.
- Sem multa nem juros.

## Configuração

1. **Supabase** (região São Paulo): crie o projeto e rode `supabase/migrations/0001_base.sql` e depois `0002_financeiro_rotas_semanas.sql` no SQL Editor.
   Em *Authentication → Providers → Email* desligue "Allow new users to sign up".
   Em *Authentication → URL Configuration* defina Site URL e adicione `https://SEU-APP/auth/callback` em Redirect URLs.
2. **Primeiro administrador**: em *Authentication → Users → Add user* crie sua conta e depois, no SQL Editor:
   ```sql
   update usuarios set perfil = 'admin' where id = (select id from auth.users where email = 'voce@exemplo.com');
   ```
   As demais contas são criadas da mesma forma (perfil padrão `entregador`; ajuste em `usuarios.perfil`).
3. **Local**: `cp .env.example .env.local`, preencha as chaves (Settings → API) e rode `npm install && npm run dev`.
4. **Vercel**: importe o repositório do GitHub e defina as 3 variáveis de `.env.example`. Deploy automático a cada commit.

## Observações

- Valores em centavos inteiros; datas dd/mm/aaaa; fuso America/Sao_Paulo.
- Pausa registrada no próprio cliente (`pausa_retorno_previsto`); pausas pontuais de uma semana usam `pulos_semana`.
- Rotas se ordenam por setas ↑↓ (funciona melhor no celular que arrastar e soltar).
- Comprovante de pagamento (anexo) não implementado; use o campo de observação.
- Testes: `npm test` (regras de situação, CSV, mensagens). Testes de banco: `supabase/tests/` (rodam num Postgres com o stub do Supabase).
- Termos do plano Hobby da Vercel (uso não comercial) e backup semanal via GitHub Actions: ver seção 13/15 da especificação.
