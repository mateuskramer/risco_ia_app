"""
Cria o schema do RiscoIA no PostgreSQL do zero.
Tabelas: users, project, risk, project_risk, chat, chat_interaction.

Uso:
    pip install psycopg2-binary
    export DATABASE_URL="postgresql://usuario:senha@host:5432/nome_do_banco"
    python create_db.py
"""

import os
import sys

import psycopg2

LOCAL_DEV_DEFAULT = "postgresql://postgres:1234@localhost:5432/riscoia"

SCHEMA_SQL = """
CREATE TABLE IF NOT EXISTS users (
    id_user     SERIAL PRIMARY KEY,
    name        VARCHAR(100)  NOT NULL,
    email       VARCHAR(150)  NOT NULL UNIQUE,
    password    VARCHAR(255)  NOT NULL,
    role        VARCHAR(10)   NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user')),
    status      VARCHAR(10)   NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo', 'inativo')),
    created_at  TIMESTAMP     NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS project (
    id_project  SERIAL PRIMARY KEY,
    id_user     INT           NOT NULL REFERENCES users(id_user) ON DELETE CASCADE,
    title       VARCHAR(255)  NOT NULL,
    abstract    TEXT,
    date        TIMESTAMP     NOT NULL DEFAULT now(),
    text        TEXT,
    midia       BYTEA
);
CREATE INDEX IF NOT EXISTS idx_project_user ON project(id_user);

CREATE TABLE IF NOT EXISTS risk (
    id_risk     SERIAL PRIMARY KEY,
    name        VARCHAR(100)  NOT NULL,
    description VARCHAR(255)  NOT NULL DEFAULT '',
    prompt      TEXT          NOT NULL,
    active      BOOLEAN       NOT NULL DEFAULT true,
    updated_at  TIMESTAMP     NOT NULL DEFAULT now(),
    updated_by  VARCHAR(100)  NOT NULL DEFAULT 'sistema',
    history     JSONB         NOT NULL DEFAULT '[]'::jsonb
);

CREATE TABLE IF NOT EXISTS project_risk (
    id_project_risk  SERIAL PRIMARY KEY,
    id_project       INT           NOT NULL REFERENCES project(id_project) ON DELETE CASCADE,
    id_risk          INT           NOT NULL REFERENCES risk(id_risk) ON DELETE RESTRICT,
    level            DECIMAL(5,2)  NOT NULL,
    level_description VARCHAR(20)  NOT NULL,
    probability      VARCHAR(10)   NOT NULL DEFAULT 'media',
    false_positive   BOOLEAN       NOT NULL DEFAULT false,
    solved           BOOLEAN       NOT NULL DEFAULT false,
    output           JSONB,
    analyzed_by      VARCHAR(100)  NOT NULL DEFAULT 'sistema',
    created_at       TIMESTAMP     NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pr_project ON project_risk(id_project);
CREATE INDEX IF NOT EXISTS idx_pr_risk ON project_risk(id_risk);

CREATE TABLE IF NOT EXISTS chat (
    id_chat     SERIAL PRIMARY KEY,
    id_project  INT           NOT NULL REFERENCES project(id_project) ON DELETE CASCADE,
    title       VARCHAR(255)  NOT NULL DEFAULT 'Nova conversa',
    created_at  TIMESTAMP     NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_chat_project ON chat(id_project);

CREATE TABLE IF NOT EXISTS chat_interaction (
    id_interaction SERIAL PRIMARY KEY,
    id_chat        INT          NOT NULL REFERENCES chat(id_chat) ON DELETE CASCADE,
    text           TEXT         NOT NULL,
    source         VARCHAR(10)  NOT NULL DEFAULT 'user' CHECK (source IN ('user', 'assistant')),
    created_at     TIMESTAMP    NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_interaction_chat ON chat_interaction(id_chat);
"""


def get_database_url() -> str:
    url = os.environ.get("DATABASE_URL")
    if url:
        return url
    print(f"DATABASE_URL não definida — usando o padrão de dev local: {LOCAL_DEV_DEFAULT}")
    return LOCAL_DEV_DEFAULT


def ensure_database_exists(database_url: str) -> None:
    try:
        # Tenta conectar direto para testar se o banco já existe
        conn = psycopg2.connect(database_url)
        conn.close()
        return
    except Exception:
        # Se falhou, conecta ao banco 'postgres' padrão para criar o banco de dados 'riscoia'
        try:
            from urllib.parse import urlparse, urlunparse
            parsed = urlparse(database_url)
            db_name = parsed.path.lstrip("/") or "riscoia"
            # Substitui a rota pelo banco padrao 'postgres'
            postgres_url = urlunparse((parsed.scheme, parsed.netloc, "/postgres", parsed.params, parsed.query, parsed.fragment))
            
            conn = psycopg2.connect(postgres_url)
            conn.autocommit = True
            with conn.cursor() as cur:
                cur.execute(f"CREATE DATABASE \"{db_name}\"")
            conn.close()
            print(f"Banco de dados '{db_name}' criado com sucesso!")
        except Exception as err:
            print(f"Aviso ao verificar/criar banco: {err}")

def main() -> None:
    database_url = get_database_url()

    print("Verificando se o banco de dados existe...")
    ensure_database_exists(database_url)

    print("Conectando ao banco...")
    conn = psycopg2.connect(database_url)
    conn.autocommit = True

    try:
        with conn.cursor() as cur:
            print("Criando schema do banco (users, project, risk, project_risk, chat, chat_interaction)...")
            cur.execute(SCHEMA_SQL)
        print("Pronto — schema criado com sucesso.")
    except Exception as exc:  # noqa: BLE001
        print(f"Erro ao criar o schema: {exc}", file=sys.stderr)
        sys.exit(1)
    finally:
        conn.close()


if __name__ == "__main__":
    main()
