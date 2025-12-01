import os
BASE_DIR = os.path.dirname(os.path.dirname(__file__))

# 数据库文件路径配置
# 优先使用环境变量 WF_DB，如果没有设置，则使用默认路径
# 在 Render 等云平台上，建议设置 WF_DB 环境变量指向持久化存储路径
# 例如：/opt/render/project/src/workflow.sqlite 或 /tmp/workflow.sqlite
DB_FILE = os.getenv("WF_DB", os.path.join(BASE_DIR, "workflow.sqlite"))

# 确保数据库文件所在目录存在
db_dir = os.path.dirname(DB_FILE)
if db_dir and not os.path.exists(db_dir):
    os.makedirs(db_dir, exist_ok=True)

# 打印数据库路径（用于调试和确认配置）
print(f"[Database Config] Database file path: {DB_FILE}")
print(f"[Database Config] Database directory exists: {os.path.exists(db_dir)}")

SECRET_KEY = os.getenv("WF_SECRET", "change_this_secret_for_prod")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", 480))
UPLOAD_FOLDER = os.path.join(BASE_DIR, "..", "uploads")
if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER, exist_ok=True)
