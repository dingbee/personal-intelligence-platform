/** Fills a PromptTemplate's `{{variable}}` placeholders — generic on purpose so any capability can reuse it, not just RAG chat's `{{context}}`. */
export function renderPromptTemplate(template: string, variables: Record<string, string>): string {
  return Object.entries(variables).reduce(
    (result, [key, value]) => result.replaceAll(`{{${key}}}`, value),
    template,
  )
}
