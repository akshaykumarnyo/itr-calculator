import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import Layout from './components/Layout'
import AuthPage from './pages/AuthPage'
import HomePage from './pages/HomePage'
import CalculatorPage from './pages/CalculatorPage'
import ChatPage from './pages/ChatPage'
import ResultPage from './pages/ResultPage'
import { Loader2 } from 'lucide-react'

function Spinner() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <Loader2 size={32} className="animate-spin text-saffron-500" />
        <p className="text-slate-400 text-sm">Loading…</p>
      </div>
    </div>
  )
}

export default function App() {
  const { loading } = useAuth()
  if (loading) return <Spinner />

  return (
    <Routes>
      {/* Public auth page (no layout) */}
      <Route path="/auth" element={<AuthPage />} />

      {/* App pages with sidebar layout */}
      <Route element={<Layout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/calculator" element={<CalculatorPage />} />
        <Route path="/chat" element={<ChatPage />} />
        <Route path="/result" element={<ResultPage />} />
      </Route>

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
