import { useNavigate } from 'react-router-dom'
import { Calculator, MessageSquare, Mic, Brain, Shield, Zap, ArrowRight, IndianRupee, Lock, Radio } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

const features = [
  { icon: Brain, title: 'Gemini AI + LangGraph', desc: 'Multi-step reasoning agent retrieves tax knowledge and streams responses token by token' },
  { icon: Radio, title: 'SSE Streaming', desc: 'Real-time token streaming so you see the response as it generates — no waiting' },
  { icon: Zap, title: 'Redis Caching', desc: 'Vector searches and calculations cached in Redis for instant repeated queries' },
  { icon: Mic, title: 'Voice Input + gTTS', desc: 'Speak your income details with browser STT; AI responses read aloud via Google TTS' },
  { icon: Lock, title: 'User Auth + History', desc: 'Register, login, and all your chat sessions and tax calculations are saved to your account' },
  { icon: Shield, title: 'All Deductions Covered', desc: 'Section 80C, 80D, HRA, home loan, NPS — every deduction with smart optimization tips' },
]

export default function HomePage() {
  const nav = useNavigate()
  const { user } = useAuth()

  return (
    <div className="animate-fade-in">
      {/* Hero */}
      <div className="text-center py-16">
        <div className="inline-flex items-center gap-2 badge-saffron mb-6">
          <span className="w-1.5 h-1.5 rounded-full bg-saffron-400 animate-pulse" />
          AY 2024-25 · Streaming · Redis · Auth
        </div>
        <h1 className="font-heading text-5xl md:text-6xl font-bold text-white leading-tight mb-4">
          AI-Powered ITR<br />
          <span className="text-gradient">Calculator & Advisor</span>
        </h1>
        <p className="text-slate-400 text-lg max-w-xl mx-auto mb-10 leading-relaxed">
          Chat with an AI CA, get streaming responses, voice input, gTTS audio output,
          and smart tax optimization — all in one place.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-4">
          <button onClick={() => nav('/calculator')} className="btn-primary flex items-center gap-2 text-base">
            <Calculator size={18} />Start Calculating<ArrowRight size={16} />
          </button>
          <button onClick={() => nav('/chat')} className="btn-secondary flex items-center gap-2 text-base">
            <MessageSquare size={18} />Chat with AI CA
          </button>
          {!user && (
            <button onClick={() => nav('/auth')} className="btn-secondary flex items-center gap-2 text-base border-saffron-500/30 text-saffron-400">
              <Lock size={16} />Sign In / Register
            </button>
          )}
        </div>
        {user && (
          <p className="mt-6 text-sm text-jade-400">
            Welcome back, <strong>{user.name}</strong>! Your sessions are saved. 🙏
          </p>
        )}
      </div>

      <div className="glow-divider my-12" />

      {/* Features */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-16">
        {features.map(({ icon: Icon, title, desc }) => (
          <div key={title} className="card hover:border-saffron-500/20 transition-all duration-300 group">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4"
              style={{ background: 'rgba(255,117,20,0.1)', border: '1px solid rgba(255,117,20,0.15)' }}>
              <Icon size={18} className="text-saffron-400" />
            </div>
            <h3 className="font-heading text-base font-bold text-white mb-1">{title}</h3>
            <p className="text-sm text-slate-400 leading-relaxed">{desc}</p>
          </div>
        ))}
      </div>

      {/* Tech Stack */}
      <div className="card mb-8">
        <h3 className="section-title text-center">Tech Stack</h3>
        <div className="flex flex-wrap justify-center gap-3">
          {['FastAPI', 'LangGraph', 'Gemini AI', 'ChromaDB', 'SQLite', 'Redis', 'React', 'gTTS', 'JWT Auth', 'SSE Streaming'].map(t => (
            <span key={t} className="badge-saffron">{t}</span>
          ))}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { value: '₹7L', label: 'Tax-free (New Regime)' },
          { value: '₹1.5L', label: '80C Max Deduction' },
          { value: '30%', label: 'Peak Tax Rate' },
          { value: '4%', label: 'Health & Ed Cess' },
        ].map(({ value, label }) => (
          <div key={label} className="card text-center">
            <p className="font-heading text-2xl font-bold text-gradient mb-1">{value}</p>
            <p className="text-xs text-slate-400">{label}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
