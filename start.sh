#!/bin/bash
set -e

echo "========== START DEPLOY =========="

# 打印环境变量
echo "PORT=$PORT"
echo "DATABASE_URL=$DATABASE_URL"

# 进入后端目录
cd backend

echo "Installing dependencies..."
pip install -r requirements.txt

echo "Starting FastAPI server..."
# 阻塞运行，打印所有日志
exec uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000} --log-level debug

echo "========== END DEPLOY =========="
