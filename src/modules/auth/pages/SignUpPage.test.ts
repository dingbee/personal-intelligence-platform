import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

/**
 * V1 Free Access — open registration. SignUpPage no longer distinguishes
 * denial reasons or offers a "Request access" fallback — signUpWithPassword
 * either succeeds (open registration) or surfaces an ordinary signup
 * failure (network, validation, an already-registered email).
 */

const { signUpWithPasswordMock } = vi.hoisted(() => ({ signUpWithPasswordMock: vi.fn() }))
vi.mock('@/modules/auth/useAuth', () => ({ useAuth: () => ({ signUpWithPassword: signUpWithPasswordMock }) }))

import { SignUpPage } from '@/modules/auth/pages/SignUpPage'

function renderPage(initialEntry = '/signup') {
  return render(createElement(MemoryRouter, { initialEntries: [initialEntry] }, createElement(SignUpPage)))
}

afterEach(cleanup)

describe('SignUpPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('sets an honest expectation that signup is open and requires no invitation', () => {
    renderPage()

    expect(screen.getByText(/no invitation required/i)).not.toBeNull()
    expect(screen.queryByText(/beta/i)).toBeNull()
    expect(screen.queryByText(/workspace invitation/i)).toBeNull()
  })

  it('pre-fills the email field from the ?email= query param, as the invitation email link sends it', () => {
    renderPage('/signup?email=newperson%40example.com')

    expect((screen.getByLabelText('Email') as HTMLInputElement).value).toBe('newperson@example.com')
  })

  it('leaves the pre-filled email editable rather than locking it', () => {
    renderPage('/signup?email=newperson%40example.com')

    const emailInput = screen.getByLabelText('Email') as HTMLInputElement
    fireEvent.change(emailInput, { target: { value: 'different@example.com' } })

    expect(emailInput.value).toBe('different@example.com')
  })

  it('does not offer a "Request access" link — registration is open, there is no denial path', async () => {
    signUpWithPasswordMock.mockResolvedValueOnce({ error: 'Network error, please try again.' })
    renderPage()

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'someone@example.com' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password123' } })
    fireEvent.click(screen.getByRole('button', { name: 'Sign up' }))

    await screen.findByText('Network error, please try again.')
    expect(screen.queryByRole('link', { name: /Request access/ })).toBeNull()
  })

  it('surfaces an ordinary signup failure (e.g. already-registered email) as a plain error', async () => {
    signUpWithPasswordMock.mockResolvedValueOnce({ error: 'User already registered' })
    renderPage()

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'existing@example.com' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password123' } })
    fireEvent.click(screen.getByRole('button', { name: 'Sign up' }))

    await screen.findByText('User already registered')
  })

  it('shows the confirmation-email step on a successful open signup', async () => {
    signUpWithPasswordMock.mockResolvedValueOnce({ error: null })
    renderPage()

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'newuser@example.com' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password123' } })
    fireEvent.click(screen.getByRole('button', { name: 'Sign up' }))

    expect(await screen.findByText('Check your inbox')).not.toBeNull()
    expect(screen.queryByRole('link', { name: /Request access/ })).toBeNull()
  })
})
