# PostgreSQL 免费数据库配置指南

## 🎯 推荐方案：使用 Supabase（完全免费）

### 第一步：注册并创建 Supabase 项目

1. **访问 Supabase**
   - 网址：https://supabase.com
   - 点击 "Start your project" 或 "Sign up"

2. **创建新项目**
   - 点击 "New Project"
   - 填写项目信息：
     - **Name**: workflow-db（自定义名称）
     - **Database Password**: 设置一个强密码（**重要：请保存好这个密码**）
     - **Region**: 选择离你最近的区域（如 Southeast Asia）
   - 点击 "Create new project"
   - 等待 1-2 分钟，项目创建完成

3. **获取数据库连接字符串**
   - 在项目页面，点击左侧菜单 "Settings" → "Database"
   - 找到 "Connection string" 部分
   - 选择 "URI" 标签
   - 复制连接字符串，格式类似：
     ```
     postgresql://postgres:[YOUR-PASSWORD]@db.xxxxx.supabase.co:5432/postgres
     ```
   - **重要**：将 `[YOUR-PASSWORD]` 替换为你创建项目时设置的密码

### 第二步：在 Render 上配置环境变量

1. **登录 Render Dashboard**
   - 网址：https://dashboard.render.com
   - 进入你的后端服务（Web Service）

2. **添加环境变量**
   - 点击 "Environment" 标签
   - 点击 "Add Environment Variable"
   - 添加以下变量：
     - **Key**: `DATABASE_URL`
     - **Value**: 粘贴从 Supabase 复制的连接字符串（已替换密码）
     - 例如：
       ```
       postgresql://postgres:your_password_here@db.xxxxx.supabase.co:5432/postgres
       ```
   - 点击 "Save Changes"

3. **重新部署服务**
   - Render 会自动检测到环境变量变化并重新部署
   - 或者手动点击 "Manual Deploy" → "Deploy latest commit"
   - 等待部署完成（2-5 分钟）

### 第三步：验证配置

1. **查看部署日志**
   - 在 Render 服务页面，点击 "Logs" 标签
   - 应该能看到：
     ```
     [Database Config] Using PostgreSQL: db.xxxxx.supabase.co
     ```
   - 如果看到这个，说明配置成功！

2. **测试应用**
   - 访问你的应用
   - 尝试登录或注册
   - 如果一切正常，说明数据库连接成功

---

## 🔄 从 SQLite 迁移数据（可选）

如果你已经有 SQLite 数据库中的数据，可以迁移到 PostgreSQL：

### 方法一：使用 pgloader（推荐）

1. **安装 pgloader**
   ```bash
   # macOS
   brew install pgloader
   
   # Linux
   sudo apt-get install pgloader
   ```

2. **迁移数据**
   ```bash
   pgloader sqlite:///path/to/workflow.sqlite postgresql://postgres:password@host:5432/postgres
   ```

### 方法二：手动导出导入（简单数据）

如果数据不多，可以：
1. 在应用中手动重新创建数据
2. 或者使用 SQLite 导出工具导出为 SQL，然后导入 PostgreSQL

---

## 🆓 其他免费 PostgreSQL 选项

### Railway（推荐备选）

1. **注册 Railway**
   - 网址：https://railway.app
   - 使用 GitHub 账号登录

2. **创建 PostgreSQL 数据库**
   - 点击 "New Project"
   - 选择 "Provision PostgreSQL"
   - 等待创建完成

3. **获取连接字符串**
   - 点击 PostgreSQL 服务
   - 在 "Variables" 标签中找到 `DATABASE_URL`
   - 复制这个值

4. **在 Render 中配置**
   - 同样添加 `DATABASE_URL` 环境变量
   - 值就是 Railway 提供的连接字符串

### Neon（另一个选择）

1. **注册 Neon**
   - 网址：https://neon.tech
   - 使用 GitHub 账号登录

2. **创建项目**
   - 创建新项目
   - 获取连接字符串

3. **配置方式同 Supabase**

---

## ✅ 配置完成后的优势

- ✅ **数据永久保存**：不会因重新部署而丢失
- ✅ **自动备份**：Supabase 等服务提供自动备份
- ✅ **性能更好**：PostgreSQL 比 SQLite 性能更好
- ✅ **支持并发**：可以处理多个用户同时访问
- ✅ **完全免费**：免费额度足够小型项目使用

---

## 🐛 常见问题

### Q: 连接失败怎么办？
A: 检查以下几点：
1. 连接字符串中的密码是否正确
2. Supabase 项目是否已完全创建（等待 1-2 分钟）
3. 网络是否正常
4. 查看 Render 日志中的错误信息

### Q: 如何查看数据库中的数据？
A: 在 Supabase 项目中：
- 点击左侧 "Table Editor" 可以查看和编辑数据
- 点击 "SQL Editor" 可以执行 SQL 查询

### Q: 免费额度够用吗？
A: Supabase 免费额度：
- 500MB 数据库存储
- 2GB 带宽/月
- 50,000 每月活跃用户
- 对于小型项目完全够用

### Q: 本地开发怎么办？
A: 本地开发仍然使用 SQLite：
- 不设置 `DATABASE_URL` 环境变量
- 代码会自动使用 SQLite
- 生产环境使用 PostgreSQL

---

## 📝 总结

1. ✅ 注册 Supabase 并创建项目
2. ✅ 获取数据库连接字符串
3. ✅ 在 Render 后端服务添加 `DATABASE_URL` 环境变量
4. ✅ 重新部署服务
5. ✅ 验证配置成功

完成这些步骤后，你的数据库就受到保护了，不会再因重新部署而丢失数据！

