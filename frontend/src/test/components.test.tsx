import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { Tabs } from '../components/app'
import { Button, StatusBadge } from '../components/ui'
import { bookingStatusLabel, slotStateStyle } from '../lib/status'

describe('shared UI', () => {
  it('renders booking status labels and classes', () => {
    render(<StatusBadge status="ACTIVE" />)
    expect(screen.getByText(bookingStatusLabel.ACTIVE)).toBeInTheDocument()
    expect(bookingStatusLabel.CONFIRMED).toBe('Confirmed')
    expect(slotStateStyle.AVAILABLE).toContain('lime')
  })

  it('calls the click handler and disables a loading button', async () => {
    const onClick = vi.fn()
    const { rerender } = render(<Button onClick={onClick}>Reserve</Button>)
    await userEvent.click(screen.getByRole('button', { name: 'Reserve' }))
    expect(onClick).toHaveBeenCalledTimes(1)

    rerender(<Button loading onClick={onClick}>Reserve</Button>)
    expect(screen.getByRole('button')).toBeDisabled()
  })

  it('switches tabs with accessible state', async () => {
    function Harness() {
      const [value, setValue] = useState<'overview' | 'users'>('overview')
      return <Tabs value={value} onChange={setValue} tabs={[{ value: 'overview', label: 'Overview' }, { value: 'users', label: 'Users', count: 3 }]} />
    }
    render(<Harness />)
    expect(screen.getByRole('tab', { name: /Overview/ })).toHaveAttribute('aria-selected', 'true')
    await userEvent.click(screen.getByRole('tab', { name: /Users/ }))
    expect(screen.getByRole('tab', { name: /Users/ })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: /Overview/ })).toHaveAttribute('aria-selected', 'false')
  })
})
