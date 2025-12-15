import os
BASE_DIR = os.path.dirname(os.path.dirname(__file__))

# 数据库配置
# 优先使用 DATABASE_URL（PostgreSQL），如果没有则使用 SQLite
# 免费方案：使用 Supabase、Railway 或 Neon 提供的免费 PostgreSQL
DATABASE_URL = os.getenv("DATABASE_URL")

# SQLite 配置（本地开发或备用）
DB_FILE = os.getenv("WF_DB", os.path.join(BASE_DIR, "workflow.sqlite"))

# 确保 SQLite 数据库文件所在目录存在
if not DATABASE_URL:
    db_dir = os.path.dirname(DB_FILE)
    if db_dir and not os.path.exists(db_dir):
        os.makedirs(db_dir, exist_ok=True)
    print(f"[Database Config] Using SQLite: {DB_FILE}")
    print(f"[Database Config] Database directory exists: {os.path.exists(db_dir)}")
else:
    print(f"[Database Config] Using PostgreSQL: {DATABASE_URL.split('@')[1] if '@' in DATABASE_URL else 'configured'}")

SECRET_KEY = os.getenv("WF_SECRET", "change_this_secret_for_prod")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", 480))
UPLOAD_FOLDER = os.path.join(BASE_DIR, "..", "uploads")
if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER, exist_ok=True)
