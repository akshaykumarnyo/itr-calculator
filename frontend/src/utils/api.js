import axios from 'axios'

const api = axios.create({ baseURL: '/api/v1', timeout: 60000 })

// Attach token automatically
api.interceptors.request.use(cfg => {
  const token = localStorage.getItem('itr_token')
  if (token) cfg.headers.Authorization = `Bearer ${token}`
  return cfg
})

api.interceptors.response.use(r => r, err => {
  const msg = err.response?.data?.detail || err.message || 'Request failed'
  return Promise.reject(new Error(msg))
})

// Auth
export const register = (data) => api.post('/auth/register', data).then(r => r.data)
export const login = (data) => api.post('/auth/login', data).then(r => r.data)
export const getMe = () => api.get('/auth/me').then(r => r.data)
export const logout = () => api.post('/auth/logout').then(r => r.data)

// ITR
export const calculateITR = (payload) => api.post('/itr/calculate', payload).then(r => r.data)
export const compareRegimes = (salary, d, age) =>
  api.get('/itr/regimes/compare', { params: { salary, deductions_80c: d, age } }).then(r => r.data)
export const getCalculationHistory = (sid) => api.get(`/itr/history/${sid}`).then(r => r.data)

// Chat
export const sendChatMessage = (sid, message, audio = false) =>
  api.post('/chat/message', { session_id: sid, message, include_audio: audio }).then(r => r.data)
export const getChatMessages = (sid) => api.get(`/chat/sessions/${sid}/messages`).then(r => r.data)
export const listSessions = () => api.get('/chat/sessions').then(r => r.data)
export const deleteChatSession = (sid) => api.delete(`/chat/sessions/${sid}`).then(r => r.data)

// Streaming chat — returns a fetch response for SSE
export const streamChatMessage = async (sid, message, audio = false) => {
  const token = localStorage.getItem('itr_token')
  return fetch('/api/v1/chat/stream', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ session_id: sid, message, include_audio: audio }),
  })
}

// Speech
export const synthesizeSpeech = (text, lang = 'en') =>
  api.post('/speech/synthesize', null, { params: { text, lang } }).then(r => r.data)

// Cache info
export const getCacheInfo = () => api.get('/itr/cache-info').then(r => r.data)
