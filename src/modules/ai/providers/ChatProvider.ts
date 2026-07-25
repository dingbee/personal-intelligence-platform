export interface ChatProviderMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface ChatRequest {
  messages: ChatProviderMessage[]
  system?: string
}

export interface ChatProvider {
  id: string
  /** Yields text deltas as they arrive — callers consume with `for await`. */
  chat(request: ChatRequest): AsyncGenerator<string>
}
