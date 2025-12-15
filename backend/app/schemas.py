from pydantic import BaseModel, EmailStr
from typing import Optional, Dict, Any, List
from datetime import date

class UserCreate(BaseModel):
    username: str
    password: str
    display_name: Optional[str] = None
    role: Optional[str] = "user"
    department: Optional[str] = None

class UserRegister(BaseModel):
    username: str
    password: str
    display_name: Optional[str] = None
    email: Optional[str] = None

class PasswordReset(BaseModel):
    username: str

class UserUpdate(BaseModel):
    username: Optional[str] = None
    display_name: Optional[str] = None
    department: Optional[str] = None
    title: Optional[str] = None
    avatar: Optional[str] = None
    role: Optional[str] = None  # 添加角色字段

class PasswordChange(BaseModel):
    old_password: str
    new_password: str

class TemplateCreate(BaseModel):
    name: str
    definition: Dict[str, Any]

class StartInstance(BaseModel):
    template_id: str
    data: Optional[Dict[str, Any]] = {}
    old_instance_id: Optional[str] = None

class CompleteTask(BaseModel):
    decision: str
    opinion: Optional[str] = None

class InstanceFilter(BaseModel):
    status: Optional[str] = None

class InstanceSummary(BaseModel):
    id: str
    template_id: str
    template_name: Optional[str] = None
    title: Optional[str] = None
    status: str
    current_node: Optional[str] = None
    current_assignee: Optional[str] = None
    started_by: Optional[str] = None
    started_at: Optional[str] = None
    ended_at: Optional[str] = None
    data: Optional[Dict[str, Any]] = None

class TaskHistory(BaseModel):
    id: str
    node_id: str
    assignee: Optional[str]
    status: str
    opinion: Optional[str]
    assigned_at: Optional[str]
    finished_at: Optional[str]

class InstanceDetail(InstanceSummary):
    template_definition: Optional[Dict[str, Any]] = None
    history: List[TaskHistory] = []


# --- Task 元数据 ---
class TaskMetaUpdate(BaseModel):
    priority: Optional[str] = None  # 低/中/高/紧急（中文）
    labels: Optional[List[str]] = None
    module_id: Optional[str] = None
    estimate_hours: Optional[float] = None
    due_date: Optional[date] = None


# --- 模块 ---
class ModuleCreate(BaseModel):
    name: str
    description: Optional[str] = None


# --- 迭代 ---
class CycleCreate(BaseModel):
    name: str
    start_date: date
    end_date: date
    goal: Optional[str] = None

class CycleTaskAssign(BaseModel):
    task_id: str


# --- 保存视图 ---
class SavedViewCreate(BaseModel):
    name: str
    filters: Dict[str, Any] = {}
