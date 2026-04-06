"""API Routes"""
from fastapi import APIRouter
from app.api.endpoints import itr, chat, speech, profile, auth

router = APIRouter()
router.include_router(auth.router, prefix="/auth", tags=["Auth"])
router.include_router(itr.router, prefix="/itr", tags=["ITR"])
router.include_router(chat.router, prefix="/chat", tags=["Chat"])
router.include_router(speech.router, prefix="/speech", tags=["Speech"])
router.include_router(profile.router, prefix="/profile", tags=["Profile"])
