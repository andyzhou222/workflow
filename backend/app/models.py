from typing import Optional, Dict, Any, List
from datetime import datetime, timezone, timedelta, date
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
    priority: Optional[str] = None  # 优先级：低/中/高/紧急
    labels: List[str] = Field(default_factory=list, sa_type=JSON)  # 标签
    module_id: Optional[str] = None  # 关联模块
    estimate_hours: Optional[float] = None  # 预估工时
    due_date: Optional[date] = None  # 截止日期

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


class Module(SQLModel, table=True):
    id: Optional[str] = Field(default_factory=gen_uuid, primary_key=True)
    name: str
    description: Optional[str] = None
    created_by: Optional[str] = None
    created_at: datetime = Field(default_factory=local_now)


class Cycle(SQLModel, table=True):
    id: Optional[str] = Field(default_factory=gen_uuid, primary_key=True)
    name: str
    start_date: date
    end_date: date
    goal: Optional[str] = None
    created_by: Optional[str] = None
    created_at: datetime = Field(default_factory=local_now)


class CycleTask(SQLModel, table=True):
    cycle_id: str = Field(primary_key=True)
    task_id: str = Field(primary_key=True)


class SavedView(SQLModel, table=True):
    id: Optional[str] = Field(default_factory=gen_uuid, primary_key=True)
    name: str
    owner: str  # username
    filters: Dict[str, Any] = Field(default_factory=dict, sa_type=JSON)
    created_at: datetime = Field(default_factory=local_now)
