import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

/**
 * V1 — Collaboration Invitation Signup Authorization. SignUpPage now
 * distinguishes three denial reasons (no invitation / expired workspace
 * invitation / revoked workspace invitation) rather than a single
 * beta-only denial, and the "Request access" mailto fallback is scoped
 * to the 'not_invited' case only — someone with an expired or revoked
 * *workspace* invitation has a more specific, correct next step (ask the
 * workspace owner to re-invite them).
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

  it('sets an honest expectation that access comes through a workspace invitation, before any submission', () => {
    renderPage()

    expect(screen.getByText(/workspace invitation/i)).not.toBeNull()
    expect(screen.queryByText(/beta/i)).toBeNull()
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

  it('shows a working "Request access" mailto link when there is no invitation of any kind, addressed to the real access-request inbox', async () => {
    signUpWithPasswordMock.mockResolvedValueOnce({
      error: 'ARRIYIA access is currently provided through a workspace invitation. If someone has invited you to their workspace, use the link from that invitation email.',
      denialReason: 'not_invited',
    })
    renderPage()

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'stranger@example.com' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password123' } })
    fireEvent.click(screen.getByRole('button', { name: 'Sign up' }))

    const requestLink = await screen.findByRole('link', { name: /Request access/ })
    const href = requestLink.getAttribute('href') ?? ''
    expect(href.startsWith('mailto:dan@nolmark.co?')).toBe(true)
    expect(href).toContain('subject=ARRIYIA%20access%20request')
    expect(decodeURIComponent(href)).toContain('stranger@example.com')
  })

  it('shows the expired-invitation message without a "Request access" link (a re-invite from the workspace owner is the correct next step)', async () => {
    signUpWithPasswordMock.mockResolvedValueOnce({
      error: 'Your workspace invitation has expired. Ask the workspace owner to send you a new one.',
      denialReason: 'invitation_expired',
    })
    renderPage()

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'expired@example.com' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password123' } })
    fireEvent.click(screen.getByRole('button', { name: 'Sign up' }))

    await screen.findByText('Your workspace invitation has expired. Ask the workspace owner to send you a new one.')
    expect(screen.queryByRole('link', { name: /Request access/ })).toBeNull()
  })

  it('shows the revoked-invitation message without a "Request access" link', async () => {
    signUpWithPasswordMock.mockResolvedValueOnce({
      error: 'This workspace invitation is no longer valid. Ask the workspace owner to send you a new one.',
      denialReason: 'invitation_revoked',
    })
    renderPage()

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'revoked@example.com' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password123' } })
    fireEvent.click(screen.getByRole('button', { name: 'Sign up' }))

    await screen.findByText('This workspace invitation is no longer valid. Ask the workspace owner to send you a new one.')
    expect(screen.queryByRole('link', { name: /Request access/ })).toBeNull()
  })

  it('does not show a "Request access" link for an unexpected, non-denial error (e.g. a network failure)', async () => {
    signUpWithPasswordMock.mockResolvedValueOnce({ error: 'Network error, please try again.' })
    renderPage()

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'someone@example.com' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password123' } })
    fireEvent.click(screen.getByRole('button', { name: 'Sign up' }))

    await screen.findByText('Network error, please try again.')
    expect(screen.queryByRole('link', { name: /Request access/ })).toBeNull()
  })

  it('preserves the existing successful signup path unchanged (valid workspace invitation or admin invite)', async () => {
    signUpWithPasswordMock.mockResolvedValueOnce({ error: null })
    renderPage()

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'invited@example.com' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password123' } })
    fireEvent.click(screen.getByRole('button', { name: 'Sign up' }))

    expect(await screen.findByText('Check your inbox')).not.toBeNull()
    expect(screen.queryByRole('link', { name: /Request access/ })).toBeNull()
  })
})
