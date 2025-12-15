# 免费数据库保护方案

## 方案一：使用免费 PostgreSQL 数据库（最推荐）⭐

### 优点：
- ✅ 完全免费
- ✅ 数据永久保存，不会因部署而丢失
- ✅ 性能更好，支持并发
- ✅ 自动备份（部分服务提供）

### 推荐服务：

#### 1. Supabase（推荐）
- **免费额度**：500MB 数据库，无限 API 请求
- **注册**：https://supabase.com
- **步骤**：
  1. 注册并创建新项目
  2. 在 Settings → Database 中获取连接字符串
  3. 格式：`postgresql://postgres:[PASSWORD]@[HOST]:5432/postgres`

#### 2. Railway
- **免费额度**：$5/月免费额度，足够小型项目使用
- **注册**：https://railway.app
- **步骤**：
  1. 创建新项目
  2. 添加 PostgreSQL 数据库
  3. 获取连接字符串

#### 3. Neon
- **免费额度**：0.5GB 存储，自动暂停（可唤醒）
- **注册**：https://neon.tech
- **步骤**：
  1. 创建项目
  2. 获取连接字符串

### 配置步骤：

1. **在 Render 后端服务添加环境变量：**
   - `DATABASE_URL`: PostgreSQL 连接字符串
   - 例如：`postgresql://user:password@host:5432/dbname`

2. **代码会自动检测并使用 PostgreSQL**（见下方代码修改）

---

## 方案二：自动备份到 GitHub（简单但需手动恢复）

### 优点：
- ✅ 完全免费
- ✅ 版本控制，可以回滚
- ✅ 不需要修改数据库代码

### 缺点：
- ❌ 需要手动恢复数据
- ❌ 不是实时备份

### 实现方式：

创建一个备份脚本，定期将数据库文件上传到 GitHub：

```python
# backend/backup_db.py
import os
import shutil
import subprocess
from datetime import datetime
from .config import DB_FILE

def backup_to_github():
    """备份数据库到 GitHub"""
    if not os.path.exists(DB_FILE):
        print("数据库文件不存在")
        return
    
    # 创建备份目录
    backup_dir = os.path.join(os.path.dirname(__file__), "..", "backups")
    os.makedirs(backup_dir, exist_ok=True)
    
    # 备份文件名
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_file = os.path.join(backup_dir, f"workflow_{timestamp}.sqlite")
    
    # 复制数据库文件
    shutil.copy2(DB_FILE, backup_file)
    print(f"数据库已备份到: {backup_file}")
    
    # 可以在这里添加自动推送到 GitHub 的逻辑
    # 使用 git 命令或 GitHub API
```

---

## 方案三：使用 Render 环境变量 + 外部存储（复杂）

### 使用 GitHub Releases 存储备份
- 定期将数据库备份上传到 GitHub Releases
- 需要 GitHub Token 和自动化脚本

---

## 推荐实施方案

**强烈推荐使用方案一（PostgreSQL）**，因为：
1. 数据永久保存
2. 不需要手动备份和恢复
3. 性能更好
4. 完全免费

## 下一步

选择方案一的话，我会帮你：
1. 修改代码支持 PostgreSQL
2. 保持 SQLite 作为本地开发选项
3. 提供详细的配置步骤









