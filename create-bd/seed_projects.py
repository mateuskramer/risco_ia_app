"""
Popula a tabela `project` com os 5 PDFs de exemplo cadastrados em `seed-data`.
Se não houver nenhum usuário cadastrado no sistema, cria um usuário admin padrão
(admin@empresa.com / senha: admin123) para vincular os projetos.

Uso:
    pip install psycopg2-binary pypdf
    export DATABASE_URL="postgresql://usuario:senha@host:5432/nome_do_banco"
    python seed_projects.py
"""

import os
import sys
import subprocess

# Auto-instala pypdf se não estiver instalado para conveniência
try:
    from pypdf import PdfReader
except ImportError:
    print("pypdf não instalado. Instalando...")
    subprocess.check_call([sys.executable, "-m", "pip", "install", "pypdf"])
    from pypdf import PdfReader

import psycopg2

LOCAL_DEV_DEFAULT = "postgresql://postgres:1234@localhost:5432/riscoia"
SEED_DATA_DIR = os.path.join(os.path.dirname(__file__), "seed-data")

ADMIN_PASSWORD_HASH = "$2b$12$gU8jLTp2L2.o/LqDlWxfX.3gWokZKhL8qxP1PgXkWlC/W8McsvHgq"

def get_database_url() -> str:
    url = os.environ.get("DATABASE_URL")
    if url:
        return url
    print(f"DATABASE_URL não definida — usando o padrão de dev local: {LOCAL_DEV_DEFAULT}")
    return LOCAL_DEV_DEFAULT

def extract_text_from_pdf(pdf_path: str) -> str:
    print(f"Extraindo texto de {os.path.basename(pdf_path)}...")
    reader = PdfReader(pdf_path)
    text_parts = []
    for i, page in enumerate(reader.pages):
        page_text = page.extract_text()
        if page_text:
            text_parts.append(page_text)
    return "\n\n".join(text_parts)

def main() -> None:
    database_url = get_database_url()

    if not os.path.exists(SEED_DATA_DIR):
        print(f"Erro: Pasta de sementes não encontrada em: {SEED_DATA_DIR}", file=sys.stderr)
        sys.exit(1)

    # Coleta todos os PDFs da pasta
    pdf_files = [f for f in os.listdir(SEED_DATA_DIR) if f.lower().endswith(".pdf")]
    if not pdf_files:
        print(f"Nenhum arquivo PDF encontrado na pasta: {SEED_DATA_DIR}")
        sys.exit(0)

    print(f"Conectando ao banco de dados...")
    conn = psycopg2.connect(database_url)
    conn.autocommit = True

    try:
        with conn.cursor() as cur:
            # 1. Garante que exista pelo menos um usuário
            cur.execute("SELECT id_user FROM users LIMIT 1")
            user_row = cur.fetchone()

            if user_row:
                user_id = user_row[0]
                print(f"Usando usuário existente (ID: {user_id}) para vincular os projetos.")
            else:
                # Cria usuário admin padrão
                print("Nenhum usuário encontrado na tabela 'users'. Criando administrador padrão...")
                cur.execute(
                    """
                    INSERT INTO users (name, email, password, role, status)
                    VALUES (%s, %s, %s, %s, %s)
                    RETURNING id_user
                    """,
                    ("Administrador", "admin@empresa.com", ADMIN_PASSWORD_HASH, "admin", "ativo")
                )
                user_id = cur.fetchone()[0]
                print(f"Usuário admin criado com sucesso (E-mail: admin@empresa.com / Senha: admin123). ID: {user_id}")

            # 2. Processa cada PDF
            inserted_count = 0
            skipped_count = 0

            for filename in pdf_files:
                pdf_path = os.path.join(SEED_DATA_DIR, filename)

                # Verifica se o projeto com esse título já existe
                cur.execute("SELECT id_project FROM project WHERE title = %s", (filename,))
                project_row = cur.fetchone()

                if project_row:
                    print(f"Projeto '{filename}' já está cadastrado no banco. Pulando.")
                    skipped_count += 1
                    continue

                # Extrai texto do PDF
                text = extract_text_from_pdf(pdf_path)

                # Lê os bytes do PDF (salvo na coluna BYTEA 'midia')
                with open(pdf_path, "rb") as pdf_file:
                    pdf_bytes = pdf_file.read()

                # Insere o projeto
                cur.execute(
                    """
                    INSERT INTO project (id_user, title, text, midia)
                    VALUES (%s, %s, %s, %s)
                    RETURNING id_project
                    """,
                    (user_id, filename, text, psycopg2.Binary(pdf_bytes))
                )
                project_id = cur.fetchone()[0]

                # Insere a seção padrão
                cur.execute(
                    """
                    INSERT INTO project_section (id_project, description, content)
                    VALUES (%s, %s, %s)
                    """,
                    (project_id, "Documento completo", text)
                )

                print(f"Projeto '{filename}' cadastrado com sucesso! ID: {project_id}")
                inserted_count += 1

            print(f"\nConcluído! {inserted_count} projetos inseridos, {skipped_count} projetos pulados.")

    except Exception as exc:
        print(f"Erro ao popular projetos no banco: {exc}", file=sys.stderr)
        sys.exit(1)
    finally:
        conn.close()

if __name__ == "__main__":
    main()
