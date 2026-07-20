"""
Popula a tabela `risk` com os 23 riscos cadastrados em `riscos.json`.

Uso:
    pip install psycopg2-binary
    export DATABASE_URL="postgresql://usuario:senha@host:5432/nome_do_banco"
    python seed_risks.py
"""

import json
import os
import sys
import psycopg2

LOCAL_DEV_DEFAULT = "postgresql://postgres:1234@localhost:5432/riscoia"
JSON_PATH = os.path.join(os.path.dirname(__file__), "seed-data", "riscos.json")

def get_database_url() -> str:
    url = os.environ.get("DATABASE_URL")
    if url:
        return url
    print(f"DATABASE_URL não definida — usando o padrão de dev local: {LOCAL_DEV_DEFAULT}")
    return LOCAL_DEV_DEFAULT

def main() -> None:
    database_url = get_database_url()

    if not os.path.exists(JSON_PATH):
        print(f"Erro: O arquivo de riscos não foi encontrado em: {JSON_PATH}", file=sys.stderr)
        sys.exit(1)

    print(f"Carregando riscos de {JSON_PATH}...")
    with open(JSON_PATH, "r", encoding="utf-8") as f:
        risks_data = json.load(f)

    print(f"Conectando ao banco de dados para inserir {len(risks_data)} riscos...")
    conn = psycopg2.connect(database_url)
    conn.autocommit = True

    inserted_count = 0
    updated_count = 0

    try:
        with conn.cursor() as cur:
            for item in risks_data:
                name = item.get("nome_risco")
                description = item.get("descricao", "")
                prompt = item.get("prompt")

                if not name or not prompt:
                    print(f"Aviso: Pulando item inválido (sem nome ou prompt): {item}")
                    continue

                # Verifica se o risco já existe pelo nome
                cur.execute("SELECT id_risk, prompt, description FROM risk WHERE name = %s", (name,))
                row = cur.fetchone()

                if row:
                    # Risco já existe, atualiza as informações caso tenham mudado
                    id_risk, old_prompt, old_desc = row
                    if old_prompt != prompt or old_desc != description:
                        cur.execute(
                            """
                            UPDATE risk
                            SET description = %s, prompt = %s, updated_at = now(), updated_by = 'seed'
                            WHERE id_risk = %s
                            """,
                            (description, prompt, id_risk)
                        )
                        updated_count += 1
                else:
                    # Risco não existe, insere um novo
                    cur.execute(
                        """
                        INSERT INTO risk (name, description, prompt, active, updated_by)
                        VALUES (%s, %s, %s, true, 'seed')
                        """,
                        (name, description, prompt)
                    )
                    inserted_count += 1

        print(f"Sucesso! {inserted_count} riscos inseridos, {updated_count} riscos atualizados.")
    except Exception as exc:
        print(f"Erro ao popular os riscos no banco: {exc}", file=sys.stderr)
        sys.exit(1)
    finally:
        conn.close()

if __name__ == "__main__":
    main()
