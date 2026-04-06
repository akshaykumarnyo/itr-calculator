"""Application Configuration"""
from typing import List
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    GOOGLE_API_KEY: str = ""
    DATABASE_URL: str = "sqlite:///./itr_calculator.db"
    CHROMA_PERSIST_DIRECTORY: str = "./chroma_db"
    SECRET_KEY: str = "change-me-in-production-use-long-random-string"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 hours
    CORS_ORIGINS: List[str] = ["http://localhost:3000", "http://localhost:5173"]
    DEBUG: bool = True
    GEMINI_MODEL: str = "gemini-1.5-flash"
    AUDIO_OUTPUT_DIR: str = "static/audio"
    REDIS_HOST: str = "localhost"
    REDIS_PORT: int = 6379
    REDIS_DB: int = 0

    class Config:
        env_file = ".env"
        case_sensitive = True

settings = Settings()
