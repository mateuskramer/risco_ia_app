# Gestão de Riscos — Análise de Risco em Projetos

Sistema completo (Next.js + TypeScript + Postgres) para analisar risco em
PDFs: riscos configuráveis leem o projeto, pontuam cada aspecto (0–100),
citam os trechos que embasam a pontuação, e tudo fica versionado — nada é
sobrescrito. Tem também um chat pra fazer perguntas livres sobre o conteúdo
de cada projeto, e exportação de relatório em PDF/Markdown.

## Stack

- **Front + back**: Next.js (App Router), num projeto só — páginas em
  `src/app/(app)` e `src/app/(auth)`, API em `src/app/api/**/route.ts`.
- **Banco**: PostgreSQL, 5 tabelas (`users`, `project`, `project_section`,
  `risk`, `project_section_risk`) — schema em `create-bd/create_db.py`.
- **IA**: gateway institucional próprio (formato da Responses API da
  OpenAI, modelo `gpt-5.1`) — é o **único** modelo usado no sistema, tanto
  pra análise de risco quanto pro chat. Ver `src/lib/agents/institutional-gpt-client.ts`.
- **Auth**: senha com hash bcrypt, sessão em cookie `httpOnly` assinado (JWT).
- **Relatório**: `pdf-lib` (não depende de navegador/Chromium) pro PDF;
  Markdown puro pro outro formato.

## Como rodar

```bash
npm install
cp .env.local.example .env.local   # preenche os valores (ver abaixo)
npm run dev
```

Acesse http://localhost:3000

### Variáveis de ambiente (`.env.local`)

| Variável | O que é |
|---|---|
| `DATABASE_URL` | connection string do Postgres, ex.: `postgresql://postgres:1234@localhost:5432/riscoia` |
| `AUTH_SECRET` | assina o cookie de sessão. Gere com `openssl rand -base64 32`. Sem isso em produção, o servidor recusa subir de propósito. |
| `INSTITUTIONAL_GPT_URL` | URL do gateway institucional (confidencial) |
| `INSTITUTIONAL_GPT_KEY` | chave do gateway institucional (confidencial) |
| `INSTITUTIONAL_GPT_MODEL` | modelo usado. Padrão: `gpt-5.1` |

### Banco de dados

O schema (5 tabelas) vive em `create-bd/create_db.py`. É idempotente —
pode rodar de novo em cima de um banco já existente sem perder dado:

```bash
cd create-bd
pip install psycopg2-binary
python create_db.py
python seed_risks.py     # popula os riscos padrão (opcional)
```

## Contas

Não existe usuário pré-cadastrado. **O primeiro cadastro feito em `/cadastro`
vira administrador automaticamente.** Os próximos entram como usuário
comum; um admin promove quem precisar em Configurações → Usuários.

## O que está implementado

- **Login e cadastro** (`/login`, `/cadastro`) — senha com hash bcrypt
  (custo 12), sessão em cookie `httpOnly`.
- **Dashboard** (`/dashboard`) — resumo, distribuição por risco, score
  médio, atividade recente. Projetos ainda sem análise (pendentes) não
  entram na distribuição/score médio, pra não distorcer os números.
- **Projetos** (`/projetos`, `/projetos/[id]`) — upload real: extrai o
  texto do PDF, busca os riscos ativos no banco, roda um risco **por
  agente, em paralelo**, grava score + justificativa + trechos citados.
  - **Upload e análise são desacoplados**: o PDF é sempre salvo primeiro;
    se a análise falhar (rede, timeout, filtro de segurança do provider,
    etc.), o projeto fica marcado como "pendente" em vez de sumir — dá
    pra abrir o PDF e tentar analisar de novo depois, sem reenviar o
    arquivo.
  - Reanálise sempre **insere uma versão nova**, nunca sobrescreve — a
    timeline de histórico mostra todas as rodadas.
  - **Abrir PDF**: abre o arquivo original numa aba nova
    (`GET /api/projects/[id]/file`).
  - **Relatório**: exporta em PDF ou Markdown — score geral, análise geral
    (montada a partir dos próprios dados, sem chamada extra de IA),
    principais riscos ordenados por gravidade, trechos citados
    (`GET /api/projects/[id]/report?format=pdf|md`).
  - **Chat sobre o projeto** — pergunta livre respondida com base só no
    texto daquele PDF; não persiste (fica só na tela).
- **Configurações** (`/configuracoes`, admin) — hub com abas:
  - **Riscos**: cadastrar/editar (nome + prompt em inglês + descrição).
    Editar o prompt versiona automaticamente.
  - **Usuários**: listar, criar, mudar nível de acesso, ativar/desativar,
    excluir.
  - **Projetos**: visão geral de todos os projetos da organização.
- **Tema claro/escuro**.
- **Permissões, reforçadas no backend** (não só escondidas na UI):
  - `/api/risks`, `/api/users` exigem admin (403 pra quem não é).
  - `/api/risks/status` é liberado pra qualquer usuário logado (só devolve
    um booleano — "existe risco ativo?" — sem expor os prompts).
  - `/api/projects`: admin vê todos os projetos, usuário comum só os seus.
    Excluir e reanalisar exigem ser o dono — **mesmo admin só mexe no que
    é dele**, só visualiza o resto.
  - Toda rota exige sessão válida (401 sem cookie).

## Estrutura

```
src/
  app/
    page.tsx                        tela inicial
    (auth)/login, /cadastro
    (app)/layout.tsx                shell protegido (sidebar + topbar + guard)
    (app)/dashboard
    (app)/projetos, /projetos/[id]
    (app)/configuracoes             admin only — abas Riscos/Usuários/Projetos
    api/
      auth/{login,register,logout,me}
      users, users/[id]             admin only
      risks, risks/[id]             admin only (config dos riscos)
      risks/status                  qualquer usuário (só um booleano)
      projects                      GET (lista) / POST (upload + análise best-effort)
      projects/[id]                 GET / DELETE
      projects/[id]/reanalyze       POST
      projects/[id]/history         GET (timeline de versões)
      projects/[id]/chat            POST (perguntas sobre o projeto)
      projects/[id]/file            GET (abre o PDF original)
      projects/[id]/report          GET (relatório em PDF ou Markdown)

  components/
    ui/                             primitivos (botão, input, dialog, tabela...)
    settings/                       abas de Configurações (riscos/usuarios/projetos)
    risk-gauge.tsx, risk-badge.tsx
    pdf-chat.tsx, pdf-upload-dialog.tsx, pdf-history-timeline.tsx
    system-model-card.tsx, user-form-dialog.tsx

  lib/
    types.ts                        modelos de dados do front
    storage.ts                      camada de serviço (chama a API real)
    auth.ts                         bcrypt + JWT + guards (requireSession/requireAdmin)
    auth-context.tsx                sessão em React Context (busca em /api/auth/me)
    db.ts                           pool de conexão Postgres (pg)
    projects-db.ts                  queries de projetos (estado atual vs. histórico)
    report.ts                       geração do relatório (Markdown + PDF via pdf-lib)
    agents/
      analyze-risk.ts               agente de risco (prompt em inglês, JSON validado por zod)
      chat-with-document.ts         agente de chat
      institutional-gpt-client.ts   cliente do gateway institucional (Responses API)
    pdf-text.ts                     extração de texto do PDF (pdf-parse)

create-bd/
  create_db.py                      schema das 5 tabelas (idempotente)
  seed_risks.py, seed-data/         riscos padrão pra popular o banco
```
