import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowRight, KeyRound, MailCheck, Send } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link } from 'react-router-dom'
import { AuthLayout } from '../layouts/AuthLayout'
import { forgotSchema, type ForgotValues } from '../schemas/auth'
import { api } from '../services/api'
import { Button, Field, Input } from '../components/ui'
import { InlineError } from '../components/app'

export default function ForgotPassword() {
  const [error, setError] = useState<unknown>(null)
  const [result, setResult] = useState<{ message: string; devResetToken?: string | null } | null>(null)

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<ForgotValues>({
    resolver: zodResolver(forgotSchema),
    defaultValues: { email: '' },
  })

  const onSubmit = handleSubmit(async (values) => {
    setError(null)
    setResult(null)
    try {
      setResult(await api.forgotPassword(values.email.trim()))
    } catch (err) {
      setError(err)
    }
  })

  return (
    <AuthLayout
      title="Reset password"
      subtitle={
        <>
          Enter your registered email address to receive a secure single-use reset token.{' '}
          <Link to="/login" className="font-semibold text-brand-600 hover:text-brand-700">
            Back to sign in
          </Link>
          .
        </>
      }
      footer={<>Reset tokens are single-use and expire within a short timeframe.</>}
    >
      <form onSubmit={onSubmit} className="space-y-3.5" noValidate>
        {error != null && <InlineError error={error} />}
        {result && (
          <div className="rounded-lg border border-brand-200 bg-brand-50 p-3.5 text-xs text-brand-900">
            <div className="flex items-start gap-2.5">
              <MailCheck className="h-4 w-4 shrink-0 text-brand-600 mt-0.5" />
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{result.message}</p>
                {result.devResetToken ? (
                  <>
                    <p className="mt-1.5 text-xs text-brand-700">
                      Local demo mode token (in production this token is delivered via email):
                    </p>
                    <code className="mt-2 block break-all rounded bg-white p-2 font-mono text-[11px] text-slate-800 border border-brand-200">
                      {result.devResetToken}
                    </code>
                    <Link to={`/reset-password?token=${encodeURIComponent(result.devResetToken)}`} className="mt-2.5 inline-flex">
                      <Button size="sm" icon={ArrowRight}>Continue to reset</Button>
                    </Link>
                  </>
                ) : (
                  <p className="mt-1 text-xs text-brand-700">Please check your inbox to proceed with password reset.</p>
                )}
              </div>
            </div>
          </div>
        )}

        <Field label="Email address" htmlFor="email" error={errors.email?.message} required>
          <Input id="email" type="email" autoComplete="email" placeholder="you@example.com" invalid={Boolean(errors.email)} {...register('email')} />
        </Field>

        <Button type="submit" size="md" className="w-full" icon={Send} loading={isSubmitting}>
          Send reset token
        </Button>
      </form>

      <div className="mt-4 flex items-start gap-2 rounded-md border border-slate-200 bg-slate-50 p-2.5 text-xs text-slate-600">
        <KeyRound className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-500" />
        <span>For security purposes, the status response is the same regardless of registration state.</span>
      </div>
    </AuthLayout>
  )
}
