# RiscoIA — Análise de Risco em Documentos

Sistema completo (Next.js + TypeScript + Postgres + Gemini) para analisar
risco em PDFs: agentes de IA configuráveis leem o documento, pontuam cada
tipo de risco (0–100), citam os trechos que embasam a pontuação, e tudo fica
versionado — nada é sobrescrito. Tem também um chat pra fazer perguntas
livres sobre o conteúdo de cada documento.

## Stack

- **Front + back**: Next.js (App Router), num projeto só — páginas em
  `src/app/(app)` e `src/app/(auth)`, API em `src/app/api/**/route.ts`.
- **Banco**: PostgreSQL, 5 tabelas (`users`, `project`, `project_section`,
  `risk`, `project_section_risk`) — schema em `create_db.py`, num
  repositório/pasta separado.
- **IA**: Gemini via [Vercel AI SDK](https://ai-sdk.dev) (`generateObject`
  pra achar riscos com saída estruturada, `generateText` pro chat).
- **Auth**: senha com hash bcrypt, sessão em cookie `httpOnly` assinado
  (JWT).

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
| `GOOGLE_GENERATIVE_AI_API_KEY` | chave do Gemini — pegue grátis em https://aistudio.google.com/app/apikey |
| `GOOGLE_MODEL` | modelo usado por todos os agentes. Padrão: `gemini-2.5-flash` |
| `OPENAI_API_KEY` | chave da OpenAI (opcional) — usada como contingência com o modelo `gpt-4o-mini` caso as requisições paralelas ao Gemini falhem por limite de cota (Rate Limit). |

### Banco de dados

O schema (5 tabelas) vive em `create_db.py`. É idempotente — pode rodar de novo em cima de um banco já existente sem perder dados:

```bash
pip install psycopg2-binary pypdf
python create_db.py
```

#### Populando Dados Iniciais (Seeds)

Para facilitar o desenvolvimento, fornecemos scripts dentro da pasta `create-bd/` para popular o banco de dados com os dados de exemplo (localizados em `create-bd/seed-data/`):

1. **Agentes e Prompts de Risco**: Popula os 24 riscos com seus respectivos prompts originais a partir de `riscos.json`.
   ```bash
   python seed_risks.py
   ```

2. **Projetos de Teste (PDFs)**: Extrai o texto dos 5 PDFs de exemplo e cadastra-os no banco de dados. Caso o banco de dados não possua nenhum usuário cadastrado, cria automaticamente o usuário administrador padrão (`admin@empresa.com` / senha: `admin123`) para vincular os projetos.
   ```bash
   python seed_projects.py
   ```

## Contas

Não existe usuário pré-cadastrado. **O primeiro cadastro feito em `/cadastro`
vira administrador automaticamente** (senão ninguém conseguiria promover
ninguém depois). Os próximos cadastros entram como usuário comum; um admin
promove quem precisar em `/usuarios`.

## O que está implementado

- **Login e cadastro** (`/login`, `/cadastro`) — senha com hash bcrypt
  (custo 12), sessão em cookie `httpOnly` (não acessível via JavaScript no
  navegador).
- **Dashboard** (`/dashboard`) — resumo, distribuição por risco, score
  médio, atividade recente. Escopado por usuário, ou por toda a organização
  se for admin.
- **PDFs** (`/pdfs`, `/pdfs/[id]`) — upload de verdade: extrai o texto do
  PDF (`pdf-parse`), busca os riscos ativos no banco, roda um agente de IA
  **por risco, em paralelo** (`Promise.all`), grava score + justificativa +
  trechos citados. Reanálise sempre **insere uma versão nova**, nunca
  sobrescreve — a timeline de histórico mostra todas as rodadas.
- **Chat sobre o documento** (dentro de `/pdfs/[id]`) — pergunta livre
  respondida com base só no texto daquele PDF; se a resposta não estiver no
  documento, o agente diz isso em vez de inventar. Conversa não é
  persistida (fica só na tela).
- **Usuários** (`/usuarios`, admin) — listar, criar, mudar nível de acesso,
  ativar/desativar, excluir.
- **Agentes de IA** (`/agentes`, admin) — cadastrar/editar agentes (nome do
  risco + prompt). Editar o prompt versiona automaticamente; a versão
  anterior fica disponível em "Ver versões anteriores". Um seletor no topo
  da página escolhe o modelo de IA usado por todos os agentes (hoje é só
  visual — quem manda de verdade é a env var `GOOGLE_MODEL`, ver Débitos
  abaixo).
- **Tema claro/escuro**.
- **Permissões, reforçadas no backend** (não só escondidas na UI):
  - `/api/risks` e `/api/users` exigem admin (403 pra quem não é).
  - `/api/projects`: admin vê todos os documentos, usuário comum só os
    seus. Excluir e reanalisar exigem ser o dono — **mesmo admin só mexe no
    que é dele**, só visualiza o resto.
  - Toda rota exige sessão válida (401 sem cookie).

## Estrutura

```
src/
  app/
    page.tsx                        tela inicial
    (auth)/login, /cadastro
    (app)/layout.tsx                shell protegido (sidebar + topbar + guard)
    (app)/dashboard
    (app)/pdfs, /pdfs/[id]
    (app)/usuarios                  admin only
    (app)/agentes                   admin only
    api/
      auth/{login,register,logout,me}
      users, users/[id]             admin only
      risks, risks/[id]             admin only (agentes de IA)
      projects                      GET (lista) / POST (upload + análise)
      projects/[id]                 GET / DELETE
      projects/[id]/reanalyze       POST
      projects/[id]/history         GET (timeline de versões)
      projects/[id]/chat            POST (perguntas sobre o documento)

  components/
    ui/                             primitivos (botão, input, dialog, tabela...)
    risk-gauge.tsx                  medidor de risco (0–100)
    risk-badge.tsx
    pdf-chat.tsx                    chat sobre o documento
    pdf-upload-dialog.tsx, pdf-history-timeline.tsx
    agent-prompt-dialog.tsx, system-model-card.tsx, user-form-dialog.tsx

  lib/
    types.ts                        modelos de dados do front
    storage.ts                      camada de serviço (chama a API real)
    auth.ts                         bcrypt + JWT + guards (requireSession/requireAdmin)
    auth-context.tsx                sessão em React Context (busca em /api/auth/me)
    db.ts                           pool de conexão Postgres (pg)
    projects-db.ts                  queries de documentos (estado atual vs. histórico)
    models.ts                       lista de modelos de IA pro seletor
    risk.ts                         helpers de cor/label por faixa de risco
    agents/
      analyze-risk.ts               agente de risco (generateObject, Gemini)
      chat-with-document.ts         agente de chat (generateText, Gemini)
    pdf-text.ts                     extração de texto do PDF (pdf-parse)
```

## Débitos técnicos conhecidos

- **Config de modelo de IA no front é cosmética** — o seletor em
  `/agentes` não está ligado a nada real ainda; o modelo de verdade vem da
  env var `GOOGLE_MODEL`. Persistir isso (numa tabela ou coluna de
  configuração) é o próximo passo natural se quiser trocar de modelo sem
  reiniciar o servidor.
- **1 seção por documento** — `project_section` hoje sempre tem uma linha
  só (o documento inteiro), sem chunking por página. Os trechos citados
  pelo agente vêm do texto todo, sem número de página garantidamente
  confiável.
- **Chat não é persistido** — fica só no estado da página; recarregar
  perde a conversa. Fácil de adicionar depois (uma coluna JSONB em
  `project`, sem precisar de tabela nova).
- **Cache de prompt** — cada chamada de análise reenvia o texto do
  documento inteiro por risco. Pra documentos grandes ou muitos riscos
  cadastrados, vale configurar cache de prompt do provider (Gemini já
  oferece isso automaticamente pra conteúdo repetido entre chamadas
  próximas).
