import { zodResolver } from '@hookform/resolvers/zod'
import { Eye, EyeOff, LogIn, ShieldCheck, UserPlus } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { AuthLayout } from '../layouts/AuthLayout'
import { loginSchema, type LoginValues } from '../schemas/auth'
import { useAuth } from '../context/AuthContext'
import { Button, Field, Input } from '../components/ui'
import { InlineError } from '../components/app'

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<unknown>(null)
  const state = location.state as { from?: string; message?: string } | null

  const {
    register, handleSubmit, setValue, formState: { errors, isSubmitting },
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  })

  const onSubmit = handleSubmit(async (values) => {
    setError(null)
    try {
      const user = await login(values.email.trim(), values.password)
      const fallback = user.role === 'ADMIN' ? '/admin' : '/dashboard'
      navigate(state?.from && state.from !== '/login' ? state.from : fallback, { replace: true })
    } catch (err) {
      setError(err)
    }
  })

  const fillDemo = (email: string, password: string) => {
    setValue('email', email, { shouldValidate: true })
    setValue('password', password, { shouldValidate: true })
  }

  const [instantRole, setInstantRole] = useState<'customer' | 'admin' | null>(null)

  const handleInstantLogin = async (email: string, pass: string, role: 'customer' | 'admin') => {
    setError(null)
    setInstantRole(role)
    fillDemo(email, pass)
    try {
      const user = await login(email, pass)
      const fallback = user.role === 'ADMIN' ? '/admin' : '/dashboard'
      navigate(state?.from && state.from !== '/login' ? state.from : fallback, { replace: true })
    } catch (err) {
      setError(err)
    } finally {
      setInstantRole(null)
    }
  }

  return (
    <AuthLayout
      title="Welcome back"
      subtitle={
        <>
          Sign in to manage parking reservations and vehicles. New user?{' '}
          <Link to="/register" className="font-semibold text-brand-600 hover:text-brand-700">
            Create an account
          </Link>
          .
        </>
      }
      footer={<>Reservations are enforced directly by the database layer.</>}
    >
      {state?.message && (
        <div className="mb-4 rounded-md border border-brand-200 bg-brand-50 px-3 py-2 text-xs text-brand-800">
          {state.message}
        </div>
      )}

      <form onSubmit={onSubmit} className="space-y-3.5" noValidate>
        {error != null && <InlineError error={error} />}

        <Field label="Email address" htmlFor="email" error={errors.email?.message} required>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            invalid={Boolean(errors.email)}
            {...register('email')}
          />
        </Field>

        <Field label="Password" htmlFor="password" error={errors.password?.message} required>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              placeholder="Your password"
              className="pr-10"
              invalid={Boolean(errors.password)}
              {...register('password')}
            />
            <button
              type="button"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-1 text-slate-500 transition hover:text-slate-700"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </Field>

        <div className="flex items-center justify-between text-xs">
          <Link to="/forgot-password" className="font-medium text-slate-600 transition hover:text-slate-900">
            Forgot password?
          </Link>
          <span className="flex items-center gap-1 text-[11px] text-slate-500">
            <ShieldCheck className="h-3.5 w-3.5 text-brand-600" /> Secure session
          </span>
        </div>

        <Button type="submit" size="md" className="w-full h-10 font-semibold" icon={LogIn} loading={isSubmitting}>
          Log In
        </Button>

        <div className="relative my-3 flex items-center justify-center">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-slate-200" />
          </div>
          <span className="relative bg-white px-2 text-[11px] font-medium text-slate-500 uppercase tracking-wider">
            New to SmartPark?
          </span>
        </div>

        <Link to="/register" className="block">
          <Button type="button" variant="outline" size="md" className="w-full h-10 font-semibold border-slate-300 text-slate-800 hover:bg-slate-50" icon={UserPlus}>
            Create New Account
          </Button>
        </Link>
      </form>

      <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-3.5">
        <div className="flex items-center justify-between">
          <p className="text-[10.5px] font-semibold uppercase tracking-wider text-slate-500">Demo Credentials (1-Click Login)</p>
          <span className="text-[10px] text-slate-500 font-medium">Review evaluation helper</span>
        </div>
        <div className="mt-2.5 grid gap-2 sm:grid-cols-2">
          <div className="flex flex-col justify-between rounded-md border border-slate-200 bg-white p-2.5 transition hover:border-slate-300">
            <div>
              <span className="block text-xs font-bold text-slate-900">Customer Account</span>
              <span className="block truncate font-mono text-[11px] text-slate-500">demo@smartpark.local</span>
            </div>
            <div className="mt-2.5 flex items-center gap-1.5 border-t border-slate-100 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 px-2 text-[11px]"
                onClick={() => fillDemo('demo@smartpark.local', 'Demo@12345!')}
              >
                Fill
              </Button>
              <Button
                type="button"
                size="sm"
                className="h-7 flex-1 px-2 text-[11px]"
                loading={instantRole === 'customer'}
                onClick={() => handleInstantLogin('demo@smartpark.local', 'Demo@12345!', 'customer')}
              >
                1-Click Login
              </Button>
            </div>
          </div>

          <div className="flex flex-col justify-between rounded-md border border-slate-200 bg-white p-2.5 transition hover:border-slate-300">
            <div>
              <span className="block text-xs font-bold text-slate-900">Administrator</span>
              <span className="block truncate font-mono text-[11px] text-slate-500">admin@smartpark.local</span>
            </div>
            <div className="mt-2.5 flex items-center gap-1.5 border-t border-slate-100 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 px-2 text-[11px]"
                onClick={() => fillDemo('admin@smartpark.local', 'Admin@12345!')}
              >
                Fill
              </Button>
              <Button
                type="button"
                size="sm"
                variant="dark"
                className="h-7 flex-1 px-2 text-[11px]"
                loading={instantRole === 'admin'}
                onClick={() => handleInstantLogin('admin@smartpark.local', 'Admin@12345!', 'admin')}
              >
                1-Click Admin
              </Button>
            </div>
          </div>
        </div>
      </div>
    </AuthLayout>
  )
}
