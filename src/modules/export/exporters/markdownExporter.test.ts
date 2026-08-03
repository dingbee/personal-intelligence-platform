import { describe, expect, it } from 'vitest'
import { exportContentToMarkdown } from '@/modules/export/exporters/markdownExporter'
import type { ExportContent } from '@/modules/export/types'

describe('exportContentToMarkdown', () => {
  it('renders the title as an H1 and the subtitle as italic text', () => {
    const md = exportContentToMarkdown({ title: 'Photosynthesis', subtitle: 'Concept · 82%', sections: [] })
    expect(md).toContain('# Photosynthesis')
    expect(md).toContain('_Concept · 82%_')
  })

  it('omits the subtitle line entirely when absent', () => {
    const md = exportContentToMarkdown({ title: 'Photosynthesis', sections: [] })
    expect(md).not.toContain('_')
  })

  it('renders a "list" section as bullet points', () => {
    const content: ExportContent = {
      title: 'Photosynthesis',
      sections: [{ heading: 'Related Concepts', body: ['Chlorophyll (requires)', 'Sunlight (requires)'], format: 'list' }],
    }
    const md = exportContentToMarkdown(content)
    expect(md).toContain('## Related Concepts')
    expect(md).toContain('- Chlorophyll (requires)')
    expect(md).toContain('- Sunlight (requires)')
  })

  it('renders a paragraphs section (the default) as plain lines, never bulleted', () => {
    const content: ExportContent = {
      title: 'My Note',
      sections: [{ body: ['First paragraph.', 'Second paragraph.'] }],
    }
    const md = exportContentToMarkdown(content)
    expect(md).toContain('First paragraph.')
    expect(md).toContain('Second paragraph.')
    expect(md).not.toContain('- First paragraph.')
  })

  it('omits a section heading line when the section has none', () => {
    const content: ExportContent = { title: 'My Note', sections: [{ body: ['Just body text.'] }] }
    const md = exportContentToMarkdown(content)
    expect(md).not.toContain('##')
  })
})
