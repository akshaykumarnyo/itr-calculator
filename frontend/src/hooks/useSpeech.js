import { useState, useRef, useCallback } from 'react'
import toast from 'react-hot-toast'

export function useSpeechInput(onTranscript) {
  const [isRecording, setIsRecording] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const recognitionRef = useRef(null)

  const startRecording = useCallback(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) {
      toast.error('Speech not supported. Use Chrome or Edge.')
      return
    }
    const recognition = new SpeechRecognition()
    recognition.lang = 'en-IN'
    recognition.continuous = false
    recognition.interimResults = false
    recognition.maxAlternatives = 1

    recognition.onstart = () => { setIsRecording(true); setIsProcessing(false) }
    recognition.onresult = (e) => {
      const t = e.results[0][0].transcript
      if (t && t.length > 1) onTranscript(t)
    }
    recognition.onerror = (e) => {
      setIsRecording(false); setIsProcessing(false)
      if (e.error === 'no-speech') toast.error('No speech detected.')
      else if (e.error === 'not-allowed') toast.error('Microphone access denied.')
      else toast.error(`Speech error: ${e.error}`)
    }
    recognition.onend = () => { setIsRecording(false); setIsProcessing(false) }

    recognitionRef.current = recognition
    recognition.start()
  }, [onTranscript])

  const stopRecording = useCallback(() => {
    recognitionRef.current?.stop()
    recognitionRef.current = null
    setIsRecording(false); setIsProcessing(false)
  }, [])

  const toggleRecording = useCallback(() => {
    if (isRecording) stopRecording(); else startRecording()
  }, [isRecording, startRecording, stopRecording])

  return { isRecording, isProcessing, toggleRecording, startRecording, stopRecording }
}

export function useAudioPlayback() {
  const audioRef = useRef(null)
  const [isPlaying, setIsPlaying] = useState(false)

  const playAudio = useCallback((url) => {
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null }
    const audio = new Audio(url)
    audioRef.current = audio
    audio.onplay = () => setIsPlaying(true)
    audio.onended = () => { setIsPlaying(false); audioRef.current = null }
    audio.onerror = () => { setIsPlaying(false); audioRef.current = null }
    audio.play().catch(() => setIsPlaying(false))
  }, [])

  const stopAudio = useCallback(() => {
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; setIsPlaying(false) }
  }, [])

  return { isPlaying, playAudio, stopAudio }
}
