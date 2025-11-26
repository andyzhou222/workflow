#!/usr/bin/env bash
set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

echo "=> Building frontend..."
cd frontend
npm install
npm run build

echo "=> Copying frontend build to backend static..."
rm -rf ../backend/app/static || true
mkdir -p ../backend/app/static
cp -r dist/* ../backend/app/static/

echo "=> Setting up Python venv (python3.12 recommended)..."
cd ../backend
if [ ! -d ".venv" ]; then
  python3.12 -m venv .venv || python3 -m venv .venv
fi
source .venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt -i https://mirrors.aliyun.com/pypi/simple/

echo "=> Starting backend (uvicorn)..."
# run in foreground (Ctrl+C to stop)
python run.py
