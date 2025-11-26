#!/bin/bash
# 启动后端服务器的脚本（使用虚拟环境）

cd "$(dirname "$0")"

# 激活虚拟环境
if [ -d ".venv" ]; then
    source .venv/bin/activate
    echo "✓ Virtual environment activated"
else
    echo "✗ Virtual environment not found. Please run: python3 -m venv .venv"
    exit 1
fi

# 检查 bcrypt 是否安装
python -c "from passlib.context import CryptContext; ctx = CryptContext(schemes=['bcrypt']); print('✓ bcrypt is available')" 2>/dev/null || {
    echo "✗ bcrypt not available. Installing dependencies..."
    pip install -r requirements.txt
}

# 启动服务器
echo "=> Starting backend server..."
python run.py

