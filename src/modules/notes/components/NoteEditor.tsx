import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import { useEffect } from 'react'

export function NoteEditor({
  content,
  onChange,
  editable = true,
}: {
  content: string
  onChange: (html: string) => void
  editable?: boolean
}) {
  const editor = useEditor({
    extensions: [StarterKit, Placeholder.configure({ placeholder: 'Start writing…' })],
    content,
    editable,
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    editorProps: {
      attributes: {
        class: 'prose-note min-h-[400px] focus:outline-none',
      },
    },
  })

  // Re-sync when content changes from outside the editor (e.g. "Improve
  // writing" replacing it) — but not on every keystroke, which would fight
  // the user's own typing.
  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content, { emitUpdate: false })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content, editor])

  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4 text-[var(--color-ink)] focus-within:border-[var(--color-accent)]">
      <EditorContent editor={editor} />
    </div>
  )
}
