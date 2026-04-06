import { useState, useCallback } from 'react'
import { calculateITR } from '../utils/api'
import { getSessionId } from '../utils/format'
import toast from 'react-hot-toast'

const DEFAULT_FORM = {
  assessment_year: '2024-25',
  tax_regime: 'old',
  age: 30,
  income: {
    salary_income: 0,
    house_property_income: 0,
    business_income: 0,
    capital_gains_short: 0,
    capital_gains_long: 0,
    other_income: 0,
  },
  deductions: {
    section_80c: 0,
    section_80d: 0,
    section_80e: 0,
    section_80g: 0,
    section_80tta: 0,
    hra_exemption: 0,
    home_loan_interest: 0,
  },
  tds_paid: 0,
  advance_tax_paid: 0,
}

export function useITRForm() {
  const [form, setForm] = useState(DEFAULT_FORM)
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)

  const updateIncome = useCallback((field, value) => {
    setForm(prev => ({
      ...prev,
      income: { ...prev.income, [field]: parseFloat(value) || 0 }
    }))
  }, [])

  const updateDeduction = useCallback((field, value) => {
    setForm(prev => ({
      ...prev,
      deductions: { ...prev.deductions, [field]: parseFloat(value) || 0 }
    }))
  }, [])

  const updateField = useCallback((field, value) => {
    setForm(prev => ({ ...prev, [field]: value }))
  }, [])

  const applyExtractedData = useCallback((data) => {
    if (!data) return
    setForm(prev => {
      const next = { ...prev }
      const incomeKeys = ['salary_income','house_property_income','business_income',
        'capital_gains_short','capital_gains_long','other_income']
      const dedKeys = ['section_80c','section_80d','section_80e','section_80g',
        'section_80tta','hra_exemption','home_loan_interest']

      incomeKeys.forEach(k => {
        if (data[k] !== undefined) next.income = { ...next.income, [k]: data[k] }
      })
      dedKeys.forEach(k => {
        if (data[k] !== undefined) next.deductions = { ...next.deductions, [k]: data[k] }
      })
      if (data.age) next.age = data.age
      if (data.tax_regime) next.tax_regime = data.tax_regime
      if (data.tds_paid) next.tds_paid = data.tds_paid
      return next
    })
    toast.success('Form updated from your chat message!')
  }, [])

  const submit = useCallback(async () => {
    const totalIncome = Object.values(form.income).reduce((a, b) => a + b, 0)
    if (totalIncome === 0) {
      toast.error('Please enter at least one income source')
      return
    }

    setLoading(true)
    try {
      const payload = { ...form, session_id: getSessionId() }
      const data = await calculateITR(payload)
      setResult(data)
      toast.success('Tax calculated successfully!')
      return data
    } catch (err) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }, [form])

  const reset = useCallback(() => {
    setForm(DEFAULT_FORM)
    setResult(null)
  }, [])

  return {
    form, result, loading,
    updateIncome, updateDeduction, updateField,
    applyExtractedData, submit, reset
  }
}
