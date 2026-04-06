import { useState, useEffect, useRef, useCallback } from 'react'
import {
  Mic, MicOff, Send, Loader2, Volume2, VolumeX,
  Trash2, Bot, Plus, History, ChevronRight,
  Sparkles, X, Zap
} from 'lucide-react'
import {
  streamChatMessage, getChatMessages, listSessions,
  deleteChatSession, synthesizeSpeech
} from '../utils/api'
import { useSpeechInput, useAudioPlayback } from '../hooks/useSpeech'
import { getSessionId } from '../utils/format'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'
import clsx from 'clsx'

// ── Markdown renderer ─────────────────────────────────────────────
function md(text) {
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong class="text-white font-semibold">$1</strong>')
    .replace(/\*(.+?)\*/g, '<em class="text-slate-300">$1</em>')
    .replace(/`(.+?)`/g, '<code class="bg-white/10 px-1.5 py-0.5 rounded text-saffron-300 text-xs font-mono">$1</code>')
    .replace(/^#{1,3}\s(.+)$/gm, '<p class="font-heading text-sm font-bold text-white mt-3 mb-1">$1</p>')
    .replace(/^[•\-\*]\s(.+)$/gm, '<div class="flex gap-2 my-1"><span class="text-saffron-400 mt-0.5 flex-shrink-0">›</span><span>$1</span></div>')
    .replace(/\n\n/g, '<br/>')
    .replace(/\n/g, '<br/>')
}

// ── Status line ──────────────────────────────────────────────────
function StatusLine({ text }) {
  return (
    <div className="flex items-center gap-2 text-xs text-slate-500 py-0.5 px-1">
      <span className="w-1.5 h-1.5 rounded-full bg-saffron-500 animate-pulse flex-shrink-0" />
      {text}
    </div>
  )
}

// ── Typing cursor ────────────────────────────────────────────────
function Cursor() {
  return <span className="inline-block w-0.5 h-3.5 bg-saffron-400 animate-pulse ml-0.5 align-middle rounded-full" />
}

// ── Message component ────────────────────────────────────────────
function Message({ msg, onPlay, playingId }) {
  const isUser = msg.role === 'user'
  const isPlaying = playingId === msg.id

  return (
    <div className={clsx('flex gap-3 group', isUser ? 'flex-row-reverse' : 'flex-row')}>
      {!isUser && (
        <div className="w-8 h-8 rounded-xl flex-shrink-0 flex items-center justify-center mt-1"
          style={{ background: 'linear-gradient(135deg,rgba(255,117,20,0.22),rgba(199,66,10,0.14))', border: '1px solid rgba(255,117,20,0.18)' }}>
          <Bot size={15} className="text-saffron-400" />
        </div>
      )}
      <div className={clsx('flex flex-col gap-1', isUser ? 'items-end max-w-[78%]' : 'items-start max-w-[84%]')}>
        <div className={isUser ? 'chat-bubble-user text-sm leading-relaxed' : 'chat-bubble-ai text-sm leading-relaxed'}
          dangerouslySetInnerHTML={{ __html: isUser ? msg.content : md(msg.content) }} />
        <div className={clsx('flex items-center gap-2 px-1 opacity-0 group-hover:opacity-100 transition-opacity',
          isUser ? 'flex-row-reverse' : 'flex-row')}>
          <span className="text-[10px] text-slate-600">
            {new Date(msg.created_at || Date.now()).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
          </span>
          {!isUser && (
            <button onClick={() => onPlay(msg.id, msg.content)}
              className="text-[10px] text-slate-500 hover:text-saffron-400 flex items-center gap-1 transition-colors">
              {isPlaying ? <><VolumeX size={10} /> Stop</> : <><Volume2 size={10} /> Listen</>}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Streaming bubble ─────────────────────────────────────────────
function StreamingBubble({ tokens, status }) {
  return (
    <div className="flex gap-3">
      <div className="w-8 h-8 rounded-xl flex-shrink-0 flex items-center justify-center mt-1"
        style={{ background: 'linear-gradient(135deg,rgba(255,117,20,0.22),rgba(199,66,10,0.14))', border: '1px solid rgba(255,117,20,0.18)' }}>
        <Sparkles size={14} className="text-saffron-400 animate-pulse" />
      </div>
      <div className="flex flex-col gap-1 max-w-[84%]">
        {status && !tokens && <StatusLine text={status} />}
        {tokens && (
          <div className="chat-bubble-ai text-sm leading-relaxed">
            <span dangerouslySetInnerHTML={{ __html: md(tokens) }} />
            <Cursor />
          </div>
        )}
        {!tokens && !status && (
          <div className="chat-bubble-ai flex items-center gap-1.5 py-3">
            {[0, 1, 2].map(i => (
              <span key={i} className="w-1.5 h-1.5 rounded-full bg-saffron-400 animate-bounce"
                style={{ animationDelay: `${i * 0.15}s` }} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Session sidebar ──────────────────────────────────────────────
function SessionSidebar({ sessions, currentId, onLoad, onDelete, onNew, onClose }) {
  return (
    <div className="absolute right-0 top-0 bottom-0 w-72 card rounded-l-none z-40 flex flex-col"
      style={{ borderLeft: '1px solid rgba(255,117,20,0.15)' }}>
      <div className="flex items-center justify-between p-4 border-b border-white/[0.05]">
        <p className="text-sm font-medium text-white">Chat History</p>
        <div className="flex items-center gap-2">
          <button onClick={onNew} className="badge-saffron text-xs cursor-pointer">+ New</button>
          <button onClick={onClose} className="text-slate-400 hover:text-white"><X size={14} /></button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {sessions.length === 0
          ? <p className="text-xs text-slate-500 text-center py-8">No sessions yet</p>
          : sessions.map(s => (
            <div key={s.id}
              className={clsx('group flex items-center gap-2 px-3 py-2.5 rounded-xl cursor-pointer transition-all',
                s.id === currentId ? 'text-saffron-400' : 'text-slate-300 hover:text-white hover:bg-white/[0.04]')}
              style={s.id === currentId ? {
                background: 'linear-gradient(135deg,rgba(255,117,20,0.12),rgba(199,66,10,0.08))',
                border: '1px solid rgba(255,117,20,0.15)'
              } : {}}
              onClick={() => onLoad(s.id)}>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate">{s.title}</p>
                <p className="text-[10px] text-slate-500 mt-0.5">
                  {new Date(s.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                </p>
              </div>
              <button onClick={e => { e.stopPropagation(); onDelete(s.id) }}
                className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-red-400 transition-all">
                <Trash2 size={12} />
              </button>
            </div>
          ))}
      </div>
    </div>
  )
}

// ── Quick questions ──────────────────────────────────────────────
const QUICK_Q = [
  'Which regime saves more for ₹12L salary + 1.5L 80C?',
  'How to calculate HRA exemption?',
  'Tax on ₹10L income under new regime?',
  'What is Section 80C and its limit?',
  'Can I claim both HRA and home loan interest?',
]

const WELCOME = {
  id: 'welcome',
  role: 'assistant',
  content: `**Namaste! 🙏 I'm your AI Tax Consultant** powered by Gemini + LangGraph.\n\nI help with:\n• **Old vs New regime** comparison for your income\n• **Section 80C, 80D, HRA** and all deductions\n• **Capital gains** tax calculation\n• **ITR filing** tips and compliance\n\nResponses stream in real-time. Ask me anything!`,
  created_at: new Date().toISOString(),
}

// ── Main ChatPage ────────────────────────────────────────────────
export default function ChatPage() {
  const { user } = useAuth()
  const [messages, setMessages] = useState([WELCOME])
  const [sessions, setSessions] = useState([])
  const [sessionId, setSessionId] = useState(getSessionId())
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [streamTokens, setStreamTokens] = useState('')
  const [statusText, setStatusText] = useState('')
  const [ttsEnabled, setTtsEnabled] = useState(true)
  const [playingId, setPlayingId] = useState(null)
  const [showHistory, setShowHistory] = useState(false)
  const bottomRef = useRef(null)
  const inputRef = useRef(null)

  const { isPlaying, playAudio, stopAudio } = useAudioPlayback()

  // Auto scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamTokens, statusText])

  // Load sessions for logged-in users
  useEffect(() => {
    if (user) {
      listSessions().then(d => setSessions(d.sessions || [])).catch(() => {})
    }
  }, [user])

  // Load session from DB/cache
  const loadSession = useCallback(async (sid) => {
    setShowHistory(false)
    try {
      const data = await getChatMessages(sid)
      const msgs = (data.messages || []).map(m => ({
        id: m.id || crypto.randomUUID(),
        role: m.role,
        content: m.content,
        created_at: m.created_at,
      }))
      setMessages(msgs.length ? msgs : [WELCOME])
      setSessionId(sid)
    } catch {
      toast.error('Could not load session')
    }
  }, [])

  // New chat session
  const newSession = useCallback(() => {
    const id = crypto.randomUUID()
    localStorage.setItem('itr_session_id', id)
    setSessionId(id)
    setMessages([WELCOME])
    setShowHistory(false)
  }, [])

  // Delete session
  const deleteSession = useCallback(async (sid) => {
    try {
      await deleteChatSession(sid)
      setSessions(prev => prev.filter(s => s.id !== sid))
      if (sid === sessionId) newSession()
      toast.success('Session deleted')
    } catch {
      toast.error('Delete failed')
    }
  }, [sessionId, newSession])

  // Play TTS for a message
  const handlePlay = useCallback(async (msgId, content) => {
    if (isPlaying && playingId === msgId) {
      stopAudio()
      setPlayingId(null)
      return
    }
    try {
      const data = await synthesizeSpeech(content.slice(0, 500))
      setPlayingId(msgId)
      playAudio(data.audio_url)
    } catch {
      toast.error('TTS unavailable. Check backend.')
    }
  }, [isPlaying, playingId, playAudio, stopAudio])

  // Voice transcript
  const handleTranscript = useCallback((text) => {
    setInput(text)
    inputRef.current?.focus()
    toast.success('Voice captured!', { duration: 1500 })
  }, [])

  const { isRecording, isProcessing, toggleRecording } = useSpeechInput(handleTranscript)

  // ── Send with SSE streaming ──────────────────────────────────
  const sendMessage = useCallback(async (text) => {
    const msg = (text || input).trim()
    if (!msg || streaming) return
    setInput('')

    const userMsg = {
      id: crypto.randomUUID(), role: 'user',
      content: msg, created_at: new Date().toISOString()
    }
    setMessages(prev => [...prev, userMsg])
    setStreaming(true)
    setStreamTokens('')
    setStatusText('')

    let finalContent = ''

    try {
      const res = await streamChatMessage(sessionId, msg, ttsEnabled)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() // keep incomplete line

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          try {
            const evt = JSON.parse(line.slice(6))
            switch (evt.type) {
              case 'session_id':
                setSessionId(evt.content)
                localStorage.setItem('itr_session_id', evt.content)
                break
              case 'status':
                setStatusText(evt.content)
                break
              case 'token':
                finalContent += evt.content
                setStreamTokens(t => t + evt.content)
                setStatusText('')
                break
              case 'extracted':
                if (evt.content && Object.keys(evt.content).length > 0) {
                  sessionStorage.setItem('extracted_itr_data', JSON.stringify(evt.content))
                  toast('📊 Tax data detected! Open Calculator to auto-fill.',
                    { duration: 5000, icon: '💡' })
                }
                break
              case 'audio':
                if (ttsEnabled && evt.content) {
                  setPlayingId('stream-' + Date.now())
                  playAudio(evt.content)
                }
                break
              case 'done':
                finalContent = evt.content || finalContent
                break
              case 'end':
              default:
                break
            }
          } catch { }
        }
      }

      // Commit final message
      if (finalContent) {
        const asstMsg = {
          id: crypto.randomUUID(), role: 'assistant',
          content: finalContent, created_at: new Date().toISOString()
        }
        setMessages(prev => [...prev, asstMsg])
      }
    } catch (err) {
      toast.error('Connection error: ' + err.message)
      setMessages(prev => [...prev, {
        id: crypto.randomUUID(), role: 'assistant',
        content: '⚠️ Error connecting to AI. Please restart the backend and check your API key.',
        created_at: new Date().toISOString()
      }])
    } finally {
      setStreaming(false)
      setStreamTokens('')
      setStatusText('')
      if (user) listSessions().then(d => setSessions(d.sessions || [])).catch(() => {})
    }
  }, [input, streaming, sessionId, ttsEnabled, playAudio, user])

  return (
    <div className="animate-fade-in relative flex flex-col h-[calc(100vh-120px)] max-w-4xl mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <div>
          <h2 className="font-heading text-2xl font-bold text-white">AI Tax Consultant</h2>
          <div className="flex items-center gap-3 mt-0.5">
            <span className="text-[10px] text-slate-500">Gemini AI · LangGraph</span>
            <span className="flex items-center gap-1 text-[10px] text-jade-400">
              <Zap size={9} />Redis Cached
            </span>
            <span className="text-[10px] text-saffron-400">● SSE Streaming</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* TTS toggle */}
          <button onClick={() => setTtsEnabled(e => !e)}
            className={clsx('flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs border transition-all',
              ttsEnabled
                ? 'text-saffron-400 border-saffron-500/30 bg-saffron-500/10'
                : 'text-slate-400 border-white/10 hover:border-white/20')}>
            <Volume2 size={12} />
            {ttsEnabled ? 'TTS On' : 'TTS Off'}
          </button>

          {/* New chat */}
          <button onClick={newSession}
            className="btn-secondary flex items-center gap-1.5 py-2 px-3 text-xs">
            <Plus size={12} />New Chat
          </button>

          {/* History */}
          {user && (
            <button onClick={() => setShowHistory(h => !h)}
              className={clsx('flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs border transition-all',
                showHistory
                  ? 'text-saffron-400 border-saffron-500/30 bg-saffron-500/10'
                  : 'text-slate-400 border-white/10 hover:border-white/20')}>
              <History size={12} />History
              <ChevronRight size={11} className={clsx('transition-transform', showHistory && 'rotate-90')} />
            </button>
          )}
        </div>
      </div>

      {/* Main area with optional history sidebar */}
      <div className="flex-1 flex gap-4 overflow-hidden relative">
        {/* Messages column */}
        <div className={clsx('flex-1 overflow-y-auto space-y-5 pr-1 transition-all', showHistory && 'mr-72')}>

          {messages.map(msg => (
            <Message key={msg.id} msg={msg} onPlay={handlePlay} playingId={playingId} />
          ))}

          {/* Live streaming */}
          {streaming && (
            <StreamingBubble tokens={streamTokens} status={statusText} />
          )}

          {/* Quick questions on fresh chat */}
          {messages.length === 1 && !streaming && (
            <div className="pt-2">
              <p className="text-xs text-slate-500 mb-3">Try asking:</p>
              <div className="flex flex-wrap gap-2">
                {QUICK_Q.map(q => (
                  <button key={q} onClick={() => sendMessage(q)}
                    className="text-xs px-3 py-1.5 rounded-full border border-white/[0.08] text-slate-400 hover:text-white hover:border-saffron-500/30 hover:bg-saffron-500/05 transition-all">
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Session history panel */}
        {showHistory && (
          <SessionSidebar
            sessions={sessions}
            currentId={sessionId}
            onLoad={loadSession}
            onDelete={deleteSession}
            onNew={newSession}
            onClose={() => setShowHistory(false)}
          />
        )}
      </div>

      {/* Input bar */}
      <div className="flex-shrink-0 mt-4">
        <div className={clsx('card p-3 flex items-end gap-3 transition-all duration-300',
          streaming && 'border-saffron-500/25')}>
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                sendMessage(input)
              }
            }}
            placeholder={
              isRecording ? '🎙️ Listening… speak now'
                : streaming ? 'Generating response…'
                : 'Ask about tax deductions, regimes, capital gains…'
            }
            rows={2}
            disabled={streaming}
            className="flex-1 bg-transparent text-sm text-slate-100 placeholder-slate-500 resize-none outline-none leading-relaxed disabled:opacity-40"
          />

          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Mic button */}
            <button
              onClick={toggleRecording}
              disabled={streaming}
              title={isRecording ? 'Stop recording' : 'Click to speak'}
              className={clsx(
                'w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-200',
                isRecording ? 'bg-red-500 mic-recording shadow-lg shadow-red-500/30'
                  : 'bg-white/[0.06] hover:bg-white/[0.1]',
                (isProcessing || streaming) && 'opacity-40 cursor-not-allowed'
              )}>
              {isProcessing
                ? <Loader2 size={15} className="animate-spin text-slate-300" />
                : isRecording
                  ? <MicOff size={15} className="text-white" />
                  : <Mic size={15} className="text-slate-300" />}
            </button>

            {/* Send button */}
            <button
              onClick={() => sendMessage(input)}
              disabled={!input.trim() || streaming}
              className={clsx(
                'w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-200',
                input.trim() && !streaming
                  ? 'bg-saffron-600 hover:bg-saffron-500 text-white shadow-lg shadow-saffron-500/25'
                  : 'bg-white/[0.04] text-slate-600 cursor-not-allowed'
              )}>
              {streaming
                ? <Loader2 size={15} className="animate-spin" />
                : <Send size={15} />}
            </button>
          </div>
        </div>

        {/* Footer hints */}
        <div className="flex items-center justify-between mt-1.5 px-1">
          <p className="text-[10px] text-slate-600">
            Enter to send · Shift+Enter new line · 🎤 voice input · 🔊 TTS output
          </p>
          {streaming && (
            <span className="flex items-center gap-1.5 text-[10px] text-saffron-400">
              <span className="w-1.5 h-1.5 rounded-full bg-saffron-400 animate-pulse" />
              Streaming…
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
