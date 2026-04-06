#!/bin/bash
set -e

echo "🇮🇳 ITR Calculator — Quick Start"
echo "================================="

# Check prerequisites
command -v python3 >/dev/null 2>&1 || { echo "❌ Python 3.11+ required"; exit 1; }
command -v node >/dev/null 2>&1 || { echo "❌ Node.js 18+ required"; exit 1; }

# Backend setup
echo ""
echo "📦 Setting up Backend..."
cd backend

if [ ! -d "venv" ]; then
    python3 -m venv venv
    echo "✅ Virtual environment created"
fi

source venv/bin/activate
pip install -r requirements.txt -q
echo "✅ Python dependencies installed"

if [ ! -f ".env" ]; then
    cp .env.example .env
    echo ""
    echo "⚠️  IMPORTANT: Edit backend/.env and add your GOOGLE_API_KEY"
    echo "   Get it from: https://aistudio.google.com/app/apikey"
    echo ""
    read -p "Press Enter after you've added your API key..."
fi

# Start backend in background
uvicorn main:app --reload --port 8000 &
BACKEND_PID=$!
echo "✅ Backend started (PID: $BACKEND_PID)"

# Frontend setup
cd ../frontend
echo ""
echo "📦 Setting up Frontend..."

if [ ! -d "node_modules" ]; then
    npm install -q
    echo "✅ Node dependencies installed"
fi

# Start frontend
npm run dev &
FRONTEND_PID=$!
echo "✅ Frontend started (PID: $FRONTEND_PID)"

echo ""
echo "🚀 ITR Calculator is running!"
echo "================================="
echo "   Frontend: http://localhost:3000"
echo "   Backend:  http://localhost:8000"
echo "   API Docs: http://localhost:8000/docs"
echo ""
echo "Press Ctrl+C to stop all servers"

# Wait and cleanup
trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; echo '🛑 Stopped'; exit" INT TERM
wait
