# Amada Massa — gestão do Clube do Pão

Sistema interno (Next.js + TypeScript + Tailwind) hospedado na **Vercel**, com **Supabase** (PostgreSQL + Auth) e código no **GitHub**, tudo em planos gratuitos. Especificação completa: seções 1–15 do documento do projeto.

## Estado atual: Fases 1 a 6

| Fase | O que há |
| --- | --- |
| 1 Base | Login, perfis com RLS, clientes (status, linha do tempo, contatos), planos, assinaturas, pontos de coleta, auditoria, LGPD |
| 2 Dinheiro | Cobrança mensal automática (mês atual e próximo), baixa parcial/total, ajuste/isenção com justificativa, estorno (admin), situação calculada (em dia, a vencer, vence hoje, atrasado, crítico), painel de pagamentos e grade clientes × meses |
| 3 Rotas | Editor com seleção de clientes, ordem sugerida e trajeto de bicicleta no mapa; atribuição com histórico (uma ativa por cliente); mapa e navegação pelo Google Maps no app do entregador |
| 4 Planejamento | Calendário do ano; catálogo de pães reutilizáveis; em cada semana, clientes com assinatura ativa agrupados por rota, ponto de coleta e padaria, quantidade de cada pão por cliente, total a produzir por destino e PDF para conferência, pular cliente, semana sem produção, entregas geradas com suspensão por atraso (volta ao pagar), listas de produção, entrega e coleta para imprimir |
| 5 Entregas | App do entregador (PWA, fila offline, iniciar/finalizar rota, foto e observação por parada, sem dados financeiros), ocorrências, pendências, histórico com fotos |
| 6 Comunicação e painel | Modelos de WhatsApp editáveis, envio em lote por segmento, painel inicial, 7 relatórios, CSV, configurações |

Também: backup automático do banco (`.github/workflows/backup.yml`, ver `docs/backup.md`).
App do membro com notificações push implementado. Ainda fora do escopo: mapa, conciliação de extrato, WhatsApp automático e formulário do Wix.

### Regras assumidas (decisões em aberto da especificação)
- Mês cheio no mês de início; vencimento = dia combinado (1–28), ou o dia do início se for posterior.
- Suspensão da entrega no dia seguinte ao vencimento; **carência configurável** em Configurações (padrão 0). Vale também para coleta.
- A entrega volta ao pagar, desde que a lista da semana não esteja fechada.
- Pausa/cancelamento cancelam cobranças ainda não vencidas; troca de plano substitui as cobranças pendentes do mês em diante.
- Sem multa nem juros.

## Desempenho

`vercel.json` fixa as funções em **São Paulo (gru1)**, perto do banco do Supabase (também em São Paulo). Sem isso a Vercel roda nos EUA e cada ida ao banco cruza o continente. O login é verificado localmente (`getClaims`) quando o projeto usa chaves de assinatura assimétricas (padrão em projetos novos do Supabase).

## Mapas e endereços (serviços gratuitos)

CEP: ViaCEP. Localização de endereços: Nominatim (OpenStreetMap), com limite de 1 consulta por segundo (o sistema respeita e guarda o resultado no cliente). Traçado de bicicleta: routing.openstreetmap.de. Mapa: Leaflet com tiles do OpenStreetMap. Todos são de uso gratuito e razoável; para volume alto, seria preciso um provedor próprio.

## Atalhos de teclado (gestão)

`⌘K` ou `/` abre a busca e os comandos (clientes, telas e criar). `N` novo cliente. `G` e depois uma letra navega: `I` início, `C` clientes, `L` planos, `P` pagamentos, `S` planejamento, `R` rotas, `E` entregas, `M` mensagens. `?` mostra a lista.

## Os três apps

| App | Endereço | Quem usa |
| --- | --- | --- |
| Gestão | `/` | Administrador e operação, no computador |
| Entregador (PWA) | `/entregador` | Entregador, no celular: escolhe a rota, inicia, marca entregas com foto e observação, funciona sem sinal |
| Membro (PWA) | `/membro` | Cliente: entra com e-mail + código, instala o app e recebe notificações (rota iniciou, você é o próximo, entregue, sabor) |

O membro só entra se o e-mail estiver na ficha do cliente (e o cliente não estiver cancelado).

## Configuração

1. **Supabase** (região São Paulo): rode no SQL Editor, em ordem, `supabase/migrations/0001_base.sql`, `0002_financeiro_rotas_semanas.sql`, `0003_apps_entregador_membro.sql`, `0004_planos_pontos_paes_mapa.sql` e `0005_catalogo_paes_quantidades.sql`.
2. **Supabase → Authentication**:
   - *Sign In / Providers → Email*: deixe ligado; desligue **Allow new users to sign up**; comprimento do código (OTP length) = 6.
   - *URL Configuration*: Site URL = endereço do app; Redirect URLs = `https://SEU-APP/auth/callback` (e `http://localhost:3000/auth/callback`).
   - *Emails → SMTP Settings*: ative um SMTP próprio (o envio padrão do Supabase só entrega para a equipe do projeto). Gmail com senha de app (`smtp.gmail.com`, porta 465) ou Brevo funcionam no plano gratuito. Depois, em *Rate Limits*, aumente "emails per hour".
   - *Emails → Templates → Magic Link*: troque o texto por algo que mostre o código, ex.: `<p>Seu código do Amada Massa: <b>{{ .Token }}</b></p>`.
3. **Primeiro administrador**: *Authentication → Users → Add user* (marque Auto Confirm), depois no SQL Editor:
   ```sql
   update usuarios set perfil = 'admin' where id = (select id from auth.users where email = 'voce@exemplo.com');
   ```
   Demais contas da equipe: mesmo caminho; ajuste `perfil` (`operacao` ou `entregador`) e o `nome` (aparece nos avisos aos membros, ex.: "Seu entregador é Marcelo").
4. **Chaves de notificação**: rode `npm run vapid` e guarde as duas chaves.
5. **Vercel**: importe o repositório e defina as variáveis de `.env.example`: URL e chave pública do Supabase, `SUPABASE_SERVICE_ROLE_KEY` (secreta!), `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`. Faça um redeploy depois de mudar variáveis.
6. **Local**: `cp .env.example .env.local`, preencha e rode `npm install && npm run dev`.
7. **Backup**: secret `SUPABASE_DB_URL` no GitHub (ver `docs/backup.md`).

## Observações

- Valores em centavos inteiros; datas dd/mm/aaaa; fuso America/Sao_Paulo.
- Pausa registrada no próprio cliente (`pausa_retorno_previsto`); pausas pontuais de uma semana usam `pulos_semana`.
- Rotas se ordenam por setas ↑↓ (funciona melhor no celular que arrastar e soltar).
- Comprovante de pagamento (anexo) não implementado; use o campo de observação.
- Testes: `npm test` (regras de situação, CSV, mensagens, PDF, geografia). Testes de banco: `supabase/tests/rodar.sh` (aplica as migrações e roda os testes num Postgres local com um stub do Supabase).
- Termos do plano Hobby da Vercel (uso não comercial) e backup semanal via GitHub Actions: ver seção 13/15 da especificação.
