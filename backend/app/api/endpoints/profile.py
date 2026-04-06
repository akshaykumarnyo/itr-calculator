"""User Profile Endpoints"""
import uuid
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db
from app.models.schemas import UserProfileRequest
from app.models.itr_models import UserProfile

router = APIRouter()


@router.post("/")
async def create_or_update_profile(
    request: UserProfileRequest,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(UserProfile).where(UserProfile.session_id == request.session_id)
    )
    profile = result.scalar_one_or_none()

    if profile:
        if request.name: profile.name = request.name
        if request.pan_number: profile.pan_number = request.pan_number
        if request.age: profile.age = request.age
        if request.employment_type: profile.employment_type = request.employment_type
    else:
        profile = UserProfile(
            id=str(uuid.uuid4()),
            session_id=request.session_id,
            name=request.name,
            pan_number=request.pan_number,
            age=request.age,
            employment_type=request.employment_type,
        )
        db.add(profile)

    await db.commit()
    return {"message": "Profile saved", "session_id": request.session_id}


@router.get("/{session_id}")
async def get_profile(session_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(UserProfile).where(UserProfile.session_id == session_id)
    )
    profile = result.scalar_one_or_none()
    if not profile:
        return {"session_id": session_id, "profile": None}
    return {
        "session_id": session_id,
        "profile": {
            "name": profile.name,
            "age": profile.age,
            "employment_type": profile.employment_type,
        }
    }
