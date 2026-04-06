"""Speech Service — gTTS for output, browser STT for input"""
import os, uuid, re, tempfile
from pathlib import Path
from gtts import gTTS
from app.core.config import settings

async def text_to_speech(text: str, lang: str = "en") -> str:
    os.makedirs(settings.AUDIO_OUTPUT_DIR, exist_ok=True)
    filename = f"tts_{uuid.uuid4().hex[:8]}.mp3"
    filepath = os.path.join(settings.AUDIO_OUTPUT_DIR, filename)
    clean = _clean(text)
    tts = gTTS(text=clean, lang=lang, slow=False)
    tts.save(filepath)
    return f"/static/audio/{filename}"

def _clean(text: str) -> str:
    text = re.sub(r'\*\*(.+?)\*\*', r'\1', text)
    text = re.sub(r'\*(.+?)\*', r'\1', text)
    text = re.sub(r'#{1,6}\s?', '', text)
    text = re.sub(r'`(.+?)`', r'\1', text)
    text = re.sub(r'[₹]([0-9,]+)', lambda m: "rupees " + m.group(1).replace(',',''), text)
    text = re.sub(r'^[*\-]\s', '', text, flags=re.MULTILINE)
    text = re.sub(r'\n+', '. ', text)
    return text[:600].strip()

async def speech_to_text(audio_bytes: bytes, filename: str = "audio.wav") -> dict:
    try:
        import speech_recognition as sr
        suffix = Path(filename).suffix.lower() or ".wav"
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            tmp.write(audio_bytes)
            tmp_path = tmp.name
        recognizer = sr.Recognizer()
        try:
            with sr.AudioFile(tmp_path) as source:
                audio_data = recognizer.record(source)
            text = recognizer.recognize_google(audio_data, language="en-IN")
            os.unlink(tmp_path)
            return {"transcript": text.strip(), "confidence": 0.9, "language": "en"}
        except Exception as e:
            try: os.unlink(tmp_path)
            except: pass
            return {"transcript": "", "confidence": 0.0, "language": "en", "error": str(e)}
    except ImportError:
        return {"transcript": "", "confidence": 0.0, "language": "en",
                "error": "Use browser mic (Web Speech API)"}
