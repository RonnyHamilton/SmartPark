import { zodResolver } from '@hookform/resolvers/zod'
import { Check, Eye, EyeOff, LogIn, UserPlus } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useNavigate } from 'react-router-dom'
import { AuthLayout } from '../layouts/AuthLayout'
import { registerSchema, type RegisterValues } from '../schemas/auth'
import { useAuth } from '../context/AuthContext'
import { Button, Checkbox, Field, Input } from '../components/ui'
import { InlineError } from '../components/app'

const passwordRules = [
  { label: '10+ chars', test: (v: string) => v.length >= 10 },
  { label: 'Upper case', test: (v: string) => /[A-Z]/.test(v) },
  { label: 'Lower case', test: (v: string) => /[a-z]/.test(v) },
  { label: 'Number', test: (v: string) => /\d/.test(v) },
]

export default function Register() {
  const { register: registerUser } = useAuth()
  const navigate = useNavigate()
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<unknown>(null)

  const {
    register, handleSubmit, watch, setValue, formState: { errors, isSubmitting },
  } = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { name: '', email: '', password: '', confirmPassword: '', acceptTerms: false },
  })
  const password = watch('password') ?? ''

  const fillRandomDemo = () => {
    const randomSuffix = Math.floor(1000 + Math.random() * 9000)
    setValue('name', `Test Driver ${randomSuffix}`, { shouldValidate: true })
    setValue('email', `driver${randomSuffix}@smartpark.local`, { shouldValidate: true })
    setValue('password', 'Driver@12345!', { shouldValidate: true })
    setValue('confirmPassword', 'Driver@12345!', { shouldValidate: true })
    setValue('acceptTerms', true, { shouldValidate: true })
  }

  const onSubmit = handleSubmit(async (values) => {
    setError(null)
    try {
      await registerUser(values.name.trim(), values.email.trim(), values.password)
      navigate('/dashboard', { replace: true })
    } catch (err) {
      setError(err)
    }
  })

  return (
    <AuthLayout
      title="Create account"
      subtitle={
        <>
          Reserve verified bays in seconds. Already registered?{' '}
          <Link to="/login" className="font-semibold text-brand-600 hover:text-brand-700">
            Sign in
          </Link>
          .
        </>
      }
      footer={<>Your account data stays in your local deployment database.</>}
    >
      <form onSubmit={onSubmit} className="space-y-3.5" noValidate>
        {error != null && <InlineError error={error} />}

        <Field label="Full name" htmlFor="name" error={errors.name?.message} required>
          <Input id="name" autoComplete="name" placeholder="John Doe" invalid={Boolean(errors.name)} {...register('name')} />
        </Field>

        <Field label="Email address" htmlFor="email" error={errors.email?.message} required>
          <Input id="email" type="email" autoComplete="email" placeholder="you@example.com" invalid={Boolean(errors.email)} {...register('email')} />
        </Field>

        <Field label="Password" htmlFor="password" error={errors.password?.message} required>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              placeholder="At least 10 characters"
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
          <div className="mt-2 flex flex-wrap gap-1.5">
            {passwordRules.map((rule) => {
              const passed = rule.test(password)
              return (
                <span
                  key={rule.label}
                  className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10.5px] font-medium border ${
                    passed
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                      : 'border-slate-200 bg-slate-50 text-slate-500'
                  }`}
                >
                  <Check className={`h-2.5 w-2.5 ${passed ? 'opacity-100 text-emerald-700' : 'opacity-30'}`} /> {rule.label}
                </span>
              )
            })}
          </div>
        </Field>

        <Field label="Confirm password" htmlFor="confirmPassword" error={errors.confirmPassword?.message} required>
          <Input
            id="confirmPassword"
            type={showPassword ? 'text' : 'password'}
            autoComplete="new-password"
            placeholder="Repeat password"
            invalid={Boolean(errors.confirmPassword)}
            {...register('confirmPassword')}
          />
        </Field>

        <div>
          <Checkbox
            label="I accept the booking terms"
            description="Reservations hold bays for the booked duration. Free cancellation is available before the facility cutoff."
            {...register('acceptTerms')}
          />
          {errors.acceptTerms && <p className="mt-1 text-xs font-medium text-rose-600" role="alert">{errors.acceptTerms.message}</p>}
        </div>

        <Button type="submit" size="md" className="w-full h-10 font-semibold" icon={UserPlus} loading={isSubmitting}>
          Create SmartPark Account
        </Button>

        <div className="relative my-3 flex items-center justify-center">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-slate-200" />
          </div>
          <span className="relative bg-white px-2 text-[11px] font-medium text-slate-500 uppercase tracking-wider">
            Already registered?
          </span>
        </div>

        <Link to="/login" className="block">
          <Button type="button" variant="outline" size="md" className="w-full h-10 font-semibold border-slate-300 text-slate-800 hover:bg-slate-50" icon={LogIn}>
            Log In to Existing Account
          </Button>
        </Link>
      </form>

      <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-xs">
        <span className="text-slate-500 font-medium">Testing registration?</span>
        <button
          type="button"
          onClick={fillRandomDemo}
          className="font-medium text-brand-600 hover:text-brand-700 hover:underline"
        >
          Auto-fill demo driver details
        </button>
      </div>
    </AuthLayout>
  )
}
