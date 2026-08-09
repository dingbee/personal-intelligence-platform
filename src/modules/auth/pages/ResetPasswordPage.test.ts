import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

/**
 * Post-10/10 password-recovery hotfix, tightened in Phase 5.2. `/reset-password`
 * is a real, already public route (unchanged this phase) — this suite covers
 * the page's own recovery-session handling: it must not assume arriving here
 * means the user is authenticated normally, and must not present a password
 * form unless `passwordRecovery` is specifically true (an already-logged-in
 * user with an unrelated session manually visiting this route should see the
 * same invalid/expired state as someone with no session at all).
 */
const { useAuthMock } = vi.hoisted(() => ({ useAuthMock: vi.fn() }))
vi.mock('@/modules/auth/useAuth', () => ({ useAuth: useAuthMock }))

import { ResetPasswordPage } from '@/modules/auth/pages/ResetPasswordPage'

afterEach(cleanup)

function renderPage() {
  return render(createElement(MemoryRouter, { initialEntries: ['/reset-password'] }, createElement(ResetPasswordPage)))
}

describe('ResetPasswordPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows a loading state while Supabase is still resolving the recovery session', () => {
    useAuthMock.mockReturnValue({ passwordRecovery: false, loading: true, updatePassword: vi.fn() })

    renderPage()

    expect(screen.getByRole('status', { name: 'Loading' })).not.toBeNull()
    expect(screen.queryByLabelText('New password')).toBeNull()
  })

  it('shows a recoverable "link no longer valid" error when no session is present once loading resolves', () => {
    useAuthMock.mockReturnValue({ passwordRecovery: false, loading: false, updatePassword: vi.fn() })

    renderPage()

    expect(screen.getByText('This link is no longer valid')).not.toBeNull()
    expect(screen.queryByLabelText('New password')).toBeNull()
    const link = screen.getByText('Request a new reset link') as HTMLAnchorElement
    expect(link.getAttribute('href')).toBe('/forgot-password')
  })

  it('shows the same invalid/expired state for an unrelated, non-recovery session (e.g. an already-logged-in user manually visiting the route)', () => {
    useAuthMock.mockReturnValue({ passwordRecovery: false, loading: false, updatePassword: vi.fn() })

    renderPage()

    expect(screen.getByText('This link is no longer valid')).not.toBeNull()
    expect(screen.queryByLabelText('New password')).toBeNull()
  })

  it('renders the password-change form when a recovery session is present', () => {
    useAuthMock.mockReturnValue({ passwordRecovery: true, loading: false, updatePassword: vi.fn() })

    renderPage()

    expect(screen.getByText('Set a new password')).not.toBeNull()
    expect(screen.getByLabelText('New password')).not.toBeNull()
    expect(screen.getByLabelText('Confirm new password')).not.toBeNull()
  })

  it('rejects a mismatched confirmation without calling updatePassword', async () => {
    const updatePasswordMock = vi.fn()
    useAuthMock.mockReturnValue({ passwordRecovery: true, loading: false, updatePassword: updatePasswordMock })

    renderPage()
    fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'newpassword1' } })
    fireEvent.change(screen.getByLabelText('Confirm new password'), { target: { value: 'somethingelse1' } })
    fireEvent.click(screen.getByRole('button', { name: 'Update password' }))

    expect(await screen.findByText("Passwords don't match.")).not.toBeNull()
    expect(updatePasswordMock).not.toHaveBeenCalled()
  })

  it('calls updatePassword with the new password when both fields match', async () => {
    const updatePasswordMock = vi.fn(async () => ({ error: null }))
    useAuthMock.mockReturnValue({ passwordRecovery: true, loading: false, updatePassword: updatePasswordMock })

    renderPage()
    fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'newpassword1' } })
    fireEvent.change(screen.getByLabelText('Confirm new password'), { target: { value: 'newpassword1' } })
    fireEvent.click(screen.getByRole('button', { name: 'Update password' }))

    await screen.findByText('Password updated')
    expect(updatePasswordMock).toHaveBeenCalledWith('newpassword1')
  })

  it('shows the success state and a link back to login after a successful update', async () => {
    const updatePasswordMock = vi.fn(async () => ({ error: null }))
    useAuthMock.mockReturnValue({ passwordRecovery: true, loading: false, updatePassword: updatePasswordMock })

    renderPage()
    fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'newpassword1' } })
    fireEvent.change(screen.getByLabelText('Confirm new password'), { target: { value: 'newpassword1' } })
    fireEvent.click(screen.getByRole('button', { name: 'Update password' }))

    expect(await screen.findByText('Password updated')).not.toBeNull()
    const link = screen.getByText('Back to login') as HTMLAnchorElement
    expect(link.getAttribute('href')).toBe('/login')
  })

  it('shows a safe, user-facing error when updatePassword fails, without a success state', async () => {
    const updatePasswordMock = vi.fn(async () => ({ error: 'New password should be different from the old password.' }))
    useAuthMock.mockReturnValue({ passwordRecovery: true, loading: false, updatePassword: updatePasswordMock })

    renderPage()
    fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'newpassword1' } })
    fireEvent.change(screen.getByLabelText('Confirm new password'), { target: { value: 'newpassword1' } })
    fireEvent.click(screen.getByRole('button', { name: 'Update password' }))

    expect(await screen.findByText('New password should be different from the old password.')).not.toBeNull()
    expect(screen.queryByText('Password updated')).toBeNull()
  })
})
