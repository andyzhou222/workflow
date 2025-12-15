from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, Form
from fastapi.responses import HTMLResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from sqlmodel import Session, select
from typing import Optional
from . import crud, models, schemas, auth, storage, workflow
from .utils import create_access_token, hash_password
from .config import UPLOAD_FOLDER
import os

app = FastAPI(title="Workflow Full - FastAPI")

# 添加 CORS 支持
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:5174",
        "https://jl-inndlink.onrender.com",  # Render 前端域名
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

# init db and default admin
# 延迟初始化，避免启动时连接失败导致服务无法启动
try:
    crud.init_db()
except Exception as e:
    print(f"Warning: Database initialization failed: {e}")
    print("Service will continue to start, but database operations may fail.")

# mount static frontend build (index.html should exist in app/static)
static_dir = os.path.join(os.path.dirname(__file__), "static")
if os.path.isdir(static_dir):
    app.mount("/", StaticFiles(directory=static_dir, html=True), name="static")

# mount uploads folder for avatars and files
if os.path.exists(UPLOAD_FOLDER):
    # 使用自定义的静态文件服务，确保正确的Content-Type
    from fastapi.responses import FileResponse
    from fastapi import Request
    from pathlib import Path
    
    @app.get("/api/uploads/{file_path:path}")
    async def serve_upload_file(file_path: str, request: Request):
        """自定义静态文件服务，确保正确的Content-Type"""
        full_path = os.path.join(UPLOAD_FOLDER, file_path)
        if not os.path.exists(full_path) or not os.path.isfile(full_path):
            from fastapi import HTTPException
            raise HTTPException(status_code=404, detail="File not found")
        return FileResponse(
            full_path,
            media_type=None,  # 让FastAPI自动检测
            filename=os.path.basename(full_path)
        )

from fastapi.security import OAuth2PasswordRequestForm

@app.post("/api/auth/login")
def login(form_data: OAuth2PasswordRequestForm = Depends()):
    try:
        user = auth.authenticate_user(form_data.username, form_data.password)
        if not user:
            raise HTTPException(status_code=400, detail="invalid credentials")
        token = create_access_token(user.username)
        crud.write_audit(user.username, "login", {})
        return {
            "access_token": token, 
            "token_type": "bearer", 
            "user": {
                "username": user.username, 
                "display_name": user.display_name or "", 
                "role": user.role or "user"
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        print(f"Login error: {str(e)}")
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

@app.post("/api/auth/register")
def register(data: schemas.UserRegister):
    try:
        # 检查用户名是否已存在
        existing = crud.get_user_by_username(data.username)
        if existing:
            raise HTTPException(status_code=400, detail="用户名已存在")
        
        # 验证用户名和密码
        if not data.username or len(data.username) < 3:
            raise HTTPException(status_code=400, detail="用户名至少需要3个字符")
        if not data.password or len(data.password) < 6:
            raise HTTPException(status_code=400, detail="密码至少需要6个字符")
        
        # 创建新用户
        password_hash = hash_password(data.password)
        user = crud.create_user(
            username=data.username,
            password_hash=password_hash,
            display_name=data.username,
            role="user"
        )
        crud.write_audit(user.username, "register", {})
        return {"message": "注册成功", "username": user.username}
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        print(f"Register error: {str(e)}")
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"注册失败: {str(e)}")

@app.post("/api/auth/reset-password")
def reset_password(data: schemas.PasswordReset):
    try:
        user = crud.get_user_by_username(data.username)
        if not user:
            raise HTTPException(status_code=404, detail="用户不存在")
        
        # 重置为默认密码 jlcl2025
        default_password = "jlcl2025"
        new_password_hash = hash_password(default_password)
        with Session(crud.engine) as s:
            db_user = s.get(models.User, user.id)
            db_user.password_hash = new_password_hash
            s.add(db_user)
            s.commit()
        
        crud.write_audit(user.username, "reset_password", {})
        return {"message": f"密码已重置为默认密码: {default_password}"}
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        print(f"Reset password error: {str(e)}")
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"重置密码失败: {str(e)}")

@app.get("/api/users/me")
def me(user: models.User = Depends(auth.get_current_user)):
    return {
        "id": user.id,
        "username": user.username, 
        "display_name": user.display_name, 
        "role": user.role, 
        "department": user.department,
        "title": user.title,
        "avatar": user.avatar,
        "created_at": user.created_at.isoformat() if user.created_at else None
    }

@app.put("/api/users/me")
def update_me(data: schemas.UserUpdate, user: models.User = Depends(auth.get_current_user)):
    try:
        with Session(crud.engine) as s:
            db_user = s.get(models.User, user.id)
            if data.username is not None and data.username != db_user.username:
                # 检查新用户名是否已存在
                existing = crud.get_user_by_username(data.username)
                if existing and existing.id != db_user.id:
                    raise HTTPException(status_code=400, detail="Username already exists")
                db_user.username = data.username
            if data.display_name is not None:
                db_user.display_name = data.display_name
            if data.department is not None:
                db_user.department = data.department
            if data.title is not None:
                db_user.title = data.title
            if data.avatar is not None:
                db_user.avatar = data.avatar
            # 普通用户不能修改自己的角色
            if data.role is not None and user.role in ("admin", "company_admin"):
                db_user.role = data.role
            s.add(db_user)
            s.commit()
            s.refresh(db_user)
        
        crud.write_audit(user.username, "update_profile", {})
        return {
            "id": db_user.id,
            "username": db_user.username,
            "display_name": db_user.display_name,
            "role": db_user.role,
            "department": db_user.department,
            "title": db_user.title,
            "avatar": db_user.avatar,
            "created_at": db_user.created_at.isoformat() if db_user.created_at else None
        }
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        print(f"Update profile error: {str(e)}")
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

@app.post("/api/users/me/change-password")
def change_password(data: schemas.PasswordChange, user: models.User = Depends(auth.get_current_user)):
    try:
        from .utils import verify_password
        # 验证旧密码
        if not verify_password(data.old_password, user.password_hash):
            raise HTTPException(status_code=400, detail="Old password is incorrect")
        
        # 更新密码
        new_password_hash = hash_password(data.new_password)
        with Session(crud.engine) as s:
            db_user = s.get(models.User, user.id)
            db_user.password_hash = new_password_hash
            s.add(db_user)
            s.commit()
        
        crud.write_audit(user.username, "change_password", {})
        return {"message": "Password changed successfully"}
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        print(f"Change password error: {str(e)}")
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

@app.post("/api/users/me/upload-avatar")
def upload_avatar(file: UploadFile = File(...), user: models.User = Depends(auth.get_current_user)):
    try:
        # 确保 avatars 目录存在
        avatars_dir = os.path.join(UPLOAD_FOLDER, "avatars")
        os.makedirs(avatars_dir, exist_ok=True)
        
        # 生成文件名（使用用户ID和文件扩展名）
        import uuid
        # 安全地获取文件扩展名，避免编码问题
        original_filename = file.filename or 'avatar.jpg'
        # 只保留安全的文件扩展名
        file_ext = os.path.splitext(original_filename)[1] or '.jpg'
        # 确保扩展名是安全的（只允许图片格式）
        if file_ext.lower() not in ['.jpg', '.jpeg', '.png', '.gif', '.webp']:
            file_ext = '.jpg'
        filename = f"{user.id}{file_ext}"
        dest_path = os.path.join(avatars_dir, filename)
        
        # 保存文件（使用二进制模式，避免编码问题）
        with open(dest_path, "wb") as buffer:
            data = file.file.read()
            buffer.write(data)
        
        # 更新用户头像URL
        avatar_url = f"/api/uploads/avatars/{filename}"
        with Session(crud.engine) as s:
            db_user = s.get(models.User, user.id)
            db_user.avatar = avatar_url
            s.add(db_user)
            s.commit()
            s.refresh(db_user)
        
        crud.write_audit(user.username, "upload_avatar", {})
        return {"avatar": db_user.avatar, "message": "Avatar uploaded successfully"}
    except Exception as e:
        import traceback
        print(f"Upload avatar error: {str(e)}")
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

@app.post("/api/templates")
def create_template(data: schemas.TemplateCreate, cur: models.User = Depends(auth.get_current_user)):
    ok, err = workflow.validate_template(data.definition)
    if not ok:
        raise HTTPException(status_code=400, detail=err)
    tpl = crud.create_template(data.name, data.definition, cur.username)
    crud.write_audit(cur.username, "create_template", {"template_id": tpl.id})
    return tpl

@app.get("/api/templates")
def list_templates(cur: models.User = Depends(auth.get_current_user)):
    try:
        templates = crud.list_templates()
        # 确保 SQLModel 对象能正确序列化
        return [{"id": t.id, "name": t.name, "definition": t.definition, "created_by": t.created_by, "created_at": t.created_at.isoformat() if t.created_at else None} for t in templates]
    except Exception as e:
        import traceback
        print(f"List templates error: {str(e)}")
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

@app.delete("/api/templates/{template_id}")
def delete_template(template_id: str, cur: models.User = Depends(auth.get_current_user)):
    if cur.role not in ("admin", "company_admin", "dept_admin"):
        raise HTTPException(status_code=403, detail="仅管理员可删除模板")
    try:
        crud.delete_template(template_id)
        crud.write_audit(cur.username, "delete_template", {"template_id": template_id})
        return {"message": "模板已删除"}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        import traceback
        print(f"Delete template error: {str(e)}")
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

@app.post("/api/instances/start")
def start_instance(payload: schemas.StartInstance, cur: models.User = Depends(auth.get_current_user)):
    try:
        inst, task = crud.create_instance(payload.template_id, payload.data or {}, cur.username, payload.old_instance_id)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
    crud.write_audit(cur.username, "start_instance", {"instance_id": inst.id})
    return {
        "instance": inst,
        "first_task": task
    }

@app.get("/api/instances/mine")
def list_my_instances(status: Optional[str] = None, cur: models.User = Depends(auth.get_current_user)):
    instances = crud.list_instances_by_user(cur.username, status=status)
    return instances

@app.get("/api/instances/monitor")
def monitor_instances(cur: models.User = Depends(auth.get_current_user)):
    """系统管理员任务监控：查看所有运行中任务的进程、负责人、停留时长"""
    if cur.role not in ("admin", "company_admin"):
        raise HTTPException(status_code=403, detail="仅系统管理员和公司管理员可访问")
    try:
        instances = crud.list_all_instances_for_monitoring()
        return instances
    except Exception as e:
        import traceback
        print(f"Monitor instances error: {str(e)}")
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

@app.get("/api/instances/{instance_id}")
def get_instance_detail(instance_id: str, cur: models.User = Depends(auth.get_current_user)):
    detail = crud.get_instance_detail(instance_id, cur.username)
    if not detail:
        raise HTTPException(status_code=404, detail="Instance not found")
    return detail

@app.get("/api/tasks/todo")
def get_todo(cur: models.User = Depends(auth.get_current_user)):
    tasks = crud.get_tasks_for_user(cur.username)
    return tasks

@app.post("/api/tasks/{task_id}/complete")
def complete_task(task_id: str, payload: schemas.CompleteTask, cur: models.User = Depends(auth.get_current_user)):
    try:
        task, inst, new_task = crud.complete_task(task_id, cur.username, payload.decision, payload.opinion)
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
    crud.write_audit(cur.username, "complete_task", {"task_id": task_id, "decision": payload.decision})
    return {"task": task, "instance": inst, "new_task": new_task}

@app.post("/api/docs/upload")
def upload_doc(title: str = Form(...), file: UploadFile = File(...), cur: models.User = Depends(auth.get_current_user)):
    dest = storage.save_upload_file(file)
    doc = crud.save_document(title, dest, cur.username)
    crud.write_audit(cur.username, "upload_doc", {"doc_id": doc.id})
    return doc

@app.post("/api/docs/{doc_id}/publish")
def publish_doc(doc_id: str, cur: models.User = Depends(auth.get_current_user)):
    try:
        doc = crud.publish_document(doc_id)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
    crud.write_audit(cur.username, "publish_doc", {"doc_id": doc.id})
    return doc

@app.get("/api/docs")
def list_docs(cur: models.User = Depends(auth.get_current_user)):
    return crud.list_documents()

@app.get("/api/docs/{doc_id}/download")
def download_doc(doc_id: str, cur: models.User = Depends(auth.get_current_user)):
    doc = crud.get_document(doc_id)
    if not doc:
        raise HTTPException(status_code=404, detail="not found")
    file_path = doc.filename
    if not os.path.isabs(file_path):
        file_path = os.path.join(UPLOAD_FOLDER, file_path)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="文件不存在或已被删除")
    return FileResponse(file_path, filename=doc.title)


@app.post("/api/standard-docs/upload")
def upload_standard_doc(title: str = Form(...), file: UploadFile = File(...), cur: models.User = Depends(auth.get_current_user)):
    """标准文档上传：所有登录用户可上传"""
    try:
        dest = storage.save_upload_file(file)
        doc = crud.save_document(title, dest, cur.username)
        # 标准文档用 status 标记为 'standard'
        with Session(crud.engine) as s:
            db_doc = s.get(models.Document, doc.id)
            db_doc.status = "standard"
            s.add(db_doc)
            s.commit()
            s.refresh(db_doc)
        crud.write_audit(cur.username, "upload_standard_doc", {"doc_id": doc.id})
        return {
            "id": db_doc.id,
            "title": db_doc.title,
            "filename": db_doc.filename,
            "uploaded_by": db_doc.uploaded_by,
            "uploaded_at": db_doc.uploaded_at.isoformat() if db_doc.uploaded_at else None,
        }
    except Exception as e:
        import traceback
        print(f"Upload standard doc error: {str(e)}")
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@app.get("/api/standard-docs")
def list_standard_docs(cur: models.User = Depends(auth.get_current_user)):
    """标准文档列表：所有登录用户可查看"""
    with Session(crud.engine) as s:
        docs = s.exec(
            select(models.Document)
            .where(models.Document.status == "standard")
            .order_by(models.Document.uploaded_at.desc())
        ).all()
        return [
            {
                "id": d.id,
                "title": d.title,
                "filename": d.filename,
                "uploaded_by": d.uploaded_by,
                "uploaded_at": d.uploaded_at.isoformat() if d.uploaded_at else None,
            }
            for d in docs
        ]


@app.put("/api/standard-docs/{doc_id}")
def update_standard_doc(doc_id: str, title: str = Form(...), cur: models.User = Depends(auth.get_current_user)):
    """标准文档重命名：仅系统管理员和公司管理员"""
    if cur.role not in ("admin", "company_admin"):
        raise HTTPException(status_code=403, detail="admin only")
    try:
        with Session(crud.engine) as s:
            doc = s.get(models.Document, doc_id)
            if not doc or doc.status != "standard":
                raise HTTPException(status_code=404, detail="not found")
            doc.title = title
            s.add(doc)
            s.commit()
            s.refresh(doc)
        crud.write_audit(cur.username, "update_standard_doc", {"doc_id": doc_id})
        return {
            "id": doc.id,
            "title": doc.title,
        }
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        print(f"Update standard doc error: {str(e)}")
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@app.delete("/api/standard-docs/{doc_id}")
def delete_standard_doc(doc_id: str, cur: models.User = Depends(auth.get_current_user)):
    """标准文档删除：仅系统管理员和公司管理员"""
    if cur.role not in ("admin", "company_admin"):
        raise HTTPException(status_code=403, detail="admin only")
    try:
        with Session(crud.engine) as s:
            doc = s.get(models.Document, doc_id)
            if not doc or doc.status != "standard":
                raise HTTPException(status_code=404, detail="not found")
            file_path = doc.filename
            if not os.path.isabs(file_path):
                file_path = os.path.join(UPLOAD_FOLDER, file_path)
            if os.path.exists(file_path):
                try:
                    os.remove(file_path)
                except Exception as e:
                    print(f"Warning: failed to remove file {file_path}: {e}")
            s.delete(doc)
            s.commit()
        crud.write_audit(cur.username, "delete_standard_doc", {"doc_id": doc_id})
        return {"message": "deleted"}
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        print(f"Delete standard doc error: {str(e)}")
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

# --------------------------
# 模块管理（管理员可见）
# --------------------------
@app.get("/api/modules")
def list_modules(cur: models.User = Depends(auth.get_current_user)):
    modules = crud.list_modules(cur.role, cur.username)
    return modules

@app.post("/api/modules")
def create_module(data: schemas.ModuleCreate, cur: models.User = Depends(auth.get_current_user)):
    if cur.role not in ("admin", "company_admin", "dept_admin"):
        raise HTTPException(status_code=403, detail="仅管理员可创建模块")
    m = crud.create_module(data.name, data.description, cur.username)
    return m


# --------------------------
# 任务元数据更新
# --------------------------
@app.put("/api/tasks/{task_id}/meta")
def update_task_meta(task_id: str, data: schemas.TaskMetaUpdate, cur: models.User = Depends(auth.get_current_user)):
    task = crud.get_task(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")
    if cur.role not in ("admin", "company_admin") and task.assignee != cur.username:
        raise HTTPException(status_code=403, detail="无权限修改该任务")
    try:
        updated = crud.update_task_meta(
            task_id,
            priority=data.priority,
            labels=data.labels,
            module_id=data.module_id,
            estimate_hours=data.estimate_hours,
            due_date=data.due_date,
        )
        return updated
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# --------------------------
# 迭代（Cycles）
# --------------------------
@app.get("/api/cycles")
def list_cycles(cur: models.User = Depends(auth.get_current_user)):
    return crud.list_cycles(cur.role, cur.username)

@app.post("/api/cycles")
def create_cycle(data: schemas.CycleCreate, cur: models.User = Depends(auth.get_current_user)):
    if cur.role not in ("admin", "company_admin", "dept_admin"):
        raise HTTPException(status_code=403, detail="仅管理员可创建迭代")
    return crud.create_cycle(data.name, data.start_date, data.end_date, data.goal, cur.username)

@app.get("/api/cycles/{cycle_id}")
def get_cycle_detail(cycle_id: str, cur: models.User = Depends(auth.get_current_user)):
    if cur.role not in ("admin", "company_admin", "dept_admin"):
        raise HTTPException(status_code=403, detail="仅管理员可查看迭代")
    detail = crud.get_cycle_detail(cycle_id)
    if not detail:
        raise HTTPException(status_code=404, detail="迭代不存在")
    return detail

@app.post("/api/cycles/{cycle_id}/tasks")
def add_task_to_cycle(cycle_id: str, payload: schemas.CycleTaskAssign, cur: models.User = Depends(auth.get_current_user)):
    if cur.role not in ("admin", "company_admin", "dept_admin"):
        raise HTTPException(status_code=403, detail="仅管理员可分配任务到迭代")
    try:
        crud.assign_task_to_cycle(cycle_id, payload.task_id)
        return {"message": "已加入迭代"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.delete("/api/cycles/{cycle_id}/tasks/{task_id}")
def remove_task_from_cycle(cycle_id: str, task_id: str, cur: models.User = Depends(auth.get_current_user)):
    if cur.role not in ("admin", "company_admin", "dept_admin"):
        raise HTTPException(status_code=403, detail="仅管理员可操作")
    crud.remove_task_from_cycle(cycle_id, task_id)
    return {"message": "已移除"}


# --------------------------
# 管理员任务列表（用于分配迭代等）
# --------------------------
@app.get("/api/tasks")
def list_all_tasks(cur: models.User = Depends(auth.get_current_user)):
    if cur.role not in ("admin", "company_admin", "dept_admin"):
        raise HTTPException(status_code=403, detail="仅管理员可查看全部任务")
    return crud.list_all_tasks_admin()


# --------------------------
# 保存视图（个人）
# --------------------------
@app.get("/api/views")
def list_views(cur: models.User = Depends(auth.get_current_user)):
    return crud.list_views(cur.username)

@app.post("/api/views")
def create_view(data: schemas.SavedViewCreate, cur: models.User = Depends(auth.get_current_user)):
    return crud.save_view(cur.username, data.name, data.filters)

@app.delete("/api/views/{view_id}")
def delete_view(view_id: str, cur: models.User = Depends(auth.get_current_user)):
    crud.delete_view(view_id, cur.username)
    return {"message": "已删除"}

@app.get("/api/dashboard/stats")
def dashboard_stats(cur: models.User = Depends(auth.get_current_user)):
    return crud.get_dashboard_stats(
        username=cur.username,
        role=cur.role,
        department=cur.department
    )

@app.get("/api/users")
def list_users(cur: models.User = Depends(auth.get_current_user)):
    """获取用户列表（仅管理员）"""
    if cur.role not in ("admin", "company_admin"):
        raise HTTPException(status_code=403, detail="admin only")
    with Session(crud.engine) as s:
        users = s.exec(select(models.User).order_by(models.User.created_at.desc())).all()
        return [{
            "id": u.id,
            "username": u.username,
            "display_name": u.display_name,
            "role": u.role,
            "department": u.department,
            "title": u.title,
            "avatar": u.avatar,
            "created_at": u.created_at.isoformat() if u.created_at else None
        } for u in users]

@app.put("/api/users/{user_id}")
def update_user(user_id: str, data: schemas.UserUpdate, cur: models.User = Depends(auth.get_current_user)):
    """更新用户信息（仅管理员）"""
    if cur.role not in ("admin", "company_admin"):
        raise HTTPException(status_code=403, detail="admin only")
    try:
        with Session(crud.engine) as s:
            db_user = s.get(models.User, user_id)
            if not db_user:
                raise HTTPException(status_code=404, detail="User not found")
            
            if data.username is not None and data.username != db_user.username:
                # 检查新用户名是否已存在
                existing = crud.get_user_by_username(data.username)
                if existing and existing.id != db_user.id:
                    raise HTTPException(status_code=400, detail="Username already exists")
                db_user.username = data.username
            if data.display_name is not None:
                db_user.display_name = data.display_name
            if data.department is not None:
                db_user.department = data.department
            if data.title is not None:
                db_user.title = data.title
            if data.role is not None:
                # 验证角色值
                if data.role not in ["user", "dept_admin", "admin", "company_admin"]:
                    raise HTTPException(status_code=400, detail="Invalid role")
                db_user.role = data.role
            if data.avatar is not None:
                db_user.avatar = data.avatar
            
            s.add(db_user)
            s.commit()
            s.refresh(db_user)
        
        crud.write_audit(cur.username, "update_user", {"user_id": user_id})
        return {
            "id": db_user.id,
            "username": db_user.username,
            "display_name": db_user.display_name,
            "role": db_user.role,
            "department": db_user.department,
            "title": db_user.title,
            "avatar": db_user.avatar,
            "created_at": db_user.created_at.isoformat() if db_user.created_at else None
        }
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        print(f"Update user error: {str(e)}")
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

@app.get("/api/departments")
def list_departments(cur: models.User = Depends(auth.get_current_user)):
    if cur.role not in ("admin", "company_admin", "dept_admin"):
        raise HTTPException(status_code=403, detail="permission denied")
    return {"items": crud.list_departments()}

@app.get("/api/users/options")
def list_user_options(cur: models.User = Depends(auth.get_current_user)):
    with Session(crud.engine) as s:
        users = s.exec(select(models.User).order_by(models.User.display_name, models.User.username)).all()
        return [{
            "id": u.id,
            "username": u.username,
            "display_name": u.display_name or u.username,
            "department": u.department,
            "role": u.role or "user"
        } for u in users]

@app.get("/api/audit")
def get_audit(cur: models.User = Depends(auth.get_current_user)):
    if cur.role not in ("admin", "company_admin"):
        raise HTTPException(status_code=403, detail="admin only")
    with Session(crud.engine) as s:
        logs = s.exec(select(models.AuditLog)).all()
        return logs


@app.get("/api/hr/profiles")
def list_hr_profiles(cur: models.User = Depends(auth.get_current_user)):
    """人事档案：公司管理员查看所有，部门管理员只看本部门"""
    if cur.role not in ("admin", "company_admin", "dept_admin"):
        raise HTTPException(status_code=403, detail="permission denied")
    with Session(crud.engine) as s:
        query = select(models.User).order_by(models.User.created_at.desc())
        if cur.role == "dept_admin" and cur.department:
            query = query.where(models.User.department == cur.department)
        users = s.exec(query).all()
        return [
            {
                "id": u.id,
                "username": u.username,
                "display_name": u.display_name,
                "department": u.department,
                "title": u.title,
                "role": u.role or "user",
                "avatar": u.avatar,
                "created_at": u.created_at.isoformat() if u.created_at else None,
            }
            for u in users
        ]

@app.get("/api/instances/monitor")
def monitor_instances(cur: models.User = Depends(auth.get_current_user)):
    """系统管理员任务监控：查看所有运行中任务的进程、负责人、停留时长"""
    if cur.role not in ("admin", "company_admin"):
        raise HTTPException(status_code=403, detail="仅系统管理员和公司管理员可访问")
    try:
        instances = crud.list_all_instances_for_monitoring()
        return instances
    except Exception as e:
        import traceback
        print(f"Monitor instances error: {str(e)}")
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")
