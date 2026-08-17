import { afterEach, describe, expect, it, vi } from 'vitest'
import { createElement, type ReactElement } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'

// ReaderIntelligencePanel unconditionally mounts PersonalIntelligenceTimeline
// (inside a collapsed <details>, which does not unmount its children), which
// in turn calls useKnowledgeInsights -> useAuth()/useWorkspace(). Both throw
// outside their real providers, so they're mocked the same way
// useAnalyzeImage.test.ts already mocks them for this codebase's tests.
vi.mock('@/modules/auth/useAuth', () => ({ useAuth: () => ({ user: { id: 'user-1' } }) }))
vi.mock('@/modules/workspaces/useWorkspace', () => ({ useWorkspace: () => ({ currentWorkspaceId: 'workspace-1' }) }))

import { ReaderIntelligencePanel } from '@/modules/reader/components/ReaderIntelligencePanel'
import type { ReaderInteractionState } from '@/modules/reader/intelligence/readerInteraction'
import type { LearningIntelligence } from '@/modules/intelligence/learning/learningTypes'
import type { CommandActions, CommandContext } from '@/modules/commands/types'

afterEach(() => cleanup())

/**
 * ReaderIntelligencePanel unconditionally mounts PersonalIntelligenceTimeline
 * (inside a collapsed <details>, which does not unmount its children), and
 * that component calls useQuery — so every render here needs a real
 * QueryClientProvider ancestor. Same pattern as useAnalyzeImage.test.ts.
 */
function renderPanel(element: ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(createElement(QueryClientProvider, { client: queryClient }, element))
}

function baseState(overrides: Partial<ReaderInteractionState> = {}): ReaderInteractionState {
  return {
    document: { id: 'doc-1', title: 'Deep Work' },
    chapter: { index: 0, title: 'Introduction' },
    progress: { scrollFraction: 0.3 },
    insights: [],
    signals: [],
    suggestions: [],
    journey: { status: 'started', summarizedChapterCount: 1, flashcardCount: 2, notesAddedCount: 1, questionsAskedCount: 3 },
    learningMode: null,
    references: [],
    ...overrides,
  }
}

function baseLearningMode(overrides: Partial<LearningIntelligence> = {}): LearningIntelligence {
  return {
    stage: 'in_progress',
    knowledgeLevel: 'developing',
    suggestedNextStep: 'Continue reading where you left off.',
    reviewOpportunity: false,
    practiceOpportunity: false,
    ...overrides,
  }
}

const commandContext: CommandContext = {
  userId: 'user-1',
  workspaceId: 'workspace-1',
  workspaceName: 'My Workspace',
  pathname: '/library/doc-1/read',
  documentId: 'doc-1',
  inProgressDocument: null,
}

function baseCommandActions(): CommandActions {
  return {
    navigate: vi.fn(),
    setCurrentWorkspaceId: vi.fn(),
    createNote: vi.fn(async () => ({ id: 'note-1' })),
    createConversationWithQuery: vi.fn(async () => ({ id: 'conv-1' })),
    createConversationWithNoteAnalysis: vi.fn(async () => ({ id: 'conv-1' })),
    openQuickCapture: vi.fn(),
  }
}

describe('ReaderIntelligencePanel — Learning Mode intelligence (Capability Audit #11+)', () => {
  it('renders nothing extra when learningMode is null (no Reader Chat turn yet)', () => {
    renderPanel(
      createElement(ReaderIntelligencePanel, {
        state: baseState(),
        workspaceId: 'workspace-1',
        onLocalSuggestion: vi.fn(),
        commandContext,
        commandActions: baseCommandActions(),
      }),
    )
    expect(screen.queryByText(/Learning:/)).toBeNull()
    // The existing raw journey facts must still render unchanged.
    expect(screen.getByText(/Reading journey:/)).toBeTruthy()
  })

  it('renders stage and suggested next step when learningMode is present, with no opportunity nudges when neither opportunity is true', () => {
    renderPanel(
      createElement(ReaderIntelligencePanel, {
        state: baseState({ learningMode: baseLearningMode() }),
        workspaceId: 'workspace-1',
        onLocalSuggestion: vi.fn(),
        commandContext,
        commandActions: baseCommandActions(),
      }),
    )
    expect(screen.getByText(/Learning:/)).toBeTruthy()
    expect(screen.getByText('In progress')).toBeTruthy()
    expect(screen.getByText('Continue reading where you left off.')).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Review your highlights/ })).toBeNull()
    expect(screen.queryByRole('button', { name: /Practice with flashcards/ })).toBeNull()
  })

  it('renders a review nudge that invokes the existing onLocalSuggestion(\'highlights\') mechanism when reviewOpportunity is true', () => {
    const onLocalSuggestion = vi.fn()
    renderPanel(
      createElement(ReaderIntelligencePanel, {
        state: baseState({ learningMode: baseLearningMode({ reviewOpportunity: true }) }),
        workspaceId: 'workspace-1',
        onLocalSuggestion,
        commandContext,
        commandActions: baseCommandActions(),
      }),
    )
    const button = screen.getByRole('button', { name: /Review your highlights/ })
    fireEvent.click(button)
    expect(onLocalSuggestion).toHaveBeenCalledWith('highlights')
  })

  it('renders a practice nudge that invokes the existing onLocalSuggestion(\'flashcards\') mechanism when practiceOpportunity is true', () => {
    const onLocalSuggestion = vi.fn()
    renderPanel(
      createElement(ReaderIntelligencePanel, {
        state: baseState({ learningMode: baseLearningMode({ practiceOpportunity: true }) }),
        workspaceId: 'workspace-1',
        onLocalSuggestion,
        commandContext,
        commandActions: baseCommandActions(),
      }),
    )
    const button = screen.getByRole('button', { name: /Practice with flashcards/ })
    fireEvent.click(button)
    expect(onLocalSuggestion).toHaveBeenCalledWith('flashcards')
  })

  it('does not replace or alter the existing raw Reading journey statistics line when learningMode is also present', () => {
    const { container } = renderPanel(
      createElement(ReaderIntelligencePanel, {
        state: baseState({ learningMode: baseLearningMode({ reviewOpportunity: true, practiceOpportunity: true }) }),
        workspaceId: 'workspace-1',
        onLocalSuggestion: vi.fn(),
        commandContext,
        commandActions: baseCommandActions(),
      }),
    )
    // The journey facts line is split across several sibling text nodes by
    // JSX interpolation, so getByText's per-element matching isn't a good
    // fit here — asserting on the rendered container text is the robust
    // equivalent (and is what the query itself points you toward on failure).
    expect(container.textContent).toMatch(/Reading journey:.*In progress.*1 summarized.*2 flashcards.*1 note.*3 conversations/s)
  })
})
