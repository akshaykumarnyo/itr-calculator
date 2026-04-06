"""Auth Endpoints — Register & Login"""
import uuid
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db
from app.core.auth import hash_password, verify_password, create_access_token, get_current_user
from app.models.schemas import RegisterRequest, LoginRequest, AuthResponse
from app.models.itr_models import User
from app.services.cache_service import cache

router = APIRouter()


def user_to_dict(user: User) -> dict:
    return {
        "id": user.id,
        "email": user.email,
        "name": user.name,
        "pan_number": user.pan_number,
        "age": user.age,
        "employment_type": user.employment_type,
        "created_at": user.created_at.isoformat(),
    }


@router.post("/register", response_model=AuthResponse)
async def register(req: RegisterRequest, db: AsyncSession = Depends(get_db)):
    # Check email unique
    result = await db.execute(select(User).where(User.email == req.email.lower()))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email already registered")

    user = User(
        id=str(uuid.uuid4()),
        email=req.email.lower(),
        name=req.name,
        hashed_password=hash_password(req.password),
        pan_number=req.pan_number,
        age=req.age,
        employment_type=req.employment_type,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    token = create_access_token({"sub": user.id})
    user_dict = user_to_dict(user)

    # Cache profile
    cache.cache_session_profile(user.id, user_dict)

    return AuthResponse(access_token=token, user=user_dict)


@router.post("/login", response_model=AuthResponse)
async def login(req: LoginRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == req.email.lower()))
    user = result.scalar_one_or_none()

    if not user or not verify_password(req.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account disabled")

    # Update last login
    user.last_login = datetime.utcnow()
    await db.commit()

    token = create_access_token({"sub": user.id})
    user_dict = user_to_dict(user)
    cache.cache_session_profile(user.id, user_dict)

    return AuthResponse(access_token=token, user=user_dict)


@router.get("/me")
async def get_me(current_user: User = Depends(get_current_user)):
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return user_to_dict(current_user)


@router.post("/logout")
async def logout(current_user: User = Depends(get_current_user)):
    if current_user:
        cache.delete(f"itr:profile:{current_user.id}")
    return {"message": "Logged out successfully"}
