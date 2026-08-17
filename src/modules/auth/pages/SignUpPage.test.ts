import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

/**
 * V1 Launch Hardening, Workstream 1 — SignUpPage previously turned an
 * is_beta_invited denial into a dead end: an honest error with no
 * discoverable next step. These tests pin the fix: a denial specifically
 * (not any other signup error) now renders a working "Request access"
 * mailto link, and the page sets an honest early-access expectation
 * before the visitor ever submits.
 */

const { signUpWithPasswordMock } = vi.hoisted(() => ({ signUpWithPasswordMock: vi.fn() }))
vi.mock('@/modules/auth/useAuth', () => ({ useAuth: () => ({ signUpWithPassword: signUpWithPasswordMock }) }))

import { SignUpPage } from '@/modules/auth/pages/SignUpPage'

function renderPage() {
  return render(createElement(MemoryRouter, null, createElement(SignUpPage)))
}

afterEach(cleanup)

describe('SignUpPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('sets an honest early-access expectation before any submission', () => {
    renderPage()

    expect(screen.getByText(/currently invite-only/i)).not.toBeNull()
  })

  it('shows a working "Request access" mailto link when denied by the invite gate, addressed to the real access-request inbox', async () => {
    signUpWithPasswordMock.mockResolvedValueOnce({
      error: 'This email doesn’t have access yet. Contact us for an invitation.',
      notInvited: true,
    })
    renderPage()

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'stranger@example.com' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password123' } })
    fireEvent.click(screen.getByRole('button', { name: 'Sign up' }))

    const requestLink = await screen.findByRole('link', { name: /Request access/ })
    const href = requestLink.getAttribute('href') ?? ''
    expect(href.startsWith('mailto:dan@nolmark.co?')).toBe(true)
    expect(href).toContain('subject=ARRIYIA%20early%20access%20request')
    expect(decodeURIComponent(href)).toContain('stranger@example.com')
  })

  it('does not show a "Request access" link for a non-denial error (e.g. a network failure)', async () => {
    signUpWithPasswordMock.mockResolvedValueOnce({ error: 'Network error, please try again.' })
    renderPage()

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'someone@example.com' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password123' } })
    fireEvent.click(screen.getByRole('button', { name: 'Sign up' }))

    await screen.findByText('Network error, please try again.')
    expect(screen.queryByRole('link', { name: /Request access/ })).toBeNull()
  })

  it('preserves the existing successful signup path unchanged', async () => {
    signUpWithPasswordMock.mockResolvedValueOnce({ error: null })
    renderPage()

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'invited@example.com' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password123' } })
    fireEvent.click(screen.getByRole('button', { name: 'Sign up' }))

    expect(await screen.findByText('Check your inbox')).not.toBeNull()
    expect(screen.queryByRole('link', { name: /Request access/ })).toBeNull()
  })
})
