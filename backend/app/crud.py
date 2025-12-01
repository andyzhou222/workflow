from sqlmodel import Session, select, create_engine
from sqlalchemy import text, func
from typing import Optional
from .models import *
from .utils import hash_password
from .config import DB_FILE

engine = create_engine(f"sqlite:///{DB_FILE}", echo=False, connect_args={"check_same_thread": False})

def init_db():
    SQLModel.metadata.create_all(engine)
    
    # 检查并添加新列（用于现有数据库的迁移）
    with Session(engine) as s:
        try:
            # 检查 title 列是否存在
            result = s.exec(text("PRAGMA table_info(user)"))
            columns = [row[1] for row in result]
            
            if 'title' not in columns:
                s.exec(text("ALTER TABLE user ADD COLUMN title TEXT"))
                s.commit()
                print("Added 'title' column to user table")
            
            if 'avatar' not in columns:
                s.exec(text("ALTER TABLE user ADD COLUMN avatar TEXT"))
                s.commit()
                print("Added 'avatar' column to user table")
        except Exception as e:
            print(f"Migration check error (may be normal for new DB): {e}")
            s.rollback()
    
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
    tz = timezone(timedelta(hours=8))
    local_now = datetime.now(tz)
    
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
        t = Task(instance_id=inst.id, node_id=first_node_id, assignee=assignee)
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

def complete_task(task_id: str, username: str, decision: str, opinion: str = None):
    from datetime import datetime, timezone, timedelta
    # 使用中国时区 (UTC+8)
    tz = timezone(timedelta(hours=8))
    local_now = datetime.now(tz)
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
        new_task = Task(instance_id=inst.id, node_id=next_node_id, assignee=assignee)
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
        departments = sorted({row[0] for row in rows if row[0]})
        return departments

def list_all_instances_for_monitoring():
    """列出所有流程实例供系统管理员监控，包括当前节点、负责人、停留时长"""
    from datetime import datetime, timezone, timedelta
    tz = timezone(timedelta(hours=8))
    now = datetime.now(tz)
    
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
                    # 确保 assigned_at 有时区信息
                    assigned_time = current_task.assigned_at
                    if assigned_time.tzinfo is None:
                        # 如果没有时区信息，假设是本地时区
                        assigned_time = assigned_time.replace(tzinfo=tz)
                    else:
                        # 如果有 UTC 时区，转换为本地时区
                        if assigned_time.tzinfo.utcoffset(assigned_time) == timedelta(0):
                            assigned_time = assigned_time.replace(tzinfo=timezone.utc).astimezone(tz)
                    
                    delta = now - assigned_time
                    stuck_duration = int(delta.total_seconds())
            
            # 获取发起人信息
            starter = s.get(User, inst.started_by) if inst.started_by else None
            
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
                "started_at": inst.started_at.isoformat() if inst.started_at else None,
                "data": inst.data,
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
