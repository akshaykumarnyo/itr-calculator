// Format number as Indian currency
export const formatINR = (amount, compact = false) => {
  if (amount === null || amount === undefined) return '₹0'
  const num = Math.abs(amount)

  if (compact) {
    if (num >= 1_00_00_000) return `₹${(num / 1_00_00_000).toFixed(2)} Cr`
    if (num >= 1_00_000) return `₹${(num / 1_00_000).toFixed(2)} L`
    if (num >= 1_000) return `₹${(num / 1_000).toFixed(1)} K`
  }

  // Indian number format
  const str = num.toFixed(0)
  const lastThree = str.slice(-3)
  const rest = str.slice(0, -3)
  const formatted = rest
    ? rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + ',' + lastThree
    : lastThree

  return (amount < 0 ? '-₹' : '₹') + formatted
}

// Format percentage
export const formatPct = (value) => `${value.toFixed(1)}%`

// Session ID from localStorage
export const getSessionId = () => {
  let id = localStorage.getItem('itr_session_id')
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem('itr_session_id', id)
  }
  return id
}

// Debounce
export const debounce = (fn, ms) => {
  let timer
  return (...args) => {
    clearTimeout(timer)
    timer = setTimeout(() => fn(...args), ms)
  }
}

// Tax regime label
export const regimeLabel = (r) => r === 'new' ? 'New Regime' : 'Old Regime'

// Refund vs payable
export const taxBalance = (amount) => ({
  isRefund: amount < 0,
  label: amount < 0 ? 'Tax Refund' : 'Tax Payable',
  amount: Math.abs(amount),
  color: amount < 0 ? 'jade' : 'red',
})
