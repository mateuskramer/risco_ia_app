"""
Cria (ou atualiza) o schema do RiscoIA no PostgreSQL. 5 tabelas:
users, project, project_section, risk, project_section_risk.

Uso:
    pip install psycopg2-binary
    export DATABASE_URL="postgresql://usuario:senha@host:5432/nome_do_banco"
    python create_db.py

Idempotente: usa CREATE TABLE IF NOT EXISTS, então rodar de novo não apaga
nem duplica nada (mas também não faz ALTER em tabela já existente).
"""

import os
import sys

import psycopg2

# Fallback só pra facilitar o dia a dia em desenvolvimento local — bate com
# o `docker run` que você usou (postgres/1234/riscoia na porta 5432).
# Setar a variável de ambiente DATABASE_URL sempre tem prioridade sobre isso;
# nunca deixe uma senha real "de verdade" hardcoded assim fora do seu ambiente local.
LOCAL_DEV_DEFAULT = "postgresql://postgres:1234@localhost:5432/riscoia"

SCHEMA_SQL = """
CREATE TABLE IF NOT EXISTS users (
    id_user     SERIAL PRIMARY KEY,
    name        VARCHAR(100)  NOT NULL,
    email       VARCHAR(150)  NOT NULL UNIQUE,
    password    VARCHAR(255)  NOT NULL,   -- hash (bcrypt/argon2), nunca texto puro
    role        VARCHAR(10)   NOT NULL DEFAULT 'user',   -- 'admin' | 'user'
    status      VARCHAR(10)   NOT NULL DEFAULT 'ativo',  -- 'ativo' | 'inativo'
    created_at  TIMESTAMP     NOT NULL DEFAULT now()
);
ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(10) NOT NULL DEFAULT 'user';
ALTER TABLE users ADD COLUMN IF NOT EXISTS status VARCHAR(10) NOT NULL DEFAULT 'ativo';

CREATE TABLE IF NOT EXISTS project (
    id_project  SERIAL PRIMARY KEY,
    id_user     INT           NOT NULL REFERENCES users(id_user) ON DELETE CASCADE,
    title       VARCHAR(255)  NOT NULL,
    abstract    TEXT,
    date        TIMESTAMP     NOT NULL DEFAULT now(),
    text        TEXT,                     -- texto extraído do PDF
    midia       BYTEA                     -- o PDF em si (ou use storage externo + guarde só a URL)
);
CREATE INDEX IF NOT EXISTS idx_project_user ON project(id_user);

-- Fusão de project_section + section: cada seção já carrega sua própria descrição.
CREATE TABLE IF NOT EXISTS project_section (
    id_project_section  SERIAL PRIMARY KEY,
    id_project          INT           NOT NULL REFERENCES project(id_project) ON DELETE CASCADE,
    description         VARCHAR(45),      -- ex.: "Cláusula 4", "Página 2"
    content             TEXT              -- trecho/conteúdo da seção
);
CREATE INDEX IF NOT EXISTS idx_project_section_project ON project_section(id_project);

CREATE TABLE IF NOT EXISTS risk (
    id_risk     SERIAL PRIMARY KEY,
    name        VARCHAR(100)  NOT NULL,
    description VARCHAR(255)  NOT NULL DEFAULT '',
    prompt      TEXT          NOT NULL,
    active      BOOLEAN       NOT NULL DEFAULT true,
    updated_at  TIMESTAMP     NOT NULL DEFAULT now(),
    updated_by  VARCHAR(100)  NOT NULL DEFAULT 'sistema',
    -- versões anteriores do prompt, sem sobrescrever: [{ "prompt": "...", "updated_at": "...", "updated_by": "..." }]
    history     JSONB         NOT NULL DEFAULT '[]'::jsonb
);
-- garante as colunas mesmo se a tabela já existia de uma versão anterior do schema
ALTER TABLE risk ADD COLUMN IF NOT EXISTS description VARCHAR(255) NOT NULL DEFAULT '';
ALTER TABLE risk ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE risk ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL DEFAULT now();
ALTER TABLE risk ADD COLUMN IF NOT EXISTS updated_by VARCHAR(100) NOT NULL DEFAULT 'sistema';
ALTER TABLE risk ADD COLUMN IF NOT EXISTS history JSONB NOT NULL DEFAULT '[]'::jsonb;

-- PK própria + created_at em vez da PK composta (id_risk, id_project_section)
-- do diagrama original: assim uma reanálise gera uma linha NOVA em vez de
-- sobrescrever a anterior (ver a demonstração de por que isso importa).
CREATE TABLE IF NOT EXISTS project_section_risk (
    id_project_section_risk  SERIAL PRIMARY KEY,
    id_risk                  INT           NOT NULL REFERENCES risk(id_risk) ON DELETE RESTRICT,
    id_project_section       INT           NOT NULL REFERENCES project_section(id_project_section) ON DELETE CASCADE,
    level                    DECIMAL(5,2)  NOT NULL,  -- score 0.00 a 100.00
    level_description        VARCHAR(10)   NOT NULL,  -- "baixo" | "medio" | "alto"
    output                   JSONB,                    -- { justificativa, trechos: [{citacao, pagina}] }
    analyzed_by              VARCHAR(100)  NOT NULL DEFAULT 'sistema',  -- quem disparou esta rodada (upload ou reanálise)
    created_at               TIMESTAMP     NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_psr_section ON project_section_risk(id_project_section);
CREATE INDEX IF NOT EXISTS idx_psr_risk ON project_section_risk(id_risk);
ALTER TABLE project_section_risk ADD COLUMN IF NOT EXISTS analyzed_by VARCHAR(100) NOT NULL DEFAULT 'sistema';

-- Migração para quem já rodou uma versão anterior deste schema com CASCADE:
-- troca pra RESTRICT, protegendo o histórico de análises contra exclusão em cascata
-- quando um risco é apagado.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'project_section_risk_id_risk_fkey'
          AND table_name = 'project_section_risk'
    ) THEN
        ALTER TABLE project_section_risk DROP CONSTRAINT project_section_risk_id_risk_fkey;
        ALTER TABLE project_section_risk
            ADD CONSTRAINT project_section_risk_id_risk_fkey
            FOREIGN KEY (id_risk) REFERENCES risk(id_risk) ON DELETE RESTRICT;
    END IF;
END $$;
"""


def get_database_url() -> str:
    url = os.environ.get("DATABASE_URL")
    if url:
        return url
    print(f"DATABASE_URL não definida — usando o padrão de dev local: {LOCAL_DEV_DEFAULT}")
    return LOCAL_DEV_DEFAULT


def main() -> None:
    database_url = get_database_url()

    print("Conectando ao banco...")
    conn = psycopg2.connect(database_url)
    conn.autocommit = True

    try:
        with conn.cursor() as cur:
            print("Aplicando schema (5 tabelas: users, project, project_section, risk, project_section_risk)...")
            cur.execute(SCHEMA_SQL)
        print("Pronto — schema criado/atualizado com sucesso.")
    except Exception as exc:  # noqa: BLE001 - queremos reportar qualquer erro de forma clara
        print(f"Erro ao aplicar o schema: {exc}", file=sys.stderr)
        sys.exit(1)
    finally:
        conn.close()


if __name__ == "__main__":
    main()
