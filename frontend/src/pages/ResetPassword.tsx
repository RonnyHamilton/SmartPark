import { zodResolver } from '@hookform/resolvers/zod'
import { CheckCircle2, ShieldCheck } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { AuthLayout } from '../layouts/AuthLayout'
import { resetSchema, type ResetValues } from '../schemas/auth'
import { api } from '../services/api'
import { Button, Field, Input } from '../components/ui'
import { InlineError } from '../components/app'

export default function ResetPassword() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const [error, setError] = useState<unknown>(null)
  const [done, setDone] = useState(false)

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<ResetValues>({
    resolver: zodResolver(resetSchema),
    defaultValues: { token: params.get('token') ?? '', newPassword: '', confirmPassword: '' },
  })

  const onSubmit = handleSubmit(async (values) => {
    setError(null)
    try {
      await api.resetPassword(values.token.trim(), values.newPassword)
      setDone(true)
    } catch (err) {
      setError(err)
    }
  })

  if (done) {
    return (
      <AuthLayout title="Password updated" subtitle="Your new password is now active. All active sessions have been safely terminated.">
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-5 text-center text-xs text-emerald-800">
          <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-600" />
          <p className="mt-2.5 text-sm font-semibold text-emerald-900">Password reset complete</p>
          <p className="mt-1 text-slate-600">You can now sign in using your new credentials.</p>
          <Button className="mt-4" size="sm" onClick={() => navigate('/login', { replace: true })}>Go to sign in</Button>
        </div>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout
      title="Create new password"
      subtitle={
        <>
          Enter your single-use reset token and choose a strong password.{' '}
          <Link to="/forgot-password" className="font-semibold text-brand-600 hover:text-brand-700">
            Need a new token?
          </Link>
        </>
      }
      footer={<>Updating password revokes all active refresh tokens automatically.</>}
    >
      <form onSubmit={onSubmit} className="space-y-3.5" noValidate>
        {error != null && <InlineError error={error} />}

        <Field label="Reset token" htmlFor="token" error={errors.token?.message} hint="Single-use token issued for your email" required>
          <Input id="token" autoComplete="off" placeholder="Paste reset token" className="font-mono text-xs" invalid={Boolean(errors.token)} {...register('token')} />
        </Field>

        <Field label="New password" htmlFor="newPassword" error={errors.newPassword?.message} required>
          <Input id="newPassword" type="password" autoComplete="new-password" placeholder="At least 10 characters" invalid={Boolean(errors.newPassword)} {...register('newPassword')} />
        </Field>

        <Field label="Confirm new password" htmlFor="confirmPassword" error={errors.confirmPassword?.message} required>
          <Input id="confirmPassword" type="password" autoComplete="new-password" placeholder="Repeat new password" invalid={Boolean(errors.confirmPassword)} {...register('confirmPassword')} />
        </Field>

        <Button type="submit" size="md" className="w-full" icon={ShieldCheck} loading={isSubmitting}>
          Update password
        </Button>
      </form>
    </AuthLayout>
  )
}
