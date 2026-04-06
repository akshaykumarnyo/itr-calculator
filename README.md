# 🇮🇳 ITR Calculator — AI-Powered Income Tax Assistant

A full-stack Indian Income Tax Return (ITR) calculator with AI chat, speech-to-text input, text-to-speech output, vector search, and smart optimization tips.

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    FRONTEND (React + Vite)                   │
│  HomePage │ CalculatorPage │ ChatPage │ ResultPage           │
│  Speech Input (Whisper) │ TTS Output (gTTS)                  │
└─────────────────────────┬───────────────────────────────────┘
                          │ HTTP / REST API
┌─────────────────────────▼───────────────────────────────────┐
│                   BACKEND (FastAPI)                          │
│  /api/v1/itr  │  /api/v1/chat  │  /api/v1/speech           │
└──────┬──────────────────┬──────────────────────┬────────────┘
       │                  │                      │
┌──────▼──────┐  ┌────────▼───────┐  ┌──────────▼─────────┐
│  SQLite DB  │  │  LangGraph     │  │  ChromaDB           │
│  (SQLAlch.) │  │  ITR Agent     │  │  Vector Store       │
│             │  │                │  │  (ITR Knowledge)    │
│  - calcs    │  │  retrieve →    │  │                     │
│  - chats    │  │  extract →     │  │  Embedding:         │
│  - users    │  │  advise →      │  │  Google Embed-001   │
└─────────────┘  │  respond       │  └─────────────────────┘
                 └───────┬────────┘
                         │
                ┌────────▼────────┐
                │  Gemini 1.5     │
                │  Flash (LLM)    │
                └─────────────────┘
```

---

## ⚡ Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Vite, Tailwind CSS, Recharts, Framer Motion |
| Backend | FastAPI, Python 3.11+ |
| AI/LLM | Google Gemini 1.5 Flash |
| Agent Framework | LangGraph (multi-step reasoning) |
| RAG | LangChain + ChromaDB (vector store) |
| Embeddings | Google `embedding-001` |
| Database | SQLite (via SQLAlchemy async + aiosqlite) |
| Speech-to-Text | OpenAI Whisper (local, `base` model) |
| Text-to-Speech | gTTS (Google Text-to-Speech) |

---

## 📁 Project Structure

```
itr-calculator/
├── backend/
│   ├── main.py                    # FastAPI app entry point
│   ├── requirements.txt
│   ├── .env.example
│   └── app/
│       ├── core/
│       │   ├── config.py          # Settings (Pydantic BaseSettings)
│       │   └── database.py        # SQLite + SQLAlchemy async
│       ├── models/
│       │   ├── itr_models.py      # DB ORM models
│       │   └── schemas.py         # Pydantic request/response schemas
│       ├── services/
│       │   ├── tax_calculator.py  # ITR engine (Old & New regime)
│       │   ├── vector_store.py    # ChromaDB + RAG knowledge base
│       │   └── speech_service.py  # Whisper STT + gTTS TTS
│       ├── agents/
│       │   └── itr_agent.py       # LangGraph agent (4-node graph)
│       └── api/
│           ├── routes.py
│           └── endpoints/
│               ├── itr.py         # Tax calculation endpoints
│               ├── chat.py        # AI chat endpoints
│               ├── speech.py      # STT/TTS endpoints
│               └── profile.py     # User profile endpoints
│
└── frontend/
    ├── index.html
    ├── vite.config.js
    ├── tailwind.config.js
    ├── package.json
    └── src/
        ├── main.jsx
        ├── App.jsx
        ├── index.css
        ├── utils/
        │   ├── api.js             # Axios API client
        │   └── format.js          # INR formatter, helpers
        ├── hooks/
        │   ├── useSpeech.js       # Recording + TTS hooks
        │   └── useITRForm.js      # Form state + submit logic
        ├── components/
        │   └── Layout.jsx         # Sidebar + mobile nav
        └── pages/
            ├── HomePage.jsx       # Landing page
            ├── CalculatorPage.jsx # Full ITR form
            ├── ChatPage.jsx       # AI chat with voice
            └── ResultPage.jsx     # Results + charts + AI advice
```

---

## 🚀 Setup & Installation

### Prerequisites
- Python 3.11+
- Node.js 18+
- Google Gemini API Key → https://aistudio.google.com/app/apikey
- ffmpeg (for Whisper audio processing)

### 1. Clone / Extract the Project

```bash
cd itr-calculator
```

### 2. Backend Setup

```bash
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate        # Linux/Mac
# venv\Scripts\activate         # Windows

# Install dependencies
pip install -r requirements.txt

# Install ffmpeg (required by Whisper)
# Ubuntu/Debian:
sudo apt install ffmpeg
# Mac:
brew install ffmpeg
# Windows: https://ffmpeg.org/download.html

# Configure environment
cp .env.example .env
# Edit .env and set your GOOGLE_API_KEY

# Start backend
uvicorn main:app --reload --port 8000
```

Backend will be available at: http://localhost:8000
API docs at: http://localhost:8000/docs

### 3. Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev
```

Frontend will be available at: http://localhost:3000

---

## 🔑 Environment Variables

Create `backend/.env` from `.env.example`:

```env
GOOGLE_API_KEY=your_gemini_api_key_here
DATABASE_URL=sqlite:///./itr_calculator.db
CHROMA_PERSIST_DIRECTORY=./chroma_db
SECRET_KEY=your-secret-key
DEBUG=True
CORS_ORIGINS=["http://localhost:3000"]
GEMINI_MODEL=gemini-1.5-flash
```

---

## 🧠 LangGraph Agent Flow

The ITR AI agent uses a 4-node graph:

```
User Message
     │
     ▼
[retrieve]  ←── ChromaDB vector search for relevant tax law
     │
     ▼
[extract]   ←── Gemini extracts financial data from natural language
     │
     ├── (has financial data?) ──▶ [tax_advice] ──▶ [respond]
     │
     └── (no data) ──────────────────────────────▶ [respond]
```

---

## 📊 ITR Calculation Features

### Income Sources
- Salary / Pension
- House Property (including losses)
- Business / Professional Income
- Short Term Capital Gains (20% post Budget 2024)
- Long Term Capital Gains (12.5% above ₹1.25L)
- Other Income

### Deductions (Old Regime)
- Section 80C (PPF, ELSS, LIC, NSC) — max ₹1.5L
- Section 80D (Health Insurance) — up to ₹1L
- Section 80E (Education Loan) — unlimited
- Section 80G (Donations) — varies
- Section 80TTA (Savings Interest) — max ₹10K
- HRA Exemption
- Home Loan Interest Section 24(b) — max ₹2L
- Standard Deduction — ₹50K (old) / ₹75K (new)

### Tax Components
- Base Tax (as per slabs)
- Surcharge (10–37% based on income)
- Health & Education Cess (4%)
- Section 87A Rebate
- TDS & Advance Tax adjustment

---

## 🎤 Speech Features

**Speech-to-Text (STT)**
- Uses OpenAI Whisper `base` model locally
- Supports: WebM, MP3, WAV, M4A, OGG
- Automatically extracts financial data from spoken queries

**Text-to-Speech (TTS)**
- Uses Google Text-to-Speech (gTTS)
- Available for all AI assistant responses
- Audio files served as static MP3s

---

## 📡 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/itr/calculate` | Calculate ITR |
| GET | `/api/v1/itr/history/{session_id}` | Calculation history |
| GET | `/api/v1/itr/regimes/compare` | Quick regime comparison |
| POST | `/api/v1/chat/message` | Send chat message |
| GET | `/api/v1/chat/sessions/{id}/messages` | Get chat history |
| POST | `/api/v1/speech/transcribe` | Audio → Text (Whisper) |
| POST | `/api/v1/speech/synthesize` | Text → Audio (gTTS) |
| POST | `/api/v1/profile/` | Save user profile |
| GET | `/api/v1/profile/{session_id}` | Get user profile |

---

## 🏭 Production Deployment

```bash
# Backend
pip install gunicorn
gunicorn main:app -w 4 -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:8000

# Frontend
npm run build
# Serve dist/ with nginx or any static server

# Use PostgreSQL instead of SQLite for production
# DATABASE_URL=postgresql+asyncpg://user:pass@localhost/itr_db
```

---

## 📝 License

MIT License — Free for personal and commercial use.

---

## 🙏 Acknowledgements

- Google Gemini API for LLM
- OpenAI Whisper for STT
- LangChain & LangGraph for agent framework
- ChromaDB for vector storage
- FastAPI for high-performance async API
