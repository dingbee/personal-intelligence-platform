import {
  isFuturePackageVersion,
  isSupportedPackageVersion,
} from '@/modules/knowledge-exchange/packages/PackageVersion'
import type {
  PackageValidationIssue,
  PackageValidationResult,
  PackageValidator,
} from '@/modules/knowledge-exchange/packages/PackageValidator'
import type { ConversationMessagePayload, ConversationPackage } from '@/modules/knowledge-exchange/conversations/conversationPackageTypes'

function issue(code: PackageValidationIssue['code'], message: string): PackageValidationIssue {
  return { code, message }
}

function validateMessageShape(input: unknown, index: number): { valid: true; message: ConversationMessagePayload } | { valid: false; issues: PackageValidationIssue[] } {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    return { valid: false, issues: [issue('invalid_schema', `Message #${index + 1} isn't a JSON object.`)] }
  }
  const message = input as Record<string, unknown>
  const issues: PackageValidationIssue[] = []

  if (message.role !== 'user' && message.role !== 'assistant') {
    issues.push(issue('invalid_schema', `Message #${index + 1} has an invalid "role" (${JSON.stringify(message.role)}) — only "user" or "assistant" are supported.`))
  }
  if (typeof message.content !== 'string') {
    issues.push(issue('missing_field', `Message #${index + 1} is missing "content".`))
  }
  if (typeof message.createdAt !== 'string') {
    issues.push(issue('missing_field', `Message #${index + 1} is missing "createdAt".`))
  }

  if (issues.length > 0) return { valid: false, issues }
  return {
    valid: true,
    message: { role: message.role as 'user' | 'assistant', content: message.content as string, createdAt: message.createdAt as string },
  }
}

/**
 * Never trusts a package as pre-validated just because it came from this
 * app's own Export, exactly like every other package type's validator.
 * Collects every issue found rather than stopping at the first.
 *
 * A conversation with zero messages is rejected — an empty conversation
 * carries no actual transferable content, the same "at least one
 * message" gate the Save As button itself already applies (disabled
 * until the conversation has messages), enforced here too as defense in
 * depth against a hand-crafted or corrupted package.
 */
export function validateConversationPackage(input: unknown): PackageValidationResult<ConversationPackage> {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    return { valid: false, issues: [issue('invalid_schema', "This doesn't look like a conversation package — expected a JSON object.")] }
  }
  const pkg = input as Record<string, unknown>
  const issues: PackageValidationIssue[] = []

  if (typeof pkg.version !== 'number') {
    issues.push(issue('missing_field', 'Missing or invalid "version" field.'))
  } else if (isFuturePackageVersion(pkg.version)) {
    issues.push(
      issue(
        'future_version',
        `This package was exported by a newer version of ARRIYIA (package version ${pkg.version}) that this app can't import yet.`,
      ),
    )
  } else if (!isSupportedPackageVersion(pkg.version)) {
    issues.push(issue('unsupported_version', `Package version ${JSON.stringify(pkg.version)} is not supported.`))
  }

  if (typeof pkg.exportedAt !== 'string') issues.push(issue('missing_field', 'Missing "exportedAt" field.'))
  if (typeof pkg.sourceVersion !== 'string') issues.push(issue('missing_field', 'Missing "sourceVersion" field.'))

  if (typeof pkg.conversation !== 'object' || pkg.conversation === null || Array.isArray(pkg.conversation)) {
    issues.push(issue('missing_field', 'Missing "conversation" field.'))
    return { valid: false, issues }
  }

  const conversation = pkg.conversation as Record<string, unknown>
  if (typeof conversation.title !== 'string' || conversation.title.trim() === '') {
    issues.push(issue('missing_field', 'The conversation is missing a "title".'))
  }
  if (typeof conversation.createdAt !== 'string') issues.push(issue('missing_field', 'The conversation is missing "createdAt".'))
  if (typeof conversation.updatedAt !== 'string') issues.push(issue('missing_field', 'The conversation is missing "updatedAt".'))

  if (!Array.isArray(conversation.messages)) {
    issues.push(issue('missing_field', 'The conversation is missing its "messages".'))
    return { valid: false, issues }
  }
  if (conversation.messages.length === 0) {
    issues.push(issue('invalid_schema', 'A conversation package must contain at least one message.'))
  }

  const messages: ConversationMessagePayload[] = []
  conversation.messages.forEach((rawMessage, index) => {
    const result = validateMessageShape(rawMessage, index)
    if (!result.valid) issues.push(...result.issues)
    else messages.push(result.message)
  })

  if (issues.length > 0) return { valid: false, issues }

  return {
    valid: true,
    package: {
      version: pkg.version as number,
      exportedAt: pkg.exportedAt as string,
      sourceVersion: pkg.sourceVersion as string,
      conversation: {
        title: conversation.title as string,
        createdAt: conversation.createdAt as string,
        updatedAt: conversation.updatedAt as string,
        messages,
      },
    },
  }
}

/** The file-upload entry point: parses raw text as JSON first, surfacing a malformed-JSON issue distinctly from a schema issue, then validates. */
export function parseConversationPackage(rawText: string): PackageValidationResult<ConversationPackage> {
  let parsed: unknown
  try {
    parsed = JSON.parse(rawText)
  } catch {
    return { valid: false, issues: [issue('malformed_json', "This file isn't valid JSON.")] }
  }
  return validateConversationPackage(parsed)
}

export const conversationPackageValidator: PackageValidator<ConversationPackage> = { validate: validateConversationPackage }
