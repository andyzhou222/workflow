from fastapi import Depends, HTTPException, Header, Security
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from .utils import create_access_token, decode_token, hash_password, verify_password
from .crud import get_user_by_username

security = HTTPBearer()

def authenticate_user(username: str, password: str):
    user = get_user_by_username(username)
    if not user:
        return None
    if not verify_password(password, user.password_hash):
        return None
    return user

def get_current_user(credentials: HTTPAuthorizationCredentials = Security(security)):
    token = credentials.credentials
    
    payload = decode_token(token)
    if not payload or "sub" not in payload:
        raise HTTPException(status_code=401, detail="Invalid token")
    
    username = payload["sub"]
    user = get_user_by_username(username)
    if not user or user.disabled:
        raise HTTPException(status_code=401, detail="User not found or disabled")
    return user
