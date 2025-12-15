from datetime import datetime, timezone, timedelta
from sqlmodel import Session, select, create_engine
from sqlalchemy import text, func
from typing import Optional
from .models import *
from .utils import hash_password
from .config import DATABASE_URL, DB_FILE

LOCAL_TZ = datetime.now().astimezone().tzinfo
IS_POSTGRES = DATABASE_URL is not None


def to_local(dt: Optional[datetime]):
    """将数据库中的时间转换为系统本地时区"""
    if not dt:
        return None
    if dt.tzinfo:
        try:
            return dt.astimezone(LOCAL_TZ) if LOCAL_TZ else dt.astimezone()
        except Exception:
            return dt
    if IS_POSTGRES and LOCAL_TZ:
        return dt.replace(tzinfo=timezone.utc).astimezone(LOCAL_TZ)
    return dt

# 支持 PostgreSQL 和 SQLite
# 如果设置了 DATABASE_URL（PostgreSQL），使用 PostgreSQL
# 否则使用 SQLite（本地开发）
if DATABASE_URL:
    # PostgreSQL 连接
    # 处理 Render 等平台的连接字符串格式
    db_url = DATABASE_URL
    # 如果连接字符串是 postgres:// 开头，需要改为 postgresql://
    if db_url.startswith("postgres://"):
        db_url = db_url.replace("postgres://", "postgresql://", 1)
    # 使用连接池配置，支持 IPv4 网络
    engine = create_engine(
        db_url, 
        echo=False, 
        pool_pre_ping=True, 
        pool_recycle=300,
        connect_args={
            "connect_timeout": 10,
            "sslmode": "require"  # Supabase 需要 SSL
        }
    )
else:
    # SQLite 连接（本地开发）
    engine = create_engine(
        f"sqlite:///{DB_FILE}",
        echo=False,
        connect_args={"check_same_thread": False},
    )

def init_db():
    SQLModel.metadata.create_all(engine)
    
    # 检查并添加新列（用于现有数据库的迁移）
    # 只对 SQLite 执行，PostgreSQL 使用信息模式检查
    if not IS_POSTGRES:
        with Session(engine) as s:
            try:
                def has_column(table: str, col: str):
                    result = s.exec(text(f"PRAGMA table_info({table})"))
                    return col in [row[1] for row in result]

                if not has_column("user", "title"):
                    s.exec(text("ALTER TABLE user ADD COLUMN title TEXT"))
                    s.commit()
                    print("Added 'title' column to user table")
                
                if not has_column("user", "avatar"):
                    s.exec(text("ALTER TABLE user ADD COLUMN avatar TEXT"))
                    s.commit()
                    print("Added 'avatar' column to user table")

                # Task 新增列
                task_new_columns = [
                    ("priority", "TEXT"),
                    ("labels", "TEXT"),  # JSON 以 TEXT 形式存储
                    ("module_id", "TEXT"),
                    ("estimate_hours", "REAL"),
                    ("due_date", "DATE"),
                ]
                for col, col_type in task_new_columns:
                    if not has_column("task", col):
                        s.exec(text(f"ALTER TABLE task ADD COLUMN {col} {col_type}"))
                        s.commit()
                        print(f"Added '{col}' column to task table")
            except Exception as e:
                print(f"Migration check error (may be normal for new DB): {e}")
                s.rollback()
    else:
        with Session(engine) as s:
            try:
                def has_column_pg(table: str, col: str):
                    result = s.exec(text(f"""
                        SELECT column_name 
                        FROM information_schema.columns 
                        WHERE table_name='{table}' AND column_name='{col}'
                    """))
                    return result.first() is not None

                if not has_column_pg("user", "title"):
                    s.exec(text("ALTER TABLE \"user\" ADD COLUMN title TEXT"))
                    s.commit()
                    print("Added 'title' column to user table")
                
                if not has_column_pg("user", "avatar"):
                    s.exec(text("ALTER TABLE \"user\" ADD COLUMN avatar TEXT"))
                    s.commit()
                    print("Added 'avatar' column to user table")

                task_new_columns = [
                    ("priority", "TEXT"),
                    ("labels", "JSONB"),
                    ("module_id", "TEXT"),
                    ("estimate_hours", "REAL"),
                    ("due_date", "DATE"),
                ]
                for col, col_type in task_new_columns:
                    if not has_column_pg("task", col):
                        s.exec(text(f"ALTER TABLE \"task\" ADD COLUMN {col} {col_type}"))
                        s.commit()
                        print(f"Added '{col}' column to task table")
            except Exception as e:
                print(f"PostgreSQL migration check error (may be normal for new DB): {e}")
                s.rollback()
    
    # 创建默认管理员账户
    with Session(engine) as s:
        q = s.exec(select(User).where(User.username == "admin")).first()
        if not q:
            admin = User(username="admin", password_hash=hash_password("admin123"), display_name="系统管理员", role="admin")
            s.add(admin); s.commit()

def get_user_by_username(username: str):
    with Session(engine) as s:
        return s.exec(select(User).where(User.username == username)).first()

def create_user(username: str, password_hash: str, display_name: str = None, role: str = "user", department: str = None):
    with Session(engine) as s:
        user = User(username=username, password_hash=password_hash, display_name=display_name, role=role, department=department)
        s.add(user); s.commit(); s.refresh(user)
        return user

def create_template(name: str, definition: dict, created_by: str):
    with Session(engine) as s:
        tpl = ProcessTemplate(name=name, definition=definition, created_by=created_by)
        s.add(tpl); s.commit(); s.refresh(tpl)
        return tpl

def list_templates():
    with Session(engine) as s:
        return s.exec(select(ProcessTemplate)).all()

def get_template(tid: str):
    with Session(engine) as s:
        return s.get(ProcessTemplate, tid)

def create_instance(template_id: str, data: dict, started_by: str, old_instance_id: Optional[str] = None):
    from datetime import datetime, timezone, timedelta
    # 使用中国时区 (UTC+8)
    local_now = datetime.now().astimezone()
    
    with Session(engine, expire_on_commit=False) as s:
        # 如果是重新提交，将旧实例的相关任务标记为已完成，并更新实例状态
        if old_instance_id:
            old_inst = s.get(ProcessInstance, old_instance_id)
            if old_inst and old_inst.started_by == started_by:
                # 将旧实例的所有待办任务标记为已完成
                old_tasks = s.exec(
                    select(Task).where(Task.instance_id == old_instance_id, Task.status == "pending")
                ).all()
                for old_task in old_tasks:
                    old_task.status = "approved"
                    old_task.finished_at = local_now
                    old_task.opinion = "已重新提交，任务自动完成"
                    s.add(old_task)
                # 将旧实例标记为已结束（避免出现在待办中）
                old_inst.status = "approved"
                old_inst.ended_at = local_now
                s.add(old_inst)
                s.commit()
        
        tpl = s.get(ProcessTemplate, template_id)
        if not tpl:
            raise ValueError("template not found")
        defn = tpl.definition
        start_node = next((n for n in defn.get("nodes", []) if n.get("type") == "start"), None)
        if not start_node:
            raise ValueError("no start node")
        nexts = [e['to'] for e in defn.get("edges", []) if e['from'] == start_node['id']]
        if not nexts:
            raise ValueError("no edge from start")
        first_node_id = nexts[0]
        inst = ProcessInstance(template_id=template_id, data=data or {}, current_node=first_node_id, started_by=started_by)
        s.add(inst); s.commit(); s.refresh(inst)
        node = next((n for n in defn.get("nodes", []) if n['id'] == first_node_id), None)
        assignee = node.get('meta', {}).get('assignee')
        priority = (data or {}).get("priority")
        t = Task(instance_id=inst.id, node_id=first_node_id, assignee=assignee, priority=priority)
        s.add(t); s.commit(); s.refresh(t)
        return inst, t

def get_tasks_for_user(username: str):
    with Session(engine) as s:
        # 只查询状态为 pending 的任务
        tasks = s.exec(select(Task).where(Task.assignee == username, Task.status == "pending")).all()
        results = []
        for task in tasks:
            inst = s.get(ProcessInstance, task.instance_id)
            # 排除已驳回和已结束的流程任务
            if inst and inst.status not in ["rejected", "approved"]:
                # 获取模板定义以获取节点名称
                tpl = s.get(ProcessTemplate, inst.template_id)
                node_name = task.node_id  # 默认使用 node_id
                if tpl and tpl.definition:
                    node = next((n for n in tpl.definition.get("nodes", []) if n.get("id") == task.node_id), None)
                    if node and node.get("meta", {}).get("name"):
                        node_name = node.get("meta", {}).get("name")
                
                results.append({
                    "id": task.id,
                    "instance_id": task.instance_id,
                    "node_id": task.node_id,
                    "node_name": node_name,
                    "assignee": task.assignee,
                    "status": task.status,
                    "opinion": task.opinion,
                    "assigned_at": task.assigned_at.isoformat() if task.assigned_at else None,
                    "finished_at": task.finished_at.isoformat() if task.finished_at else None,
                    "priority": task.priority,
                    "labels": task.labels or [],
                    "module_id": task.module_id,
                    "estimate_hours": task.estimate_hours,
                    "due_date": task.due_date.isoformat() if task.due_date else None,
                    "data": inst.data if inst else {},
                    "instance": {
                        "id": inst.id,
                        "started_by": inst.started_by,
                        "status": inst.status,
                        "current_node": inst.current_node,
                    } if inst else None,
                })
        return results

def get_task(tid: str):
    with Session(engine) as s:
        return s.get(Task, tid)

def list_all_tasks_admin():
    """管理员视角查看所有任务（含已完成/驳回），用于分配到迭代"""
    with Session(engine) as s:
        tasks = s.exec(select(Task)).all()
        results = []
        for task in tasks:
            inst = s.get(ProcessInstance, task.instance_id)
            tpl = s.get(ProcessTemplate, inst.template_id) if inst else None
            node_name = task.node_id
            if tpl and tpl.definition:
                node = next((n for n in tpl.definition.get("nodes", []) if n.get("id") == task.node_id), None)
                if node and node.get("meta", {}).get("name"):
                    node_name = node.get("meta", {}).get("name")
            results.append({
                "id": task.id,
                "instance_id": task.instance_id,
                "node_id": task.node_id,
                "node_name": node_name,
                "assignee": task.assignee,
                "status": task.status,
                "priority": task.priority,
                "labels": task.labels or [],
                "module_id": task.module_id,
                "estimate_hours": task.estimate_hours,
                "due_date": task.due_date.isoformat() if task.due_date else None,
                "assigned_at": task.assigned_at.isoformat() if task.assigned_at else None,
                "finished_at": task.finished_at.isoformat() if task.finished_at else None,
                "instance_title": inst.data.get("title") if inst and inst.data else None,
                "instance_status": inst.status if inst else None,
                "template_name": tpl.name if tpl else None,
            })
        return results

def complete_task(task_id: str, username: str, decision: str, opinion: str = None):
    from datetime import datetime, timezone, timedelta
    # 使用中国时区 (UTC+8)
    local_now = datetime.now().astimezone()
    with Session(engine) as s:
        task = s.get(Task, task_id)
        if not task:
            raise ValueError("task not found")
        if task.assignee != username:
            raise PermissionError("not assignee")
        if task.status != "pending":
            raise ValueError("task not pending")
        task.status = "approved" if decision == "approve" else "rejected"
        task.opinion = opinion
        task.finished_at = local_now
        s.add(task)
        inst = s.get(ProcessInstance, task.instance_id)
        tpl = s.get(ProcessTemplate, inst.template_id)
        defn = tpl.definition
        curr_node = next((n for n in defn.get("nodes", []) if n['id'] == task.node_id), None)
        nexts = [e['to'] for e in defn.get("edges", []) if e['from'] == curr_node['id']]
        if decision == "reject" or not nexts:
            inst.status = "rejected" if decision == "reject" else "approved"
            inst.current_node = None
            inst.ended_at = local_now
            s.add(inst); s.commit()
            return task, inst, None
        next_node_id = nexts[0]
        next_node = next((n for n in defn.get("nodes", []) if n['id'] == next_node_id), None)
        if next_node and next_node.get("type") == "end":
            inst.status = "approved"
            inst.current_node = None
            inst.ended_at = local_now
            s.add(inst); s.commit()
            return task, inst, None
        inst.current_node = next_node_id
        s.add(inst); s.commit()
        assignee = next_node.get('meta', {}).get('assignee') if next_node else None
        priority = inst.data.get("priority") if inst and inst.data else None
        new_task = Task(instance_id=inst.id, node_id=next_node_id, assignee=assignee, priority=priority)
        s.add(new_task); s.commit(); s.refresh(new_task)
        return task, inst, new_task

def save_document(title: str, filename: str, uploaded_by: str):
    with Session(engine) as s:
        doc = Document(title=title, filename=filename, uploaded_by=uploaded_by)
        s.add(doc); s.commit(); s.refresh(doc)
        return doc

def list_documents():
    with Session(engine) as s:
        return s.exec(select(Document)).all()

def get_document(doc_id: str):
    with Session(engine) as s:
        return s.get(Document, doc_id)

def publish_document(doc_id: str):
    with Session(engine) as s:
        doc = s.get(Document, doc_id)
        if not doc:
            raise ValueError("doc not found")
        doc.status = "published"
        doc.version += 1
        s.add(doc); s.commit(); s.refresh(doc)
        return doc

def write_audit(user: str, action: str, detail: dict):
    try:
        with Session(engine) as s:
            log = AuditLog(user=user, action=action, detail=detail or {})
            s.add(log)
        s.commit()
    except Exception as e:
        # 审计日志失败不应该影响主流程
        print(f"Audit log error: {str(e)}")

def delete_template(template_id: str):
    with Session(engine) as s:
        tpl = s.get(ProcessTemplate, template_id)
        if not tpl:
            raise ValueError("模板不存在")
        s.delete(tpl)
        s.commit()


# --------------------------
# 模块（Module）
# --------------------------
def create_module(name: str, description: str, creator: str):
    with Session(engine) as s:
        m = Module(name=name, description=description, created_by=creator)
        s.add(m); s.commit(); s.refresh(m)
        return m

def update_module(module_id: str, name: str = None, description: str = None):
    with Session(engine) as s:
        m = s.get(Module, module_id)
        if not m:
            raise ValueError("模块不存在")
        if name is not None:
            m.name = name
        if description is not None:
            m.description = description
        s.add(m); s.commit(); s.refresh(m)
        return m

def delete_module(module_id: str):
    with Session(engine) as s:
        m = s.get(Module, module_id)
        if not m:
            raise ValueError("模块不存在")
        s.delete(m); s.commit()

def list_modules(role: str, username: str):
    """管理员/公司管理员/部门管理员可见；普通用户暂不返回。"""
    if role not in ("admin", "company_admin", "dept_admin"):
        return []
    with Session(engine) as s:
        return s.exec(select(Module).order_by(Module.created_at.desc())).all()


# --------------------------
# 任务元数据
# --------------------------
def update_task_meta(task_id: str, priority: str = None, labels = None, module_id: str = None, estimate_hours: float = None, due_date = None):
    with Session(engine) as s:
        task = s.get(Task, task_id)
        if not task:
            raise ValueError("任务不存在")
        if priority is not None:
            task.priority = priority
        if labels is not None:
            # labels 允许字符串数组
            task.labels = labels
        if module_id is not None:
            task.module_id = module_id
        if estimate_hours is not None:
            task.estimate_hours = estimate_hours
        if due_date is not None:
            task.due_date = due_date
        s.add(task); s.commit(); s.refresh(task)
        return task


# --------------------------
# 迭代（Cycle）
# --------------------------
def create_cycle(name: str, start_date, end_date, goal: str, creator: str):
    with Session(engine) as s:
        c = Cycle(name=name, start_date=start_date, end_date=end_date, goal=goal, created_by=creator)
        s.add(c); s.commit(); s.refresh(c)
        return c

def list_cycles(role: str, username: str):
    """管理员/公司管理员/部门管理员可见"""
    if role not in ("admin", "company_admin", "dept_admin"):
        return []
    with Session(engine) as s:
        return s.exec(select(Cycle).order_by(Cycle.start_date.desc())).all()

def assign_task_to_cycle(cycle_id: str, task_id: str):
    with Session(engine) as s:
        c = s.get(Cycle, cycle_id)
        if not c:
            raise ValueError("迭代不存在")
        t = s.get(Task, task_id)
        if not t:
            raise ValueError("任务不存在")
        exists = s.get(CycleTask, (cycle_id, task_id))
        if not exists:
            ct = CycleTask(cycle_id=cycle_id, task_id=task_id)
            s.add(ct)
        s.commit()

def remove_task_from_cycle(cycle_id: str, task_id: str):
    with Session(engine) as s:
        ct = s.get(CycleTask, (cycle_id, task_id))
        if ct:
            s.delete(ct); s.commit()

def get_cycle_detail(cycle_id: str):
    with Session(engine) as s:
        c = s.get(Cycle, cycle_id)
        if not c:
            return None
        mappings = s.exec(select(CycleTask).where(CycleTask.cycle_id == cycle_id)).all()
        task_ids = [m.task_id for m in mappings]
        tasks = []
        if task_ids:
            tasks = s.exec(select(Task).where(Task.id.in_(task_ids))).all()
        return {
            "id": c.id,
            "name": c.name,
            "start_date": c.start_date.isoformat() if c.start_date else None,
            "end_date": c.end_date.isoformat() if c.end_date else None,
            "goal": c.goal,
            "created_by": c.created_by,
            "created_at": c.created_at.isoformat() if c.created_at else None,
            "tasks": [
                {
                    "id": t.id,
                    "instance_id": t.instance_id,
                    "node_id": t.node_id,
                    "assignee": t.assignee,
                    "status": t.status,
                    "priority": t.priority,
                    "labels": t.labels or [],
                    "module_id": t.module_id,
                    "estimate_hours": t.estimate_hours,
                    "due_date": t.due_date.isoformat() if t.due_date else None,
                }
                for t in tasks
            ]
        }


# --------------------------
# 视图（SavedView）
# --------------------------
def save_view(owner: str, name: str, filters: dict):
    with Session(engine) as s:
        v = SavedView(name=name, owner=owner, filters=filters or {})
        s.add(v); s.commit(); s.refresh(v)
        return v

def list_views(owner: str):
    with Session(engine) as s:
        return s.exec(select(SavedView).where(SavedView.owner == owner).order_by(SavedView.created_at.desc())).all()

def delete_view(view_id: str, owner: str):
    with Session(engine) as s:
        v = s.get(SavedView, view_id)
        if v and v.owner == owner:
            s.delete(v); s.commit()

def list_instances_by_user(username: str, status: Optional[str] = None):
    with Session(engine) as s:
        query = select(ProcessInstance).where(ProcessInstance.started_by == username)
        if status:
            query = query.where(ProcessInstance.status == status)
        instances = s.exec(query.order_by(ProcessInstance.started_at.desc())).all()
        results = []
        for inst in instances:
            tpl = s.get(ProcessTemplate, inst.template_id)
            current_task = None
            current_node_name = inst.current_node  # 默认使用 node_id
            if inst.current_node:
                current_task = s.exec(
                    select(Task).where(
                        Task.instance_id == inst.id,
                        Task.node_id == inst.current_node,
                        Task.status == "pending"
                    )
                ).first()
                # 获取节点名称
                if tpl and tpl.definition:
                    node = next((n for n in tpl.definition.get("nodes", []) if n.get("id") == inst.current_node), None)
                    if node and node.get("meta", {}).get("name"):
                        current_node_name = node.get("meta", {}).get("name")
            results.append({
                "id": inst.id,
                "template_id": inst.template_id,
                "template_name": tpl.name if tpl else None,
                "title": inst.data.get("title") if inst.data else None,
                "status": inst.status,
                "current_node": inst.current_node,
                "current_node_name": current_node_name,
                "current_assignee": current_task.assignee if current_task else None,
                "started_by": inst.started_by,
                "started_at": inst.started_at.isoformat() if inst.started_at else None,
                "ended_at": inst.ended_at.isoformat() if inst.ended_at else None,
                "data": inst.data,
            })
        return results

def list_departments():
    with Session(engine) as s:
        rows = s.exec(select(User.department).where(User.department.isnot(None))).all()
        departments_set = set()
        for row in rows:
            # 兼容 SQLite（返回元组）和 PostgreSQL（可能直接返回标量）
            if isinstance(row, (list, tuple)):
                value = row[0] if row else None
            else:
                value = row
            if not value:
                continue
            # 去掉首尾空白，过滤空字符串
            value_str = str(value).strip()
            if value_str:
                departments_set.add(value_str)
        departments = sorted(departments_set)
        return departments

def list_all_instances_for_monitoring():
    """列出所有流程实例供系统管理员监控，包括当前节点、负责人、停留时长"""
    now = datetime.now().astimezone()
    
    with Session(engine) as s:
        # 获取所有运行中的实例
        instances = s.exec(
            select(ProcessInstance)
            .where(ProcessInstance.status == "running")
            .order_by(ProcessInstance.started_at.desc())
        ).all()
        
        results = []
        for inst in instances:
            tpl = s.get(ProcessTemplate, inst.template_id)
            current_task = None
            current_node_name = inst.current_node  # 默认使用 node_id
            stuck_duration = None  # 停留时长（秒）
            progress_percent = 0
            
            # 计算进度
            total_nodes = 0
            completed_nodes = 0
            if tpl and tpl.definition:
                total_nodes = len([n for n in tpl.definition.get("nodes", []) if n.get("type") not in ("start", "end")])
                tasks = s.exec(select(Task).where(Task.instance_id == inst.id)).all()
                completed_nodes = len([t for t in tasks if t.status != "pending"])
                if total_nodes > 0:
                    progress_percent = int(min(100, (completed_nodes / total_nodes) * 100))
            
            if inst.current_node:
                # 查找当前待办任务
                current_task = s.exec(
                    select(Task).where(
                        Task.instance_id == inst.id,
                        Task.node_id == inst.current_node,
                        Task.status == "pending"
                    )
                ).first()
                
                # 获取节点名称
                if tpl and tpl.definition:
                    node = next((n for n in tpl.definition.get("nodes", []) if n.get("id") == inst.current_node), None)
                    if node and node.get("meta", {}).get("name"):
                        current_node_name = node.get("meta", {}).get("name")
                
                # 计算停留时长（从任务分配时间到现在）
                if current_task and current_task.assigned_at:
                    assigned_time_local = to_local(current_task.assigned_at)
                    if assigned_time_local:
                        delta = now - assigned_time_local
                        stuck_duration = max(0, int(delta.total_seconds()))
            
            # 获取发起人信息
            starter = s.get(User, inst.started_by) if inst.started_by else None
            started_at_local = to_local(inst.started_at)
            
            results.append({
                "id": inst.id,
                "template_id": inst.template_id,
                "template_name": tpl.name if tpl else None,
                "title": inst.data.get("title") if inst.data else None,
                "status": inst.status,
                "current_node": inst.current_node,
                "current_node_name": current_node_name,
                "current_assignee": current_task.assignee if current_task else None,
                "stuck_duration": stuck_duration,  # 停留时长（秒）
                "started_by": inst.started_by,
                "started_by_name": starter.display_name or starter.username if starter else None,
                "started_at": started_at_local.isoformat() if started_at_local else None,
                "data": inst.data,
                "progress_percent": progress_percent if inst.status != "approved" else 100,
            })
        return results

def get_instance_detail(instance_id: str, requester: str):
    with Session(engine) as s:
        inst = s.get(ProcessInstance, instance_id)
        if not inst:
            return None
        tpl = s.get(ProcessTemplate, inst.template_id)
        tasks = s.exec(select(Task).where(Task.instance_id == inst.id).order_by(Task.assigned_at)).all()
        history = []
        for t in tasks:
            # 获取节点名称
            node_name = t.node_id
            if tpl and tpl.definition:
                node = next((n for n in tpl.definition.get("nodes", []) if n.get("id") == t.node_id), None)
                if node and node.get("meta", {}).get("name"):
                    node_name = node.get("meta", {}).get("name")
            history.append({
                "id": t.id,
                "node_id": t.node_id,
                "node_name": node_name,
                "assignee": t.assignee,
                "status": t.status,
                "opinion": t.opinion,
                "assigned_at": t.assigned_at.isoformat() if t.assigned_at else None,
                "finished_at": t.finished_at.isoformat() if t.finished_at else None,
            })
        current_task = next((t for t in tasks if t.status == "pending"), None)
        current_node_name = inst.current_node
        if inst.current_node and tpl and tpl.definition:
            node = next((n for n in tpl.definition.get("nodes", []) if n.get("id") == inst.current_node), None)
            if node and node.get("meta", {}).get("name"):
                current_node_name = node.get("meta", {}).get("name")
        return {
            "id": inst.id,
            "template_id": inst.template_id,
            "template_name": tpl.name if tpl else None,
            "template_definition": tpl.definition if tpl else None,
            "title": inst.data.get("title") if inst.data else None,
            "status": inst.status,
            "current_node": inst.current_node,
            "current_node_name": current_node_name,
            "current_assignee": current_task.assignee if current_task else None,
            "started_by": inst.started_by,
            "started_at": inst.started_at.isoformat() if inst.started_at else None,
            "ended_at": inst.ended_at.isoformat() if inst.ended_at else None,
            "data": inst.data,
            "history": history,
        }

def get_dashboard_stats(username: str, role: str = "user", department: Optional[str] = None):
    from datetime import datetime, timezone, timedelta, date
    tz = timezone(timedelta(hours=8))
    today = datetime.now(tz).date()
    view_scope = "self"
    target_department = None
    if role in ("admin", "company_admin"):
        view_scope = "all"
    elif role == "dept_admin" and department:
        view_scope = "department"
        target_department = department
    
    with Session(engine) as s:
        # 统计我发起的流程状态
        rows = s.exec(
            select(ProcessInstance.status, func.count(ProcessInstance.id))
            .where(ProcessInstance.started_by == username)
            .group_by(ProcessInstance.status)
        ).all()
        stats = {"running": 0, "approved": 0, "rejected": 0}
        total = 0
        for row in rows:
            status, count = row
            if status in stats:
                stats[status] = count
            else:
                # 未知状态归为 running
                stats["running"] += count
            total += count

        # 统计当前用户个人待办
        try:
            personal_tasks = s.exec(
                select(Task).where(Task.assignee == username, Task.status == "pending")
            ).all()
            pending_tasks = len(personal_tasks)
            today_tasks = 0
            overdue_tasks = 0
            for task in personal_tasks:
                inst = s.get(ProcessInstance, task.instance_id)
                if inst and inst.data and inst.data.get("due_date"):
                    try:
                        due_date_str = inst.data.get("due_date")
                        if isinstance(due_date_str, str):
                            due_date = datetime.strptime(due_date_str, "%Y-%m-%d").date()
                        elif isinstance(due_date_str, date):
                            due_date = due_date_str
                        else:
                            continue
                        if due_date == today:
                            today_tasks += 1
                        elif due_date < today:
                            overdue_tasks += 1
                    except (ValueError, TypeError):
                        continue
        except Exception as e:
            print(f"Error counting personal pending tasks: {e}")
            import traceback
            traceback.print_exc()
            pending_tasks = 0
            today_tasks = 0
            overdue_tasks = 0
        
        # 统计管理员/部门管理员视图下的用户汇总
        summary_map = {}
        user_summary = []
        if view_scope in ("all", "department"):
            try:
                if view_scope == "all":
                    agg_tasks = s.exec(select(Task).where(Task.status == "pending")).all()
                    user_records = s.exec(select(User)).all()
                else:
                    user_records = s.exec(
                        select(User).where(User.department == target_department)
                    ).all()
                    dept_usernames = [u.username for u in user_records]
                    if dept_usernames:
                        agg_tasks = s.exec(
                            select(Task).where(
                                Task.status == "pending",
                                Task.assignee.in_(dept_usernames)
                            )
                        ).all()
                    else:
                        agg_tasks = []
                user_map = {u.username: u for u in user_records}
                for uname, user_info in user_map.items():
                    summary_map[uname] = {
                        "username": uname,
                        "display_name": user_info.display_name or uname,
                        "department": user_info.department or "",
                        "role": user_info.role or "user",
                        "total_pending": 0,
                        "today_tasks": 0,
                        "overdue_tasks": 0,
                    }
                for task in agg_tasks:
                    entry = summary_map.get(task.assignee)
                    if not entry:
                        continue
                    entry["total_pending"] += 1
                    inst = s.get(ProcessInstance, task.instance_id)
                    if inst and inst.data and inst.data.get("due_date"):
                        try:
                            due_date_str = inst.data.get("due_date")
                            if isinstance(due_date_str, str):
                                due_date = datetime.strptime(due_date_str, "%Y-%m-%d").date()
                            elif isinstance(due_date_str, date):
                                due_date = due_date_str
                            else:
                                continue
                            if due_date == today:
                                entry["today_tasks"] += 1
                            elif due_date < today:
                                entry["overdue_tasks"] += 1
                        except (ValueError, TypeError):
                            continue
                user_summary = sorted(summary_map.values(), key=lambda x: x["total_pending"], reverse=True)
            except Exception as e:
                print(f"Error counting aggregated tasks: {e}")
                import traceback
                traceback.print_exc()
                user_summary = []
        
        return {
            "instances": stats,
            "instances_total": total,
            "pending_tasks": pending_tasks or 0,
            "today_tasks": today_tasks,
            "overdue_tasks": overdue_tasks,
            "view_scope": view_scope,
            "view_department": target_department,
            "user_summary": user_summary,
        }
