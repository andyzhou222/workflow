import os
import uuid
import mimetypes
from io import BytesIO

import requests
from fastapi import UploadFile

from .config import (
    UPLOAD_FOLDER,
    SUPABASE_ENABLED,
    SUPABASE_URL,
    SUPABASE_SERVICE_KEY,
    SUPABASE_BUCKET,
    SUPABASE_UPLOAD_PREFIX,
    SUPABASE_TIMEOUT,
)

SUPABASE_SCHEME = "supabase://"
SUPABASE_OBJECT_BASE = f"{SUPABASE_URL}/storage/v1/object" if SUPABASE_ENABLED else None


def _normalize_destination(destination: str, fallback: str) -> str:
    name = destination or fallback or f"{uuid.uuid4().hex}"
    name = name.replace("\\", "/").lstrip("/")
    return name or f"{uuid.uuid4().hex}"


def _supabase_headers(extra: dict | None = None) -> dict:
    headers = {
        "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
        "apikey": SUPABASE_SERVICE_KEY,
    }
    if extra:
        headers.update(extra)
    return headers


def _supabase_object_path(name: str) -> str:
    prefix = SUPABASE_UPLOAD_PREFIX.strip("/")
    name = (name or "").lstrip("/")
    if prefix:
        return f"{prefix}/{name}" if name else prefix
    return name


def _strip_supabase_prefix(object_path: str) -> str:
    prefix = SUPABASE_UPLOAD_PREFIX.strip("/")
    if prefix and object_path.startswith(f"{prefix}/"):
        return object_path[len(prefix) + 1 :]
    return object_path


def _is_supabase_path(path: str | None) -> bool:
    return bool(path and path.startswith(SUPABASE_SCHEME))


def _extract_supabase_path(path: str) -> str:
    return path[len(SUPABASE_SCHEME) :]


def save_upload_file(upload_file: UploadFile, destination: str | None = None) -> str:
    """
    保存上传文件。
    - 如果配置了 Supabase，则上传到对象存储并返回 supabase:// 前缀的路径
    - 否则保存到本地 uploads 目录并返回本地绝对路径
    """
    upload_file.file.seek(0)
    normalized = _normalize_destination(destination, upload_file.filename)

    if SUPABASE_ENABLED:
        object_path = _supabase_object_path(normalized)
        url = f"{SUPABASE_OBJECT_BASE}/{SUPABASE_BUCKET}/{object_path}"
        content_type = upload_file.content_type or mimetypes.guess_type(object_path)[0] or "application/octet-stream"
        response = requests.post(
            url,
            data=upload_file.file.read(),
            headers=_supabase_headers(
                {
                    "Content-Type": content_type,
                    "x-upsert": "true",
                }
            ),
            timeout=SUPABASE_TIMEOUT,
        )
        if response.status_code not in (200, 201):
            raise RuntimeError(f"Supabase upload failed: {response.status_code} {response.text}")
        return f"{SUPABASE_SCHEME}{object_path}"

    # 本地模式
    if destination and os.path.isabs(destination):
        dest_path = destination
    else:
        dest_path = os.path.join(UPLOAD_FOLDER, normalized)
    os.makedirs(os.path.dirname(dest_path), exist_ok=True)
    with open(dest_path, "wb") as buffer:
        buffer.write(upload_file.file.read())
    return dest_path


def get_public_url(stored_path: str | None) -> str | None:
    """
    将存储路径转换为前端可访问的 URL。
    Supabase 模式返回 /api/uploads 路由，由后端代理读取私有文件。
    """
    if not stored_path:
        return None

    if _is_supabase_path(stored_path):
        object_path = _extract_supabase_path(stored_path)
        rel_path = _strip_supabase_prefix(object_path).lstrip("/")
        return f"/api/uploads/{rel_path}"

    if stored_path.startswith("/api/"):
        return stored_path

    if stored_path.startswith("http"):
        return stored_path

    # 本地绝对路径 -> 相对 uploads
    rel_path = stored_path
    if os.path.isabs(stored_path):
        try:
            rel_path = os.path.relpath(stored_path, UPLOAD_FOLDER)
        except ValueError:
            rel_path = os.path.basename(stored_path)
    rel_path = rel_path.replace(os.sep, "/").lstrip("/")
    return f"/api/uploads/{rel_path}"


def open_file_stream(stored_path: str):
    """
    返回 (file_like, content_type) 供 FastAPI StreamingResponse 使用。
    支持 Supabase (私有) 和本地文件。
    """
    if not stored_path:
        raise FileNotFoundError("empty path")

    if SUPABASE_ENABLED:
        object_path = None
        if _is_supabase_path(stored_path):
            object_path = _extract_supabase_path(stored_path)
        elif not os.path.isabs(stored_path):
            object_path = _supabase_object_path(stored_path)
        if object_path:
            url = f"{SUPABASE_OBJECT_BASE}/{SUPABASE_BUCKET}/{object_path}"
            response = requests.get(url, headers=_supabase_headers(), timeout=SUPABASE_TIMEOUT)
            if response.status_code == 200:
                content_type = response.headers.get("Content-Type") or mimetypes.guess_type(object_path)[0] or "application/octet-stream"
                return BytesIO(response.content), content_type
            if _is_supabase_path(stored_path):
                raise FileNotFoundError(f"Supabase object not found: {object_path}")

    # 本地
    path = stored_path
    if not os.path.isabs(path):
        path = os.path.join(UPLOAD_FOLDER, path)
    if not os.path.exists(path):
        raise FileNotFoundError(path)
    content_type = mimetypes.guess_type(path)[0] or "application/octet-stream"
    return open(path, "rb"), content_type


def delete_file(stored_path: str | None):
    if not stored_path:
        return
    if SUPABASE_ENABLED:
        object_path = None
        if _is_supabase_path(stored_path):
            object_path = _extract_supabase_path(stored_path)
        elif not os.path.isabs(stored_path):
            object_path = _supabase_object_path(stored_path)
        if object_path:
            url = f"{SUPABASE_OBJECT_BASE}/{SUPABASE_BUCKET}/{object_path}"
            try:
                requests.delete(url, headers=_supabase_headers(), timeout=SUPABASE_TIMEOUT)
            except Exception as exc:
                print(f"[storage] failed to delete Supabase object {object_path}: {exc}")
            return

    path = stored_path
    if not os.path.isabs(path):
        path = os.path.join(UPLOAD_FOLDER, path)
    if os.path.exists(path):
        try:
            os.remove(path)
        except Exception as exc:
            print(f"[storage] failed to delete local file {path}: {exc}")
