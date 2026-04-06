"""Speech Endpoints"""
from fastapi import APIRouter, UploadFile, File, HTTPException, Query
from app.services.speech_service import speech_to_text, text_to_speech
from app.models.schemas import SpeechToTextResponse

router = APIRouter()

@router.post("/transcribe", response_model=SpeechToTextResponse)
async def transcribe_audio(audio: UploadFile = File(...)):
    content = await audio.read()
    if len(content) > 10 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="Audio file too large (max 10MB)")
    result = await speech_to_text(content, audio.filename or "audio.wav")
    return SpeechToTextResponse(
        transcript=result.get("transcript", ""),
        confidence=result.get("confidence", 0.0),
        language=result.get("language", "en"),
    )

@router.post("/synthesize")
async def synthesize_speech(
    text: str = Query(..., max_length=2000),
    lang: str = Query("en"),
):
    if not text.strip():
        raise HTTPException(status_code=400, detail="Text required")
    audio_url = await text_to_speech(text, lang)
    return {"audio_url": audio_url}
