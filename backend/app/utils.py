from passlib.context import CryptContext
from datetime import datetime, timedelta, timezone
from jose import jwt
from typing import Optional
from .config import SECRET_KEY, ACCESS_TOKEN_EXPIRE_MINUTES

# 初始化密码上下文，确保 bcrypt 后端可用
try:
    pwd_context = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")
except Exception as e:
    raise RuntimeError(f"Failed to initialize bcrypt context: {e}. Please ensure bcrypt is installed: pip install bcrypt")

def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(password: str, password_hash: str) -> bool:
    return pwd_context.verify(password, password_hash)

def create_access_token(subject: str, expires_minutes: Optional[int] = None):
    expire = datetime.now(timezone(timedelta(hours=8))) + timedelta(minutes=(expires_minutes or ACCESS_TOKEN_EXPIRE_MINUTES))
    payload = {"sub": subject, "exp": expire}
    token = jwt.encode(payload, SECRET_KEY, algorithm="HS256")
    return token

def decode_token(token: str):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
        return payload
    except Exception as e:
        print(f"Token decode error: {e}")
        return None
