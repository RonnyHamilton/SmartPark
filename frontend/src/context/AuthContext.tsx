import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { api, getAccessToken, setAccessToken, setSessionExpiredHandler } from '../services/api'
import type { User } from '../types'

interface AuthContextValue {
  user: User | null
  initializing: boolean
  isAuthenticated: boolean
  isAdmin: boolean
  login: (email: string, password: string) => Promise<User>
  register: (name: string, email: string, password: string) => Promise<User>
  logout: () => Promise<void>
  refreshUser: () => Promise<void>
  setUser: (user: User | null) => void
  hasToken: () => boolean
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [initializing, setInitializing] = useState(true)
  const queryClient = useQueryClient()

  const clear = useCallback(() => {
    setAccessToken(null)
    setUser(null)
    queryClient.clear()
  }, [queryClient])

  useEffect(() => {
    setSessionExpiredHandler(clear)
    let mounted = true
    const bootstrap = async () => {
      try {
        const token = await api.refresh()
        if (token) {
          const me = await api.me()
          if (mounted) setUser(me)
        }
      } catch {
        if (mounted) setUser(null)
      } finally {
        if (mounted) setInitializing(false)
      }
    }
    void bootstrap()
    return () => {
      mounted = false
      setSessionExpiredHandler(null)
    }
  }, [clear])

  const login = useCallback(async (email: string, password: string) => {
    const response = await api.login({ email, password })
    setAccessToken(response.accessToken)
    setUser(response.user)
    return response.user
  }, [])

  const register = useCallback(async (name: string, email: string, password: string) => {
    const response = await api.register({ name, email, password })
    setAccessToken(response.accessToken)
    setUser(response.user)
    return response.user
  }, [])

  const logout = useCallback(async () => {
    try {
      await api.logout()
    } finally {
      clear()
    }
  }, [clear])

  const refreshUser = useCallback(async () => {
    const me = await api.me()
    setUser(me)
  }, [])

  const value = useMemo<AuthContextValue>(() => ({
    user,
    initializing,
    isAuthenticated: Boolean(user),
    isAdmin: user?.role === 'ADMIN',
    login,
    register,
    logout,
    refreshUser,
    setUser,
    hasToken: () => Boolean(getAccessToken()),
  }), [user, initializing, login, register, logout, refreshUser])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside AuthProvider')
  return context
}
