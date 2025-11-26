#!/bin/bash

echo "🧹 Step 1: Create or update .gitignore..."
cat > .gitignore << 'EOF'
# Python
__pycache__/
*.pyc
*.pyo
*.pyd
.venv/
env/
venv/

# FastAPI uploads
uploads/

# SQLite database
*.sqlite
*.db

# Node / Frontend
node_modules/
dist/
build/

# Mac system files
.DS_Store

# Logs
*.log
EOF
echo "✔ .gitignore updated"

echo "📦 Step 2: Add all project files..."
git add .

echo "📝 Step 3: Commit files..."
git commit -m "Initial project upload (frontend + backend)"

echo "🚀 Step 4: Push to GitHub..."
git branch -M main
git push -u origin main

echo "🎉 Done! Code pushed successfully."
