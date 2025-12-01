# 数据库保护配置说明

## 问题说明

在 Render 等云平台上，每次重新部署时，项目目录可能会被清理，导致 SQLite 数据库文件丢失。为了保护数据库数据不被覆盖，需要配置环境变量将数据库文件存储到持久化位置。

## 解决方案

### 方案一：使用 Render 持久化磁盘（推荐，需要付费计划）

如果使用 Render 的付费计划，可以使用持久化磁盘（Disk）功能：

1. **在 Render Dashboard 中：**
   - 进入你的后端服务（Web Service）
   - 点击左侧菜单的 "Disk"
   - 点击 "Link Disk" 创建一个新的持久化磁盘
   - 设置磁盘名称（如 `workflow-db`）
   - 设置挂载路径（如 `/opt/render/project/data`）

2. **设置环境变量：**
   - 在服务的 "Environment" 页面
   - 添加环境变量：
     - **Key:** `WF_DB`
     - **Value:** `/opt/render/project/data/workflow.sqlite`

3. **重启服务：**
   - 保存环境变量后，Render 会自动重新部署
   - 数据库文件将保存在持久化磁盘中，不会因重新部署而丢失

### 方案二：使用环境变量指向临时目录（免费方案，但可能丢失）

对于免费用户，Render 不提供持久化磁盘，但可以尝试使用 `/tmp` 目录（注意：这个目录在某些情况下也可能被清理）：

1. **在 Render Dashboard 中：**
   - 进入你的后端服务
   - 点击 "Environment" 标签
   - 点击 "Add Environment Variable"
   - 添加：
     - **Key:** `WF_DB`
     - **Value:** `/tmp/workflow.sqlite`

2. **重启服务**

⚠️ **注意：** `/tmp` 目录在某些情况下可能被清理，数据可能丢失。建议使用方案一或方案三。

### 方案三：使用外部数据库（最可靠，推荐生产环境）

对于生产环境，建议使用外部数据库服务（如 Render PostgreSQL、Supabase、Railway 等）：

1. **创建 PostgreSQL 数据库：**
   - 在 Render 上创建一个 PostgreSQL 数据库服务
   - 获取数据库连接字符串

2. **修改代码使用 PostgreSQL：**
   - 需要修改 `backend/app/crud.py` 中的数据库连接
   - 使用 PostgreSQL 连接字符串替代 SQLite

3. **设置环境变量：**
   - `DATABASE_URL`: PostgreSQL 连接字符串

## 当前配置检查

当前代码已经支持通过环境变量 `WF_DB` 配置数据库路径：

```python
# backend/app/config.py
DB_FILE = os.getenv("WF_DB", os.path.join(BASE_DIR, "workflow.sqlite"))
```

如果没有设置 `WF_DB` 环境变量，数据库文件将保存在 `backend/workflow.sqlite`（默认路径）。

## 操作步骤（方案一 - 持久化磁盘）

### 步骤 1：创建持久化磁盘

1. 登录 Render Dashboard: https://dashboard.render.com
2. 进入你的后端服务（Web Service）
3. 点击左侧菜单的 **"Disk"**
4. 点击 **"Link Disk"** 按钮
5. 填写信息：
   - **Name:** `workflow-db`（自定义名称）
   - **Mount Path:** `/opt/render/project/data`（或你喜欢的路径）
   - **Size:** 1 GB（根据需求调整）
6. 点击 **"Link Disk"** 完成创建

### 步骤 2：设置环境变量

1. 在服务页面，点击 **"Environment"** 标签
2. 点击 **"Add Environment Variable"**
3. 添加：
   - **Key:** `WF_DB`
   - **Value:** `/opt/render/project/data/workflow.sqlite`
4. 点击 **"Save Changes"**

### 步骤 3：验证配置

1. 服务会自动重新部署
2. 部署完成后，检查日志，应该看到数据库文件创建在指定路径
3. 测试创建一些数据，然后重新部署，确认数据没有被清空

## 验证数据库路径

部署后，可以在 Render 的日志中查看数据库文件路径。代码会在启动时打印数据库路径（如果添加了日志）。

或者，你可以在代码中临时添加日志来确认：

```python
# backend/app/config.py
print(f"Database file path: {DB_FILE}")
```

## 注意事项

1. **备份重要数据：** 即使使用了持久化磁盘，也建议定期备份数据库
2. **迁移现有数据：** 如果已经有数据在默认路径，需要手动迁移：
   - 下载现有的 `workflow.sqlite` 文件
   - 上传到新的持久化路径
3. **权限问题：** 确保挂载路径有写入权限
4. **磁盘空间：** 监控持久化磁盘的使用情况，避免空间不足

## 快速检查清单

- [ ] 创建了持久化磁盘（或使用外部数据库）
- [ ] 设置了 `WF_DB` 环境变量
- [ ] 服务已重新部署
- [ ] 测试创建数据后重新部署，数据仍然存在
- [ ] 检查日志确认数据库路径正确

