import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { getMe } from '../utils/api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('itr_token')
    if (token) {
      getMe()
        .then(setUser)
        .catch(() => { localStorage.removeItem('itr_token'); setUser(null) })
        .finally(() => setLoading(false))
    } else {
      setLoading(false)
    }
  }, [])

  const loginUser = useCallback((token, userData) => {
    localStorage.setItem('itr_token', token)
    setUser(userData)
  }, [])

  const logoutUser = useCallback(() => {
    localStorage.removeItem('itr_token')
    localStorage.removeItem('itr_session_id')
    setUser(null)
  }, [])

  return (
    <AuthContext.Provider value={{ user, loading, loginUser, logoutUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
