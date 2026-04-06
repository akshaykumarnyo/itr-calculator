"""Chat Endpoints — Streaming SSE + Redis + DB history + gTTS"""
import uuid
from typing import Optional
from fastapi import APIRouter, Depends, Request
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import json

from app.core.database import get_db
from app.core.auth import get_current_user
from app.models.schemas import ChatRequest, ChatResponse
from app.models.itr_models import ChatSession, ChatMessage, User
from app.agents.itr_agent import stream_itr_response, run_itr_agent
from app.services.speech_service import text_to_speech
from app.services.cache_service import cache

router = APIRouter()


# ── Streaming endpoint (SSE) ─────────────────────────────────────

@router.post("/stream")
async def stream_message(
    req: ChatRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user),
):
    """
    Stream AI response token-by-token using Server-Sent Events.
    Frontend reads this with EventSource or fetch + ReadableStream.
    """
    session_id = req.session_id or str(uuid.uuid4())
    user_id = current_user.id if current_user else None

    # Ensure session exists in DB
    result = await db.execute(select(ChatSession).where(ChatSession.id == session_id))
    session = result.scalar_one_or_none()
    if not session:
        session = ChatSession(
            id=session_id,
            user_id=user_id,
            title=req.message[:40] + ("…" if len(req.message) > 40 else ""),
        )
        db.add(session)
        await db.flush()

    # Save user message to DB
    user_msg_id = str(uuid.uuid4())
    user_msg = ChatMessage(
        id=user_msg_id,
        session_id=session_id,
        user_id=user_id,
        role="user",
        content=req.message,
    )
    db.add(user_msg)
    await db.commit()

    # Load chat history from Redis cache first, then DB
    cached_history = cache.get_cached_chat_history(session_id)
    if not cached_history:
        history_result = await db.execute(
            select(ChatMessage)
            .where(ChatMessage.session_id == session_id)
            .order_by(ChatMessage.created_at)
            .limit(20)
        )
        cached_history = [
            {"role": m.role, "content": m.content}
            for m in history_result.scalars().all()
        ]

    async def event_generator():
        full_response = ""
        extracted_data = None
        # Yield session_id first so frontend knows it
        yield f"data: {json.dumps({'type': 'session_id', 'content': session_id})}\n\n"

        async for chunk in stream_itr_response(req.message, cached_history, session_id):
            yield chunk
            # Parse to capture final state
            try:
                raw = chunk.replace("data: ", "").strip()
                parsed = json.loads(raw)
                if parsed.get("type") == "done":
                    full_response = parsed.get("content", "")
                    extracted_data = parsed.get("extracted_data")
            except Exception:
                pass

        # Generate TTS audio if requested
        audio_url = None
        if req.include_audio and full_response:
            try:
                audio_url = await text_to_speech(full_response)
                yield f"data: {json.dumps({'type': 'audio', 'content': audio_url})}\n\n"
            except Exception:
                pass

        # Save assistant message to DB
        if full_response:
            try:
                asst_msg = ChatMessage(
                    id=str(uuid.uuid4()),
                    session_id=session_id,
                    user_id=user_id,
                    role="assistant",
                    content=full_response,
                    audio_url=audio_url,
                    extra_data={"extracted_data": extracted_data},
                )
                async with db.begin_nested():
                    db.add(asst_msg)
                await db.commit()
            except Exception:
                pass

        yield f"data: {json.dumps({'type': 'end'})}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )


# ── Non-streaming fallback ───────────────────────────────────────

@router.post("/message", response_model=ChatResponse)
async def send_message(
    req: ChatRequest,
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user),
):
    session_id = req.session_id or str(uuid.uuid4())
    user_id = current_user.id if current_user else None

    result = await db.execute(select(ChatSession).where(ChatSession.id == session_id))
    session = result.scalar_one_or_none()
    if not session:
        session = ChatSession(id=session_id, user_id=user_id,
                              title=req.message[:40])
        db.add(session)
        await db.flush()

    # Load history (Redis → DB fallback)
    cached_history = cache.get_cached_chat_history(session_id)
    if not cached_history:
        hr = await db.execute(
            select(ChatMessage)
            .where(ChatMessage.session_id == session_id)
            .order_by(ChatMessage.created_at).limit(20)
        )
        cached_history = [{"role": m.role, "content": m.content} for m in hr.scalars().all()]

    user_msg = ChatMessage(id=str(uuid.uuid4()), session_id=session_id,
                           user_id=user_id, role="user", content=req.message)
    db.add(user_msg)

    agent_result = await run_itr_agent(req.message, cached_history, session_id)
    response_text = agent_result["response"]

    audio_url = None
    if req.include_audio:
        try:
            audio_url = await text_to_speech(response_text)
        except Exception:
            pass

    msg_id = str(uuid.uuid4())
    asst_msg = ChatMessage(id=msg_id, session_id=session_id, user_id=user_id,
                           role="assistant", content=response_text,
                           audio_url=audio_url,
                           extra_data={"extracted_data": agent_result.get("extracted_data")})
    db.add(asst_msg)
    await db.commit()

    # Update Redis cache
    updated = cached_history + [
        {"role": "user", "content": req.message},
        {"role": "assistant", "content": response_text},
    ]
    cache.cache_chat_history(session_id, updated)

    return ChatResponse(session_id=session_id, message_id=msg_id,
                        response=response_text, audio_url=audio_url,
                        extracted_data=agent_result.get("extracted_data"))


# ── Session history ──────────────────────────────────────────────

@router.get("/sessions")
async def list_sessions(
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user),
):
    if not current_user:
        return {"sessions": []}
    result = await db.execute(
        select(ChatSession)
        .where(ChatSession.user_id == current_user.id)
        .order_by(ChatSession.created_at.desc())
        .limit(20)
    )
    sessions = result.scalars().all()
    return {"sessions": [
        {"id": s.id, "title": s.title, "created_at": s.created_at.isoformat()}
        for s in sessions
    ]}


@router.get("/sessions/{session_id}/messages")
async def get_messages(session_id: str, db: AsyncSession = Depends(get_db)):
    # Try Redis first
    cached = cache.get_cached_chat_history(session_id)
    if cached:
        return {"session_id": session_id, "messages": cached, "source": "cache"}

    result = await db.execute(
        select(ChatMessage)
        .where(ChatMessage.session_id == session_id)
        .order_by(ChatMessage.created_at)
    )
    messages = result.scalars().all()
    msgs = [{"id": m.id, "role": m.role, "content": m.content,
             "audio_url": m.audio_url, "created_at": m.created_at.isoformat()}
            for m in messages]

    # Populate cache
    cache.cache_chat_history(session_id, [{"role": m["role"], "content": m["content"]} for m in msgs])
    return {"session_id": session_id, "messages": msgs, "source": "db"}


@router.delete("/sessions/{session_id}")
async def delete_session(session_id: str, db: AsyncSession = Depends(get_db)):
    from sqlalchemy import delete
    await db.execute(delete(ChatMessage).where(ChatMessage.session_id == session_id))
    await db.execute(delete(ChatSession).where(ChatSession.id == session_id))
    await db.commit()
    cache.invalidate_chat_cache(session_id)
    return {"message": "Session deleted"}
