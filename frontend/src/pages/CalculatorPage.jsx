import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Mic, MicOff, Loader2, ChevronDown, ChevronUp, ArrowRight, RefreshCw, Zap } from 'lucide-react'
import { useITRForm } from '../hooks/useITRForm'
import { useSpeechInput } from '../hooks/useSpeech'
import { formatINR } from '../utils/format'
import clsx from 'clsx'
import toast from 'react-hot-toast'

function NumInput({ label, field, value, onChange, max, hint }) {
  return (
    <div>
      <label className="label">{label}</label>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm font-mono">₹</span>
        <input type="number" min={0} max={max} value={value || ''} onChange={e => onChange(field, e.target.value)}
          placeholder="0" className="input-field pl-7" />
      </div>
      {hint && <p className="text-[10px] text-slate-500 mt-1">{hint}</p>}
    </div>
  )
}

function Section({ title, badge, children, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="card">
      <button onClick={() => setOpen(o => !o)} className="w-full flex items-center justify-between mb-0">
        <div className="flex items-center gap-2">
          <h3 className="section-title mb-0">{title}</h3>
          {badge && <span className="badge-saffron text-[10px]">{badge}</span>}
        </div>
        {open ? <ChevronUp size={15} className="text-slate-400" /> : <ChevronDown size={15} className="text-slate-400" />}
      </button>
      {open && <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">{children}</div>}
    </div>
  )
}

export default function CalculatorPage() {
  const nav = useNavigate()
  const { form, result, loading, updateIncome, updateDeduction, updateField, applyExtractedData, submit, reset } = useITRForm()
  const [voiceHint, setVoiceHint] = useState('')
  const [autoFilled, setAutoFilled] = useState(false)

  // Auto-fill from chat extracted data
  useEffect(() => {
    const raw = sessionStorage.getItem('extracted_itr_data')
    if (raw && !autoFilled) {
      try {
        const data = JSON.parse(raw)
        if (Object.keys(data).length > 0) {
          applyExtractedData(data)
          setAutoFilled(true)
          sessionStorage.removeItem('extracted_itr_data')
        }
      } catch { }
    }
  }, [applyExtractedData, autoFilled])

  const { isRecording, isProcessing, toggleRecording } = useSpeechInput((transcript) => {
    setVoiceHint(transcript)
    toast('🎤 Voice captured! Fill form manually or use AI Chat to auto-extract data.', { duration: 4000 })
  })

  const handleSubmit = async () => {
    const data = await submit()
    if (data) {
      sessionStorage.setItem('itr_result', JSON.stringify(data))
      sessionStorage.setItem('itr_form', JSON.stringify(form))
      nav('/result')
    }
  }

  const totalIncome = Object.values(form.income).reduce((a, b) => a + b, 0)
  const totalDeductions = form.tax_regime === 'old'
    ? Object.values(form.deductions).reduce((a, b) => a + b, 0) + 50000
    : 75000

  return (
    <div className="animate-fade-in max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="font-heading text-3xl font-bold text-white">ITR Calculator</h2>
          <p className="text-slate-400 text-sm mt-1">AY 2024-25 · Old & New Regime</p>
        </div>
        <button onClick={reset} className="btn-secondary flex items-center gap-2 text-sm py-2 px-4">
          <RefreshCw size={13} />Reset
        </button>
      </div>

      {/* Voice input */}
      <div className="card mb-5 flex items-center gap-4"
        style={isRecording ? { borderColor: 'rgba(239,68,68,0.4)' } : {}}>
        <button onClick={toggleRecording}
          className={clsx('w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 transition-all',
            isRecording ? 'bg-red-500 mic-recording' : 'bg-saffron-600 hover:bg-saffron-500')}>
          {isProcessing ? <Loader2 size={18} className="animate-spin text-white" />
            : isRecording ? <MicOff size={18} className="text-white" />
            : <Mic size={18} className="text-white" />}
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-white">
            {isRecording ? '🎙️ Listening…' : 'Voice Input'}
          </p>
          <p className="text-xs text-slate-400 mt-0.5 truncate">
            {voiceHint || 'Click mic or use AI Chat to auto-fill this form from natural speech'}
          </p>
        </div>
        {autoFilled && (
          <span className="badge-jade flex-shrink-0">
            <Zap size={10} />Auto-filled from Chat
          </span>
        )}
      </div>

      {/* Regime + basics */}
      <div className="card mb-4">
        <h3 className="section-title">Basic Info</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="label">Tax Regime</label>
            <div className="flex gap-2">
              {['old', 'new'].map(r => (
                <button key={r} onClick={() => updateField('tax_regime', r)}
                  className={clsx('flex-1 py-2.5 rounded-xl text-sm font-medium border transition-all',
                    form.tax_regime === r ? 'text-white border-saffron-500/50' : 'text-slate-400 border-white/10 hover:border-white/20')}
                  style={form.tax_regime === r ? { background: 'linear-gradient(135deg,rgba(255,117,20,0.2),rgba(199,66,10,0.12))' } : {}}>
                  {r === 'old' ? 'Old' : 'New'}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="label">Assessment Year</label>
            <select value={form.assessment_year} onChange={e => updateField('assessment_year', e.target.value)} className="input-field">
              <option value="2024-25">2024-25</option>
              <option value="2023-24">2023-24</option>
            </select>
          </div>
          <div>
            <label className="label">Your Age</label>
            <input type="number" min={18} max={100} value={form.age}
              onChange={e => updateField('age', parseInt(e.target.value) || 30)} className="input-field" />
          </div>
        </div>
      </div>

      {/* Income */}
      <div className="mb-4">
        <Section title="💼 Income Sources">
          <NumInput label="Salary / Pension" field="salary_income" value={form.income.salary_income} onChange={updateIncome} hint="Annual gross before deductions" />
          <NumInput label="House Property" field="house_property_income" value={form.income.house_property_income} onChange={updateIncome} hint="Net rental (negative for loss)" />
          <NumInput label="Business / Profession" field="business_income" value={form.income.business_income} onChange={updateIncome} />
          <NumInput label="Short Term Capital Gains" field="capital_gains_short" value={form.income.capital_gains_short} onChange={updateIncome} hint="STCG on equity taxed at 20%" />
          <NumInput label="Long Term Capital Gains" field="capital_gains_long" value={form.income.capital_gains_long} onChange={updateIncome} hint="LTCG above ₹1.25L taxed at 12.5%" />
          <NumInput label="Other Income" field="other_income" value={form.income.other_income} onChange={updateIncome} hint="Interest, dividends, etc." />
        </Section>
      </div>

      {/* Deductions (old only) */}
      {form.tax_regime === 'old' && (
        <div className="mb-4">
          <Section title="🏦 Deductions" badge="Old Regime Only">
            <NumInput label="Section 80C" field="section_80c" value={form.deductions.section_80c} onChange={updateDeduction} max={150000} hint="PPF, ELSS, LIC, EPF — max ₹1.5L" />
            <NumInput label="80D — Health Insurance" field="section_80d" value={form.deductions.section_80d} onChange={updateDeduction} hint="Self ₹25K + Parents ₹25K" />
            <NumInput label="80E — Education Loan" field="section_80e" value={form.deductions.section_80e} onChange={updateDeduction} hint="Full interest, no limit" />
            <NumInput label="80G — Donations" field="section_80g" value={form.deductions.section_80g} onChange={updateDeduction} />
            <NumInput label="80TTA — Savings Interest" field="section_80tta" value={form.deductions.section_80tta} onChange={updateDeduction} max={10000} hint="Max ₹10,000" />
            <NumInput label="HRA Exemption" field="hra_exemption" value={form.deductions.hra_exemption} onChange={updateDeduction} hint="min(HRA, 50%/40% salary, rent-10%)" />
            <NumInput label="Home Loan Interest" field="home_loan_interest" value={form.deductions.home_loan_interest} onChange={updateDeduction} max={200000} hint="Section 24(b) — max ₹2L" />
          </Section>
        </div>
      )}

      {/* TDS / Advance Tax */}
      <div className="card mb-6">
        <h3 className="section-title">💳 Tax Already Paid</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <NumInput label="TDS Deducted" field="tds_paid" value={form.tds_paid} onChange={(f, v) => updateField('tds_paid', parseFloat(v) || 0)} hint="From Form 16 / 26AS" />
          <NumInput label="Advance Tax Paid" field="advance_tax_paid" value={form.advance_tax_paid} onChange={(f, v) => updateField('advance_tax_paid', parseFloat(v) || 0)} />
        </div>
      </div>

      {/* Summary strip */}
      <div className="card mb-6 grid grid-cols-2 gap-4">
        <div>
          <p className="label">Gross Income</p>
          <p className="font-heading text-xl font-bold text-white">{formatINR(totalIncome)}</p>
        </div>
        <div className="text-right">
          <p className="label">Total Deductions</p>
          <p className="font-heading text-xl font-bold text-jade-400">{formatINR(totalDeductions)}</p>
        </div>
      </div>

      <button onClick={handleSubmit} disabled={loading}
        className="btn-primary w-full flex items-center justify-center gap-3 py-4 text-base">
        {loading ? <Loader2 size={20} className="animate-spin" /> : '🧮'}
        {loading ? 'Calculating with AI…' : 'Calculate My Tax'}
        {!loading && <ArrowRight size={18} />}
      </button>
    </div>
  )
}
