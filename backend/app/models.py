from typing import Optional, Dict, Any
from datetime import datetime, timezone, timedelta
from sqlmodel import SQLModel, Field
from sqlalchemy import JSON
import uuid

def gen_uuid():
    return str(uuid.uuid4())

def local_now():
    """返回中国时区 (UTC+8) 的当前时间"""
    tz = timezone(timedelta(hours=8))
    return datetime.now(tz)

class User(SQLModel, table=True):
    id: Optional[str] = Field(default_factory=gen_uuid, primary_key=True)
    username: str = Field(index=True, nullable=False, unique=True)
    password_hash: str
    display_name: Optional[str] = None
    role: Optional[str] = "user"
    department: Optional[str] = None
    title: Optional[str] = None  # 职称
    avatar: Optional[str] = None  # 头像URL
    disabled: bool = False
    created_at: datetime = Field(default_factory=local_now)

class Department(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str
    parent_id: Optional[int] = None

class ProcessTemplate(SQLModel, table=True):
    id: Optional[str] = Field(default_factory=gen_uuid, primary_key=True)
    name: str
    definition: Dict[str, Any] = Field(sa_type=JSON)
    created_by: Optional[str] = None
    created_at: datetime = Field(default_factory=local_now)

class ProcessInstance(SQLModel, table=True):
    id: Optional[str] = Field(default_factory=gen_uuid, primary_key=True)
    template_id: str
    data: Dict[str, Any] = Field(default_factory=dict, sa_type=JSON)
    status: str = "running"
    current_node: Optional[str] = None
    started_by: Optional[str] = None
    started_at: datetime = Field(default_factory=local_now)
    ended_at: Optional[datetime] = None

class Task(SQLModel, table=True):
    id: Optional[str] = Field(default_factory=gen_uuid, primary_key=True)
    instance_id: str
    node_id: str
    assignee: Optional[str] = None
    status: str = "pending"
    opinion: Optional[str] = None
    assigned_at: datetime = Field(default_factory=local_now)
    finished_at: Optional[datetime] = None

class Document(SQLModel, table=True):
    id: Optional[str] = Field(default_factory=gen_uuid, primary_key=True)
    title: str
    filename: str
    version: int = 1
    status: str = "draft"
    uploaded_by: Optional[str] = None
    uploaded_at: datetime = Field(default_factory=datetime.utcnow)

class AuditLog(SQLModel, table=True):
    id: Optional[str] = Field(default_factory=gen_uuid, primary_key=True)
    user: Optional[str] = None
    action: str = ""
    detail: Dict[str, Any] = Field(default_factory=dict, sa_type=JSON)
    at: datetime = Field(default_factory=datetime.utcnow)
