import os
BASE_DIR = os.path.dirname(os.path.dirname(__file__))
DB_FILE = os.getenv("WF_DB", os.path.join(BASE_DIR, "workflow.sqlite"))
SECRET_KEY = os.getenv("WF_SECRET", "change_this_secret_for_prod")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", 480))
UPLOAD_FOLDER = os.path.join(BASE_DIR, "..", "uploads")
if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER, exist_ok=True)
