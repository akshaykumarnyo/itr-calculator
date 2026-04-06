import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { IndianRupee, Eye, EyeOff, Loader2, User, Mail, Lock, Briefcase } from 'lucide-react'
import { register, login } from '../utils/api'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'
import clsx from 'clsx'

export default function AuthPage() {
  const [mode, setMode] = useState('login') // login | register
  const [show, setShow] = useState(false)
  const [loading, setLoading] = useState(false)
  const { loginUser } = useAuth()
  const nav = useNavigate()

  const [form, setForm] = useState({
    email: '', name: '', password: '', pan_number: '', age: '', employment_type: 'salaried'
  })

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const submit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const payload = mode === 'login'
        ? { email: form.email, password: form.password }
        : { ...form, age: form.age ? parseInt(form.age) : undefined }

      const fn = mode === 'login' ? login : register
      const data = await fn(payload)

      loginUser(data.access_token, data.user)
      toast.success(mode === 'login' ? `Welcome back, ${data.user.name}!` : `Account created! Welcome, ${data.user.name}!`)
      nav('/')
    } catch (err) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4"
      style={{
        background: 'radial-gradient(ellipse at 30% 50%, rgba(255,117,20,0.08) 0%, transparent 60%), #040a15'
      }}>
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-4"
            style={{ background: 'linear-gradient(135deg,#ff7514,#c7420a)', boxShadow: '0 8px 24px rgba(255,117,20,0.3)' }}>
            <IndianRupee size={28} className="text-white" />
          </div>
          <h1 className="font-heading text-3xl font-bold text-white">ITR Calculator</h1>
          <p className="text-slate-400 text-sm mt-1">AI-Powered Tax Assistant</p>
        </div>

        {/* Card */}
        <div className="card">
          {/* Tabs */}
          <div className="flex gap-1 p-1 rounded-xl mb-6"
            style={{ background: 'rgba(255,255,255,0.04)' }}>
            {['login', 'register'].map(m => (
              <button key={m} onClick={() => setMode(m)}
                className={clsx('flex-1 py-2.5 rounded-lg text-sm font-medium transition-all capitalize',
                  mode === m ? 'text-white' : 'text-slate-400 hover:text-slate-200')}
                style={mode === m ? {
                  background: 'linear-gradient(135deg,rgba(255,117,20,0.3),rgba(199,66,10,0.2))',
                  border: '1px solid rgba(255,117,20,0.3)'
                } : {}}>
                {m === 'login' ? 'Sign In' : 'Register'}
              </button>
            ))}
          </div>

          <form onSubmit={submit} className="space-y-4">
            {mode === 'register' && (
              <div>
                <label className="label">Full Name</label>
                <div className="relative">
                  <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input type="text" required placeholder="Akshay Kumar"
                    value={form.name} onChange={e => set('name', e.target.value)}
                    className="input-field pl-9" />
                </div>
              </div>
            )}

            <div>
              <label className="label">Email Address</label>
              <div className="relative">
                <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input type="email" required placeholder="you@example.com"
                  value={form.email} onChange={e => set('email', e.target.value)}
                  className="input-field pl-9" />
              </div>
            </div>

            <div>
              <label className="label">Password</label>
              <div className="relative">
                <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input type={show ? 'text' : 'password'} required placeholder="Min 6 characters"
                  value={form.password} onChange={e => set('password', e.target.value)}
                  className="input-field pl-9 pr-10" />
                <button type="button" onClick={() => setShow(s => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
                  {show ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>

            {mode === 'register' && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">PAN (optional)</label>
                    <input type="text" placeholder="ABCDE1234F" maxLength={10}
                      value={form.pan_number} onChange={e => set('pan_number', e.target.value.toUpperCase())}
                      className="input-field" />
                  </div>
                  <div>
                    <label className="label">Age</label>
                    <input type="number" placeholder="30" min={18} max={100}
                      value={form.age} onChange={e => set('age', e.target.value)}
                      className="input-field" />
                  </div>
                </div>
                <div>
                  <label className="label">Employment Type</label>
                  <select value={form.employment_type} onChange={e => set('employment_type', e.target.value)}
                    className="input-field">
                    <option value="salaried">Salaried</option>
                    <option value="business">Business / Self-Employed</option>
                    <option value="both">Both</option>
                    <option value="retired">Retired / Pension</option>
                  </select>
                </div>
              </>
            )}

            <button type="submit" disabled={loading} className="btn-primary w-full flex items-center justify-center gap-2 py-3 mt-2">
              {loading && <Loader2 size={16} className="animate-spin" />}
              {mode === 'login' ? 'Sign In' : 'Create Account'}
            </button>
          </form>

          {mode === 'login' && (
            <p className="text-center text-xs text-slate-500 mt-4">
              Don't have an account?{' '}
              <button onClick={() => setMode('register')} className="text-saffron-400 hover:underline">
                Register free
              </button>
            </p>
          )}
        </div>

        <p className="text-center text-[10px] text-slate-600 mt-6">
          Your data is encrypted and never shared. AY 2024-25.
        </p>
      </div>
    </div>
  )
}
