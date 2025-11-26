#!/bin/bash
# 切换到后端目录
cd backend

# 安装依赖
pip install -r requirements.txt

# 启动 FastAPI
uvicorn main:app --host 0.0.0.0 --port $PORT
