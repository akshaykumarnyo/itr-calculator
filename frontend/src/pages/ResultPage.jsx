import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend
} from 'recharts'
import { TrendingDown, TrendingUp, AlertCircle, CheckCircle2, Download, ArrowLeft, Volume2 } from 'lucide-react'
import { formatINR, taxBalance } from '../utils/format'
import { synthesizeSpeech } from '../utils/api'
import { useAudioPlayback } from '../hooks/useSpeech'
import toast from 'react-hot-toast'
import clsx from 'clsx'

const COLORS = ['#ff7514', '#059669', '#3b82f6', '#a855f7', '#f59e0b', '#ef4444']

const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="card px-3 py-2 text-xs border border-white/10">
      <p className="text-slate-300 font-medium">{payload[0].name}</p>
      <p className="text-saffron-400">{formatINR(payload[0].value)}</p>
    </div>
  )
}

export default function ResultPage() {
  const nav = useNavigate()
  const [result, setResult] = useState(null)
  const [form, setForm] = useState(null)
  const { isPlaying, playAudio, stopAudio } = useAudioPlayback()

  useEffect(() => {
    const r = sessionStorage.getItem('itr_result')
    const f = sessionStorage.getItem('itr_form')
    if (r) setResult(JSON.parse(r))
    if (f) setForm(JSON.parse(f))
  }, [])

  if (!result) {
    return (
      <div className="animate-fade-in flex flex-col items-center justify-center py-24 gap-4">
        <AlertCircle size={40} className="text-slate-500" />
        <p className="text-slate-400">No calculation result found.</p>
        <button onClick={() => nav('/calculator')} className="btn-primary flex items-center gap-2">
          <ArrowLeft size={16} />
          Go to Calculator
        </button>
      </div>
    )
  }

  const balance = taxBalance(result.tax_refund_or_payable)

  // Pie chart data — income breakdown
  const incomeData = form ? [
    { name: 'Salary', value: form.income.salary_income },
    { name: 'Business', value: form.income.business_income },
    { name: 'House Prop.', value: Math.max(0, form.income.house_property_income) },
    { name: 'Cap. Gains', value: form.income.capital_gains_short + form.income.capital_gains_long },
    { name: 'Other', value: form.income.other_income },
  ].filter(d => d.value > 0) : []

  // Bar chart — regime comparison
  const regimeData = [
    { name: 'Old Regime', tax: result.old_regime_tax },
    { name: 'New Regime', tax: result.new_regime_tax },
  ]

  // Tax breakdown pie
  const taxBreakdown = [
    { name: 'Base Tax', value: result.tax_liability },
    { name: 'Surcharge', value: result.surcharge },
    { name: 'Cess', value: result.health_education_cess },
  ].filter(d => d.value > 0)

  const handleListenAdvice = async () => {
    if (isPlaying) { stopAudio(); return }
    try {
      const text = result.ai_advice || 'No advice available.'
      const data = await synthesizeSpeech(text)
      playAudio(data.audio_url)
      toast.success('Playing AI advice')
    } catch {
      toast.error('TTS unavailable')
    }
  }

  return (
    <div className="animate-fade-in max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <button onClick={() => nav('/calculator')} className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-saffron-400 transition-colors mb-2">
            <ArrowLeft size={12} />
            Back to Calculator
          </button>
          <h2 className="font-heading text-3xl font-bold text-white">Your Tax Summary</h2>
          <p className="text-slate-400 text-sm mt-1">AY {result.assessment_year} — {result.tax_regime === 'old' ? 'Old' : 'New'} Tax Regime</p>
        </div>
        <span className={clsx('badge-saffron text-sm px-3 py-1.5')}>
          {result.recommended_regime === result.tax_regime ? '✅ Optimal Regime' : '⚠️ Switch Recommended'}
        </span>
      </div>

      {/* Key Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="stat-card">
          <p className="stat-label">Gross Income</p>
          <p className="stat-value text-white">{formatINR(result.gross_total_income, true)}</p>
        </div>
        <div className="stat-card">
          <p className="stat-label">Taxable Income</p>
          <p className="stat-value text-saffron-400">{formatINR(result.taxable_income, true)}</p>
        </div>
        <div className="stat-card">
          <p className="stat-label">Total Tax</p>
          <p className="stat-value text-red-400">{formatINR(result.total_tax, true)}</p>
        </div>
        <div className="stat-card">
          <p className="stat-label">{balance.label}</p>
          <p className={clsx('stat-value', balance.color === 'jade' ? 'text-jade-400' : 'text-red-400')}>
            {formatINR(balance.amount, true)}
          </p>
        </div>
      </div>

      {/* Regime Recommendation */}
      {result.regime_savings > 0 && (
        <div className="card mb-6 flex items-center gap-4"
          style={{ background: 'linear-gradient(135deg,rgba(16,185,129,0.08),rgba(5,150,105,0.05))', borderColor: 'rgba(16,185,129,0.2)' }}>
          {result.recommended_regime === result.tax_regime
            ? <CheckCircle2 size={20} className="text-jade-400 flex-shrink-0" />
            : <TrendingDown size={20} className="text-saffron-400 flex-shrink-0" />}
          <div>
            <p className="text-sm font-medium text-white">
              {result.recommended_regime === result.tax_regime
                ? `You're on the optimal regime! `
                : `Switch to ${result.recommended_regime === 'new' ? 'New' : 'Old'} Regime to save `}
              <span className="text-jade-400">{formatINR(result.regime_savings)}</span>
            </p>
            <p className="text-xs text-slate-400 mt-0.5">
              Old Regime: {formatINR(result.old_regime_tax)} · New Regime: {formatINR(result.new_regime_tax)}
            </p>
          </div>
        </div>
      )}

      {/* Charts Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {/* Income Breakdown */}
        {incomeData.length > 0 && (
          <div className="card">
            <h3 className="section-title text-base">Income Breakdown</h3>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={incomeData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={75} paddingAngle={3}>
                  {incomeData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '11px', color: '#94a3b8' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Regime Comparison */}
        <div className="card">
          <h3 className="section-title text-base">Regime Comparison</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={regimeData} barSize={40}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={v => formatINR(v, true)} tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="tax" name="Total Tax" radius={[6, 6, 0, 0]}>
                {regimeData.map((entry, i) => (
                  <Cell key={i} fill={entry.name.includes(result.recommended_regime === 'old' ? 'Old' : 'New') ? '#ff7514' : '#374151'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Tax Slab Breakdown */}
      {result.tax_slabs?.length > 0 && (
        <div className="card mb-6">
          <h3 className="section-title">Tax Slab Breakdown</h3>
          <div className="space-y-2">
            {result.tax_slabs.map((slab, i) => (
              <div key={i} className="flex items-center justify-between text-sm py-2 border-b border-white/[0.04] last:border-0">
                <span className="text-slate-400">{slab.slab}</span>
                <div className="flex items-center gap-6">
                  <span className="text-slate-400 text-xs font-mono">{slab.rate.toFixed(0)}%</span>
                  <span className="text-slate-300">{formatINR(slab.income_in_slab)}</span>
                  <span className="text-saffron-400 font-medium font-mono w-28 text-right">{formatINR(slab.tax)}</span>
                </div>
              </div>
            ))}
            <div className="flex justify-between pt-2 font-medium text-sm">
              <span className="text-white">Surcharge + Cess</span>
              <span className="text-saffron-400 font-mono">{formatINR(result.surcharge + result.health_education_cess)}</span>
            </div>
            <div className="flex justify-between pt-2 border-t border-white/10 text-base font-bold">
              <span className="text-white">Total Tax Liability</span>
              <span className="text-gradient font-mono">{formatINR(result.total_tax)}</span>
            </div>
          </div>
        </div>
      )}

      {/* AI Advice */}
      {result.ai_advice && (
        <div className="card mb-6" style={{ borderColor: 'rgba(255,117,20,0.2)', background: 'linear-gradient(135deg,rgba(255,117,20,0.06),rgba(4,10,21,0.98))' }}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="section-title mb-0 text-base">🤖 AI Tax Advice</h3>
            <button onClick={handleListenAdvice}
              className={clsx('flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-all',
                isPlaying ? 'text-saffron-400 border-saffron-500/30' : 'text-slate-400 border-white/10 hover:border-white/20')}>
              <Volume2 size={12} />
              {isPlaying ? 'Stop' : 'Listen'}
            </button>
          </div>
          <p className="text-sm text-slate-300 leading-relaxed">{result.ai_advice}</p>
        </div>
      )}

      {/* Optimization Tips */}
      {result.optimization_tips?.length > 0 && (
        <div className="card mb-8">
          <h3 className="section-title text-base">💡 Tax Optimization Tips</h3>
          <div className="space-y-3">
            {result.optimization_tips.map((tip, i) => (
              <div key={i} className="flex gap-3 text-sm py-2 border-b border-white/[0.04] last:border-0">
                <span className="text-saffron-400 flex-shrink-0 mt-0.5">→</span>
                <p className="text-slate-300 leading-relaxed">{tip}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3">
        <button onClick={() => nav('/calculator')} className="btn-secondary flex items-center gap-2">
          <ArrowLeft size={16} />
          Recalculate
        </button>
        <button onClick={() => nav('/chat')} className="btn-primary flex items-center gap-2 flex-1 justify-center">
          Ask AI for More Advice
        </button>
      </div>
    </div>
  )
}
