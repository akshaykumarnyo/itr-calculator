"""
ITR Calculator - Main FastAPI Application
"""
import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.core.config import settings
from app.core.database import init_db
from app.api.routes import router
from app.services.vector_store import init_vector_store


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events."""
    # Initialize database
    await init_db()
    # Initialize vector store with ITR knowledge base
    await init_vector_store()
    print("✅ ITR Calculator Backend Started")
    yield
    print("🛑 ITR Calculator Backend Shutting Down")


app = FastAPI(
    title="ITR Calculator API",
    description="AI-Powered Income Tax Return Calculator with Speech Support",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount static files (for audio output)
os.makedirs("static/audio", exist_ok=True)
app.mount("/static", StaticFiles(directory="static"), name="static")

# Include all routers
app.include_router(router, prefix="/api/v1")


@app.get("/")
async def root():
    return {
        "message": "ITR Calculator API",
        "version": "1.0.0",
        "docs": "/docs",
    }


@app.get("/health")
async def health():
    return {"status": "healthy"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
    )
