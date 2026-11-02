import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Accessibility, Activity, BadgeCheck, CarFront, CheckCircle2, KeyRound, Pencil, Plus, ShieldCheck, Trash2,
  UserRound, Zap,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { ErrorPanel, InlineError, PageHeader, Tabs } from '../components/app'
import { Badge, Button, Card, Checkbox, EmptyState, Field, Input, Modal, Select, Skeleton } from '../components/ui'
import { useAuth } from '../context/AuthContext'
import { changePasswordSchema, profileSchema, vehicleSchema, type ChangePasswordValues, type ProfileValues, type VehicleValues } from '../schemas/auth'
import { api } from '../services/api'
import { friendlyAction } from '../lib/errors'
import { formatInZone, relativeFromNow } from '../lib/datetime'
import type { Vehicle } from '../types'

type Tab = 'profile' | 'vehicles' | 'security' | 'activity'

const tabItems: { value: Tab; label: string }[] = [
  { value: 'profile', label: 'Profile' },
  { value: 'vehicles', label: 'Vehicles' },
  { value: 'security', label: 'Security' },
  { value: 'activity', label: 'Activity' },
]

const emptyVehicle = {
  registrationNumber: '', vehicleType: 'CAR' as const, widthM: undefined, lengthM: undefined, isDefault: false,
}

export default function Profile() {
  const { user, refreshUser, logout } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [params, setParams] = useSearchParams()
  const tab = (tabItems.some((item) => item.value === params.get('tab')) ? params.get('tab') : 'profile') as Tab
  const [vehicleModal, setVehicleModal] = useState(false)
  const [editing, setEditing] = useState<Vehicle | null>(null)
  const [deleting, setDeleting] = useState<Vehicle | null>(null)

  const vehicles = useQuery({ queryKey: ['vehicles'], queryFn: api.vehicles })
  const activity = useQuery({ queryKey: ['activity'], queryFn: api.activity, enabled: tab === 'activity' })

  const profileForm = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: { name: user?.name ?? '', accessibilityRequired: user?.accessibilityRequired ?? false },
  })
  const vehicleForm = useForm<VehicleValues>({
    resolver: zodResolver(vehicleSchema),
    defaultValues: emptyVehicle,
  })
  const passwordForm = useForm<ChangePasswordValues>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  })

  useEffect(() => {
    if (user) profileForm.reset({ name: user.name, accessibilityRequired: user.accessibilityRequired })
  }, [user, profileForm])

  const profileMutation = useMutation({
    mutationFn: (values: ProfileValues) => api.updateProfile(values),
    onSuccess: async () => {
      await refreshUser()
      toast.success('Profile updated')
    },
  })

  const vehicleMutation = useMutation({
    mutationFn: (values: VehicleValues) => {
      const body: Record<string, unknown> = {
        registrationNumber: values.registrationNumber.trim().toUpperCase(),
        vehicleType: values.vehicleType,
        widthM: values.widthM ?? null,
        lengthM: values.lengthM ?? null,
        isDefault: Boolean(values.isDefault),
      }
      return editing ? api.updateVehicle(editing.id, body) : api.addVehicle(body)
    },
    onSuccess: async () => {
      setVehicleModal(false)
      setEditing(null)
      vehicleForm.reset(emptyVehicle)
      await queryClient.invalidateQueries({ queryKey: ['vehicles'] })
      toast.success(editing ? 'Vehicle updated' : 'Vehicle added')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (vehicle: Vehicle) => api.deleteVehicle(vehicle.id),
    onSuccess: async () => {
      setDeleting(null)
      await queryClient.invalidateQueries({ queryKey: ['vehicles'] })
      toast.success('Vehicle removed')
    },
  })

  const passwordMutation = useMutation({
    mutationFn: (values: ChangePasswordValues) => api.changePassword(values.currentPassword, values.newPassword),
    onSuccess: async () => {
      await logout()
      navigate('/login', { replace: true, state: { message: 'Password updated. Sign in with your new password.' } })
    },
  })

  const setTab = (value: Tab) => {
    const next = new URLSearchParams(params)
    next.set('tab', value)
    setParams(next, { replace: true })
  }

  const openCreate = () => {
    setEditing(null)
    vehicleForm.reset(emptyVehicle)
    setVehicleModal(true)
  }

  const openEdit = (vehicle: Vehicle) => {
    setEditing(vehicle)
    vehicleForm.reset({
      registrationNumber: vehicle.registrationNumber,
      vehicleType: vehicle.vehicleType,
      widthM: vehicle.widthM ?? undefined,
      lengthM: vehicle.lengthM ?? undefined,
      isDefault: vehicle.isDefault,
    })
    setVehicleModal(true)
  }

  const submitVehicle = vehicleForm.handleSubmit((values) => vehicleMutation.mutate(values))

  return (
    <div>
      <PageHeader
        eyebrow="Account Settings"
        title="Profile & Vehicles"
        description="Manage your account profile, registered vehicles, password security, and audited activity."
      />

      <div className="grid gap-6 lg:grid-cols-[260px_1fr] lg:items-start">
        {/* User Sidebar */}
        <aside className="space-y-4">
          <Card className="p-4 text-center">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-brand-50 border border-brand-200 text-lg font-bold text-brand-700">
              {user?.name.slice(0, 1).toUpperCase()}
            </span>
            <p className="mt-3 text-sm font-bold text-slate-900">{user?.name}</p>
            <p className="truncate text-xs text-slate-500">{user?.email}</p>
            <div className="mt-2.5 flex justify-center gap-1.5">
              <Badge tone={user?.role === 'ADMIN' ? 'dark' : 'brand'}>
                {user?.role === 'ADMIN' ? 'Administrator' : 'User'}
              </Badge>
              <Badge tone={user?.accountStatus === 'ACTIVE' ? 'lime' : 'rose'}>
                {user?.accountStatus === 'ACTIVE' ? 'Active' : 'Disabled'}
              </Badge>
            </div>
            <div className="mt-4 border-t border-slate-100 pt-3 text-left text-xs text-slate-500 space-y-1.5">
              <div className="flex justify-between">
                <span>Member since</span>
                <span className="font-medium text-slate-700">{user ? formatInZone(user.createdAt, Intl.DateTimeFormat().resolvedOptions().timeZone, 'MMM yyyy') : '—'}</span>
              </div>
              <div className="flex justify-between">
                <span>Accessibility</span>
                <span className="font-medium text-slate-700">{user?.accessibilityRequired ? 'Required' : 'Standard'}</span>
              </div>
            </div>
          </Card>

          <Tabs tabs={tabItems} value={tab} onChange={setTab} className="flex-col" />
        </aside>

        {/* Tab Content */}
        <div className="min-w-0 space-y-4">
          {tab === 'profile' && (
            <Card className="p-5 sm:p-6">
              <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-md bg-brand-50 text-brand-700 border border-brand-200">
                  <UserRound className="h-4 w-4" />
                </span>
                <div>
                  <h2 className="text-sm font-bold text-slate-900">Personal Information</h2>
                  <p className="text-xs text-slate-500">Name and contact details registered with the system.</p>
                </div>
              </div>

              <form onSubmit={profileForm.handleSubmit((values) => profileMutation.mutate(values))} className="mt-4 space-y-4" noValidate>
                {profileMutation.isError && <InlineError error={profileMutation.error} />}
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Full name" htmlFor="profile-name" error={profileForm.formState.errors.name?.message} required>
                    <Input id="profile-name" invalid={Boolean(profileForm.formState.errors.name)} {...profileForm.register('name')} />
                  </Field>
                  <Field label="Email address" htmlFor="profile-email" hint="Immutable email identifier">
                    <Input id="profile-email" value={user?.email ?? ''} disabled />
                  </Field>
                </div>

                <div className="pt-1">
                  <Checkbox
                    label="I require accessible parking bays"
                    description="Used by the allocation engine to enforce accessible bay assignments. Only select if you hold a valid permit."
                    {...profileForm.register('accessibilityRequired')}
                  />
                </div>

                <div className="flex justify-end border-t border-slate-100 pt-3">
                  <Button type="submit" size="sm" loading={profileMutation.isPending}>Save Changes</Button>
                </div>
              </form>
            </Card>
          )}

          {tab === 'vehicles' && (
            <Card className="p-5 sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
                <div>
                  <h2 className="text-sm font-bold text-slate-900">Registered Vehicles</h2>
                  <p className="text-xs text-slate-500">Manage license plates and dimensions for automated bay matching.</p>
                </div>
                <Button size="sm" icon={Plus} onClick={openCreate}>Add Vehicle</Button>
              </div>

              {vehicles.isPending ? (
                <div className="mt-4 space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-md" />)}</div>
              ) : vehicles.isError ? (
                <div className="mt-4"><ErrorPanel error={vehicles.error} onRetry={() => void vehicles.refetch()} /></div>
              ) : vehicles.data?.length === 0 ? (
                <div className="mt-4">
                  <EmptyState
                    icon={CarFront}
                    title="No vehicles registered"
                    description="Add a vehicle with license plate details to proceed with parking reservations."
                    action={<Button size="sm" icon={Plus} onClick={openCreate}>Add Vehicle</Button>}
                  />
                </div>
              ) : (
                <div className="mt-4 space-y-2">
                  {vehicles.data?.map((vehicle) => (
                    <div key={vehicle.id} className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-white p-3 sm:flex-row sm:items-center sm:justify-between hover:border-slate-300">
                      <div className="flex items-center gap-3">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-slate-50 border border-slate-200 text-slate-700">
                          {vehicle.vehicleType === 'EV' ? <Zap className="h-4 w-4 text-amber-500" /> : <CarFront className="h-4 w-4" />}
                        </span>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-bold text-slate-900">{vehicle.registrationNumber}</span>
                            <Badge tone="neutral">{vehicle.vehicleType}</Badge>
                            {vehicle.isDefault && <Badge tone="lime">Default</Badge>}
                          </div>
                          <p className="mt-0.5 text-[11px] text-slate-500">
                            {vehicle.widthM != null ? `${vehicle.widthM}m wide` : 'Standard width'} · {vehicle.lengthM != null ? `${vehicle.lengthM}m long` : 'Standard length'} · Added {relativeFromNow(vehicle.createdAt)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 self-end sm:self-center">
                        <Button size="sm" variant="outline" icon={Pencil} onClick={() => openEdit(vehicle)}>Edit</Button>
                        <Button size="sm" variant="ghost" icon={Trash2} className="text-rose-600 hover:bg-rose-50" onClick={() => setDeleting(vehicle)}>Delete</Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          )}

          {tab === 'security' && (
            <div className="space-y-4">
              <Card className="p-5 sm:p-6">
                <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-md bg-brand-50 text-brand-700 border border-brand-200">
                    <KeyRound className="h-4 w-4" />
                  </span>
                  <div>
                    <h2 className="text-sm font-bold text-slate-900">Change Password</h2>
                    <p className="text-xs text-slate-500">Changing your password safely terminates all active refresh sessions.</p>
                  </div>
                </div>

                <form onSubmit={passwordForm.handleSubmit((values) => passwordMutation.mutate(values))} className="mt-4 max-w-md space-y-3.5" noValidate>
                  {passwordMutation.isError && <InlineError error={passwordMutation.error} />}
                  <Field label="Current password" htmlFor="current-password" error={passwordForm.formState.errors.currentPassword?.message} required>
                    <Input id="current-password" type="password" autoComplete="current-password" invalid={Boolean(passwordForm.formState.errors.currentPassword)} {...passwordForm.register('currentPassword')} />
                  </Field>
                  <Field label="New password" htmlFor="new-password" error={passwordForm.formState.errors.newPassword?.message} required>
                    <Input id="new-password" type="password" autoComplete="new-password" invalid={Boolean(passwordForm.formState.errors.newPassword)} {...passwordForm.register('newPassword')} />
                  </Field>
                  <Field label="Confirm new password" htmlFor="confirm-new-password" error={passwordForm.formState.errors.confirmPassword?.message} required>
                    <Input id="confirm-new-password" type="password" autoComplete="new-password" invalid={Boolean(passwordForm.formState.errors.confirmPassword)} {...passwordForm.register('confirmPassword')} />
                  </Field>
                  <p className="text-[11px] text-slate-500 font-medium">Must be at least 10 characters and contain upper, lower, and numeric characters.</p>
                  <div className="border-t border-slate-100 pt-3">
                    <Button type="submit" size="sm" loading={passwordMutation.isPending} icon={ShieldCheck}>Update Password</Button>
                  </div>
                </form>
              </Card>

              <Card className="p-4">
                <h3 className="text-xs font-semibold text-slate-900 border-b border-slate-100 pb-2">Session Security Architecture</h3>
                <div className="mt-3 space-y-2 text-xs text-slate-600">
                  <div className="flex items-start gap-2">
                    <ShieldCheck className="h-4 w-4 shrink-0 text-brand-600 mt-0.5" />
                    <span>In-memory short-lived access tokens (15-minute expiration) mitigate XSS exposure.</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <BadgeCheck className="h-4 w-4 shrink-0 text-brand-600 mt-0.5" />
                    <span>HttpOnly, SameSite=Strict rotating refresh token cookie prevents unauthorized cross-site token exfiltration.</span>
                  </div>
                </div>
              </Card>
            </div>
          )}

          {tab === 'activity' && (
            <Card className="p-5 sm:p-6">
              <div className="border-b border-slate-100 pb-3">
                <h2 className="text-sm font-bold text-slate-900">Security & Account Audit Trail</h2>
                <p className="text-xs text-slate-500">Immutable chronological record of recent operations on your account.</p>
              </div>

              {activity.isPending ? (
                <div className="mt-4 space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 rounded-md" />)}</div>
              ) : activity.isError ? (
                <div className="mt-4"><ErrorPanel error={activity.error} onRetry={() => void activity.refetch()} /></div>
              ) : activity.data?.length === 0 ? (
                <div className="mt-4"><EmptyState icon={Activity} title="No activity recorded" description="Actions like logins, vehicle additions, and reservations will appear here." /></div>
              ) : (
                <div className="mt-3 space-y-1.5">
                  {activity.data?.map((entry, index) => (
                    <div key={`${entry.createdAt}-${index}`} className="flex items-center justify-between rounded-md border border-slate-100 bg-slate-50/50 px-3 py-2 text-xs">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                        <span className="font-semibold text-slate-800">{friendlyAction(entry.action)}</span>
                        <span className="text-slate-500 font-medium">({entry.resourceType})</span>
                      </div>
                      <span className="text-[11px] text-slate-500">{relativeFromNow(entry.createdAt)}</span>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          )}
        </div>
      </div>

      {/* Vehicle Add / Edit Modal */}
      <Modal
        open={vehicleModal}
        onClose={() => { setVehicleModal(false); setEditing(null) }}
        title={editing ? 'Edit Vehicle' : 'Register New Vehicle'}
        description="License plate registration is normalised for duplicate checks. Dimensions help ensure compatible slot sizing."
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => { setVehicleModal(false); setEditing(null) }}>Cancel</Button>
            <Button size="sm" loading={vehicleMutation.isPending} onClick={() => void submitVehicle()}>{editing ? 'Save Vehicle' : 'Add Vehicle'}</Button>
          </>
        }
      >
        <form onSubmit={submitVehicle} className="space-y-3.5" noValidate>
          {vehicleMutation.isError && <InlineError error={vehicleMutation.error} />}
          <Field label="License Plate Number" htmlFor="vehicle-registration" error={vehicleForm.formState.errors.registrationNumber?.message} required>
            <Input id="vehicle-registration" placeholder="MH 12 AB 1234" className="font-mono uppercase" invalid={Boolean(vehicleForm.formState.errors.registrationNumber)} {...vehicleForm.register('registrationNumber')} />
          </Field>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Vehicle Type" htmlFor="vehicle-type" error={vehicleForm.formState.errors.vehicleType?.message} required>
              <Select id="vehicle-type" {...vehicleForm.register('vehicleType')}>
                <option value="CAR">Car</option>
                <option value="SUV">SUV</option>
                <option value="MOTORCYCLE">Motorcycle</option>
                <option value="EV">Electric Vehicle</option>
              </Select>
            </Field>
            <Field label="Width (m)" htmlFor="vehicle-width" error={vehicleForm.formState.errors.widthM?.message}>
              <Input id="vehicle-width" type="number" step="0.01" min="0.5" max="5" placeholder="1.80" invalid={Boolean(vehicleForm.formState.errors.widthM)} {...vehicleForm.register('widthM', { setValueAs: (v) => v === '' ? undefined : Number(v) })} />
            </Field>
            <Field label="Length (m)" htmlFor="vehicle-length" error={vehicleForm.formState.errors.lengthM?.message}>
              <Input id="vehicle-length" type="number" step="0.01" min="0.5" max="15" placeholder="4.40" invalid={Boolean(vehicleForm.formState.errors.lengthM)} {...vehicleForm.register('lengthM', { setValueAs: (v) => v === '' ? undefined : Number(v) })} />
            </Field>
          </div>
          <Checkbox label="Set as default vehicle" description="Automatically pre-selected during reservation configuration." {...vehicleForm.register('isDefault')} />
        </form>
      </Modal>

      {/* Delete Vehicle Confirmation Modal */}
      <Modal
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        title="Remove Vehicle?"
        description={deleting ? `Remove ${deleting.registrationNumber} from your vehicle list?` : ''}
        size="sm"
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setDeleting(null)}>Keep</Button>
            <Button variant="danger" size="sm" loading={deleteMutation.isPending} onClick={() => deleting && deleteMutation.mutate(deleting)}>Confirm Delete</Button>
          </>
        }
      >
        {deleteMutation.isError && <InlineError error={deleteMutation.error} />}
        <p className="text-xs text-slate-500">Note: Deletion will be rejected if this is the only registered vehicle on active upcoming reservations.</p>
      </Modal>
    </div>
  )
}
